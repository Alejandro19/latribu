import { pgTable, uuid, text, boolean, integer, serial, date, jsonb, timestamp, numeric, unique, index } from 'drizzle-orm/pg-core';

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default('Administrador'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  googleId: text('google_id'),
  appleId: text('apple_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  appleId: text('apple_id'),
  // true cuando el admin asigna una contraseña temporal — obliga a cambiarla en el primer login (mismo patrón que therapists.mustChangePassword).
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  status: text('status').notNull().default('active'),
  plan: text('plan').notNull().default('Miembro'),
  clientType: text('client_type').notNull().default('coaching_1_1'),
  planDurationDays: integer('plan_duration_days'),
  planStartDate: date('plan_start_date'),
  planEndDate: date('plan_end_date'),
  permissions: jsonb('permissions').notNull().default({
    training: false,
    nutrition: false,
    supplementation: false,
    cortisol: false,
    community: true,
    evolution: true,
  }),
  trainingDays: integer('training_days'),
  assignedQuoteId: uuid('assigned_quote_id'),
  objetivos: jsonb('objetivos').notNull().default({}),
  inbodyCadenceType: text('inbody_cadence_type').notNull().default('mensual'),
  inbodyNextExpectedDate: date('inbody_next_expected_date'),
  inbodyReminderEnabled: boolean('inbody_reminder_enabled').notNull().default(true),
  inbodyReminderSentThisCycle: boolean('inbody_reminder_sent_this_cycle').notNull().default(false),
  nextCheckinDate: date('next_checkin_date'),
  // Autoasignado (secuencia Postgres, ver updateStatus en clients.service.ts)
  // en el momento exacto en que un admin activa al cliente — nunca se
  // ingresa a mano. Null hasta la primera activación.
  memberNumber: integer('member_number').unique(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  avatarUrl: text('avatar_url'),
  notificationPreferences: jsonb('notification_preferences').notNull().default({
    streakReminders: true,
    events: true,
    news: false,
  }),
  // Idioma de la interfaz fija (nav, botones, textos del sistema) —
  // Configuración > Idioma. El contenido administrable (frases, legal)
  // sigue en español independientemente de esto, por ahora.
  language: text('language').notNull().default('es'),
  // No-nulo = solicitud de eliminación pendiente de revisión humana (ver
  // account.service.ts / panel admin de clientes). Nunca dispara un borrado
  // automático — solo lo hace visible para que un admin contacte al cliente.
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  // Saldo de clases del paquete Presencial vigente — se fija al activar el
  // pago (ver clientsService.activatePaidPlan) y se descuenta en cada
  // asistencia (ver training.service.ts::confirmSession). null para
  // cualquier tipo de cliente que no sea coaching_1_1.
  sessionsTotal: integer('sessions_total'),
  sessionsRemaining: integer('sessions_remaining'),
  // Flujo de alta con invitación (solo Mentoría, ver client-invitations.service.ts):
  // se setea una vez, la primera vez que se alcanzan 7 días de datos de
  // wearable acumulados — habilita que el admin pueda aprobar wearable.
  wearableBaselineReadyAt: timestamp('wearable_baseline_ready_at', { withTimezone: true }),
  // Se setea una vez al alcanzar 28 días — evita recalcular el conteo de días
  // en cada carga de la lista de admin (ver clients-client.ts::ClientSummary).
  wearableBaselineStableAt: timestamp('wearable_baseline_stable_at', { withTimezone: true }),
  baselineApprovedAt: timestamp('baseline_approved_at', { withTimezone: true }),
  wearableApprovedAt: timestamp('wearable_approved_at', { withTimezone: true }),
  // Se marca una sola vez, cuando baseline + wearable + laboratorio semana 0
  // quedan aprobados simultáneamente por primera vez — nunca se vuelve a
  // disparar (ver onboarding.service.ts::checkWeek1Activation).
  week1ActivatedAt: timestamp('week1_activated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Invitación de alta de cliente (solo Mentoría) — separada de
// passwordResetTokens a propósito: invariantes de negocio distintas (una
// invitación asume passwordHash NULL, un reset asume una cuenta ya usable) y
// "reenviar" (ver resendInvitation) no tiene equivalente en el flujo de
// reset. El hash del token comparte helper con passwordResetTokens (ver
// token-hashing.ts) para no divergir en el mecanismo.
export const clientInvitations = pgTable('client_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('client_invitations_client_id_idx').on(table.clientId),
}));
export type ClientInvitation = typeof clientInvitations.$inferSelect;

export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('onboarding_complete'),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('admin_notifications_client_id_idx').on(table.clientId),
}));

