require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';
const BUCKET = process.env.SUPABASE_BUCKET || 'latribu-files';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const app = express();
app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ------------------------------------------------------------
// Helpers de respuesta y de acceso a datos (Supabase)
// ------------------------------------------------------------

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

async function dbGet(table, filters = {}, opts = {}) {
  let q = supabase.from(table).select(opts.select || '*');
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.ascending !== false });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
async function dbGetOne(table, filters = {}) {
  const rows = await dbGet(table, filters);
  return rows && rows[0] ? rows[0] : null;
}
async function dbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}
async function dbUpdate(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}
async function dbUpsertByClient(table, clientId, patch) {
  const { data, error } = await supabase
    .from(table)
    .upsert({ client_id: clientId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Auth: JWT + roles (mismo patrón que BIO360)
// ------------------------------------------------------------

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return err(res, 'Token requerido.', 401);
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return err(res, 'Token inválido o expirado.', 401);
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return err(res, 'Acceso restringido a administradores.', 403);
  next();
}
function ownerOrAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.id === req.params.id) return next();
  return err(res, 'No tienes permiso para acceder a estos datos.', 403);
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 'Email y contraseña requeridos.');
    const emailLower = email.toLowerCase().trim();

    const [admin, client] = await Promise.all([
      dbGetOne('admins', { email: emailLower }),
      dbGetOne('clients', { email: emailLower })
    ]);

    if (admin) {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return err(res, 'Credenciales incorrectas.', 401);
      const token = jwt.sign({ id: admin.id, role: 'admin', name: admin.name, email: admin.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
    }

    if (!client) return err(res, 'Credenciales incorrectas.', 401);
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    const valid = await bcrypt.compare(password, client.password_hash);
    if (!valid) return err(res, 'Credenciales incorrectas.', 401);

    const token = jwt.sign({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions || {}
    });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al iniciar sesión.', 500);
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const admin = await dbGetOne('admins', { id: req.user.id });
      if (!admin) return err(res, 'No encontrado.', 404);
      return ok(res, { role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
    }
    const client = await dbGetOne('clients', { id: req.user.id });
    if (!client) return err(res, 'No encontrado.', 404);
    return ok(res, {
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions || {}
    });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al restaurar sesión.', 500);
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return err(res, 'Todos los campos son requeridos.');
    const emailLower = email.toLowerCase().trim();
    const existing = await Promise.all([dbGetOne('admins', { email: emailLower }), dbGetOne('clients', { email: emailLower })]);
    if (existing[0] || existing[1]) return err(res, 'Ese email ya está registrado.', 409);

    const password_hash = await bcrypt.hash(password, 10);
    const client = await dbInsert('clients', { name, email: emailLower, password_hash });
    const token = jwt.sign({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return ok(res, { token, role: 'cliente', user: { id: client.id, name: client.name, email: client.email, plan: client.plan }, permissions: client.permissions }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al registrar.', 500);
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return err(res, 'Faltan datos.');
    const table = req.user.role === 'admin' ? 'admins' : 'clients';
    const account = await dbGetOne(table, { id: req.user.id });
    if (!account) return err(res, 'No encontrado.', 404);
    const valid = await bcrypt.compare(currentPassword, account.password_hash);
    if (!valid) return err(res, 'Contraseña actual incorrecta.', 401);
    const password_hash = await bcrypt.hash(newPassword, 10);
    await dbUpdate(table, account.id, { password_hash });
    return ok(res, { message: 'Contraseña actualizada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al cambiar la contraseña.', 500);
  }
});

// ------------------------------------------------------------
// Clientes (gestión, solo admin salvo lectura propia)
// ------------------------------------------------------------

app.get('/api/clients', authMiddleware, adminOnly, async (req, res) => {
  try {
    const clients = await dbGet('clients', {}, { order: { column: 'created_at', ascending: false } });
    return ok(res, { clients });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al listar clientes.', 500);
  }
});

app.post('/api/clients', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, plan } = req.body;
    if (!name || !email || !password) return err(res, 'Nombre, email y contraseña son requeridos.');
    const emailLower = email.toLowerCase().trim();
    const existingClient = await dbGetOne('clients', { email: emailLower });
    if (existingClient) return err(res, 'Ese email ya está registrado.', 409);
    const password_hash = await bcrypt.hash(password, 10);
    const client = await dbInsert('clients', { name, email: emailLower, password_hash, plan: plan || 'Miembro' });
    return ok(res, { client }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear cliente.', 500);
  }
});

app.get('/api/clients/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const client = await dbGetOne('clients', { id: req.params.id });
    if (!client) return err(res, 'Cliente no encontrado.', 404);
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener cliente.', 500);
  }
});

