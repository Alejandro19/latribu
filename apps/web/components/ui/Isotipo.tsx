"use client";

type IsotipoProps = { size?: number; tone?: "dual" | "mono"; className?: string };

// Isotipo Ephirox — versión definitiva (Prompt 03). Reemplaza cualquier
// otra definición del logo en el repo: no debe quedar ningún SVG suelto
// con la geometría de arco único descartada en versiones anteriores.
//
// viewBox 0 0 132 132, centro (66,66).
// Forma completa (>= 40px): anillo exterior con abertura ARRIBA + anillo
// interior con abertura ABAJO + punto central — las aberturas van siempre
// contrapuestas (si quedan del mismo lado, el ojo cierra el círculo y la
// silueta se lee como un cuenco).
// Forma reducida (< 40px): un solo arco con abertura ABAJO + punto central
// — a un solo arco, la abertura nunca va hacia arriba.
export function Isotipo({ size = 118, tone = "dual", className }: IsotipoProps) {
  const reduced = size < 40;
  const large = size >= 96;
  const outerW = large ? 2.4 : 4;
  const innerW = large ? 2 : 3.4;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 132 132"
      fill="none"
      className={className}
      role="img"
      aria-label="Ephirox"
      style={{ flexShrink: 0 }}
    >
      {reduced ? (
        <>
          <circle
            cx="66" cy="66" r="58"
            stroke="var(--eph-accent)" strokeWidth={4}
            strokeDasharray="272 92"
            transform="rotate(-224.3 66 66)"
          />
          <circle cx="66" cy="66" r="8" fill="var(--eph-accent)" />
        </>
      ) : (
        <>
          <circle
            cx="66" cy="66" r="62"
            stroke="var(--eph-accent)" strokeWidth={outerW}
            strokeDasharray="329 60.6"
            transform="rotate(-61.9 66 66)"
          />
          <circle
            cx="66" cy="66" r="47"
            stroke={tone === "mono" ? "var(--eph-accent)" : "var(--eph-faint)"}
            strokeOpacity={tone === "mono" ? 0.38 : 1}
            strokeWidth={innerW}
            strokeDasharray="250 45.3"
            transform="rotate(-242.3 66 66)"
          />
          <circle cx="66" cy="66" r={6} fill="var(--eph-accent)" />
        </>
      )}
    </svg>
  );
}

export default Isotipo;
