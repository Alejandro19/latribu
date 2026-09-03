'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetchClients, type ClientSummary } from '@/lib/clients-client';
import {
  adminListCases,
  adminGetCase,
  adminCreateCase,
  adminUpdateCase,
  adminAcknowledgeCrisis,
  adminListTherapists,
  type BlindspotCase,
  type BlindspotCaseStatus,
  type Therapist,
} from '@/lib/blindspot-client';
import { showToast } from '@/components/layout/AppShell';
import { InsightsSection } from '@/components/insights/InsightsSection';

type ClientOption = ClientSummary;

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: '0', padding: '22px 24px', marginBottom: 20,
};
const cardTitleStyle: React.CSSProperties = { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 16px' };
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 400, color: 'var(--eph-muted)', marginBottom: 6,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 32, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--eph-line-2)',
  padding: '0 2px 6px', fontSize: 15, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: 0, border: '1px solid var(--eph-line)',
  padding: 10, fontSize: 15, fontWeight: 400, background: 'var(--eph-surface)', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box', minHeight: 72, resize: 'vertical', fontFamily: 'inherit',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 0, border: 'none',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-line-2)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: 'var(--eph-body)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
};

const STATUS_OPTIONS: BlindspotCaseStatus[] = ['evaluando', 'referido', 'en_proceso', 'cerrado'];
const STATUS_LABEL: Record<BlindspotCaseStatus, string> = {
  evaluando: 'Evaluando', referido: 'Referido', en_proceso: 'En proceso', cerrado: 'Cerrado',
};

export function AdminBlindspotPanel() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR('blindspot-admin-cases-therapists', async () => {
    const [caseList, therapistList] = await Promise.all([adminListCases(), adminListTherapists()]);
    return { cases: caseList, therapists: therapistList };
  });
  // Misma key de caché que ClientSwitcher ("admin-clients-list") — si el admin
  // ya visitó otro módulo antes, la lista de clientes sale de caché al instante.
  const { data: allClients = [] } = useSWR('admin-clients-list', fetchClients);

  const cases = data?.cases ?? [];
  const therapists = data?.therapists ?? [];
  const clients = allClients.filter((c) => c.clientType === 'mentoring');

  async function refetch() {
    await mutate();
  }

  function therapistName(id: string | null): string {
    if (!id) return '— sin asignar —';
    return therapists.find((t) => t.id === id)?.name ?? 'Terapeuta desconocido';
  }
  function clientName(id: string): string {
    return clients.find((c) => c.id === id)?.name ?? id;
  }

  if (isLoading) return <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>Cargando...</p>;

  return (
    <CasesTab
      cases={cases}
      clients={clients}
      therapists={therapists}
      selectedCaseId={selectedCaseId}
      onSelect={setSelectedCaseId}
      onRefetch={refetch}
      therapistName={therapistName}
      clientName={clientName}
    />
  );
}

