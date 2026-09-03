"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { fetchClient, type ClientDetail } from "@/lib/clients-client";
import {
  getMembershipPrices,
  createMembershipCheckout,
  getMembershipPaymentStatus,
  type MembershipPrice,
  type MembershipCheckout,
} from "@/lib/membership-client";

/**
 * Pago digital de membresías — La Tribu
 *
 * Pago único por periodo fijo, NO suscripción: al vencer, el cliente vuelve
 * a pagar acá. Wompi es el proveedor activo hoy; Stripe queda construido
 * detrás de la misma pantalla, inactivo hasta tener una llave real (ver
 * apps/api/src/services/payment-providers/). El checkout NUNCA activa nada
 * por sí solo — solo el webhook de cada proveedor lo hace tras la
 * confirmación real. Por eso, tras "pagar" en el navegador, esta pantalla
 * consulta el estado real contra nuestro backend (GET
 * /api/account/membership/payments/:id) en vez de asumir éxito por lo que
 * devuelve el proveedor del lado del cliente.
 */

const INK = "var(--eph-text)";
const INK_MUTED = "var(--eph-muted)";
const GOLD = "var(--eph-accent)";
const BORDER = "var(--eph-line)";
const BORDER_2 = "var(--eph-line-2)";
const PAGE_BG = "var(--eph-bg)";
const SURFACE = "var(--eph-surface)";
const DANGER_TEXT = "#D99483";

const stripePromise: Promise<Stripe | null> = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

type WompiWidgetResult = { transaction: { id: string; status: string } };
type WompiWidgetCheckoutOptions = {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
};
type WompiWidgetCheckoutInstance = { open: (callback: (result: WompiWidgetResult) => void) => void };
declare global {
  interface Window {
    WidgetCheckout?: new (options: WompiWidgetCheckoutOptions) => WompiWidgetCheckoutInstance;
  }
}
const WOMPI_WIDGET_SRC = "https://checkout.wompi.co/widget.js";

type Plan = {
  clientType: string;
  label: string;
  durations: readonly number[];
  // Solo 1:1 vende por paquete de clases — 3ra dimensión de precio junto
  // con la duración (6 combinaciones). undefined para Mentoría.
  packageSizes?: readonly number[];
};

const PLANS: Plan[] = [
  { clientType: "coaching_1_1", label: "Cliente 1:1", durations: [1, 3], packageSizes: [8, 12, 16] },
  { clientType: "mentoring", label: "Premium", durations: [3] },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);
}

// Vigente = ya tiene ESE tier activo y su plan no venció todavía — en ese
// caso no se muestra el formulario de pago, solo la fecha de vencimiento.
function isCurrentlyActiveFor(client: ClientDetail | null | undefined, clientType: string): boolean {
  if (!client) return false;
  return client.clientType === clientType && client.status === "active" && !!client.planEndDate && client.planEndDate >= todayStr();
}

// Compartido entre Stripe y Wompi: nunca se marca "activo" por lo que
// devuelve el proveedor del lado del cliente — solo cuando este polling ve
// `succeeded` en nuestro propio backend (que solo lo sabe tras el webhook).
async function pollMembershipPaymentUntilSucceeded(
  paymentId: string,
  handlers: { onSucceeded: () => void; onFailed: () => void; onTimeout: () => void }
) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    let status: string;
    try {
      status = (await getMembershipPaymentStatus(paymentId)).status;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (status === "succeeded") {
      handlers.onSucceeded();
      return;
    }
    if (status === "failed") {
      handlers.onFailed();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  handlers.onTimeout();
}

function PayButton({ phase, disabled, onClick, label }: { phase: "paying" | "confirming"; disabled?: boolean; onClick?: () => void; label: string }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled || phase === "confirming"}
      className="w-full mt-4 font-mono uppercase tracking-[0.1em] text-[11px]"
      style={{
        height: 42, borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)",
        opacity: disabled || phase === "confirming" ? 0.6 : 1,
        cursor: disabled || phase === "confirming" ? "not-allowed" : "pointer",
      }}
    >
      {phase === "confirming" ? "Confirmando tu pago…" : label}
    </button>
  );
}

