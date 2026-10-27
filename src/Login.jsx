import { useState } from "react";
import logoDragon from "./assets/dragon-logo.png";
import logoAxon from "./assets/axon-logo.png";

// Pantalla de registro de asistencia (nombre y correo). No es seguridad:
// se puede entrar aunque no se llene nada.
const RECUERDO_KEY = "rrhh.asistente.v1";

const leerRecuerdo = () => {
  try { return JSON.parse(localStorage.getItem(RECUERDO_KEY) || "null") || {}; } catch { return {}; }
};

const MODULOS = [
  "Variaciones de Nómina",
  "Rotación",
  "Cobertura de Plantilla",
  "Desempeño",
  "Clima Laboral",
  "Capacitación",
];

const CSS = `
.lg-root { min-height: 100vh; display: grid; grid-template-columns: 1.15fr 1fr; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #17130a; background: #fff; }
.lg-marca { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding: 56px 64px; background: #fff; border-right: 1px solid #f1ead6; }
.lg-marca::before { content: ""; position: absolute; width: 620px; height: 620px; right: -260px; top: -220px; border-radius: 50%; background: radial-gradient(circle, rgba(242, 196, 48, 0.28) 0%, rgba(242, 196, 48, 0) 68%); }
.lg-marca::after { content: ""; position: absolute; width: 520px; height: 520px; left: -240px; bottom: -260px; border-radius: 50%; border: 1px solid rgba(184, 134, 11, 0.18); box-shadow: 0 0 0 40px rgba(184, 134, 11, 0.04), 0 0 0 80px rgba(184, 134, 11, 0.03); }
.lg-marca-in { position: relative; z-index: 1; max-width: 560px; animation: lg-sube 0.6s ease both; }
.lg-logo { width: 190px; height: auto; display: block; margin-bottom: 36px; }
.lg-over { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #9a7412; margin-bottom: 12px; }
.lg-h1 { font-size: 44px; line-height: 1.08; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 16px; color: #17130a; }
.lg-h1 span { background: linear-gradient(120deg, #b8860b 0%, #e2b33a 55%, #b8860b 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lg-lead { font-size: 17px; line-height: 1.55; color: #5b5240; margin: 0 0 32px; max-width: 470px; }
.lg-mods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; max-width: 480px; padding: 0; margin: 0; list-style: none; }
.lg-mods li { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: #3d3523; }
.lg-num { width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #3a2a00; background: linear-gradient(135deg, #f6d66a 0%, #d9a91c 100%); box-shadow: 0 1px 2px rgba(120, 86, 0, 0.25); }

.lg-panel { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 48px 32px 28px; background: #fff; }
.lg-card { width: 100%; max-width: 400px; animation: lg-sube 0.6s 0.08s ease both; }
.lg-h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
.lg-sub { font-size: 14px; line-height: 1.5; color: #6b6352; margin: 0 0 28px; }
.lg-campo { margin-bottom: 16px; }
.lg-label { display: block; font-size: 13px; font-weight: 600; color: #3d3523; margin-bottom: 6px; }
.lg-label em { font-style: normal; font-weight: 400; color: #9b927e; }
.lg-input { width: 100%; box-sizing: border-box; height: 46px; padding: 0 14px; font-size: 15px; font-family: inherit; color: #17130a; background: #fcfbf8; border: 1px solid #e6e0d0; border-radius: 10px; outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; }
.lg-input::placeholder { color: #b3ab98; }
.lg-input:focus { border-color: #d4a017; background: #fff; box-shadow: 0 0 0 4px rgba(226, 179, 58, 0.18); }
.lg-input.lg-err { border-color: #d14343; box-shadow: 0 0 0 4px rgba(209, 67, 67, 0.12); }
.lg-msg { font-size: 12px; color: #b42318; margin-top: 6px; }
.lg-btn { width: 100%; height: 48px; margin-top: 8px; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 700; color: #2a1f00; background: linear-gradient(135deg, #f7d460 0%, #e0aa1e 100%); box-shadow: 0 6px 18px rgba(212, 160, 23, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.45); transition: transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s; }
.lg-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(212, 160, 23, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.45); }
.lg-btn:active { transform: translateY(0); filter: brightness(0.97); }
.lg-skip { display: block; width: 100%; margin-top: 14px; padding: 8px; border: none; background: none; cursor: pointer; font-family: inherit; font-size: 13px; color: #7a715d; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #d8cfb8; }
.lg-skip:hover { color: #17130a; }
.lg-nota { display: flex; gap: 8px; align-items: flex-start; margin-top: 26px; padding: 12px 14px; border-radius: 10px; background: #fbf7ea; font-size: 12px; line-height: 1.5; color: #6b6352; }
.lg-pie { margin-top: auto; padding-top: 32px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #9b927e; }
.lg-pie img { height: 22px; width: auto; }

@keyframes lg-sube { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

@media (max-width: 900px) {
  .lg-root { grid-template-columns: 1fr; }
  .lg-marca { padding: 40px 24px 36px; }
  .lg-logo { width: 130px; margin-bottom: 24px; }
  .lg-h1 { font-size: 32px; }
  .lg-lead { font-size: 15px; margin-bottom: 22px; }
  .lg-panel { padding: 36px 20px 24px; }
}
@media (max-width: 480px) {
  .lg-mods { grid-template-columns: 1fr; }
}
`;

