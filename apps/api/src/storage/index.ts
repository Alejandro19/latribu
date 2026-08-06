import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function requireSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL no está configurada. Es necesaria para subir archivos a Supabase Storage.'
    );
  }
  return url;
}

function requireSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada. Es necesaria para subir archivos a Supabase Storage.'
    );
  }
  return key;
}

const BUCKET = process.env.SUPABASE_BUCKET || 'latribu-files';

const storageClient = createClient(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
  auth: { persistSession: false },
});

export async function uploadFile(
  pathPrefix: string,
  buffer: Buffer,
  contentType: string,
  originalName: string
): Promise<string> {
  const filename = `${pathPrefix}/${randomUUID()}_${originalName}`;
  const { error } = await storageClient.storage.from(BUCKET).upload(filename, buffer, { contentType });
  if (error) throw error;
  const { data } = storageClient.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteFile(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  try {
    await storageClient.storage.from(BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup — mismo comportamiento no-fatal que el legacy
    // (server.js:36-42): un archivo huérfano no debe romper la operación
    // principal (guardar/eliminar la herramienta).
  }
}
