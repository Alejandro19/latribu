import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Module3, EMPTY_MODULE3_DRAFT, validateModule3, computeImc, type Module3Draft } from '../components/onboarding/Module3';
import * as onboardingClient from '../lib/onboarding-client';
import * as ocrParser from '../lib/parse-ocr-text';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/parse-ocr-text');

describe('validateModule3', () => {
  it('flags the 3 objetivos, 9 InBody fields and 4 photos as required, no more', () => {
    const invalid = validateModule3(EMPTY_MODULE3_DRAFT);
    expect(invalid).toEqual(
      expect.arrayContaining([
        'objetivo_peso', 'objetivo_grasa_corporal', 'objetivo_masa_muscular',
        'photo_frente', 'photo_lado_derecho', 'photo_lado_izquierdo', 'photo_espalda',
      ])
    );
    expect(invalid).not.toContain('inbody_anguloFase');
    expect(invalid).not.toContain('weight');
  });

  it('is empty once every required field is filled', () => {
    const photo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    const draft: Module3Draft = {
      ...EMPTY_MODULE3_DRAFT,
      objetivos: { peso: 'bajar', grasa_corporal: 'bajar', masa_muscular: 'subir' },
      inbody: {
        ...EMPTY_MODULE3_DRAFT.inbody,
        pesoTotal: '70', smm: '30', grasaPct: '18', pesoObjetivo: '65', grasaVisceral: '7',
        bmr: '1500', ecwTbw: '35', masaOsea: '3', altura: '170',
      },
      photos: { frente: photo, lado_derecho: photo, lado_izquierdo: photo, espalda: photo },
    };
    expect(validateModule3(draft)).toEqual([]);
  });
});

describe('computeImc', () => {
  it('computes IMC from weight (kg) and height (cm)', () => {
    expect(computeImc('70', '175')).toBe('22.9');
  });

  it('returns an empty string when weight or height is missing', () => {
    expect(computeImc('', '175')).toBe('');
    expect(computeImc('70', '')).toBe('');
  });
});

describe('Module3 component', () => {
  beforeEach(() => {
    vi.mocked(onboardingClient.updateClientObjetivos).mockResolvedValue(undefined);
  });

  it('saves an objetivo selection and calls updateClientObjetivos in the background', async () => {
    const onChange = vi.fn();
    render(<Module3 clientId="client-1" draft={EMPTY_MODULE3_DRAFT} onChange={onChange} invalidFields={new Set()} />);
    fireEvent.change(screen.getByLabelText(/objetivo de peso/i), { target: { value: 'bajar' } });
    expect(onChange).toHaveBeenCalled();
    await waitFor(() => expect(onboardingClient.updateClientObjetivos).toHaveBeenCalledWith('client-1', { peso: 'bajar', grasa_corporal: '', masa_muscular: '' }));
  });

  it('fills the InBody fields from a parsed OCR result after uploading a file', async () => {
    vi.mocked(onboardingClient.callOcr).mockResolvedValue({ text: 'texto extraído', source: 'vision' });
    vi.mocked(ocrParser.parseOcrText).mockReturnValue({ _version: 'InBody770', peso_total: 70, smm: 30 });
    vi.mocked(onboardingClient.uploadInbodyFile).mockResolvedValue({ file_url: 'https://example.com/f.pdf', file_name: 'reporte.pdf' });

    const onChange = vi.fn();
    render(<Module3 clientId="client-1" draft={EMPTY_MODULE3_DRAFT} onChange={onChange} invalidFields={new Set()} />);
    const file = new File(['%PDF-1.4'], 'reporte.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Sube el PDF o una foto/i), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Module3Draft;
    expect(lastCall.inbody.pesoTotal).toBe('70');
    expect(lastCall.inbody.smm).toBe('30');
    expect(lastCall.inbody.version).toBe('InBody770');
    expect(lastCall.inbody.fileUrl).toBe('https://example.com/f.pdf');
  });
});
