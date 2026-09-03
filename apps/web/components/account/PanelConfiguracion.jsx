"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  User, ShieldCheck, Watch, Bell, Lock, LogOut,
  ChevronRight, Check, Globe,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useTranslation } from "../../lib/i18n/useTranslation";
import { MEMBERSHIP_LABELS } from "../../lib/constants";
import { fetchClient, updateClientProfile } from "../../lib/clients-client";
import {
  getLegalAcceptance,
  submitLegalAcceptance,
  uploadAvatar,
  updateNotificationPreferences,
  updateLanguage,
  requestAccountDeletion,
  getAccountExport,
} from "../../lib/account-client";
import { getWearableEstado, getWearableConnectUrl, disconnectWearable } from "../../lib/wearable-client";
import { changePasswordRequest } from "../../lib/api-client";
import AceptacionRegistro from "../auth/AceptacionRegistro";

/**
 * Panel de Configuración del cliente — La Tribu
 *
 * Conectado a datos reales: perfil/membresía reusan la misma key SWR que
 * MemberCard.tsx (['client-detail-for-member-card', clientId]), el resto
 * de las secciones pegan al módulo de cuenta (lib/account-client.ts) y a lo
 * que ya existía (Oura, cambio de contraseña).
 */

const INK = "var(--eph-text)";
const INK_MUTED = "var(--eph-muted)";
const GOLD = "var(--eph-accent)";
const BORDER = "var(--eph-line)";
const BORDER_2 = "var(--eph-line-2)";
const PAGE_BG = "var(--eph-bg)";
const SURFACE_2 = "var(--eph-surface-2)";
const DANGER_TEXT = "#D99483";

