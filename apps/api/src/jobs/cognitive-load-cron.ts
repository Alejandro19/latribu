import cron from 'node-cron';
import { runCognitiveLoadNightlyJob } from '../services/cognitive-load.service.js';

// Corre después del sweep de wearables (03:00) para que el dato del día ya
// esté sincronizado — spec: "ejecutar como job diario, no en tiempo real
// por carga de página".
export function scheduleCognitiveLoadCron(): void {
  cron.schedule('30 3 * * *', () => {
    runCognitiveLoadNightlyJob().catch((e) => console.error('cognitive-load-cron falló', e));
  });
}
