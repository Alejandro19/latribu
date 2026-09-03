import { getSessionToken } from './api-client';
import type { PermissionModuleDto, ClientTypeCounts, ModuleAccessMatrix } from '@latribu/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function getMatrix(): Promise<{ modules: PermissionModuleDto[]; matrix: ModuleAccessMatrix }> {
  const body = await authorizedRequest<{ success: boolean; modules: PermissionModuleDto[]; matrix: ModuleAccessMatrix; error?: string }>(
    '/api/admin/roles/matrix',
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la matriz de permisos.');
  return { modules: body.modules, matrix: body.matrix };
}

export async function saveMatrixColumn(clientType: string, permissions: Record<string, boolean>): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(
    `/api/admin/roles/matrix/${clientType}`,
    'PUT',
    { permissions }
  );
  if (!body.success) throw new Error(body.error || 'Error al guardar los cambios.');
}

export async function deleteModule(key: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(
    `/api/admin/roles/modules/${key}`,
    'DELETE'
  );
  if (!body.success) throw new Error(body.error || 'Error al borrar el módulo.');
}

export async function getCounts(): Promise<ClientTypeCounts> {
  const body = await authorizedRequest<{ success: boolean; counts: ClientTypeCounts; error?: string }>(
    '/api/admin/roles/counts',
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener los conteos.');
  return body.counts;
}
