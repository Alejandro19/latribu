import type { Request, Response } from 'express';
import type {
  BlindspotCaseCreateInput,
  BlindspotCaseUpdateInput,
  BlindspotTaskInput,
  BlindspotTaskUpdateInput,
  BlindspotSessionLogInput,
  TherapistCreateInput,
  TherapistUpdateInput,
} from '@latribu/shared-types';
import * as blindspotService from '../services/blindspot.service.js';
import * as therapistsService from '../services/therapists.service.js';
import * as clientsService from '../services/clients.service.js';
import { getPersonalInfoByClientId } from '../services/personal-info.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

// ==== ADMIN ====

export async function adminListCases(_req: Request, res: Response) {
  const cases = await blindspotService.listCases();
  return ok(res, { cases });
}

export async function adminGetCase(req: Request, res: Response) {
  const blindspotCase = await blindspotService.getCaseById(req.params.id);
  if (!blindspotCase) return err(res, 'Caso no encontrado.', 404);
  const [tasks, sessionLogs] = await Promise.all([
    blindspotService.listTasksByCaseId(blindspotCase.id),
    blindspotService.listSessionLogsByCaseId(blindspotCase.id),
  ]);
  return ok(res, { case: blindspotCase, tasks, sessionLogs });
}

export async function adminCreateCase(req: Request, res: Response) {
  const blindspotCase = await blindspotService.createCase(req.body as BlindspotCaseCreateInput);
  return ok(res, { case: blindspotCase }, 201);
}

export async function adminUpdateCase(req: Request, res: Response) {
  const updated = await blindspotService.updateCase(req.params.id, req.body as BlindspotCaseUpdateInput);
  if (!updated) return err(res, 'Caso no encontrado.', 404);
  return ok(res, { case: updated });
}

export async function adminAcknowledgeCrisis(req: Request, res: Response) {
  await blindspotService.acknowledgeCrisis(req.params.id);
  return ok(res, { message: 'Alerta atendida.' });
}

export async function adminListTherapists(_req: Request, res: Response) {
  const therapists = await therapistsService.listTherapists();
  return ok(res, { therapists });
}

export async function adminCreateTherapist(req: Request, res: Response) {
  const input = req.body as TherapistCreateInput;
  const existing = await therapistsService.findTherapistByEmail(input.email.toLowerCase().trim());
  if (existing) return err(res, 'Ese email ya está registrado como terapeuta.', 409);
  const therapist = await therapistsService.createTherapist({ ...input, email: input.email.toLowerCase().trim() });
  return ok(res, { therapist: { id: therapist.id, name: therapist.name, email: therapist.email, specialty: therapist.specialty, active: therapist.active } }, 201);
}

export async function adminUpdateTherapist(req: Request, res: Response) {
  const input = req.body as TherapistUpdateInput;
  if (input.email) {
    const existing = await therapistsService.findTherapistByEmail(input.email.toLowerCase().trim());
    if (existing && existing.id !== req.params.id) return err(res, 'Ese email ya está registrado como terapeuta.', 409);
  }
  const therapist = await therapistsService.updateTherapist(req.params.id, {
    ...input,
    email: input.email ? input.email.toLowerCase().trim() : undefined,
  });
  if (!therapist) return err(res, 'Terapeuta no encontrado.', 404);
  return ok(res, { therapist: { id: therapist.id, name: therapist.name, email: therapist.email, specialty: therapist.specialty, phone: therapist.phone, active: therapist.active } });
}

export async function adminDeleteTherapist(req: Request, res: Response) {
  try {
    const deleted = await therapistsService.deleteTherapist(req.params.id);
    if (!deleted) return err(res, 'Terapeuta no encontrado.', 404);
    return ok(res, { message: 'Terapeuta eliminado.' });
  } catch (e) {
    if (e instanceof therapistsService.TherapistHasCasesError) return err(res, e.message, 409);
    throw e;
  }
}

// ==== TERAPEUTA ====
// caseAccessOnly ya garantizó que el caso pertenece a este terapeuta.

export async function therapistListCases(req: Request, res: Response) {
  const all = await blindspotService.listCases();
  const mine = all.filter((c) => c.therapistId === req.user!.id);
  const enriched = await Promise.all(
    mine.map(async (c) => {
      const [client, sessionLogs] = await Promise.all([
        clientsService.findClientById(c.clientId),
        blindspotService.listSessionLogsByCaseId(c.id),
      ]);
      // sessionLogs ya viene ordenado desc por sessionDate — el [0] es el más reciente.
      return { ...c, clientName: client?.name ?? 'Cliente', lastSessionAt: sessionLogs[0]?.sessionDate ?? null };
    })
  );
  return ok(res, { cases: enriched });
}

