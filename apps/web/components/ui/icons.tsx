// Set de íconos de línea, estilo Tabler (trazo fino, monocromático) — el
// mismo criterio ya usado en los íconos hand-rolled del resto de la app
// (TechniqueIcon, SupplementIcon, etc.). Reemplazan todos los emojis
// decorativos/funcionales de la UI. Uso: <IconFlame size={14} />.

export type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const });

export function IconChevronDown({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconFlame({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c1 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c1.2 1 2 2.5 2 4.2A6.5 6.5 0 1 1 6 14.2c0-3 1.8-4.6 3.2-6.4C10.2 6.6 11 5 12 2Z" />
    </svg>
  );
}

export function IconLock({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

// Réplica del ti-crown-filled de Tabler (el proyecto no tiene
// @tabler/icons-react instalado — todos los íconos son SVGs propios "estilo
// Tabler", ver comentario al inicio del archivo). Señala un módulo incluido
// en la membresía pero temporalmente inaccesible por vencimiento (vs.
// IconLock, que señala un módulo nunca incluido en el plan). Variante
// rellena (fill, no stroke) — versión definitiva del badge de corona.
export function IconCrown({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} fill="currentColor">
      <path d="M4 6 9 10 12 5 15 10 20 6 18 18 6 18Z" />
    </svg>
  );
}

export function IconSettings({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function IconLogout({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M10 12h10M17 8l4 4-4 4" />
    </svg>
  );
}

export function IconShield({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5.5c0 4.5-3 7.7-7 9.5-4-1.8-7-5-7-9.5V6l7-3Z" />
    </svg>
  );
}

export function IconBell({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconTrophy({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5A2.5 2.5 0 0 0 7 9.5" />
      <path d="M17 5h2.5A2.5 2.5 0 0 1 17 9.5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 16.5h4L15 20H9l1-3.5Z" />
    </svg>
  );
}

export function IconMedal({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h8l-3 7h-2L8 3Z" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12v3l2 1.5" />
    </svg>
  );
}

export function IconShuffle({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h3.5c2 0 3 1 4 2.5" />
      <path d="M4 18h3.5c2 0 3-1 4-2.5" />
      <path d="M20 6h-3.5c-1 0-1.9.35-2.6 1" />
      <path d="M20 18h-3.5c-1 0-1.9-.35-2.6-1" />
      <polyline points="17.5 3.5 20 6 17.5 8.5" />
      <polyline points="17.5 15.5 20 18 17.5 20.5" />
    </svg>
  );
}

export function IconCamera({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="16.8" x2="12" y2="16.9" />
    </svg>
  );
}

// Réplica del ti-alert-triangle-filled de Tabler — el "agujero" de la
// exclamación se logra con fill-rule="evenodd" (dos subformas cerradas
// dentro del triángulo), así que funciona sobre cualquier color de fondo
// sin depender de conocerlo de antemano.
export function IconAlertTriangleFilled({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} fill="currentColor" fillRule="evenodd">
      <path d="M12 3.2 21.8 19.2H2.2Z M11.4 9.5h1.2v5h-1.2Z M11.3 16.3h1.4v1.4h-1.4Z" />
    </svg>
  );
}

export function IconCheckCircle({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="8.2 12.3 10.8 14.8 15.8 9.5" />
    </svg>
  );
}

export function IconEdit({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4.5 19.5 9 8 20.5 3.5 21 4 16.5 15 4.5Z" />
    </svg>
  );
}

export function IconTrash({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function IconX({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function IconPaperclip({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.4 11.5 12.6 19.3a4.7 4.7 0 0 1-6.7-6.7L14 4.5a3.2 3.2 0 0 1 4.5 4.5l-8 8a1.6 1.6 0 0 1-2.3-2.3l6.7-6.7" />
    </svg>
  );
}

export function IconFileDownload({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h7l3 3v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M12 9v6.5" />
      <polyline points="9.5 13.2 12 15.7 14.5 13.2" />
    </svg>
  );
}

// ─── Íconos de encabezado de grupo (Información Personal) ─────────

export function IconUser({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </svg>
  );
}

export function IconCalendar({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="8" y1="3.5" x2="8" y2="7" />
      <line x1="16" y1="3.5" x2="16" y2="7" />
    </svg>
  );
}

export function IconMapPin({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function IconBriefcase({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="7.5" width="17" height="11" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <line x1="3.5" y1="12.5" x2="20.5" y2="12.5" />
    </svg>
  );
}

export function IconBrain({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5a2.6 2.6 0 0 0-2.6 2.6c0 .3 0 .6.1.9A2.8 2.8 0 0 0 5.5 10.5c0 .9.5 1.7 1.2 2.1a2.7 2.7 0 0 0 2.3 4.1h.5v2.3a1.5 1.5 0 0 0 3 0V7.3A2.8 2.8 0 0 0 9.5 4.5Z" />
      <path d="M14.5 4.5a2.6 2.6 0 0 1 2.6 2.6c0 .3 0 .6-.1.9a2.8 2.8 0 0 1 1.5 2.5c0 .9-.5 1.7-1.2 2.1a2.7 2.7 0 0 1-2.3 4.1h-.5v2.3a1.5 1.5 0 0 1-3 0V7.3a2.8 2.8 0 0 1 3-2.8Z" />
    </svg>
  );
}

export function IconHeartPulse({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8.5 2.1c0 5.8-8.5 11.1-8.5 11.1Z" />
      <polyline points="6 12.5 9 12.5 10.5 9.5 12.5 15 14 12.5 16.5 12.5" />
    </svg>
  );
}

export function IconClipboardCheck({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <polyline points="8.5 13 10.8 15.3 15.5 10.5" />
    </svg>
  );
}

export function IconUtensils({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v7a2 2 0 0 0 4 0V3" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <path d="M17 3c-1.5 0-2.5 2-2.5 5s1 5 2.5 5v8" />
    </svg>
  );
}

export function IconApple({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9c-3.5-2-7 0-7 4.7 0 3.9 2.7 7.3 4.7 7.3.9 0 1.4-.5 2.3-.5s1.4.5 2.3.5c1.8 0 4.2-2.7 4.7-5.9.1-.6-.2-1.1-.7-1.4-1.6-1-2-3.5-.6-4.7-1-1-2.5-1.2-3.7-.6" />
      <path d="M11.5 8.5c0-1.8 1-3 2.5-3.5" />
    </svg>
  );
}

export function IconListCheck({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3.5 6.5 4.7 7.7 6.8 5.3" />
      <line x1="10" y1="6.5" x2="20.5" y2="6.5" />
      <polyline points="3.5 13.5 4.7 14.7 6.8 12.3" />
      <line x1="10" y1="13.5" x2="20.5" y2="13.5" />
      <line x1="10" y1="17.5" x2="20.5" y2="17.5" />
      <line x1="3.5" y1="17.5" x2="6.5" y2="17.5" />
    </svg>
  );
}

export function IconDroplet({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8Z" />
    </svg>
  );
}

export function IconCoffee({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
      <path d="M16 10.5h1.5a2.3 2.3 0 0 1 0 4.5H16" />
      <path d="M8 6c0-1 .7-1.2.7-2S8 2.5 8 2.5" />
      <path d="M11.3 6c0-1 .7-1.2.7-2s-.7-1.5-.7-1.5" />
    </svg>
  );
}

export function IconWine({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10c0 4.8-2 8-5 8s-5-3.2-5-8Z" />
      <line x1="12" y1="11.5" x2="12" y2="19" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </svg>
  );
}

export function IconLeaf({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 19c-1.5-5.5 1-12 12-13.5C19.5 16.5 12.5 19 6 19Z" />
      <path d="M6.5 18.5C9 14.5 12 11.5 16.5 8.5" />
    </svg>
  );
}

export function IconPill({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="9.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 13)" />
      <line x1="10.5" y1="8" x2="13.5" y2="18" />
    </svg>
  );
}

export function IconMoon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function IconActivity({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 12.5 7.5 12.5 9.5 6.5 14 18.5 16 12.5 20.5 12.5" />
    </svg>
  );
}

export function IconScale({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3.5" x2="12" y2="19.5" />
      <line x1="6" y1="6.5" x2="18" y2="6.5" />
      <path d="M6 6.5 3 12a3 3 0 0 0 6 0L6 6.5Z" />
      <path d="M18 6.5 15 12a3 3 0 0 0 6 0l-3-5.5Z" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </svg>
  );
}

export function IconTarget({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

// ─── Íconos de categoría (Comunidad wellness) ──────────────────────

export function IconSnowflake({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2.5" x2="12" y2="21.5" />
      <line x1="4.5" y1="7.2" x2="19.5" y2="16.8" />
      <line x1="19.5" y1="7.2" x2="4.5" y2="16.8" />
    </svg>
  );
}

export function IconYoga({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="1.6" />
      <path d="M12 8v5" />
      <path d="M12 9c-2.5 0-4.5 2-5.5 5" />
      <path d="M12 9c2.5 0 4.5 2 5.5 5" />
      <path d="M12 13c-1.5 2-3.5 3.5-6 4" />
      <path d="M12 13c1.5 2 3.5 3.5 6 4" />
    </svg>
  );
}

export function IconRun({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14.3" cy="4.5" r="1.6" />
      <path d="M9 20l2.2-4.5-2-1.8 1.3-4.5 3 1.8 2 3.5 3 1" />
      <path d="M8 12.5l3-1 2.3-3.3" />
      <path d="M7.5 20l3-3.8" />
    </svg>
  );
}

export function IconHandshake({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 11.5 6 8.5l3 2 3-2.3 2.7 2.3 3.3-3 3.5 3" />
      <path d="M9 10.5l3.3 3.3a1.4 1.4 0 0 0 2-2l-2.8-2.8" />
      <path d="M12 12.5l1.5 1.5a1.4 1.4 0 0 0 2-2" />
      <path d="M6 8.5l4 4.3a1.4 1.4 0 0 0 2-2" />
    </svg>
  );
}

export function IconMassage({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M6 20c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5" />
      <path d="M8.5 13.5c-1-1-1.2-2.5-.3-3.8" />
      <path d="M15.5 13.5c1-1 1.2-2.5.3-3.8" />
    </svg>
  );
}

export function IconStethoscope({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5v6a4 4 0 0 0 8 0v-6" />
      <line x1="6" y1="3.5" x2="4.5" y2="3.5" />
      <line x1="14" y1="3.5" x2="12.5" y2="3.5" />
      <path d="M10 13.5v2.5a4.5 4.5 0 0 0 9 0v-1.3" />
      <circle cx="19.5" cy="14.2" r="1.6" />
    </svg>
  );
}

export function IconSalad({ size = 20, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 13h17a7.5 7.5 0 0 1-15 0Z" />
      <path d="M12 13c0-3 1-5 2.5-6.5" />
      <path d="M9 13c-.5-2.5.5-4.5 2-5.5" />
      <path d="M15 13c1.5-1.5 3-1.8 4-1.2" />
    </svg>
  );
}