export type AdminNotification = typeof adminNotifications.$inferSelect;

export type Admin = typeof admins.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export const personalInfo = pgTable('personal_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name'),
  age: integer('age'),
  birthdate: date('birthdate'),
  gender: text('gender'),
  occupation: text('occupation'),
  cedula: text('cedula'),
  idType: text('id_type'),
  email: text('email'),
  country: text('country'),
  city: text('city'),
  phoneCode: text('phone_code').default('+52'),
  phoneNumber: text('phone_number'),
  maritalStatus: text('marital_status'),
  weight: numeric('weight', { precision: 5, scale: 1 }).$type<number>(),
  height: numeric('height', { precision: 5, scale: 1 }).$type<number>(),
  bodyFat: numeric('body_fat', { precision: 4, scale: 1 }).$type<number>(),
  // Salud hormonal (Módulo 1, baseline) — motor de insights Mentoría.
  hormonalStatus: text('hormonal_status'),
  hormonalStatusOther: text('hormonal_status_other'),
  lastPeriodDate: date('last_period_date'),
  cycleLengthDays: integer('cycle_length_days'),
  // Última vez que se confirmó/actualizó cycleLengthDays — usado para pedir
  // revisión cada 3-6 meses en la reflexión semanal (Fase C), nunca desde cero.
  cycleLengthConfirmedAt: timestamp('cycle_length_confirmed_at', { withTimezone: true }),
  // Apnea del sueño (Módulo 6, baseline) — alimenta SUE-07.
  snores: text('snores'),
  sleepApneaSigns: text('sleep_apnea_signs'),
  // Segmentación para el benchmark comparativo anonimizado de Mentoría (ver
  // mentoring-benchmark.service.ts) — la llena un admin a mano desde la
  // ficha del cliente, nunca el wizard de onboarding. Null hasta que se
  // clasifique; sin ambos campos, ese cliente no aporta al benchmark.
  cargoType: text('cargo_type'),
  sector: text('sector'),
  // true cuando el cliente Mentoría llena los campos manuales de Apple
  // Health en el Módulo 10 del onboarding — no hay OAuth real para Apple
  // Watch, así que esto es la única señal server-side de "wearable
  // conectado" para ese caso (ver onboarding.service.ts::validateMentoringOnboarding).
  appleHealthConnected: boolean('apple_health_connected').notNull().default(false),
  onboardingReport: jsonb('onboarding_report').default({}),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const anthropometricRecords = pgTable('anthropometric_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull().defaultNow(),
  semana: integer('semana'),
  mesNum: integer('mes_num'),
  peso: numeric('peso', { precision: 5, scale: 1 }).$type<number>(),
  cintura: numeric('cintura', { precision: 5, scale: 1 }).$type<number>(),
  brazos: numeric('brazos', { precision: 5, scale: 1 }).$type<number>(),
  hombros: numeric('hombros', { precision: 5, scale: 1 }).$type<number>(),
  piernas: numeric('piernas', { precision: 5, scale: 1 }).$type<number>(),
  gluteo: numeric('gluteo', { precision: 5, scale: 1 }).$type<number>(),
  notas: text('notas'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('anthropometric_records_client_id_idx').on(table.clientId),
}));

export const progressPhotos = pgTable('progress_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  anthropometricRecordId: uuid('anthropometric_record_id').references(() => anthropometricRecords.id, { onDelete: 'cascade' }),
  angle: text('angle'),
  photoUrl: text('photo_url').notNull(),
  fecha: date('fecha').notNull().defaultNow(),
  mesNum: integer('mes_num'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('progress_photos_client_id_idx').on(table.clientId),
}));

export const bioInbodyRecords = pgTable('bio_inbody_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha'),
  version: text('version'),
  pesoTotal: numeric('peso_total', { precision: 5, scale: 1 }).$type<number>(),
  smm: numeric('smm', { precision: 5, scale: 1 }).$type<number>(),
  grasaPct: numeric('grasa_pct', { precision: 4, scale: 1 }).$type<number>(),
  imc: numeric('imc', { precision: 4, scale: 1 }).$type<number>(),
  pesoObjetivo: numeric('peso_objetivo', { precision: 5, scale: 1 }).$type<number>(),
  grasaVisceral: numeric('grasa_visceral', { precision: 4, scale: 1 }).$type<number>(),
  bmr: numeric('bmr', { precision: 6, scale: 0 }).$type<number>(),
  anguloFase: numeric('angulo_fase', { precision: 4, scale: 2 }).$type<number>(),
  ecwTbw: numeric('ecw_tbw', { precision: 5, scale: 3 }).$type<number>(),
  masaOsea: numeric('masa_osea', { precision: 4, scale: 2 }).$type<number>(),
  altura: numeric('altura', { precision: 5, scale: 1 }).$type<number>(),
  mesNum: integer('mes_num'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('bio_inbody_records_client_id_idx').on(table.clientId),
}));