export async function therapistGetCase(req: Request, res: Response) {
  const blindspotCase = await blindspotService.getCaseById(req.params.id);
  if (!blindspotCase) return err(res, 'Caso no encontrado.', 404);
  const [tasks, sessionLogs, client, personalInfo] = await Promise.all([
    blindspotService.listTasksByCaseId(blindspotCase.id),
    blindspotService.listSessionLogsByCaseId(blindspotCase.id),
    clientsService.findClientById(blindspotCase.clientId),
    getPersonalInfoByClientId(blindspotCase.clientId),
  ]);
  const { adminPrivateNotes: _adminPrivateNotes, ...caseForTherapist } = blindspotCase;
  const phone = personalInfo?.phoneNumber ? `${personalInfo.phoneCode ?? ''}${personalInfo.phoneNumber}` : null;
  return ok(res, {
    case: caseForTherapist,
    tasks,
    sessionLogs,
    client: client
      ? {
          id: client.id,
          name: client.name,
          email: client.email,
          cedula: personalInfo?.cedula ?? null,
          country: personalInfo?.country ?? null,
          city: personalInfo?.city ?? null,
          phone,
        }
      : null,
  });
}

export async function therapistCreateTask(req: Request, res: Response) {
  const task = await blindspotService.createTask(req.params.id, req.user!.id, req.body as BlindspotTaskInput);
  return ok(res, { task }, 201);
}

export async function therapistUpdateTask(req: Request, res: Response) {
  const task = await blindspotService.getTaskById(req.params.taskId);
  if (!task || task.caseId !== req.params.id) return err(res, 'Tarea no encontrada.', 404);
  const updated = await blindspotService.updateTaskStatus(req.params.taskId, req.body as BlindspotTaskUpdateInput);
  return ok(res, { task: updated });
}

export async function therapistCreateSession(req: Request, res: Response) {
  const log = await blindspotService.createSessionLog(req.params.id, req.user!.id, req.body as BlindspotSessionLogInput);
  return ok(res, { sessionLog: log }, 201);
}

export async function therapistRaiseCrisis(req: Request, res: Response) {
  await blindspotService.raiseCrisis(req.params.id, 'terapeuta');
  return ok(res, { message: 'Alerta de crisis levantada.' });
}

// ==== CLIENTE ====

export async function clientGetMyCase(req: Request, res: Response) {
  const blindspotCase = await blindspotService.getCaseByClientId(req.user!.id);
  if (!blindspotCase) return ok(res, { case: null, tasks: [], sessionLogs: [] });

  const [tasks, sessionLogsRaw, therapist] = await Promise.all([
    blindspotService.listTasksByCaseId(blindspotCase.id),
    blindspotService.listSessionLogsByCaseId(blindspotCase.id),
    blindspotCase.therapistId ? therapistsService.findTherapistById(blindspotCase.therapistId) : Promise.resolve(null),
  ]);

  // El cliente nunca ve internalSummary ni adminPrivateNotes — solo status,
  // tareas y la nota corta que el terapeuta decidió compartirle.
  const sessionLogs = sessionLogsRaw.map((log) => ({
    id: log.id,
    sessionDate: log.sessionDate,
    progressMarker: log.progressMarker,
    clientNote: log.clientNote,
  }));

  return ok(res, {
    case: { id: blindspotCase.id, caseNumber: blindspotCase.caseNumber, status: blindspotCase.status, therapistName: therapist?.name ?? null },
    tasks,
    sessionLogs,
  });
}

export async function clientUpdateMyTask(req: Request, res: Response) {
  const blindspotCase = await blindspotService.getCaseByClientId(req.user!.id);
  if (!blindspotCase) return err(res, 'No tienes un caso activo.', 404);
  const task = await blindspotService.getTaskById(req.params.taskId);
  if (!task || task.caseId !== blindspotCase.id) return err(res, 'Tarea no encontrada.', 404);
  // El cliente solo puede marcar sus propias tareas como completadas, no reabrirlas ni omitirlas.
  const updated = await blindspotService.updateTaskStatus(req.params.taskId, { status: 'completada' });
  return ok(res, { task: updated });
}

export async function clientRequestHelp(req: Request, res: Response) {
  const blindspotCase = await blindspotService.getCaseByClientId(req.user!.id);
  if (!blindspotCase) return err(res, 'No tienes un caso activo.', 404);
  await blindspotService.raiseCrisis(blindspotCase.id, 'cliente');
  return ok(res, { message: 'Hemos avisado a Alejandro. Te contactará lo antes posible.' });
}
