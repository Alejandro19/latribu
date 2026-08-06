import { pgTable, uuid, text, boolean, integer, date, jsonb, timestamp, numeric } from 'drizzle-orm/pg-core';

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
  status: text('status').notNull().default('active'),
  plan: text('plan').notNull().default('Miembro'),
  clientType: text('client_type').notNull().default('lead_wellness'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('onboarding_complete'),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export const personalInfo = pgTable('personal_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  birthdate: date('birthdate'),
  gender: text('gender'),
  occupation: text('occupation'),
  country: text('country'),
  city: text('city'),
  phoneCode: text('phone_code').default('+52'),
  phoneNumber: text('phone_number'),
  maritalStatus: text('marital_status'),
  weight: numeric('weight', { precision: 5, scale: 1 }).$type<number>(),
  height: numeric('height', { precision: 5, scale: 1 }).$type<number>(),
  bodyFat: numeric('body_fat', { precision: 4, scale: 1 }).$type<number>(),
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
});

export const progressPhotos = pgTable('progress_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  anthropometricRecordId: uuid('anthropometric_record_id').references(() => anthropometricRecords.id, { onDelete: 'cascade' }),
  angle: text('angle'),
  photoUrl: text('photo_url').notNull(),
  fecha: date('fecha').notNull().defaultNow(),
  mesNum: integer('mes_num'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

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
});

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
});

export const trainingCompletions = pgTable('training_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  completedDate: date('completed_date').notNull().defaultNow(),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clientNotifications = pgTable('client_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

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
});

export const achievementLogs = pgTable('achievement_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  weekNumber: integer('week_number').notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow(),
});

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
});

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
});

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const cortisolCompletions = pgTable('cortisol_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  techniqueId: uuid('technique_id').references(() => cortisolTechniques.id, { onDelete: 'set null' }),
  completedDate: date('completed_date').notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const cortisolCheckins = pgTable('cortisol_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  emotion: text('emotion').notNull(),
  checkinDate: date('checkin_date').notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const cortisolTips = pgTable('cortisol_tips', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type CortisolTechnique = typeof cortisolTechniques.$inferSelect;
export type CortisolCompletion = typeof cortisolCompletions.$inferSelect;
export type CortisolCheckin = typeof cortisolCheckins.$inferSelect;
export type CortisolTip = typeof cortisolTips.$inferSelect;

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
});

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
});

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
});

export type CommunityEvent = typeof communityEvents.$inferSelect;
export type EventReservation = typeof eventReservations.$inferSelect;
export type CommunityTherapy = typeof communityTherapies.$inferSelect;
export type TherapyReservation = typeof therapyReservations.$inferSelect;

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
});

export const personalRecords = pgTable('personal_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(),
  initialValue: text('initial_value'),
  currentValue: text('current_value'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

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
});

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
});

export const labPanels = pgTable('lab_panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  semanaNumero: integer('semana_numero').notNull(), // 0, 6, 12
  fecha: date('fecha'),
  datos: jsonb('datos').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type WearableToken = typeof wearableTokens.$inferSelect;
export type WearableMetrica = typeof wearableMetricas.$inferSelect;
export type LabPanel = typeof labPanels.$inferSelect;