function formatMemberNumber(n) {
  return String(n).padStart(5, "0");
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// plan_end_date es una columna `date` (YYYY-MM-DD, sin hora) — a diferencia
// de formatDate() de arriba, necesita el +"T00:00:00" para no correrse un
// día en zonas con offset UTC negativo.
function formatPlanDate(isoDate) {
  if (!isoDate) return "";
  return new Date(isoDate + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function SectionHeader({ Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} color={GOLD} />
      <h2 className="font-display font-normal text-[18px]" style={{ color: INK }}>{title}</h2>
    </div>
  );
}

function Section({ children, first }) {
  return (
    <div
      className={`py-7 ${first ? "" : "border-t"}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block mb-4">
      <span className="block text-[11px] mb-1.5" style={{ color: INK_MUTED }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b outline-none text-[14px] pb-2 transition-colors"
        style={{ borderColor: BORDER, color: INK, height: 36 }}
        onFocus={(e) => (e.target.style.borderColor = GOLD)}
        onBlur={(e) => (e.target.style.borderColor = BORDER)}
      />
    </label>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 rounded-full transition-colors"
      style={{ width: 38, height: 22, background: checked ? GOLD : BORDER, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span
        className="absolute top-[3px] rounded-full transition-all"
        style={{ width: 16, height: 16, left: checked ? 19 : 3, background: "var(--eph-text)" }}
      />
    </button>
  );
}

function Row({ title, sub, right }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-[13.5px]" style={{ color: INK }}>{title}</p>
        {sub && <p className="text-[12px] mt-0.5" style={{ color: INK_MUTED }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const styles = {
    neutral: { background: "transparent", border: `1px solid ${BORDER_2}`, color: INK_MUTED },
    gold: { background: GOLD, border: `1px solid ${GOLD}`, color: "var(--eph-ink)" },
    ok: { background: "rgba(201,164,106,.14)", border: `1px solid ${GOLD}`, color: GOLD },
  };
  return (
    <span
      className="font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

export default function PanelConfiguracion({ clientId }) {
  const router = useRouter();
  const { logout, language, setLanguage: setAuthLanguage } = useAuth();
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const clientKey = ["client-detail-for-member-card", clientId];
  const { data: client } = useSWR(clientKey, () => fetchClient(clientId));
  const { data: acceptance } = useSWR(["account-legal-acceptance", clientId], getLegalAcceptance);
  const { data: wearables } = useSWR(["account-wearable-estado", clientId], () => getWearableEstado(clientId));

  const refreshClient = () => mutate(clientKey);

  // --- Perfil ---
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [profileError, setProfileError] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (client) {
      setNombre(client.name);
      setEmail(client.email);
    }
  }, [client?.name, client?.email]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateClientProfile(clientId, { name: nombre, email });
      await refreshClient();
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Error al guardar los cambios.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
      await refreshClient();
    } catch {
      // Silencioso: el input vuelve a su estado y el usuario puede reintentar.
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  // --- Privacidad y datos ---
  const [reacceptOpen, setReacceptOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteStep, setDeleteStep] = useState("idle"); // idle | confirming | sent

  useEffect(() => {
    if (client?.deletionRequestedAt) setDeleteStep("sent");
  }, [client?.deletionRequestedAt]);

  const handleReacceptComplete = async (payload) => {
    await submitLegalAcceptance(payload);
    await mutate(["account-legal-acceptance", clientId]);
    setTimeout(() => setReacceptOpen(false), 1500);
  };

  const handleDownloadData = async () => {
    setExporting(true);
    try {
      const data = await getAccountExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-la-tribu-${clientId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleSendDeletionRequest = async () => {
    try {
      await requestAccountDeletion();
      setDeleteStep("sent");
    } catch {
      // Se queda en "confirming" — el usuario puede reintentar.
    }
  };

  // --- Idioma ---
  const [savingLanguage, setSavingLanguage] = useState(false);

  const handleChangeLanguage = async (next) => {
    if (next === language || savingLanguage) return;
    const previous = language;
    setAuthLanguage(next); // toda la app cambia de inmediato, sin esperar la red
    setSavingLanguage(true);
    try {
      await updateLanguage(next);
    } catch {
      setAuthLanguage(previous); // sin toast propio acá — se ve al instante en la propia UI
    } finally {
      setSavingLanguage(false);
    }
  };

  // --- Dispositivos ---
  const oura = wearables?.find((w) => w.dispositivo === "oura");

  const handleDisconnectOura = async () => {
    await disconnectWearable(clientId, "oura");
    await mutate(["account-wearable-estado", clientId]);
  };

  // --- Notificaciones ---
  const prefs = client?.notificationPreferences ?? { streakReminders: true, events: true, news: false };
  const [savingPref, setSavingPref] = useState(null);

  const handleTogglePref = async (key, value) => {
    setSavingPref(key);
    try {
      await updateNotificationPreferences({ [key]: value });
      await refreshClient();
    } finally {
      setSavingPref(null);
    }
  };

  // --- Seguridad ---
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwError, setPwError] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const handleChangePassword = async () => {
    setPwSaving(true);
    setPwError(null);
    try {
      const result = await changePasswordRequest(pwCurrent, pwNew);
      if (!result.success) throw new Error(result.error || "No se pudo cambiar la contraseña.");
      setPwDone(true);
      setPwCurrent("");
      setPwNew("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPwSaving(false);
    }
  };

  const linkedProvider = client?.googleId ? "Google" : client?.appleId ? "Apple" : null;

  const initials = (client?.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="min-h-[800px]" style={{ background: PAGE_BG }}>
      <div className="max-w-[640px] mx-auto px-5 py-12">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-2" style={{ color: INK_MUTED }}>{t('settings.eyebrow')}</p>
        <h1 className="font-display font-normal text-[28px] mb-1.5" style={{ color: INK }}>{t('settings.title')}</h1>
        <p className="text-[13.5px] mb-2" style={{ color: INK_MUTED }}>
          {t('settings.subtitle')}
        </p>

        {/* Perfil */}
        <Section first>
          <SectionHeader Icon={User} title={t('settings.profile.title')} />
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-display font-normal text-[18px] overflow-hidden"
              style={{ background: SURFACE_2, color: INK }}
            >
              {client?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <label className="text-[12.5px] underline cursor-pointer" style={{ color: INK_MUTED }}>
              {avatarUploading ? t('settings.profile.uploading') : t('settings.profile.changePhoto')}
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange} disabled={avatarUploading} />
            </label>
          </div>
          <Field label={t('settings.profile.name')} value={nombre} onChange={setNombre} />
          <Field label={t('settings.profile.email')} value={email} onChange={setEmail} />
          {profileError && <p className="text-[12px] mb-2" style={{ color: DANGER_TEXT }}>{profileError}</p>}
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="font-mono text-[11px] uppercase tracking-[0.1em] px-5 mt-2"
            style={{ height: 42, borderRadius: 0, background: GOLD, color: "var(--eph-ink)", opacity: savingProfile ? 0.6 : 1, cursor: savingProfile ? "not-allowed" : "pointer" }}
          >
            {savingProfile ? t('settings.profile.saving') : t('settings.profile.save')}
          </button>
        </Section>

        {/* Idioma */}
        <Section>
          <SectionHeader Icon={Globe} title={t('settings.language.title')} />
          <p className="text-[12.5px] mb-4" style={{ color: INK_MUTED }}>{t('settings.language.subtitle')}</p>
          <div className="flex gap-2">
            {[
              { key: 'es', label: t('settings.language.es') },
              { key: 'en', label: t('settings.language.en') },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleChangeLanguage(opt.key)}
                disabled={savingLanguage}
                className="font-mono text-[10px] uppercase tracking-wide px-4 py-2"
                style={
                  language === opt.key
                    ? { borderRadius: 0, border: `1px solid ${GOLD}`, background: GOLD, color: "var(--eph-ink)", cursor: "pointer" }
                    : { borderRadius: 0, border: `1px solid ${BORDER_2}`, background: "transparent", color: INK_MUTED, cursor: savingLanguage ? "not-allowed" : "pointer" }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Membresía */}
        <Section>
          <SectionHeader Icon={ShieldCheck} title={t('settings.membership.title')} />
          {client && (
            <>
              <Row
                title={MEMBERSHIP_LABELS[client.clientType] || client.clientType}
                sub={[
                  client.memberNumber != null ? `Miembro N.º ${formatMemberNumber(client.memberNumber)}` : null,
                  client.activatedAt ? `Ingresaste el ${formatDate(client.activatedAt)}` : null,
                  client.clientType === "coaching_1_1" && client.sessionsTotal != null && client.sessionsRemaining != null
                    ? `Quedan ${client.sessionsRemaining} de ${client.sessionsTotal} clases`
                    : null,
                  client.planEndDate
                    ? `${new Date().toISOString().slice(0, 10) > client.planEndDate ? "Venció" : "Vence"} el ${formatPlanDate(client.planEndDate)}`
                    : null,
                ].filter(Boolean).join(" · ")}
                right={<Pill tone={client.status === "active" ? "gold" : "neutral"}>{client.status === "active" ? t('settings.membership.active') : t('settings.membership.inactive')}</Pill>}
              />
              <button
                type="button"
                onClick={() => router.push("/configuracion/membresias")}
                className="w-full flex items-center justify-between py-2.5 text-left"
              >
                <div>
                  <p className="text-[13.5px]" style={{ color: INK }}>{t('settings.membership.manage')}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: INK_MUTED }}>{t('settings.membership.manageSub')}</p>
                </div>
                <ChevronRight size={16} color={INK_MUTED} />
              </button>
            </>
          )}
        </Section>

        {/* Privacidad y datos */}
        <Section>
          <SectionHeader Icon={Lock} title={t('settings.privacy.title')} />
          {acceptance ? (
            <>
              <p className="text-[12.5px] mb-4" style={{ color: INK_MUTED }}>
                {t('settings.privacy.acceptedOn')} {formatDate(acceptance.acceptedAt)}.
              </p>
              <Row title={t('settings.privacy.dataPolicy')} sub={acceptance.dataPolicyVersion} right={null} />
              <Row title={t('settings.privacy.terms')} sub={acceptance.termsVersion} right={null} />
            </>
          ) : (
            <p className="text-[12.5px] mb-4" style={{ color: INK_MUTED }}>{t('settings.privacy.loadingConsent')}</p>
          )}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
            <p className="text-[11px] mb-3" style={{ color: INK_MUTED }}>
              {t('settings.privacy.rightsIntro')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadData}
                disabled={exporting}
                className="text-[12px] underline"
                style={{ color: INK, cursor: exporting ? "not-allowed" : "pointer" }}
              >
                {exporting ? t('settings.privacy.downloadDataGenerating') : t('settings.privacy.downloadData')}
              </button>
              <span style={{ color: BORDER }}>·</span>
              <button type="button" className="text-[12px] underline" style={{ color: INK }} onClick={() => setReacceptOpen(true)}>
                {t('settings.privacy.updateConsent')}
              </button>
              <span style={{ color: BORDER }}>·</span>
              {deleteStep === "idle" && (
                <button
                  type="button"
                  className="text-[12px] underline"
                  style={{ color: DANGER_TEXT }}
                  onClick={() => setDeleteStep("confirming")}
                >
                  {t('settings.privacy.requestDeletion')}
                </button>
              )}
            </div>

            {deleteStep === "confirming" && (
              <div className="p-4" style={{ borderRadius: 0, background: "rgba(138,74,60,.14)", border: "1px solid var(--eph-danger)" }}>
                <p className="text-[12.5px] mb-2 font-medium" style={{ color: DANGER_TEXT }}>
                  {t('settings.privacy.deletionWarningTitle')}
                </p>
                <ul className="text-[12px] mb-3 space-y-1 list-none pl-0" style={{ color: DANGER_TEXT }}>
                  <li>· {t('settings.privacy.deletionPoint1')}</li>
                  <li>· {t('settings.privacy.deletionPoint2')}</li>
                  <li>· {t('settings.privacy.deletionPoint3')}</li>
                </ul>
                <p className="text-[12px] mb-3" style={{ color: DANGER_TEXT }}>
                  {t('settings.privacy.deletionNotice')}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase tracking-wide px-4 py-2"
                    style={{ borderRadius: 0, border: "1px solid var(--eph-danger)", background: "transparent", color: DANGER_TEXT }}
                    onClick={handleSendDeletionRequest}
                  >
                    {t('settings.privacy.deletionSend')}
                  </button>
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase tracking-wide px-4 py-2"
                    style={{ borderRadius: 0, border: `1px solid ${BORDER_2}`, color: INK_MUTED }}
                    onClick={() => setDeleteStep("idle")}
                  >
                    {t('settings.privacy.deletionCancel')}
                  </button>
                </div>
              </div>
            )}

            {deleteStep === "sent" && (
              <div className="p-4 flex items-start gap-2" style={{ borderRadius: 0, background: "rgba(201,164,106,.14)", border: `1px solid ${GOLD}` }}>
                <Check size={14} color={GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                <p className="text-[12px]" style={{ color: GOLD }}>
                  {t('settings.privacy.deletionSent')}
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* Dispositivos */}
        <Section>
          <SectionHeader Icon={Watch} title={t('settings.devices.title')} />
          <Row
            title="Oura Ring"
            sub={oura?.conectado ? t('settings.devices.ouraSyncing') : t('settings.devices.ouraDisconnected')}
            right={
              oura?.conectado ? (
                <div className="flex items-center gap-2">
                  <Pill tone="ok"><Check size={11} /> {t('settings.devices.connected')}</Pill>
                  <button type="button" onClick={handleDisconnectOura} className="text-[11.5px] underline" style={{ color: INK_MUTED }}>
                    {t('settings.devices.disconnect')}
                  </button>
                </div>
              ) : (
                <a href={getWearableConnectUrl("oura", clientId)} className="text-[12.5px] underline" style={{ color: INK }}>
                  {t('settings.devices.connect')}
                </a>
              )
            }
          />
        </Section>

        {/* Notificaciones */}
        <Section>
          <SectionHeader Icon={Bell} title={t('settings.notifications.title')} />
          <Row
            title={t('settings.notifications.streak')}
            sub={t('settings.notifications.streakSub')}
            right={<Toggle checked={prefs.streakReminders} disabled={savingPref === "streakReminders"} onChange={(v) => handleTogglePref("streakReminders", v)} />}
          />
          <Row
            title={t('settings.notifications.events')}
            sub={t('settings.notifications.eventsSub')}
            right={<Toggle checked={prefs.events} disabled={savingPref === "events"} onChange={(v) => handleTogglePref("events", v)} />}
          />
          <Row
            title={t('settings.notifications.news')}
            sub={t('settings.notifications.newsSub')}
            right={<Toggle checked={prefs.news} disabled={savingPref === "news"} onChange={(v) => handleTogglePref("news", v)} />}
          />
        </Section>

        {/* Seguridad */}
        <Section>
          <SectionHeader Icon={Lock} title={t('settings.security.title')} />
          <Row
            title={t('settings.security.password')}
            sub={pwDone ? t('settings.security.passwordUpdated') : t('settings.security.passwordChangeAnytime')}
            right={
              <button type="button" className="text-[12.5px] underline" style={{ color: INK }} onClick={() => setPwOpen((v) => !v)}>
                {pwOpen ? t('settings.security.close') : t('settings.security.change')}
              </button>
            }
          />
          {pwOpen && (
            <div className="mt-2 mb-4 pl-0">
              <Field label={t('settings.security.currentPassword')} value={pwCurrent} onChange={setPwCurrent} />
              <Field label={t('settings.security.newPassword')} value={pwNew} onChange={setPwNew} />
              {pwError && <p className="text-[12px] mb-2" style={{ color: DANGER_TEXT }}>{pwError}</p>}
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={pwSaving || !pwCurrent || !pwNew}
                className="font-mono text-[11px] uppercase tracking-[0.1em] px-4"
                style={{ height: 38, borderRadius: 0, background: GOLD, color: "var(--eph-ink)", opacity: pwSaving || !pwCurrent || !pwNew ? 0.6 : 1 }}
              >
                {pwSaving ? t('settings.profile.saving') : t('settings.security.confirmChange')}
              </button>
            </div>
          )}
          <Row
            title={t('settings.security.linkedAccounts')}
            sub={linkedProvider || t('settings.security.none')}
            right={linkedProvider ? <Pill tone="ok"><Check size={11} /> {t('settings.devices.connected')}</Pill> : null}
          />
        </Section>

        {/* Zona de cuenta */}
        <Section>
          <button className="flex items-center gap-2 text-[13.5px]" style={{ color: INK }} onClick={logout}>
            <LogOut size={15} /> {t('settings.logout')}
          </button>
        </Section>
      </div>

      {reacceptOpen && (
        <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ background: "rgba(8,8,7,0.75)" }}>
          <div className="max-w-[560px] mx-auto pt-6 px-4">
            <button
              type="button"
              onClick={() => setReacceptOpen(false)}
              className="text-[12.5px] underline mb-3"
              style={{ color: "var(--eph-text)" }}
            >
              {t('settings.privacy.backToSettings')}
            </button>
            <AceptacionRegistro onComplete={handleReacceptComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
