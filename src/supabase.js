// Conexión mínima a Supabase (REST) para guardar asistencia y respuestas de los micro tests.
// Las tablas solo permiten insertar: la app no puede leer los datos de nadie.
const URL_BASE = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
export const supabaseActivo = !!(URL_BASE && KEY);

// Inserta una fila; si falla (sin internet, sin configuración) la app sigue normal.
export function guardarFila(tabla, fila) {
  if (!supabaseActivo) return Promise.resolve(false);
  return fetch(`${URL_BASE}/rest/v1/${tabla}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(fila),
    keepalive: true,
  })
    .then((r) => r.ok)
    .catch(() => false);
}

// Participante de esta sesión (lo pone la pantalla de registro)
const USUARIO_KEY = "rrhh.usuario.v1";
export function guardarUsuario(u) {
  try { sessionStorage.setItem(USUARIO_KEY, JSON.stringify({ nombre: u?.nombre || "", correo: u?.correo || "" })); } catch { /* sin almacenamiento */ }
}
export function usuarioActual() {
  try { return JSON.parse(sessionStorage.getItem(USUARIO_KEY) || "null") || {}; } catch { return {}; }
}
