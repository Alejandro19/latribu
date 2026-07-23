require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { randomUUID: uuidv4 } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

let pdfParse;
try { pdfParse = require('pdf-parse'); } catch (e) { pdfParse = null; }

let CSC;
try { CSC = require('country-state-city'); } catch (e) { CSC = null; }

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';
const BUCKET = process.env.SUPABASE_BUCKET || 'latribu-files';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const googleOAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
// Borra el archivo anterior del storage cuando se reemplaza (ej. "Reemplazar
// audio"), para que no se acumulen copias huérfanas del mismo archivo.
async function deleteOldStorageFile(publicUrl) {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

const PRIORITY_ISO = ['CO', 'MX', 'ES', 'AR', 'CL', 'PE', 'VE', 'EC', 'US', 'BO', 'PY', 'UY', 'CR', 'GT', 'HN', 'SV', 'NI', 'PA', 'CU', 'DO'];
let _countriesCache = null;
function getCountriesCache() {
  if (_countriesCache) return _countriesCache;
  if (!CSC) return { priority: [], rest: [] };
  let displayNames;
  try { displayNames = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) {}
  const all = CSC.Country.getAllCountries().map(c => {
    let name = c.name;
    try { if (displayNames) name = displayNames.of(c.isoCode) || c.name; } catch (e) {}
    return { isoCode: c.isoCode, name, flag: c.flag || '', phonecode: c.phonecode || '' };
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  _countriesCache = {
    priority: PRIORITY_ISO.map(code => all.find(c => c.isoCode === code)).filter(Boolean),
    rest: all.filter(c => !PRIORITY_ISO.includes(c.isoCode))
  };
  return _countriesCache;
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const app = express();
// crossOriginOpenerPolicy en 'same-origin-allow-popups': el valor por defecto
// de helmet ('same-origin') bloquea la comunicación del popup de Google
// Sign-In con esta página, dejándolo en blanco sin completar el login.
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
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
async function dbGetOne(table, filters = {}, opts = {}) {
  const rows = await dbGet(table, filters, opts);
  return rows && rows[0] ? rows[0] : null;
}
function extractMissingColumnsFromSupabaseError(error) {
  if (!error || typeof error.message !== 'string') return [];
  const message = error.message;
  const columns = [];
  let match;

  const regexStandard = /column\s+"?([^\s\.\"]+)"?\s+does not exist/gi;
  while ((match = regexStandard.exec(message)) !== null) {
    columns.push(match[1]);
  }

  const regexSchemaCache = /Could not find the '([^']+)' column of '[^']+' in the schema cache/gi;
  while ((match = regexSchemaCache.exec(message)) !== null) {
    columns.push(match[1]);
  }

  const regexSchemaCacheNoQuotes = /Could not find the '([^']+)' column of [^ ]+ in the schema cache/gi;
  while ((match = regexSchemaCacheNoQuotes.exec(message)) !== null) {
    columns.push(match[1]);
  }

  return Array.from(new Set(columns));
}

async function dbInsert(table, row) {
  let insertRow = sanitizeInsertRow(row);

  while (true) {
    const { data, error } = await supabase.from(table).insert(insertRow).select().single();
    if (!error) return data;

    const missingColumns = extractMissingColumnsFromSupabaseError(error);
    if (!missingColumns.length) throw error;

    const nextRow = { ...insertRow };
    missingColumns.forEach((col) => {
      if (col in nextRow) {
        delete nextRow[col];
      }
    });
    if (Object.keys(nextRow).length === 0) throw error;
    if (Object.keys(nextRow).length === Object.keys(insertRow).length) throw error;

    console.warn(`dbInsert: retrying insert into ${table} without unknown columns: ${missingColumns.join(', ')}`);
    insertRow = nextRow;
  }
}
function sanitizeInsertRow(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && value !== ''));
}
function formatSupabaseError(e) {
  if (!e) return 'Error interno';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  if (e.error) return e.error;
  if (e.details) return String(e.details);
  try { return JSON.stringify(e); } catch (_){ return 'Error interno'; }
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

const MODULE_LABELS = { training: 'entrenamiento', nutrition: 'nutrición', supplementation: 'suplementación', cortisol: 'gestión de cortisol' };
async function unlockModule(clientId, moduleKey) {
  const client = await dbGetOne('clients', { id: clientId });
  if (!client) return;
  if (client.permissions && client.permissions[moduleKey] === true) return;
  const permissions = { ...(client.permissions || {}), [moduleKey]: true };
  await dbUpdate('clients', clientId, { permissions });
  const label = MODULE_LABELS[moduleKey];
  if (label) {
    try { await dbInsert('client_notifications', { client_id: clientId, message: `Ahora tienes acceso a tu módulo de ${label}.` }); }
    catch (e) { console.error(e); }
  }
}

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.NOTIFICATION_FROM || 'no-reply@latribu.com';
const EMAIL_TO = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_TO || 'g619alejandro@gmail.com';

async function sendClientNotification(clientId, info) {
  const subject = `La Tribu: onboarding completado cliente ${clientId}`;
  const summary = [`<strong>ID:</strong> ${clientId}`];
  if (info.country) summary.push(`<strong>País:</strong> ${info.country}`);
  if (info.city) summary.push(`<strong>Ciudad:</strong> ${info.city}`);
  if (info.weight) summary.push(`<strong>Peso:</strong> ${info.weight}`);
  if (info.height) summary.push(`<strong>Altura:</strong> ${info.height}`);
  const html = `<p>El cliente ha completado el proceso de onboarding personal.</p><p>${summary.join('<br>')}</p>`;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.log('sendClientNotification: email config no disponible, se omite el envío.', { clientId, info });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT),
      secure: EMAIL_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      }
    });
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      html,
    });
  } catch (e) {
    console.error('Error enviando notificación de cliente:', e);
  }
}

