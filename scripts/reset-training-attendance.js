// Borra las asistencias (training_completions) y el protector de racha
// (training_protector_uses) de un cliente, identificado por email.
//
// Uso:
//   node scripts/reset-training-attendance.js
//   node scripts/reset-training-attendance.js otro-cliente@ejemplo.com
//
// Sin argumento, usa el cliente de pruebas por defecto (Om Smart Lab).

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_EMAIL = 'omsmartlabserviceclient@gmail.com';
const email = (process.argv[2] || DEFAULT_EMAIL).toLowerCase().trim();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: clients, error: clientErr } = await supabase.from('clients').select('id,name,email').eq('email', email);
  if (clientErr) { console.error('Error buscando el cliente:', clientErr.message); process.exit(1); }
  if (!clients.length) { console.error(`No existe ningún cliente con el email ${email}`); process.exit(1); }

  const client = clients[0];
  console.log(`Cliente: ${client.name} (${client.email})`);

  const { data: completions } = await supabase.from('training_completions').select('*').eq('client_id', client.id);
  const { data: protectorUses } = await supabase.from('training_protector_uses').select('*').eq('client_id', client.id);

  console.log(`Asistencias a borrar: ${completions.length}`);
  console.log(`Usos de protector a borrar: ${protectorUses.length}`);

  if (!completions.length && !protectorUses.length) {
    console.log('Nada que borrar — ya está en cero.');
    return;
  }

  const { error: e1 } = await supabase.from('training_completions').delete().eq('client_id', client.id);
  if (e1) { console.error('Error borrando asistencias:', e1.message); process.exit(1); }

  const { error: e2 } = await supabase.from('training_protector_uses').delete().eq('client_id', client.id);
  if (e2) { console.error('Error borrando protector:', e2.message); process.exit(1); }

  console.log('Listo — racha, asistencias y protector reseteados a cero.');
})();