function CasesTab({
  cases, clients, therapists, selectedCaseId, onSelect, onRefetch, therapistName, clientName,
}: {
  cases: BlindspotCase[];
  clients: ClientOption[];
  therapists: Therapist[];
  selectedCaseId: string | null;
  onSelect: (id: string | null) => void;
  onRefetch: () => Promise<void>;
  therapistName: (id: string | null) => string;
  clientName: (id: string) => string;
}) {
  const [showNewCase, setShowNewCase] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [areaPercibida, setAreaPercibida] = useState('');
  const [prioridad, setPrioridad] = useState<'alta' | 'media' | 'baja'>('media');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BlindspotCaseStatus>('all');

  const clientsWithoutCase = clients.filter((c) => !cases.some((k) => k.clientId === c.id));

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const q = search.trim().toLowerCase().replace(/^#/, '');
    if (!q) return true;
    const haystack = [`#${c.caseNumber}`, String(c.caseNumber), clientName(c.clientId), STATUS_LABEL[c.status], therapistName(c.therapistId)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  async function handleCreateCase() {
    if (!newClientId || !motivoConsulta || !areaPercibida) {
      showToast('Completa cliente, motivo y área percibida.', 'error');
      return;
    }
    setCreating(true);
    try {
      await adminCreateCase({ clientId: newClientId, initialAssessment: { motivoConsulta, areaPercibida, prioridad } });
      showToast('Caso creado.', 'success');
      setShowNewCase(false);
      setNewClientId('');
      setMotivoConsulta('');
      setAreaPercibida('');
      setPrioridad('media');
      await onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al crear el caso.', 'error');
    } finally {
      setCreating(false);
    }
  }

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null;

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showNewCase ? 16 : 0 }}>
          <h3 style={{ ...cardTitleStyle, margin: 0 }}>Casos de Punto Ciego</h3>
          <button style={primaryButtonStyle} onClick={() => setShowNewCase((v) => !v)}>
            {showNewCase ? 'Cancelar' : '+ Nuevo caso'}
          </button>
        </div>

        {showNewCase && (
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Cliente Premium</label>
              <select style={fieldStyle} value={newClientId} onChange={(e) => setNewClientId(e.target.value)}>
                <option value="">— selecciona —</option>
                {clientsWithoutCase.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Motivo de consulta</label>
              <textarea style={textareaStyle} value={motivoConsulta} onChange={(e) => setMotivoConsulta(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Área percibida</label>
              <textarea style={textareaStyle} value={areaPercibida} onChange={(e) => setAreaPercibida(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Prioridad</label>
              <select style={fieldStyle} value={prioridad} onChange={(e) => setPrioridad(e.target.value as 'alta' | 'media' | 'baja')}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <button style={primaryButtonStyle} onClick={handleCreateCase} disabled={creating}>
              {creating ? 'Creando...' : 'Crear caso'}
            </button>
          </div>
        )}
      </div>

      {cases.length === 0 ? (
        <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>Aún no hay casos.</p>
      ) : (
        <>
          <div style={{ ...cardStyle, display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              style={{ ...fieldStyle, flex: 1 }}
              placeholder="Buscar por #caso, cliente, terapeuta o estado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              style={{ ...fieldStyle, width: 170, flexShrink: 0 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | BlindspotCaseStatus)}
            >
              <option value="all">Todos los estados</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div style={cardStyle}>
          {filteredCases.length === 0 ? (
            <p style={{ color: 'var(--eph-muted)', fontSize: 13, margin: 0 }}>Ningún caso coincide con la búsqueda.</p>
          ) : filteredCases.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id === selectedCaseId ? null : c.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 4px', borderBottom: '1px solid var(--eph-line)', cursor: 'pointer',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--eph-text)' }}>#{c.caseNumber} · {clientName(c.clientId)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--eph-muted)' }}>
                  {STATUS_LABEL[c.status]} · {therapistName(c.therapistId)}
                </p>
              </div>
              {c.crisisFlag && (
                <span className="font-mono" style={{ background: 'var(--eph-danger)', color: 'white', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 999 }}>
                  Crisis
                </span>
              )}
            </div>
          ))}
          </div>
        </>
      )}

      {selectedCase && (
        <CaseDetail blindspotCase={selectedCase} therapists={therapists} onRefetch={onRefetch} />
      )}
    </div>
  );
}

function CaseDetail({ blindspotCase, therapists, onRefetch }: { blindspotCase: BlindspotCase; therapists: Therapist[]; onRefetch: () => Promise<void> }) {
  const { data, error: loadError } = useSWR(['blindspot-case-detail', blindspotCase.id], () =>
    adminGetCase(blindspotCase.id),
  );
  const tasks = data?.tasks ?? [];
  const sessionLogs = data?.sessionLogs ?? [];
  const [notes, setNotes] = useState(blindspotCase.adminPrivateNotes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setNotes(data.case.adminPrivateNotes ?? '');
  }, [data]);

  useEffect(() => {
    if (loadError) showToast(loadError instanceof Error ? loadError.message : 'Error al cargar el detalle.', 'error');
  }, [loadError]);

  async function handleStatusChange(status: BlindspotCaseStatus) {
    try {
      await adminUpdateCase(blindspotCase.id, { status });
      await onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al actualizar.', 'error');
    }
  }

  async function handleAssignTherapist(therapistId: string) {
    try {
      await adminUpdateCase(blindspotCase.id, { therapistId: therapistId || null, status: therapistId ? 'referido' : blindspotCase.status });
      await onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al asignar terapeuta.', 'error');
    }
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await adminUpdateCase(blindspotCase.id, { adminPrivateNotes: notes });
      showToast('Notas guardadas.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al guardar notas.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledgeCrisis() {
    try {
      await adminAcknowledgeCrisis(blindspotCase.id);
      showToast('Alerta atendida.', 'success');
      await onRefetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al atender la alerta.', 'error');
    }
  }

  return (
    <div style={cardStyle}>
      {blindspotCase.crisisFlag && (
        <div style={{ background: 'var(--eph-danger)', color: 'white', borderRadius: 0, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="font-body" style={{ fontSize: 13, fontWeight: 500 }}>Alerta de crisis activa — levantada por {blindspotCase.crisisFlaggedBy}</span>
          <button
            onClick={handleAcknowledgeCrisis}
            className="font-mono"
            style={{ background: 'white', color: 'var(--eph-danger)', border: 'none', borderRadius: 0, padding: '6px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            Atender
          </button>
        </div>
      )}

      <InsightsSection clientId={blindspotCase.clientId} moduleKey="puntoCiego" />

      <h3 style={cardTitleStyle}>Detalle del caso #{blindspotCase.caseNumber}</h3>

      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--eph-muted)' }}>Motivo de consulta</p>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--eph-text)' }}>{blindspotCase.initialAssessment.motivoConsulta}</p>
        <p style={{ margin: '10px 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--eph-muted)' }}>Área percibida</p>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--eph-text)' }}>{blindspotCase.initialAssessment.areaPercibida}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select style={fieldStyle} value={blindspotCase.status} onChange={(e) => handleStatusChange(e.target.value as BlindspotCaseStatus)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Terapeuta asignado</label>
          <select style={fieldStyle} value={blindspotCase.therapistId ?? ''} onChange={(e) => handleAssignTherapist(e.target.value)}>
            <option value="">— sin asignar —</option>
            {therapists.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Notas privadas (solo tú las ves)</label>
        <textarea style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        <button style={{ ...ghostButtonStyle, marginTop: 8 }} onClick={handleSaveNotes} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar notas'}
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ ...cardTitleStyle, fontSize: 13, marginBottom: 8 }}>Tareas ({tasks.length})</p>
        {tasks.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--eph-muted)' }}>Sin tareas asignadas todavía.</p>
        ) : (
          tasks.map((t) => (
            <p key={t.id} style={{ fontSize: 12.5, color: 'var(--eph-text)', margin: '4px 0' }}>
              • {t.title} — <span style={{ color: 'var(--eph-muted)' }}>{t.status}</span>
            </p>
          ))
        )}
      </div>

      <div>
        <p style={{ ...cardTitleStyle, fontSize: 13, marginBottom: 8 }}>Sesiones registradas ({sessionLogs.length})</p>
        {sessionLogs.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--eph-muted)' }}>Sin sesiones registradas todavía.</p>
        ) : (
          sessionLogs.map((log) => (
            <div key={log.id} style={{ borderLeft: '2px solid var(--eph-line)', paddingLeft: 12, marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--eph-muted)', textTransform: 'uppercase' }}>
                {log.sessionDate} · {log.progressMarker}
              </p>
              {log.internalSummary && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--eph-text)' }}>{log.internalSummary}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