// ------------------------------------------------------------
// Auth: JWT + roles (mismo patrón que BIO360)
// ------------------------------------------------------------

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return err(res, 'Token requerido.', 401);
  let payload;
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET);
  } catch (e) {
    return err(res, 'Token inválido o expirado.', 401);
  }
  if (payload.role === 'cliente') {
    try {
      const client = await dbGetOne('clients', { id: payload.id }, { select: 'id,status,client_type,permissions,plan_end_date' });
      if (!client || client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
      req.client = client;
      req.planExpired = isPlanExpired(client);
    } catch (e) {
      console.error(e);
      return err(res, 'Error al verificar la sesión.', 500);
    }
  }
  req.user = payload;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return err(res, 'Acceso restringido a administradores.', 403);
  next();
}
function isPlanExpired(client) {
  if (!client) return false;
  if (!['coaching_1_1', 'coaching_online'].includes(client.client_type)) return false;
  if (!client.plan_end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > client.plan_end_date;
}
function ownerOrAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.id === req.params.id) {
    if (req.planExpired) return err(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
    return next();
  }
  return err(res, 'No tienes permiso para acceder a estos datos.', 403);
}
const LEAD_BLOCKED_MODULES = ['training', 'nutrition', 'supplementation'];
function requirePermission(moduleKey) {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();
    if (LEAD_BLOCKED_MODULES.includes(moduleKey) && req.client && req.client.client_type === 'lead_wellness') {
      return err(res, 'Este módulo no está disponible para tu tipo de cuenta.', 403);
    }
    const permissions = req.client && req.client.permissions;
    if (permissions && permissions[moduleKey] === false) {
      return err(res, 'No tienes acceso a este módulo.', 403);
    }
    next();
  };
}

// Información Personal (el onboarding de 9 módulos, incluida la composición
// corporal) requiere ser cliente de coaching — lead_wellness no tiene acceso.
function blockForLeadWellness(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.client && req.client.client_type === 'lead_wellness') {
    return err(res, 'Este módulo no está disponible para tu tipo de cuenta.', 403);
  }
  next();
}

async function requireOnboardingComplete(req, res, next) {
  if (req.user.role === 'admin') return next();
  // lead_wellness sí puede hacer su check-in del día en Mi Evolución (el
  // front le oculta el historial/gráficas, pero el registro básico es
  // autoservicio, igual que Cortisol/Descanso) — no se le exige onboarding
  // completo ni se le bloquea aquí.
  if (req.client && req.client.client_type === 'lead_wellness') return next();
  try {
    const info = await dbGetOne('personal_info', { client_id: req.user.id });
    if (!info || !info.completed_at) {
      return err(res, 'Completa tu información personal para acceder a este módulo.', 403);
    }
    next();
  } catch (e) {
    console.error(e);
    return err(res, 'Error al verificar tu información personal.', 500);
  }
}

// Eventos es funnel de conversión — abierto para los 3 tipos de cliente sin
// ninguna condición (ni plan vencido, ni onboarding, ni permissions).
function requireEventsAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (!req.client) return err(res, 'No tienes permiso para acceder a estos datos.', 403);
  next();
}

// Reservar/gestionar Terapias: bloqueado únicamente para lead_wellness — la
// diferencia entre coaching_1_1 y coaching_online no aplica aquí, ambos ven
// y reservan exactamente igual. Ver la lista (GET) es más abierto — usa
// `requireEventsAccess` en su lugar para que un lead pueda ver una vista
// previa real (desenfocada) de los aliados, no una inventada.
async function requireCommunityAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.client && req.client.client_type === 'lead_wellness') {
    return err(res, 'No tienes acceso a este módulo.', 403);
  }
  if (req.planExpired) return err(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
  return requireOnboardingComplete(req, res, next);
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
    const info = await dbGetOne('personal_info', { client_id: client.id });
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions || {},
      clientType: client.client_type || null,
      planExpired: isPlanExpired(client),
      planEndDate: client.plan_end_date || null,
      onboardingComplete: !!(info && info.completed_at)
    });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al iniciar sesión.', 500);
  }
});

app.get('/api/config', (req, res) => {
  return ok(res, { googleClientId: GOOGLE_CLIENT_ID });
});

