import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { manejarPeticion } from "./server/chat.js";
import { manejarAsistencia } from "./server/asistencia.js";

// Sirve /api/chat en `npm run dev` y `npm run preview`.
// La clave se lee de .env.local (ANTHROPIC_API_KEY) y nunca llega al navegador.
function chatAula(apiKey) {
  const montar = (server) => {
    server.middlewares.use("/api/chat", (req, res) => {
      manejarPeticion(req, res, apiKey).catch(() => {
        res.statusCode = 500;
        res.end();
      });
    });
    // Registro de asistencia → asistencia/registro.csv (descarga en /api/asistencia)
    server.middlewares.use("/api/asistencia", (req, res) => {
      manejarAsistencia(req, res, path.resolve("asistencia/registro.csv")).catch(() => {
        res.statusCode = 500;
        res.end();
      });
    });
  };
  return { name: "chat-aula", configureServer: montar, configurePreviewServer: montar };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), chatAula(env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)],
    server: {
      port: 5173,
      open: true,
    },
  };
});
