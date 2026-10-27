// Registro de asistencia del workshop (nombre y correo; no es autenticación).
// POST /api/asistencia  { nombre, correo }  → agrega una fila al CSV
// GET  /api/asistencia                      → descarga el CSV
import fs from "fs";
import path from "path";

const ENCABEZADO = "fecha,hora,nombre,correo\n";
const celda = (v) => {
  const t = String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  // Evita que Excel interprete el texto como fórmula
  const seguro = /^[=+\-@]/.test(t) ? "'" + t : t;
  return /[",]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

export async function manejarAsistencia(req, res, archivo) {
  if (req.method === "GET") {
    const csv = fs.existsSync(archivo) ? fs.readFileSync(archivo, "utf8") : ENCABEZADO;
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="asistencia-workshop.csv"');
    res.end("﻿" + csv);
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  let body = req.body;
  if (!body || typeof body !== "object") {
    let crudo = "";
    for await (const parte of req) {
      crudo += parte;
      if (crudo.length > 10_000) break;
    }
    try { body = JSON.parse(crudo || "{}"); } catch { body = {}; }
  }
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
  const hora = ahora.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" });
  const fila = [fecha, hora, body.nombre || "(sin nombre)", body.correo || ""].map(celda).join(",") + "\n";
  try {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, ENCABEZADO);
    fs.appendFileSync(archivo, fila);
  } catch {
    // Sin disco escribible (p. ej. serverless): queda en los logs del servidor
    console.log("[asistencia]", fila.trim());
  }
  res.statusCode = 204;
  res.end();
}