// Login/registro con Google. El frontend manda el ID token que entrega
// Google Identity Services; aquí se verifica contra Google y el email
// verificado es lo único que se usa para emparejar con una cuenta existente
// (admin o cliente) — google_id solo queda guardado como referencia.
app.post('/api/auth/google', async (req, res) => {
  try {
    if (!googleOAuthClient) return err(res, 'Login con Google no está configurado en el servidor.', 503);
    const { credential } = req.body;
    if (!credential) return err(res, 'Falta el token de Google.', 400);

    let payload;
    try {
      const ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (e) {
      return err(res, 'Token de Google inválido.', 401);
    }
    if (!payload || !payload.email_verified) return err(res, 'Tu cuenta de Google no tiene el email verificado.', 401);

    const emailLower = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const displayName = payload.name || emailLower;

    const [admin, client] = await Promise.all([
      dbGetOne('admins', { email: emailLower }),
      dbGetOne('clients', { email: emailLower })
    ]);

    if (admin) {
      if (!admin.google_id) await dbUpdate('admins', admin.id, { google_id: googleId });
      const token = jwt.sign({ id: admin.id, role: 'admin', name: admin.name, email: admin.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
    }

    if (client) {
      if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
      if (!client.google_id) await dbUpdate('clients', client.id, { google_id: googleId });
      const token = jwt.sign({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      const info = await dbGetOne('personal_info', { client_id: client.id });
      return ok(res, {
        token,
        role: 'cliente',
        user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
        permissions: client.permissions || {},
        clientType: client.client_type || null,
        planExpired: isPlanExpired(client),
        planEndDate: client.plan_end_date || null,
        onboardingComplete: !!(info && info.completed_at)
      });
    }

    // Ninguna cuenta existente con ese email: mismo comportamiento que el
    // registro manual — se crea inactiva y queda pendiente de aprobación.
    const newClient = await dbInsert('clients', { name: displayName, email: emailLower, google_id: googleId, status: 'inactive' });
    await dbInsert('admin_notifications', {
      client_id: newClient.id,
      type: 'new_registration',
      message: `${displayName} se registró con Google en la plataforma.`
    });
    return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al iniciar sesión con Google.', 500);
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
    const info = await dbGetOne('personal_info', { client_id: client.id });
    return ok(res, {
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions || {},
      clientType: client.client_type || null,
      planExpired: isPlanExpired(client),
      planEndDate: client.plan_end_date || null,
      onboardingComplete: !!(info && info.completed_at)
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
    const newClient = await dbInsert('clients', { name, email: emailLower, password_hash, status: 'inactive' });
    await dbInsert('admin_notifications', {
      client_id: newClient.id,
      type: 'new_registration',
      message: `${name} se registró en la plataforma.`
    });
    return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
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

const CLIENT_TYPES = ['coaching_1_1', 'coaching_online', 'lead_wellness'];
app.patch('/api/clients/:id/client-type', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { client_type } = req.body;
    if (!CLIENT_TYPES.includes(client_type)) return err(res, 'Tipo de cliente inválido.', 400);
    const existing = await dbGetOne('clients', { id: req.params.id });
    if (!existing) return err(res, 'Cliente no encontrado.', 404);
    const patch = { client_type, updated_at: new Date().toISOString() };
    if (client_type === 'lead_wellness') {
      patch.permissions = { ...(existing.permissions || {}), cortisol: true, community: true };
    }
    const client = await dbUpdate('clients', req.params.id, patch);
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al clasificar cliente.', 500);
  }
});

app.patch('/api/clients/:id/renew-plan', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { plan_start_date, plan_end_date } = req.body;
    let patch;
    if (plan_start_date && plan_end_date) {
      if (plan_end_date <= plan_start_date) return err(res, 'La fecha de vencimiento debe ser posterior a la de inicio.', 400);
      const days = Math.round((new Date(plan_end_date) - new Date(plan_start_date)) / 86400000);
      patch = { plan_duration_days: days, plan_start_date, plan_end_date, updated_at: new Date().toISOString() };
    } else {
      const duration = parseInt(req.body.duration_days, 10);
      if (![30, 90].includes(duration)) return err(res, 'Duración de plan inválida. Usa 30 o 90 días.', 400);
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + duration);
      patch = {
        plan_duration_days: duration,
        plan_start_date: today.toISOString().slice(0, 10),
        plan_end_date: endDate.toISOString().slice(0, 10),
        updated_at: new Date().toISOString()
      };
    }
    const client = await dbUpdate('clients', req.params.id, patch);
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al renovar el plan.', 500);
  }
});

// ------------------------------------------------------------
// Información Personal (módulos 1-9, sin módulo 10)
// ------------------------------------------------------------

app.get('/api/clients/:id/personal-info', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
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
app.put('/api/clients/:id/personal-info', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const body = req.body || {};
    const existing = await dbGetOne('personal_info', { client_id: req.params.id });
    const wasAlreadyComplete = !!(existing && existing.completed_at);
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
    if (body.complete) {
      await sendClientNotification(req.params.id, info);
      if (!wasAlreadyComplete) {
        const client = await dbGetOne('clients', { id: req.params.id });
        await dbInsert('admin_notifications', {
          client_id: req.params.id,
          type: 'onboarding_complete',
          message: `${client ? client.name : 'Un cliente'} completó su información personal.`
        });
      }
    }
    return ok(res, { personalInfo: info });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar información personal.', 500);
  }
});

app.post('/api/clients/:id/personal-info-file', authMiddleware, ownerOrAdmin, blockForLeadWellness, upload.single('checkup_file'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún archivo.');
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(req.file.mimetype)) return err(res, 'Formato inválido. Usa PDF o JPG/PNG.', 400);
    const filename = `${req.params.id}/checkups/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const file_url = pub.publicUrl;
    let report = req.body.onboarding_report || {};
    if (typeof report === 'string') {
      try { report = JSON.parse(report); } catch (_e) { report = {}; }
    }
    const payload = {
      onboarding_report: { ...report, checkup_file_url: file_url, checkup_file_name: req.file.originalname, checkup_uploaded_at: new Date().toISOString() }
    };
    await dbUpsertByClient('personal_info', req.params.id, payload);
    return ok(res, { file_url, file_name: req.file.originalname, uploaded_at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el archivo de chequeo.', 500);
  }
});

// ------------------------------------------------------------
// Composición corporal: medidas antropométricas + fotos
// ------------------------------------------------------------

app.get('/api/clients/:id/anthropometrics', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const records = await dbGet('anthropometric_records', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } });
    return ok(res, { records });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener medidas.', 500);
  }
});

app.post('/api/clients/:id/anthropometrics', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const { fecha, semana, peso, cintura, brazos, hombros, piernas, gluteo, notas, mes_num } = req.body;
    const month = Number.isFinite(+mes_num) && +mes_num > 0 ? parseInt(mes_num, 10) : undefined;
    const payload = sanitizeInsertRow({
      client_id: req.params.id,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      semana, mes_num: month, peso, cintura, brazos, hombros, piernas, gluteo, notas
    });
    let record;
    if (month !== undefined) {
      const existing = await dbGetOne('anthropometric_records', { client_id: req.params.id, mes_num: month });
      if (existing) {
        record = await dbUpdate('anthropometric_records', existing.id, payload);
        return ok(res, { record }, 200);
      }
    }
    record = await dbInsert('anthropometric_records', payload);
    return ok(res, { record }, 201);
  } catch (e) {
    console.error('Anthropometric insert error:', e);
    return err(res, 'Error al guardar medidas: ' + (e.message || 'Error interno'), 500);
  }
});

app.delete('/api/clients/:id/anthropometrics/:recordId', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    await dbDelete('anthropometric_records', req.params.recordId);
    return ok(res, { message: 'Registro eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar registro.', 500);
  }
});

app.post('/api/clients/:id/photos', authMiddleware, ownerOrAdmin, blockForLeadWellness, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ninguna foto.');
    const { angle, anthropometric_record_id, fecha, mes_num } = req.body;
    const month = Number.isFinite(+mes_num) && +mes_num > 0 ? parseInt(mes_num, 10) : undefined;
    const filename = `${req.params.id}/photos/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const photo = await dbInsert('progress_photos', sanitizeInsertRow({
      client_id: req.params.id,
      anthropometric_record_id: anthropometric_record_id || null,
      angle: angle || 'frente',
      photo_url: pub.publicUrl,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      mes_num: month
    }));
    return ok(res, { photo }, 201);
  } catch (e) {
    console.error('Photo upload error:', e);
    return err(res, 'Error al subir la foto: ' + (e.message || 'Error interno'), 500);
  }
});

app.get('/api/clients/:id/photos', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const photos = await dbGet('progress_photos', { client_id: req.params.id }, { order: { column: 'fecha', ascending: false } });
    return ok(res, { photos });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener fotos.', 500);
  }
});

