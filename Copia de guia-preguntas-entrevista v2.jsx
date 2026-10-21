import { useState } from "react";

const questions = [
  {
    es: "¿Cuáles son tus debilidades?",
    en: "What are your weaknesses?",
  },
  {
    es: "¿Puedes dar un ejemplo de cuándo tuviste que defender una decisión?",
    en: "Can you give an example of a time when you had to defend a decision?",
  },
  {
    es: "Cuéntame sobre una vez que enfrentaste un dilema ético en el trabajo.",
    en: "Tell me about a time you faced an ethical dilemma at work.",
  },
  {
    es: "Describe una vez que trataste con un cliente difícil.",
    en: "Describe a time you dealt with a difficult customer.",
  },
  {
    es: "Cuéntame sobre una vez que no cumpliste una fecha límite.",
    en: "Tell me about a time you missed a deadline.",
  },
  {
    es: "¿Por qué quieres dejar tu puesto actual?",
    en: "Why do you want to leave your current role?",
  },
  {
    es: "¿Qué te diferencia de los demás candidatos?",
    en: "What sets you apart from the other candidates?",
  },
  {
    es: "¿Cómo manejas dar malas noticias a un cliente o gerente?",
    en: "How do you handle delivering bad news to a client or manager?",
  },
  {
    es: "¿Cómo decides qué delegar y a quién?",
    en: "How do you decide what to delegate and to whom?",
  },
  {
    es: "¿Cuáles son tus expectativas salariales?",
    en: "What are your salary expectations?",
  },
  {
    es: "¿Cómo manejas el estrés?",
    en: "How do you handle stress?",
  },
  {
    es: "¿Cómo manejas los conflictos con compañeros de trabajo?",
    en: "How do you handle conflict with coworkers?",
  },
  {
    es: "Cuéntame sobre un proyecto que lideraste y que no salió como esperabas.",
    en: "Tell me about a project you led that didn't go as expected.",
  },
  {
    es: "¿Cómo priorizas cuando todo parece urgente al mismo tiempo?",
    en: "How do you prioritize when everything seems urgent at the same time?",
  },
  {
    es: "¿Cuál ha sido la retroalimentación más difícil que has recibido y qué hiciste con ella?",
    en: "What's the toughest feedback you've received and what did you do with it?",
  },
];

