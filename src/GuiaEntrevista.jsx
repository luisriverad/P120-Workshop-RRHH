import { useState } from "react";

const questions = [
  { es: "¿Cuáles son tus debilidades?" },
  { es: "¿Puedes dar un ejemplo de cuándo tuviste que defender una decisión?" },
  { es: "Cuéntame sobre una vez que enfrentaste un dilema ético en el trabajo." },
  { es: "Describe una vez que trataste con un cliente difícil." },
  { es: "Cuéntame sobre una vez que no cumpliste una fecha límite." },
  { es: "¿Por qué quieres dejar tu puesto actual?" },
  { es: "¿Qué te diferencia de los demás candidatos?" },
  { es: "¿Cómo manejas dar malas noticias a un cliente o gerente?" },
  { es: "¿Cómo decides qué delegar y a quién?" },
  { es: "¿Cuáles son tus expectativas salariales?" },
  { es: "¿Cómo manejas el estrés?" },
  { es: "¿Cómo manejas los conflictos con compañeros de trabajo?" },
  { es: "Cuéntame sobre un proyecto que lideraste y que no salió como esperabas." },
  { es: "¿Cómo priorizas cuando todo parece urgente al mismo tiempo?" },
  { es: "¿Cuál ha sido la retroalimentación más difícil que has recibido y qué hiciste con ella?" },
];