// Registro InBody: se guarda tras el parseo automático del PDF/imagen
// subido en el módulo 3 (Composición Corporal, dentro de Información Personal).
app.get('/api/clients/:id/inbody-records', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const records = await dbGet('bio_inbody_records', { client_id: req.params.id }, { order: { column: 'fecha', ascending: true } });
    return ok(res, { records });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener registros InBody.', 500);
  }
});

app.post('/api/clients/:id/inbody-records', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  try {
    const { fecha, version, peso_total, smm, grasa_pct, imc, peso_objetivo, grasa_visceral, bmr, angulo_fase, ecw_tbw, masa_osea, altura, mes_num, file_url, file_name } = req.body;
    const month = Number.isFinite(+mes_num) && +mes_num > 0 ? parseInt(mes_num, 10) : undefined;
    const row = sanitizeInsertRow({
      client_id: req.params.id,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      version,
      peso_total, smm, grasa_pct, imc, peso_objetivo, grasa_visceral, bmr, angulo_fase, ecw_tbw, masa_osea, altura,
      mes_num: month,
      file_url, file_name
    });

    try {
      const record = await dbInsert('bio_inbody_records', row);
      return ok(res, { record }, 201);
    } catch (e) {
      const errorMessage = formatSupabaseError(e);
      console.error('InBody insert failed', { requestBody: req.body, row, error: errorMessage });
      return err(res, 'Error al guardar registro InBody: ' + errorMessage, 500);
    }
  } catch (e) {
    console.error('InBody handler error:', e, { requestBody: req.body });
    return err(res, 'Error al guardar registro InBody: ' + formatSupabaseError(e), 500);
  }
});

app.post('/api/clients/:id/inbody-upload', authMiddleware, ownerOrAdmin, blockForLeadWellness, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún archivo.');
    const filename = `${req.params.id}/inbody/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return ok(res, { file_url: pub.publicUrl, file_name: req.file.originalname });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el archivo InBody.', 500);
  }
});

// ------------------------------------------------------------
// Entrenamiento
// ------------------------------------------------------------

app.patch('/api/clients/:id/training-days', authMiddleware, adminOnly, async (req, res) => {
  try {
    const days = parseInt(req.body.training_days, 10);
    if (![1,2,3,4,5,6,7].includes(days)) return err(res, 'Días de entrenamiento inválidos (1-7).', 400);
    const client = await dbUpdate('clients', req.params.id, { training_days: days, updated_at: new Date().toISOString() });
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar días de entrenamiento.', 500);
  }
});

app.patch('/api/clients/:id/assigned-quote', authMiddleware, adminOnly, async (req, res) => {
  try {
    const client = await dbUpdate('clients', req.params.id, { assigned_quote_id: req.body.quote_id || null, updated_at: new Date().toISOString() });
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al asignar la frase.', 500);
  }
});

app.get('/api/clients/:id/quote-of-the-day', authMiddleware, ownerOrAdmin, requirePermission('training'), async (req, res) => {
  try {
    const client = await dbGetOne('clients', { id: req.params.id });
    if (client && client.assigned_quote_id) {
      const assigned = await dbGetOne('mindset_quotes', { id: client.assigned_quote_id });
      if (assigned) return ok(res, { quote: assigned });
    }
    const pool = await dbGet('mindset_quotes', { active: true });
    if (!pool.length) return ok(res, { quote: null });
    return ok(res, { quote: pool[Math.floor(Math.random() * pool.length)] });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener la frase del día.', 500);
  }
});

// Biblioteca de frases de mentalidad (panel admin)
app.get('/api/admin/quotes', authMiddleware, adminOnly, async (req, res) => {
  try {
    const quotes = await dbGet('mindset_quotes', {}, { order: { column: 'created_at', ascending: false } });
    return ok(res, { quotes });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener las frases.', 500);
  }
});
app.post('/api/admin/quotes', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { quote, author } = req.body;
    if (!quote) return err(res, 'La frase no puede estar vacía.', 400);
    const created = await dbInsert('mindset_quotes', { quote, author: author || null });
    return ok(res, { quote: created }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear la frase.', 500);
  }
});
app.patch('/api/admin/quotes/:qid', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { quote, author, active } = req.body;
    const patch = {};
    if (quote !== undefined) patch.quote = quote;
    if (author !== undefined) patch.author = author;
    if (active !== undefined) patch.active = active;
    const updated = await dbUpdate('mindset_quotes', req.params.qid, patch);
    return ok(res, { quote: updated });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar la frase.', 500);
  }
});
app.delete('/api/admin/quotes/:qid', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('mindset_quotes', req.params.qid);
    return ok(res, { message: 'Frase eliminada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar la frase.', 500);
  }
});

// Herramientas para dormir (Descanso) — banco global, no por cliente.
const DEFAULT_REST_TOOLS = [
  { name: 'Sonidos para dormir', meta: 'Ruido blanco + respiración guiada · 20 min', action: 'play', minutes: 20 },
  { name: 'NSDR · Descanso profundo sin dormir', meta: '10 min · para siestas o resets a media tarde', action: 'play', minutes: 10 },
  { name: 'Diario de descarga mental', meta: 'Escribe lo que ronda tu cabeza antes de apagar la luz', action: 'write', minutes: null },
];
app.get('/api/rest-tools', authMiddleware, async (req, res) => {
  try {
    let all = await dbGet('rest_tools', {});
    if (!all.length) {
      await Promise.all(DEFAULT_REST_TOOLS.map((t, i) => dbInsert('rest_tools', { ...t, sort_order: i })));
      all = await dbGet('rest_tools', {});
    }
    const tools = all.filter((t) => t.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return ok(res, { tools });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener herramientas para dormir.', 500);
  }
});
app.get('/api/admin/rest-tools', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tools = await dbGet('rest_tools', {}, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { tools });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener herramientas para dormir.', 500);
  }
});
app.post('/api/admin/rest-tools', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tool = await dbInsert('rest_tools', req.body);
    return ok(res, { tool }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear la herramienta.', 500);
  }
});
app.put('/api/admin/rest-tools/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (req.body.audio_url === null) {
      const existing = await dbGetOne('rest_tools', { id: req.params.id });
      if (existing) await deleteOldStorageFile(existing.audio_url);
    }
    const tool = await dbUpdate('rest_tools', req.params.id, req.body);
    return ok(res, { tool });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar la herramienta.', 500);
  }
});
app.delete('/api/admin/rest-tools/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const existing = await dbGetOne('rest_tools', { id: req.params.id });
    await dbDelete('rest_tools', req.params.id);
    if (existing) await deleteOldStorageFile(existing.audio_url);
    return ok(res, { message: 'Herramienta eliminada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar la herramienta.', 500);
  }
});
app.post('/api/admin/rest-tools/:id/upload-audio', authMiddleware, adminOnly, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún audio.');
    const existing = await dbGetOne('rest_tools', { id: req.params.id });
    const filename = `rest-tools/${req.params.id}/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const tool = await dbUpdate('rest_tools', req.params.id, { audio_url: pub.publicUrl, audio_name: req.file.originalname });
    if (existing) await deleteOldStorageFile(existing.audio_url);
    return ok(res, { tool });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el audio.', 500);
  }
});

