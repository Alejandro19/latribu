'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getNutrition, saveNutritionPlan, uploadNutritionPdf, type NutritionPlan, type MenuMeal } from '../../lib/nutrition-client';
import { listSupplements, createSupplement, updateSupplement, deleteSupplement, type Supplement } from '../../lib/supplements-client';
import { showToast } from '../layout/AppShell';

export type AdminNutritionPanelProps = { clientId: string };

// Borrador de comida del menú: mientras se edita solo vive acá — igual que
// AdminTrainingPanel, nada se persiste hasta "Guardar plan". opt1/opt2 son
// texto libre (un alimento por línea) que se parte en arrays recién al
// guardar, reflejando el shape real de menu_plan: [{ name, options: [{label,
// items[]}, {label, items[]}] }] (ver index.html:3825-3833, fuente legacy).
type MenuRowDraft = { key: string; name: string; opt1: string; opt2: string };
type SupplementRowDraft = { key: string; id: string | null; name: string; brand: string; dose: string; timing: string };

function menuToRows(menu: MenuMeal[] | null | undefined): MenuRowDraft[] {
  const list = Array.isArray(menu) ? menu : [];
  if (!list.length) return [{ key: 'new-0', name: '', opt1: '', opt2: '' }];
  return list.map((m, i) => ({
    key: `existing-${i}`,
    name: m.name || '',
    opt1: (m.options?.[0]?.items || []).join('\n'),
    opt2: (m.options?.[1]?.items || []).join('\n'),
  }));
}

function supplementsToRows(list: Supplement[]): SupplementRowDraft[] {
  if (!list.length) return [{ key: 'new-0', id: null, name: '', brand: '', dose: '', timing: '' }];
  return list.map((s) => ({ key: s.id, id: s.id, name: s.name || '', brand: s.brand || '', dose: s.dose || '', timing: s.timing || '' }));
}

const cardStyle: React.CSSProperties = {
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px',
};
const sectionLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', margin: '18px 0 8px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  ...fieldStyle, height: 'auto', minHeight: 72, padding: 10, resize: 'vertical', fontFamily: 'inherit',
};
const draftCardStyle: React.CSSProperties = {
  background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 10,
};
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--line)',
  background: 'transparent', color: 'var(--ink-soft)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--danger)',
  background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
};