app.put('/api/clients/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const patch = { ...req.body, updated_at: new Date().toISOString() };
    delete patch.password_hash;
    delete patch.id;
    const client = await dbUpdate('clients', req.params.id, patch);
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar cliente.', 500);
  }
});

app.delete('/api/clients/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('clients', req.params.id);
    return ok(res, { message: 'Cliente eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar cliente.', 500);
  }
});

app.patch('/api/clients/:id/permissions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const client = await dbUpdate('clients', req.params.id, { permissions: req.body.permissions, updated_at: new Date().toISOString() });
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar permisos.', 500);
  }
});

app.patch('/api/clients/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const client = await dbUpdate('clients', req.params.id, { status: req.body.status, updated_at: new Date().toISOString() });
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar estado.', 500);
  }
});

// ------------------------------------------------------------
// Información Personal (módulos 1-9, sin módulo 10)
// ------------------------------------------------------------

app.get('/api/clients/:id/personal-info', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const info = await dbGetOne('personal_info', { client_id: req.params.id });
    return ok(res, { personalInfo: info || {} });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener información personal.', 500);
  }
});

// Guarda el formulario completo de onboarding (módulos 1-9).
// Campos estructurados del módulo 1 y datos base del módulo 3 se
// guardan en columnas propias; el resto va en onboarding_report (JSONB).
app.put('/api/clients/:id/personal-info', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const structured = {
      birthdate: body.birthdate,
      gender: body.gender,
      occupation: body.occupation,
      country: body.country,
      city: body.city,
      phone_code: body.phone_code,
      phone_number: body.phone_number,
      marital_status: body.marital_status,
      weight: body.weight,
      height: body.height,
      body_fat: body.body_fat,
      onboarding_report: body.onboarding_report || {},
      completed_at: body.complete ? new Date().toISOString() : undefined
    };
    Object.keys(structured).forEach((k) => structured[k] === undefined && delete structured[k]);
    const info = await dbUpsertByClient('personal_info', req.params.id, structured);
    return ok(res, { personalInfo: info });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar información personal.', 500);
  }
});

// ------------------------------------------------------------
// Composición corporal: medidas antropométricas + fotos
// ------------------------------------------------------------

app.get('/api/clients/:id/anthropometrics', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const records = await dbGet('anthropometric_records', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } });
    return ok(res, { records });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener medidas.', 500);
  }
});

app.post('/api/clients/:id/anthropometrics', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { fecha, semana, peso, cintura, brazos, hombros, piernas, gluteo, notas } = req.body;
    const record = await dbInsert('anthropometric_records', {
      client_id: req.params.id, fecha, semana, peso, cintura, brazos, hombros, piernas, gluteo, notas
    });
    return ok(res, { record }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar medidas.', 500);
  }
});

app.delete('/api/clients/:id/anthropometrics/:recordId', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    await dbDelete('anthropometric_records', req.params.recordId);
    return ok(res, { message: 'Registro eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar registro.', 500);
  }
});

app.post('/api/clients/:id/photos', authMiddleware, ownerOrAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ninguna foto.');
    const { angle, anthropometric_record_id, fecha } = req.body;
    const filename = `${req.params.id}/photos/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const photo = await dbInsert('progress_photos', {
      client_id: req.params.id,
      anthropometric_record_id: anthropometric_record_id || null,
      angle: angle || 'frente',
      photo_url: pub.publicUrl,
      fecha: fecha || new Date().toISOString().slice(0, 10)
    });
    return ok(res, { photo }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir la foto.', 500);
  }
});

app.get('/api/clients/:id/photos', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const photos = await dbGet('progress_photos', { client_id: req.params.id }, { order: { column: 'fecha', ascending: false } });
    return ok(res, { photos });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener fotos.', 500);
  }
});

// ------------------------------------------------------------
// Entrenamiento
// ------------------------------------------------------------

app.get('/api/clients/:id/exercises', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const exercises = await dbGet('exercises', { client_id: req.params.id }, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { exercises });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener ejercicios.', 500);
  }
});

app.post('/api/clients/:id/exercises', authMiddleware, adminOnly, async (req, res) => {
  try {
    const exercise = await dbInsert('exercises', { client_id: req.params.id, ...req.body });
    return ok(res, { exercise }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear ejercicio.', 500);
  }
});

app.put('/api/clients/:id/exercises/:exId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const exercise = await dbUpdate('exercises', req.params.exId, { ...req.body, updated_at: new Date().toISOString() });
    return ok(res, { exercise });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar ejercicio.', 500);
  }
});

app.delete('/api/clients/:id/exercises/:exId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('exercises', req.params.exId);
    return ok(res, { message: 'Ejercicio eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar ejercicio.', 500);
  }
});

app.post('/api/clients/:id/exercises/:exId/upload-video', authMiddleware, adminOnly, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún video.');
    const filename = `${req.params.id}/exercises/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const exercise = await dbUpdate('exercises', req.params.exId, { video_url: pub.publicUrl, video_name: req.file.originalname });
    return ok(res, { exercise });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el video.', 500);
  }
});

