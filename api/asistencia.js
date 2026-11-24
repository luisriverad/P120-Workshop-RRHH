// Función serverless (Vercel) para el registro de asistencia.
// La lista oficial vive en Supabase (tabla `asistentes`). Aquí solo se acepta POST
// como respaldo en los logs; la descarga del CSV queda deshabilitada en el sitio público
// para no exponer nombres y correos.
import { manejarAsistencia } from "../server/asistencia.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 404;
    res.end();
    return;
  }
  console.log("[asistencia]", JSON.stringify(req.body || {}));
  await manejarAsistencia(req, res, "/tmp/asistencia.csv");
}
