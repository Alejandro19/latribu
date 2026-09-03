import { z } from 'zod';

// El `key` de un módulo nunca lo manda el cliente — el backend lo genera a
// partir del label (slug sin tildes/espacios), así no hay colisiones ni
// inconsistencias con las claves ya usadas por requirePermission().
export const ModuleCreateInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
});
export type ModuleCreateInput = z.infer<typeof ModuleCreateInputSchema>;

export type PermissionModuleDto = {
  id: string;
  key: string;
  label: string;
  note: string | null;
  sortOrder: number;
  isCustom: boolean;
};

export type ClientTypeCounts = Record<string, number> & { therapist: number };

export type ModuleAccessMatrix = Record<string, Record<string, boolean>>;