// ------------------------------------------------------------
// Nutrición (formato estándar; admin carga plan/protocolos)
// ------------------------------------------------------------

app.get('/api/clients/:id/nutrition', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const [plan, meals] = await Promise.all([
      dbGetOne('nutrition_plans', { client_id: req.params.id }),
      dbGet('meals', { client_id: req.params.id }, { order: { column: 'sort_order', ascending: true } })
    ]);
    return ok(res, { plan: plan || {}, meals });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener plan de nutrición.', 500);
  }
});

app.put('/api/clients/:id/nutrition', authMiddleware, adminOnly, async (req, res) => {
  try {
    const plan = await dbUpsertByClient('nutrition_plans', req.params.id, req.body);
    return ok(res, { plan });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar plan de nutrición.', 500);
  }
});

app.post('/api/clients/:id/meals', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meal = await dbInsert('meals', { client_id: req.params.id, ...req.body });
    return ok(res, { meal }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear comida.', 500);
  }
});

app.put('/api/clients/:id/meals/:mealId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meal = await dbUpdate('meals', req.params.mealId, req.body);
    return ok(res, { meal });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar comida.', 500);
  }
});

app.delete('/api/clients/:id/meals/:mealId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('meals', req.params.mealId);
    return ok(res, { message: 'Comida eliminada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar comida.', 500);
  }
});

// ------------------------------------------------------------
// Suplementación (Neuro Stacking en BIO360; admin asigna suplementos)
// ------------------------------------------------------------

app.get('/api/clients/:id/supplements', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const supplements = await dbGet('supplements', { client_id: req.params.id }, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { supplements });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener suplementos.', 500);
  }
});

app.post('/api/clients/:id/supplements', authMiddleware, adminOnly, async (req, res) => {
  try {
    const existing = await dbGet('supplements', { client_id: req.params.id, name: req.body.name });
    if (existing.length) return err(res, 'Ya existe un suplemento con ese nombre para este cliente.', 409);
    const supplement = await dbInsert('supplements', { client_id: req.params.id, ...req.body });
    return ok(res, { supplement }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al asignar suplemento.', 500);
  }
});

app.put('/api/clients/:id/supplements/:suppId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const supplement = await dbUpdate('supplements', req.params.suppId, { ...req.body, updated_at: new Date().toISOString() });
    return ok(res, { supplement });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar suplemento.', 500);
  }
});

app.delete('/api/clients/:id/supplements/:suppId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('supplements', req.params.suppId);
    return ok(res, { message: 'Suplemento eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar suplemento.', 500);
  }
});

// ------------------------------------------------------------
// Gestión de Cortisol (admin asigna técnicas)
// ------------------------------------------------------------

app.get('/api/clients/:id/cortisol-techniques', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const techniques = await dbGet('cortisol_techniques', { client_id: req.params.id }, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { techniques });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener técnicas.', 500);
  }
});

app.post('/api/clients/:id/cortisol-techniques', authMiddleware, adminOnly, async (req, res) => {
  try {
    const technique = await dbInsert('cortisol_techniques', { client_id: req.params.id, ...req.body });
    return ok(res, { technique }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al asignar técnica.', 500);
  }
});

app.put('/api/clients/:id/cortisol-techniques/:techId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const technique = await dbUpdate('cortisol_techniques', req.params.techId, req.body);
    return ok(res, { technique });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar técnica.', 500);
  }
});

app.delete('/api/clients/:id/cortisol-techniques/:techId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('cortisol_techniques', req.params.techId);
    return ok(res, { message: 'Técnica eliminada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar técnica.', 500);
  }
});

