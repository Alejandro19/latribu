export type ParsedInbodyFields = {
  _version?: string | null;
  peso_total?: number;
  grasa_pct?: number;
  peso_objetivo?: number;
  grasa_visceral?: number;
  bmr?: number;
  ecw_tbw?: number;
  smm?: number;
  masa_osea?: number;
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
        const pw = winOf(text, /\bpeso\b(?!\s*(?:ideal|control|libre|magra))/i, 0, 200);
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

  // Peso ideal
  const ctrlSec = winOf(text, /control\s+de\s+peso/i, 0, 400);
  if (ctrlSec) {
    const idealSecM = ctrlSec.match(/peso\s+ideal[\s\S]{0,40}?([0-9]+[,.][0-9]+)/i);
    if (idealSecM) {
      v = parseNum(idealSecM[1]);
      if (v != null && v >= 30 && v <= 150) result.peso_objetivo = v;
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

  // Grasa visceral
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
  if (result.grasa_visceral == null) {
    m = text.match(/([0-9]{1,2})\s*\(?\s*1\s*[~-]\s*9\s*\)?/);
    if (m) {
      const gvv = parseInt(m[1], 10);
      if (gvv >= 1 && gvv <= 20) result.grasa_visceral = gvv;
    }
  }

  // Metabolismo basal (BMR)
  m = text.match(/tasa\s+metab[^\n]{0,30}?([0-9]{3,4})\s*kcal/i);
  if (!m) m = text.match(/metab[a-záéíóú]{0,10}\s+basal[^0-9]{0,15}([0-9]{3,4})/i);
  if (!m) m = text.match(/([0-9]{4})\s*kcal/i);
  if (m) {
    v = parseInt(m[1], 10);
    if (v >= 600 && v <= 5000) result.bmr = v;
  }

  // Agua corporal total
  m = text.match(/agua\s+corporal\s+(?:total\s+)?\([Ll]\)[^0-9]{0,10}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal\s+total[^0-9]{0,15}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal[^0-9]{0,20}([0-9]+[,.][0-9]+)/i);
  if (m) {
    v = parseNum(m[1]);
    if (v != null && v >= 15 && v <= 80) result.ecw_tbw = Math.round(v * 10) / 10;
  }

  // Masa muscular esquelética (SMM/MME)
  {
    const smmLines = text.split('\n');
    for (let si = 0; si < smmLines.length && result.smm == null; si++) {
      const sLine = smmLines[si];
      if (/m[uú]sculo\s+esqu/i.test(sLine) || /\bmme\s*\([Kk]g\)/i.test(sLine)) {
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