export default function Login({ onEntrar }) {
  const previo = leerRecuerdo();
  const [nombre, setNombre] = useState(previo.nombre || "");
  const [correo, setCorreo] = useState(previo.correo || "");
  const [error, setError] = useState("");

  const entrar = (registrar) => {
    const n = nombre.trim();
    const c = correo.trim();
    if (registrar && c && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
      setError("Revisa el correo (ejemplo: nombre@empresa.com) o déjalo vacío.");
      return;
    }
    if (registrar && (n || c)) {
      try { localStorage.setItem(RECUERDO_KEY, JSON.stringify({ nombre: n, correo: c })); } catch { /* sin almacenamiento */ }
      // Si el registro falla, igual se entra al workshop
      fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: n, correo: c }),
        keepalive: true,
      }).catch(() => {});
    }
    onEntrar({ nombre: registrar ? n : "", correo: registrar ? c : "" });
  };

  return (
    <div className="lg-root">
      <style>{CSS}</style>

      <section className="lg-marca">
        <div className="lg-marca-in">
          <img className="lg-logo" src={logoDragon} alt="Dragon · 90 años" />
          <div className="lg-over">Workshop ejecutivo</div>
          <h1 className="lg-h1">La rentabilidad desde el área de <span>Recursos Humanos</span></h1>
          <p className="lg-lead">¿Cuánto cuestan las cosas en RRHH y cómo pegan en la utilidad de la empresa? Lo vemos con números, en seis módulos.</p>
          <ul className="lg-mods">
            {MODULOS.map((m, i) => (
              <li key={m}><span className="lg-num">{i + 1}</span>{m}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lg-panel">
        <form className="lg-card" onSubmit={(e) => { e.preventDefault(); entrar(true); }} noValidate>
          <h2 className="lg-h2">Registro de asistencia</h2>
          <p className="lg-sub">Escribe tu nombre y correo para registrar tu asistencia al workshop.</p>

          <div className="lg-campo">
            <label className="lg-label" htmlFor="lg-nombre">Nombre completo</label>
            <input id="lg-nombre" className="lg-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María López" autoComplete="name" maxLength={120} autoFocus />
          </div>
          <div className="lg-campo">
            <label className="lg-label" htmlFor="lg-correo">Correo electrónico</label>
            <input
              id="lg-correo"
              type="email"
              className={"lg-input" + (error ? " lg-err" : "")}
              value={correo}
              onChange={(e) => { setCorreo(e.target.value); setError(""); }}
              placeholder="nombre@empresa.com"
              autoComplete="email"
              maxLength={160}
            />
            {error && <div className="lg-msg">{error}</div>}
          </div>

          <button type="submit" className="lg-btn">Entrar al workshop →</button>
          <button type="button" className="lg-skip" onClick={() => entrar(false)}>Entrar sin registrarme</button>

          <div className="lg-nota">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <span>Solo usamos estos datos para la lista de asistencia del workshop.</span>
          </div>
        </form>

        <div className="lg-pie">
          Impartido por <img src={logoAxon} alt="Axon" />
        </div>
      </section>
    </div>
  );
}
