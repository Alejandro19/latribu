import type { Request, Response, NextFunction } from 'express';

// Express ya genera un ETag (weak) automáticamente en cada respuesta JSON —
// sin un header Cache-Control el navegador nunca la guarda, así que ese ETag
// nunca se llega a comparar. "private, no-cache" hace que el navegador SIEMPRE
// vuelva a preguntarle al servidor (conditional GET vía If-None-Match) antes
// de reusar la respuesta — evita el riesgo de servir datos viejos justo
// después de una mutación (create/update/delete + mutate() de SWR), pero
// cuando el contenido no cambió el servidor devuelve 304 sin body en vez del
// JSON completo, ahorrando ancho de banda en cada revalidación.
export function revalidateCache(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'private, no-cache');
  next();
}
