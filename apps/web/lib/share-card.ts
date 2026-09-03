// Puerto de shareTrainingCard del legacy (index.html:3256-3285), separado
// del dibujo del canvas para poder testearlo de forma aislada.
export async function shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen.');
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[] }) => Promise<void> };

  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
