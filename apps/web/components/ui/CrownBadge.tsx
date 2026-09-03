import { IconCrown } from "./icons";

// Insignia de "módulo incluido en tu membresía pero vencido" — círculo bronce
// con la corona adentro. Sin sombra (ver spec de reskin §1/§7): la jerarquía
// se hace con hairlines y superficie, no con box-shadow.
export function CrownBadge({ circleSize, iconSize }: { circleSize: number; iconSize: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: circleSize,
        height: circleSize,
        borderRadius: "50%",
        background: "var(--eph-accent)",
        color: "var(--eph-ink)",
        flexShrink: 0,
      }}
    >
      <IconCrown size={iconSize} />
    </span>
  );
}