app.post('/api/clients/:id/cortisol-techniques/:techId/upload', authMiddleware, adminOnly, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún video.');
    const filename = `${req.params.id}/cortisol/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const technique = await dbUpdate('cortisol_techniques', req.params.techId, { video_url: pub.publicUrl, video_name: req.file.originalname });
    return ok(res, { technique });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el video.', 500);
  }
});

// ------------------------------------------------------------
// Comunidad: Eventos
// ------------------------------------------------------------

app.get('/api/community/events', authMiddleware, async (req, res) => {
  try {
    const events = await dbGet('community_events', { active: true }, { order: { column: 'event_date', ascending: true } });
    return ok(res, { events });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener eventos.', 500);
  }
});

app.post('/api/community/events', authMiddleware, adminOnly, async (req, res) => {
  try {
    const event = await dbInsert('community_events', req.body);
    return ok(res, { event }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear evento.', 500);
  }
});

app.put('/api/community/events/:eventId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const event = await dbUpdate('community_events', req.params.eventId, req.body);
    return ok(res, { event });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar evento.', 500);
  }
});

app.delete('/api/community/events/:eventId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('community_events', req.params.eventId);
    return ok(res, { message: 'Evento eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar evento.', 500);
  }
});

app.post('/api/community/events/:eventId/reserve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
    const existing = await dbGetOne('event_reservations', { event_id: req.params.eventId, client_id: req.user.id });
    if (existing) return err(res, 'Ya tienes una reserva para este evento.', 409);
    const reservation = await dbInsert('event_reservations', { event_id: req.params.eventId, client_id: req.user.id });
    return ok(res, { reservation }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al reservar evento.', 500);
  }
});

app.delete('/api/community/events/:eventId/reserve', authMiddleware, async (req, res) => {
  try {
    const reservation = await dbGetOne('event_reservations', { event_id: req.params.eventId, client_id: req.user.id });
    if (!reservation) return err(res, 'No tienes una reserva para este evento.', 404);
    await dbUpdate('event_reservations', reservation.id, { status: 'cancelada' });
    return ok(res, { message: 'Reserva cancelada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al cancelar reserva.', 500);
  }
});

app.get('/api/clients/:id/event-reservations', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const reservations = await dbGet('event_reservations', { client_id: req.params.id });
    return ok(res, { reservations });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener reservas.', 500);
  }
});

// ------------------------------------------------------------
// Comunidad: Terapias
// ------------------------------------------------------------

app.get('/api/community/therapies', authMiddleware, async (req, res) => {
  try {
    const therapies = await dbGet('community_therapies', { active: true }, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { therapies });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener terapias.', 500);
  }
});

app.post('/api/community/therapies', authMiddleware, adminOnly, async (req, res) => {
  try {
    const therapy = await dbInsert('community_therapies', req.body);
    return ok(res, { therapy }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear terapia.', 500);
  }
});

app.put('/api/community/therapies/:therapyId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const therapy = await dbUpdate('community_therapies', req.params.therapyId, req.body);
    return ok(res, { therapy });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar terapia.', 500);
  }
});

app.delete('/api/community/therapies/:therapyId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('community_therapies', req.params.therapyId);
    return ok(res, { message: 'Terapia eliminada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar terapia.', 500);
  }
});

app.post('/api/community/therapies/:therapyId/reserve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
    const existing = await dbGetOne('therapy_reservations', { therapy_id: req.params.therapyId, client_id: req.user.id });
    if (existing) return err(res, 'Ya tienes una reserva para esta terapia.', 409);
    const reservation = await dbInsert('therapy_reservations', { therapy_id: req.params.therapyId, client_id: req.user.id });
    return ok(res, { reservation }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al reservar terapia.', 500);
  }
});

app.get('/api/clients/:id/therapy-reservations', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const reservations = await dbGet('therapy_reservations', { client_id: req.params.id });
    return ok(res, { reservations });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener reservas.', 500);
  }
});

// ------------------------------------------------------------
// Mi Evolución: KPIs de progreso
// ------------------------------------------------------------

app.get('/api/clients/:id/evolution', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const [checkins, anthropometrics, inbody] = await Promise.all([
      dbGet('evolution_checkins', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } }),
      dbGet('anthropometric_records', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } }),
      dbGet('bio_inbody_records', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } })
    ]);
    return ok(res, { checkins, anthropometrics, inbody });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener evolución.', 500);
  }
});

app.post('/api/clients/:id/evolution', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { fecha, strength_score, mood_score, confidence_score, security_score, energy_score, notes } = req.body;
    const checkin = await dbInsert('evolution_checkins', {
      client_id: req.params.id, fecha, strength_score, mood_score, confidence_score, security_score, energy_score, notes
    });
    return ok(res, { checkin }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar check-in de evolución.', 500);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`La Tribu — servidor escuchando en el puerto ${PORT}`);
});
