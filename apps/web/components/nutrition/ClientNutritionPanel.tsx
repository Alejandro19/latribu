'use client';

import { useState, type CSSProperties } from 'react';
import useSWR from 'swr';
import { getNutrition, type NutritionPlan, type MenuMeal } from '../../lib/nutrition-client';
import { listSupplements, type Supplement } from '../../lib/supplements-client';
import { listActiveTips, type NutritionTip } from '../../lib/nutrition-tips-client';
import { listActiveRecipes, type Recipe } from '../../lib/recipes-client';
import { PermissionDeniedError } from '../../lib/api-client';
import IdentityHeader from '../ui/IdentityHeader';
import MetricValue from '../ui/MetricValue';
import LockedBenefit from '../ui/LockedBenefit';
import { ProtocolDisclaimerFooter } from '../ui/ProtocolDisclaimerFooter';
import { IconFileDownload } from '../ui/icons';

// Lockup horizontal negro (Documentos/brand/ephirox-lockup-horizontal-negro.svg)
// inlineado sin el bloque <metadata> C2PA (~40KB de manifiesto de
// procedencia, irrelevante para el render) — reemplaza el wordmark de solo
// texto que tenía el PDF antes. Se usa la variante negro (no oro) porque el
// wordmark claro de la variante oro casi no se leía sobre el fondo claro
// del PDF (~1.1:1 de contraste).
const EPHIROX_LOCKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 530 132">
  <circle cx="66" cy="66" r="62" fill="none" stroke="#0B0A08" stroke-width="4" stroke-dasharray="329 60.6" transform="rotate(-61.9 66 66)"></circle>
  <circle cx="66" cy="66" r="47" fill="none" stroke="#0B0A08" stroke-opacity="0.38" stroke-width="3.4" stroke-dasharray="250 45.3" transform="rotate(-242.3 66 66)"></circle>
  <circle cx="66" cy="66" r="6" fill="#0B0A08"></circle>
  <g transform="translate(184.00 88)" fill="#0B0A08"><path d="M28.33 0L28.33 0L2.73 0Q2.60 0 2.60-0.37Q2.60-0.74 2.73-0.74L2.73-0.74Q5.08-0.74 6.26-1.05Q7.44-1.36 7.84-2.29Q8.25-3.22 8.25-5.02L8.25-5.02L8.25-33.73Q8.25-35.53 7.84-36.42Q7.44-37.32 6.26-37.66Q5.08-38.01 2.73-38.01L2.73-38.01Q2.60-38.01 2.60-38.38Q2.60-38.75 2.73-38.75L2.73-38.75L27.28-38.75Q27.84-38.75 27.84-38.19L27.84-38.19L27.96-30.69Q27.96-30.50 27.62-30.50Q27.28-30.50 27.28-30.69L27.28-30.69Q27.28-33.91 25.61-35.74Q23.93-37.57 21.20-37.57L21.20-37.57L16.93-37.57Q14.63-37.57 13.48-37.26Q12.34-36.95 11.94-36.05Q11.53-35.15 11.53-33.36L11.53-33.36L11.53-5.27Q11.53-3.53 11.94-2.67Q12.34-1.80 13.48-1.49Q14.63-1.18 16.93-1.18L16.93-1.18L22.63-1.18Q25.11-1.18 26.91-3.35Q28.71-5.52 29.14-9.05L29.14-9.05Q29.14-9.24 29.51-9.21Q29.88-9.18 29.88-8.99L29.88-8.99Q29.64-7.38 29.48-5.12Q29.33-2.85 29.33-0.93L29.33-0.93Q29.33 0 28.33 0ZM24.86-14.57L24.86-14.57Q24.86-17.36 23.68-18.48Q22.51-19.59 19.53-19.59L19.53-19.59L9.98-19.59L9.98-20.77L19.72-20.77Q22.57-20.77 23.68-21.73Q24.80-22.69 24.80-25.05L24.80-25.05Q24.80-25.17 25.17-25.17Q25.54-25.17 25.54-25.05L25.54-25.05Q25.54-23.25 25.51-22.26Q25.48-21.27 25.48-20.15L25.48-20.15Q25.48-18.79 25.54-17.45Q25.61-16.12 25.61-14.57L25.61-14.57Q25.61-14.45 25.23-14.45Q24.86-14.45 24.86-14.57Z M56.98-33.60L56.98-5.27Q56.98-3.41 57.50-2.45Q58.03-1.49 59.71-1.12Q61.38-0.74 64.73-0.74L64.73-0.74Q64.91-0.74 64.91-0.37Q64.91 0 64.73 0L64.73 0Q62.74 0 60.42-0.06Q58.09-0.12 55.37-0.12L55.37-0.12Q53.38-0.12 51.52-0.06Q49.66 0 48.17 0L48.17 0Q48.05 0 48.05-0.37Q48.05-0.74 48.17-0.74L48.17-0.74Q50.53-0.74 51.71-1.05Q52.89-1.36 53.29-2.29Q53.69-3.22 53.69-5.02L53.69-5.02L53.69-33.73Q53.69-35.53 53.29-36.42Q52.89-37.32 51.71-37.66Q50.53-38.01 48.17-38.01L48.17-38.01Q48.05-38.01 48.05-38.38Q48.05-38.75 48.17-38.75L48.17-38.75Q49.66-38.75 51.49-38.66Q53.32-38.56 55.30-38.56L55.30-38.56Q56.92-38.56 59.21-38.75Q61.50-38.94 63.98-38.94L63.98-38.94Q67.39-38.94 70.18-37.88Q72.97-36.83 74.62-34.60Q76.26-32.36 76.26-28.77L76.26-28.77Q76.26-25.48 75.02-23.13Q73.78-20.77 71.77-19.25Q69.75-17.73 67.33-16.99Q64.91-16.24 62.56-16.24L62.56-16.24Q61.75-16.24 60.98-16.31Q60.20-16.37 59.52-16.55L59.52-16.55Q59.27-16.62 59.36-17.02Q59.46-17.42 59.64-17.36L59.64-17.36Q60.20-17.24 60.79-17.17Q61.38-17.11 61.88-17.11L61.88-17.11Q64.60-17.11 67.02-18.23Q69.44-19.34 70.93-21.67Q72.42-23.99 72.42-27.53L72.42-27.53Q72.42-30.94 71.08-33.29Q69.75-35.65 67.52-36.89Q65.29-38.13 62.56-38.13L62.56-38.13Q60.33-38.13 59.12-37.91Q57.91-37.70 57.44-36.77Q56.98-35.84 56.98-33.60L56.98-33.60Z M127.16-5.02L127.16-33.60Q127.16-35.40 126.79-36.33Q126.42-37.26 125.24-37.63Q124.06-38.01 121.64-38.01L121.64-38.01Q121.46-38.01 121.46-38.38Q121.46-38.75 121.64-38.75L121.64-38.75Q123.07-38.75 124.90-38.66Q126.73-38.56 128.84-38.56L128.84-38.56Q130.82-38.56 132.68-38.66Q134.54-38.75 135.97-38.75L135.97-38.75Q136.15-38.75 136.15-38.38Q136.15-38.01 135.97-38.01L135.97-38.01Q133.61-38.01 132.40-37.66Q131.19-37.32 130.79-36.42Q130.39-35.53 130.39-33.73L130.39-33.73L130.39-5.02Q130.39-3.22 130.79-2.29Q131.19-1.36 132.40-1.05Q133.61-0.74 135.97-0.74L135.97-0.74Q136.15-0.74 136.15-0.37Q136.15 0 135.97 0L135.97 0Q134.54 0 132.68-0.06Q130.82-0.12 128.84-0.12L128.84-0.12Q126.73-0.12 124.90-0.06Q123.07 0 121.64 0L121.64 0Q121.46 0 121.46-0.37Q121.46-0.74 121.64-0.74L121.64-0.74Q124.06-0.74 125.24-1.05Q126.42-1.36 126.79-2.29Q127.16-3.22 127.16-5.02L127.16-5.02ZM128.53-19.59L100.63-19.59L100.63-20.77L128.53-20.77L128.53-19.59ZM99.14-5.02L99.14-5.02L99.14-33.73Q99.14-35.53 98.73-36.42Q98.33-37.32 97.15-37.66Q95.98-38.01 93.62-38.01L93.62-38.01Q93.50-38.01 93.50-38.38Q93.50-38.75 93.62-38.75L93.62-38.75Q95.11-38.75 96.94-38.66Q98.77-38.56 100.75-38.56L100.75-38.56Q102.92-38.56 104.72-38.66Q106.52-38.75 107.94-38.75L107.94-38.75Q108.07-38.75 108.07-38.38Q108.07-38.01 107.94-38.01L107.94-38.01Q105.59-38.01 104.41-37.63Q103.23-37.26 102.83-36.33Q102.42-35.40 102.42-33.60L102.42-33.60L102.42-5.02Q102.42-3.22 102.80-2.29Q103.17-1.36 104.38-1.05Q105.59-0.74 107.94-0.74L107.94-0.74Q108.07-0.74 108.07-0.37Q108.07 0 107.94 0L107.94 0Q106.45 0 104.69-0.06Q102.92-0.12 100.75-0.12L100.75-0.12Q98.77-0.12 96.91-0.06Q95.05 0 93.56 0L93.56 0Q93.43 0 93.43-0.37Q93.43-0.74 93.56-0.74L93.56-0.74Q95.91-0.74 97.12-1.05Q98.33-1.36 98.73-2.29Q99.14-3.22 99.14-5.02Z M162.63-33.60L162.63-5.02Q162.63-3.22 163.00-2.29Q163.37-1.36 164.58-1.05Q165.79-0.74 168.14-0.74L168.14-0.74Q168.27-0.74 168.27-0.37Q168.27 0 168.14 0L168.14 0Q166.66 0 164.86-0.06Q163.06-0.12 160.89-0.12L160.89-0.12Q158.84-0.12 157.01-0.06Q155.19 0 153.70 0L153.70 0Q153.51 0 153.51-0.37Q153.51-0.74 153.70-0.74L153.70-0.74Q156.05-0.74 157.26-1.05Q158.47-1.36 158.87-2.29Q159.28-3.22 159.28-5.02L159.28-5.02L159.28-33.73Q159.28-35.53 158.87-36.42Q158.47-37.32 157.26-37.66Q156.05-38.01 153.70-38.01L153.70-38.01Q153.51-38.01 153.51-38.38Q153.51-38.75 153.70-38.75L153.70-38.75Q155.19-38.75 157.01-38.66Q158.84-38.56 160.89-38.56L160.89-38.56Q163.06-38.56 164.89-38.66Q166.72-38.75 168.14-38.75L168.14-38.75Q168.27-38.75 168.27-38.38Q168.27-38.01 168.14-38.01L168.14-38.01Q165.79-38.01 164.61-37.63Q163.43-37.26 163.03-36.33Q162.63-35.40 162.63-33.60L162.63-33.60Z M218.30 0L218.30 0Q217.25 0 214.83-2.42Q212.41-4.84 209.00-9.33Q205.59-13.83 201.38-19.96L201.38-19.96L204.35-20.89Q209.68-13.39 213.40-8.96Q217.12-4.53 219.98-2.63Q222.83-0.74 225.49-0.74L225.49-0.74Q225.68-0.74 225.68-0.37Q225.68 0 225.49 0L225.49 0Q222.70 0 220.94 0Q219.17 0 218.30 0ZM202.12-38.94L202.12-38.94Q206.89-38.94 209.41-36.64Q211.92-34.35 211.92-30.69L211.92-30.69Q211.92-27.40 209.99-24.74Q208.07-22.07 204.88-20.52Q201.69-18.97 197.84-18.97L197.84-18.97Q197.28-18.97 196.54-19.03Q195.80-19.10 195.18-19.16L195.18-19.16L195.18-5.02Q195.18-3.22 195.55-2.29Q195.92-1.36 197.13-1.05Q198.34-0.74 200.69-0.74L200.69-0.74Q200.88-0.74 200.88-0.37Q200.88 0 200.69 0L200.69 0Q199.21 0 197.44-0.06Q195.67-0.12 193.50-0.12L193.50-0.12Q191.52-0.12 189.66-0.06Q187.80 0 186.31 0L186.31 0Q186.19 0 186.19-0.37Q186.19-0.74 186.31-0.74L186.31-0.74Q188.67-0.74 189.88-1.05Q191.08-1.36 191.52-2.29Q191.95-3.22 191.95-5.02L191.95-5.02L191.95-33.73Q191.95-35.53 191.55-36.42Q191.15-37.32 189.97-37.66Q188.79-38.01 186.43-38.01L186.43-38.01Q186.25-38.01 186.25-38.38Q186.25-38.75 186.43-38.75L186.43-38.75Q187.86-38.75 189.69-38.66Q191.52-38.56 193.50-38.56L193.50-38.56Q195.42-38.56 197.97-38.75Q200.51-38.94 202.12-38.94ZM208.44-29.02L208.44-29.02Q208.44-32.36 207.36-34.35Q206.27-36.33 204.26-37.23Q202.24-38.13 199.39-38.13L199.39-38.13Q197.16-38.13 196.17-37.32Q195.18-36.52 195.18-33.60L195.18-33.60L195.18-20.58Q196.04-20.52 197.07-20.46Q198.09-20.40 198.90-20.40L198.90-20.40Q204.23-20.40 206.34-22.63Q208.44-24.86 208.44-29.02Z M260.03 0.74L260.03 0.74Q255.56 0.74 251.94-0.84Q248.31-2.42 245.74-5.21Q243.16-8.00 241.77-11.63Q240.37-15.25 240.37-19.34L240.37-19.34Q240.37-24.37 242.33-28.15Q244.28-31.93 247.50-34.44Q250.73-36.95 254.57-38.19Q258.42-39.43 262.20-39.43L262.20-39.43Q266.79-39.43 270.41-37.79Q274.04-36.15 276.58-33.36Q279.12-30.57 280.46-27.03Q281.79-23.50 281.79-19.78L281.79-19.78Q281.79-15.44 280.05-11.72Q278.32-8.00 275.31-5.21Q272.30-2.42 268.37-0.84Q264.43 0.74 260.03 0.74ZM262.26-0.50L262.26-0.50Q266.60-0.50 270.13-2.51Q273.67-4.53 275.75-8.46Q277.82-12.40 277.82-18.04L277.82-18.04Q277.82-23.93 275.56-28.43Q273.30-32.92 269.20-35.49Q265.11-38.07 259.59-38.07L259.59-38.07Q252.40-38.07 248.37-33.60Q244.34-29.14 244.34-21.45L244.34-21.45Q244.34-17.11 245.61-13.30Q246.88-9.49 249.27-6.60Q251.66-3.72 254.94-2.11Q258.23-0.50 262.26-0.50Z M322.96 0L322.96 0Q322.83 0 322.83-0.37Q322.83-0.74 322.96-0.74L322.96-0.74Q325.50-0.74 326.15-1.27Q326.80-1.80 325.87-3.16L325.87-3.16L305.72-33.60Q304.11-36.02 302.50-37.01Q300.89-38.01 298.65-38.01L298.65-38.01Q298.53-38.01 298.53-38.38Q298.53-38.75 298.65-38.75L298.65-38.75Q299.77-38.75 300.98-38.66Q302.19-38.56 303.24-38.56L303.24-38.56Q305.72-38.56 307.80-38.66Q309.88-38.75 311.43-38.75L311.43-38.75Q311.61-38.75 311.61-38.38Q311.61-38.01 311.43-38.01L311.43-38.01Q308.88-38.01 308.26-37.45Q307.64-36.89 308.51-35.53L308.51-35.53L328.72-5.15Q330.34-2.67 332.07-1.71Q333.81-0.74 336.47-0.74L336.47-0.74Q336.60-0.74 336.60-0.37Q336.60 0 336.47 0L336.47 0Q335.23 0 333.75-0.06Q332.26-0.12 330.65-0.12L330.65-0.12Q328.23-0.12 326.40-0.06Q324.57 0 322.96 0ZM298.47 0L298.47 0Q298.28 0 298.28-0.37Q298.28-0.74 298.47-0.74L298.47-0.74Q300.58-0.74 302.59-2.02Q304.61-3.29 306.34-5.70L306.34-5.70L316.14-19.16L316.82-18.54L307.64-5.70Q305.91-3.29 306.59-2.02Q307.27-0.74 310.19-0.74L310.19-0.74Q310.37-0.74 310.37-0.37Q310.37 0 310.19 0L310.19 0Q308.57 0 307.12-0.06Q305.66-0.12 303.24-0.12L303.24-0.12Q301.69-0.12 300.76-0.06Q299.83 0 298.47 0ZM327.11-32.43L317.75-19.59L317.07-20.15L325.81-32.49Q327.73-35.22 327.17-36.61Q326.62-38.01 323.70-38.01L323.70-38.01Q323.52-38.01 323.52-38.38Q323.52-38.75 323.70-38.75L323.70-38.75Q325.31-38.75 326.80-38.66Q328.29-38.56 330.65-38.56L330.65-38.56Q332.20-38.56 333.13-38.66Q334.06-38.75 335.42-38.75L335.42-38.75Q335.61-38.75 335.61-38.38Q335.61-38.01 335.42-38.01L335.42-38.01Q333.31-38.01 331.20-36.55Q329.10-35.09 327.11-32.43L327.11-32.43Z"></path></g>
