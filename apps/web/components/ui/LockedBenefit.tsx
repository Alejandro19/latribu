"use client";

import type { ReactNode } from "react";
import LockedOverlay from "./LockedOverlay";
import { COACH_WHATSAPP_NUMBER } from "../../lib/constants";

type LockedBenefitProps = {
  benefit: string;
  children?: ReactNode;
};

export default function LockedBenefit({ benefit, children }: LockedBenefitProps) {
  const backdrop = children ?? <div style={{ minHeight: 200 }} />;

  return (
    <LockedOverlay
      title="Disponible en Premium"
      subtitle={`Disponible en Premium: ${benefit} y más.`}
      ctaLabel="Hablar con tu coach"
      onCta={() => window.open(`https://wa.me/${COACH_WHATSAPP_NUMBER}`, "_blank")}
    >
      {backdrop}
    </LockedOverlay>
  );
}
