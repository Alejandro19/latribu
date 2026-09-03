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
  { key: "personal-info", label: "Baseline" },
  { key: "training", label: "Workout", visible: (s) => s.onboardingComplete === true },
  { key: "nutrition", label: "Nutrition", visible: (s) => s.onboardingComplete === true },
  { key: "cortisol", label: "Stress", visible: (s) => s.onboardingComplete === true },
  { key: "rest", label: "Sleep", visible: (s) => s.onboardingComplete === true },
  { key: "blindspot", label: "Breakthrough Sessions", visible: (s) => s.onboardingComplete === true },
  { key: "community", label: "The Circle", visible: (s) => s.onboardingComplete === true },
  { key: "evolution", label: "Evolution", visible: (s) => s.onboardingComplete === true },
];

export const ADMIN_NAV: NavItem[] = [
  { key: "admin-hub", label: "Administration" },
  { key: "training", label: "Workout" },
  { key: "nutrition", label: "Nutrition" },
  { key: "cortisol", label: "Stress" },
  { key: "rest", label: "Sleep" },
  { key: "blindspot", label: "Breakthrough Sessions" },
  { key: "evolution", label: "Evolution" },
  { key: "community", label: "The Circle" },
];

export const ADMIN_HUB_SUBITEMS: NavItem[] = [
  { key: "admin-clients", label: "Clientes" },
  { key: "admin-quotes", label: "Frases" },
  { key: "admin-roles", label: "Roles y Perfiles" },
  { key: "admin-membership-prices", label: "Precios de Membresía" },
];

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  coaching_1_1: "Cliente 1:1",
  mentoring: "Premium",
};

// Nombres cara-al-cliente (member card, candados de nivel) — nunca en
// pantallas de admin, que siguen usando CLIENT_TYPE_LABELS (las categorías
// internas de Roles y Perfiles). Hoy son los mismos nombres directos — se
// mantiene separado porque cada uno cumple un propósito distinto.
export const MEMBERSHIP_LABELS: Record<string, string> = {
  coaching_1_1: "Cliente 1:1",
  mentoring: "Premium",
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
    "Ningún líder sostiene su ritmo más alto en soledad.",
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
  blindspot: "/blindspot",
  "personal-info": "/onboarding",
  "admin-clients": "/admin/clients",
  "admin-quotes": "/admin/phrases",
  "admin-roles": "/admin/roles",
  "admin-membership-prices": "/admin/membership-prices",
};

export const PATH_TO_VIEW: Record<string, string> = {
  "/training": "training",
  "/nutrition": "nutrition",
  "/cortisol": "cortisol",
  "/rest": "rest",
  "/community": "community",
  "/evolution": "evolution",
  "/blindspot": "blindspot",
  "/onboarding": "personal-info",
  "/admin": "admin-hub",
  "/admin/clients": "admin-clients",
  "/admin/phrases": "admin-quotes",
  "/admin/roles": "admin-roles",
  "/admin/membership-prices": "admin-membership-prices",
};