function StripeCheckoutForm({
  membershipPaymentId,
  onConfirmed,
  onFailed,
}: {
  membershipPaymentId: string;
  onConfirmed: () => void;
  onFailed: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [phase, setPhase] = useState<"paying" | "confirming">("paying");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (stripeError) {
      setError(stripeError.message || "No se pudo procesar el pago.");
      return;
    }
    // confirmPayment() sin error NO es la confirmación real — ver polling compartido.
    setPhase("confirming");
    pollMembershipPaymentUntilSucceeded(membershipPaymentId, {
      onSucceeded: onConfirmed,
      // El rechazo definitivo (confirmado por nuestro backend, nunca por lo
      // que devuelve Stripe del lado del cliente) pasa a una pantalla propia
      // en el padre — no se resetea en silencio al formulario.
      onFailed,
      onTimeout: () =>
        setError("Esto está tardando más de lo normal — se confirmará solo. Podés cerrar esta pantalla y volver más tarde."),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="text-[12px] mt-3" style={{ color: DANGER_TEXT }}>{error}</p>}
      <PayButton phase={phase} disabled={!stripe} label="Pagar" />
    </form>
  );
}

function WompiCheckoutForm({
  checkout,
  onConfirmed,
  onFailed,
}: {
  checkout: Extract<MembershipCheckout, { provider: "wompi" }>;
  onConfirmed: () => void;
  onFailed: () => void;
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [phase, setPhase] = useState<"paying" | "confirming">("paying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.WidgetCheckout) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = WOMPI_WIDGET_SRC;
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => setError("No se pudo cargar el medio de pago. Intenta de nuevo.");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePay = () => {
    if (!scriptReady || !window.WidgetCheckout) return;
    setError(null);
    const widget = new window.WidgetCheckout({
      currency: checkout.currency,
      amountInCents: checkout.amountInCents,
      reference: checkout.providerReference,
      publicKey: checkout.publicKey,
      signature: { integrity: checkout.integritySignature },
    });
    widget.open(() => {
      // El resultado que trae el callback del Widget NUNCA es la
      // confirmación real (PSE en particular puede tardar minutos más) —
      // solo dispara el mismo polling compartido con Stripe.
      setPhase("confirming");
      pollMembershipPaymentUntilSucceeded(checkout.membershipPaymentId, {
        onSucceeded: onConfirmed,
        onFailed,
        onTimeout: () =>
          setError("Esto está tardando más de lo normal — se confirmará solo. Podés cerrar esta pantalla y volver más tarde."),
      });
    });
  };

  return (
    <div>
      {error && <p className="text-[12px] mt-3" style={{ color: DANGER_TEXT }}>{error}</p>}
      <PayButton phase={phase} disabled={!scriptReady} onClick={handlePay} label={scriptReady ? "Pagar" : "Cargando…"} />
    </div>
  );
}

function MembershipCard({
  plan,
  prices,
  client,
  onPurchased,
}: {
  plan: Plan;
  prices: MembershipPrice[];
  client: ClientDetail | null | undefined;
  onPurchased: () => void;
}) {
  const [duration, setDuration] = useState<number>(plan.durations[0]);
  const [packageSize, setPackageSize] = useState<number | undefined>(plan.packageSizes?.[0]);
  const [checkout, setCheckout] = useState<MembershipCheckout | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [justFailed, setJustFailed] = useState(false);

  // El mensaje de éxito se queda en pantalla hasta que el cliente lo cierra
  // a propósito con "Aceptar" (como una confirmación bancaria) — nunca se
  // oculta solo con un timer. Se limpia `checkout` ya mismo, acá: si se
  // dejara colgado, al volver a esta rama se remontaría el mismo formulario
  // de Stripe con un clientSecret ya usado (PaymentIntent ya confirmado),
  // que es lo que producía el "Unhandled payment Element loaderror" y un
  // botón "Pagar" fantasma.
  const handleConfirmed = () => {
    setJustConfirmed(true);
    setCheckout(null);
    onPurchased();
  };

  // "Aceptar" cierra la confirmación y vuelve a pedir el dato del cliente en
  // ese mismo momento — así, si el webhook recién terminó de procesar el
  // pago justo después de la confirmación inicial, la card ya refleja
  // "Vigente hasta" apenas el cliente confirma que quiere volver.
  const handleAcceptConfirmation = () => {
    setJustConfirmed(false);
    onPurchased();
  };

  const price =
    prices.find(
      (p) =>
        p.clientType === plan.clientType &&
        p.durationMonths === duration &&
        (plan.packageSizes ? p.packageSize === packageSize : p.packageSize == null)
    ) ?? null;
  const active = isCurrentlyActiveFor(client, plan.clientType);
  const isElite = plan.clientType === "mentoring";

  const handleStartCheckout = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await createMembershipCheckout(plan.clientType, duration, packageSize);
      setCheckout(result);
    } catch (e) {
      // Si el proveedor de este tier no está disponible (ej. faltan llaves
      // de Wompi), el backend ya devuelve un mensaje claro acá — sin
      // necesidad de una pre-chequeo aparte de disponibilidad.
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="p-6 flex flex-col"
      style={{
        borderRadius: 0,
        borderWidth: isElite ? 2 : 1,
        borderStyle: "solid",
        borderColor: isElite ? GOLD : BORDER,
        background: SURFACE,
      }}
    >
      <h3 className="font-display text-[19px] font-normal mb-1" style={{ color: INK }}>{plan.label}</h3>

      {justConfirmed ? (
        <div className="mt-3">
          <p className="text-[13px]" style={{ color: GOLD }}>Pago confirmado — tu membresía ya está activa.</p>
          <button
            type="button"
            onClick={handleAcceptConfirmation}
            className="w-full mt-3 font-mono uppercase tracking-[0.1em] text-[11px]"
            style={{ height: 42, borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)", cursor: "pointer" }}
          >
            Aceptar
          </button>
        </div>
      ) : justFailed ? (
        <div className="mt-3">
          <p className="text-[13px]" style={{ color: DANGER_TEXT }}>
            El pago fue rechazado. Podés intentar de nuevo o probar con otro medio de pago.
          </p>
          <button
            type="button"
            onClick={() => {
              setJustFailed(false);
              setCheckout(null);
            }}
            className="w-full mt-3 font-mono uppercase tracking-[0.1em] text-[11px]"
            style={{ height: 42, borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)", cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      ) : active && client?.planEndDate ? (
        <p className="text-[13px] mt-3" style={{ color: INK_MUTED }}>
          {plan.clientType === "coaching_1_1" && client.sessionsRemaining != null && client.sessionsTotal != null && (
            <>Quedan {client.sessionsRemaining} de {client.sessionsTotal} clases · </>
          )}
          Vigente hasta <span style={{ color: GOLD, fontWeight: 600 }}>{formatDate(client.planEndDate)}</span>.
        </p>
      ) : checkout ? (
        <div className="mt-3">
          {checkout.provider === "stripe" ? (
            <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret }}>
              <StripeCheckoutForm
                membershipPaymentId={checkout.membershipPaymentId}
                onConfirmed={handleConfirmed}
                onFailed={() => setJustFailed(true)}
              />
            </Elements>
          ) : (
            <WompiCheckoutForm
              checkout={checkout}
              onConfirmed={handleConfirmed}
              onFailed={() => setJustFailed(true)}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 mt-3">
          <div>
            {plan.packageSizes && (
              <div className="mb-3">
                <p className="text-[12px] mb-1.5" style={{ color: INK_MUTED }}>Clases</p>
                <div className="flex gap-2 flex-wrap">
                  {plan.packageSizes.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPackageSize(n)}
                      className="px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wide border"
                      style={
                        packageSize === n
                          ? { background: "var(--eph-accent)", borderColor: "var(--eph-accent)", color: "var(--eph-ink)" }
                          : { background: "transparent", borderColor: BORDER_2, color: INK_MUTED }
                      }
                    >
                      {n} clases
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-3">
              <p className="text-[12px] mb-1.5" style={{ color: INK_MUTED }}>Duración</p>
              <div className="flex gap-2 flex-wrap">
                {plan.durations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wide border"
                    style={
                      duration === d
                        ? { background: "var(--eph-accent)", borderColor: "var(--eph-accent)", color: "var(--eph-ink)" }
                        : { background: "transparent", borderColor: BORDER_2, color: INK_MUTED }
                    }
                  >
                    {d} {d === 1 ? "mes" : "meses"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <p className="text-[12px]" style={{ color: INK_MUTED }}>Precio</p>
            <p className="font-display text-[26px] font-normal" style={{ color: INK, marginTop: 2 }}>
              {price && price.amountCents > 0 ? formatAmount(price.amountCents, price.currency) : "Precio no disponible"}
            </p>
            {isElite && (
              <p className="text-[12px] mt-1" style={{ color: INK_MUTED }}>
                Referencia · monto exacto según TRM al pagar
              </p>
            )}
            {error && <p className="text-[12px] mt-2" style={{ color: DANGER_TEXT }}>{error}</p>}
            <button
              type="button"
              onClick={handleStartCheckout}
              disabled={starting || !price || price.amountCents <= 0}
              className="w-full mt-3 font-mono uppercase tracking-[0.1em] text-[11px]"
              style={{
                height: 42, borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)",
                opacity: starting || !price || price.amountCents <= 0 ? 0.5 : 1,
                cursor: starting || !price || price.amountCents <= 0 ? "not-allowed" : "pointer",
              }}
            >
              {starting ? "Preparando el pago…" : "Pagar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PanelMembresias({ clientId }: { clientId: string }) {
  const clientKey = ["client-detail-for-member-card", clientId];
  const { data: client, mutate } = useSWR(clientKey, () => fetchClient(clientId));
  const { data: prices } = useSWR(["membership-prices"], getMembershipPrices);

  return (
    <div className="min-h-[600px]" style={{ background: PAGE_BG }}>
      <div className="max-w-[900px] mx-auto px-5 py-12">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-2" style={{ color: INK_MUTED }}>Tu cuenta</p>
        <h1 className="font-display text-[28px] font-normal mb-1.5" style={{ color: INK }}>Membresías</h1>
        <p className="text-[13.5px] mb-8" style={{ color: INK_MUTED }}>
          Pago único por periodo — sin cobro automático. Al vencerse, vuelves a pagar acá.
        </p>

        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {PLANS.map((plan) => (
            <MembershipCard
              key={plan.clientType}
              plan={plan}
              prices={prices ?? []}
              client={client}
              onPurchased={() => mutate()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
