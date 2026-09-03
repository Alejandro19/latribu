import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { LabPanelInput, LabPanelApproveInput } from '@latribu/shared-types';
import { db } from '../db/index.js';
import { clientNotifications } from '../models/schema.js';
import * as labPanelsService from '../services/lab-panels.service.js';
import { captureBenchmarkSnapshot } from '../services/mentoring-benchmark.service.js';
import { computeAndStoreBiologicalAge } from '../services/biological-age.service.js';
import { extractMarkersWithAI, AiNotConfiguredError, AiExtractionError } from '../services/lab-ai-extraction.service.js';
import * as ocrService from '../services/ocr.service.js';
import { uploadFile } from '../storage/index.js';
import { checkWeek1Activation } from '../services/onboarding-approvals.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listLabPanels(req: Request, res: Response) {
  const panels = await labPanelsService.listLabPanels(req.params.id);
  return ok(res, { panels });
}

// Guardado del cliente tras revisar el grid — deliberadamente NO dispara
// captureBenchmarkSnapshot acá (ver approveLabPanel): esta llamada puede
// repetirse (correcciones antes de que el admin apruebe), y esa tabla es
// insert-only e imposible de corregir después.
export async function upsertLabPanel(req: Request, res: Response) {
  const { semana, fecha, datos, diaCicloPanel, fileUrl, fileName, sourceFileHash } = req.body as LabPanelInput;
  const panel = await labPanelsService.upsertLabPanel(req.params.id, { semana, fecha, datos, diaCicloPanel, fileUrl, fileName, sourceFileHash });
  return ok(res, { panel });
}

// Sube el PDF/imagen del laboratorio, corre OCR + extracción por IA, y
// devuelve el grid estructurado — todavía SIN guardar en lab_panels (eso lo
// hace el cliente al confirmar, vía PUT .../lab-panels). Si el mismo archivo
// ya se procesó antes para ese checkpoint (mismo hash), no se vuelve a
// llamar a la IA — se reusa lo que ya se guardó.
export async function extractLabPanel(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  const semana = Number(req.body.semana);
  if (![0, 6, 12].includes(semana)) return err(res, 'La semana debe ser 0, 6 o 12.', 400);

  const sourceFileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const existing = await labPanelsService.findLabPanel(req.params.id, semana);

  if (existing?.sourceFileHash === sourceFileHash) {
    const datos = (existing.datos as Record<string, number>) || {};
    const markers = Object.entries(datos).map(([marker_id, value]) => ({ marker_id, value, unit: null, detected: true }));
    return ok(res, { markers, fileUrl: existing.fileUrl, fileName: existing.fileName, sourceFileHash, reused: true });
  }

  try {
    const base64 = req.file.buffer.toString('base64');
    const { text } = await ocrService.extractText(base64);
    if (!text.trim()) return err(res, 'No se pudo extraer texto del archivo.', 422);

    const markers = await extractMarkersWithAI(text);
    const fileUrl = await uploadFile(`${req.params.id}/lab-panels`, req.file.buffer, req.file.mimetype, req.file.originalname);

    return ok(res, { markers, fileUrl, fileName: req.file.originalname, sourceFileHash, reused: false });
  } catch (e) {
    if (e instanceof ocrService.FileTooLargeError) return err(res, e.message, 413);
    if (e instanceof ocrService.ApiKeyError) return err(res, e.message, 401);
    if (e instanceof ocrService.VisionNotConfiguredError) return err(res, e.message, 501);
    if (e instanceof ocrService.VisionApiError) return err(res, e.message, 500);
    if (e instanceof AiNotConfiguredError) return err(res, e.message, 501);
    if (e instanceof AiExtractionError) return err(res, e.message, 502);
    throw e;
  }
}

// Único punto que dispara captureBenchmarkSnapshot — ver comentario en
// lab-panels.service.ts::approveLabPanel. Efecto secundario silencioso: un
// fallo acá nunca debe romper la aprobación real del panel.
export async function approveLabPanel(req: Request, res: Response) {
  const semana = Number(req.params.semana);
  if (![0, 6, 12].includes(semana)) return err(res, 'La semana debe ser 0, 6 o 12.', 400);
  const { datos } = req.body as LabPanelApproveInput;

  let panel = await labPanelsService.approveLabPanel(req.params.id, semana, datos);
  if (!panel) return err(res, 'Panel no encontrado.', 404);

  try {
    await captureBenchmarkSnapshot(req.params.id, { semanaNumero: panel.semanaNumero, datos: panel.datos as Record<string, number> });
  } catch (e) {
    console.error('captureBenchmarkSnapshot failed', e);
  }
  try {
    await computeAndStoreBiologicalAge(req.params.id, panel);
    panel = (await labPanelsService.findLabPanel(req.params.id, semana)) ?? panel;
  } catch (e) {
    console.error('computeAndStoreBiologicalAge failed', e);
  }
  await db.insert(clientNotifications).values({ clientId: req.params.id, message: `Tu laboratorio de Semana ${semana} fue validado por el equipo.` });
  if (semana === 0) await checkWeek1Activation(req.params.id);
  return ok(res, { panel });
}
