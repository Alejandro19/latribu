'use client';

import { useEffect, useState } from 'react';
import { getNutrition, type NutritionPlan, type MenuMeal } from '../../lib/nutrition-client';
import { listSupplements, type Supplement } from '../../lib/supplements-client';
import { pickMantra } from '../../lib/mantra-bank';
import IdentityHeader from '../ui/IdentityHeader';

function MealIcon({ name }: { name: string }) {
  const isSnack = /snack|merienda|fruta|colaci[oó]n/i.test(name || '');
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mr-2 flex-shrink-0 text-[#5B7A4E]">
      {isSnack ? (
        <>
          <path
            d="M10 6.8c-2.4-2.1-5.7-.5-5.7 3.1 0 3.1 2.6 6.1 5.7 6.1s5.7-3 5.7-6.1c0-3.6-3.3-5.2-5.7-3.1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="none"
          />
          <path d="M10 6.8V4.3M8.6 4.2c0-1 .9-1.9 2-1.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </>
      )}
    </svg>
  );
}

function MealBlock({ meal, isFirst }: { meal: MenuMeal; isFirst: boolean }) {
  return (
    <div className={`py-3.5 ${isFirst ? '' : 'border-t border-[#E8EEDF]'}`}>
      <div className="mb-2 flex items-center font-serif text-base font-semibold text-[var(--ink)]">
        <MealIcon name={meal.name} />
        {meal.name}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(meal.options || []).map((opt, i) => (
          <div key={i}>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[#5B7A4E]">{opt.label}</p>
            <ul className="space-y-1 text-sm leading-relaxed text-[var(--ink)]">
              {opt.items.map((item, j) => (
                <li key={j} className="relative pl-3.5 before:absolute before:left-0 before:top-[8px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#5B7A4E] before:content-['']">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroRing({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-white/55 bg-white/10">
      <span className="text-[13px] font-bold leading-none">{value ?? '-'}g</span>
      <span className="mt-0.5 text-[8px] uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

function MacroStat({ value, label }: { value: string | number | null | undefined; label: string }) {
  return (
    <div className="rounded-xl bg-[#F7FAF3] px-1.5 py-3 text-center">
      <div className="font-serif text-xl font-bold text-[var(--ink)]">{value ?? '—'}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[#6B7A5E]">{label}</div>
    </div>
  );
}

function supplementTimePill(timing: string | null): string | null {
  const t = (timing || '').toLowerCase();
  if (t.includes('mañana') || t.includes('desayuno')) return 'Mañana';
  if (t.includes('medio') || t.includes('almuerzo') || t.includes('tarde')) return 'Mediodía';
  if (t.includes('noche') || t.includes('dormir') || t.includes('cena')) return 'Noche';
  return null;
}

const SUPPLEMENT_ICON_PATHS: Record<string, React.ReactNode> = {
  sueño: <path d="M11.5 3.5A6.5 6.5 0 1 0 14.5 16a8 8 0 0 1-3-12.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />,
  adaptógeno: (
    <path
      d="M9 16c-4-1-6-5-4-9 4 0 7 2 8 5 1-3 4-5 8-5 2 4 0 8-4 9-2 .5-3.5.5-4 3-.5-2.5-2-2.5-4-3Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  rendimiento: <path d="M11 2 4 12h5l-1 8 8-11h-5l0-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />,
  nootrópico: (
    <>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 5.5v3.5l2.3 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  base: (
    <>
      <rect x="4" y="2" width="10" height="14" rx="5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M4 9h10" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
};

function SupplementIcon({ category }: { category: string | null }) {
  const key = (category || '').toLowerCase();
  const path = SUPPLEMENT_ICON_PATHS[key] || SUPPLEMENT_ICON_PATHS.base;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {path}
    </svg>
  );
}

// Puerto de printAsPdf + downloadSupplementsPdf (index.html:3548-3987): sin
// dependencias, abre una ventana en blanco con una tabla simple y dispara el
// diálogo de impresión del navegador — "Guardar como PDF" es una opción
// nativa de ese diálogo en todos los navegadores modernos.
function downloadSupplementsPdf(supplements: Supplement[]) {
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Habilita las ventanas emergentes para descargar el PDF.');
    return;
  }
  const rows = supplements
    .map(
      (s) =>
        `<tr><td>${s.name}</td><td>${s.brand || '-'}</td><td>${s.dose || '-'}</td><td>${s.timing || '-'}</td><td>${s.category || '-'}</td><td>${s.benefit || '-'}</td></tr>`
    )
    .join('');
  const table = supplements.length
    ? `<table><tr><th>Nombre</th><th>Marca</th><th>Dosis</th><th>Momento</th><th>Categoría</th><th>Beneficio</th></tr>${rows}</table>`
    : '<p>Sin suplementos asignados.</p>';
  w.document.write(
    `<html><head><title>Esquema de Suplementación</title><style>body{font-family:sans-serif;padding:24px;color:#222}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{padding:8px;border:1px solid #ccc;text-align:left}</style></head><body><h1>Esquema de Suplementación</h1>${table}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

export function ClientNutritionPanel({ clientId }: { clientId: string }) {
  const [plan, setPlan] = useState<NutritionPlan>({});
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [mantra] = useState(() => pickMantra('nutrition'));

  useEffect(() => {
    Promise.all([getNutrition(clientId), listSupplements(clientId).catch(() => [])])
      .then(([{ plan: fetchedPlan }, supplementList]) => {
        setPlan(fetchedPlan);
        setSupplements(supplementList);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const header = (
    <>
      <IdentityHeader title="Nutrición" subtitle="Plan de alimentación y protocolos asignados por tu mentor." />
      {mantra && (
        <p className="mb-[22px] border-b border-[var(--line)] pb-[18px] font-serif text-xl font-medium italic leading-snug text-[var(--ink)]">
          &quot;{mantra}&quot;
        </p>
      )}
    </>
  );

  if (loading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--ink-soft)]">Cargando tu plan de nutrición…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        {header}
        <p role="alert" className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  const menu = Array.isArray(plan.menuPlan) ? plan.menuPlan : [];
  const recommendations = Array.isArray(plan.recommendations) ? plan.recommendations : [];
  const hasPlan = plan.dailyCals != null || menu.length > 0 || !!plan.pdfUrl;

  if (!hasPlan) {
    return (
      <div>
        {header}
        <p className="text-[var(--ink-soft)]">Todavía no tienes un plan de nutrición asignado.</p>
      </div>
    );
  }

  const nextMeal = menu[0];
  const nextMealDish = nextMeal?.options?.[0]?.items?.[0];

  return (
    <div>
      {header}

      {menu.length > 0 && (
        <div
          className="relative mb-6 overflow-hidden rounded-[20px] p-7 text-white"
          style={{ background: 'linear-gradient(135deg, #3E4A34, #4C5C40)' }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,.16) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 flex items-center justify-between gap-5">
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#B7D19A]">
                {nextMeal ? `TU MENÚ · ${nextMeal.name.toUpperCase()}` : 'TU PLAN NUTRICIONAL'}
              </p>
              <p className="mb-1.5 font-serif text-xl font-semibold">{nextMealDish || nextMeal?.name || 'Aún sin menú registrado'}</p>
              {plan.dailyCals ? <p className="text-[13px] opacity-75">Meta: {plan.dailyCals} kcal/día</p> : null}
            </div>
            <div className="flex flex-shrink-0 gap-3.5">
              <MacroRing value={plan.proteinG} label="Prot" />
              <MacroRing value={plan.carbsG} label="Carbs" />
              <MacroRing value={plan.fatG} label="Grasa" />
            </div>
          </div>
        </div>
      )}

      <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Tu objetivo nutricional</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MacroStat value={plan.dailyCals} label="Kcal / día" />
          <MacroStat value={plan.proteinG != null ? `${plan.proteinG}g` : undefined} label="Proteína" />
          <MacroStat value={plan.carbsG != null ? `${plan.carbsG}g` : undefined} label="Carbohidratos" />
          <MacroStat value={plan.fatG != null ? `${plan.fatG}g` : undefined} label="Grasas" />
        </div>
      </section>

      <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Vista previa de tu plan</h2>
        {menu.length ? (
          <>
            <MealBlock meal={menu[0]} isFirst />
            {showAllMeals && menu.slice(1).map((m, i) => <MealBlock key={i} meal={m} isFirst={false} />)}
            <div className="mt-4 flex flex-wrap gap-2.5">
              {plan.pdfUrl && (
                <a
                  href={plan.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center rounded-full bg-[#5B7A4E] px-5 text-sm font-semibold text-white"
                >
                  {plan.pdfName || 'Ver PDF'}
                </a>
              )}
              {menu.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllMeals((v) => !v)}
                  className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[#D9E4CE] px-5 text-sm text-[var(--ink)]"
                >
                  {showAllMeals ? 'Ver menos' : 'Ver más'}
                  <span className={`inline-block transition-transform ${showAllMeals ? 'rotate-180' : ''}`}>⌄</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[var(--ink-soft)]">Tu mentor aún no ha cargado el plan de alimentación.</p>
        )}
      </section>

      {(recommendations.length > 0 || plan.closingMessage) && (
        <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
          {recommendations.length > 0 && (
            <>
              <h2 className="mb-3 font-serif text-lg font-bold text-[var(--ink)]">Recomendaciones</h2>
              <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--ink)]">
                {recommendations.map((r, i) => (
                  <li key={i} className="relative pl-3.5 before:absolute before:left-0 before:top-[8px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#5B7A4E] before:content-['']">
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan.closingMessage && (
            <p className={`font-serif text-base italic leading-relaxed text-[var(--ink)] ${recommendations.length ? 'mt-4 border-t border-[var(--line)] pt-4' : ''}`}>
              &quot;{plan.closingMessage}&quot;
            </p>
          )}
        </section>
      )}

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Esquema de suplementación</h2>
        {supplements.length ? (
          <div>
            {supplements.map((s, i) => {
              const pill = supplementTimePill(s.timing);
              return (
                <div key={s.id} className={`flex items-center gap-3 py-3 ${i === 0 ? '' : 'border-t border-[#E8EEDF]'}`}>
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[#F1F5EC] text-[#5B7A4E]">
                    <SupplementIcon category={s.category} />
                  </div>
                  <div className="flex-1">
                    <div className="font-serif text-sm font-semibold text-[var(--ink)]">{s.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#6B7A5E]">{[s.dose, s.timing].filter(Boolean).join(' · ')}</div>
                  </div>
                  {pill && (
                    <span className="ml-auto flex-shrink-0 whitespace-nowrap rounded-full bg-[#EFF5E8] px-2.5 py-1 text-[10px] font-semibold text-[#5B7A4E]">
                      {pill}
                    </span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => downloadSupplementsPdf(supplements)}
              className="mt-3.5 rounded-full border border-[var(--line)] bg-transparent px-5 py-2.5 text-sm text-[var(--ink)]"
            >
              Descargar PDF
            </button>
          </div>
        ) : (
          <p className="py-6 text-center text-[var(--ink-soft)]">Aún no tienes suplementos asignados.</p>
        )}
      </section>
    </div>
  );
}