app.get('/api/clients/:id/notifications', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const notifications = await dbGet('client_notifications', { client_id: req.params.id }, { order: { column: 'created_at', ascending: false } });
    return ok(res, { notifications });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener notificaciones.', 500);
  }
});
app.patch('/api/clients/:id/notifications/read-all', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const unread = await dbGet('client_notifications', { client_id: req.params.id, read: false });
    await Promise.all(unread.map(n => dbUpdate('client_notifications', n.id, { read: true })));
    return ok(res, { message: 'ok' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al marcar notificaciones como leídas.', 500);
  }
});

app.get('/api/clients/:id/training-completions', authMiddleware, ownerOrAdmin, requirePermission('training'), async (req, res) => {
  try {
    const completions = await dbGet('training_completions', { client_id: req.params.id }, { order: { column: 'completed_date', ascending: false } });
    return ok(res, { completions });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el historial de entrenamiento.', 500);
  }
});

app.post('/api/clients/:id/training-completions', authMiddleware, ownerOrAdmin, requirePermission('training'), async (req, res) => {
  try {
    const dayNumber = parseInt(req.body.day_number, 10);
    if (![1,2,3,4,5,6,7].includes(dayNumber)) return err(res, 'Día inválido.', 400);
    const today = new Date().toISOString().slice(0, 10);
    const existing = await dbGetOne('training_completions', { client_id: req.params.id, day_number: dayNumber, completed_date: today });
    if (existing) return ok(res, { completion: existing });
    const completion = await dbInsert('training_completions', { client_id: req.params.id, day_number: dayNumber, completed_date: today });
    return ok(res, { completion }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al marcar el día como completado.', 500);
  }
});

app.get('/api/clients/:id/exercises', authMiddleware, ownerOrAdmin, requirePermission('training'), async (req, res) => {
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
    await unlockModule(req.params.id, 'training');
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

app.get('/api/clients/:id/nutrition', authMiddleware, ownerOrAdmin, requirePermission('nutrition'), async (req, res) => {
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
    await unlockModule(req.params.id, 'nutrition');
    return ok(res, { plan });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar plan de nutrición.', 500);
  }
});

app.post('/api/clients/:id/nutrition/upload-pdf', authMiddleware, adminOnly, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún archivo.');
    if (req.file.mimetype !== 'application/pdf') return err(res, 'Formato inválido. Usa PDF.', 400);
    const filename = `${req.params.id}/nutrition/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const plan = await dbUpsertByClient('nutrition_plans', req.params.id, { pdf_url: pub.publicUrl, pdf_name: req.file.originalname });
    return ok(res, { plan });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el PDF.', 500);
  }
});

app.post('/api/clients/:id/meals', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meal = await dbInsert('meals', { client_id: req.params.id, ...req.body });
    await unlockModule(req.params.id, 'nutrition');
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

app.get('/api/clients/:id/supplements', authMiddleware, ownerOrAdmin, requirePermission('supplementation'), async (req, res) => {
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
    await unlockModule(req.params.id, 'supplementation');
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

app.get('/api/clients/:id/cortisol-techniques', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
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
    await unlockModule(req.params.id, 'cortisol');
    return ok(res, { technique }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al asignar técnica.', 500);
  }
});

app.put('/api/clients/:id/cortisol-techniques/:techId', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (req.body.audio_url === null) {
      const existing = await dbGetOne('cortisol_techniques', { id: req.params.techId });
      if (existing) await deleteOldStorageFile(existing.audio_url);
    }
    const technique = await dbUpdate('cortisol_techniques', req.params.techId, req.body);
    return ok(res, { technique });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar técnica.', 500);
  }
});

app.delete('/api/clients/:id/cortisol-techniques/:techId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const existing = await dbGetOne('cortisol_techniques', { id: req.params.techId });
    await dbDelete('cortisol_techniques', req.params.techId);
    if (existing) await deleteOldStorageFile(existing.audio_url);
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

app.post('/api/clients/:id/cortisol-techniques/:techId/upload-audio', authMiddleware, adminOnly, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return err(res, 'No se recibió ningún audio.');
    const existing = await dbGetOne('cortisol_techniques', { id: req.params.techId });
    const filename = `${req.params.id}/cortisol/${uuidv4()}_${req.file.originalname}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const technique = await dbUpdate('cortisol_techniques', req.params.techId, { audio_url: pub.publicUrl, audio_name: req.file.originalname });
    if (existing) await deleteOldStorageFile(existing.audio_url);
    return ok(res, { technique });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al subir el audio.', 500);
  }
});

