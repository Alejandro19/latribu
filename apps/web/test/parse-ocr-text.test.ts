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

  it('parses an InBody120-style report: bare MME label, "Nivel de Grasa Visceral" and single-line PGC (%)', () => {
    const parsed = parseOcrText(loadFixture('inbody120-report.txt'));
    expect(parsed._version).toBe('InBody120');
    expect(parsed.peso_total).toBe(87.1);
    expect(parsed.grasa_pct).toBe(22.5);
    expect(parsed.grasa_visceral).toBe(8);
    expect(parsed.grasa_visceral_range).toEqual([1, 9]);
    expect(parsed.smm).toBe(38.6);
    expect(parsed.ecw_tbw).toBe(49.4);
    expect(parsed.ecw_tbw_range).toEqual([36.2, 44.2]);
    expect(parsed.height).toBe(171);
    expect(parsed.masa_osea).toBe(4.62);
    expect(parsed.masa_osea_range).toEqual([3.35, 4.09]);
  });

  it('does not confuse a reference-range boundary from another cell with the actual weight on severely garbled OCR text', () => {
    // Texto real extraído por Tesseract (fallback local) de un InBody570
    // muy degradado: "57,4" quedó "574" (sin separador decimal, invisible
    // para el regex de decimales) y el peso caía en "46,9", que en realidad
    // es el límite superior del rango de referencia de Masa Magra en otra
    // celda de la tabla — antes de angostar la ventana de búsqueda, ese
    // 46,9 se guardaba como si fuera el peso real. Ahora debe quedar vacío
    // (dato faltante, corregible a mano) en vez de un dato incorrecto.
    const parsed = parseOcrText(loadFixture('inbody570-mariajose-raw-ocr.txt'));
    expect(parsed.peso_total).toBeUndefined();
    expect(parsed.peso_objetivo).toBe(58.6);
    expect(parsed.height).toBe(167);
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

  it('always reports the fixed InBody healthy range (1-9) for grasa visceral, regardless of nearby text', () => {
    // El rango saludable de grasa visceral es un estándar fijo del software
    // InBody (no varía por paciente/modelo), así que se fija en vez de
    // buscarlo en el texto — no debe importar qué otro rango aparezca cerca.
    const parsed = parseOcrText(
      'Análisis de Grasa Visceral\nEvolución del nivel de grasa visceral en el tiempo\nNivel de Grasa Visceral 8 ( 1~9 )\n'
    );
    expect(parsed.grasa_visceral).toBe(8);
    expect(parsed.grasa_visceral_range).toEqual([1, 9]);
  });

  it('parses an InBody570-style "Parámetros de Investigación" column (plantilla Integral) without BMR range bleeding into grasa visceral', () => {
    // Reporte real (InBody570, plantilla Integral: 370S/380/570/580):
    // "Nivel de Grasa Visceral 6 ( 1~9 )" quedó mostrando por error el rango
    // del BMR (1229-1420) en producción — el layout a dos columnas del
    // reporte dejaba ese texto más cerca en el OCR que el propio "( 1~9 )".
    const text = [
      'Análisis de Composición Corporal',
      'Agua Corporal Total (L) 30,1 ( 29,8-36,4 )',
      'Parámetros de Investigación',
      'Agua Intracelular 18,7 L ( 18,5-22,7 )',
      'Agua Extracelular 11,4 L ( 11,3-13,9 )',
      'Tasa Metabólica Basal 1256 kcal ( 1229-1420 )',
      'Relación Cintura-Cadera 0,86 ( 0,75-0,85 )',
      'Nivel de Grasa Visceral 6 ( 1-9 )',
      'Contenido Mineral Óseo 2,34 kg ( 2,28-2,78 )',
    ].join('\n');
    const parsed = parseOcrText(text);
    expect(parsed.bmr).toBe(1256);
    expect(parsed.bmr_range).toEqual([1229, 1420]);
    expect(parsed.grasa_visceral).toBe(6);
    expect(parsed.grasa_visceral_range).toEqual([1, 9]);
    expect(parsed.ecw_tbw).toBe(30.1);
    expect(parsed.ecw_tbw_range).toEqual([29.8, 36.4]);
  });

  it('discards a BMR/agua-corporal range that falls outside plausible bounds instead of showing a wrong value', () => {
    // Cinturón de seguridad extra: si por interferencia de OCR el rango que
    // queda pegado al valor es numéricamente imposible para el campo (ej. un
    // "(1-9)" de grasa visceral colándose junto al BMR), se descarta en vez
    // de mostrarlo como si fuera válido.
    const bmrText = 'Tasa Metabólica Basal 1256 kcal ( 1-9 )';
    const aguaText = 'Agua Corporal Total (L) 30,1 ( 1-9 )';
    expect(parseOcrText(bmrText).bmr_range).toBeUndefined();
    expect(parseOcrText(aguaText).ecw_tbw_range).toBeUndefined();
  });

  it('recovers the agua-corporal range on a real degraded InBody120 photo where OCR lost the separator ("49,436,2-44,2")', () => {
    // Texto real de Vision para una foto (no escaneo limpio) de un InBody120:
    // "Agua Corporal Total (L) 49,4 (36,2-44,2)" quedó "49,436,2-44,2\n)" —
    // sin paréntesis de apertura ni espacio entre el valor y el límite
    // inferior. El valor (49,4) ya se conoce, así que se ancla su propia
    // representación de texto y se toma lo que sigue como el rango.
    const parsed = parseOcrText(loadFixture('inbody120-felipe-raw-ocr.txt'));
    expect(parsed._version).toBe('InBody120');
    expect(parsed.ecw_tbw).toBe(49.4);
    expect(parsed.ecw_tbw_range).toEqual([36.2, 44.2]);
    expect(parsed.bmr).toBe(1828);
    expect(parsed.bmr_range).toEqual([1809, 2129]);
    expect(parsed.grasa_visceral).toBe(8);
    expect(parsed.grasa_visceral_range).toEqual([1, 9]);
    expect(parsed.masa_osea).toBe(4.62);
    expect(parsed.masa_osea_range).toEqual([3.35, 4.09]);
  });

  it('picks the real "kg"-suffixed Peso Ideal value on the same InBody120 photo, not a merged neighboring weight-range cell', () => {
    // En el mismo reporte, "Peso Ideal ... 79,4 kg" quedaba devolviendo 87,154
    // (el peso actual pegado sin separador al rango de otra mini-tabla,
    // "87,1(54,7-74,0)", que aparece ANTES del valor real en el texto OCR).
    const parsed = parseOcrText(loadFixture('inbody120-felipe-raw-ocr.txt'));
    expect(parsed.peso_objetivo).toBe(79.4);
  });

  it('finds the real masa_osea range on a real InBody570 (Vision) report where an unrelated Peso-range cell sits in between', () => {
    // Texto real de Vision para el InBody570 de María José: entre "Minerales
    // 2,79" y su propio rango "(2,76~3,38)" el layout a dos columnas del
    // reporte intercala el rango de OTRA celda (Peso: "57,4 (49,8-67,4)").
    // parseRange (que se queda con el primer paréntesis) lo agarraba y el
    // chequeo de límites lo rechazaba entero, dejando el campo vacío —
    // firstPlausibleRange debe saltarlo y seguir hasta el rango correcto.
    const parsed = parseOcrText(loadFixture('inbody570-mariajose-vision-raw.txt'));
    expect(parsed._version).toBe('InBody570');
    expect(parsed.peso_total).toBe(57.4);
    expect(parsed.grasa_pct).toBe(28.5);
    expect(parsed.peso_objetivo).toBe(58.6);
    expect(parsed.grasa_visceral).toBe(6);
    expect(parsed.grasa_visceral_range).toEqual([1, 9]);
    expect(parsed.bmr).toBe(1256);
    expect(parsed.bmr_range).toEqual([1229, 1420]);
    expect(parsed.ecw_tbw).toBe(30.1);
    expect(parsed.ecw_tbw_range).toEqual([29.8, 36.4]);
    expect(parsed.smm).toBe(22.4);
    expect(parsed.height).toBe(167);
    expect(parsed.masa_osea).toBe(2.79);
    expect(parsed.masa_osea_range).toEqual([2.76, 3.38]);
  });
});
