// apps/web/test/wizard-shell-chips.test.tsx
//
// Regression coverage for a reported bug: selecting a chip inside a
// conditionally-revealed chips field (ej. "¿Cuáles probióticos?", solo
// visible cuando "¿Consumes probióticos?" = "Sí") supuestamente "rompía el
// diseño de la página". Se verificó manualmente que el DOM queda intacto —
// ningún campo posterior desaparece ni se oculta de más — así que si el
// problema persiste visualmente, no es por campos perdidos ni por la
// condición Sí/No (que este test también cubre).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingPage from '../app/(app)/onboarding/page';
import * as apiClient from '../lib/api-client';
import * as onboardingClient from '../lib/onboarding-client';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/geo-client');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /continuar|finalizar/i }));
}
function uploadPhoto(label: string, filename: string) {
  const file = new File(['x'], filename, { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

async function driveToModule5() {
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
  uploadPhoto('Frente', 'a.jpg');
  uploadPhoto('Lado derecho', 'b.jpg');
  uploadPhoto('Lado izquierdo', 'c.jpg');
  uploadPhoto('Espalda', 'd.jpg');
  clickContinue();

  await screen.findByLabelText('Condición médica diagnosticada');
  setField('Condición médica diagnosticada', 'Ninguna');
  setField('¿Tomas medicamentos actualmente?', 'No');
  setField('Alergias', 'Ninguna');
  setField('Pre existencias medicas o Lesiones', 'Ninguna');
  setField('¿Intervenciones quirúrgicas?', 'No');
  setField('Último chequeo médico', 'Menos de 6 meses');
  setField('Observaciones del chequeo', 'ok');
  setField('Salud mental diagnosticada', 'Sin diagnóstico');
  setField('¿Tienes autorización médica para entrenar?', 'Sí');
  setField('Escribe 3 razones por las que quieres alcanzar tu objetivo', 'x');
  clickContinue();

  await screen.findByLabelText('Describe cómo se ve tu desayuno');
}

describe('WizardShell — módulo 5, chips condicionales de probióticos/suplementos', () => {
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

  it('"¿Cuáles probióticos?" solo aparece después de elegir "Sí" en "¿Consumes probióticos?"', async () => {
    await driveToModule5();
    expect(screen.queryByText('¿Cuáles probióticos?')).not.toBeInTheDocument();

    setField('¿Consumes probióticos?', 'No');
    expect(screen.queryByText('¿Cuáles probióticos?')).not.toBeInTheDocument();

    setField('¿Consumes probióticos?', 'Sí');
    expect(screen.getByText('¿Cuáles probióticos?')).toBeInTheDocument();
  }, 15000);

  it('no oculta ni pierde ningún campo posterior al seleccionar un chip de probióticos', async () => {
    await driveToModule5();
    setField('¿Consumes probióticos?', 'Sí');

    fireEvent.click(screen.getByLabelText('Kéfir'));

    expect(screen.getByLabelText('¿Cuántas veces comes por fuera?')).toBeInTheDocument();
    expect(screen.getByLabelText('Consumo de snacks entre comidas')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de dieta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
  }, 15000);

  it('no oculta ni pierde ningún campo posterior al seleccionar un chip de suplementos', async () => {
    await driveToModule5();
    setField('¿Tomas suplementos actualmente?', 'Sí');

    fireEvent.click(screen.getByLabelText('Magnesio'));

    expect(screen.getByLabelText('Consumo de otras sustancias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
  }, 15000);
});