app.get('/api/clients/:id/cortisol-completions', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
  try {
    const completions = await dbGet('cortisol_completions', { client_id: req.params.id }, { order: { column: 'completed_date', ascending: false } });
    return ok(res, { completions });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el historial de cortisol.', 500);
  }
});

app.post('/api/clients/:id/cortisol-completions', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await dbGetOne('cortisol_completions', { client_id: req.params.id, completed_date: today });
    if (existing) return ok(res, { completion: existing });
    const completion = await dbInsert('cortisol_completions', { client_id: req.params.id, technique_id: req.body.technique_id || null, completed_date: today });
    return ok(res, { completion }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al marcar como completado.', 500);
  }
});

app.get('/api/clients/:id/cortisol-checkin', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const checkin = await dbGetOne('cortisol_checkins', { client_id: req.params.id, checkin_date: today });
    return ok(res, { checkin });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el check-in de hoy.', 500);
  }
});

app.post('/api/clients/:id/cortisol-checkin', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
  try {
    const validEmotions = ['ansioso', 'irritable', 'cansado', 'abrumado', 'tranquilo', 'energia'];
    if (!validEmotions.includes(req.body.emotion)) return err(res, 'Emoción inválida.', 400);
    const today = new Date().toISOString().slice(0, 10);
    const existing = await dbGetOne('cortisol_checkins', { client_id: req.params.id, checkin_date: today });
    const checkin = existing
      ? await dbUpdate('cortisol_checkins', existing.id, { emotion: req.body.emotion })
      : await dbInsert('cortisol_checkins', { client_id: req.params.id, emotion: req.body.emotion, checkin_date: today });
    return ok(res, { checkin });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar el check-in.', 500);
  }
});

app.get('/api/clients/:id/cortisol-tip-of-the-day', authMiddleware, ownerOrAdmin, requirePermission('cortisol'), async (req, res) => {
  try {
    const pool = await dbGet('cortisol_tips', { active: true });
    if (!pool.length) return ok(res, { tip: null });
    return ok(res, { tip: pool[Math.floor(Math.random() * pool.length)] });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el tip del día.', 500);
  }
});

// Banco de tips de cortisol (creado/gestionado desde el propio panel admin
// del módulo Gestión de Cortisol, no un ítem de nav separado).
app.get('/api/admin/cortisol-tips', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tips = await dbGet('cortisol_tips', {}, { order: { column: 'created_at', ascending: false } });
    return ok(res, { tips });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener los tips.', 500);
  }
});
app.post('/api/admin/cortisol-tips', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return err(res, 'El tip no puede estar vacío.', 400);
    const created = await dbInsert('cortisol_tips', { content });
    return ok(res, { tip: created }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear el tip.', 500);
  }
});
app.patch('/api/admin/cortisol-tips/:tipId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { content, active } = req.body;
    const patch = {};
    if (content !== undefined) patch.content = content;
    if (active !== undefined) patch.active = active;
    const updated = await dbUpdate('cortisol_tips', req.params.tipId, patch);
    return ok(res, { tip: updated });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar el tip.', 500);
  }
});
app.delete('/api/admin/cortisol-tips/:tipId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('cortisol_tips', req.params.tipId);
    return ok(res, { message: 'Tip eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar el tip.', 500);
  }
});

// ------------------------------------------------------------
// Comunidad: Eventos
// ------------------------------------------------------------

