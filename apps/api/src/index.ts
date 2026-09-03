import 'dotenv/config';
import { createApp } from './app.js';
import { scheduleWearableSyncCron } from './jobs/wearable-sync-cron.js';
import { scheduleCognitiveLoadCron } from './jobs/cognitive-load-cron.js';

const PORT = 3003;
const app = createApp();
scheduleWearableSyncCron();
scheduleCognitiveLoadCron();

/*app.listen(PORT, () => {
  console.log(`API escuchando en el puerto ${PORT}`);
});*/

// Fuerza a Express a escuchar en la IP universal '0.0.0.0'
app.listen(3003, '0.0.0.0', () => {
  console.log("API escuchando en el puerto 3003 (IP Universal)");
});