export type PersonalInfo = typeof personalInfo.$inferSelect;
export type AnthropometricRecord = typeof anthropometricRecords.$inferSelect;
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type BioInbodyRecord = typeof bioInbodyRecords.$inferSelect;

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dayNumber: integer('day_number').notNull().default(1),
  category: text('category').notNull().default('strength'),
  series: integer('series'),
  reps: text('reps'),
  duration: text('duration'),
  restTime: text('rest_time'),
  description: text('description'),
  recommendations: text('recommendations'),
  youtubeUrl: text('youtube_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('exercises_client_id_idx').on(table.clientId),
}));

export const trainingCompletions = pgTable('training_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  completedDate: date('completed_date').notNull().defaultNow(),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('training_completions_client_id_idx').on(table.clientId),
}));

export const clientNotifications = pgTable('client_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('client_notifications_client_id_idx').on(table.clientId),
}));

export type Exercise = typeof exercises.$inferSelect;
export type TrainingCompletion = typeof trainingCompletions.$inferSelect;
export type ClientNotification = typeof clientNotifications.$inferSelect;

export const phrases = pgTable('phrases', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  context: text('context').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const trainingProtectorUses = pgTable('training_protector_uses', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('training_protector_uses_client_id_idx').on(table.clientId),
}));

export const achievementLogs = pgTable('achievement_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  weekNumber: integer('week_number').notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('achievement_logs_client_id_idx').on(table.clientId),
}));

export const mindsetQuotes = pgTable('mindset_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  quote: text('quote').notNull(),
  author: text('author'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Phrase = typeof phrases.$inferSelect;
export type TrainingProtectorUse = typeof trainingProtectorUses.$inferSelect;
export type AchievementLog = typeof achievementLogs.$inferSelect;
export type MindsetQuote = typeof mindsetQuotes.$inferSelect;

export const restTools = pgTable('rest_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  meta: text('meta'),
  action: text('action').notNull(),
  minutes: integer('minutes'),
  seconds: integer('seconds'),
  audioUrl: text('audio_url'),
  audioName: text('audio_name'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type RestTool = typeof restTools.$inferSelect;

export const nutritionPlans = pgTable('nutrition_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  dailyCals: integer('daily_cals').default(0),
  proteinG: integer('protein_g').default(0),
  carbsG: integer('carbs_g').default(0),
  fatG: integer('fat_g').default(0),
  notes: text('notes'),
  clientObservations: text('client_observations'),
  pdfUrl: text('pdf_url'),
  pdfName: text('pdf_name'),
  summary: text('summary'),
  menuPlan: jsonb('menu_plan').default([]),
  recommendations: jsonb('recommendations').default([]),
  closingMessage: text('closing_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  mealTime: text('meal_time').notNull(),
  name: text('name').notNull(),
  calories: integer('calories').default(0),
  proteinG: integer('protein_g').default(0),
  carbsG: integer('carbs_g').default(0),
  fatG: integer('fat_g').default(0),
  tags: text('tags').array().default([]),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('meals_client_id_idx').on(table.clientId),
}));

export const supplements = pgTable('supplements', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  dose: text('dose'),
  timing: text('timing'),
  benefit: text('benefit'),
  category: text('category'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('supplements_client_id_idx').on(table.clientId),
}));

export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Supplement = typeof supplements.$inferSelect;

export const cortisolTechniques = pgTable('cortisol_techniques', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type'),
  duration: text('duration'),
  durationMinutes: integer('duration_minutes'),
  durationSeconds: integer('duration_seconds'),
  description: text('description'),
  videoUrl: text('video_url'),
  videoName: text('video_name'),
  youtubeUrl: text('youtube_url'),
  audioUrl: text('audio_url'),
  audioName: text('audio_name'),
  sortOrder: integer('sort_order').default(0),
  // Emoción del check-in ('ansioso' | 'irritable' | ... — ver CORTISOL_EMOTIONS
  // en apps/web/lib/cortisol-logic.ts) para la que esta técnica es la
  // recomendación del hero — null si no está asignada a ninguna.
  emotion: text('emotion'),
  // Aviso de precaución/contraindicación visible en el cliente — sobre todo
  // para "Exposición Controlada" (frío/calor), disponible para cualquier tipo.
  precautionNote: text('precaution_note'),
  // "The Rox Ritual" (bloque fijo de 3 rituales en Stress) reutiliza el
  // reproductor/registro de técnicas existente en vez de un sistema nuevo —
  // este flag es lo único que distingue a una técnica-ritual del resto.
  isRitual: boolean('is_ritual').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('cortisol_techniques_client_id_idx').on(table.clientId),
}));