export default function GuiaPreguntasEntrevista() {
  const [notes, setNotes] = useState({});
  const [activeCard, setActiveCard] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const scores = questions.map((_, i) => notes[`score_${i}`] || null);
  const answered = scores.filter((s) => s !== null);
  const avgRaw =
    answered.length > 0
      ? answered.reduce((a, b) => a + b, 0) / answered.length
      : 0;
  const globalScore = Math.round((avgRaw / 5) * 100);

  const scoreColor =
    globalScore <= 40 ? "#c0392b" : globalScore <= 70 ? "#f1c40f" : "#71b248";

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

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content.map((i) => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiResult(parsed);
    } catch (err) {
      console.error("Error:", err);
      setAiResult({
        dictamen:
          "Error al generar el dictamen. Verifica que las preguntas tengan score y notas, luego intenta de nuevo.",
        habilidades: [],
      });
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1f2225",
        fontFamily: "'Inter', sans-serif",
        padding: "0",
      }}
    >
      {/* Title */}
      <div
        style={{
          background: "linear-gradient(135deg, #71b248 0%, #5a9438 100%)",
          padding: "36px 40px 32px",
          marginBottom: "32px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
          }}
        >
          Guía de Preguntas de Entrevista
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.8)",
            margin: "8px 0 0 0",
            fontWeight: 400,
          }}
        >
          (Interview Questions Guide)
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
          padding: "0 28px 24px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {questions.map((q, i) => (
          <div
            key={i}
            onClick={() => setActiveCard(activeCard === i ? null : i)}
            style={{
              background: activeCard === i ? "#2a2e32" : "#25292d",
              borderRadius: "14px",
              padding: "22px 20px",
              border:
                activeCard === i
                  ? "1.5px solid #71b248"
                  : "1.5px solid #3c4045",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              minHeight: "180px",
            }}
          >
            {/* Question Number */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  background: "#71b248",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Question Text */}
            <p
              style={{
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: 1.45,
                margin: "0 0 4px 0",
              }}
            >
              {q.es}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "12.5px",
                fontWeight: 400,
                lineHeight: 1.4,
                margin: "0 0 12px 0",
                fontStyle: "italic",
              }}
            >
              ({q.en})
            </p>

            {/* Score Buttons */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {[1, 2, 3, 4, 5].map((score) => {
                const isSelected = notes[`score_${i}`] === score;
                const bg =
                  score <= 2
                    ? "#c0392b"
                    : score <= 4
                    ? "#f1c40f"
                    : "#71b248";
                const color = score <= 2 || score === 5 ? "#fff" : "#000";
                return (
                  <button
                    key={score}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotes({
                        ...notes,
                        [`score_${i}`]:
                          notes[`score_${i}`] === score ? null : score,
                      });
                    }}
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      border: isSelected
                        ? "2px solid #fff"
                        : "2px solid transparent",
                      background: isSelected ? bg : `${bg}44`,
                      color: isSelected ? color : "rgba(255,255,255,0.5)",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Inter', sans-serif",
                      transition: "all 0.15s ease",
                      opacity: isSelected ? 1 : 0.7,
                    }}
                  >
                    {score}
                  </button>
                );
              })}
            </div>

            {/* Notes Area */}
            <textarea
              onClick={(e) => e.stopPropagation()}
              placeholder="Escribe notas aquí... (Write notes here...)"
              value={notes[i] || ""}
              onChange={(e) => setNotes({ ...notes, [i]: e.target.value })}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #3c4045",
                borderRadius: "8px",
                padding: "10px 12px",
                color: "#fff",
                fontSize: "13px",
                fontFamily: "'Inter', sans-serif",
                resize: "none",
                outline: "none",
                minHeight: "60px",
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Dictamen Section ── */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "20px auto 0",
          padding: "0 28px 40px",
        }}
      >
        {/* Score Global + Generate Button */}
        <div
          style={{
            background: "#25292d",
            borderRadius: "16px",
            border: "1.5px solid #3c4045",
            padding: "32px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "24px",
            }}
          >
            {/* Score Circle */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "24px" }}
            >
              <div
                style={{
                  width: "90px",
                  height: "90px",
                  borderRadius: "50%",
                  border: `4px solid ${scoreColor}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: scoreColor,
                    lineHeight: 1,
                  }}
                >
                  {answered.length > 0 ? globalScore : "—"}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.4)",
                    fontWeight: 500,
                  }}
                >
                  /100
                </span>
              </div>
              <div>
                <p
                  style={{
                    color: "#fff",
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "0 0 4px 0",
                  }}
                >
                  Score Global del Candidato
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: "13px",
                    fontWeight: 400,
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  (Overall Candidate Score)
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "12px",
                    margin: "8px 0 0 0",
                  }}
                >
                  {answered.length} de 15 preguntas calificadas
                </p>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={handleGenerateDictamen}
              disabled={loading || answered.length === 0}
              style={{
                background:
                  loading || answered.length === 0
                    ? "#3c4045"
                    : "linear-gradient(135deg, #71b248, #5a9438)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "14px 28px",
                fontSize: "15px",
                fontWeight: 700,
                cursor:
                  loading || answered.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif",
                opacity: loading || answered.length === 0 ? 0.5 : 1,
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Analizando..." : "Generar Dictamen con IA"}
            </button>
          </div>

          {/* AI Dictamen */}
          {aiResult && (
            <div
              style={{
                marginTop: "28px",
                borderTop: "1px solid #3c4045",
                paddingTop: "24px",
              }}
            >
              <p
                style={{
                  color: "#71b248",
                  fontSize: "14px",
                  fontWeight: 700,
                  margin: "0 0 6px 0",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Dictamen General del Candidato
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "11px",
                  margin: "0 0 14px 0",
                  fontStyle: "italic",
                }}
              >
                (General Candidate Assessment)
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                {aiResult.dictamen}
              </p>
            </div>
          )}
        </div>

        {/* ── Skill Bars ── */}
        {aiResult &&
          aiResult.habilidades &&
          aiResult.habilidades.length > 0 && (
            <div
              style={{
                background: "#25292d",
                borderRadius: "16px",
                border: "1.5px solid #3c4045",
                padding: "28px 32px",
              }}
            >
              <p
                style={{
                  color: "#71b248",
                  fontSize: "14px",
                  fontWeight: 700,
                  margin: "0 0 6px 0",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Principales Habilidades Detectadas
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "11px",
                  margin: "0 0 24px 0",
                  fontStyle: "italic",
                }}
              >
                (Key Skills Identified)
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {aiResult.habilidades.map((h, idx) => {
                  const barColor =
                    h.porcentaje <= 40
                      ? "#c0392b"
                      : h.porcentaje <= 70
                      ? "#f1c40f"
                      : "#71b248";
                  return (
                    <div key={idx}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        >
                          {h.nombre}
                        </span>
                        <span
                          style={{
                            color: barColor,
                            fontSize: "14px",
                            fontWeight: 700,
                          }}
                        >
                          {h.porcentaje}%
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "10px",
                          background: "rgba(255,255,255,0.08)",
                          borderRadius: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${h.porcentaje}%`,
                            height: "100%",
                            background: barColor,
                            borderRadius: "6px",
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #3c4045",
          padding: "20px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1200px",
          margin: "12px auto 0",
        }}
      >
        <div style={{ display: "flex", gap: "24px" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            www.profit120.com
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            info@profit120.com
          </span>
        </div>
      </div>
    </div>
  );
}