app.get('/api/community/events', authMiddleware, requireEventsAccess, async (req, res) => {
  try {
    const events = await dbGet('community_events', { active: true }, { order: { column: 'event_date', ascending: true } });
    const reservations = events.length ? await dbGet('event_reservations', { status: 'confirmada' }) : [];
    const countByEvent = {};
    reservations.forEach((r) => { countByEvent[r.event_id] = (countByEvent[r.event_id] || 0) + 1; });
    const eventsWithCounts = events.map((e) => ({ ...e, confirmed_count: countByEvent[e.id] || 0 }));
    return ok(res, { events: eventsWithCounts });
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

app.post('/api/community/events/:eventId/reserve', authMiddleware, requireEventsAccess, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
    const existing = await dbGetOne('event_reservations', { event_id: req.params.eventId, client_id: req.user.id });
    if (existing && existing.status === 'confirmada') return err(res, 'Ya tienes una reserva para este evento.', 409);
    const reservation = existing
      ? await dbUpdate('event_reservations', existing.id, { status: 'confirmada' })
      : await dbInsert('event_reservations', { event_id: req.params.eventId, client_id: req.user.id });
    return ok(res, { reservation }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al reservar evento.', 500);
  }
});

app.delete('/api/community/events/:eventId/reserve', authMiddleware, requireEventsAccess, async (req, res) => {
  try {
    const reservation = await dbGetOne('event_reservations', { event_id: req.params.eventId, client_id: req.user.id, status: 'confirmada' });
    if (!reservation) return err(res, 'No tienes una reserva para este evento.', 404);
    await dbUpdate('event_reservations', reservation.id, { status: 'cancelada' });
    return ok(res, { message: 'Reserva cancelada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al cancelar reserva.', 500);
  }
});

app.get('/api/clients/:id/event-reservations', authMiddleware, ownerOrAdmin, requireEventsAccess, async (req, res) => {
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

app.get('/api/community/therapies', authMiddleware, requireEventsAccess, async (req, res) => {
  try {
    const therapies = await dbGet('community_therapies', { active: true }, { order: { column: 'sort_order', ascending: true } });
    const reservations = therapies.length ? await dbGet('therapy_reservations', { status: 'confirmada' }) : [];
    const countByTherapy = {};
    reservations.forEach((r) => { countByTherapy[r.therapy_id] = (countByTherapy[r.therapy_id] || 0) + 1; });
    const therapiesWithCounts = therapies.map((t) => ({ ...t, confirmed_count: countByTherapy[t.id] || 0 }));
    return ok(res, { therapies: therapiesWithCounts });
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

app.post('/api/community/therapies/:therapyId/reserve', authMiddleware, requireCommunityAccess, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
    const existing = await dbGetOne('therapy_reservations', { therapy_id: req.params.therapyId, client_id: req.user.id });
    if (existing && existing.status === 'confirmada') return err(res, 'Ya tienes una reserva para esta terapia.', 409);
    const reservation = existing
      ? await dbUpdate('therapy_reservations', existing.id, { status: 'confirmada' })
      : await dbInsert('therapy_reservations', { therapy_id: req.params.therapyId, client_id: req.user.id });
    return ok(res, { reservation }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al reservar terapia.', 500);
  }
});

app.delete('/api/community/therapies/:therapyId/reserve', authMiddleware, requireCommunityAccess, async (req, res) => {
  try {
    const reservation = await dbGetOne('therapy_reservations', { therapy_id: req.params.therapyId, client_id: req.user.id, status: 'confirmada' });
    if (!reservation) return err(res, 'No tienes una reserva para esta terapia.', 404);
    await dbUpdate('therapy_reservations', reservation.id, { status: 'cancelada' });
    return ok(res, { message: 'Reserva cancelada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al cancelar reserva.', 500);
  }
});

app.get('/api/clients/:id/therapy-reservations', authMiddleware, ownerOrAdmin, requireCommunityAccess, async (req, res) => {
  try {
    const reservations = await dbGet('therapy_reservations', { client_id: req.params.id });
    return ok(res, { reservations });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener reservas.', 500);
  }
});

app.get('/api/community/reservations', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: eventRows, error: eventErr } = await supabase
      .from('event_reservations')
      .select('id, status, created_at, client_id, event_id, clients(name), community_events(title, event_date, location)')
      .eq('status', 'confirmada')
      .order('created_at', { ascending: false });
    if (eventErr) throw eventErr;

    const { data: therapyRows, error: therapyErr } = await supabase
      .from('therapy_reservations')
      .select('id, status, created_at, client_id, therapy_id, clients(name), community_therapies(title, provider, discount_pct)')
      .eq('status', 'confirmada')
      .order('created_at', { ascending: false });
    if (therapyErr) throw therapyErr;

    const clientIds = Array.from(new Set([
      ...eventRows.map(r => r.client_id),
      ...therapyRows.map(r => r.client_id),
    ]));

    let phoneByClientId = {};
    if (clientIds.length) {
      const { data: infoRows, error: infoErr } = await supabase
        .from('personal_info')
        .select('client_id, phone_code, phone_number')
        .in('client_id', clientIds);
      if (infoErr) throw infoErr;
      infoRows.forEach((row) => {
        const number = (row.phone_number || '').trim();
        const alreadyHasCode = !row.phone_code || number.startsWith('+') || number.startsWith(row.phone_code);
        phoneByClientId[row.client_id] = alreadyHasCode
          ? (number || null)
          : [row.phone_code, number].filter(Boolean).join(' ') || null;
      });
    }

    const eventReservations = eventRows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      clientName: r.clients?.name || 'Cliente eliminado',
      clientPhone: phoneByClientId[r.client_id] || null,
      eventId: r.event_id,
      eventTitle: r.community_events?.title || 'Evento eliminado',
      eventDate: r.community_events?.event_date || null,
      eventLocation: r.community_events?.location || null,
    }));

    const therapyReservations = therapyRows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      clientName: r.clients?.name || 'Cliente eliminado',
      clientPhone: phoneByClientId[r.client_id] || null,
      therapyId: r.therapy_id,
      therapyTitle: r.community_therapies?.title || 'Terapia eliminada',
      therapyProvider: r.community_therapies?.provider || null,
      therapyDiscountPct: r.community_therapies?.discount_pct || null,
    }));

    return ok(res, { eventReservations, therapyReservations });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener reservas.', 500);
  }
});

// ------------------------------------------------------------
// Descanso: protocolo de sueño personalizado (solo coaching_1_1/online)
// ------------------------------------------------------------

app.get('/api/clients/:id/sleep-protocol', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const protocol = await dbGetOne('sleep_protocols', { client_id: req.params.id });
    return ok(res, { protocol: protocol || null });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el protocolo de sueño.', 500);
  }
});

app.put('/api/clients/:id/sleep-protocol', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { protocol_text, sleep_window, supplement } = req.body;
    const protocol = await dbUpsertByClient('sleep_protocols', req.params.id, { protocol_text, sleep_window, supplement });
    return ok(res, { protocol });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar el protocolo de sueño.', 500);
  }
});

// Registro rápido de sueño (hero de Descanso): una fila por cliente por
// día, upsert sobre (client_id, date) — "hoy" siempre se puede editar,
// un día distinto crea un registro nuevo.
app.get('/api/clients/:id/sleep-log-today', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const log = await dbGetOne('sleep_logs', { client_id: req.params.id, date: today });
    return ok(res, { log: log || null });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener el registro de sueño.', 500);
  }
});

app.post('/api/clients/:id/sleep-log', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { hours, quality } = req.body;
    if (hours == null || quality == null) return err(res, 'Horas y calidad son requeridas.', 400);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('sleep_logs')
      .upsert({ client_id: req.params.id, date: today, hours, quality, logged_at: new Date().toISOString() }, { onConflict: 'client_id,date' })
      .select()
      .single();
    if (error) throw error;
    return ok(res, { log: data });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar el registro de sueño.', 500);
  }
});

// ------------------------------------------------------------
// Mi Evolución: KPIs de progreso
// ------------------------------------------------------------

