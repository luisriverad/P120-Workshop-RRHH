// Función serverless (Vercel) para el chat del Aula.
import { manejarPeticion } from "../server/chat.js";

export default async function handler(req, res) {
  await manejarPeticion(req, res, process.env.ANTHROPIC_API_KEY);
}
