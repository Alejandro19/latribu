// Puerto directo de computeAchievements/drawInstagramCard del legacy (index.html:3145-3251).
// streakWeeks=11 → trophiesEarned=2 (🏆🏆), medalsInCurrentCycle=3 (🎖️🎖️🎖️ + 1 slot vacío).
// Las copas nunca se resetean; las medallas del ciclo actual sí, cada 4.
export function computeAchievements(streakWeeks: number): { medalsInCurrentCycle: number; trophiesEarned: number } {
  return {
    medalsInCurrentCycle: streakWeeks % 4,
    trophiesEarned: Math.floor(streakWeeks / 4),
  };
}

const CARD_SCALE = 1080 / 260;

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
  ctx.textAlign = 'left';
  if (trophiesEarned > 0) ctx.fillText(`${'🏆'.repeat(trophiesEarned)} copas`, s(22), rowY);
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.85;
  ctx.letterSpacing = `${s(2)}px`;
  ctx.fillText(`${'🎖️'.repeat(medalsInCurrentCycle)}${'○'.repeat(4 - medalsInCurrentCycle)}`, W - s(22), rowY);
  ctx.letterSpacing = '0px';
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
  ctx.fillText('La Tribu', W / 2, brandY - s(14));
  ctx.fillStyle = '#9C8A67';
  ctx.font = `${s(7.5)}px Georgia, serif`;
  ctx.letterSpacing = `${s(0.05 * 7.5)}px`;
  ctx.fillText('COMUNIDAD DE BIENESTAR Y ALTO RENDIMIENTO', W / 2, brandY);
  ctx.letterSpacing = '0px';
}
