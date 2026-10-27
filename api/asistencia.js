// Función serverless (Vercel) para el registro de asistencia.
// En Vercel el disco no es permanente: cada registro también queda en los logs de la función.
import { manejarAsistencia } from "../server/asistencia.js";

export default async function handler(req, res) {
  if (req.method === "POST") console.log("[asistencia]", JSON.stringify(req.body || {}));
  await manejarAsistencia(req, res, "/tmp/asistencia.csv");
}
