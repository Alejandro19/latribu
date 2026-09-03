import { describe, it, expect, afterEach } from 'vitest';
import { extractMarkersWithAI, setAiExtractorForTests, AiNotConfiguredError } from '../src/services/lab-ai-extraction.service.js';
import { ALL_MARKER_IDS } from '../src/services/insights/marker-ranges.js';

describe('lab-ai-extraction.service', () => {
  afterEach(() => {
    setAiExtractorForTests(null);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws AiNotConfiguredError when ANTHROPIC_API_KEY is missing and no test override is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(extractMarkersWithAI('texto de prueba')).rejects.toBeInstanceOf(AiNotConfiguredError);
  });

  it('returns all 32 known markers, filling in non-detected ones the AI omitted', async () => {
    setAiExtractorForTests(async () => [{ marker_id: 'cortisol', value: 15, detected: true }]);
    const result = await extractMarkersWithAI('texto de prueba');
    expect(result).toHaveLength(ALL_MARKER_IDS.length);
    const cortisol = result.find((m) => m.marker_id === 'cortisol');
    expect(cortisol).toEqual({ marker_id: 'cortisol', value: 15, unit: 'ug/dL', detected: true });
    const undetected = result.find((m) => m.marker_id === 'glucosa');
    expect(undetected).toEqual({ marker_id: 'glucosa', value: null, unit: null, detected: false });
  });

  it('never trusts a marker_id outside the closed list, even if the AI hallucinates one', async () => {
    setAiExtractorForTests(async () => [{ marker_id: 'marcador_inventado', value: 999, detected: true }]);
    const result = await extractMarkersWithAI('texto de prueba');
    expect(result.find((m) => (m.marker_id as string) === 'marcador_inventado')).toBeUndefined();
    expect(result).toHaveLength(ALL_MARKER_IDS.length);
  });

  it('never reports a value when detected is false, even if the AI attached a stray value', async () => {
    setAiExtractorForTests(async () => [{ marker_id: 'hdl', value: 60, detected: false }]);
    const result = await extractMarkersWithAI('texto de prueba');
    const hdl = result.find((m) => m.marker_id === 'hdl');
    expect(hdl).toEqual({ marker_id: 'hdl', value: null, unit: null, detected: false });
  });

  it('never reports detected: true without a numeric value', async () => {
    setAiExtractorForTests(async () => [{ marker_id: 'hdl', value: null, detected: true }]);
    const result = await extractMarkersWithAI('texto de prueba');
    const hdl = result.find((m) => m.marker_id === 'hdl');
    expect(hdl?.detected).toBe(false);
  });
});
