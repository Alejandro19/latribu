// Puerto directo de computeAchievements/drawInstagramCard del legacy (index.html:3145-3251).
// streakWeeks=11 → trophiesEarned=2 (2 íconos de trofeo), medalsInCurrentCycle=3
// (3 íconos de medalla + 1 slot vacío). Las copas nunca se resetean; las
// medallas del ciclo actual sí, cada 4.
export function computeAchievements(streakWeeks: number): { medalsInCurrentCycle: number; trophiesEarned: number } {
  return {
    medalsInCurrentCycle: streakWeeks % 4,
    trophiesEarned: Math.floor(streakWeeks / 4),
  };
}

const CARD_SCALE = 1080 / 260;

// Íconos de línea dibujados a mano sobre el canvas (reemplazan los emojis
// 🏆/🎖️ que antes se pintaban vía fillText) — mismo trazo fino monocromático
// que el resto del set de íconos de la app (components/ui/icons.tsx), pero
// como paths de canvas ya que fillText no puede renderizar un componente SVG.
function drawTrophyIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const w = size;
  const h = size;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, cy - h * 0.4);
  ctx.lineTo(cx + w * 0.3, cy - h * 0.4);
  ctx.lineTo(cx + w * 0.2, cy + h * 0.02);
  ctx.quadraticCurveTo(cx, cy + h * 0.16, cx - w * 0.2, cy + h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - w * 0.36, cy - h * 0.22, w * 0.12, Math.PI * 0.25, Math.PI * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + w * 0.36, cy - h * 0.22, w * 0.12, Math.PI * 1.4, Math.PI * 2.75);
  ctx.stroke();
  ctx.fillRect(cx - w * 0.045, cy + h * 0.02, w * 0.09, h * 0.16);
  ctx.fillRect(cx - w * 0.16, cy + h * 0.16, w * 0.32, h * 0.06);
  ctx.restore();
}

function drawMedalIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const r = size * 0.34;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 1.7);
  ctx.lineTo(cx + r * 0.55, cy - r * 1.7);
  ctx.lineTo(cx + r * 0.3, cy - r * 0.7);
  ctx.lineTo(cx - r * 0.3, cy - r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEmptyMedalSlot(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawInstagramCard(ctx: CanvasRenderingContext2D, { streakWeeks, phrase }: { streakWeeks: number; phrase: string | null }): void {
  const W = 1080;
  const H = 1920;
  const s = (n: number) => n * CARD_SCALE;

  const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, W * 0.75);
  bg.addColorStop(0, '#2A2118');
  bg.addColorStop(1, '#14100A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const padTop = H * 0.185;
  const padBottom = H * 0.145;
  const { medalsInCurrentCycle, trophiesEarned } = computeAchievements(streakWeeks);

  // Bloque 1: fila de logros
  const rowY = padTop - s(36);
  ctx.textBaseline = 'middle';
  ctx.font = `${s(12)}px Georgia, serif`;
  ctx.fillStyle = '#E8C97D';

  const iconSize = s(13);
  const iconGap = s(5);

  if (trophiesEarned > 0) {
    let x = s(22) + iconSize / 2;
    for (let i = 0; i < trophiesEarned; i++) {
      drawTrophyIcon(ctx, x, rowY, iconSize, '#E8C97D');
      x += iconSize + iconGap;
    }
    ctx.textAlign = 'left';
    ctx.fillText(' copas', x - iconGap + s(4), rowY);
  }

  ctx.globalAlpha = 0.85;
  const medalSlots = 4;
  const medalsWidth = medalSlots * iconSize + (medalSlots - 1) * iconGap;
  let medalX = W - s(22) - medalsWidth + iconSize / 2;
  for (let i = 0; i < medalSlots; i++) {
    if (i < medalsInCurrentCycle) drawMedalIcon(ctx, medalX, rowY, iconSize, '#E8C97D');
    else drawEmptyMedalSlot(ctx, medalX, rowY, iconSize, '#E8C97D');
    medalX += iconSize + iconGap;
  }
  ctx.globalAlpha = 1;

  // Bloque 2: sello circular
  const sealCenterY = H * 0.42;
  const sealR = s(75);
  ctx.beginPath();
  ctx.arc(W / 2, sealCenterY, sealR, 0, Math.PI * 2);
  ctx.strokeStyle = '#E8C97D';
  ctx.lineWidth = s(2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, sealCenterY, sealR - s(8), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(232,201,125,.4)';
  ctx.lineWidth = s(1);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#B8A88A';
  ctx.font = `${s(7.5)}px Georgia, serif`;
  ctx.letterSpacing = `${s(0.12 * 7.5)}px`;
  ctx.fillText('MI RACHA', W / 2, sealCenterY - s(28));
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#F8EFDD';
  ctx.font = `800 ${s(42)}px Georgia, serif`;
  ctx.fillText(String(streakWeeks), W / 2, sealCenterY);

  ctx.fillStyle = '#E8C97D';
  ctx.font = `${s(9)}px Georgia, serif`;
  ctx.fillText(streakWeeks === 1 ? 'SEMANA SEGUIDA' : 'SEMANAS SEGUIDAS', W / 2, sealCenterY + s(28));

  // Bloque 3: frase
  if (phrase) {
    ctx.fillStyle = '#F3E9D2';
    ctx.font = `italic ${s(14)}px Georgia, serif`;
    const maxWidth = s(200);
    const words = `"${phrase}"`.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineHeight = s(14) * 1.4;
    const phraseY = H - padBottom - s(90) - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, phraseY + i * lineHeight));
  }

  // Bloque 4: marca
  const brandY = H - padBottom;
  ctx.fillStyle = '#E8C97D';
  ctx.font = `700 ${s(13)}px Georgia, serif`;
  ctx.fillText('Ephirox', W / 2, brandY - s(14));
  ctx.fillStyle = '#9C8A67';
  ctx.font = `${s(7.5)}px Georgia, serif`;
  ctx.letterSpacing = `${s(0.05 * 7.5)}px`;
  ctx.fillText('REDEFINING LIMITS.', W / 2, brandY);
  ctx.letterSpacing = '0px';
}
