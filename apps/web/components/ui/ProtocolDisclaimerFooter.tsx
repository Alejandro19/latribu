import Link from 'next/link';

// Footer fijo en cada vista de protocolo (Entrenamiento, Nutrición, Gestión
// de Cortisol, Hackea tu Sueño) — recordatorio corto y siempre visible del
// descargo de responsabilidad completo, que vive en los Términos de Servicio
// (ver legal-content.js, sección "Descargo de responsabilidad y naturaleza
// del servicio"). No repite el texto completo acá a propósito.
export function ProtocolDisclaimerFooter() {
  return (
    <p className="mt-8 text-center font-body text-[11px] leading-relaxed" style={{ color: 'var(--eph-faint)' }}>
      Contenido informativo de bienestar — no diagnostica ni trata ninguna condición médica o de salud mental, y no sustituye la consulta con un profesional licenciado.{' '}
      <Link href="/configuracion" className="underline" style={{ color: 'var(--eph-muted)' }}>Ver Términos de Servicio</Link>
    </p>
  );
}