export const cortisolCompletions = pgTable('cortisol_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  techniqueId: uuid('technique_id').references(() => cortisolTechniques.id, { onDelete: 'set null' }),
  completedDate: date('completed_date').notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('cortisol_completions_client_id_idx').on(table.clientId),
}));

export const cortisolCheckins = pgTable('cortisol_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  emotion: text('emotion').notNull(),
  checkinDate: date('checkin_date').notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('cortisol_checkins_client_id_idx').on(table.clientId),
}));

export const cortisolTips = pgTable('cortisol_tips', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Check-in matutino de autorreporte (Stress) — reemplaza la fuente
// inexistente de "Cortisol AM". 3 preguntas 1-5 (energía/tensión/claridad),
// una vez por día por cliente; activacionMatutina es el score derivado
// (0-10), calculado y guardado en el momento del check-in (ver
// morning-checkin.service.ts). Un día sin respuesta no tiene fila — nunca
// se rellena con un valor por defecto ni se repite el último.
export const morningCheckins = pgTable('morning_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  energia: integer('energia').notNull(),
  tension: integer('tension').notNull(),
  claridad: integer('claridad').notNull(),
  activacionMatutina: numeric('activacion_matutina', { precision: 4, scale: 2 }).notNull().$type<number>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('morning_checkins_client_id_idx').on(table.clientId),
  clientFechaUnique: unique('morning_checkins_client_id_fecha_unique').on(table.clientId, table.fecha),
}));

// Carga Cognitiva diaria (Stress) — score 0-10 calculado por el job
// nocturno (cognitive-load.service.ts) a partir de HRV/Activación Matutina/
// Recuperación%/Sleep score. El umbral sostenible (percentil 75) y el
// contador de días consecutivos por encima se calculan en LECTURA a partir
// de esta tabla — no se guardan aparte, para no arriesgar un umbral
// cacheado desincronizado del historial real.
export const cognitiveLoadHistory = pgTable('cognitive_load_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  score: numeric('score', { precision: 4, scale: 2 }).notNull().$type<number>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('cognitive_load_history_client_id_idx').on(table.clientId),
  clientFechaUnique: unique('cognitive_load_history_client_id_fecha_unique').on(table.clientId, table.fecha),
}));

export type CortisolTechnique = typeof cortisolTechniques.$inferSelect;
export type CortisolCompletion = typeof cortisolCompletions.$inferSelect;
export type CortisolCheckin = typeof cortisolCheckins.$inferSelect;
export type CortisolTip = typeof cortisolTips.$inferSelect;
export type MorningCheckin = typeof morningCheckins.$inferSelect;
export type CognitiveLoadRow = typeof cognitiveLoadHistory.$inferSelect;

export const nutritionTips = pgTable('nutrition_tips', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type NutritionTip = typeof nutritionTips.$inferSelect;

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category'),
  pdfUrl: text('pdf_url').notNull(),
  pdfName: text('pdf_name').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Recipe = typeof recipes.$inferSelect;

export const sleepProtocols = pgTable('sleep_protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  protocolText: text('protocol_text'),
  sleepWindow: text('sleep_window'),
  supplement: text('supplement'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: date('date').notNull().defaultNow(),
  hours: numeric('hours', { precision: 3, scale: 1 }).notNull().$type<number>(),
  quality: integer('quality').notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // sleep.service.ts hace upsert por día con onConflictDoUpdate({ target: [clientId, date] }) —
  // este constraint es lo que ese ON CONFLICT necesita para resolver el arbiter index.
  // clientDateUnique ya cubre lookups por client_id solo (regla de prefijo
  // izquierdo de btree: client_id es la primera columna) — no hace falta un
  // índice aparte solo para client_id.
  clientDateUnique: unique('sleep_logs_client_id_date_unique').on(table.clientId, table.date),
}));

export type SleepProtocol = typeof sleepProtocols.$inferSelect;
export type SleepLog = typeof sleepLogs.$inferSelect;

// ==== COMMUNITY MODULE TABLES ====

export const communityEvents = pgTable('community_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date', { withTimezone: true }),
  location: text('location'),
  capacity: integer('capacity'),
  imageUrl: text('image_url'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const eventReservations = pgTable('event_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => communityEvents.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('confirmada'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('event_reservations_client_id_idx').on(table.clientId),
}));

