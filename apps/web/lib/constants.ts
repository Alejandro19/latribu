// --- Navigation ---

export type NavItem = {
  key: string;
  label: string;
  visible?: (s: AppState) => boolean;
};

export type AppState = {
  role: string | null;
  clientType: string | null;
  onboardingComplete: boolean;
  planExpired: boolean;
};

export const CLIENT_NAV: NavItem[] = [
  { key: "personal-info", label: "Información Personal", visible: (s) => s.clientType !== "lead_wellness" },
  { key: "training", label: "Entrenamiento", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
  { key: "nutrition", label: "Nutrición", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
  { key: "cortisol", label: "Gestión de Cortisol", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
  { key: "rest", label: "Descanso", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
  { key: "community", label: "Comunidad", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
  { key: "evolution", label: "Mi Evolución", visible: (s) => s.clientType === "lead_wellness" ? true : s.onboardingComplete === true },
];

export const ADMIN_NAV: NavItem[] = [
  { key: "admin-hub", label: "Administración" },
  { key: "personal-info", label: "Información Personal" },
  { key: "training", label: "Entrenamiento" },
  { key: "nutrition", label: "Nutrición" },
  { key: "cortisol", label: "Gestión de Cortisol" },
  { key: "rest", label: "Descanso" },
  { key: "evolution", label: "Mi Evolución" },
  { key: "community", label: "Comunidad" },
  { key: "admin-notifications", label: "Notificaciones" },
];

export const ADMIN_HUB_SUBITEMS: NavItem[] = [
  { key: "admin-clients", label: "Clientes" },
  { key: "admin-quotes", label: "Frases" },
];

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  coaching_1_1: "Coaching 1:1",
  coaching_online: "Coaching Online",
  lead_wellness: "Leads Wellness",
  mentoring: "Mentoring",
};

// --- Module Theme ---

export type ArcType = "morning" | "afternoon" | "evening" | "balanced";
export type ThemeType = "neutral" | "green";

export type ModuleThemeConfig = {
  theme: ThemeType;
  arc: ArcType;
  ringLabel: string;
};

export const MODULE_THEME: Record<string, ModuleThemeConfig> = {
  "personal-info": { theme: "neutral", arc: "balanced", ringLabel: "Tu espacio personal" },
  training: { theme: "neutral", arc: "morning", ringLabel: "Fase: Enfoque" },
  nutrition: { theme: "green", arc: "afternoon", ringLabel: "Fase: Sostén" },
  cortisol: { theme: "green", arc: "afternoon", ringLabel: "Fase: Calma" },
  rest: { theme: "neutral", arc: "evening", ringLabel: "Fase: Descanso" },
  community: { theme: "neutral", arc: "evening", ringLabel: "Fase: Comunidad" },
  evolution: { theme: "neutral", arc: "balanced", ringLabel: "Tu progreso" },
};

export const ARC_COLOR_VAR: Record<ArcType, string> = {
  morning: "--ring-morning",
  afternoon: "--ring-afternoon",
  evening: "--ring-evening",
  balanced: "--ink-soft",
};

// --- Mantras ---

export const MANTRA_BANK: Record<string, string[]> = {
  training: [
    "Cada gota de sudor es una decisión de amor propio.",
    "No tienes que hacerlo perfecto, solo tienes que hacerlo.",
    "La disciplina vence al talento cuando el talento no se disciplina.",
  ],
  nutrition: [
    "Comer bien no es un castigo, es un regalo que te das cada día.",
    "Cada bocado es una oportunidad de nutrir tu mejor versión.",
  ],
  cortisol: [
    "Respirar profundo también es avanzar.",
    "La calma se entrena igual que el cuerpo.",
    "No tienes que apagar la tormenta, solo bajar el volumen.",
  ],
  rest: [
    "El descanso también es parte del entrenamiento.",
    "Dormir bien es un acto de disciplina, no de pereza.",
    "La recuperación es donde el esfuerzo se convierte en progreso.",
  ],
  community: [
    "Nadie mejora solo — la tribu sostiene el ritmo.",
    "Presencia, no competencia.",
    "Compartir el proceso lo hace más liviano.",
  ],
  evolution: [
    "El progreso no siempre se ve — pero se siente.",
    "Cada registro es una prueba de que seguiste intentando.",
    "Tu proceso no compite con el de nadie más.",
  ],
};

export function pickMantra(viewKey: string): string {
  const list = MANTRA_BANK[viewKey];
  if (!list || !list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}

export const COACH_WHATSAPP_NUMBER = "573214973677";

// --- View key to path mapping ---

export const VIEW_TO_PATH: Record<string, string> = {
  training: "/training",
  nutrition: "/nutrition",
  cortisol: "/cortisol",
  rest: "/rest",
  community: "/community",
  evolution: "/evolution",
  "personal-info": "/onboarding",
  "admin-clients": "/admin/clients",
  "admin-quotes": "/admin/phrases",
  "admin-notifications": "/admin/notifications",
};

export const PATH_TO_VIEW: Record<string, string> = {
  "/training": "training",
  "/nutrition": "nutrition",
  "/cortisol": "cortisol",
  "/rest": "rest",
  "/community": "community",
  "/evolution": "evolution",
  "/onboarding": "personal-info",
  "/admin": "admin-hub",
  "/admin/clients": "admin-clients",
  "/admin/phrases": "admin-quotes",
  "/admin/notifications": "admin-notifications",
};