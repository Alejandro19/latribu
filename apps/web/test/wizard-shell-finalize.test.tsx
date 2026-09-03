// apps/web/test/wizard-shell-finalize.test.tsx
//
// Coverage for WizardShell's finalize() — the function that runs when the
// user clicks "Finalizar" on module 9. It orchestrates, in order: an
// optional pending-checkup-file upload, putPersonalInfo (without `complete`
// — that flag now lives in finalizeOnboarding, which runs last so the
// backend can validate Mentoría's wearable/lab/InBody gate), a conditional
// createAnthropometric, per-angle createPhoto calls, a conditional
// createInbodyRecord, and finally finalizeOnboarding.
//
// These tests drive the wizard through all 9 real steps (no shortcuts,
// no reaching into component internals) because that's exactly the kind
// of exercise that already caught two real WizardShell bugs during this
// migration (hidden module-1 fields, incomplete country-branch validation).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import OnboardingPage from '../app/(app)/onboarding/page';
import * as apiClient from '../lib/api-client';
import * as onboardingClient from '../lib/onboarding-client';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/geo-client');

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function setSliderByPrefix(prefix: string, value: number) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  fireEvent.change(screen.getByLabelText(new RegExp(`^${escaped}`)), { target: { value: String(value) } });
}

function clickChevronUp(label: string) {
  fireEvent.click(screen.getByRole('button', { name: `Aumentar ${label}` }));
}

function clickSegmented(groupLabel: string, value: number) {
  const group = screen.getByRole('group', { name: groupLabel });
  fireEvent.click(within(group).getByRole('button', { name: String(value) }));
}

function toggleChip(option: string) {
  fireEvent.click(screen.getByLabelText(option));
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /continuar|finalizar/i }));
}