export const communityTherapies = pgTable('community_therapies', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  discountPct: integer('discount_pct').default(0),
  provider: text('provider'),
  imageUrl: text('image_url'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const therapyReservations = pgTable('therapy_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  therapyId: uuid('therapy_id').notNull().references(() => communityTherapies.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('confirmada'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('therapy_reservations_client_id_idx').on(table.clientId),
}));

export type CommunityEvent = typeof communityEvents.$inferSelect;
export type EventReservation = typeof eventReservations.$inferSelect;
export type CommunityTherapy = typeof communityTherapies.$inferSelect;
export type TherapyReservation = typeof therapyReservations.$inferSelect;

export const communityRetreats = pgTable('community_retreats', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  location: text('location'),
  capacity: integer('capacity'),
  priceCents: integer('price_cents'),
  imageUrl: text('image_url'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const retreatReservations = pgTable('retreat_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  retreatId: uuid('retreat_id').notNull().references(() => communityRetreats.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('confirmada'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('retreat_reservations_client_id_idx').on(table.clientId),
}));

export type CommunityRetreat = typeof communityRetreats.$inferSelect;
export type RetreatReservation = typeof retreatReservations.$inferSelect;

// ==== EVOLUTION MODULE TABLES ====

export const evolutionCheckins = pgTable('evolution_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull().defaultNow(),
  strengthScore: integer('strength_score'),
  moodScore: integer('mood_score'),
  confidenceScore: integer('confidence_score'),
  securityScore: integer('security_score'),
  energyScore: integer('energy_score'),
  notes: text('notes'),
  sleepHours: numeric('sleep_hours', { precision: 3, scale: 1 }).$type<number>(),
  adherencePct: integer('adherence_pct'),
  painFlag: boolean('pain_flag'),
  painNotes: text('pain_notes'),
  stressScore: integer('stress_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('evolution_checkins_client_id_idx').on(table.clientId),
}));

export const personalRecords = pgTable('personal_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(),
  initialValue: text('initial_value'),
  currentValue: text('current_value'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('personal_records_client_id_idx').on(table.clientId),
}));

export type EvolutionCheckin = typeof evolutionCheckins.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;

// ==== DISPOSITIVOS Y LABORATORIOS (módulo Mentoring) ====

export const wearableTokens = pgTable('wearable_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  dispositivo: text('dispositivo').notNull(), // 'garmin' | 'whoop' | 'oura' | 'polar'
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  garminUserId: text('garmin_user_id'),
  whoopUserId: text('whoop_user_id'),
  ouraUserId: text('oura_user_id'),
  polarUserId: text('polar_user_id'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // wearable.service.ts hace upsert por dispositivo con onConflictDoUpdate({ target: [clientId, dispositivo] }).
  clientDispositivoUnique: unique('wearable_tokens_client_id_dispositivo_unique').on(table.clientId, table.dispositivo),
}));

export const wearableMetricas = pgTable('wearable_metricas', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  dispositivo: text('dispositivo').notNull(),
  fecha: date('fecha').notNull(),
  fcReposo: integer('fc_reposo'),
  hrvNocturno: integer('hrv_nocturno'),
  suenoTotalMinutos: integer('sueno_total_minutos'),
  suenoProfundoMinutos: integer('sueno_profundo_minutos'),
  suenoRemMinutos: integer('sueno_rem_minutos'),
  suenoLigeroMinutos: integer('sueno_ligero_minutos'),
  // Tiempo despierto real reportado por el wearable (Oura: `awake_time`) —
  // nunca derivar de total-(profundo+rem+ligero): Oura ya excluye el tiempo
  // despierto de total_sleep_duration, así que esa resta casi siempre da 0.
  suenoDespiertoMinutos: integer('sueno_despierto_minutos'),
  suenoScore: integer('sueno_score'),
  suenoPerformance: integer('sueno_performance'),
  recoveryScore: integer('recovery_score'),
  readinessScore: integer('readiness_score'),
  bodyBatteryMax: integer('body_battery_max'),
  estresPromedio: integer('estres_promedio'),
  spo2: numeric('spo2', { precision: 4, scale: 1 }).$type<number>(),
  vo2max: numeric('vo2max', { precision: 4, scale: 1 }).$type<number>(),
  tasaRespiratoria: numeric('tasa_respiratoria', { precision: 4, scale: 1 }).$type<number>(),
  pasos: integer('pasos'),
  caloriasActivas: integer('calorias_activas'),
  strainScore: numeric('strain_score', { precision: 4, scale: 1 }).$type<number>(),
  temperaturaPiel: numeric('temperatura_piel', { precision: 4, scale: 2 }).$type<number>(),
  horaDormir: timestamp('hora_dormir', { withTimezone: true }),
  horaDespertar: timestamp('hora_despertar', { withTimezone: true }),
  rawData: jsonb('raw_data').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // wearable.service.ts hace upsert diario con onConflictDoUpdate({ target: [clientId, dispositivo, fecha] }).
  clientDispositivoFechaUnique: unique('wearable_metricas_client_id_dispositivo_fecha_unique').on(table.clientId, table.dispositivo, table.fecha),
}));

