export type ParsedInbodyFields = {
  _version?: string | null;
  peso_total?: number;
  grasa_pct?: number;
  peso_objetivo?: number;
  grasa_visceral?: number;
  grasa_visceral_range?: [number, number];
  bmr?: number;
  bmr_range?: [number, number];
  ecw_tbw?: number;
  ecw_tbw_range?: [number, number];
  smm?: number;
  masa_osea?: number;
  masa_osea_range?: [number, number];
  height?: number;
  angulo_fase?: number;
};

function parseNum(s: string | undefined | null): number | undefined {
  if (s == null) return undefined;
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

function firstDecimal(str: string, min?: number, max?: number): number | undefined {
  const re = /([0-9]+[,.][0-9]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const v = parseNum(m[1]);
    if (v != null && (min == null || v >= min) && (max == null || v <= max)) return v;
  }
  return undefined;
}

// Los reportes InBody imprimen el rango de referencia entre paréntesis justo
// después del valor, ej. "Nivel de Grasa Visceral 8 ( 1~9 )" — se usa tanto
// "~" como "-" como separador según el modelo/idioma del equipo. minBound/
// maxBound son un chequeo de cordura: en layouts a dos columnas (ej. plantilla
// Integral: InBody 370S/380/570/580) el texto de una celda vecina puede
// quedar más cerca que el rango real y "colarse" — un reporte real (InBody570)
// mostró esto: a "Nivel de Grasa Visceral" se le pegó el rango del BMR
// (1229-1420) en vez del propio (1-9). Un rango fuera de los límites
// plausibles del campo se descarta antes que mostrar un dato falso.
function parseRange(win: string, minBound?: number, maxBound?: number): [number, number] | undefined {
  const m = win.match(/\(\s*([0-9]+(?:[,.][0-9]+)?)\s*[~-]\s*([0-9]+(?:[,.][0-9]+)?)\s*\)/);
  if (!m) return undefined;
  const lo = parseNum(m[1]);
  const hi = parseNum(m[2]);
  if (lo == null || hi == null || lo >= hi) return undefined;
  if (minBound != null && lo < minBound) return undefined;
  if (maxBound != null && hi > maxBound) return undefined;
  return [lo, hi];
}

// Como parseRange, pero cuando hay más de un "(...)" candidato en la ventana
// prueba cada uno en orden hasta encontrar el primero que además "encierre"
// el valor ya conocido (dentro de un margen razonable) — así se salta el
// rango de OTRA celda de la tabla que simplemente quedó más cerca en el texto
// OCR. Caso real (InBody570): entre "Minerales 2,79" y su propio rango
// "(2,76~3,38)" se coló el rango del Peso, "(49,8-67,4)", por el layout a dos
// columnas — parseRange solo(que se queda con el primer match) lo agarraba
// y el chequeo de límites lo descartaba entero, dejando el campo vacío en vez
// de seguir buscando el rango correcto un poco más adelante.
function firstPlausibleRange(win: string, value: number, minBound: number, maxBound: number): [number, number] | undefined {
  const re = /\(\s*([0-9]+(?:[,.][0-9]+)?)\s*[~-]\s*([0-9]+(?:[,.][0-9]+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(win)) !== null) {
    const lo = parseNum(m[1]);
    const hi = parseNum(m[2]);
    if (lo == null || hi == null || lo >= hi) continue;
    if (lo < minBound || hi > maxBound) continue;
    if (lo > value + 1 || hi < value - 1) continue;
    return [lo, hi];
  }
  return undefined;
}

// Respaldo para cuando el OCR pierde el paréntesis/espacio entre el valor y
// su rango: quedan pegados sin separador, ej. "49,436,2-44,2" en vez de
// "49,4 (36,2-44,2)" (caso real: foto de un InBody120 de baja calidad).
// Separar esos dígitos a ciegas es ambiguo (¿"49,43" + "6,2"? ¿"49,4" +
// "36,2"?) — pero el valor YA se conoce (se extrajo antes), así que se busca
// su propia representación de texto dentro de la ventana y se toma todo lo
// que sigue como el bloque del rango, sin adivinar dónde termina.
function rangeAfterKnownValue(win: string, value: number, minBound: number, maxBound: number): [number, number] | undefined {
  for (const needle of [String(value).replace('.', ','), String(value).replace('.', '.')]) {
    const idx = win.indexOf(needle);
    if (idx < 0) continue;
    const after = win.slice(idx + needle.length, idx + needle.length + 40);
    const m = after.match(/^[\s)]*\(?\s*([0-9]{1,3}[,.][0-9])\s*[~\-\s]\s*([0-9]{1,3}[,.][0-9])/);
    if (!m) continue;
    const lo = parseNum(m[1]);
    const hi = parseNum(m[2]);
    if (lo == null || hi == null || lo >= hi) continue;
    if (lo < minBound || hi > maxBound) continue;
    return [lo, hi];
  }
  return undefined;
}

function winOf(src: string, re: RegExp, before: number, after: number): string {
  const norm = src
    .replace(/[áàâã]/gi, 'a')
    .replace(/[éèê]/gi, 'e')
    .replace(/[íì]/gi, 'i')
    .replace(/[óòô]/gi, 'o')
    .replace(/[úù]/gi, 'u');
  const idx = norm.search(re);
  if (idx < 0) return '';
  const start = Math.max(0, idx - before);
  const end = Math.min(src.length, idx + after);
  return src.slice(start, end);
}

// Puerto fiel de `m3ParseOcrText` (index.html:2307-2505) — el valor de esta
// función está en las ventanas de búsqueda y rangos numéricos ya validados
// contra reportes InBody reales, no en su elegancia. No simplificar sin
// volver a validar contra un reporte real.
export function parseOcrText(text: string): ParsedInbodyFields {
  const result: ParsedInbodyFields = {};
  let v: number | undefined;
  let m: RegExpMatchArray | null;

  // Versión InBody detectada en el encabezado
  {
    const fechaIdx = text.search(/fecha[\s/]*hora|date[\s/]*time/i);
    const hdrZone = fechaIdx > 0 ? text.slice(0, fechaIdx) : text.slice(0, 600);
    const vM = hdrZone.match(/InBody\s*(\d[\w-]*)/i);
    if (vM) {
      result._version = 'InBody' + vM[1];
    } else {
      const vF = text.match(/InBody\s*(\d[\w-]+)/i);
      result._version = vF ? 'InBody' + vF[1] : null;
    }
  }

  // Peso corporal — sección "Músculo-Grasa", último decimal antes de "MME"
  {
    const mgRe = /m[uú]sculo[\s-]+gras[ao]/i;
    let mgIdx = text.search(mgRe);
    if (mgIdx < 0) mgIdx = 0;
    const mmeIdx = text.slice(mgIdx).search(/\bmme\b/i);
    let found = false;
    if (mmeIdx >= 0) {
      const zone = text.slice(mgIdx, mgIdx + mmeIdx);
      const decs: number[] = [];
      const dRe = /([0-9]+[,.][0-9]+)/g;
      let dm: RegExpExecArray | null;
      while ((dm = dRe.exec(zone)) !== null) {
        const dv = parseNum(dm[1]);
        if (dv != null && dv >= 40 && dv <= 250) decs.push(dv);
      }
      if (decs.length > 0) {
        result.peso_total = decs[decs.length - 1];
        found = true;
      }
    }
    if (!found) {
      const lines = text.split('\n');
      for (let li = 0; li < lines.length && result.peso_total == null; li++) {
        const ll = lines[li];
        if (/\bpeso\b/i.test(ll) && !/ideal|control|libre|magra/i.test(ll)) {
          const lw = ll + '\n' + (lines[li + 1] || '') + '\n' + (lines[li + 2] || '');
          v = firstDecimal(lw, 40, 250);
          if (v != null) result.peso_total = v;
        }
      }
      if (result.peso_total == null) {
        // Ventana angosta a propósito: con texto muy degradado (OCR local
        // sin Vision) una ventana amplia puede alcanzar el límite superior
        // de un rango de referencia de OTRA celda de la tabla (ej. "Masa
        // Magra (38,3-46,9)") y devolverlo como si fuera el peso — un dato
        // incorrecto es peor que uno vacío. 40 caracteres alcanza para
        // "Peso ... 57,4 kg" pero no para cruzar a una celda distinta.
        const pw = winOf(text, /\bpeso\b(?!\s*(?:ideal|control|libre|magra))/i, 0, 40);
        if (pw) {
          v = firstDecimal(pw, 40, 250);
          if (v != null) result.peso_total = v;
        }
      }
    }
  }

  // % Grasa corporal (PGC)
  {
    let bmi: number | undefined;
    if (result.peso_total) {
      let htM = text.match(/\b(1[4-9][0-9]|2[0-2][0-9])\s*cm\b/i);
      if (!htM) htM = text.match(/altura\s+([0-9]{3})/i);
      if (htM) {
        const ht = parseInt(htM[1], 10);
        bmi = result.peso_total / Math.pow(ht / 100, 2);
      }
    }
    // Camino directo: "PGC (%) 22,5" en una sola línea/frase — más simple y
    // menos propenso a ruido de OCR que el heurístico multi-línea de abajo,
    // que sigue existiendo como respaldo para reportes donde el valor no
    // queda pegado a la etiqueta.
    const pgcDirectM = text.match(/pgc[^\n(]{0,10}\(%\)[^0-9]{0,15}([0-9]+[,.][0-9]+)/i);
    if (pgcDirectM) {
      const pgcDirectV = parseNum(pgcDirectM[1]);
      if (pgcDirectV != null && pgcDirectV >= 10 && pgcDirectV <= 65) result.grasa_pct = pgcDirectV;
    }
    const pgcPos: number[] = [];
    const pgcRe = /\bpgc\b/gi;
    let pgcM: RegExpExecArray | null;
    while ((pgcM = pgcRe.exec(text)) !== null) pgcPos.push(pgcM.index);
    const tries = pgcPos.length >= 2 ? [pgcPos[1], pgcPos[0]] : pgcPos.length >= 1 ? [pgcPos[0]] : [];
    for (let ti = 0; ti < tries.length && result.grasa_pct == null; ti++) {
      const pgcWin = text.slice(tries[ti], tries[ti] + 600);
      const pctOff = pgcWin.search(/\(%\)/);
      const searchFrom = pctOff >= 0 ? pgcWin.slice(pctOff + 3) : pgcWin;
      const sfLines = searchFrom.split('\n');
      for (let sfi = 0; sfi < sfLines.length && result.grasa_pct == null; sfi++) {
        const sfl = sfLines[sfi].trim();
        const sfDecs = sfl.match(/[0-9]+[,.][0-9]+/g);
        if (sfDecs && sfDecs.length === 1) {
          const sfV = parseNum(sfDecs[0]);
          if (sfV != null && sfV >= 10 && sfV <= 65) {
            if (Math.abs(sfV - Math.round(sfV)) < 0.01) continue;
            if (/[0-9]\s*(?:kg|%)/i.test(sfl)) continue;
            if (bmi && Math.abs(sfV - bmi) <= 0.8) continue;
            if (result.peso_total != null && Math.abs(sfV - result.peso_total) <= 2) continue;
            result.grasa_pct = sfV;
          }
        }
      }
    }
  }

  // Peso ideal — se prueba primero un valor sufijado "kg" (ej. "Peso Ideal
  // 79,4 kg"), que es como el reporte lo imprime siempre. Buscar el primer
  // decimal después de la etiqueta sin exigir el sufijo es frágil: en OCR
  // degradado, una celda vecina de otra mini-tabla (ej. el peso actual con su
  // propio rango de referencia, "87,1(54,7-74,0)") puede quedar más cerca de
  // la etiqueta que el valor real y capturarse por error — caso real
  // (InBody120): devolvía 87,154 en vez del "79,4 kg" real, unas líneas más
  // abajo. El patrón sin "kg" se mantiene como respaldo para reportes donde
  // ese sufijo no quedó pegado al número.
  const ctrlSec = winOf(text, /control\s+de\s+peso/i, 0, 400);
  if (ctrlSec) {
    const idealKgM = ctrlSec.match(/peso\s+ideal[\s\S]{0,80}?([0-9]{1,3}[,.][0-9])\s*kg\b/i);
    if (idealKgM) {
      v = parseNum(idealKgM[1]);
      if (v != null && v >= 30 && v <= 150) result.peso_objetivo = v;
    }
    if (result.peso_objetivo == null) {
      const idealSecM = ctrlSec.match(/peso\s+ideal[\s\S]{0,40}?([0-9]+[,.][0-9]+)/i);
      if (idealSecM) {
        v = parseNum(idealSecM[1]);
        if (v != null && v >= 30 && v <= 150) result.peso_objetivo = v;
      }
    }
  }
  if (result.peso_objetivo == null) {
    const idealRe = /ideal/gi;
    let idealM: RegExpExecArray | null;
    while ((idealM = idealRe.exec(text)) !== null) {
      const iWin = text.slice(idealM.index, idealM.index + 100);
      const iNumRe = /([0-9]+[,.][0-9]+)/g;
      let iDm: RegExpExecArray | null;
      while ((iDm = iNumRe.exec(iWin)) !== null) {
        const iV = parseNum(iDm[1]);
        if (iV == null || iV < 40 || iV > 150) continue;
        if (result.peso_total != null && Math.abs(iV - result.peso_total) < 2) continue;
        result.peso_objetivo = iV;
        break;
      }
      if (result.peso_objetivo != null) break;
    }
  }

  // Grasa visceral — algunos modelos (ej. InBody120) la etiquetan "Nivel de
  // Grasa Visceral" con el valor pegado a la etiqueta; se prueba ese patrón
  // directo antes del genérico basado solo en "visceral".
  const viscNivelM = text.match(/nivel\s+de\s+grasa\s+visceral[^0-9]{0,20}([0-9]{1,2})\b/i);
  if (viscNivelM) {
    const vv0 = parseInt(viscNivelM[1], 10);
    if (vv0 >= 1 && vv0 <= 20) result.grasa_visceral = vv0;
  }
  if (result.grasa_visceral == null) {
    const viscIdx = text.search(/visceral/i);
    if (viscIdx >= 0) {
      const viscSnip = text.slice(viscIdx + 8, viscIdx + 150);
      const viscClean = viscSnip.replace(/[0-9]+[,.][0-9]+/g, '');
      const viscIntM = viscClean.match(/\b([0-9]{1,2})\b/);
      if (viscIntM) {
        const vv = parseInt(viscIntM[1], 10);
        if (vv >= 1 && vv <= 20) result.grasa_visceral = vv;
      }
    }
  }
  if (result.grasa_visceral == null) {
    m = text.match(/([0-9]{1,2})\s*\(?\s*1\s*[~-]\s*9\s*\)?/);
    if (m) {
      const gvv = parseInt(m[1], 10);
      if (gvv >= 1 && gvv <= 20) result.grasa_visceral = gvv;
    }
  }
  // El rango saludable de grasa visceral (1-9) es un estándar fijo del
  // software InBody en las 3 familias de plantillas (Estándar, Integral y
  // Médica/Académica) — no varía por paciente ni por modelo, así que se fija
  // directo en vez de buscarlo en el texto. Buscarlo dinámicamente resultó
  // frágil: en un reporte real InBody570 (plantilla Integral, layout a dos
  // columnas) el rango del BMR quedó más cerca en el texto OCR que el propio
  // "( 1~9 )" y terminaba mostrándose por error bajo Grasa visceral.
  if (result.grasa_visceral != null) result.grasa_visceral_range = [1, 9];

  // Metabolismo basal (BMR)
  m = text.match(/tasa\s+metab[^\n]{0,30}?([0-9]{3,4})\s*kcal/i);
  if (!m) m = text.match(/metab[a-záéíóú]{0,10}\s+basal[^0-9]{0,15}([0-9]{3,4})/i);
  if (!m) m = text.match(/([0-9]{4})\s*kcal/i);
  if (m) {
    v = parseInt(m[1], 10);
    if (v >= 600 && v <= 5000) {
      result.bmr = v;
      result.bmr_range = parseRange(text.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + 40), 400, 6000);
    }
  }

  // Agua corporal total — la ventana de caracteres antes del número se
  // amplió (15/20 → 40/60) para tolerar el ruido extra que deja el OCR local
  // (Tesseract, fallback cuando Vision no está disponible) entre la etiqueta
  // y el valor, comparado con lo limpio que sale de Vision.
  m = text.match(/agua\s+corporal\s+(?:total\s+)?\([Ll]\)[^0-9]{0,10}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal\s+total[^0-9]{0,40}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal[^0-9]{0,60}([0-9]+[,.][0-9]+)/i);
  if (m) {
    v = parseNum(m[1]);
    if (v != null && v >= 15 && v <= 80) {
      result.ecw_tbw = Math.round(v * 10) / 10;
      const winStart = m.index ?? 0;
      result.ecw_tbw_range = parseRange(text.slice(winStart, winStart + m[0].length + 40), 5, 100);
      if (result.ecw_tbw_range == null) {
        result.ecw_tbw_range = rangeAfterKnownValue(text.slice(winStart, winStart + m[0].length + 60), result.ecw_tbw, 5, 100);
      }
    }
  }

  // Masa muscular esquelética (SMM/MME)
  {
    const smmLines = text.split('\n');
    for (let si = 0; si < smmLines.length && result.smm == null; si++) {
      const sLine = smmLines[si];
      // "MME (kg)" es el formato de reportes InBody770-style; algunos
      // modelos (ej. InBody120) muestran "MME" solo, sin "(kg)" pegado —
      // se acepta la etiqueta sola siempre que exista un decimal plausible
      // cerca (lo valida firstDecimal más abajo, rango 10-60).
      if (/m[uú]sculo\s+esqu/i.test(sLine) || /\bmme\b/i.test(sLine)) {
        const sWin = sLine + '\n' + (smmLines[si + 1] || '') + '\n' + (smmLines[si + 2] || '') + '\n' + (smmLines[si + 3] || '');
        v = firstDecimal(sWin, 10, 60);
        if (v != null) result.smm = v;
      }
    }
    if (result.smm == null) {
      const sWinG = winOf(text, /masa\s+de\s+m[uú]sculo/i, 0, 150);
      if (sWinG) {
        v = firstDecimal(sWinG, 10, 60);
        if (v != null) result.smm = v;
      }
    }
  }

  // Masa ósea (minerales)
  {
    const secIdx = text.search(/[aá]n[aá]lisis\s+de\s+composici[oó]n\s+corporal/i);
    const src = secIdx >= 0 ? text.slice(secIdx, secIdx + 800) : text;
    const mm = src.match(/minerales\s*\(kg\)\s*([0-9]+[,.][0-9]+)/i);
    let done = false;
    if (mm) {
      const vv = parseNum(mm[1]);
      if (vv != null && vv >= 1.5 && vv <= 5.5) {
        result.masa_osea = vv;
        done = true;
      }
    }
    if (!done) {
      const lns = src.split('\n');
      outer: for (let li = 0; li < lns.length; li++) {
        if (!/mineral/i.test(lns[li])) continue;
        if (/prote[ií]/i.test(lns[li])) continue;
        const nums = lns[li].match(/([0-9]+[,.][0-9]+)/g) || [];
        for (const numStr of nums) {
          const vv2 = parseNum(numStr);
          if (vv2 != null && vv2 >= 1.5 && vv2 <= 5.5) {
            result.masa_osea = vv2;
            break outer;
          }
        }
        if (li + 1 < lns.length) {
          const next = lns[li + 1].match(/([0-9]+[,.][0-9]+)/g) || [];
          for (const numStr of next) {
            const vv3 = parseNum(numStr);
            if (vv3 != null && vv3 >= 1.5 && vv3 <= 5.5) {
              result.masa_osea = vv3;
              break outer;
            }
          }
        }
      }
    }
    // El rango se ancla en la propia representación de texto del valor ya
    // encontrado (igual que en agua corporal) en vez de en la etiqueta
    // "Minerales": esa palabra también aparece en la sección "Evaluación de
    // Nutrición" (checklist Normal/Deficiente sin números), que en un layout
    // a dos columnas puede quedar antes en el texto OCR que la fila real de
    // la tabla — el mismo tipo de interferencia que afectó a grasa visceral.
    // Se usa firstPlausibleRange (no parseRange) porque, en el layout a dos
    // columnas de la plantilla Integral, entre "2,79" y su rango real
    // "(2,76~3,38)" se cuela el rango de OTRA celda (Peso: "(49,8-67,4)") —
    // hay que seguir buscando en vez de quedarse con el primer paréntesis.
    if (result.masa_osea != null) {
      const valueStr = String(result.masa_osea).replace('.', ',');
      const idx = text.indexOf(valueStr);
      if (idx >= 0) {
        result.masa_osea_range = firstPlausibleRange(text.slice(idx, idx + 80), result.masa_osea, 1, 8);
      }
    }
  }

  // Altura
  m = text.match(/altura\s+([0-9]{3})\s*cm/i);
  if (!m) m = text.match(/\b(1[4-9][0-9]|2[0-2][0-9])\s*cm\b/i);
  if (m) result.height = parseInt(m[1], 10);

  // Ángulo de fase
  const afIdx = text.search(/[aá]ngulo\s+de\s+fase/i);
  if (afIdx >= 0) {
    const afWin = text.slice(afIdx, afIdx + 120);
    const afM = afWin.match(/([0-9]+[,.][0-9]+)/);
    if (afM) {
      v = parseNum(afM[1]);
      if (v != null && v >= 1 && v <= 15) result.angulo_fase = v;
    }
  }

  // Validación cruzada: SMM no puede superar la masa magra calculada
  if (result.peso_total != null && result.grasa_pct != null && result.smm != null) {
    const masaMagra = result.peso_total * (1 - result.grasa_pct / 100);
    if (result.smm > masaMagra * 1.05) result.smm = undefined;
  }

  return result;
}