function fillModule1() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cliente de Prueba' } });
  fireEvent.change(screen.getByLabelText('Edad'), { target: { value: '35' } });
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1990-01-01' } });
  fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Masculino' } });
  fireEvent.change(screen.getByLabelText('Ocupación'), { target: { value: 'Ingeniero' } });
  fireEvent.change(screen.getByLabelText('Estado civil'), { target: { value: 'Soltero/a' } });
  fireEvent.change(screen.getByLabelText('Identificación'), { target: { value: 'Cédula de ciudadanía' } });
  fireEvent.change(screen.getByLabelText('Número de identificación'), { target: { value: '1234567890' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@example.com' } });
  fireEvent.change(screen.getByLabelText('País de residencia'), { target: { value: 'CO' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Bogotá' } });
  fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: '3001234567' } });
}

function fillModule2() {
  clickChevronUp('¿Horas de trabajo al día?');
  setSliderByPrefix('¿Demanda cognitiva (1-10)?', 5);
  setField('¿Con qué frecuencia viajas por trabajo?', 'Nunca');
  setField('¿Dónde trabajas principalmente?', 'Oficina');
  setField('¿Tienes control sobre tu horario?', 'Alto');
}

type Module3Options = { withAntropometria?: boolean };

function uploadPhoto(label: string, filename: string) {
  const file = new File(['fake-image-bytes'], filename, { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

// Fills the 9 InBody fields by hand (never runs the OCR flow), which
// deliberately leaves module3Draft.inbody.ocrDone === false — the exact
// condition finalize() checks before calling createInbodyRecord. Peso,
// estatura y % grasa ya no se piden aparte: se toman de los campos InBody
// (Peso total / Estatura / % Grasa corporal), que son los únicos que existen.
function fillModule3(options: Module3Options = {}) {
  setField('¿Cuál es tu objetivo de peso?', 'bajar');
  setField('¿Cuál es tu objetivo de grasa corporal?', 'bajar');
  setField('¿Cuál es tu objetivo de masa muscular?', 'subir');

  setField('Peso total', '80');
  setField('Estatura (cm)', '180');
  setField('Masa muscular esquelética', '35');
  setField('% Grasa corporal', '20');
  setField('Peso Ideal', '75');
  setField('Grasa visceral', '8');
  setField('Metabolismo basal (BMR)', '1800');
  setField('Agua corporal total (L)', '45');
  setField('Masa ósea', '3.2');

  if (options.withAntropometria) {
    setField('Cintura (cm)', '85');
  }

  // Fotos de progreso: obligatorias, ya no opcionales.
  uploadPhoto('Frente', 'frente.jpg');
  uploadPhoto('Lado derecho', 'lado-derecho.jpg');
  uploadPhoto('Lado izquierdo', 'lado-izquierdo.jpg');
  uploadPhoto('Espalda', 'espalda.jpg');
}

type Module4Options = { withCheckupFile?: boolean };

function fillModule4(options: Module4Options = {}) {
  setField('Condición médica diagnosticada', 'Ninguna');
  setField('¿Tomas medicamentos actualmente?', 'No');
  setField('Alergias', 'Ninguna');
  setField('Pre existencias medicas o Lesiones', 'Ninguna');
  setField('¿Intervenciones quirúrgicas?', 'No');
  setField('Último chequeo médico', 'Menos de 6 meses');
  if (options.withCheckupFile) {
    const file = new File(['contenido'], 'chequeo.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Subir chequeo médico'), { target: { files: [file] } });
  }
  setField('Observaciones del chequeo', 'Sin observaciones');
  setField('Salud mental diagnosticada', 'Sin diagnóstico');
  setField('¿Tienes autorización médica para entrenar?', 'Sí');
  setField('Escribe 3 razones por las que quieres alcanzar tu objetivo', 'Salud, estética, energía');
}

function fillModule5() {
  clickSegmented('¿Cuántas comidas haces al día?', 3);
  setField('¿A qué hora es tu primera comida?', '08:00');
  setField('¿A qué hora es tu última comida?', '20:00');
  clickChevronUp('¿Cuántos litros de agua tomas al día?');
  toggleChip('Pollo');
  toggleChip('Arroz');
  toggleChip('Aguacate');
  setField('Describe cómo se ve tu desayuno', 'Huevos y fruta');
  setField('Describe cómo se ven tus snacks', 'Frutos secos');
  setField('Describe cómo se ve tu almuerzo', 'Pollo con arroz');
  setField('Describe cómo se ve tu cena', 'Pescado con verduras');
  setField('¿Prefieres comer el mismo menú todos los días o tener varios menús disponibles?', 'Prefiero el mismo menú todos los días');
  setField(
    '¿Se te da mejor pesar la comida diariamente o prefieres ser más flexible y guiarte por porciones?',
    'Prefiero ser flexible y guiarme por porciones'
  );
  setField('¿Cuáles son tus 3 frutas preferidas?', 'Manzana, banano, fresa');
  setField('¿Con qué te alimentas cuando tienes ansiedad?', 'Chocolate');
  setField('Tolerancia a lácteos', 'Sin problema');
  setField('¿Consumes probióticos?', 'No');
  setField('¿Cuántas veces comes por fuera?', 'Nunca');
  setField('Consumo de snacks entre comidas', 'Nunca');
  clickSegmented('Tazas de café/cafeína al día', 1);
  setField('Hora del último café', '07:00');
  setField('Consumo de alcohol', 'Nunca');
  setField('Tipo de dieta', 'Omnívoro');
  setField('¿Practicas ayuno intermitente?', 'No');
  setField('Consumo de ultraprocesados', 'Bajo');
  setField('Consumo de verduras', 'Alto');
  setField('¿Tomas suplementos actualmente?', 'No');
  setField('Consumo de otras sustancias', 'No');
}

function fillModule6() {
  clickChevronUp('Horas de sueño promedio');
  setField('Hora de dormir', '22:00');
  setField('Hora de despertar', '06:00');
  setSliderByPrefix('Calidad del sueño (1-10)', 8);
  setField('Despertares nocturnos', 'Ninguno');
  setField('¿Roncas con frecuencia mientras duermes?', 'No');
  setField('¿Alguien te ha comentado que dejas de respirar o haces pausas al dormir?', 'No');
}

function fillModule7() {
  setSliderByPrefix('Energía en la mañana (1-10)', 7);
  setSliderByPrefix('Energía en la tarde (1-10)', 6);
  setField('Niebla mental', 'Nunca');
  setField('Tiempo de foco sostenido', '30-60min');
  setField('¿Sientes la memoria afectada?', 'No');
}

function fillModule8() {
  setSliderByPrefix('Nivel de estrés crónico (1-10)', 4);
  setField('Frecuencia de ansiedad', 'Nunca');
  setField('Estado de ánimo general', 'Estable');
  setField('Técnicas de manejo del estrés que usas', 'Meditación');
  setField('¿El trabajo invade tu vida personal?', 'No');
}

function fillModule9() {
  setField('¿Has realizado alguna vez actividad física?', 'No');
  setField('¿A qué nivel?', 'Básico');
  setField('¿Durante cuánto tiempo?', '1 año');
  setField('¿Actualmente practicas algún deporte o haces actividad física?', 'No');
  setField('¿En qué lugar vas a entrenar actualmente?', 'Gimnasio');
  setField('¿En qué horario?', 'Mañana');
  clickSegmented('¿Cuántos días a la semana?', 3);
  setField('Objetivos principales', 'Bajar grasa y ganar músculo');
}

type DriveOptions = { module3?: Module3Options; module4?: Module4Options };

async function driveWizardToFinalize(options: DriveOptions = {}) {
  render(<OnboardingPage />);

  await screen.findByLabelText('País de residencia');
  fillModule1();
  clickContinue();

  await screen.findByLabelText('¿Horas de trabajo al día?');
  fillModule2();
  clickContinue();

  await screen.findByLabelText('Peso total');
  fillModule3(options.module3);
  clickContinue();

  await screen.findByLabelText('Condición médica diagnosticada');
  fillModule4(options.module4);
  clickContinue();

  await screen.findByLabelText('Describe cómo se ve tu desayuno');
  fillModule5();
  clickContinue();

  await screen.findByLabelText('Horas de sueño promedio');
  fillModule6();
  clickContinue();

  await screen.findByLabelText(/^Energía en la mañana/);
  fillModule7();
  clickContinue();

  await screen.findByLabelText(/^Nivel de estrés crónico/);
  fillModule8();
  clickContinue();

  await screen.findByLabelText('¿Has realizado alguna vez actividad física?');
  fillModule9();
  clickContinue();

  await screen.findByText('Listo.');
}

// Driving 9 real wizard steps end-to-end is slower than a typical unit test
// (~2.5-3s each) and gets tighter under full-suite CPU contention — raise
// the timeout rather than shortcut the navigation these tests intentionally
// exercise in full.
describe('WizardShell finalize()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá']);
    vi.mocked(onboardingClient.getPersonalInfoAccess).mockResolvedValue('standard');

    vi.mocked(onboardingClient.putPersonalInfo).mockResolvedValue(undefined);
    vi.mocked(onboardingClient.updateClientObjetivos).mockResolvedValue(undefined);
    vi.mocked(onboardingClient.createAnthropometric).mockResolvedValue(undefined);
    vi.mocked(onboardingClient.createPhoto).mockResolvedValue(undefined);
    vi.mocked(onboardingClient.createInbodyRecord).mockResolvedValue(undefined);
    vi.mocked(onboardingClient.finalizeOnboarding).mockResolvedValue({ success: true });
    vi.mocked(onboardingClient.uploadPersonalInfoFile).mockResolvedValue({
      file_url: 'https://files.example.com/chequeo.pdf',
      file_name: 'chequeo.pdf',
      uploaded_at: '2026-07-29T00:00:00.000Z',
    });
  });

  it('runs the minimum-viable full path, saves personal info, and finalizes onboarding', async () => {
    await driveWizardToFinalize();

    expect(onboardingClient.putPersonalInfo).toHaveBeenCalledTimes(1);
    const [clientId, payload] = vi.mocked(onboardingClient.putPersonalInfo).mock.calls[0];
    expect(clientId).toBe('');
    expect(payload.complete).toBeUndefined();
    expect(payload.apple_health_connected).toBe(false);
    expect(payload.birthdate).toBe('1990-01-01');
    expect(payload.weight).toBe(80);
    expect(payload.height).toBe(180);
    expect(payload.body_fat).toBe(20);
    expect(payload.onboarding_report).toMatchObject({ birthdate: '1990-01-01', goals: 'Bajar grasa y ganar músculo' });

    expect(onboardingClient.finalizeOnboarding).toHaveBeenCalledWith('');
    const putOrder = vi.mocked(onboardingClient.putPersonalInfo).mock.invocationCallOrder[0];
    const finalizeOrder = vi.mocked(onboardingClient.finalizeOnboarding).mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(finalizeOrder);
  }, 15000);

  it('shows an explicit error and never completes when finalizeOnboarding reports missing items', async () => {
    vi.mocked(onboardingClient.finalizeOnboarding).mockResolvedValue({ success: false, missing: ['wearable', 'lab_week0'] });
    render(<OnboardingPage />);

    await screen.findByLabelText('País de residencia');
    fillModule1();
    clickContinue();
    await screen.findByLabelText('¿Horas de trabajo al día?');
    fillModule2();
    clickContinue();
    await screen.findByLabelText('Peso total');
    fillModule3();
    clickContinue();
    await screen.findByLabelText('Condición médica diagnosticada');
    fillModule4();
    clickContinue();
    await screen.findByLabelText('Describe cómo se ve tu desayuno');
    fillModule5();
    clickContinue();
    await screen.findByLabelText('Horas de sueño promedio');
    fillModule6();
    clickContinue();
    await screen.findByLabelText(/^Energía en la mañana/);
    fillModule7();
    clickContinue();
    await screen.findByLabelText(/^Nivel de estrés crónico/);
    fillModule8();
    clickContinue();
    await screen.findByLabelText('¿Has realizado alguna vez actividad física?');
    fillModule9();
    clickContinue();

    expect(await screen.findByText(/conectar un wearable.*cargar tu laboratorio de Semana 0/)).toBeInTheDocument();
    expect(screen.queryByText('Listo.')).not.toBeInTheDocument();
  }, 15000);

  it('does NOT call createAnthropometric when no antropometric measurement was entered', async () => {
    await driveWizardToFinalize();
    expect(onboardingClient.createAnthropometric).not.toHaveBeenCalled();
  }, 15000);

  it('calls createAnthropometric when at least one antropometric measurement was entered, after putPersonalInfo', async () => {
    await driveWizardToFinalize({ module3: { withAntropometria: true } });

    expect(onboardingClient.createAnthropometric).toHaveBeenCalledTimes(1);
    const [, input] = vi.mocked(onboardingClient.createAnthropometric).mock.calls[0];
    expect(input.cintura).toBe(85);
    expect(input.brazos).toBeNull();

    const putOrder = vi.mocked(onboardingClient.putPersonalInfo).mock.invocationCallOrder[0];
    const anthroOrder = vi.mocked(onboardingClient.createAnthropometric).mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(anthroOrder);
  }, 15000);

  it('does NOT call createInbodyRecord when OCR was never run, even with InBody fields filled by hand', async () => {
    await driveWizardToFinalize();
    expect(onboardingClient.createInbodyRecord).not.toHaveBeenCalled();
  }, 15000);

  it('uploads a pending checkup file before putPersonalInfo and merges the result into onboarding_report', async () => {
    await driveWizardToFinalize({ module4: { withCheckupFile: true } });

    expect(onboardingClient.uploadPersonalInfoFile).toHaveBeenCalledTimes(1);
    expect(onboardingClient.putPersonalInfo).toHaveBeenCalledTimes(1);

    const uploadOrder = vi.mocked(onboardingClient.uploadPersonalInfoFile).mock.invocationCallOrder[0];
    const putOrder = vi.mocked(onboardingClient.putPersonalInfo).mock.invocationCallOrder[0];
    expect(uploadOrder).toBeLessThan(putOrder);

    const [, payload] = vi.mocked(onboardingClient.putPersonalInfo).mock.calls[0];
    expect(payload.onboarding_report).toMatchObject({
      checkup_file_url: 'https://files.example.com/chequeo.pdf',
      checkup_file_name: 'chequeo.pdf',
      checkup_uploaded_at: '2026-07-29T00:00:00.000Z',
    });
  }, 15000);
});