export const labPanels = pgTable('lab_panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  semanaNumero: integer('semana_numero').notNull(), // 0, 6, 12
  fecha: date('fecha'),
  datos: jsonb('datos').notNull().default({}),
  // Día del ciclo menstrual en que se tomó el panel (P6, solo Mentoría) —
  // auto-calculado desde last_period_date/cycle_length_days o corregido a
  // mano; resuelve la interpretación de Estradiol en mujeres premenopáusicas
  // (PC-03). Nulo si no aplica (ciclo no natural, u otros tiers).
  diaCicloPanel: integer('dia_ciclo_panel'),
  // 'pendiente' (subiendo/procesando) | 'en_revision' (OCR+IA listo, con o
  // sin campos "no detectados", esperando aprobación del admin) | 'aprobado'.
  status: text('status').notNull().default('pendiente'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  // Hash del archivo fuente (ver lab-ai-extraction.service.ts) — evita
  // volver a llamar a la IA si se re-sube el mismo PDF sin cambios.
  sourceFileHash: text('source_file_hash'),
  // Edad Biológica (PhenoAge, Levine et al. 2018) — calculada y congelada una
  // sola vez al momento de aprobar el panel (ver biological-age.service.ts),
  // solo si `datos` trae los 9 marcadores requeridos completos. Se guarda la
  // edad cronológica usada en el cálculo (edad EN LA FECHA del panel, no la
  // actual) para que el dato histórico nunca cambie si se corrige el
  // birthdate del cliente más adelante.
  edadBiologica: numeric('edad_biologica', { precision: 5, scale: 2 }).$type<number>(),
  edadCronologicaCalculo: numeric('edad_cronologica_calculo', { precision: 5, scale: 2 }).$type<number>(),
  edadBiologicaCalculadaEn: timestamp('edad_biologica_calculada_en', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // lab-panels.service.ts hace upsert por checkpoint con onConflictDoUpdate({ target: [clientId, semanaNumero] }).
  clientSemanaUnique: unique('lab_panels_client_id_semana_numero_unique').on(table.clientId, table.semanaNumero),
}));

// Copia anonimizada de cada snapshot (semana 0/6/12) de un cliente de
// Mentoría, para un futuro benchmark comparativo entre pares (ver
// mentoring-benchmark.service.ts). Deliberadamente SIN client_id ni ningún
// otro campo identificable — instrucción explícita del producto: esta tabla
// nunca debe permitir reidentificar a la persona, ni siquiera con acceso
// completo a la base de datos. Consecuencia aceptada: si un admin corrige un
// lab_panels ya guardado, se inserta una fila anonimizada adicional en vez de
// actualizar la anterior (inserción pura, sin upsert) — un hash del clientId
// para deduplicar reintroduciría exactamente el vector de reidentificación
// que se pidió evitar, así que no se hace.
export const mentoringBenchmarkSnapshots = pgTable('mentoring_benchmark_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  semanaNumero: integer('semana_numero').notNull(), // 0, 6, 12
  ageBand: text('age_band').notNull(), // ver MENTORING_AGE_BANDS en shared-types
  cargoType: text('cargo_type').notNull(), // ver MENTORING_CARGO_TYPES
  sector: text('sector').notNull(), // ver MENTORING_SECTORS
  markers: jsonb('markers').notNull().default({}), // subconjunto de lab_panels.datos filtrado a ALL_MARKER_IDS
  wearable: jsonb('wearable').notNull().default({}), // subconjunto de WearableTrendSummary
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
});
export type MentoringBenchmarkSnapshot = typeof mentoringBenchmarkSnapshots.$inferSelect;

// Check-ins de baja fricción (Fase C, solo Mentoría) — nunca se guarda una
// fila para un día/semana sin responder: la "confianza degradada" es la
// ausencia de fila, no un valor almacenado (ver checkins.service.ts).
export const dailyCheckins = pgTable('daily_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  pulsoAnimo: integer('pulso_animo').notNull(), // 1-5, escala de caras
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientFechaUnique: unique('daily_checkins_client_id_fecha_unique').on(table.clientId, table.fecha),
}));

