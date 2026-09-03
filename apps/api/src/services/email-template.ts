// Plantilla base para los correos transaccionales de Ephirox (reset de
// contraseña, invitación, alerta de crisis). Usa la misma paleta bone/espresso
// que los documentos imprimibles (NutritionPdfGenerator) — nunca el tema
// oscuro de la app, porque un email oscuro se ve mal o se invierte en
// Outlook/Gmail. Fuentes: solo fallbacks de sistema (Georgia/Arial) — los
// web fonts (Cormorant/Jost) no cargan de forma confiable en clientes de
// correo, a diferencia del PDF que sí corre en un navegador real.
const PAPER_BG = '#EDE6DC';
const CARD_BG = '#F7F3EC';
const INK = '#1C1613';
const INK_MUTED = '#6B6259';
const ACCENT = '#C9A46A';
const RULE = '#E7DFC9';

export function renderEmailHtml(opts: { preheader?: string; bodyHtml: string }): string {
  const { preheader = '', bodyHtml } = opts;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ephirox</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_BG};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER_BG};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${CARD_BG};border:1px solid ${RULE};">
        <tr>
          <td style="padding:32px 36px 20px;">
            <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:20px;letter-spacing:0.06em;color:${ACCENT};text-transform:uppercase;">Ephirox</p>
            <hr style="border:none;border-top:1px solid ${ACCENT};margin:0 0 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK};">
              ${bodyHtml}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 28px;border-top:1px solid ${RULE};">
            <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.04em;color:${INK_MUTED};text-transform:uppercase;">
              Sistema de optimización ejecutiva
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Botón de acción del correo (link de reset/invitación) — <a> con padding
// vía estilos inline, no <button>, para máxima compatibilidad con clientes
// de correo que no ejecutan CSS de clase.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>
    <td style="background:${ACCENT};">
      <a href="${href}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${INK};text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}