app.get('/api/clients/:id/evolution', authMiddleware, ownerOrAdmin, requireOnboardingComplete, async (req, res) => {
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

app.post('/api/clients/:id/evolution', authMiddleware, ownerOrAdmin, requireOnboardingComplete, async (req, res) => {
  try {
    const { fecha, sleep_hours, adherence_pct, pain_flag, pain_notes, stress_score, notes } = req.body;
    const checkin = await dbInsert('evolution_checkins', {
      client_id: req.params.id, fecha, sleep_hours, adherence_pct, pain_flag, pain_notes, stress_score, notes
    });
    return ok(res, { checkin }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al guardar check-in de evolución.', 500);
  }
});

app.get('/api/clients/:id/personal-records', authMiddleware, ownerOrAdmin, requireOnboardingComplete, async (req, res) => {
  try {
    const records = await dbGet('personal_records', { client_id: req.params.id }, { order: { column: 'sort_order', ascending: true } });
    return ok(res, { records });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener récords personales.', 500);
  }
});

app.post('/api/clients/:id/personal-records', authMiddleware, adminOnly, async (req, res) => {
  try {
    const record = await dbInsert('personal_records', { client_id: req.params.id, ...req.body });
    return ok(res, { record }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear récord personal.', 500);
  }
});

app.put('/api/clients/:id/personal-records/:recordId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const record = await dbUpdate('personal_records', req.params.recordId, req.body);
    return ok(res, { record });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar récord personal.', 500);
  }
});

app.delete('/api/clients/:id/personal-records/:recordId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await dbDelete('personal_records', req.params.recordId);
    return ok(res, { message: 'Récord eliminado.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar récord personal.', 500);
  }
});

app.patch('/api/clients/:id/next-checkin-date', authMiddleware, adminOnly, async (req, res) => {
  try {
    const client = await dbUpdate('clients', req.params.id, { next_checkin_date: req.body.next_checkin_date || null });
    return ok(res, { client });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar la próxima medición.', 500);
  }
});

// ------------------------------------------------------------
// Notificaciones para el admin
// ------------------------------------------------------------

app.get('/api/admin/notifications', authMiddleware, adminOnly, async (req, res) => {
  try {
    const notifications = await dbGet('admin_notifications', {}, { order: { column: 'created_at', ascending: false } });
    return ok(res, { notifications });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener notificaciones.', 500);
  }
});

app.patch('/api/admin/notifications/:id/read', authMiddleware, adminOnly, async (req, res) => {
  try {
    const notification = await dbUpdate('admin_notifications', req.params.id, { read: true });
    return ok(res, { notification });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al marcar la notificación como leída.', 500);
  }
});

// ------------------------------------------------------------
// Países / Ciudades (módulo 1) — públicos, sin auth
// ------------------------------------------------------------

app.get('/api/countries', (req, res) => {
  ok(res, { data: getCountriesCache() });
});

app.get('/api/cities/:isoCode', (req, res) => {
  if (!CSC) return ok(res, { data: [] });
  const cities = CSC.City.getCitiesOfCountry(req.params.isoCode.toUpperCase()) || [];
  const names = [...new Set(cities.map(c => c.name))].sort((a, b) => a.localeCompare(b, 'es'));
  ok(res, { data: names });
});

// ------------------------------------------------------------
// OCR InBody (módulo 3, dentro de Información Personal)
// Proxy a Google Cloud Vision con fallback a pdf-parse — mismo
// patrón que BIO360, el parseo de campos InBody ocurre en el frontend.
// ------------------------------------------------------------

app.post('/api/clients/:id/ocr-vision', authMiddleware, ownerOrAdmin, blockForLeadWellness, async (req, res) => {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  const { base64 } = req.body;
  if (!base64) return err(res, 'No se recibió imagen o PDF.');

  async function pdfFallback() {
    if (!pdfParse) throw new Error('pdf-parse no disponible como fallback.');
    const buf = Buffer.from(base64, 'base64');
    const versions = ['v1.10.100', 'v1.9.426', 'default'];
    let lastErr;
    for (const version of versions) {
      try {
        const data = await pdfParse(buf, { version });
        if (data.text && data.text.trim()) return data.text;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('No se pudo extraer texto del PDF.');
  }

  const isPdf = base64.startsWith('JVBERi0');
  const sizeKB = Math.round(base64.length * 0.75 / 1024);
  if (sizeKB > 8000) {
    return err(res, 'La imagen excede 8 MB. Comprime la foto antes de subirla.', 413);
  }

  if (isPdf && pdfParse) {
    try {
      const quickText = await pdfFallback();
      if (quickText && quickText.trim()) return ok(res, { text: quickText, source: 'pdf-parse' });
    } catch (e) {
      console.warn('[OCR] pdf-parse falló (' + e.message + '), intentando Vision API...');
    }
  }

  if (apiKey) {
    const bodyStr = JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }]
    });
    try {
      const text = await new Promise((resolve, reject) => {
        const req2 = https.request({
          hostname: 'vision.googleapis.com',
          path: `/v1/images:annotate?key=${apiKey}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
        }, (r) => {
          let raw = '';
          r.on('data', c => raw += c);
          r.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (r.statusCode === 401) return reject(new Error('AUTH_ERROR'));
              if (r.statusCode === 403) return reject(new Error('FORBIDDEN: Cloud Vision API no habilitada o sin permiso.'));
              if (r.statusCode !== 200) {
                const msg = parsed.error?.message || parsed.error?.status || 'Vision API error ' + r.statusCode;
                if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('api key')) return reject(new Error('API_KEY_ERROR: ' + msg));
                return reject(new Error(msg));
              }
              resolve(parsed.responses?.[0]?.fullTextAnnotation?.text || '');
            } catch (e) { reject(e); }
          });
        });
        req2.setTimeout(20000, () => { req2.destroy(); reject(new Error('TIMEOUT')); });
        req2.on('error', reject);
        req2.write(bodyStr);
        req2.end();
      });
      if (text && text.trim()) return ok(res, { text, source: 'vision' });
      if (!isPdf) return ok(res, { text: '', source: 'vision' });
    } catch (e) {
      const msg = e.message || '';
      if (msg.startsWith('API_KEY_ERROR')) return err(res, 'Google Vision API key vencida o inválida.', 401);
      const fallbackable = isPdf && (msg === 'AUTH_ERROR' || msg === 'TIMEOUT' || msg.includes('BILLING') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED'));
      if (!fallbackable) return err(res, msg || 'Error al procesar el archivo.', 500);
    }
  } else if (!isPdf) {
    return err(res, 'GOOGLE_VISION_API_KEY no está configurada en el servidor.', 501);
  }

  try {
    const text = await pdfFallback();
    ok(res, { text, source: 'pdf-parse' });
  } catch (e2) {
    err(res, 'Error pdf-parse: ' + e2.message, 500);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return res.status(404).json({ success: false, error: 'Ruta no encontrada.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`La Tribu — servidor escuchando en el puerto ${PORT}`);
  });
}

module.exports = app;
