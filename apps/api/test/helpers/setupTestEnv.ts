import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnvPath = path.join(__dirname, '../../.env.test');
const prodEnvPath = path.join(__dirname, '../../.env');

if (!fs.existsSync(testEnvPath)) {
  throw new Error(
    'Falta apps/api/.env.test — copia .env.test.example a .env.test y ' +
    'complétalo con la connection string de un proyecto de Supabase DEDICADO ' +
    'A PRUEBAS antes de correr los tests.'
  );
}

const testEnv = dotenv.parse(fs.readFileSync(testEnvPath));

if (!testEnv.TEST_DATABASE_URL || !testEnv.JWT_SECRET) {
  throw new Error('.env.test debe definir TEST_DATABASE_URL y JWT_SECRET.');
}
if (!testEnv.SUPABASE_URL || !testEnv.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('.env.test debe definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (para subir archivos de prueba a Supabase Storage).');
}

let prodEnv: Record<string, string> = {};
if (fs.existsSync(prodEnvPath)) {
  prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));
}

if (prodEnv.DATABASE_URL && testEnv.TEST_DATABASE_URL === prodEnv.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL en .env.test es igual a DATABASE_URL de .env (producción). ' +
    'Los tests NUNCA deben correr contra la base de datos real.'
  );
}

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}
process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