export const weeklyReflections = pgTable('weekly_reflections', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  semanaInicio: date('semana_inicio').notNull(), // lunes de la semana ISO, ver wellness-index.service.ts:83-89
  estresCronico: integer('estres_cronico').notNull(), // 1-10
  tecnicasManejoUsadas: text('tecnicas_manejo_usadas'),
  despertaresNocturnosSemana: text('despertares_nocturnos_semana'), // 'Ninguno'|'1-2'|'3+'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientSemanaUnique: unique('weekly_reflections_client_id_semana_inicio_unique').on(table.clientId, table.semanaInicio),
}));

export type WearableToken = typeof wearableTokens.$inferSelect;
export type WearableMetrica = typeof wearableMetricas.$inferSelect;
export type DailyCheckin = typeof dailyCheckins.$inferSelect;
export type WeeklyReflection = typeof weeklyReflections.$inferSelect;

// ==== PUNTO CIEGO MODULE (módulo Mentoring) ====

export const therapists = pgTable('therapists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  specialty: text('specialty'), // ej. "Biodescodificación"
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  // true cuando el admin asigna una contraseña temporal — obliga a cambiarla en el primer login.
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userType: text('user_type').notNull(), // 'admin' | 'cliente' | 'terapeuta'
  userId: uuid('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Evidencia legal de aceptación de la Política de Datos y los Términos de
// Uso — paso final antes de activar cualquier cuenta nueva (ver
// legal-acceptance.service.ts). Tabla de solo-inserción: ningún código de
// este proyecto debe exponer un UPDATE ni un DELETE sobre ella; una futura
// re-aceptación de una versión más nueva de los documentos agrega una fila
// nueva, nunca pisa la anterior. `client_id` NO tiene ON DELETE CASCADE a
// propósito: la evidencia no debe desaparecer aunque el cliente se elimine.
export const legalAcceptances = pgTable('legal_acceptances', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  dataPolicyVersion: text('data_policy_version').notNull(),
  termsVersion: text('terms_version').notNull(),
  sensitiveDataConsent: boolean('sensitive_data_consent').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('legal_acceptances_client_id_idx').on(table.clientId),
}));
export type LegalAcceptance = typeof legalAcceptances.$inferSelect;

// Montos editables desde el panel admin ("Precios de Membresía") — no se
// usan Price objects de Stripe (esos son para Checkout/Subscriptions);
// PaymentIntent.create() recibe el amount directo desde esta tabla.
export const membershipPrices = pgTable('membership_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientType: text('client_type').notNull(),
  durationMonths: integer('duration_months').notNull(),
  // Solo coaching_1_1 usa esto — el paquete de clases (8/12/16) es una
  // tercera dimensión de precio junto con la duración. null para Mentoría,
  // que no vende por paquete.
  packageSize: integer('package_size'),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: text('currency').notNull().default('usd'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientTypeDurationPackageUnique: unique().on(table.clientType, table.durationMonths, table.packageSize),
}));
export type MembershipPrice = typeof membershipPrices.$inferSelect;

// Ledger de pagos + mecanismo de idempotencia: cualquier proveedor puede
// reenviar el mismo evento de webhook más de una vez — la membresía solo se
// activa la primera vez que esta fila pasa a 'succeeded' (ver
// payment-webhook.controller.ts). `provider` + `providerReference` es
// agnóstico: para Stripe, providerReference es el PaymentIntent id; para
// Wompi, es la `reference` que nosotros mismos generamos al armar el cobro.
export const membershipPayments = pgTable('membership_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  clientType: text('client_type').notNull(),
  durationMonths: integer('duration_months').notNull(),
  // Snapshot de lo comprado — solo Presencial. Se usa para setear
  // sessionsTotal/sessionsRemaining al activar (ver activatePaidPlan).
  packageSize: integer('package_size'),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  provider: text('provider').notNull(), // 'wompi' | 'stripe'
  providerReference: text('provider_reference').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'succeeded' | 'failed'
  // Aprobación diferenciada (ver payment-webhook.controller.ts): un pago
  // 'succeeded' de un cliente sin membresía paga previa NO se activa solo —
  // queda con requiresApproval=true hasta que un admin lo apruebe
  // (POST .../approve), que recién ahí setea appliedAt. Para un cliente ya
  // activo en un tier pagable (upgrade/renovación), succeededAt y appliedAt
  // quedan prácticamente iguales — el webhook hace ambas cosas de una.
  requiresApproval: boolean('requires_approval').notNull().default(false),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  // Auditoría del puente TRM (Elite vía Wompi mientras no haya Stripe) — ver
  // trm.service.ts. null para cualquier pago que no use el puente.
  trmUsed: numeric('trm_used'),
  trmDate: date('trm_date'),
  marginApplied: numeric('margin_applied'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  succeededAt: timestamp('succeeded_at', { withTimezone: true }),
}, (table) => ({
  clientIdIdx: index('membership_payments_client_id_idx').on(table.clientId),
  providerReferenceUnique: unique().on(table.provider, table.providerReference),
}));
export type MembershipPayment = typeof membershipPayments.$inferSelect;

