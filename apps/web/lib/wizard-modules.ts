import type { WizardModuleConfig, ConditionalRule } from '@latribu/shared-types';

// Espejo tipado de ONBOARDING_MODULES (index.html:1110-1210). Fuente única
// de verdad para el renderizado (WizardField), la validación
// (validateWizardModule) y las reglas condicionales (CONDITIONAL_RULES) —
// no duplicar esta lista en ningún otro archivo.
export const WIZARD_MODULES: WizardModuleConfig[] = [
  { n: 1, title: 'Perfil Personal', custom: 'country', fields: [
    { id: 'birthdate', label: 'Fecha de nacimiento', type: 'date', required: true },
    { id: 'gender', label: 'Género', type: 'select', options: ['Masculino', 'Femenino', 'Otro'], required: true },
    { id: 'occupation', label: 'Ocupación', type: 'text', required: true },
    { id: 'marital_status', label: 'Estado civil', type: 'select', options: ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a'], required: true },
  ]},
  { n: 2, title: 'Vida Profesional', fields: [
    { id: 'work_hours', label: '¿Horas de trabajo al día?', type: 'chevron', min: 0, required: true },
    { id: 'cognitive_demand', label: '¿Demanda cognitiva (1-10)?', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'travel', label: '¿Con qué frecuencia viajas por trabajo?', type: 'select', options: ['Nunca', '1-2 veces al mes', 'Semanal', 'Muy frecuente'], required: true },
    { id: 'work_place', label: '¿Dónde trabajas principalmente?', type: 'select', options: ['Oficina', 'Remoto', 'Híbrido', 'Campo/Obra'], required: true },
    { id: 'time_control', label: '¿Tienes control sobre tu horario?', type: 'select', options: ['Alto', 'Medio', 'Bajo'], required: true },
  ]},
  { n: 3, title: 'Composición Corporal', custom: 'body', fields: [] },
  { n: 4, title: 'Historial de Salud', fields: [
    { id: 'condition', label: 'Condición médica diagnosticada', type: 'select', options: ['Ninguna', 'Diabetes', 'Hipertensión', 'Hipotiroidismo', 'Síndrome metabólico', 'PCOS', 'Otra'], required: true },
    { id: 'condition_other', label: 'Especifica la condición médica', type: 'text', required: true },
    { id: 'meds', label: '¿Tomas medicamentos actualmente?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'meds_detail', label: '¿Para qué te lo recetaron?', type: 'text', required: true },
    { id: 'allergies', label: 'Alergias', type: 'text', required: true },
    { id: 'injury', label: 'Pre existencias medicas o Lesiones', type: 'text', required: true },
    { id: 'intervention_surgery', label: '¿Intervenciones quirúrgicas?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'intervention_surgery_detail', label: 'Describe la intervención quirúrgica', type: 'text', required: true },
    { id: 'last_checkup', label: 'Último chequeo médico', type: 'select', options: ['Menos de 6 meses', '1 año', '2+ años', 'Nunca'], required: true },
    { id: 'checkup_file', label: 'Subir chequeo médico', type: 'file' },
    { id: 'checkup_notes', label: 'Observaciones del chequeo', type: 'textarea', required: true },
    { id: 'mental_health', label: 'Salud mental diagnosticada', type: 'select', options: ['Sin diagnóstico', 'Ansiedad', 'Depresión', 'TDAH', 'Burnout', 'Otro'], required: true },
    { id: 'mental_health_other', label: 'Especifica la salud mental', type: 'text', required: true },
    { id: 'medical_clearance', label: '¿Tienes autorización médica para entrenar?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'goal_reasons', label: 'Escribe 3 razones por las que quieres alcanzar tu objetivo', type: 'textarea', required: true },
  ]},
  { n: 5, title: 'Alimentación', fields: [
    { id: 'meals_per_day', label: '¿Cuántas comidas haces al día?', type: 'segmented', min: 1, max: 6, required: true },
    { id: 'first_meal', label: '¿A qué hora es tu primera comida?', type: 'time', required: true },
    { id: 'last_meal', label: '¿A qué hora es tu última comida?', type: 'time', required: true },
    { id: 'water_liters', label: '¿Cuántos litros de agua tomas al día?', type: 'chevron', min: 0, step: 0.5, required: true },
    { id: 'proteins', label: 'Proteínas que más consumes', type: 'chips', options: ['Pollo', 'Res', 'Pescado', 'Pavo', 'Cerdo', 'Huevo', 'Soja', 'Yogur griego', 'Proteína en polvo', 'Otro'], required: true },
    { id: 'carbs', label: 'Carbohidratos que más consumes', type: 'chips', options: ['Arroz', 'Avena', 'Pan integral', 'Quinoa', 'Pasta', 'Arepa', 'Papa', 'Batata', 'Yuca', 'Plátano', 'Fruta', 'Legumbres', 'Otro'], required: true },
    { id: 'fats', label: 'Grasas que más consumes', type: 'chips', options: ['Aguacate', 'Aceitunas', 'Frutos secos', 'Semillas de chía', 'Aceite de oliva', 'Mantequilla de almendras', 'Otro'], required: true },
    { id: 'breakfast_example', label: 'Describe cómo se ve tu desayuno', type: 'textarea', required: true },
    { id: 'snack_example', label: 'Describe cómo se ven tus snacks', type: 'textarea', required: true },
    { id: 'lunch_example', label: 'Describe cómo se ve tu almuerzo', type: 'textarea', required: true },
    { id: 'dinner_example', label: 'Describe cómo se ve tu cena', type: 'textarea', required: true },
    { id: 'menu_variety', label: '¿Prefieres comer el mismo menú todos los días o tener varios menús disponibles?', type: 'select', options: ['Prefiero el mismo menú todos los días', 'Prefiero tener varios menús para variar'], required: true },
    { id: 'weighing_food', label: '¿Se te da mejor pesar la comida diariamente o prefieres ser más flexible y guiarte por porciones?', type: 'select', options: ['Prefiero pesar la comida diariamente', 'Prefiero ser flexible y guiarme por porciones'], required: true },
    { id: 'favorite_fruits', label: '¿Cuáles son tus 3 frutas preferidas?', type: 'text', required: true },
    { id: 'anxiety_food', label: '¿Con qué te alimentas cuando tienes ansiedad?', type: 'text', required: true },
    { id: 'dairy', label: 'Tolerancia a lácteos', type: 'select', options: ['Sin problema', 'Leve intolerancia', 'Intolerante', 'No consumo'], required: true },
    { id: 'probiotics', label: '¿Consumes probióticos?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'probiotics_types', label: '¿Cuáles probióticos?', type: 'chips', options: ['Yogur griego', 'Kéfir', 'Kombucha', 'Suplemento', 'Otro'], required: true },
    { id: 'eating_out', label: '¿Cuántas veces comes por fuera?', type: 'select', options: ['Nunca', '1-2 veces/semana', '3+ veces/semana', 'Diario'], required: true },
    { id: 'snacks', label: 'Consumo de snacks entre comidas', type: 'select', options: ['Nunca', 'A veces', 'Siempre'], required: true },
    { id: 'snacks_qty', label: 'Cantidad de snacks diarios', type: 'segmented', min: 0, max: 5, required: true },
    { id: 'caffeine_cups', label: 'Tazas de café/cafeína al día', type: 'segmented', min: 0, max: 6, required: true },
    { id: 'last_coffee', label: 'Hora del último café', type: 'time', required: true },
    { id: 'alcohol', label: 'Consumo de alcohol', type: 'select', options: ['Nunca', 'Ocasional', '1-2x semana', '3+ veces semana'], required: true },
    { id: 'alcohol_type', label: 'Tipo de alcohol', type: 'text', required: true },
    { id: 'diet_type', label: 'Tipo de dieta', type: 'select', options: ['Omnívoro', 'Vegetariano', 'Vegano', 'Keto', 'Paleo', 'Otra'], required: true },
    { id: 'fasting', label: '¿Practicas ayuno intermitente?', type: 'select', options: ['No', '16/8', '18/6', '20/4', '24h', 'Otro'], required: true },
    { id: 'ultraproc', label: 'Consumo de ultraprocesados', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true },
    { id: 'veggies', label: 'Consumo de verduras', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true },
    { id: 'supps_active', label: '¿Tomas suplementos actualmente?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'supps_list', label: '¿Cuáles suplementos?', type: 'chips', options: ['Proteína', 'Creatina', 'Omega 3', 'Vitamina D', 'Magnesio', 'Zinc', 'B12', 'Colágeno', 'Otro'], required: true },
    { id: 'substances', label: 'Consumo de otras sustancias', type: 'select', options: ['No', 'Tabaco', 'Alcohol frecuente', 'Cannabis', 'Esteroides', 'Otra'], required: true },
    { id: 'substances_detail', label: 'Especifica', type: 'text', required: true },
    { id: 'substances_frequency', label: '¿Con qué frecuencia lo consumes?', type: 'select', options: ['Una vez a la semana', '2-3 veces a la semana', 'Casi todos los días', 'Diario'], required: true },
  ]},
  { n: 6, title: 'Sueño', fields: [
    { id: 'sleep_hours', label: 'Horas de sueño promedio', type: 'chevron', min: 0, step: 0.5, required: true },
    { id: 'bedtime', label: 'Hora de dormir', type: 'time', required: true },
    { id: 'wakeup', label: 'Hora de despertar', type: 'time', required: true },
    { id: 'sleep_quality', label: 'Calidad del sueño (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'wakeups', label: 'Despertares nocturnos', type: 'select', options: ['Ninguno', '1-2', '3+'], required: true },
  ]},
  { n: 7, title: 'Energía y Cognición', fields: [
    { id: 'energy_am', label: 'Energía en la mañana (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'energy_pm', label: 'Energía en la tarde (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'brain_fog', label: 'Niebla mental', type: 'select', options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'], required: true },
    { id: 'focus_time', label: 'Tiempo de foco sostenido', type: 'select', options: ['<15min', '15-30min', '30-60min', '>1h'], required: true },
    { id: 'memory', label: '¿Sientes la memoria afectada?', type: 'select', options: ['Sí notablemente', 'Un poco', 'No'], required: true },
  ]},
  { n: 8, title: 'Estrés y Emociones', fields: [
    { id: 'stress_level', label: 'Nivel de estrés crónico (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Bajo', maxLabel: 'Alto', required: true },
    { id: 'anxiety', label: 'Frecuencia de ansiedad', type: 'select', options: ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Diario'], required: true },
    { id: 'mood', label: 'Estado de ánimo general', type: 'select', options: ['Estable', 'Variable', 'Generalmente bajo', 'Generalmente alto'], required: true },
    { id: 'coping_techniques', label: 'Técnicas de manejo del estrés que usas', type: 'text', required: true },
    { id: 'work_life_balance', label: '¿El trabajo invade tu vida personal?', type: 'select', options: ['No', 'A veces', 'Frecuentemente', 'Siempre'], required: true },
  ]},
  { n: 9, title: 'Entrenamiento Físico', fields: [
    { id: 'active', label: '¿Has realizado alguna vez actividad física?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'activity_level', label: 'A qué nivel', type: 'select', options: ['Básico', 'Intermedio', 'Avanzado'], required: true },
    { id: 'activity_time', label: 'Durante cuánto tiempo', type: 'text', required: true },
    { id: 'sports_active', label: 'Actualmente practicas algún deporte o haces actividad física', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'sports_detail', label: '¿Cuál deporte o actividad practicas?', type: 'text', required: true },
    { id: 'training_place', label: '¿En qué lugar vas a entrenar actualmente?', type: 'select', options: ['Gimnasio', 'Casa', 'Aire libre', 'Otro'], required: true },
    { id: 'training_schedule', label: '¿En qué horario?', type: 'text', required: true },
    { id: 'training_days', label: '¿Cuántos días a la semana?', type: 'segmented', min: 1, max: 7, required: true },
    { id: 'goals', label: 'Objetivos principales', type: 'text', required: true },
  ]},
];

// Módulo 10 — Dispositivos y Laboratorios. Puerto de BIO360Index.html
// (renderInfoModule10) — solo visible para clientes tipo "mentoring"
// (ver WizardShell, que lo agrega a WIZARD_MODULES condicionalmente).
export const WIZARD_MODULE_10: WizardModuleConfig = {
  n: 10, title: 'Dispositivos y Laboratorios', custom: 'devices', fields: [],
};

// Puerto fiel de las reglas de `initFieldDependencies` (index.html:1472-1485).
export const CONDITIONAL_RULES: ConditionalRule[] = [
  { id: 'condition', value: 'Otra', target: 'condition_other' },
  { id: 'mental_health', value: 'Otro', target: 'mental_health_other' },
  { id: 'snacks', values: ['A veces', 'Siempre'], target: 'snacks_qty' },
  { id: 'alcohol', notValue: 'Nunca', target: 'alcohol_type' },
  { id: 'substances', value: 'Otra', target: 'substances_detail' },
  { id: 'substances', values: ['Tabaco', 'Alcohol frecuente', 'Cannabis', 'Esteroides'], target: 'substances_frequency' },
  { id: 'supps_active', value: 'Sí', target: 'supps_list' },
  { id: 'probiotics', value: 'Sí', target: 'probiotics_types' },
  { id: 'sports_active', value: 'Sí', target: 'sports_detail' },
  { id: 'intervention_surgery', value: 'Sí', target: 'intervention_surgery_detail' },
  { id: 'meds', value: 'Sí', target: 'meds_detail' },
];
