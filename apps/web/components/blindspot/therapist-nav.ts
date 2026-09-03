export type TherapistModuleKey =
  | 'perfil'
  | 'casos'
  | 'clientes'
  | 'agenda'
  | 'recursos'
  | 'comunidad'
  | 'dashboards';

export const THERAPIST_NAV: { key: TherapistModuleKey; label: string }[] = [
  { key: 'perfil', label: 'Mi perfil' },
  { key: 'casos', label: 'Mis casos' },
  { key: 'clientes', label: 'Mis clientes' },
  { key: 'agenda', label: 'Mi agenda' },
  { key: 'recursos', label: 'Recursos clínicos' },
  { key: 'comunidad', label: 'Cuerpo terapéutico' },
  { key: 'dashboards', label: 'Dashboards' },
];