export const blindspotCases = pgTable('blindspot_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Numeración secuencial visible en todos los paneles como "#N" — se asigna
  // sola en orden de creación vía secuencia de Postgres, nunca se elige a mano.
  caseNumber: serial('case_number').notNull(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  therapistId: uuid('therapist_id').references(() => therapists.id),
  status: text('status').notNull().default('evaluando'), // evaluando | referido | en_proceso | cerrado
  initialAssessment: jsonb('initial_assessment').notNull().default({}), // { motivoConsulta, areaPercibida, prioridad }
  adminPrivateNotes: text('admin_private_notes'), // SOLO visible para admin, nunca al terapeuta ni al cliente
  crisisFlag: boolean('crisis_flag').notNull().default(false),
  crisisFlaggedAt: timestamp('crisis_flagged_at', { withTimezone: true }),
  crisisFlaggedBy: text('crisis_flagged_by'), // 'cliente' | 'terapeuta' | 'admin'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdIdx: index('blindspot_cases_client_id_idx').on(table.clientId),
}));

export const blindspotTasks = pgTable('blindspot_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => blindspotCases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  status: text('status').notNull().default('pendiente'), // pendiente | completada | omitida
  createdBy: uuid('created_by').notNull().references(() => therapists.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const blindspotSessionLogs = pgTable('blindspot_session_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => blindspotCases.id, { onDelete: 'cascade' }),
  sessionDate: date('session_date').notNull(),
  progressMarker: text('progress_marker').notNull(), // avance | estable | retroceso | cerrado
  internalSummary: text('internal_summary'), // privado: terapeuta + admin, sin detalle clínico sensible
  clientNote: text('client_note'), // opcional, corto, visible al cliente
  createdBy: uuid('created_by').notNull().references(() => therapists.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Therapist = typeof therapists.$inferSelect;
export type BlindspotCase = typeof blindspotCases.$inferSelect;
export type BlindspotTask = typeof blindspotTasks.$inferSelect;
export type BlindspotSessionLog = typeof blindspotSessionLogs.$inferSelect;
export type LabPanel = typeof labPanels.$inferSelect;

// Catálogo de módulos de la app — de acá sale cada fila de la matriz de
// "Roles y Perfiles". `isCustom` distingue los 9 módulos base (sembrados por
// la migración manual) de los que un admin agregue después desde la UI.
export const permissionModules = pgTable('permission_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  isCustom: boolean('is_custom').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Matriz tipo-de-cliente × módulo — reemplaza las reglas de acceso que hoy
// están hardcodeadas en el código (ver require-permission.middleware.ts).
// Es la capa "general" por tipo; el permiso individual por cliente
// (clients.permissions) sigue siendo la capa fina que se auto-activa al
// asignar contenido — ambas se combinan, ninguna reemplaza a la otra.
export const clientTypeModulePermissions = pgTable('client_type_module_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientType: text('client_type').notNull(),
  moduleKey: text('module_key').notNull().references(() => permissionModules.key, { onDelete: 'cascade' }),
  allowed: boolean('allowed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientTypeModuleUnique: unique('client_type_module_unique').on(table.clientType, table.moduleKey),
}));

export type PermissionModule = typeof permissionModules.$inferSelect;
export type ClientTypeModulePermission = typeof clientTypeModulePermissions.$inferSelect;

// Historial semanal del Índice de bienestar (home + Mi Evolución, mismo
// valor en los dos lugares). Se recalcula/upsertea al cargar cualquiera de
// esas dos pantallas — sin cron — usando el lunes de la semana ISO vigente
// como period_start; la fila de la semana anterior es la base del delta.
export const wellnessIndexHistory = pgTable('wellness_index_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  value: integer('value').notNull(),
  componentsUsed: jsonb('components_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientPeriodUnique: unique('wellness_index_history_client_id_period_start_unique').on(table.clientId, table.periodStart),
}));

export type WellnessIndexHistoryRow = typeof wellnessIndexHistory.$inferSelect;