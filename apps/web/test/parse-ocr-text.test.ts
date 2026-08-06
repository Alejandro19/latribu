import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseOcrText } from '../lib/parse-ocr-text';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('parseOcrText', () => {
  it('parses a full InBody report via the Músculo-Grasa/PGC/section-based paths', () => {
    const parsed = parseOcrText(loadFixture('inbody-report-full.txt'));
    expect(parsed._version).toBe('InBody770');
    expect(parsed.peso_total).toBe(68.5);
    expect(parsed.grasa_pct).toBe(21.9);
    expect(parsed.peso_objetivo).toBe(65);
    expect(parsed.grasa_visceral).toBe(7);
    expect(parsed.bmr).toBe(1450);
    expect(parsed.ecw_tbw).toBe(35.4);
    expect(parsed.smm).toBe(28.4);
    expect(parsed.masa_osea).toBeCloseTo(3.2);
    expect(parsed.height).toBe(168);
    expect(parsed.angulo_fase).toBe(6.35);
  });

  it('falls back to line-based weight detection when there is no Músculo-Grasa/MME section', () => {
    const parsed = parseOcrText(loadFixture('inbody-report-fallback-weight.txt'));
    expect(parsed._version).toBe('InBody270');
    expect(parsed.peso_total).toBe(72.3);
    expect(parsed.height).toBe(175);
    expect(parsed.grasa_pct).toBeUndefined();
    expect(parsed.smm).toBeUndefined();
  });

  it('returns an empty-ish result for text with no recognizable InBody patterns', () => {
    const parsed = parseOcrText('texto sin ninguna relación con un reporte InBody');
    expect(parsed._version).toBeNull();
    expect(parsed.peso_total).toBeUndefined();
  });

  it('nulls out an implausible smm value that exceeds calculated lean mass', () => {
    // peso_total=68.5 (Músculo-Grasa zone before first "MME"), grasa_pct=50.3
    // (PGC (%) window), smm=59.0 (línea "Músculo Esquelético", individually
    // plausible within its own 10-60 range). masaMagra = 68.5*(1-0.503) ≈
    // 34.04; threshold ≈ 35.75. 59.0 > 35.75, so cross-validation must null
    // out smm even though it passed its own primary-extraction range check.
    const parsed = parseOcrText(
      'Músculo-Grasa\nPeso 68.5 kg\nMME\nPGC (%)\n50.3\nMasa de Músculo Esquelético\n59.0\nMME\n'
    );
    expect(parsed.peso_total).toBe(68.5);
    expect(parsed.grasa_pct).toBe(50.3);
    expect(parsed.smm).toBeUndefined();
  });
});
