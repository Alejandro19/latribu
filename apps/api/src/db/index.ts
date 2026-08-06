import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../models/schema.js';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL no está configurada. Define esta variable de entorno antes ' +
      'de arrancar el servidor — nunca debe operar sin una conexión explícita.'
    );
  }
  return url;
}

const queryClient = postgres(requireDatabaseUrl(), {
  max: 10,
  types: {
    numeric: {
      to: 1700,
      from: [1700],
      serialize: (value: number) => String(value),
      parse: (value: string) => Number.parseFloat(value),
    },
  },
});
export const db = drizzle(queryClient, { schema });
