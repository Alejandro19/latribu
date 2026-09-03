import type { WizardModuleConfig, ConditionalRule } from '@latribu/shared-types';
import {
  IconUser,
  IconCalendar,
  IconMapPin,
  IconBriefcase,
  IconBrain,
  IconHeartPulse,
  IconClipboardCheck,
  IconUtensils,
  IconApple,
  IconListCheck,
  IconDroplet,
  IconCoffee,
  IconWine,
  IconLeaf,
  IconPill,
  IconMoon,
  IconActivity,
  IconScale,
  IconTarget,
} from '../components/ui/icons';

// Espejo tipado de ONBOARDING_MODULES (index.html:1110-1210). Fuente única
// de verdad para el renderizado (WizardField), la validación
// (validateWizardModule) y las reglas condicionales (CONDITIONAL_RULES) —
// no duplicar esta lista en ningún otro archivo. `group` es metadata
// puramente de presentación (agrupación en cards estilo Oura, ver
// WizardShell) — campos contiguos con el mismo `group` van en una sola
// card; no afecta validación ni reglas condicionales.
export const WIZARD_MODULES: WizardModuleConfig[] = [
  // Orden de importancia pedido explícitamente: nombre, tipo y número de
  // identificación, género, edad, nacimiento, correo, país/ciudad (el picker
  // de `custom: 'country'` ya no se renderiza fijo arriba — el field
  // sentinela 'country-picker' lo ubica exactamente donde le corresponde en
  // esta lista, ver WizardShell), ocupación y estado civil al final.
  { n: 1, title: 'Perfil Personal', custom: 'country', fields: [
    { id: 'name', label: 'Nombre completo', type: 'text', required: true, group: 'Identidad' },
    { id: 'id_type', label: 'Identificación', type: 'select', options: ['Cédula de ciudadanía', 'Cédula de extranjería', 'Tarjeta de identidad', 'Pasaporte', 'Otro'], required: true, group: 'Identidad' },
    { id: 'cedula', label: 'Número de identificación', type: 'text', required: true, group: 'Identidad' },
    { id: 'gender', label: 'Género', type: 'select', options: ['Masculino', 'Femenino', 'Otro'], required: true, group: 'Datos personales' },
    { id: 'age', label: 'Edad', type: 'text', required: true, group: 'Datos personales' },
    { id: 'birthdate', label: 'Fecha de nacimiento', type: 'date', required: true, group: 'Datos personales' },
    { id: 'marital_status', label: 'Estado civil', type: 'select', options: ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a'], required: true, group: 'Datos personales' },
    { id: 'email', label: 'Correo electrónico', type: 'text', required: true, group: 'Contacto' },
    { id: 'country_picker', label: 'País, ciudad y celular', type: 'country-picker', group: 'Contacto' },
    { id: 'occupation', label: 'Ocupación', type: 'text', required: true, group: 'Ocupación' },
    // Salud hormonal — P1 visible para todas las clientas (gender=Femenino,
    // ver CONDITIONAL_RULES), recomendado para todos los tiers. P2/P3 además
    // requieren onlyVariant: 'mentoring' — solo el motor de insights de
    // Mentoría hace algo con la fecha/duración de ciclo (ver Baseline en
    // Matriz_Reglas_Mentoria_BIO360.md).
    { id: 'hormonal_status', label: '¿Cuál describe mejor tu situación hormonal actual?', type: 'select', options: ['Ciclo menstrual natural y regular', 'Ciclo menstrual natural pero irregular', 'Uso método anticonceptivo hormonal', 'Perimenopausia', 'Posmenopausia', 'Embarazada o en lactancia', 'Prefiero no decir'], required: true, group: 'Salud hormonal' },
    { id: 'hormonal_status_other', label: '¿Qué método anticonceptivo usas?', type: 'text', required: true, group: 'Salud hormonal' },
    { id: 'last_period_date', label: 'Fecha de inicio de tu último período menstrual', type: 'date', required: true, group: 'Salud hormonal' },
    { id: 'cycle_length_days', label: 'Duración promedio de tu ciclo (en días)', type: 'chevron', min: 15, max: 45, required: false, group: 'Salud hormonal' },
  ]},
  { n: 2, title: 'Vida Profesional', fields: [
    { id: 'work_hours', label: '¿Horas de trabajo al día?', type: 'chevron', min: 0, required: true, group: 'Trabajo y horario' },
    { id: 'work_place', label: '¿Dónde trabajas principalmente?', type: 'select', options: ['Oficina', 'Remoto', 'Híbrido', 'Campo/Obra'], required: true, group: 'Trabajo y horario' },
    { id: 'time_control', label: '¿Tienes control sobre tu horario?', type: 'select', options: ['Alto', 'Medio', 'Bajo'], required: true, group: 'Trabajo y horario' },
    { id: 'cognitive_demand', label: '¿Demanda cognitiva (1-10)?', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true, group: 'Exigencia laboral' },
    { id: 'travel', label: '¿Con qué frecuencia viajas por trabajo?', type: 'select', options: ['Nunca', '1-2 veces al mes', 'Semanal', 'Muy frecuente'], required: true, group: 'Exigencia laboral' },
  ]},
  { n: 3, title: 'Composición Corporal', custom: 'body', fields: [] },
  { n: 4, title: 'Historial de Salud', fields: [
    { id: 'condition', label: 'Condición médica diagnosticada', type: 'select', options: ['Ninguna', 'Diabetes', 'Hipertensión', 'Hipotiroidismo', 'Síndrome metabólico', 'PCOS', 'Otra'], required: true, group: 'Condición médica' },
    { id: 'condition_other', label: 'Especifica la condición médica', type: 'text', required: true, group: 'Condición médica' },
    { id: 'meds', label: '¿Tomas medicamentos actualmente?', type: 'select', options: ['No', 'Sí'], required: true, group: 'Condición médica' },
    { id: 'meds_detail', label: '¿Para qué te lo recetaron?', type: 'text', required: true, group: 'Condición médica' },
    { id: 'allergies', label: 'Alergias', type: 'text', required: true, group: 'Antecedentes' },
    { id: 'injury', label: 'Pre existencias medicas o Lesiones', type: 'text', required: true, group: 'Antecedentes' },
    { id: 'intervention_surgery', label: '¿Intervenciones quirúrgicas?', type: 'select', options: ['No', 'Sí'], required: true, group: 'Antecedentes' },
    { id: 'intervention_surgery_detail', label: 'Describe la intervención quirúrgica', type: 'text', required: true, group: 'Antecedentes' },
    { id: 'last_checkup', label: 'Último chequeo médico', type: 'select', options: ['Menos de 6 meses', '1 año', '2+ años', 'Nunca'], required: true, group: 'Chequeo médico' },
    { id: 'checkup_file', label: 'Subir chequeo médico', type: 'file', group: 'Chequeo médico' },
    { id: 'checkup_notes', label: 'Observaciones del chequeo', type: 'textarea', required: true, group: 'Chequeo médico' },
    { id: 'medical_clearance', label: '¿Tienes autorización médica para entrenar?', type: 'select', options: ['No', 'Sí'], required: true, group: 'Chequeo médico' },
    { id: 'mental_health', label: 'Salud mental diagnosticada', type: 'select', options: ['Sin diagnóstico', 'Ansiedad', 'Depresión', 'TDAH', 'Burnout', 'Otro'], required: true, group: 'Salud mental y motivación' },
    { id: 'mental_health_other', label: 'Especifica la salud mental', type: 'text', required: true, group: 'Salud mental y motivación' },
    { id: 'goal_reasons', label: 'Escribe 3 razones por las que quieres alcanzar tu objetivo', type: 'textarea', required: true, group: 'Salud mental y motivación' },
  ]},
  { n: 5, title: 'Alimentación', fields: [
    { id: 'meals_per_day', label: '¿Cuántas comidas haces al día?', type: 'segmented', min: 1, max: 6, required: true, group: 'Rutina de comidas' },
    { id: 'first_meal', label: '¿A qué hora es tu primera comida?', type: 'time', required: true, group: 'Rutina de comidas' },
    { id: 'last_meal', label: '¿A qué hora es tu última comida?', type: 'time', required: true, group: 'Rutina de comidas' },
    { id: 'water_liters', label: '¿Cuántos litros de agua tomas al día?', type: 'chevron', min: 0, step: 0.5, required: true, group: 'Rutina de comidas' },
    { id: 'proteins', label: 'Proteínas que más consumes', type: 'chips', options: ['Pollo', 'Res', 'Pescado', 'Pavo', 'Cerdo', 'Huevo', 'Soja', 'Yogur griego', 'Proteína en polvo', 'Otro'], required: true, group: 'Macronutrientes' },
    { id: 'carbs', label: 'Carbohidratos que más consumes', type: 'chips', options: ['Arroz', 'Avena', 'Pan integral', 'Quinoa', 'Pasta', 'Arepa', 'Papa', 'Batata', 'Yuca', 'Plátano', 'Fruta', 'Legumbres', 'Otro'], required: true, group: 'Macronutrientes' },
    { id: 'fats', label: 'Grasas que más consumes', type: 'chips', options: ['Aguacate', 'Aceitunas', 'Frutos secos', 'Semillas de chía', 'Aceite de oliva', 'Mantequilla de almendras', 'Otro'], required: true, group: 'Macronutrientes' },
    { id: 'breakfast_example', label: 'Describe cómo se ve tu desayuno', type: 'textarea', required: true, group: 'Ejemplo de un día' },
    { id: 'snack_example', label: 'Describe cómo se ven tus snacks', type: 'textarea', required: true, group: 'Ejemplo de un día' },
    { id: 'lunch_example', label: 'Describe cómo se ve tu almuerzo', type: 'textarea', required: true, group: 'Ejemplo de un día' },
    { id: 'dinner_example', label: 'Describe cómo se ve tu cena', type: 'textarea', required: true, group: 'Ejemplo de un día' },
    { id: 'menu_variety', label: '¿Prefieres comer el mismo menú todos los días o tener varios menús disponibles?', type: 'select', options: ['Prefiero el mismo menú todos los días', 'Prefiero tener varios menús para variar'], required: true, group: 'Preferencias de plan' },
    { id: 'weighing_food', label: '¿Se te da mejor pesar la comida diariamente o prefieres ser más flexible y guiarte por porciones?', type: 'select', options: ['Prefiero pesar la comida diariamente', 'Prefiero ser flexible y guiarme por porciones'], required: true, group: 'Preferencias de plan' },
    { id: 'favorite_fruits', label: '¿Cuáles son tus 3 frutas preferidas?', type: 'text', required: true, group: 'Preferencias de plan' },
    { id: 'anxiety_food', label: '¿Con qué te alimentas cuando tienes ansiedad?', type: 'text', required: true, group: 'Preferencias de plan' },
    { id: 'dairy', label: 'Tolerancia a lácteos', type: 'select', options: ['Sin problema', 'Leve intolerancia', 'Intolerante', 'No consumo'], required: true, group: 'Lácteos y probióticos' },
    { id: 'probiotics', label: '¿Consumes probióticos?', type: 'select', options: ['Sí', 'No'], required: true, group: 'Lácteos y probióticos' },
    { id: 'probiotics_types', label: '¿Cuáles probióticos?', type: 'chips', options: ['Yogur griego', 'Kéfir', 'Kombucha', 'Suplemento', 'Otro'], required: true, group: 'Lácteos y probióticos' },
    { id: 'eating_out', label: '¿Cuántas veces comes por fuera?', type: 'select', options: ['Nunca', '1-2 veces/semana', '3+ veces/semana', 'Diario'], required: true, group: 'Hábitos fuera de casa' },
    { id: 'snacks', label: 'Consumo de snacks entre comidas', type: 'select', options: ['Nunca', 'A veces', 'Siempre'], required: true, group: 'Hábitos fuera de casa' },
    { id: 'snacks_qty', label: 'Cantidad de snacks diarios', type: 'segmented', min: 0, max: 5, required: true, group: 'Hábitos fuera de casa' },
    { id: 'caffeine_cups', label: 'Tazas de café/cafeína al día', type: 'segmented', min: 0, max: 6, required: true, group: 'Hábitos fuera de casa' },
    { id: 'last_coffee', label: 'Hora del último café', type: 'time', required: true, group: 'Hábitos fuera de casa' },
    { id: 'alcohol', label: 'Consumo de alcohol', type: 'select', options: ['Nunca', 'Ocasional', '1-2x semana', '3+ veces semana'], required: true, group: 'Alcohol y dieta' },
    { id: 'alcohol_type', label: 'Tipo de alcohol', type: 'text', required: true, group: 'Alcohol y dieta' },
    { id: 'diet_type', label: 'Tipo de dieta', type: 'select', options: ['Omnívoro', 'Vegetariano', 'Vegano', 'Keto', 'Paleo', 'Otra'], required: true, group: 'Alcohol y dieta' },
    { id: 'fasting', label: '¿Practicas ayuno intermitente?', type: 'select', options: ['No', '16/8', '18/6', '20/4', '24h', 'Otro'], required: true, group: 'Alcohol y dieta' },
    { id: 'ultraproc', label: 'Consumo de ultraprocesados', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true, group: 'Calidad de alimentación' },
    { id: 'veggies', label: 'Consumo de verduras', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true, group: 'Calidad de alimentación' },
    { id: 'supps_active', label: '¿Tomas suplementos actualmente?', type: 'select', options: ['Sí', 'No'], required: true, group: 'Suplementos y sustancias' },
    { id: 'supps_list', label: '¿Cuáles suplementos?', type: 'chips', options: ['Proteína', 'Creatina', 'Omega 3', 'Vitamina D', 'Magnesio', 'Zinc', 'B12', 'Colágeno', 'Otro'], required: true, group: 'Suplementos y sustancias' },
    { id: 'substances', label: 'Consumo de otras sustancias', type: 'select', options: ['No', 'Tabaco', 'Alcohol frecuente', 'Cannabis', 'Esteroides', 'Otra'], required: true, group: 'Suplementos y sustancias' },
    { id: 'substances_detail', label: 'Especifica', type: 'text', required: true, group: 'Suplementos y sustancias' },
    { id: 'substances_frequency', label: '¿Con qué frecuencia lo consumes?', type: 'select', options: ['Una vez a la semana', '2-3 veces a la semana', 'Casi todos los días', 'Diario'], required: true, group: 'Suplementos y sustancias' },
  ]},
  { n: 6, title: 'Sueño', fields: [
    { id: 'sleep_hours', label: 'Horas de sueño promedio', type: 'chevron', min: 0, step: 0.5, required: true, group: 'Horario de sueño' },
    { id: 'bedtime', label: 'Hora de dormir', type: 'time', required: true, group: 'Horario de sueño' },
    { id: 'wakeup', label: 'Hora de despertar', type: 'time', required: true, group: 'Horario de sueño' },
    { id: 'sleep_quality', label: 'Calidad del sueño (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true, group: 'Calidad del descanso' },
    { id: 'wakeups', label: 'Despertares nocturnos', type: 'select', options: ['Ninguno', '1-2', '3+'], required: true, group: 'Calidad del descanso' },
    // Alimentan SUE-07 (alerta de posible apnea) — todos los tiers, se
    // re-preguntan cada 6-12 meses (no es un dato estático de una sola vez).
    { id: 'snores', label: '¿Roncas con frecuencia mientras duermes?', type: 'select', options: ['Sí', 'No', 'No sé (duermo solo/a)'], required: true, group: 'Calidad del descanso' },
    { id: 'sleep_apnea_signs', label: '¿Alguien te ha comentado que dejas de respirar o haces pausas al dormir?', type: 'select', options: ['Sí', 'No', 'No sé'], required: true, group: 'Calidad del descanso' },
  ]},
  { n: 7, title: 'Energía y Cognición', fields: [
    { id: 'energy_am', label: 'Energía en la mañana (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true, group: 'Niveles de energía' },
    { id: 'energy_pm', label: 'Energía en la tarde (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true, group: 'Niveles de energía' },
    { id: 'brain_fog', label: 'Niebla mental', type: 'select', options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'], required: true, group: 'Claridad mental' },
    { id: 'focus_time', label: 'Tiempo de foco sostenido', type: 'select', options: ['<15min', '15-30min', '30-60min', '>1h'], required: true, group: 'Claridad mental' },
    { id: 'memory', label: '¿Sientes la memoria afectada?', type: 'select', options: ['Sí notablemente', 'Un poco', 'No'], required: true, group: 'Claridad mental' },
  ]},
  { n: 8, title: 'Estrés y Emociones', fields: [
    { id: 'stress_level', label: 'Nivel de estrés crónico (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Bajo', maxLabel: 'Alto', required: true, group: 'Estrés' },
    { id: 'anxiety', label: 'Frecuencia de ansiedad', type: 'select', options: ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Diario'], required: true, group: 'Estrés' },
    { id: 'mood', label: 'Estado de ánimo general', type: 'select', options: ['Estable', 'Variable', 'Generalmente bajo', 'Generalmente alto'], required: true, group: 'Estrés' },
    { id: 'coping_techniques', label: 'Técnicas de manejo del estrés que usas', type: 'text', required: true, group: 'Manejo y balance' },
    { id: 'work_life_balance', label: '¿El trabajo invade tu vida personal?', type: 'select', options: ['No', 'A veces', 'Frecuentemente', 'Siempre'], required: true, group: 'Manejo y balance' },
  ]},
  { n: 9, title: 'Entrenamiento Físico', fields: [
    { id: 'active', label: '¿Has realizado alguna vez actividad física?', type: 'select', options: ['Sí', 'No'], required: true, group: 'Experiencia previa' },
    { id: 'activity_level', label: '¿A qué nivel?', type: 'select', options: ['Básico', 'Intermedio', 'Avanzado'], required: true, group: 'Experiencia previa' },
    { id: 'activity_time', label: '¿Durante cuánto tiempo?', type: 'text', required: true, group: 'Experiencia previa' },
    { id: 'sports_active', label: '¿Actualmente practicas algún deporte o haces actividad física?', type: 'select', options: ['Sí', 'No'], required: true, group: 'Actividad actual' },
    { id: 'sports_detail', label: '¿Cuál deporte o actividad practicas?', type: 'text', required: true, group: 'Actividad actual' },
    { id: 'training_place', label: '¿En qué lugar vas a entrenar actualmente?', type: 'select', options: ['Gimnasio', 'Casa', 'Aire libre', 'Otro'], required: true, group: 'Logística de entrenamiento' },
    { id: 'training_schedule', label: '¿En qué horario?', type: 'text', required: true, group: 'Logística de entrenamiento' },
    { id: 'training_days', label: '¿Cuántos días a la semana?', type: 'segmented', min: 1, max: 7, required: true, group: 'Logística de entrenamiento' },
    { id: 'goals', label: 'Objetivos principales', type: 'text', required: true, group: 'Objetivos' },
  ]},
];

// Ícono de línea por grupo temático (header de cada card, ver WizardShell).
// Un grupo sin entrada acá simplemente no muestra ícono.
export const WIZARD_GROUP_ICON: Record<string, (props: { size?: number; className?: string; style?: React.CSSProperties }) => React.ReactElement> = {
  'Identidad': IconUser,
  'Datos personales': IconCalendar,
  'Contacto': IconMapPin,
  'Ocupación': IconBriefcase,
  'Salud hormonal': IconDroplet,
  'Trabajo y horario': IconBriefcase,
  'Exigencia laboral': IconBrain,
  'Condición médica': IconHeartPulse,
  'Antecedentes': IconClipboardCheck,
  'Chequeo médico': IconClipboardCheck,
  'Salud mental y motivación': IconBrain,
  'Rutina de comidas': IconUtensils,
  'Macronutrientes': IconApple,
  'Ejemplo de un día': IconCalendar,
  'Preferencias de plan': IconListCheck,
  'Lácteos y probióticos': IconDroplet,
  'Hábitos fuera de casa': IconCoffee,
  'Alcohol y dieta': IconWine,
  'Calidad de alimentación': IconLeaf,
  'Suplementos y sustancias': IconPill,
  'Horario de sueño': IconMoon,
  'Calidad del descanso': IconMoon,
  'Niveles de energía': IconActivity,
  'Claridad mental': IconBrain,
  'Estrés': IconActivity,
  'Manejo y balance': IconScale,
  'Experiencia previa': IconActivity,
  'Actividad actual': IconActivity,
  'Logística de entrenamiento': IconCalendar,
  'Objetivos': IconTarget,
};

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
  { id: 'caffeine_cups', notValue: '0', target: 'last_coffee' },
  { id: 'supps_active', value: 'Sí', target: 'supps_list' },
  { id: 'probiotics', value: 'Sí', target: 'probiotics_types' },
  { id: 'sports_active', value: 'Sí', target: 'sports_detail' },
  { id: 'intervention_surgery', value: 'Sí', target: 'intervention_surgery_detail' },
  { id: 'meds', value: 'Sí', target: 'meds_detail' },
  // Salud hormonal — ver Matriz_Reglas_Mentoria_BIO360.md, pestaña Baseline.
  { id: 'gender', value: 'Femenino', target: 'hormonal_status' },
  { id: 'hormonal_status', value: 'Uso método anticonceptivo hormonal', target: 'hormonal_status_other' },
  { id: 'hormonal_status', values: ['Ciclo menstrual natural y regular', 'Ciclo menstrual natural pero irregular'], target: 'last_period_date', onlyVariant: 'mentoring' },
  { id: 'hormonal_status', values: ['Ciclo menstrual natural y regular', 'Ciclo menstrual natural pero irregular'], target: 'cycle_length_days', onlyVariant: 'mentoring' },
];