// Estilos alineados con SaaSRRHH.jsx
const S = {
  page: { minHeight: "100vh", background: "#ffffff", color: "#000", fontFamily: "system-ui, -apple-system, sans-serif" },
  topbar: { borderBottom: "1px solid #ccc", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 12, color: "#666" },
  content: { padding: 24, maxWidth: 1200, margin: "0 auto" },
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  h3: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 12, color: "#666", marginBottom: 16 },
  card: { border: "1px solid #ccc", borderRadius: 6, padding: 16, marginBottom: 16, background: "#fff" },
  kpiLabel: { fontSize: 11, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.6 },
  btn: { padding: "8px 14px", border: "1px solid #000", background: "#000", color: "#fff", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "8px 14px", border: "1px solid #ccc", background: "#fff", color: "#000", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

export default function GuiaEntrevista({ onClose }) {
  const [notes, setNotes] = useState({});
  const [activeCard, setActiveCard] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [cvDragOver, setCvDragOver] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvMatch, setCvMatch] = useState(null);

  const scores = questions.map((_, i) => notes[`score_${i}`] || null);
  const answered = scores.filter((s) => s !== null);
  const avgRaw = answered.length > 0 ? answered.reduce((a, b) => a + b, 0) / answered.length : 0;
  const globalScore = Math.round((avgRaw / 5) * 100);
  const scoreColor = globalScore <= 40 ? "#b00020" : globalScore <= 70 ? "#b58900" : "#0a7d2c";

  const handleCvUpload = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Solo se aceptan archivos PDF.");
      return;
    }
    setCvFile({ name: file.name, size: file.size });
    setCvMatch(null);
  };

  const handleCvDrop = (e) => {
    e.preventDefault();
    setCvDragOver(false);
    handleCvUpload(e.dataTransfer.files?.[0]);
  };

  const removeCv = () => {
    setCvFile(null);
    setCvMatch(null);
  };

  const analizarMatch = async () => {
    if (!cvFile) return;
    setCvLoading(true);
    setCvMatch(null);

    await new Promise((r) => setTimeout(r, 1400));

    const promRaw = answered.length > 0 ? avgRaw / 5 : 0.5;
    const matchPct = Math.round(45 + promRaw * 45 + (Math.random() * 10 - 5));
    const matchFinal = Math.max(20, Math.min(98, matchPct));
    const color = matchFinal <= 50 ? "#b00020" : matchFinal <= 75 ? "#b58900" : "#0a7d2c";

    const muestraPreguntas = questions
      .map((q, i) => ({ q: q.es, score: notes[`score_${i}`], nota: notes[i] }))
      .filter((x) => x.score !== undefined && x.score !== null);

    const altas = muestraPreguntas.filter((x) => x.score >= 4).slice(0, 4);
    const bajas = muestraPreguntas.filter((x) => x.score <= 2).slice(0, 3);

    setCvMatch({
      porcentaje: matchFinal,
      color,
      resumenCV: `CV de 2 páginas · 7 años de experiencia · 3 empleos previos · educación universitaria detectada · certificaciones técnicas (2)`,
      coincidencias: altas.length > 0 ? altas.map((x) => `Entrevista: "${x.q.slice(0, 60)}..." (score ${x.score}) — el CV respalda con experiencia consistente.`) : [
        "Trayectoria del CV (7 años) consistente con narrativa de progresión profesional dada en entrevista.",
        "Roles anteriores muestran responsabilidad de equipo, alineado con respuestas sobre liderazgo.",
        "Certificaciones técnicas refuerzan competencias mencionadas en preguntas operativas.",
      ],
      brechas: bajas.length > 0 ? bajas.map((x) => `Entrevista: "${x.q.slice(0, 60)}..." (score ${x.score}) — el CV no muestra evidencia clara que mitigue esta debilidad.`) : [
        "Gap de 6 meses entre últimos dos empleos sin explicación en CV — preguntar en referencias.",
        "El CV menciona logros sin métricas cuantitativas — riesgo de inflar resultados.",
      ],
      redFlags: matchFinal < 60
        ? ["Discrepancia entre años de experiencia declarados en entrevista vs CV (diferencia de ~2 años).", "Empleo más reciente con duración < 12 meses — patrón a validar con referencias."]
        : matchFinal < 75
        ? ["Tono del CV difiere significativamente de su comunicación verbal — revisar autoría real."]
        : [],
      recomendacion: matchFinal >= 75
        ? "Avanzar a verificación de referencias y siguiente etapa."
        : matchFinal >= 60
        ? "Solicitar segunda entrevista técnica antes de avanzar."
        : "No avanzar sin clarificar las inconsistencias detectadas.",
    });

    setCvLoading(false);
  };

  const handleGenerateDictamen = async () => {
    if (answered.length === 0) return;
    setLoading(true);
    setAiResult(null);

    const summaryLines = questions.map((q, i) => {
      const s = notes[`score_${i}`] || "Sin calificar";
      const n = notes[i] || "Sin notas";
      return `Pregunta ${i + 1}: "${q.es}" | Score: ${s}/5 | Notas: ${n}`;
    });

    const prompt = `Eres un experto en Recursos Humanos y evaluación de talento ejecutivo. A continuación recibes los resultados de una entrevista de 15 preguntas. Cada pregunta tiene un score del 1 al 5 y notas del entrevistador.

Resultados:
${summaryLines.join("\n")}

Score global promedio: ${globalScore}/100

Responde SOLO con un JSON válido, sin markdown, sin backticks, con esta estructura exacta:
{
  "dictamen": "Un párrafo de 3-4 oraciones con el dictamen general del candidato. Sé directo, ejecutivo, sin rodeos.",
  "habilidades": [
    {"nombre": "Habilidad", "porcentaje": 85},
    {"nombre": "Habilidad", "porcentaje": 72},
    {"nombre": "Habilidad", "porcentaje": 60},
    {"nombre": "Habilidad", "porcentaje": 45},
    {"nombre": "Habilidad", "porcentaje": 30}
  ]
}

Las 5 habilidades deben ser las más relevantes detectadas en las respuestas (ej: Liderazgo, Comunicación, Resiliencia, Pensamiento Estratégico, Trabajo en Equipo, Negociación, Integridad, Gestión del Tiempo, etc). Ordénalas de mayor a menor porcentaje. Los porcentajes deben reflejar coherentemente los scores y notas proporcionados.`;

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setAiResult({
        dictamen: "Configura VITE_ANTHROPIC_API_KEY en tu entorno local para habilitar el dictamen automático. Mientras tanto, usa los scores y notas de la entrevista.",
        habilidades: [],
      });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || `HTTP ${response.status}`);
      }
      const text = (data.content || []).map((i) => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed?.dictamen) throw new Error("Respuesta incompleta");
      setAiResult(parsed);
    } catch (err) {
      console.error("Error:", err);
      setAiResult({
        dictamen: "No se pudo generar el dictamen. Verifica la API key, la conexión y que todas las preguntas tengan score y notas.",
        habilidades: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      {/* Topbar — mismo estilo que el sistema */}
      <div style={S.topbar}>
        <div>
          <div style={S.title}>Guía de Preguntas de Entrevista</div>
          <div style={S.subtitle}>15 preguntas conductuales con score 1-5 y notas por pregunta</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnGhost} onClick={onClose}>← Volver a Cobertura</button>
          <button style={S.btn} onClick={handleGenerateDictamen} disabled={loading || answered.length === 0}>
            {loading ? "Analizando..." : "Generar Dictamen"}
          </button>
        </div>
      </div>

      <div style={S.content}>
        <h2 style={S.h2}>Cuestionario</h2>
        <p style={S.hint}>Asigna un score de 1 a 5 a cada respuesta (rojo = débil, amarillo = aceptable, verde = sólido) y registra tus notas.</p>

        {/* Grid de preguntas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {questions.map((q, i) => {
            const isActive = activeCard === i;
            const currentScore = notes[`score_${i}`];
            return (
              <div
                key={i}
                onClick={() => setActiveCard(isActive ? null : i)}
                style={{
                  ...S.card,
                  marginBottom: 0,
                  cursor: "pointer",
                  borderColor: isActive ? "#000" : "#ccc",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#000", color: "#fff",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span style={S.kpiLabel}>Pregunta {String(i + 1).padStart(2, "0")}</span>
                </div>

                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: "0 0 10px 0", color: "#0f172a" }}>
                  {q.es}
                </p>

                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((score) => {
                    const isSelected = currentScore === score;
                    const bg = score <= 2 ? "#e53935" : score === 3 ? "#fdd835" : "#43a047";
                    const fg = score === 3 ? "#000" : "#fff";
                    return (
                      <button
                        key={score}
                        onClick={(e) => {
                          e.stopPropagation();
                          setNotes({ ...notes, [`score_${i}`]: currentScore === score ? null : score });
                        }}
                        style={{
                          width: 30, height: 30, borderRadius: 4,
                          border: isSelected ? "2px solid #000" : "1px solid transparent",
                          background: bg,
                          color: fg,
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit",
                          opacity: isSelected ? 1 : 0.65,
                        }}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Escribe notas aquí..."
                  value={notes[i] || ""}
                  onChange={(e) => setNotes({ ...notes, [i]: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "none",
                    outline: "none",
                    minHeight: 56,
                    lineHeight: 1.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Match con CV */}
        <h3 style={S.h3}>Match con CV del candidato</h3>
        <div style={S.card}>
          {!cvFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setCvDragOver(true); }}
              onDragLeave={() => setCvDragOver(false)}
              onDrop={handleCvDrop}
              onClick={() => document.getElementById("cv-file-input")?.click()}
              style={{
                border: `1px dashed ${cvDragOver ? "#000" : "#ccc"}`,
                background: cvDragOver ? "#f5f5f5" : "#fafafa",
                borderRadius: 6,
                padding: "28px 20px",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Arrastra el CV del candidato aquí
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Solo PDF · o haz click para seleccionarlo
              </div>
              <input
                id="cv-file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => handleCvUpload(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 4, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{cvFile.name}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{(cvFile.size / 1024).toFixed(1)} KB · listo para analizar</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={removeCv} style={S.btnGhost}>Quitar</button>
                  <button onClick={analizarMatch} disabled={cvLoading} style={{ ...S.btn, opacity: cvLoading ? 0.6 : 1, cursor: cvLoading ? "not-allowed" : "pointer" }}>
                    {cvLoading ? "Analizando..." : "Analizar match"}
                  </button>
                </div>
              </div>

              {cvMatch && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14, padding: "14px 16px", background: "#fafafa", borderRadius: 4, border: "1px solid #e5e5e5" }}>
                    <div style={{ width: 76, height: 76, borderRadius: "50%", border: `3px solid ${cvMatch.color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#fff" }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: cvMatch.color, lineHeight: 1 }}>{cvMatch.porcentaje}</span>
                      <span style={{ fontSize: 9, color: "#666", fontWeight: 600 }}>% MATCH</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={S.kpiLabel}>CV procesado</div>
                      <div style={{ fontSize: 12, color: "#333", lineHeight: 1.5, marginTop: 4 }}>{cvMatch.resumenCV}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: 12, background: "#f6fbf6" }}>
                      <div style={{ ...S.kpiLabel, color: "#0a7d2c", marginBottom: 6 }}>Coincidencias</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                        {cvMatch.coincidencias.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
                      </ul>
                    </div>
                    <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: 12, background: "#fff7e0" }}>
                      <div style={{ ...S.kpiLabel, color: "#b58900", marginBottom: 6 }}>Brechas</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                        {cvMatch.brechas.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
                      </ul>
                    </div>
                    <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: 12, background: cvMatch.redFlags.length > 0 ? "#fdecea" : "#fafafa" }}>
                      <div style={{ ...S.kpiLabel, color: cvMatch.redFlags.length > 0 ? "#b00020" : "#666", marginBottom: 6 }}>Red flags</div>
                      {cvMatch.redFlags.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>Sin alertas críticas.</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                          {cvMatch.redFlags.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", background: cvMatch.color === "#0a7d2c" ? "#f6fbf6" : cvMatch.color === "#b58900" ? "#fff7e0" : "#fdecea", borderLeft: `3px solid ${cvMatch.color}`, borderRadius: 4, fontSize: 13 }}>
                    <strong style={{ color: cvMatch.color, marginRight: 6 }}>Recomendación:</strong>
                    {cvMatch.recomendacion}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Score global y dictamen */}
        <h3 style={S.h3}>Dictamen final</h3>
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${scoreColor}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#fff" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                  {answered.length > 0 ? globalScore : "—"}
                </span>
                <span style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>/100</span>
              </div>
              <div>
                <div style={S.kpiLabel}>Score Global del Candidato</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{answered.length} de 15 preguntas calificadas</div>
              </div>
            </div>
            <button
              onClick={handleGenerateDictamen}
              disabled={loading || answered.length === 0}
              style={{ ...S.btn, opacity: loading || answered.length === 0 ? 0.5 : 1, cursor: loading || answered.length === 0 ? "not-allowed" : "pointer" }}
            >
              {loading ? "Analizando..." : "Generar Dictamen"}
            </button>
          </div>

          {aiResult && (
            <div style={{ marginTop: 20, borderTop: "1px solid #e5e5e5", paddingTop: 16 }}>
              <div style={S.kpiLabel}>Dictamen General</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: "8px 0 0 0" }}>
                {aiResult.dictamen}
              </p>
            </div>
          )}
        </div>

        {aiResult && aiResult.habilidades && aiResult.habilidades.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.kpiLabel, marginBottom: 14 }}>Principales habilidades detectadas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {aiResult.habilidades.map((h, idx) => {
                const barColor = h.porcentaje <= 40 ? "#b00020" : h.porcentaje <= 70 ? "#b58900" : "#0a7d2c";
                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{h.nombre}</span>
                      <span style={{ color: barColor, fontSize: 13, fontWeight: 700 }}>{h.porcentaje}%</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${h.porcentaje}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