export function AdminNutritionPanel({ clientId }: AdminNutritionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<NutritionPlan>({});

  const [summary, setSummary] = useState('');
  const [dailyCals, setDailyCals] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [menuRows, setMenuRows] = useState<MenuRowDraft[]>([]);
  const [supplementRows, setSupplementRows] = useState<SupplementRowDraft[]>([]);
  const [deletedSupplementIds, setDeletedSupplementIds] = useState<string[]>([]);
  const draftCounter = useRef(0);

  const refetch = useCallback(async () => {
    const [{ plan: fetchedPlan }, supplements] = await Promise.all([
      getNutrition(clientId),
      listSupplements(clientId).catch(() => []),
    ]);
    setPlan(fetchedPlan);
    setSummary(fetchedPlan.summary || '');
    setDailyCals(fetchedPlan.dailyCals != null ? String(fetchedPlan.dailyCals) : '');
    setProteinG(fetchedPlan.proteinG != null ? String(fetchedPlan.proteinG) : '');
    setCarbsG(fetchedPlan.carbsG != null ? String(fetchedPlan.carbsG) : '');
    setFatG(fetchedPlan.fatG != null ? String(fetchedPlan.fatG) : '');
    setRecommendations((fetchedPlan.recommendations || []).join('\n'));
    setClosingMessage(fetchedPlan.closingMessage || '');
    setMenuRows(menuToRows(fetchedPlan.menuPlan));
    setSupplementRows(supplementsToRows(supplements));
    setDeletedSupplementIds([]);
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refetch]);

  function addMenuRow() {
    draftCounter.current += 1;
    setMenuRows((prev) => [...prev, { key: `new-${draftCounter.current}`, name: '', opt1: '', opt2: '' }]);
  }
  function updateMenuRow(key: string, patch: Partial<MenuRowDraft>) {
    setMenuRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeMenuRow(key: string) {
    setMenuRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [{ key: `new-${++draftCounter.current}`, name: '', opt1: '', opt2: '' }];
    });
  }

  function addSupplementRow() {
    draftCounter.current += 1;
    setSupplementRows((prev) => [...prev, { key: `new-${draftCounter.current}`, id: null, name: '', brand: '', dose: '', timing: '' }]);
  }
  function updateSupplementRow(key: string, patch: Partial<SupplementRowDraft>) {
    setSupplementRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeSupplementRow(key: string) {
    setSupplementRows((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row?.id) setDeletedSupplementIds((ids) => [...ids, row.id as string]);
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [{ key: `new-${++draftCounter.current}`, id: null, name: '', brand: '', dose: '', timing: '' }];
    });
  }

  async function handleUploadPdf(file: File) {
    try {
      const updated = await uploadNutritionPdf(clientId, file);
      setPlan(updated);
      showToast('PDF cargado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const menu_plan: MenuMeal[] = menuRows
        .filter((m) => m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          options: [
            { label: 'Opción 1', items: m.opt1.split('\n').map((s) => s.trim()).filter(Boolean) },
            { label: 'Opción 2', items: m.opt2.split('\n').map((s) => s.trim()).filter(Boolean) },
          ],
        }));

      await saveNutritionPlan(clientId, {
        daily_cals: dailyCals ? Number(dailyCals) : 0,
        protein_g: proteinG ? Number(proteinG) : 0,
        carbs_g: carbsG ? Number(carbsG) : 0,
        fat_g: fatG ? Number(fatG) : 0,
        summary: summary || '',
        menu_plan,
        recommendations: recommendations.split('\n').map((s) => s.trim()).filter(Boolean),
        closing_message: closingMessage || '',
      });

      for (const id of deletedSupplementIds) {
        await deleteSupplement(clientId, id);
      }
      for (const s of supplementRows) {
        if (!s.name.trim()) continue;
        const body = { name: s.name.trim(), brand: s.brand || undefined, dose: s.dose || undefined, timing: s.timing || undefined };
        if (s.id) await updateSupplement(clientId, s.id, body);
        else await createSupplement(clientId, body);
      }

      await refetch();
      showToast('Plan guardado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando plan de nutrición…</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Plan nutricional (admin)</h3>

        <label style={labelStyle} htmlFor="nt-summary">
          Resumen del cliente (una línea, como nota clínica — separa cada campo con &quot; · &quot; para que quede parejo)
        </label>
        <textarea
          id="nt-summary"
          rows={2}
          style={textareaStyle}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Ej. **Perfil:** Hombre · **Edad:** 50 años · **Peso:** 73 kg · **Estatura:** 1.71 m · **Objetivo:** Recomposición corporal con enfoque antiinflamatorio."
        />

        <label style={sectionLabelStyle}>Macronutrientes diarios</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="nt-cals">Calorías</label>
            <input id="nt-cals" type="number" style={fieldStyle} value={dailyCals} onChange={(e) => setDailyCals(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="nt-protein">Proteína (g)</label>
            <input id="nt-protein" type="number" style={fieldStyle} value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="nt-carbs">Carbohidratos (g)</label>
            <input id="nt-carbs" type="number" style={fieldStyle} value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="nt-fat">Grasas (g)</label>
            <input id="nt-fat" type="number" style={fieldStyle} value={fatG} onChange={(e) => setFatG(e.target.value)} />
          </div>
        </div>

        <label style={labelStyle} htmlFor="nt-pdf">PDF del plan (opcional)</label>
        <input
          id="nt-pdf"
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadPdf(file);
          }}
        />
        {plan.pdfUrl && (
          <a href={plan.pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--terracota)' }}>
            {plan.pdfName || 'Ver PDF'}
          </a>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Menú (comidas con Opción 1 / Opción 2)</h3>
        {menuRows.map((row) => (
          <div key={row.key} style={draftCardStyle}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...fieldStyle, flex: 1, fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600 }}
                placeholder="Nombre de la comida (ej. Desayuno)"
                value={row.name}
                onChange={(e) => updateMenuRow(row.key, { name: e.target.value })}
              />
              <button type="button" style={dangerButtonStyle} onClick={() => removeMenuRow(row.key)}>
                Eliminar
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 10 }}>
              <div>
                <label style={labelStyle} htmlFor={`opt1-${row.key}`}>Opción 1 (un alimento por línea)</label>
                <textarea
                  id={`opt1-${row.key}`}
                  rows={4}
                  style={textareaStyle}
                  value={row.opt1}
                  onChange={(e) => updateMenuRow(row.key, { opt1: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor={`opt2-${row.key}`}>Opción 2 (un alimento por línea)</label>
                <textarea
                  id={`opt2-${row.key}`}
                  rows={4}
                  style={textareaStyle}
                  value={row.opt2}
                  onChange={(e) => updateMenuRow(row.key, { opt2: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
        <button type="button" style={ghostButtonStyle} onClick={addMenuRow}>
          + Agregar comida
        </button>

        <label style={{ ...sectionLabelStyle }} htmlFor="nt-recommendations">
          Recomendaciones adicionales (una por línea)
        </label>
        <textarea
          id="nt-recommendations"
          rows={3}
          style={textareaStyle}
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
        />

        <label style={labelStyle} htmlFor="nt-closing">
          Mensaje de cierre (cita del PDF)
        </label>
        <textarea id="nt-closing" rows={2} style={textareaStyle} value={closingMessage} onChange={(e) => setClosingMessage(e.target.value)} />
      </div>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Suplementos</h3>
        {supplementRows.map((row) => (
          <div key={row.key} style={draftCardStyle}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                style={{ ...fieldStyle, flex: 1, fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600 }}
                placeholder="Nombre del suplemento"
                value={row.name}
                onChange={(e) => updateSupplementRow(row.key, { name: e.target.value })}
              />
              <button type="button" style={dangerButtonStyle} onClick={() => removeSupplementRow(row.key)}>
                Eliminar
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor={`brand-${row.key}`}>Marca</label>
                <input id={`brand-${row.key}`} style={fieldStyle} value={row.brand} onChange={(e) => updateSupplementRow(row.key, { brand: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor={`dose-${row.key}`}>Dosis</label>
                <input id={`dose-${row.key}`} style={fieldStyle} value={row.dose} onChange={(e) => updateSupplementRow(row.key, { dose: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor={`timing-${row.key}`}>Momento</label>
                <input id={`timing-${row.key}`} style={fieldStyle} value={row.timing} onChange={(e) => updateSupplementRow(row.key, { timing: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" style={{ ...ghostButtonStyle, marginBottom: 18 }} onClick={addSupplementRow}>
          + Agregar suplemento
        </button>
        <br />
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          style={{
            height: 44, padding: '0 28px', borderRadius: 9999, border: 'none',
            background: 'var(--sage)', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando…' : 'Guardar plan'}
        </button>
      </div>
    </div>
  );
}
