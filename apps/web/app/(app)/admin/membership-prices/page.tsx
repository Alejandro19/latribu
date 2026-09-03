"use client";

import { useCallback, useEffect, useState } from "react";
import IdentityHeader from "../../../../components/ui/IdentityHeader";
import PricingTable from "../../../../components/admin/pricing/PricingTable";
import { getMembershipPrices, type MembershipPrice } from "../../../../lib/membership-client";

export default function AdminMembershipPricesPage() {
  const [prices, setPrices] = useState<MembershipPrice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    getMembershipPrices()
      .then(setPrices)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar los precios."));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div>
      <IdentityHeader
        title="Precios de membresía"
        subtitle="Montos que se cobran por Stripe al pagar cada plan — no afecta el pago en efectivo."
      />
      {error && (
        <p role="alert" style={{ color: "#D99483", fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}
      <PricingTable prices={prices} onSaved={refetch} />
    </div>
  );
}
