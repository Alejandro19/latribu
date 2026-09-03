// apps/web/test/wizard-shell-validation.test.tsx
//
// Regression coverage for a real bug reported against the live onboarding
// wizard: a field flagged invalid (red border + "Este campo es obligatorio.")
// after clicking "Continuar" stayed marked invalid even after the user typed
// a valid value — because invalidFieldIds was only ever recomputed on the
// NEXT "Continuar" click, never as the user actively fixed the field.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../app/(app)/onboarding/page';
import * as apiClient from '../lib/api-client';
import * as onboardingClient from '../lib/onboarding-client';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/geo-client');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /continuar|finalizar/i }));
}

function uploadPhoto(label: string, filename: string) {
  const file = new File(['fake-image-bytes'], filename, { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

async function driveToModule4() {
  render(<OnboardingPage />);

  await screen.findByLabelText('País de residencia');
  setField('Nombre completo', 'Cliente de Prueba');
  setField('Edad', '35');
  setField('Fecha de nacimiento', '1990-01-01');
  setField('Género', 'Masculino');
  setField('Ocupación', 'Ingeniero');
  setField('Estado civil', 'Soltero/a');
  setField('Identificación', 'Cédula de ciudadanía');
  setField('Número de identificación', '1234567890');
  setField('Correo electrónico', 'cliente@example.com');
  setField('País de residencia', 'CO');
  setField('Ciudad', 'Bogotá');
  setField('Celular (WhatsApp)', '3001234567');
  clickContinue();

  await screen.findByLabelText('¿Horas de trabajo al día?');
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar ¿Horas de trabajo al día?' }));
  fireEvent.change(screen.getByLabelText(/^¿Demanda cognitiva/), { target: { value: '5' } });
  setField('¿Con qué frecuencia viajas por trabajo?', 'Nunca');
  setField('¿Dónde trabajas principalmente?', 'Oficina');
  setField('¿Tienes control sobre tu horario?', 'Alto');
  clickContinue();

  await screen.findByLabelText('Peso total');
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
  uploadPhoto('Frente', 'frente.jpg');
  uploadPhoto('Lado derecho', 'lado-derecho.jpg');
  uploadPhoto('Lado izquierdo', 'lado-izquierdo.jpg');
  uploadPhoto('Espalda', 'espalda.jpg');
  clickContinue();

  await screen.findByLabelText('Condición médica diagnosticada');
}

describe('WizardShell — live validation clears once a field is fixed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá']);
    vi.mocked(onboardingClient.getPersonalInfoAccess).mockResolvedValue('standard');
    vi.mocked(onboardingClient.updateClientObjetivos).mockResolvedValue(undefined);
  });

  it('clears a required textarea\'s red border/error as soon as it has content, without clicking Continuar again', async () => {
    await driveToModule4();

    // Deja "Observaciones del chequeo" vacío a propósito; llena el resto.
    setField('Condición médica diagnosticada', 'Ninguna');
    setField('¿Tomas medicamentos actualmente?', 'No');
    setField('Alergias', 'Ninguna');
    setField('Pre existencias medicas o Lesiones', 'Ninguna');
    setField('¿Intervenciones quirúrgicas?', 'No');
    setField('Último chequeo médico', 'Menos de 6 meses');
    setField('Salud mental diagnosticada', 'Sin diagnóstico');
    setField('¿Tienes autorización médica para entrenar?', 'Sí');
    setField('Escribe 3 razones por las que quieres alcanzar tu objetivo', 'Salud, estética, energía');

    clickContinue();

    await screen.findAllByText('Este campo es obligatorio.');

    setField('Observaciones del chequeo', 'Hacer más ejercicio');

    await waitFor(() => {
      expect(screen.queryByText('Este campo es obligatorio.')).not.toBeInTheDocument();
    });
  }, 15000);
});