</svg>`;

function MealIcon({ name }: { name: string }) {
  const isSnack = /snack|merienda|fruta|colaci[oó]n/i.test(name || '');
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mr-2 flex-shrink-0 text-[var(--eph-accent)]">
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
    <div className={`py-3.5 ${isFirst ? '' : 'border-t border-[var(--eph-line)]'}`}>
      <div className="mb-2 flex items-center font-display text-base font-normal text-[var(--eph-text)]">
        <MealIcon name={meal.name} />
        {meal.name}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(meal.options || []).map((opt, i) => (
          <div key={i}>
            <p className="mb-1 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--eph-accent)]">{opt.label}</p>
            <ul className="space-y-1 text-sm leading-relaxed text-[var(--eph-text)]">
              {opt.items.map((item, j) => (
                <li key={j} className="relative pl-3.5 before:absolute before:left-0 before:top-[8px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[var(--eph-accent)] before:content-['']">
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

// Tira de macros (spec Prompt 02 §2). Sin barra de "meta" real: el plan solo
// guarda el gramaje que el mentor asignó, no un objetivo separado ni datos
// de consumo del día — un riel o estado "en rango" fingirían un progreso
// que no existe. La franja dorada queda fija (acento visual, no medición).
// Sin macro de Agua: no hay ningún campo de hidratación en NutritionPlan.
function MacroCard({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div style={{ background: 'var(--eph-surface)', padding: '28px 26px', display: 'grid', gap: 20, alignContent: 'start' }}>
      <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--eph-steel)' }}>{label}</span>
      <MetricValue value={value ?? '—'} unit={value != null ? unit : undefined} size="kpi" />
      <div style={{ height: 2, background: 'var(--eph-line-2)' }}>
        <div style={{ height: '100%', background: 'var(--eph-accent)' }} />
      </div>
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

// Puerto de downloadNutritionPdf (index.html:3865-3969, arquitectura previa
// al monorepo): genera un PDF con la identidad de marca (portada, macros,
// menú, recomendaciones, suplementos y cierre) abriendo una ventana en
// blanco y disparando el diálogo de impresión — "Guardar como PDF" es una
// opción nativa de ese diálogo en todos los navegadores modernos. Reemplaza
// el enlace a un PDF subido manualmente por el admin: el documento se arma
// siempre a partir de los datos vigentes del plan.
const NUTRITION_PDF_CSS = `
@page{margin:0;}
*{box-sizing:border-box;}
body{font-family:'Jost',Arial,sans-serif;color:#1C1613;background:#EDE6DC;padding:26mm 20mm 10mm;max-width:760px;margin:0 auto;}
.pdf-meal,.pdf-supp-row,.pdf-closing,.pdf-section{break-inside:avoid;page-break-inside:avoid;}
.pdf-meal,.pdf-section{padding-top:12mm;}
.pdf-header{display:flex;flex-direction:column;align-items:flex-start;text-align:left;margin-top:0;}
.pdf-lockup-header{width:210px;}
.pdf-lockup-header svg,.pdf-lockup-footer svg{display:block;width:100%;height:auto;}
.pdf-tagline{font-size:9pt;color:#8A8377;margin:4px 0 14px 74px;}
.pdf-rule{border:none;border-top:1.5px solid #C9A46A;margin:0 0 40px;}
.pdf-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:19pt;line-height:1.25;color:#2B2621;margin:0 0 6px;text-align:center;}
.pdf-summary{font-size:9.5pt;line-height:1.6;color:#6B6459;text-align:left;max-width:560px;margin:0 0 24px;}
.pdf-summary strong{color:#2B2621;}
.pdf-macros{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E7DFC9;border-radius:0;overflow:hidden;margin:0 0 28px;}
.pdf-macros > div{padding:12px 6px;text-align:center;border-left:1px solid #E7DFC9;}
.pdf-macros > div:first-child{border-left:none;}
.pdf-macros .pm-val{display:block;font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;color:#2B2621;}
.pdf-macros .pm-lbl{font-size:8pt;color:#8A8377;text-transform:uppercase;letter-spacing:.04em;}
.pdf-meal{margin-bottom:22px;}
.pdf-meal-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;line-height:1.25;color:#2B2621;margin:0 0 4px;}
.pdf-meal-rule{border:none;border-top:1px solid #E7DFC9;margin:0 0 10px;}
.pdf-options{display:flex;gap:26px;}
.pdf-option{flex:1;}
.pdf-option-label{font-size:9pt;font-weight:700;color:#B36B5E;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;}
.pdf-option ul{margin:0;padding-left:16px;font-size:10.5pt;line-height:1.55;}
.pdf-section-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;line-height:1.25;color:#2B2621;margin:0 0 12px;padding-bottom:6px;border-bottom:1.5px solid #E7DFC9;}
.pdf-supp-section{background:#E4DBC9;border-radius:0;padding:18px 20px;padding-top:12mm;}
.pdf-supp-title{color:#C9A46A;border-bottom-color:#C9A46A;}
.pdf-reco ul{margin:0;padding-left:16px;font-size:10.5pt;line-height:1.6;}
.pdf-supp-row{margin-bottom:10px;}
.pdf-supp-name{font-weight:700;font-size:11pt;}
.pdf-supp-detail{font-size:9.5pt;color:#8A8377;margin-top:2px;}
.pdf-closing{text-align:center;margin:20px 0 4px;padding-top:12mm;}
.pdf-closing-rule{width:30%;margin:0 auto 16px;border:none;border-top:1px solid #E7DFC9;}
.pdf-closing-quote{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:12pt;line-height:1.5;color:#2B2621;}
.pdf-footer{text-align:center;margin-top:24px;page-break-inside:avoid;break-inside:avoid;}
.pdf-lockup-footer{width:130px;margin:0 auto 6px;}
.pdf-footer-tagline{font-size:8pt;color:#8A8377;margin:0;}
`;

function mdBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function downloadNutritionPdf(plan: NutritionPlan, supplements: Supplement[]) {
  const menu = Array.isArray(plan.menuPlan) ? plan.menuPlan : [];
  const recommendations = Array.isArray(plan.recommendations) ? plan.recommendations : [];
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Habilita las ventanas emergentes para descargar el PDF.');
    return;
  }
  const mealsHtml = menu.length
    ? menu
        .map(
          (m) => `
      <div class="pdf-meal">
        <div class="pdf-meal-title">${m.name}</div>
        <hr class="pdf-meal-rule">
        <div class="pdf-options">
          ${(m.options || [])
            .map(
              (o) => `
            <div class="pdf-option">
              <p class="pdf-option-label">${o.label}</p>
              <ul>${(o.items || []).map((it) => `<li>${it}</li>`).join('')}</ul>
            </div>`
            )
            .join('')}
        </div>
      </div>`
        )
        .join('')
    : '<p style="font-size:10.5pt;color:#8A8377;">Tu mentor aún no ha cargado el menú de este plan.</p>';
  const hasMacros = plan.dailyCals || plan.proteinG || plan.carbsG || plan.fatG;
  const macrosHtml = hasMacros
    ? `<div class="pdf-macros">
        <div><span class="pm-val">${plan.dailyCals || '—'}</span><span class="pm-lbl">Kcal</span></div>
        <div><span class="pm-val">${plan.proteinG || '—'}g</span><span class="pm-lbl">Proteína</span></div>
        <div><span class="pm-val">${plan.carbsG || '—'}g</span><span class="pm-lbl">Carbohidratos</span></div>
        <div><span class="pm-val">${plan.fatG || '—'}g</span><span class="pm-lbl">Grasas</span></div>
      </div>`
    : '';
  const recoHtml = recommendations.length
    ? `<div class="pdf-reco pdf-section"><p class="pdf-section-title">Recomendaciones adicionales</p><ul>${recommendations
        .map((r) => `<li>${r}</li>`)
        .join('')}</ul></div>`
    : '';
  const suppHtml = supplements.length
    ? `<div class="pdf-section pdf-supp-section"><p class="pdf-section-title pdf-supp-title">Esquema de suplementación</p>${supplements
        .map(
          (s) =>
            `<div class="pdf-supp-row"><div class="pdf-supp-name">${s.name}</div><div class="pdf-supp-detail">${
              [s.dose, s.timing].filter(Boolean).join(' · ') || s.benefit || ''
            }</div></div>`
        )
        .join('')}</div>`
    : '';
  const closingHtml = plan.closingMessage
    ? `<div class="pdf-closing"><hr class="pdf-closing-rule"><p class="pdf-closing-quote">${plan.closingMessage}</p></div>`
    : '';
  w.document.write(
    `<!doctype html><html><head><title>Plan nutricional</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,500&family=Jost:wght@400;600&display=swap" rel="stylesheet">
    <style>${NUTRITION_PDF_CSS}</style></head><body>
    <div class="pdf-header">
      <div class="pdf-lockup-header">${EPHIROX_LOCKUP_SVG}</div>
      <p class="pdf-tagline">Redefining limits.</p>
    </div>
    <hr class="pdf-rule">
    <p class="pdf-title">Plan nutricional</p>
    ${plan.summary ? `<p class="pdf-summary">${mdBold(plan.summary)}</p>` : ''}
    ${macrosHtml}
    ${mealsHtml}
    ${recoHtml}
    ${suppHtml}
    ${closingHtml}
    <div class="pdf-footer">
      <div class="pdf-lockup-footer">${EPHIROX_LOCKUP_SVG}</div>
      <p class="pdf-footer-tagline">Redefining limits.</p>
    </div>
    </body></html>`
  );
  w.document.close();
  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    w.focus();
    w.print();
  };
  if (w.document.fonts && w.document.fonts.ready) {
    Promise.race([w.document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 500))])
      .then(triggerPrint)
      .catch(triggerPrint);
  } else {
    setTimeout(triggerPrint, 150);
  }
}

async function fetchNutritionBundle(clientId: string) {
  const [{ plan }, supplements, tips, recipes] = await Promise.all([
    getNutrition(clientId),
    listSupplements(clientId).catch(() => []),
    listActiveTips(clientId).catch(() => []),
    listActiveRecipes(clientId).catch(() => []),
  ]);
  return { plan, supplements, tips, recipes };
}

// Cabecera de página del módulo (spec Prompt 02 §3): centrada, ancho máximo
// 1320px, ritmo de gap:26px entre bloques en vez de márgenes ad-hoc por sección.
const PAGE_MAIN_STYLE: CSSProperties = {
  padding: 'clamp(34px, 4.5vw, 60px) clamp(20px, 4vw, 52px) 90px',
  maxWidth: 1320,
  margin: '0 auto',
  display: 'grid',
  gap: 26,
};

export function ClientNutritionPanel({ clientId, clientType }: { clientId: string; clientType?: string | null }) {
  const [showAllMeals, setShowAllMeals] = useState(false);
  const { data, error, isLoading } = useSWR(['nutrition-bundle', clientId], () => fetchNutritionBundle(clientId));

  const header = <IdentityHeader title="Nutrition" subtitle="Combustible calibrado a tu carga cognitiva del día" />;

  if (isLoading) {
    return (
      <main style={PAGE_MAIN_STYLE}>
        {header}
        <p className="text-sm text-[var(--eph-muted)]">Cargando tu plan de nutrición…</p>
      </main>
    );
  }
  if (error instanceof PermissionDeniedError) {
    return (
      <main style={PAGE_MAIN_STYLE}>
        {header}
        <LockedBenefit benefit="tu plan de nutrición" />
      </main>
    );
  }
  if (error) {
    return (
      <main style={PAGE_MAIN_STYLE}>
        {header}
        <p role="alert" className="text-[var(--eph-danger)]">{(error as Error).message}</p>
      </main>
    );
  }
  if (!data) return null;

  const { plan, supplements, tips, recipes } = data;
  const menu = Array.isArray(plan.menuPlan) ? plan.menuPlan : [];
  const recommendations = Array.isArray(plan.recommendations) ? plan.recommendations : [];
  const hasPlan = plan.dailyCals != null || menu.length > 0 || !!plan.pdfUrl;

  if (!hasPlan) {
    return (
      <main style={PAGE_MAIN_STYLE}>
        {header}
        <p className="text-[var(--eph-muted)]">Todavía no tienes un plan de nutrición asignado.</p>
      </main>
    );
  }

  return (
    <main style={PAGE_MAIN_STYLE}>
      {header}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 1, background: 'var(--eph-line-2)', border: '1px solid var(--eph-line-2)' }}
      >
        <MacroCard label="Proteína" value={plan.proteinG} unit="G" />
        <MacroCard label="Carbohidrato" value={plan.carbsG} unit="G" />
        <MacroCard label="Grasa" value={plan.fatG} unit="G" />
      </div>

      <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <h2 className="mb-4 font-display text-lg font-normal text-[var(--eph-text)]">Vista previa de tu plan</h2>
        {menu.length ? (
          <>
            <MealBlock meal={menu[0]} isFirst />
            {showAllMeals && menu.slice(1).map((m, i) => <MealBlock key={i} meal={m} isFirst={false} />)}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => downloadNutritionPdf(plan, supplements)}
                className="inline-flex h-12 items-center rounded-[999px] bg-[var(--eph-accent)] px-5 text-sm font-medium text-[var(--eph-ink)]"
              >
                Descargar PDF
              </button>
              {menu.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllMeals((v) => !v)}
                  className="inline-flex h-12 items-center gap-1.5 rounded-full border border-[var(--eph-line-2)] px-5 text-sm text-[var(--eph-text)]"
                >
                  {showAllMeals ? 'Ver menos' : 'Ver más'}
                  <span className={`inline-block transition-transform ${showAllMeals ? 'rotate-180' : ''}`}>⌄</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[var(--eph-muted)]">Tu mentor aún no ha cargado el plan de alimentación.</p>
        )}
      </section>

      {(recommendations.length > 0 || plan.closingMessage) && (
        <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
          {recommendations.length > 0 && (
            <>
              <h2 className="mb-3 font-display text-lg font-normal text-[var(--eph-text)]">Recomendaciones</h2>
              <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--eph-text)]">
                {recommendations.map((r, i) => (
                  <li key={i} className="relative pl-3.5 before:absolute before:left-0 before:top-[8px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[var(--eph-accent)] before:content-['']">
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan.closingMessage && (
            <p className={`font-display text-base italic leading-relaxed text-[var(--eph-text)] ${recommendations.length ? 'mt-4 border-t border-[var(--eph-line)] pt-4' : ''}`}>
              &quot;{plan.closingMessage}&quot;
            </p>
          )}
        </section>
      )}

      <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <h2 className="mb-4 font-display text-lg font-normal text-[var(--eph-text)]">Esquema de suplementación</h2>
        {supplements.length ? (
          <div>
            {supplements.map((s, i) => {
              const pill = supplementTimePill(s.timing);
              return (
                <div key={s.id} className={`flex items-center gap-3 py-3 ${i === 0 ? '' : 'border-t border-[var(--eph-line)]'}`}>
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--eph-surface-2)]" style={{ color: 'var(--eph-accent)' }}>
                    <SupplementIcon category={s.category} />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-sm font-normal text-[var(--eph-text)]">{s.name}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--eph-muted)]">{[s.dose, s.timing].filter(Boolean).join(' · ')}</div>
                  </div>
                  {pill && (
                    <span
                      className="ml-auto flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold"
                      style={{ background: 'var(--eph-line)', color: 'var(--eph-accent)' }}
                    >
                      {pill}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-[var(--eph-muted)]">Aún no tienes suplementos asignados.</p>
        )}
      </section>

      {recipes.length > 0 && (
        <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
          <h2 className="mb-4 font-display text-lg font-normal text-[var(--eph-text)]">Recetas saludables</h2>
          <div>
            {recipes.map((recipe: Recipe, i: number) => (
              <div key={recipe.id} className={`flex items-center gap-3 py-3 ${i === 0 ? '' : 'border-t'}`} style={{ borderColor: 'var(--eph-line)', borderTopWidth: i === 0 ? 0 : '0.5px' }}>
                <span aria-hidden className="flex-shrink-0" style={{ color: 'var(--eph-accent)' }}>
                  <IconFileDownload size={18} />
                </span>
                <p className="flex-1 truncate font-display text-sm font-normal text-[var(--eph-text)]">{recipe.name}</p>
                <div className="flex flex-shrink-0 gap-2.5">
                  <a
                    href={recipe.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border px-3.5 py-1.5 text-xs font-semibold text-[var(--eph-text)]"
                    style={{ borderColor: 'var(--eph-line-2)' }}
                  >
                    Ver
                  </a>
                  <a
                    href={recipe.pdfUrl}
                    download={recipe.pdfName}
                    className="rounded-full border px-3.5 py-1.5 text-xs font-semibold text-[var(--eph-text)]"
                    style={{ borderColor: 'var(--eph-line-2)' }}
                  >
                    Descargar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tips.length > 0 && (
        <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
          <h2 className="mb-4 font-display text-lg font-normal text-[var(--eph-text)]">Tips and tricks</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--eph-text)]">
            {tips.map((tip: NutritionTip) => (
              <li key={tip.id} className="relative pl-3.5 before:absolute before:left-0 before:top-[8px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[var(--eph-accent)] before:content-['']">
                {tip.content}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ProtocolDisclaimerFooter />
    </main>
  );
}
