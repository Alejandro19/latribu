import { describe, it, expect } from 'vitest';
import {
  PersonalInfoUpdateSchema,
  AnthropometricRecordInputSchema,
  PhotoUploadMetadataSchema,
  InbodyRecordInputSchema,
  OcrInputSchema,
} from '../src/personal-info.js';

describe('personal-info schemas', () => {
  it('accepts a partial personal-info update', () => {
    const result = PersonalInfoUpdateSchema.safeParse({ country: 'México', weight: 70.5, complete: true });
    expect(result.success).toBe(true);
  });

  it('accepts an empty personal-info update', () => {
    const result = PersonalInfoUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts onboarding_report as an opaque object', () => {
    const result = PersonalInfoUpdateSchema.safeParse({ onboarding_report: { work_hours: '8', proteins: ['Pollo', 'Huevo'] } });
    expect(result.success).toBe(true);
  });

  it('accepts a valid anthropometric record input', () => {
    const result = AnthropometricRecordInputSchema.safeParse({ fecha: '2026-01-01', peso: 70, mes_num: 1 });
    expect(result.success).toBe(true);
  });

  it('coerces numeric anthropometric fields from strings', () => {
    const result = AnthropometricRecordInputSchema.safeParse({ peso: '70.5' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.peso).toBe(70.5);
  });

  it('accepts a valid photo upload metadata input', () => {
    const result = PhotoUploadMetadataSchema.safeParse({ angle: 'frente', mes_num: 2 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid photo angle', () => {
    const result = PhotoUploadMetadataSchema.safeParse({ angle: 'arriba' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid InBody record input', () => {
    const result = InbodyRecordInputSchema.safeParse({ fecha: '2026-01-01', peso_total: 70, smm: 30, grasa_pct: 15 });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OCR input', () => {
    const result = OcrInputSchema.safeParse({ base64: 'JVBERi0xLjQK' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty OCR input', () => {
    const result = OcrInputSchema.safeParse({ base64: '' });
    expect(result.success).toBe(false);
  });
});
