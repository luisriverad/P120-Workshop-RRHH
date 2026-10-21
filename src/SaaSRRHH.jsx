import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import GuiaEntrevista from "./GuiaEntrevista.jsx";
import plantillaDetalleUrl from "./assets/plantilla-detalle-por-area.xlsx?url";

// Demo: configurar VITE_CATALOGOS_PASSWORD en .env para producción (no commitear secretos reales).
const CATALOGOS_ADMIN_PASSWORD = import.meta.env.VITE_CATALOGOS_PASSWORD ?? "12345";

const safeMax = (values, floor = 0) => (values.length ? Math.max(...values) : floor);

// html2canvas: carga única en memoria (evita imports duplicados en paralelo)
let html2canvasFn = null;
let html2canvasLoad = null;
const loadHtml2canvas = () => {
  if (html2canvasFn) return Promise.resolve(html2canvasFn);
  if (!html2canvasLoad) {
    html2canvasLoad = import("html2canvas")
      .then((m) => {
        html2canvasFn = m.default;
        return html2canvasFn;
      })
      .catch((err) => {
        html2canvasLoad = null;
        throw err;
      });
  }
  return html2canvasLoad;
};

const CHART_CAPTURE_OPTS = {
  backgroundColor: "#ffffff",
  logging: false,
  removeContainer: true,
  imageTimeout: 0,
};

const chartCaptureScale = () => Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);

const canvasToBlob = (canvas, type = "image/png", quality = 0.92) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const canCopyImageToClipboard = () =>
  typeof window !== "undefined"
  && window.isSecureContext
  && typeof navigator !== "undefined"
  && navigator.clipboard?.write
  && typeof ClipboardItem !== "undefined";

const downloadChartBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

// Helper: botón de copiar gráfica como imagen al portapapeles
function ChartCopy({ children, label = "Gráfica" }) {
  const captureRef = useRef(null);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    loadHtml2canvas().catch(() => {});
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resetEstado = useCallback((ms = 1800) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setEstado(null);
    }, ms);
  }, []);

  const copiar = useCallback(async (e) => {
    e.stopPropagation();
    if (!captureRef.current || busyRef.current) return;
    busyRef.current = true;
    if (mountedRef.current) setEstado("copiando");
    const fileName = `${String(label).replace(/[^\w.-]+/g, "_")}.png`;
    try {
      const html2canvas = await loadHtml2canvas();
      const canvas = await html2canvas(captureRef.current, {
        ...CHART_CAPTURE_OPTS,
        scale: chartCaptureScale(),
        onclone: (doc) => {
          doc.querySelectorAll(".chart-copy-btn").forEach((el) => { el.style.visibility = "hidden"; });
        },
      });
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("empty blob");
      if (canCopyImageToClipboard()) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        if (mountedRef.current) setEstado("copiado");
      } else {
        downloadChartBlob(blob, fileName);
        if (mountedRef.current) setEstado("descargado");
      }
      resetEstado();
    } catch {
      if (mountedRef.current) setEstado("error");
      resetEstado();
    } finally {
      busyRef.current = false;
    }
  }, [label, resetEstado]);

  const ok = estado === "copiado" || estado === "descargado";
  return (
    <div className="print-keep" style={{ position: "relative", breakInside: "avoid" }}>
      <div ref={captureRef}>{children}</div>
      <button
        type="button"
        onClick={copiar}
        disabled={estado === "copiando"}
        className="chart-copy-btn no-print"
        data-html2canvas-ignore="true"
        aria-label={`Copiar gráfica: ${label}`}
        title="Copiar como imagen al portapapeles"
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 5,
          background: ok ? "rgba(10, 125, 44, 0.95)" : "rgba(255,255,255,0.7)",
          color: ok ? "#fff" : "#475569",
          border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 4, padding: "3px 6px",
          cursor: estado === "copiando" ? "wait" : "pointer",
          opacity: estado ? 1 : 0.45,
          transition: "opacity 0.15s ease, background 0.15s ease",
          backdropFilter: "blur(4px)",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
        onMouseEnter={(e) => { loadHtml2canvas(); if (!estado) e.currentTarget.style.opacity = "0.95"; }}
        onMouseLeave={(e) => { if (!estado) e.currentTarget.style.opacity = "0.45"; }}
      >
        {ok ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{estado === "copiado" ? "Copiado" : "Descargado"}</span>
          </>
        ) : estado === "copiando" ? (
          <span>...</span>
        ) : estado === "error" ? (
          <span>Error</span>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

// =============================================================
// TABLERO DE CONTROL PARA RRHH (sin branding)
// Layout: sidebar de catálogo a la IZQUIERDA + contenido a la derecha
// =============================================================

const TABS = [
  { id: "nomina", label: "Variaciones de Nómina", num: "1" },
  { id: "clima", label: "Clima Laboral", num: "2" },
  { id: "denuncia", label: "Línea de Denuncia", num: "3" },
  { id: "cobertura", label: "Cobertura de Plantilla", num: "4" },
  { id: "seleccion", label: "Proceso de Selección", num: "5" },
  { id: "rotacion", label: "Rotación", num: "6" },
  { id: "capacitacion", label: "Capacitación", num: "7" },
  { id: "desempeno", label: "Desempeño", num: "8" },
];

// ---------- estilos base — paleta cálida profesional, branding naranja de Cobertura ----------
const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const COLOR = {
  ink: "#0f172a",
  inkSoft: "#1e293b",
  text: "#334155",
  textSoft: "#475569",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderSoft: "#eef2f6",
  surface: "#ffffff",
  surfaceSoft: "#fafafa",
  surfaceWarm: "#fbfaf7",
  accent: "#c2410c",
  accentLight: "#ea580c",
  accentSoft: "#fff7ed",
  shadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)",
  shadowHover: "0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)",
};
const S = {
  page: {
    minHeight: "100vh",
    background: COLOR.surface,
    backgroundImage: "radial-gradient(circle at 0% 0%, rgba(234, 88, 12, 0.035) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(15, 23, 42, 0.025) 0%, transparent 35%)",
    color: COLOR.ink,
    fontFamily: FONT_STACK,
    letterSpacing: "-0.005em",
  },
  topbar: {
    borderBottom: "1px solid " + COLOR.border,
    padding: "18px 28px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: COLOR.surface,
    boxShadow: "0 1px 0 rgba(194, 65, 12, 0.06)",
    position: "relative",
  },
  title: { fontSize: 20, fontWeight: 700, color: COLOR.ink, letterSpacing: "-0.02em" },
  subtitle: { fontSize: 12, color: COLOR.textMuted, marginTop: 2 },

  // Layout principal: sidebar izquierdo + main
  layout: { display: "flex", minHeight: "calc(100vh - 70px)" },
  main: { flex: 1, padding: 28, maxWidth: "calc(100% - 280px)" },
  sidebar: {
    width: 280, flexShrink: 0, borderRight: "1px solid " + COLOR.border,
    background: COLOR.surfaceSoft, padding: "22px 0", position: "sticky", top: 0,
    height: "calc(100vh - 70px)", overflowY: "auto",
  },
  sidebarTitle: {
    fontSize: 10, fontWeight: 700, color: COLOR.textMuted, textTransform: "uppercase",
    letterSpacing: 1, padding: "0 20px 14px", borderBottom: "1px solid " + COLOR.borderSoft,
  },
  sidebarItem: (active) => ({
    padding: "11px 20px", fontSize: 13,
    fontWeight: active ? 700 : 500,
    background: active ? COLOR.surface : "transparent",
    borderLeft: active ? `3px solid ${COLOR.accent}` : "3px solid transparent",
    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
    color: active ? COLOR.ink : COLOR.text,
    transition: "all 0.15s ease",
    boxShadow: active ? "inset -1px 0 0 " + COLOR.border : "none",
  }),
  sidebarNum: (active) => ({
    width: 22, height: 22, borderRadius: 6,
    background: active ? `linear-gradient(135deg, ${COLOR.accentLight} 0%, ${COLOR.accent} 100%)` : "#e2e8f0",
    color: active ? "#fff" : COLOR.textMuted,
    fontSize: 11, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    boxShadow: active ? "0 1px 2px rgba(194, 65, 12, 0.25)" : "none",
    transition: "all 0.15s ease",
  }),
  sidebarSection: { padding: "22px 20px 14px", marginTop: 12, borderTop: "1px solid " + COLOR.borderSoft },
  sidebarFilter: {
    width: "100%", padding: "8px 12px", border: "1px solid " + COLOR.border,
    borderRadius: 6, fontSize: 12, background: COLOR.surface, marginBottom: 8,
    fontFamily: "inherit", color: COLOR.text,
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },

  h2: {
    fontSize: 20, fontWeight: 700, marginBottom: 6, color: COLOR.ink,
    letterSpacing: "-0.025em",
    paddingLeft: 12, borderLeft: `3px solid ${COLOR.accent}`,
    lineHeight: 1.2,
  },
  h3: { fontSize: 14, fontWeight: 700, marginTop: 22, marginBottom: 10, color: COLOR.ink, letterSpacing: "-0.01em" },
  hint: { fontSize: 12, color: COLOR.textMuted, marginBottom: 16, lineHeight: 1.5 },
  card: { border: "1px solid " + COLOR.border, borderRadius: 0, padding: 16, marginBottom: 16, background: COLOR.surface, boxShadow: COLOR.shadow, breakInside: "avoid" },
  kpi: { border: "1px solid " + COLOR.border, borderRadius: 0, padding: 14, background: COLOR.surface, boxShadow: COLOR.shadow, breakInside: "avoid" },
  kpiLabel: { fontSize: 10, fontWeight: 700, color: COLOR.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { fontSize: 28, fontWeight: 700, marginTop: 4, color: COLOR.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" },
  kpiDelta: (positive) => ({ fontSize: 14, color: positive ? "#0a7d2c" : "#b00020", marginTop: 4, fontWeight: 600 }),
  kpiBenchmark: (light) => ({
    fontSize: 10,
    color: light === "red" ? "#b00020" : light === "yellow" ? "#d97706" : light === "green" ? "#0a7d2c" : COLOR.textMuted,
    marginTop: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderTop: `1px dashed ${light === "red" ? "#fca5a5" : light === "yellow" ? "#fcd34d" : light === "green" ? "#86efac" : COLOR.border}`,
    paddingTop: 6,
  }),
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT_STACK },
  th: {
    textAlign: "left", padding: "10px 12px",
    borderBottom: `2px solid ${COLOR.ink}`,
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    fontWeight: 700, fontSize: 11, color: COLOR.textSoft,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  td: { padding: "10px 12px", borderBottom: `1px solid ${COLOR.borderSoft}`, color: COLOR.text },
  input: {
    width: "100%", padding: "9px 12px", border: "1px solid " + COLOR.border, borderRadius: 6,
    fontSize: 13, fontFamily: FONT_STACK, color: COLOR.text,
    outline: "none", transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    background: COLOR.surface,
  },
  btn: {
    padding: "9px 16px", border: "none",
    background: `linear-gradient(135deg, ${COLOR.accentLight} 0%, ${COLOR.accent} 100%)`,
    color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: FONT_STACK, letterSpacing: 0.2,
    boxShadow: "0 1px 2px rgba(194, 65, 12, 0.25)",
    transition: "transform 0.1s ease, box-shadow 0.15s ease",
  },
  btnGhost: {
    padding: "9px 16px",
    border: "1px solid " + COLOR.border, background: COLOR.surface, color: COLOR.ink,
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: FONT_STACK, letterSpacing: 0.2,
    transition: "background 0.15s ease, border-color 0.15s ease",
  },
  badge: (color) => ({ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: color || COLOR.borderSoft, color: COLOR.ink, letterSpacing: 0.2 }),
  alert: (kind) => ({
    padding: "11px 14px", borderRadius: 6, fontSize: 12, marginBottom: 12,
    background: kind === "danger" ? "#fef2f2" : kind === "warn" ? "#fff7ed" : "#eff6ff",
    border: `1px solid ${kind === "danger" ? "#fca5a5" : kind === "warn" ? "#fdba74" : "#93c5fd"}`,
    borderLeft: `3px solid ${kind === "danger" ? "#b00020" : kind === "warn" ? "#c2410c" : "#1d4ed8"}`,
    color: COLOR.inkSoft, lineHeight: 1.5,
  }),
};

// =============================================================
// DATOS MENSUALES — Suite simulada que opera en la realidad
// Cambia con el selector de periodo en el topbar
// =============================================================
const MESES_PLATAFORMA = [
  { periodo: "Jul 2026", hoja: "JULIO",      claves: ["julio", "jul"] },
  { periodo: "Ago 2026", hoja: "AGOSTO",     claves: ["agosto", "ago"] },
  { periodo: "Sep 2026", hoja: "SEPTIEMBRE", claves: ["septiembre", "setiembre", "sep", "sept"] },
  { periodo: "Oct 2026", hoja: "OCTUBRE",    claves: ["octubre", "oct"] },
  { periodo: "Nov 2026", hoja: "NOVIEMBRE",  claves: ["noviembre", "nov"] },
  { periodo: "Dic 2026", hoja: "DICIEMBRE",  claves: ["diciembre", "dic"] },
];
const monthsOrder = MESES_PLATAFORMA.map((m) => m.periodo);
const PERIODO_DEFAULT = "Oct 2026";

// Detalle por área de cada mes (fuente: Plantilla Detalle por Area.xlsx).
// Se puede reemplazar desde la app con "Cargar plantilla".
const monthlyAreasRaw = {
  "Jul 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
  "Ago 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
  "Sep 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
  "Oct 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
  "Nov 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
  "Dic 2026": [
    { area: "Comercial",      base: 1855000, comisiones: 870000, bonos: 195000, destajos: 0, otros: 48000, limite: 35 },
    { area: "Posventa",       base: 1425000, comisiones: 120000, bonos: 235000, destajos: 100000, otros: 30000, limite: 25 },
    { area: "Operaciones",    base: 1215000, comisiones: 0, bonos: 75000, destajos: 0, otros: 22000, limite: 25 },
    { area: "Administración", base: 680000, comisiones: 0, bonos: 62000, destajos: 0, otros: 9000, limite: 12 },
    { area: "Dirección",      base: 545000, comisiones: 0, bonos: 210000, destajos: 0, otros: 35000, limite: 30 },
  ],
};

// Áreas del periodo + valores del mes anterior para comparar.
// Julio es el primer mes: se compara contra sí mismo (sin variación).
function getAreasFor(period, areasPorMes = monthlyAreasRaw) {
  const idx = monthsOrder.indexOf(period);
  const curr = areasPorMes[period] || areasPorMes[PERIODO_DEFAULT] || [];
  const prevList = idx <= 0 ? curr : areasPorMes[monthsOrder[idx - 1]] || curr;
  return curr.map((c) => {
    const p = prevList.find((x) => x.area === c.area) || c;
    const prevTotal = p.base + p.comisiones + p.bonos + p.destajos + p.otros;
    return {
      ...c,
      prevTotal,
      prev: { comisiones: p.comisiones, bonos: p.bonos, destajos: p.destajos, otros: p.otros },
    };
  });
}

// =============================================================
// PLANTILLA EXCEL · Detalle por área (descarga y carga)
// =============================================================
const PLANTILLA_COLS = [
  { key: "area", header: "Área" },
  { key: "base", header: "Base" },
  { key: "comisiones", header: "Comisiones" },
  { key: "bonos", header: "Bonos" },
  { key: "destajos", header: "Destajos" },
  { key: "otros", header: "Otros" },
  { key: "limite", header: "Límite (%)" },
];
const PLANTILLA_STORAGE_KEY = "rrhh.nomina.detalleArea.v2";

const leerCargaGuardada = () => {
  try { return JSON.parse(localStorage.getItem(PLANTILLA_STORAGE_KEY) || "null"); } catch { return null; }
};
const guardarCarga = (carga) => {
  try {
    if (carga) localStorage.setItem(PLANTILLA_STORAGE_KEY, JSON.stringify(carga));
    else localStorage.removeItem(PLANTILLA_STORAGE_KEY);
  } catch { /* sin almacenamiento */ }
};

const normalizarTexto = (v) => String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
const mesDeHoja = (nombre) => {
  const n = normalizarTexto(nombre);
  return MESES_PLATAFORMA.find((m) => m.claves.some((k) => n.startsWith(k)));
};

// Plantilla con diseño (logo, estilos, hojas protegidas), una hoja por mes.
// Se llena editando el XML del .xlsx para no perder el formato.
const PLANTILLA_PRIMERA_FILA = 4;
const PLANTILLA_ULTIMA_FILA = 27;

async function descargarPlantillaDetalle(areasPorMes) {
  const { unzipSync, zipSync, strToU8, strFromU8 } = await import("fflate");
  const resp = await fetch(plantillaDetalleUrl);
  if (!resp.ok) throw new Error("No se pudo obtener la plantilla");
  const files = unzipSync(new Uint8Array(await resp.arrayBuffer()));
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Hoja -> archivo XML (workbook.xml + relaciones)
  const libro = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const destinoDe = (rid) => {
    const m = rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`));
    const t = m && m[0].match(/Target="([^"]+)"/);
    return t ? "xl/" + t[1].replace(/^\/?xl\//, "") : null;
  };
  const hojas = [...libro.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ nombre: m[1], ruta: destinoDe(m[2]) }));

  for (const { nombre, ruta } of hojas) {
    const mes = mesDeHoja(nombre);
    if (!mes || !ruta || !files[ruta]) continue;
    const filas = areasPorMes[mes.periodo] || [];
    let hoja = strFromU8(files[ruta]);
    for (let r = PLANTILLA_PRIMERA_FILA; r <= PLANTILLA_ULTIMA_FILA; r++) {
      const f = filas[r - PLANTILLA_PRIMERA_FILA];
      const num = (col, v, st) => `<c r="${col}${r}" s="${st}"><v>${Number(v) || 0}</v></c>`;
      const celdas = f
        ? `<c r="B${r}" s="6" t="inlineStr"><is><t>${esc(f.area)}</t></is></c>` +
          num("C", f.base, 7) + num("D", f.comisiones, 7) + num("E", f.bonos, 7) +
          num("F", f.destajos, 7) + num("G", f.otros, 7) + num("H", (Number(f.limite) || 0) / 100, 8)
        : `<c r="B${r}" s="6"/>` + ["C", "D", "E", "F", "G"].map((c) => `<c r="${c}${r}" s="7"/>`).join("") + `<c r="H${r}" s="8"/>`;
      hoja = hoja.replace(new RegExp(`<row r="${r}"[^>]*?(?:/>|>[\\s\\S]*?</row>)`), `<row r="${r}" spans="2:8" ht="21" customHeight="1">${celdas}</row>`);
    }
    files[ruta] = strToU8(hoja);
  }

  let textos = strFromU8(files["xl/sharedStrings.xml"]);
  textos = textos
    .replace(/<t xml:space="preserve">Periodo: <\/t>/, `<t>Periodos: ${esc(monthsOrder[0])} a ${esc(monthsOrder[monthsOrder.length - 1])}</t>`)
    .replace('en la hoja "Detalle por área"', "en la hoja de cada mes (JULIO a DICIEMBRE)")
    .replace("como número (ej. 35 para 35%)", "como porcentaje (ej. 35%)")
    .replace('súbelo con el botón "Cargar plantilla" con el mismo periodo seleccionado.', 'súbelo con el botón "Cargar plantilla": se cargan todos los meses a la vez.');
  files["xl/sharedStrings.xml"] = strToU8(textos);

  const blob = new Blob([zipSync(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Plantilla Detalle por Area - ${monthsOrder[0]} a ${monthsOrder[monthsOrder.length - 1]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lee el Excel (una hoja por mes) y devuelve { meses: { periodo: filas }, errores, vacias }
async function leerPlantillaDetalle(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const meses = {};
  const errores = [];
  const vacias = [];
  wb.SheetNames.forEach((nombre) => {
    const mes = mesDeHoja(nombre);
    if (!mes || meses[mes.periodo]) return;
    const res = leerHojaDetalle(XLSX, wb.Sheets[nombre]);
    if (res.vacia) { vacias.push(mes.periodo); return; }
    res.errores.forEach((e) => errores.push(`${nombre}: ${e}`));
    if (res.filas.length) meses[mes.periodo] = res.filas;
  });
  if (!Object.keys(meses).length && !errores.length) {
    errores.push(vacias.length
      ? "Las hojas de los meses están vacías."
      : "No encontré hojas con nombre de mes (JULIO a DICIEMBRE). Usa la plantilla descargada.");
  }
  return { meses, errores, vacias };
}

function leerHojaDetalle(XLSX, hoja) {
  if (!hoja) return { filas: [], errores: ["Hoja vacía."] };
  const rows = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", blankrows: false });
  const norm = normalizarTexto;
  const headerIdx = rows.findIndex((r) => r.some((v) => norm(v) === "area"));
  if (headerIdx < 0) return { filas: [], errores: ["No encontré la fila de encabezados (columna \"Área\"). Usa la plantilla descargada."] };
  const header = rows[headerIdx].map(norm);
  const colIdx = {};
  const faltantes = [];
  PLANTILLA_COLS.forEach((c) => {
    const i = header.findIndex((h) => h === norm(c.header) || h === c.key);
    if (i < 0) faltantes.push(c.header); else colIdx[c.key] = i;
  });
  if (faltantes.length) return { filas: [], errores: [`Faltan columnas: ${faltantes.join(", ")}.`] };

  const toNum = (v) => {
    if (typeof v === "number") return v;
    const t = String(v).replace(/[$,%\s]/g, "");
    if (t === "") return 0;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };
  const filas = [];
  const errores = [];
  const vistos = new Set();
  rows.slice(headerIdx + 1).forEach((r, i) => {
    const area = String(r[colIdx.area] ?? "").trim();
    if (!area) return;
    const linea = headerIdx + i + 2;
    if (vistos.has(area.toLowerCase())) { errores.push(`Fila ${linea}: el área "${area}" está repetida.`); return; }
    vistos.add(area.toLowerCase());
    const fila = { area };
    PLANTILLA_COLS.slice(1).forEach((c) => {
      let n = toNum(r[colIdx[c.key]]);
      if (c.key === "limite" && n > 0 && n <= 1) n = Math.round(n * 10000) / 100; // celdas con formato % de Excel (0.35 → 35)
      if (Number.isNaN(n) || n < 0) errores.push(`Fila ${linea} (${area}): "${c.header}" debe ser un número positivo.`);
      fila[c.key] = Number.isNaN(n) ? 0 : n;
    });
    if (fila.base + fila.comisiones + fila.bonos + fila.destajos + fila.otros <= 0) {
      errores.push(`Fila ${linea} (${area}): todos los montos están en cero.`);
    }
    filas.push(fila);
  });
  if (!filas.length && !errores.length) return { filas, errores, vacia: true };
  return { filas, errores };
}

const monthlyBonos = {
  "Jul 2026": [
    { id: 101, fecha: "2026-07-09", empleado: "P. Hernández", area: "Comercial", monto: 30000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "J. Beltrán (Director Comercial)", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cierre fiscal del año previo: cuenta enterprise renovada por $4.1M y crecimiento 18% YoY.",
      estado: "Aprobado", stage: "final" },
    { id: 102, fecha: "2026-07-22", empleado: "R. Estrada", area: "Operaciones", monto: 15000,
      solicitante: "S. Ortega", gerenciaSolicitante: "Operaciones",
      autoriza: "—", medioEvidencia: "Slack / Teams",
      tipo: "Proyecto especial",
      justificacion: "Lideró migración de almacén central durante diciembre, reduciendo inventario muerto $850K.",
      estado: "Pendiente", stage: "gerente" },
  ],
  "Ago 2026": [
    { id: 201, fecha: "2026-08-05", empleado: "M. López", area: "Posventa", monto: 22000,
      solicitante: "T. Aguilar", gerenciaSolicitante: "Posventa",
      autoriza: "C. Robles (Director)", medioEvidencia: "Firma electrónica",
      tipo: "Reconocimiento desempeño",
      justificacion: "NPS de su cartera de 91 puntos en enero, 12 puntos arriba del promedio de la gerencia.",
      estado: "Aprobado", stage: "final" },
    { id: 202, fecha: "2026-08-14", empleado: "J. Castillo", area: "Comercial", monto: 35000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "—", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cuenta enterprise nueva $2.6M con SLA premium, dos años de contrato y referencia para industria.",
      estado: "Pendiente", stage: "director" },
    { id: 203, fecha: "2026-08-19", empleado: "A. Mendoza", area: "Administración", monto: 10000,
      solicitante: "G. Pérez", gerenciaSolicitante: "Administración",
      autoriza: "RRHH", medioEvidencia: "Memo formal",
      tipo: "Otro",
      justificacion: "Sin justificación documentada, solicitud devuelta a área para complementar evidencia.",
      estado: "Rechazado", stage: "final" },
  ],
  "Sep 2026": [
    { id: 301, fecha: "2026-09-08", empleado: "R. Domínguez", area: "Comercial", monto: 45000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "P. Hernández (Director)", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cierre Q1: cuenta clave $3.2M cerrada fuera de cuota anual con margen del 26%.",
      estado: "Aprobado", stage: "final" },
    { id: 302, fecha: "2026-09-15", empleado: "F. Salazar", area: "Comercial", monto: 38000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "P. Hernández (Director)", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cuenta enterprise región Bajío $2.8M con expansión a 3 plantas adicionales en H2.",
      estado: "Aprobado", stage: "final" },
    { id: 303, fecha: "2026-09-22", empleado: "T. Ríos", area: "Posventa", monto: 28000,
      solicitante: "T. Aguilar", gerenciaSolicitante: "Posventa",
      autoriza: "—", medioEvidencia: "Slack / Teams",
      tipo: "Retención",
      justificacion: "Recuperación de proveedor estratégico que iba a romper contrato, retención asegurada por 18 meses.",
      estado: "Pendiente", stage: "director" },
    { id: 304, fecha: "2026-09-26", empleado: "G. Mejía", area: "Dirección", monto: 50000,
      solicitante: "CEO", gerenciaSolicitante: "Dirección",
      autoriza: "—", medioEvidencia: "Memo formal",
      tipo: "Cierre de cuenta clave",
      justificacion: "Liderazgo cierre Q1 directiva, EBITDA al 110% de la meta y plan de Q2 firmado por consejo.",
      estado: "Pendiente", stage: "gerente" },
  ],
  "Oct 2026": [
    { id: 401, fecha: "2026-10-08", empleado: "R. Domínguez", area: "Comercial", monto: 45000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "P. Hernández (Director)", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Renovación anticipada de cuenta clave con upsell, $1.8M de ingreso recurrente extra anual.",
      estado: "Aprobado", stage: "final" },
    { id: 402, fecha: "2026-10-15", empleado: "M. Vázquez", area: "Posventa", monto: 18500,
      solicitante: "J. Ramírez", gerenciaSolicitante: "Posventa",
      autoriza: "—", medioEvidencia: "Slack / Teams",
      tipo: "Reconocimiento desempeño",
      justificacion: "NPS de 92 en su cartera durante el trimestre completo, 14 puntos arriba del promedio del área.",
      estado: "Pendiente", stage: "director" },
    { id: 403, fecha: "2026-10-12", empleado: "A. Solís", area: "Dirección", monto: 80000,
      solicitante: "CEO", gerenciaSolicitante: "Dirección",
      autoriza: "RRHH", medioEvidencia: "Memo formal",
      tipo: "Otro",
      justificacion: "Sin justificación documentada formal, requiere evidencia adicional antes de avanzar.",
      estado: "Rechazado", stage: "final" },
    { id: 404, fecha: "2026-10-22", empleado: "C. Ortiz", area: "Comercial", monto: 12000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "—", medioEvidencia: "Correo",
      tipo: "Reconocimiento desempeño",
      justificacion: "Sobrecumplimiento de cuota mensual al 142% en abril, líder del ranking del equipo Norte.",
      estado: "Pendiente", stage: "gerente" },
  ],
  "Nov 2026": [
    { id: 501, fecha: "2026-11-06", empleado: "D. Vega", area: "Comercial", monto: 25000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "—", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cuenta nueva sector salud $1.4M a 36 meses, primer cliente en este vertical para la compañía.",
      estado: "Pendiente", stage: "gerente" },
    { id: 502, fecha: "2026-11-12", empleado: "L. Ortega", area: "Posventa", monto: 14000,
      solicitante: "T. Aguilar", gerenciaSolicitante: "Posventa",
      autoriza: "C. Robles (Director)", medioEvidencia: "Firma electrónica",
      tipo: "Reconocimiento desempeño",
      justificacion: "Indicador de retención al 98% en su segmento durante el cuatrimestre, mejor del año.",
      estado: "Aprobado", stage: "final" },
  ],
  "Dic 2026": [
    { id: 601, fecha: "2026-12-06", empleado: "D. Vega", area: "Comercial", monto: 25000,
      solicitante: "L. Martínez", gerenciaSolicitante: "Comercial",
      autoriza: "—", medioEvidencia: "Correo",
      tipo: "Cierre de cuenta clave",
      justificacion: "Cuenta nueva sector salud $1.4M a 36 meses, primer cliente en este vertical para la compañía.",
      estado: "Pendiente", stage: "gerente" },
    { id: 602, fecha: "2026-12-12", empleado: "L. Ortega", area: "Posventa", monto: 14000,
      solicitante: "T. Aguilar", gerenciaSolicitante: "Posventa",
      autoriza: "C. Robles (Director)", medioEvidencia: "Firma electrónica",
      tipo: "Reconocimiento desempeño",
      justificacion: "Indicador de retención al 98% en su segmento durante el cuatrimestre, mejor del año.",
      estado: "Aprobado", stage: "final" },
  ],
};

// =============================================================
// DASHBOARD GENERAL
// =============================================================
function TrafficLight({ light }) {
  const on = {
    red: "#e53935",
    yellow: "#fdd835",
    green: "#43a047",
  };
  const off = "#2a2a2a";
  const dot = (color, glow) => ({
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: color,
    boxShadow: glow
      ? `0 0 4px #fff, 0 0 8px ${glow}, 0 0 14px ${glow}, 0 0 22px ${glow}`
      : "inset 0 0 3px rgba(0,0,0,0.6)",
  });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        alignItems: "center",
        justifyContent: "center",
        padding: "9px 7px",
        background: "#404040",
        borderRadius: 6,
        border: "1px solid #2a2a2a",
      }}
      aria-label={`Semáforo: ${light}`}
    >
      <div style={dot(light === "red" ? on.red : off, light === "red" ? on.red : null)} />
      <div style={dot(light === "yellow" ? on.yellow : off, light === "yellow" ? on.yellow : null)} />
      <div style={dot(light === "green" ? on.green : off, light === "green" ? on.green : null)} />
    </div>
  );
}

// ---------- Gráficas ligeras (SVG/HTML, sin librerías externas) ----------
function DonutChart({ data, total }) {
  const [hover, setHover] = useState(null); // índice del segmento activo
  const size = 168, baseStroke = 26, r = (size - baseStroke - 6) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const active = hover != null ? data[hover] : null;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} onMouseLeave={() => setHover(null)}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={baseStroke} />
          {data.map((d, i) => {
            const frac = d.n / total;
            const dash = frac * circ;
            const isActive = hover === i;
            const dim = hover != null && !isActive;
            const el = (
              <circle key={d.area} cx={cx} cy={cy} r={r} fill="none" stroke={d.color}
                strokeWidth={isActive ? baseStroke + 6 : baseStroke}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc * circ}
                strokeLinecap="butt" opacity={dim ? 0.35 : 1}
                style={{ cursor: "pointer", transition: "stroke-width 0.12s ease, opacity 0.12s ease" }}
                onMouseEnter={() => setHover(i)} />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", padding: "0 18px" }}>
          <div style={{ fontSize: active ? 26 : 30, fontWeight: 700, color: active ? active.color : COLOR.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", transition: "color 0.12s ease" }}>{active ? active.n : total}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLOR.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 1 }}>{active ? active.area : "Activos"}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((d, i) => (
          <div key={d.area} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{
              display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "5px 8px",
              borderRadius: 6, cursor: "pointer",
              background: hover === i ? COLOR.surfaceSoft : "transparent",
              opacity: hover != null && hover !== i ? 0.5 : 1, transition: "background 0.12s ease, opacity 0.12s ease",
            }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: COLOR.inkSoft, fontWeight: 600 }}>{d.area}</span>
            <span style={{ color: COLOR.textMuted, fontVariantNumeric: "tabular-nums" }}>{d.n}</span>
            <span style={{ width: 42, textAlign: "right", fontWeight: 700, color: COLOR.ink, fontVariantNumeric: "tabular-nums" }}>{Math.round((d.n / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Redondea un máximo a un valor "bonito" para el eje (con holgura superior)
function niceCeil(v) {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function LineChart({ points }) {
  const [hover, setHover] = useState(null);
  const H = 200, insetX = 4, padT = 10, padB = 4; // unidades = % del viewBox
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const axisMax = niceCeil(maxVal * 1.12);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => axisMax * f);
  const x = (i) => insetX + (points.length <= 1 ? (100 - 2 * insetX) / 2 : (i / (points.length - 1)) * (100 - 2 * insetX));
  const y = (v) => padT + (1 - v / axisMax) * (100 - padT - padB);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(2)},${(100 - padB).toFixed(2)} L${x(0).toFixed(2)},${(100 - padB).toFixed(2)} Z`;
  const hp = hover != null ? points[hover] : null;
  return (
    <div style={{ display: "flex" }} onMouseLeave={() => setHover(null)}>
      {/* eje Y */}
      <div style={{ width: 52, height: H, position: "relative", flexShrink: 0 }}>
        {yTicks.map((t) => (
          <span key={t} style={{ position: "absolute", right: 8, top: `${(1 - t / axisMax) * 100}%`, transform: "translateY(-50%)", fontSize: 10, fontWeight: 600, color: COLOR.textMuted, fontVariantNumeric: "tabular-nums" }}>${t.toFixed(t >= 10 ? 0 : 1)}M</span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative", height: H }}>
          {/* gridlines HTML */}
          {yTicks.map((t) => (
            <div key={t} style={{ position: "absolute", left: 0, right: 0, top: `${(1 - t / axisMax) * 100}%`, borderTop: "1px solid " + (t === 0 ? COLOR.border : "#f1f5f9") }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
            <defs>
              <linearGradient id="nominaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#nominaFill)" />
            <path d={line} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={100 - padB} stroke="#16a34a" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" vectorEffect="non-scaling-stroke" />}
            {points.map((p, i) => (
              <rect key={p.label} x={x(i) - (100 - 2 * insetX) / (points.length * 2 || 1)} y={0} width={(100 - 2 * insetX) / (points.length || 1)} height={100}
                fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
          {/* puntos como círculos HTML (siempre redondos) */}
          {points.map((p, i) => (
            <span key={p.label} style={{
              position: "absolute", left: `${x(i)}%`, top: `${y(p.value)}%`,
              width: hover === i ? 12 : 9, height: hover === i ? 12 : 9, borderRadius: "50%",
              background: "#fff", border: "2.5px solid #16a34a", transform: "translate(-50%, -50%)",
              boxShadow: hover === i ? "0 0 0 4px rgba(22,163,74,0.12)" : "none",
              pointerEvents: "none", transition: "all 0.1s ease", zIndex: 2,
            }} />
          ))}
          {hp && (
            <div style={{
              position: "absolute", left: `${x(hover)}%`, top: `${y(hp.value)}%`, transform: "translate(-50%, calc(-100% - 12px))",
              background: "#0f172a", color: "#fff", padding: "7px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              whiteSpace: "nowrap", pointerEvents: "none", zIndex: 3, boxShadow: "0 6px 20px rgba(15,23,42,0.28)",
            }}>{hp.label} · ${hp.value.toFixed(2)}M</div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, padding: `0 ${insetX}%` }}>
          {points.map((p, i) => (
            <span key={p.label} style={{ fontSize: 11, fontWeight: 600, color: hover === i ? COLOR.ink : COLOR.textMuted }}>{p.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarsChart({ data }) {
  const [hover, setHover] = useState(null);
  const H = 210, axisW = 30, BAR_W = 22, BAR_GAP = 8;
  const rawMax = Math.max(...data.flatMap((d) => [d.altas, d.bajas]), 1);
  const axisMax = rawMax <= 5 ? 5 : rawMax <= 8 ? 8 : niceCeil(rawMax);
  const yTicks = [axisMax, axisMax / 2, 0];
  return (
    <div onMouseLeave={() => setHover(null)}>
      <div style={{ display: "flex" }}>
        {/* eje Y */}
        <div style={{ width: axisW, height: H, position: "relative", flexShrink: 0 }}>
          {yTicks.map((t) => (
            <span key={t} style={{ position: "absolute", right: 8, top: `${(1 - t / axisMax) * 100}%`, transform: "translateY(-50%)", fontSize: 10, fontWeight: 600, color: COLOR.textMuted, fontVariantNumeric: "tabular-nums" }}>{t}</span>
          ))}
        </div>
        {/* plot */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", height: H }}>
          {yTicks.map((t) => (
            <div key={t} style={{ position: "absolute", left: 0, right: 0, top: `${(1 - t / axisMax) * 100}%`, borderTop: "1px solid " + (t === 0 ? COLOR.border : "#f1f5f9") }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "stretch" }}>
            {data.map((d, i) => (
              <div key={d.label} onMouseEnter={() => setHover(i)}
                style={{
                  flex: 1, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: BAR_GAP,
                  cursor: "pointer", borderRadius: 8,
                  background: hover === i ? "rgba(241,245,249,0.65)" : "transparent", transition: "background 0.12s ease",
                }}>
                <div style={{ width: BAR_W, height: `${(d.altas / axisMax) * 100}%`, background: "#16a34a", borderRadius: "3px 3px 0 0", opacity: hover != null && hover !== i ? 0.4 : 1, transition: "opacity 0.12s ease" }} />
                <div style={{ width: BAR_W, height: `${(d.bajas / axisMax) * 100}%`, background: "#dc2626", borderRadius: "3px 3px 0 0", opacity: hover != null && hover !== i ? 0.4 : 1, transition: "opacity 0.12s ease" }} />
                {hover === i && (
                  <div style={{
                    position: "absolute", left: "50%", bottom: "100%", transform: "translate(-50%, -10px)",
                    background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                    whiteSpace: "nowrap", pointerEvents: "none", zIndex: 3, boxShadow: "0 6px 20px rgba(15,23,42,0.28)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{d.label}</div>
                    <span style={{ color: "#86efac" }}>● Altas {d.altas}</span>{"   "}
                    <span style={{ color: "#fca5a5" }}>● Bajas {d.bajas}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginLeft: axisW, marginTop: 9 }}>
        {data.map((d, i) => (
          <span key={d.label} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 600, color: hover === i ? COLOR.ink : COLOR.textMuted }}>{d.label}</span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 14 }}>
        {[["Altas", "#16a34a"], ["Bajas", "#dc2626"]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: COLOR.inkSoft }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// Encabezado de sección estilo "kicker + título"
function SectionHead({ kicker, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLOR.textMuted, textTransform: "uppercase", letterSpacing: 1.2 }}>{kicker}</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: COLOR.ink, letterSpacing: "-0.02em", marginTop: 2 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

// =============================================================
// 1. VARIACIONES AL COSTO DE NÓMINA POR COMPENSACIONES
// =============================================================
function Nomina({ periodo = PERIODO_DEFAULT }) {
  const [chartView, setChartView] = useState(null); // null | "month" | "ytd"
  const [bonos, setBonos] = useState(() => monthlyBonos[periodo] || []);
  useEffect(() => {
    setBonos(monthlyBonos[periodo] || []);
  }, [periodo]);
  const [modalOpen, setModalOpen] = useState(false);
  const formInicial = {
    empleado: "",
    area: "Comercial",
    monto: "",
    tipo: "Cierre de cuenta clave",
    justificacion: "",
    impacto: "",
    evidencia: "",
    evidenciaArchivo: "",
    solicitante: "",
    gerenciaSolicitante: "Comercial",
    autoriza: "",
    medioEvidencia: "Correo",
  };
  const [form, setForm] = useState(formInicial);
  const [dragOverFile, setDragOverFile] = useState(false);

  // Datos cargados por Excel (por periodo); si no hay, se usan los simulados
  const [cargaActual, setCargaActual] = useState(leerCargaGuardada);
  const areasPorMes = useMemo(() => ({ ...monthlyAreasRaw, ...(cargaActual?.meses || {}) }), [cargaActual]);
  const data = useMemo(() => getAreasFor(periodo, areasPorMes), [periodo, areasPorMes]);
  const [cargaOpen, setCargaOpen] = useState(false);
  const [cargaDrag, setCargaDrag] = useState(false);
  const [cargaPrev, setCargaPrev] = useState(null); // { archivo, meses, errores, vacias }
  const [cargaLeyendo, setCargaLeyendo] = useState(false);
  const cargaInputRef = useRef(null);

  const procesarArchivoPlantilla = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setCargaPrev({ archivo: file.name, meses: {}, vacias: [], errores: ["Formato no válido. Sube un archivo .xlsx, .xls o .csv."] });
      return;
    }
    setCargaLeyendo(true);
    try {
      const res = await leerPlantillaDetalle(file);
      setCargaPrev({ archivo: file.name, ...res });
    } catch {
      setCargaPrev({ archivo: file.name, meses: {}, vacias: [], errores: ["No se pudo leer el archivo. Verifica que sea la plantilla en Excel."] });
    } finally {
      setCargaLeyendo(false);
    }
  };
  const cargaValida = !!cargaPrev && cargaPrev.errores.length === 0 && Object.keys(cargaPrev.meses).length > 0;
  const aplicarCarga = () => {
    if (!cargaValida) return;
    const next = { meses: cargaPrev.meses, archivo: cargaPrev.archivo, fecha: new Date().toLocaleString("es-MX") };
    setCargaActual(next);
    guardarCarga(next);
    cerrarCarga();
  };
  const restaurarOriginal = () => {
    setCargaActual(null);
    guardarCarga(null);
  };
  const cerrarCarga = () => {
    setCargaOpen(false);
    setCargaPrev(null);
    setCargaDrag(false);
  };

  const calc = (r) => {
    const variable = r.comisiones + r.bonos + r.destajos + r.otros;
    const total = r.base + variable;
    const pctVar = (variable / total) * 100;
    const exceso = pctVar > r.limite;
    return { variable, total, pctVar, exceso };
  };

  const totales = data.reduce(
    (a, r) => {
      const { variable, total } = calc(r);
      return {
        base: a.base + r.base,
        variable: a.variable + variable,
        total: a.total + total,
      };
    },
    { base: 0, variable: 0, total: 0 }
  );

  const fmt = (n) => "$" + n.toLocaleString("es-MX");

  const fmtK = (n) => {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    const abs = Math.abs(n);
    return `${sign}$${(abs / 1000).toFixed(0)}K`;
  };
  // Convención de costos: subir es malo (rojo ▲), bajar es bueno (verde ▼)
  const bbergStyle = (n) => ({
    color: n > 0 ? "#b00020" : n < 0 ? "#0a7d2c" : "#666",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    textAlign: "right",
  });
  const arrow = (n) => (n > 0 ? " ▲" : n < 0 ? " ▼" : "");
  const arrowOnly = (delta) => {
    if (delta > 0) return <span style={{ color: "#b00020", marginLeft: 4 }}>▲</span>;
    if (delta < 0) return <span style={{ color: "#0a7d2c", marginLeft: 4 }}>▼</span>;
    return null;
  };

  const tiposBono = ["Cierre de cuenta clave", "Reconocimiento desempeño", "Retención", "Proyecto especial", "Otro"];
  const mediosEvidencia = ["Correo", "Slack / Teams", "Firma electrónica", "Memo formal", "WhatsApp documentado"];

  // Monto formateado (es-MX: , miles · . decimales)
  const formatMonto = (raw) => {
    if (raw === "" || raw == null) return "";
    const cleaned = String(raw).replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    let intPart, decPart;
    if (firstDot >= 0) {
      intPart = cleaned.slice(0, firstDot);
      decPart = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
    } else {
      intPart = cleaned;
      decPart = null;
    }
    const intFmt = (intPart || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
    return decPart !== null ? `${intFmt}.${decPart}` : intFmt;
  };
  const parseMonto = (raw) => {
    const cleaned = String(raw).replace(/,/g, "").replace(/[^\d.]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };
  const aprobadoresPara = (m) => {
    const n = Number(m) || 0;
    if (n < 25000) return "Gerente";
    if (n <= 75000) return "Gerente + Director";
    return "Gerente + Director + CEO + RRHH";
  };
  const justLen = form.justificacion.trim().length;
  const montoNum = parseMonto(form.monto);
  const errores = [];
  if (!form.empleado.trim()) errores.push("Empleado obligatorio");
  if (montoNum <= 0) errores.push("Monto inválido");
  if (justLen < 80) errores.push(`Justificación: mín. 80 caracteres (actual: ${justLen})`);
  if (!form.impacto.trim()) errores.push("Impacto cuantificable obligatorio");
  if (!form.solicitante.trim()) errores.push("Nombre del solicitante obligatorio");
  if (!form.autoriza.trim()) errores.push("Autorizador obligatorio");
  if (!form.evidencia.trim() && !form.evidenciaArchivo) errores.push("Adjunta un PDF o pega un link de evidencia");

  const areaSel = data.find((d) => d.area === form.area);
  const newBonosArea = (areaSel?.bonos || 0) + montoNum;
  const newVariableArea = areaSel
    ? areaSel.comisiones + newBonosArea + areaSel.destajos + areaSel.otros
    : 0;
  const newTotalArea = areaSel ? areaSel.base + newVariableArea : 0;
  const newPctVarArea = newTotalArea > 0 ? (newVariableArea / newTotalArea) * 100 : 0;
  const rebasaLimite = areaSel ? newPctVarArea > areaSel.limite : false;

  // Semáforo del límite del área (solo cuando hay monto)
  const semaforoArea = !areaSel || montoNum <= 0
    ? "green"
    : newPctVarArea > areaSel.limite
    ? "red"
    : newPctVarArea > areaSel.limite - 3
    ? "yellow"
    : "green";

  // Bonos previos del empleado (match por nombre normalizado)
  const norm = (s) => s.trim().toLowerCase();
  const bonosDelEmpleado = form.empleado.trim().length >= 3
    ? bonos.filter((b) => norm(b.empleado) === norm(form.empleado))
    : [];
  const totalPrevioEmpleado = bonosDelEmpleado.reduce((a, b) => a + b.monto, 0);

  // Bonos del mes por gerencia solicitante
  const bonosGerencia = bonos.filter((b) => b.gerenciaSolicitante === form.gerenciaSolicitante);
  const totalGerencia = bonosGerencia.reduce((a, b) => a + b.monto, 0);
  const rechazadosGerencia = bonosGerencia.filter((b) => b.estado === "Rechazado").length;
  const empleadosGerencia = bonosGerencia.map((b) => norm(b.empleado));
  const dupEmpleadoGerencia = empleadosGerencia.filter((e, i) => empleadosGerencia.indexOf(e) !== i).length > 0;

  // Warnings de política para la gerencia solicitante
  const warningsGerencia = [];
  if (bonosGerencia.length >= 5) warningsGerencia.push(`Volumen alto: ${bonosGerencia.length} solicitudes este mes`);
  if (totalGerencia > 100000) warningsGerencia.push(`Monto acumulado supera $100K (${fmt(totalGerencia)})`);
  if (rechazadosGerencia > 0) warningsGerencia.push(`${rechazadosGerencia} solicitud(es) rechazada(s) recientemente`);
  if (dupEmpleadoGerencia) warningsGerencia.push("Empleado(s) con más de un bono este mes");
  if (bonosDelEmpleado.length >= 2) warningsGerencia.push(`${form.empleado} ya recibió ${bonosDelEmpleado.length} bonos`);

  const semaforoGerencia =
    warningsGerencia.length >= 2 || bonosGerencia.length >= 5 || totalGerencia > 100000
      ? "red"
      : warningsGerencia.length >= 1 || bonosGerencia.length >= 3 || totalGerencia > 50000
      ? "yellow"
      : "green";

  const cerrarModal = () => {
    setModalOpen(false);
    setForm(formInicial);
  };
  const verBono = (b) => {
    setForm({
      empleado: b.empleado || "",
      area: b.area || "Comercial",
      monto: formatMonto(String(b.monto ?? "")),
      tipo: b.tipo || "Cierre de cuenta clave",
      justificacion: b.justificacion || "",
      impacto: b.impacto || "",
      evidencia: b.evidenciaLink || "",
      evidenciaArchivo: b.evidenciaArchivo || "",
      solicitante: b.solicitante || "",
      gerenciaSolicitante: b.gerenciaSolicitante || "Comercial",
      autoriza: b.autoriza === "—" ? "" : (b.autoriza || ""),
      medioEvidencia: b.medioEvidencia || "Correo",
    });
    setModalOpen(true);
  };
  const enviarBono = () => {
    if (errores.length > 0) return;
    const hoy = new Date().toISOString().slice(0, 10);
    setBonos([
      ...bonos,
      {
        id: Date.now(),
        fecha: hoy,
        empleado: form.empleado.trim(),
        area: form.area,
        monto: montoNum,
        solicitante: form.solicitante.trim(),
        gerenciaSolicitante: form.gerenciaSolicitante,
        autoriza: form.autoriza.trim(),
        medioEvidencia: form.medioEvidencia,
        tipo: form.tipo,
        justificacion: form.justificacion.trim(),
        evidenciaArchivo: form.evidenciaArchivo,
        evidenciaLink: form.evidencia.trim(),
        estado: "Pendiente",
        stage: "solicitud",
      },
    ]);
    cerrarModal();
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    setDragOverFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setForm((f) => ({ ...f, evidenciaArchivo: file.name }));
  };

  const badgeEstado = (estado) => {
    const colors = { Aprobado: "#e8f5e9", Pendiente: "#fff7e0", Rechazado: "#fdecea" };
    return <span style={S.badge(colors[estado] || "#eee")}>{estado}</span>;
  };

  // ==== KANBAN ====
  const stages = [
    { id: "solicitud", label: "Solicitud" },
    { id: "gerente", label: "Aprob. Gerente" },
    { id: "director", label: "Aprob. Director" },
    { id: "final", label: "Final" },
  ];
  const nextStage = { solicitud: "gerente", gerente: "director", director: "final" };

  const avanzar = (id) => {
    setBonos(bonos.map((b) => {
      if (b.id !== id) return b;
      const ns = nextStage[b.stage];
      if (!ns) return b;
      return {
        ...b,
        stage: ns,
        estado: ns === "final" ? "Aprobado" : "Pendiente",
      };
    }));
  };
  const rechazar = (id) => {
    setBonos(bonos.map((b) => b.id === id ? { ...b, stage: "final", estado: "Rechazado" } : b));
  };

  // Drag & drop entre columnas
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const moverA = (id, newStage) => {
    setBonos((curr) => curr.map((b) => {
      if (b.id !== id) return b;
      if (b.stage === newStage) return b;
      if (newStage === "final") {
        return { ...b, stage: "final", estado: "Aprobado" };
      }
      // Vuelve al pipeline (incluye reabrir desde Final / Rechazado)
      return { ...b, stage: newStage, estado: "Pendiente" };
    }));
  };
  const onDropStage = (stageId) => {
    if (draggedId != null) moverA(draggedId, stageId);
    setDraggedId(null);
    setDragOverStage(null);
  };

  const stageColor = (estado) => {
    if (estado === "Aprobado") return { bg: "#e8f5e9", border: "#0a7d2c" };
    if (estado === "Rechazado") return { bg: "#fdecea", border: "#b00020" };
    return { bg: "#fff7e0", border: "#b58900" };
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, display: "block" };

  const pctVarConsolidado = (totales.variable / totales.total) * 100;
  const limiteConsolidado = 18;
  const variacionPp = pctVarConsolidado - limiteConsolidado;
  const semaforoVariable =
    pctVarConsolidado <= limiteConsolidado
      ? "green"
      : pctVarConsolidado <= limiteConsolidado + 3
      ? "yellow"
      : "red";

  const prevTotales = useMemo(() => {
    const idx = monthsOrder.indexOf(periodo);
    const prevAreas = idx <= 0 ? areasPorMes[periodo] || [] : areasPorMes[monthsOrder[idx - 1]] || [];
    return prevAreas.reduce(
      (a, r) => {
        const variable = r.comisiones + r.bonos + r.destajos + r.otros;
        return {
          base: a.base + r.base,
          variable: a.variable + variable,
          total: a.total + r.base + variable,
        };
      },
      { base: 0, variable: 0, total: 0 }
    );
  }, [periodo, areasPorMes]);
  const deltaPct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : 0);
  const cmpColor = (d) => (d <= 0 ? "#0a7d2c" : d <= 5 ? "#d97706" : "#b00020");
  const cmpLight = (d) => (d <= 0 ? "green" : d <= 5 ? "yellow" : "red");
  const fmtDelta = (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs mes anterior`;
  const dBase = deltaPct(totales.base, prevTotales.base);
  const dVar = deltaPct(totales.variable, prevTotales.variable);
  const dTot = deltaPct(totales.total, prevTotales.total);

  return (
    <div>
      <h2 style={S.h2}>Variaciones al Costo de Nómina por Compensaciones</h2>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Nómina base total</div>
            <div style={S.kpiValue}>{fmt(totales.base)}</div>
            <div style={{ fontSize: 14, color: cmpColor(dBase), marginTop: 4 }}>{fmtDelta(dBase)}</div>
            <div style={S.kpiBenchmark(cmpLight(dBase))}>Estable vs media móvil (±2%)</div>
          </div>
          <TrafficLight light={cmpLight(dBase)} />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Compensación variable</div>
            <div style={S.kpiValue}>{fmt(totales.variable)}</div>
            <div style={{ fontSize: 14, color: cmpColor(dVar), marginTop: 4 }}>{fmtDelta(dVar)}</div>
            <div style={S.kpiBenchmark(cmpLight(dVar))}>Variación esperada ≤±3% vs MA</div>
          </div>
          <TrafficLight light={cmpLight(dVar)} />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Total nómina</div>
            <div style={S.kpiValue}>{fmt(totales.total)}</div>
            <div style={{ fontSize: 14, color: cmpColor(dTot), marginTop: 4 }}>{fmtDelta(dTot)}</div>
            <div style={S.kpiBenchmark(cmpLight(dTot))}>Aceptable: ≤+2% vs MA</div>
          </div>
          <TrafficLight light={cmpLight(dTot)} />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>% variable consolidado</div>
            <div style={S.kpiValue}>{pctVarConsolidado.toFixed(1)}%</div>
            <div style={S.kpiDelta(variacionPp <= 0)}>
              {variacionPp >= 0 ? "+" : ""}{variacionPp.toFixed(1)}% vs límite ({limiteConsolidado}%)
            </div>
            <div style={S.kpiBenchmark(semaforoVariable)}>Política interna: {limiteConsolidado}%</div>
          </div>
          <TrafficLight light={semaforoVariable} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 6 }}>
        <h3 style={{ ...S.h3, margin: 0 }}>Detalle por área (variación vs. MA)</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            style={{ ...S.btnGhost, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => descargarPlantillaDetalle(areasPorMes)}
            title="Descarga un Excel con las columnas de esta tabla para llenarlo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Descarga plantilla
          </button>
          <button
            style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setCargaOpen(true)}
            title="Sube la plantilla llenada para actualizar esta tabla"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Cargar plantilla
          </button>
          <button
            style={{
              ...S.btnGhost,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: chartView === "month" ? "#000" : "#fff",
              color: chartView === "month" ? "#fff" : "#000",
              borderColor: chartView === "month" ? "#000" : "#ccc",
            }}
            onClick={() => setChartView((v) => (v === "month" ? null : "month"))}
          >
            {chartView === "month" ? "Ocultar" : "Gráfica"}
          </button>
          <button
            style={{
              ...S.btnGhost,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: chartView === "areaMonth" ? "#000" : "#fff",
              color: chartView === "areaMonth" ? "#fff" : "#000",
              borderColor: chartView === "areaMonth" ? "#000" : "#ccc",
            }}
            onClick={() => setChartView((v) => (v === "areaMonth" ? null : "areaMonth"))}
          >
            {chartView === "areaMonth" ? "Ocultar" : "Por área mes a mes"}
          </button>
          <button
            style={{
              ...S.btnGhost,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: chartView === "ytd" ? "#000" : "#fff",
              color: chartView === "ytd" ? "#fff" : "#000",
              borderColor: chartView === "ytd" ? "#000" : "#ccc",
            }}
            onClick={() => setChartView((v) => (v === "ytd" ? null : "ytd"))}
          >
            {chartView === "ytd" ? "Ocultar" : "Gráfica Acumulada"}
          </button>
        </div>
      </div>

      {chartView === "month" && (<ChartCopy label="Variaciones mes en curso">{(() => {
        const chartData = data
          .map((r) => {
            const c = calc(r);
            return { area: r.area, pctVar: c.pctVar };
          })
          .sort((a, b) => b.pctVar - a.pctVar);
        const dataMax = safeMax(chartData.map((d) => d.pctVar));
        const yMax = Math.max(Math.ceil((dataMax + 5) / 10) * 10, 50);
        const yTicks = [];
        for (let i = 0; i <= yMax; i += 10) yTicks.push(i);
        yTicks.reverse();
        const mes = (periodo || "").split(" ")[0]?.toUpperCase() || "MES";
        const anio = (periodo || "").split(" ")[1] || "";
        const colorAbove = "#c2410c"; // amber-700, sophisticated burnt orange
        const colorBelow = "#475569"; // slate-600, neutral gray
        const gradAbove = "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)";
        const gradBelow = "linear-gradient(180deg, #64748b 0%, #475569 100%)";
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "24px 28px 20px",
              marginBottom: 16,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 14, marginBottom: 18 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: 4,
              }}>
                Variación de compensación · {mes} {anio}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", letterSpacing: -0.2 }}>
                  Compensación variable por área
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                  Promedio consolidado <strong style={{ color: "#0f172a", fontWeight: 600 }}>{pctVarConsolidado.toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            {/* Chart body */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 8 }}>
              {/* Y axis labels */}
              <div style={{ position: "relative", height: 260 }}>
                {yTicks.map((y) => (
                  <div
                    key={y}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: `${((yMax - y) / yMax) * 100}%`,
                      transform: "translateY(-50%)",
                      fontSize: 10,
                      color: "#94a3b8",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: 0.2,
                    }}
                  >
                    {y}%
                  </div>
                ))}
              </div>

              {/* Plot */}
              <div>
                <div style={{ position: "relative", height: 260 }}>
                  {/* Grid lines */}
                  {yTicks.map((y) => (
                    <div
                      key={y}
                      style={{
                        position: "absolute",
                        left: 0, right: 0,
                        top: `${((yMax - y) / yMax) * 100}%`,
                        height: 1,
                        background: y === 0 ? "#cbd5e1" : "#f1f5f9",
                      }}
                    />
                  ))}
                  {/* Average line */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0, right: 0,
                      top: `${((yMax - pctVarConsolidado) / yMax) * 100}%`,
                      height: 1,
                      borderTop: "1px dashed #94a3b8",
                      pointerEvents: "none",
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      right: 0,
                      top: -16,
                      fontSize: 10,
                      color: "#475569",
                      fontWeight: 500,
                      background: "#fff",
                      padding: "0 6px",
                      letterSpacing: 0.2,
                    }}>
                      Promedio · {pctVarConsolidado.toFixed(1)}%
                    </span>
                  </div>
                  {/* Bars */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 14, padding: "0 8px" }}>
                    {chartData.map((d) => {
                      const isAbove = d.pctVar > pctVarConsolidado;
                      const color = isAbove ? colorAbove : colorBelow;
                      const grad = isAbove ? gradAbove : gradBelow;
                      const heightPct = (d.pctVar / yMax) * 100;
                      return (
                        <div
                          key={d.area}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            height: "100%",
                            maxWidth: 84,
                            margin: "0 auto",
                          }}
                        >
                          <span style={{
                            color,
                            fontWeight: 600,
                            fontSize: 12,
                            marginBottom: 6,
                            fontVariantNumeric: "tabular-nums",
                            letterSpacing: -0.1,
                          }}>
                            {d.pctVar.toFixed(1)}%
                          </span>
                          <div
                            style={{
                              height: `${heightPct}%`,
                              width: "100%",
                              background: grad,
                              borderRadius: "3px 3px 0 0",
                              minHeight: 2,
                              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* X axis labels */}
                <div style={{ display: "flex", gap: 14, padding: "10px 8px 0" }}>
                  {chartData.map((d) => (
                    <div
                      key={d.area}
                      style={{
                        flex: 1,
                        maxWidth: 84,
                        margin: "0 auto",
                        fontSize: 11,
                        textAlign: "center",
                        color: "#475569",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: 0.1,
                      }}
                      title={d.area}
                    >
                      {d.area}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend & footer */}
            <div style={{
              borderTop: "1px solid #f1f5f9",
              marginTop: 16,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
              letterSpacing: 0.3,
            }}>
              <div style={{ display: "flex", gap: 18 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: gradAbove, borderRadius: 2 }} />
                  Por encima del promedio
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: gradBelow, borderRadius: 2 }} />
                  Igual o por debajo
                </span>
              </div>
              <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9 }}>
                Fuente · Nómina interna
              </div>
            </div>
          </div>
        );
      })()}</ChartCopy>)}

      {chartView === "areaMonth" && (<ChartCopy label="Variaciones por área mes a mes">{(() => {
        const idx = monthsOrder.indexOf(periodo);
        const months = monthsOrder.slice(0, idx + 1);
        const areasList = ["Comercial", "Posventa", "Operaciones", "Administración", "Dirección"];
        const areaAbbr = { Comercial: "Com", Posventa: "Pos", Operaciones: "Ope", "Administración": "Adm", "Dirección": "Dir" };
        const colorAbove = "#c2410c";
        const colorBelow = "#475569";
        const gradAbove = "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)";
        const gradBelow = "linear-gradient(180deg, #64748b 0%, #475569 100%)";
        const series = months.map((m) => {
          const raw = areasPorMes[m] || [];
          const totMes = raw.reduce(
            (a, r) => {
              const variable = r.comisiones + r.bonos + r.destajos + r.otros;
              return { variable: a.variable + variable, total: a.total + r.base + variable };
            },
            { variable: 0, total: 0 }
          );
          const promedio = (totMes.variable / totMes.total) * 100;
          return {
            mes: m.split(" ")[0],
            promedio,
            bars: areasList.map((a) => {
              const r = raw.find((x) => x.area === a);
              if (!r) return { area: a, pctVar: 0 };
              const variable = r.comisiones + r.bonos + r.destajos + r.otros;
              const total = r.base + variable;
              return { area: a, pctVar: (variable / total) * 100 };
            }),
          };
        });
        const allValues = series.flatMap((s) => s.bars.map((b) => b.pctVar));
        const dataMax = safeMax(allValues);
        const yMax = Math.max(Math.ceil((dataMax + 5) / 10) * 10, 50);
        const yTicks = [];
        for (let i = 0; i <= yMax; i += 10) yTicks.push(i);
        yTicks.reverse();
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "24px 28px 20px",
              marginBottom: 16,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 14, marginBottom: 18 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: 4,
              }}>
                Comparativo por área · Jul–{series[series.length - 1].mes} 2026
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", letterSpacing: -0.2 }}>
                  % Variable por área, mes a mes
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                  {series.length} mes(es) · {areasList.length} áreas
                </div>
              </div>
            </div>

            {/* Chart body */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 8 }}>
              {/* Y axis */}
              <div style={{ position: "relative", height: 260 }}>
                {yTicks.map((y) => (
                  <div
                    key={y}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: `${((yMax - y) / yMax) * 100}%`,
                      transform: "translateY(-50%)",
                      fontSize: 10,
                      color: "#94a3b8",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {y}%
                  </div>
                ))}
              </div>

              {/* Plot */}
              <div>
                <div style={{ position: "relative", height: 260 }}>
                  {/* Grid */}
                  {yTicks.map((y) => (
                    <div
                      key={y}
                      style={{
                        position: "absolute",
                        left: 0, right: 0,
                        top: `${((yMax - y) / yMax) * 100}%`,
                        height: 1,
                        background: y === 0 ? "#cbd5e1" : "#f1f5f9",
                      }}
                    />
                  ))}
                  {/* Grouped bars */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 20, padding: "0 12px" }}>
                    {series.map((s) => (
                      <div
                        key={s.mes}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          gap: 3,
                          height: "100%",
                          margin: "0 auto",
                        }}
                      >
                        {s.bars.map((b) => {
                          const isAbove = b.pctVar > s.promedio;
                          const color = isAbove ? colorAbove : colorBelow;
                          const grad = isAbove ? gradAbove : gradBelow;
                          const heightPct = (b.pctVar / yMax) * 100;
                          return (
                            <div
                              key={b.area}
                              title={`${b.area}: ${b.pctVar.toFixed(1)}%`}
                              style={{
                                width: 22,
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "flex-end",
                                alignItems: "center",
                              }}
                            >
                              <span style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color,
                                fontVariantNumeric: "tabular-nums",
                                marginBottom: 3,
                                letterSpacing: -0.2,
                              }}>
                                {b.pctVar.toFixed(0)}%
                              </span>
                              <div
                                style={{
                                  width: "100%",
                                  height: `${heightPct}%`,
                                  background: grad,
                                  borderRadius: "2px 2px 0 0",
                                  minHeight: 2,
                                  boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {/* X axis — abreviación por barra + mes debajo */}
                <div style={{ display: "flex", gap: 20, padding: "6px 12px 0" }}>
                  {series.map((s) => (
                    <div key={s.mes} style={{ flex: 1, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 3 }}>
                        {s.bars.map((b) => (
                          <div
                            key={b.area}
                            style={{
                              width: 22,
                              fontSize: 9,
                              textAlign: "center",
                              color: "#64748b",
                              fontWeight: 500,
                              letterSpacing: 0.1,
                            }}
                          >
                            {areaAbbr[b.area]}
                          </div>
                        ))}
                      </div>
                      <div style={{
                        marginTop: 6,
                        fontSize: 11,
                        textAlign: "center",
                        color: "#475569",
                        fontWeight: 600,
                        letterSpacing: 0.1,
                      }}>
                        {s.mes}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{
              borderTop: "1px solid #f1f5f9",
              marginTop: 16,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
              letterSpacing: 0.3,
              flexWrap: "wrap",
              gap: 8,
            }}>
              <div style={{ display: "flex", gap: 18 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: gradAbove, borderRadius: 2 }} />
                  Por encima del promedio del mes
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: gradBelow, borderRadius: 2 }} />
                  Igual o por debajo
                </span>
              </div>
              <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9 }}>
                Fuente · Nómina interna
              </div>
            </div>
          </div>
        );
      })()}</ChartCopy>)}

      {chartView === "ytd" && (<ChartCopy label="Variaciones YTD">{(() => {
        const idx = monthsOrder.indexOf(periodo);
        const months = monthsOrder.slice(0, idx + 1);
        const series = months.map((m) => {
          const areas = areasPorMes[m] || [];
          const totales = areas.reduce(
            (a, r) => {
              const variable = r.comisiones + r.bonos + r.destajos + r.otros;
              return {
                base: a.base + r.base,
                variable: a.variable + variable,
                total: a.total + r.base + variable,
              };
            },
            { base: 0, variable: 0, total: 0 }
          );
          return {
            mes: m.split(" ")[0],
            pctVar: (totales.variable / totales.total) * 100,
            total: totales.total,
          };
        });
        const limite = 18;
        const dataMax = safeMax([...series.map((s) => s.pctVar), limite]);
        const yMax = Math.max(Math.ceil((dataMax + 5) / 5) * 5, 30);
        const yTicks = [];
        for (let i = 0; i <= yMax; i += 5) yTicks.push(i);
        yTicks.reverse();
        const promedioYtd = series.reduce((a, s) => a + s.pctVar, 0) / series.length;
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "24px 28px 20px",
              marginBottom: 16,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 14, marginBottom: 18 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: 4,
              }}>
                Acumulado Jul–{series[series.length - 1].mes} 2026
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", letterSpacing: -0.2 }}>
                  % Variable consolidado mes a mes
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                  Promedio YTD <strong style={{ color: "#0f172a", fontWeight: 600 }}>{promedioYtd.toFixed(1)}%</strong>
                  {" · "}
                  Límite <strong style={{ color: "#0f172a", fontWeight: 600 }}>{limite}%</strong>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 8 }}>
              {/* Y axis */}
              <div style={{ position: "relative", height: 220 }}>
                {yTicks.map((y) => (
                  <div
                    key={y}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: `${((yMax - y) / yMax) * 100}%`,
                      transform: "translateY(-50%)",
                      fontSize: 10,
                      color: "#94a3b8",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {y}%
                  </div>
                ))}
              </div>

              {/* Plot */}
              <div>
                <div style={{ position: "relative", height: 220 }}>
                  {/* Grid */}
                  {yTicks.map((y) => (
                    <div
                      key={y}
                      style={{
                        position: "absolute",
                        left: 0, right: 0,
                        top: `${((yMax - y) / yMax) * 100}%`,
                        height: 1,
                        background: y === 0 ? "#cbd5e1" : "#f1f5f9",
                      }}
                    />
                  ))}
                  {/* Limit line */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0, right: 0,
                      top: `${((yMax - limite) / yMax) * 100}%`,
                      height: 1,
                      borderTop: "1px dashed #b00020",
                      pointerEvents: "none",
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      right: 0,
                      top: -16,
                      fontSize: 10,
                      color: "#b00020",
                      fontWeight: 500,
                      background: "#fff",
                      padding: "0 6px",
                    }}>
                      Límite · {limite}%
                    </span>
                  </div>
                  {/* Bars */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 18, padding: "0 16px" }}>
                    {series.map((s) => {
                      const exceeds = s.pctVar > limite;
                      const color = exceeds ? "#c2410c" : "#475569";
                      const grad = exceeds
                        ? "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)"
                        : "linear-gradient(180deg, #64748b 0%, #475569 100%)";
                      const heightPct = (s.pctVar / yMax) * 100;
                      return (
                        <div
                          key={s.mes}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            height: "100%",
                            maxWidth: 100,
                            margin: "0 auto",
                          }}
                        >
                          <span style={{
                            color,
                            fontWeight: 600,
                            fontSize: 12,
                            marginBottom: 6,
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {s.pctVar.toFixed(1)}%
                          </span>
                          <div
                            style={{
                              height: `${heightPct}%`,
                              width: "100%",
                              background: grad,
                              borderRadius: "3px 3px 0 0",
                              minHeight: 2,
                              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* X axis */}
                <div style={{ display: "flex", gap: 18, padding: "10px 16px 0" }}>
                  {series.map((s) => (
                    <div
                      key={s.mes}
                      style={{
                        flex: 1,
                        maxWidth: 100,
                        margin: "0 auto",
                        fontSize: 11,
                        textAlign: "center",
                        color: "#475569",
                        fontWeight: 500,
                      }}
                    >
                      {s.mes}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              borderTop: "1px solid #f1f5f9",
              marginTop: 16,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
            }}>
              <div style={{ display: "flex", gap: 18 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)", borderRadius: 2 }} />
                  Excede límite (18%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, background: "linear-gradient(180deg, #64748b 0%, #475569 100%)", borderRadius: 2 }} />
                  Dentro de política
                </span>
              </div>
              <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9 }}>
                Fuente · Nómina interna
              </div>
            </div>
          </div>
        );
      })()}</ChartCopy>)}

      {cargaActual && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 14px", marginBottom: 8, fontSize: 12, color: "#7c2d12" }}>
          <span>
            Datos cargados desde Excel · <strong>{cargaActual.archivo}</strong> · {Object.keys(cargaActual.meses || {}).length} mes(es) · {cargaActual.fecha}
          </span>
          <button style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12 }} onClick={restaurarOriginal}>
            Restaurar datos originales
          </button>
        </div>
      )}

      {cargaOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={cerrarCarga}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, width: 640, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", padding: 24, boxShadow: "0 20px 50px rgba(15,23,42,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Cargar plantilla</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Detalle por área · <strong>{monthsOrder[0]} a {monthsOrder[monthsOrder.length - 1]}</strong> · una hoja por mes</div>
              </div>
              <button style={{ ...S.btnGhost, padding: "4px 10px" }} onClick={cerrarCarga}>✕</button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setCargaDrag(true); }}
              onDragLeave={() => setCargaDrag(false)}
              onDrop={(e) => { e.preventDefault(); setCargaDrag(false); procesarArchivoPlantilla(e.dataTransfer.files?.[0]); }}
              onClick={() => cargaInputRef.current?.click()}
              style={{
                border: `2px dashed ${cargaDrag ? "#c2410c" : "#cbd5e1"}`,
                background: cargaDrag ? "#fff7ed" : "#f8fafc",
                borderRadius: 10,
                padding: "32px 16px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={cargaDrag ? "#c2410c" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 8 }}>
                {cargaLeyendo ? "Leyendo archivo…" : "Arrastra aquí tu Excel"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>o haz clic para seleccionarlo · .xlsx, .xls o .csv</div>
              <input
                ref={cargaInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => { procesarArchivoPlantilla(e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>

            {cargaPrev && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                  Archivo: <strong>{cargaPrev.archivo}</strong>
                </div>
                {cargaPrev.errores.length > 0 && (
                  <div style={{ background: "#fdecea", border: "1px solid #f5c2c0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#8a1c1c", marginBottom: 10 }}>
                    <strong>Corrige estos puntos y vuelve a subir el archivo:</strong>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {cargaPrev.errores.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}
                      {cargaPrev.errores.length > 8 && <li>… y {cargaPrev.errores.length - 8} más</li>}
                    </ul>
                  </div>
                )}
                {Object.keys(cargaPrev.meses).length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ ...S.table, fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Mes</th>
                          <th style={S.th}>Áreas</th>
                          <th style={S.th}>Base</th>
                          <th style={S.th}>Variable</th>
                          <th style={S.th}>Total</th>
                          <th style={S.th}>% Variable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthsOrder.filter((m) => cargaPrev.meses[m]).map((m) => {
                          const filas = cargaPrev.meses[m];
                          const base = filas.reduce((a, f) => a + f.base, 0);
                          const variable = filas.reduce((a, f) => a + f.comisiones + f.bonos + f.destajos + f.otros, 0);
                          return (
                            <tr key={m}>
                              <td style={S.td}><strong>{m}</strong></td>
                              <td style={S.td}>{filas.length}</td>
                              <td style={S.td}>{fmt(base)}</td>
                              <td style={S.td}>{fmt(variable)}</td>
                              <td style={S.td}>{fmt(base + variable)}</td>
                              <td style={S.td}>{base + variable > 0 ? ((variable / (base + variable)) * 100).toFixed(1) : "0.0"}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {(() => {
                  const sinDatos = monthsOrder.filter((m) => !cargaPrev.meses[m]);
                  return sinDatos.length > 0 && Object.keys(cargaPrev.meses).length > 0 ? (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                      Sin datos en el archivo: {sinDatos.join(", ")}. Esos meses conservan los datos actuales.
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button style={{ ...S.btnGhost, fontSize: 12 }} onClick={() => descargarPlantillaDetalle(areasPorMes)}>
                ¿No tienes la plantilla? Descárgala
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnGhost} onClick={cerrarCarga}>Cancelar</button>
                <button
                  style={{ ...S.btn, opacity: cargaValida ? 1 : 0.45, cursor: cargaValida ? "pointer" : "not-allowed" }}
                  disabled={!cargaValida}
                  onClick={aplicarCarga}
                >
                  Aplicar a la tabla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Área</th>
            <th style={S.th}>Base</th>
            <th style={S.th}>Comisiones</th>
            <th style={S.th}>Bonos</th>
            <th style={S.th}>Destajos</th>
            <th style={S.th}>Otros</th>
            <th style={S.th}>Total</th>
            <th style={S.th}>Variación neta</th>
            <th style={S.th}>% Cambio</th>
            <th style={S.th}>% Variable</th>
            <th style={S.th}>Límite</th>
            <th style={S.th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const c = calc(r);
            const varNeta = c.total - r.prevTotal;
            const pctCambio = (varNeta / r.prevTotal) * 100;
            return (
              <tr key={r.area}>
                <td style={S.td}><strong>{r.area}</strong></td>
                <td style={S.td}>{fmt(r.base)}</td>
                <td style={S.td}>{fmt(r.comisiones)}{arrowOnly(r.comisiones - r.prev.comisiones)}</td>
                <td style={S.td}>{fmt(r.bonos)}{arrowOnly(r.bonos - r.prev.bonos)}</td>
                <td style={S.td}>{fmt(r.destajos)}{arrowOnly(r.destajos - r.prev.destajos)}</td>
                <td style={S.td}>{fmt(r.otros)}{arrowOnly(r.otros - r.prev.otros)}</td>
                <td style={S.td}>{fmt(c.total)}{arrowOnly(c.total - r.prevTotal)}</td>
                <td style={{ ...S.td, ...bbergStyle(varNeta) }}>
                  {fmtK(varNeta)}{arrow(varNeta)}
                </td>
                <td style={{ ...S.td, ...bbergStyle(pctCambio) }}>
                  {pctCambio > 0 ? "+" : pctCambio < 0 ? "−" : ""}
                  {Math.abs(pctCambio).toFixed(2)}%{arrow(pctCambio)}
                </td>
                <td style={S.td}>{c.pctVar.toFixed(1)}%</td>
                <td style={S.td}>{r.limite}%</td>
                <td style={S.td}>
                  {c.exceso ? (
                    <span style={S.badge("#fdecea")}>EXCEDIDO</span>
                  ) : (
                    <span style={S.badge("#e8f5e9")}>OK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={S.h3}>Autorización de Bonos</h3>
      <div style={S.card}>
        <p style={S.hint}>
          Cada bono requiere autorizador, medio de evidencia, y avanza por el workflow de aprobación.
          Arrastra una tarjeta entre columnas para moverla, o usa los botones. Las rechazadas pueden volver al pipeline.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 10 }}>
          {stages.map((s) => {
            const cards = bonos.filter((b) => b.stage === s.id);
            const isOver = dragOverStage === s.id;
            return (
              <div
                key={s.id}
                onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== s.id) setDragOverStage(s.id); }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverStage(null); }}
                onDrop={() => onDropStage(s.id)}
                style={{
                  background: isOver ? "#eef5ff" : "#f6f6f6",
                  borderRadius: 6,
                  padding: 8,
                  minHeight: 160,
                  outline: isOver ? "2px dashed #2563eb" : "none",
                  outlineOffset: -2,
                  transition: "background 0.12s",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#444", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>{s.label}</span>
                  <span style={{ background: "#fff", border: "1px solid #ccc", borderRadius: 10, padding: "0 6px", fontSize: 10 }}>{cards.length}</span>
                </div>
                {cards.map((b) => {
                  const sc = stageColor(b.estado);
                  const isDragging = draggedId === b.id;
                  return (
                    <div
                      key={b.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedId(b.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => { setDraggedId(null); setDragOverStage(null); }}
                      onClick={() => verBono(b)}
                      style={{
                        background: sc.bg,
                        border: `1px solid ${sc.border}`,
                        borderRadius: 5,
                        padding: 8,
                        marginBottom: 6,
                        fontSize: 11,
                        cursor: isDragging ? "grabbing" : "pointer",
                        opacity: isDragging ? 0.45 : 1,
                        boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <strong style={{ fontSize: 12 }}>{b.empleado}</strong>
                        <span style={{ fontWeight: 700 }}>{fmt(b.monto)}</span>
                      </div>
                      <div style={{ color: "#444", marginBottom: 2 }}>{b.area} · {b.tipo}</div>
                      <div style={{ color: "#666", fontSize: 10, marginBottom: 4 }}>
                        Solicita: {b.solicitante} ({b.gerenciaSolicitante})
                      </div>
                      <div style={{ color: "#666", fontSize: 10, marginBottom: 6 }}>
                        Autoriza: {b.autoriza} · {b.medioEvidencia}
                      </div>
                      {b.stage !== "final" ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); avanzar(b.id); }}
                            style={{ flex: 1, fontSize: 10, padding: "4px 6px", border: "1px solid #0a7d2c", background: "#0a7d2c", color: "#fff", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                          >
                            ✓ Avanzar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); rechazar(b.id); }}
                            style={{ flex: 1, fontSize: 10, padding: "4px 6px", border: "1px solid #b00020", background: "#fff", color: "#b00020", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {badgeEstado(b.estado)}
                          {b.estado === "Rechazado" && (
                            <span style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>arrastra para reabrir</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          <button style={S.btn} onClick={() => setModalOpen(true)}>+ Solicitar bono</button>
        </div>
      </div>

      {modalOpen && (
        <div
          onClick={cerrarModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              width: 720,
              maxWidth: "94vw",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "1px solid #ccc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Solicitud de Bono</h3>
              <button
                onClick={cerrarModal}
                style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: 16 }}>
              Toda solicitud requiere justificación documentada y entra a workflow de aprobación.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Empleado</label>
                <input
                  style={inputStyle}
                  value={form.empleado}
                  onChange={(e) => setForm({ ...form, empleado: e.target.value })}
                  placeholder="Nombre del colaborador"
                />
              </div>
              <div>
                <label style={labelStyle}>Área</label>
                <select
                  style={inputStyle}
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                >
                  {data.map((d) => (
                    <option key={d.area} value={d.area}>{d.area}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Monto ($)</label>
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="decimal"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: formatMonto(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select
                  style={inputStyle}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {tiposBono.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Justificación (mín. 80 caracteres)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={form.justificacion}
                onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
                placeholder="Describe el desempeño, contexto y razón del bono."
              />
              <div style={{ fontSize: 11, color: justLen < 80 ? "#b00020" : "#0a7d2c", marginTop: 2 }}>
                {justLen} / 80
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Impacto cuantificable</label>
              <input
                style={inputStyle}
                value={form.impacto}
                onChange={(e) => setForm({ ...form, impacto: e.target.value })}
                placeholder="Ej. cuenta cerrada $3.2M, NPS 92, ahorro $450K"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Evidencia (PDF o link a CRM)</label>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!dragOverFile) setDragOverFile(true); }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverFile(false); }}
                onDrop={handleDropFile}
                style={{
                  border: `2px dashed ${dragOverFile ? "#2563eb" : form.evidenciaArchivo ? "#0a7d2c" : "#ccc"}`,
                  borderRadius: 6,
                  padding: 14,
                  textAlign: "center",
                  background: dragOverFile ? "#eef5ff" : form.evidenciaArchivo ? "#f6fbf6" : "#fafafa",
                  fontSize: 12,
                  color: "#444",
                  transition: "all 0.12s",
                }}
              >
                {form.evidenciaArchivo ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>📎</span>
                      <strong>{form.evidenciaArchivo}</strong>
                    </span>
                    <button
                      onClick={() => setForm({ ...form, evidenciaArchivo: "" })}
                      style={{ border: "1px solid #ccc", background: "#fff", borderRadius: 3, fontSize: 11, padding: "2px 8px", cursor: "pointer" }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>📥</div>
                    <div style={{ fontWeight: 600 }}>Arrastra un PDF aquí</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>(contrato firmado, encuesta NPS, evidencia formal)</div>
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 4px", fontSize: 11, color: "#888" }}>
                <div style={{ flex: 1, height: 1, background: "#eee" }} />
                <span>o pega un link al CRM</span>
                <div style={{ flex: 1, height: 1, background: "#eee" }} />
              </div>
              <input
                style={inputStyle}
                value={form.evidencia}
                onChange={(e) => setForm({ ...form, evidencia: e.target.value })}
                placeholder="https://crm.empresa.com/oportunidad/..."
              />
            </div>

            {/* Sección: Solicita / Autoriza */}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#222" }}>SOLICITA / AUTORIZA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Solicita (nombre)</label>
                  <input
                    style={inputStyle}
                    value={form.solicitante}
                    onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                    placeholder="Quien solicita el bono"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gerencia solicitante</label>
                  <select
                    style={inputStyle}
                    value={form.gerenciaSolicitante}
                    onChange={(e) => setForm({ ...form, gerenciaSolicitante: e.target.value })}
                  >
                    {data.map((d) => (
                      <option key={d.area} value={d.area}>{d.area}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Autoriza (nombre)</label>
                  <input
                    style={inputStyle}
                    value={form.autoriza}
                    onChange={(e) => setForm({ ...form, autoriza: e.target.value })}
                    placeholder="Quien autoriza"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Medio de evidencia</label>
                  <select
                    style={inputStyle}
                    value={form.medioEvidencia}
                    onChange={(e) => setForm({ ...form, medioEvidencia: e.target.value })}
                  >
                    {mediosEvidencia.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>
                El medio de evidencia es donde queda registrada la autorización (correo, firma electrónica, memorándum, etc.) para auditoría.
              </div>
            </div>

            {/* Indicadores en vivo */}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#222" }}>VALIDACIONES EN VIVO</div>

              {/* Semáforo de límite del área */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid ${semaforoArea === "red" ? "#b00020" : semaforoArea === "yellow" ? "#b58900" : "#ccc"}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                  background: semaforoArea === "red" ? "#fdecea" : semaforoArea === "yellow" ? "#fff7e0" : "#f6fbf6",
                }}
              >
                <TrafficLight light={semaforoArea} />
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    Límite de compensación variable — {form.area}
                  </div>
                  {areaSel && (
                    <>
                      <div>
                        % variable actual: <strong>{((areaSel.comisiones + areaSel.bonos + areaSel.destajos + areaSel.otros) / (areaSel.base + areaSel.comisiones + areaSel.bonos + areaSel.destajos + areaSel.otros) * 100).toFixed(1)}%</strong>
                        {" → con este bono: "}
                        <strong style={{ color: semaforoArea === "red" ? "#b00020" : semaforoArea === "yellow" ? "#b58900" : "#0a7d2c" }}>
                          {newPctVarArea.toFixed(1)}%
                        </strong>
                        {" · Límite autorizado: "}<strong>{areaSel.limite}%</strong>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "#444" }}>
                        {semaforoArea === "red" && "⚠ Rebasa el monto autorizado del área. Requiere aprobación adicional."}
                        {semaforoArea === "yellow" && "Se acerca al límite. Revisar antes de autorizar."}
                        {semaforoArea === "green" && montoNum > 0 && "Dentro del rango autorizado."}
                        {montoNum <= 0 && "Captura el monto para validar."}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bonos previos del empleado */}
              {bonosDelEmpleado.length > 0 && (
                <div
                  style={{
                    background: bonosDelEmpleado.length >= 2 ? "#fdecea" : "#fff7e0",
                    border: `1px solid ${bonosDelEmpleado.length >= 2 ? "#b00020" : "#b58900"}`,
                    borderRadius: 6,
                    padding: 10,
                    marginBottom: 8,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {bonosDelEmpleado.length >= 2 ? "⚠ " : "ℹ "}
                    {form.empleado} ya tiene {bonosDelEmpleado.length} bono{bonosDelEmpleado.length > 1 ? "s" : ""} en el sistema · Total previo: {fmt(totalPrevioEmpleado)}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: "#444" }}>
                    {bonosDelEmpleado.map((b) => (
                      <li key={b.id}>
                        {b.fecha} · {fmt(b.monto)} · {b.tipo} · <em>{b.estado}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bonos del mes por gerencia solicitante con semáforo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: semaforoGerencia === "red" ? "#fdecea" : semaforoGerencia === "yellow" ? "#fff7e0" : "#f6fbf6",
                  border: `1px solid ${semaforoGerencia === "red" ? "#b00020" : semaforoGerencia === "yellow" ? "#b58900" : "#ccc"}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <TrafficLight light={semaforoGerencia} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    Gerencia "{form.gerenciaSolicitante}" — bonos solicitados este mes
                  </div>
                  <div style={{ marginBottom: warningsGerencia.length > 0 ? 6 : 0 }}>
                    <strong>{bonosGerencia.length}</strong> solicitud{bonosGerencia.length === 1 ? "" : "es"} · Total: <strong>{fmt(totalGerencia)}</strong>
                  </div>
                  {warningsGerencia.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: semaforoGerencia === "red" ? "#b00020" : "#7a5a00" }}>
                      {warningsGerencia.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {warningsGerencia.length === 0 && (
                    <div style={{ fontSize: 11, color: "#0a7d2c" }}>Dentro de política · sin alertas.</div>
                  )}
                </div>
              </div>

              {/* Workflow stepper */}
              <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Workflow de aprobación requerido</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    const n = montoNum;
                    const pasos = ["Solicitud", "Gerente"];
                    if (n >= 25000) pasos.push("Director");
                    if (n > 75000) pasos.push("CEO + RRHH");
                    pasos.push("Final");
                    return pasos.map((p, i) => (
                      <span key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 14,
                          background: i === 0 ? "#000" : "#eee",
                          color: i === 0 ? "#fff" : "#333",
                          border: "1px solid #ccc",
                          fontSize: 11,
                          fontWeight: 600,
                        }}>{p}</span>
                        {i < pasos.length - 1 && <span style={{ color: "#999" }}>→</span>}
                      </span>
                    ));
                  })()}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                  Según el monto ({fmt(montoNum)}) → {aprobadoresPara(montoNum)}
                </div>
              </div>
            </div>

            {/* Errores */}
            {errores.length > 0 && (
              <ul style={{ background: "#fdecea", border: "1px solid #b00020", borderRadius: 4, padding: "8px 8px 8px 28px", fontSize: 12, color: "#b00020", marginBottom: 12 }}>
                {errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                style={{
                  ...S.btnGhost,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  borderColor: "#c2410c",
                  color: "#c2410c",
                }}
                onClick={() => {
                  const asunto = `Solicitud de bono · ${form.empleado || "(empleado)"} · $${(parseInt(String(form.monto).replace(/[^0-9]/g, "")) || 0).toLocaleString("es-MX")}`;
                  const cuerpo = [
                    `Solicito autorización del siguiente bono:`,
                    ``,
                    `Empleado: ${form.empleado || "(pendiente)"}`,
                    `Área: ${form.area}`,
                    `Monto: $${(parseInt(String(form.monto).replace(/[^0-9]/g, "")) || 0).toLocaleString("es-MX")}`,
                    `Tipo: ${form.tipo}`,
                    ``,
                    `Justificación:`,
                    `${form.justificacion || "(pendiente)"}`,
                    ``,
                    `Impacto medible:`,
                    `${form.impacto || "(pendiente)"}`,
                    ``,
                    `Evidencia:`,
                    `${form.evidencia || "(pendiente)"}`,
                    ``,
                    `Solicitante: ${form.solicitante || "(pendiente)"} · ${form.gerenciaSolicitante}`,
                    `Autoriza: ${form.autoriza || "(por confirmar)"}`,
                    `Medio de evidencia: ${form.medioEvidencia}`,
                    ``,
                    `--`,
                    `Enviado desde el Tablero de Control RRHH`,
                  ].join("%0D%0A");
                  const destinatarios = "compensaciones@empresa.com.mx";
                  const cc = "rh@empresa.com.mx";
                  window.location.href = `mailto:${destinatarios}?cc=${cc}&subject=${encodeURIComponent(asunto)}&body=${cuerpo}`;
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Mandar solicitud por correo
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnGhost} onClick={cerrarModal}>Cancelar</button>
                <button
                  style={{ ...S.btn, opacity: errores.length > 0 ? 0.4 : 1, cursor: errores.length > 0 ? "not-allowed" : "pointer" }}
                  onClick={enviarBono}
                  disabled={errores.length > 0}
                >
                  Enviar a aprobación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 2. CLIMA LABORAL
// =============================================================
const INSTRUMENTOS = [
  {
    id: "pulso-rapido",
    name: "Pulso rápido",
    desc: "1-3 preguntas, semanal",
    estDefault: "Activo",
    escala: "1-10",
    preguntas: [
      "¿Cómo te sientes esta semana? (1-10)",
      "¿Tienes lo que necesitas para hacer tu trabajo? (Sí/No)",
      "¿Te sientes reconocido por tu jefe directo? (1-5)",
    ],
    resultado: {
      score: "7.2 / 10",
      respuestas: "168 / 248",
      distribucion: [
        { pregunta: "¿Cómo te sientes esta semana?", barras: [{ label: "1-3", pct: 8 }, { label: "4-6", pct: 22 }, { label: "7-8", pct: 48 }, { label: "9-10", pct: 22 }] },
        { pregunta: "¿Tienes lo que necesitas para tu trabajo?", barras: [{ label: "Sí", pct: 71 }, { label: "No", pct: 29 }] },
        { pregunta: "¿Te sientes reconocido por tu jefe?", barras: [{ label: "1-2", pct: 14 }, { label: "3", pct: 28 }, { label: "4-5", pct: 58 }] },
      ],
    },
  },
  {
    id: "compromiso",
    name: "Encuesta de compromiso",
    desc: "5 preguntas (Engagement)",
    estDefault: "Plantilla",
    escala: "1-5",
    preguntas: [
      "¿Recomendarías a un amigo trabajar aquí? (1-10)",
      "¿Sientes que tu trabajo tiene propósito? (1-5)",
      "¿Tienes oportunidades de crecimiento? (1-5)",
      "¿Confías en el liderazgo de tu área? (1-5)",
      "¿Te sientes respetado por tus compañeros? (1-5)",
    ],
    resultado: {
      score: "7.0 / 10",
      respuestas: "201 / 248",
      distribucion: [
        { pregunta: "¿Recomendarías a un amigo trabajar aquí?", barras: [{ label: "Detractor", pct: 24 }, { label: "Pasivo", pct: 34 }, { label: "Promotor", pct: 42 }] },
        { pregunta: "Propósito en el trabajo", barras: [{ label: "1-2", pct: 12 }, { label: "3", pct: 30 }, { label: "4-5", pct: 58 }] },
        { pregunta: "Oportunidades de crecimiento", barras: [{ label: "1-2", pct: 22 }, { label: "3", pct: 38 }, { label: "4-5", pct: 40 }] },
        { pregunta: "Confianza en liderazgo", barras: [{ label: "1-2", pct: 18 }, { label: "3", pct: 32 }, { label: "4-5", pct: 50 }] },
        { pregunta: "Respeto entre compañeros", barras: [{ label: "1-2", pct: 8 }, { label: "3", pct: 22 }, { label: "4-5", pct: 70 }] },
      ],
    },
  },
  {
    id: "360",
    name: "Evaluación 360°",
    desc: "Multi-evaluador formal",
    estDefault: "Plantilla",
    escala: "1-5",
    soloVer: true,
    preguntas: [
      "Liderazgo y dirección (1-5)",
      "Comunicación efectiva (1-5)",
      "Colaboración y trabajo en equipo (1-5)",
      "Toma de decisiones (1-5)",
      "Desarrollo de talento (1-5)",
      "Resultados y ejecución (1-5)",
    ],
    resultado360: {
      evaluado: "L. Martínez",
      puesto: "Gerente Comercial",
      ciclo: "Q1 2026",
      totalEvaluadores: 8,
      desglose: "1 jefe · 3 pares · 3 equipo · auto",
      escala: 5,
      competencias: [
        { nombre: "Liderazgo y dirección",       auto: 4.0, pares: 3.9, equipo: 4.2, jefe: 4.1 },
        { nombre: "Comunicación efectiva",       auto: 3.9, pares: 4.1, equipo: 3.75, jefe: 4.0 },
        { nombre: "Colaboración y trabajo en equipo", auto: 4.2, pares: 4.4, equipo: 4.3, jefe: 4.25 },
        { nombre: "Toma de decisiones",          auto: 4.4, pares: 3.7, equipo: 3.5, jefe: 3.9 },
        { nombre: "Desarrollo de talento",       auto: 3.5, pares: 3.9, equipo: 4.2, jefe: 4.0 },
        { nombre: "Resultados y ejecución",      auto: 4.3, pares: 4.2, equipo: 4.1, jefe: 4.4 },
      ],
      comentarios: [
        { rater: "Pares", texto: "Excelente para alinear al equipo en momentos críticos. Podría delegar más decisiones operativas." },
        { rater: "Equipo", texto: "Es accesible y nos respalda con dirección. Nos gustaría tener más espacio para proponer iniciativas." },
        { rater: "Jefe", texto: "Sólida ejecución comercial. Trabajar en visión a 12-18 meses, no solo trimestre." },
      ],
    },
  },
  {
    id: "salida",
    name: "Encuesta de salida",
    desc: "Exit interview estructurada",
    estDefault: "Plantilla",
    escala: "abiertas",
    individual: true,
    preguntas: [
      "Razón principal de salida",
      "¿Recomendarías a un amigo trabajar aquí? (1-10)",
      "¿Qué pudo haber sido mejor?",
      "¿Cómo fue tu relación con tu jefe directo? (1-5)",
      "¿Recibiste el onboarding y desarrollo esperados? (Sí/No)",
    ],
    resultado: {
      score: "6.4 / 10",
      respuestas: "12 / 12",
      distribucion: [
        { pregunta: "Razón principal de salida", barras: [{ label: "Sueldo", pct: 33 }, { label: "Jefe", pct: 25 }, { label: "Crecimiento", pct: 25 }, { label: "Otro", pct: 17 }] },
        { pregunta: "¿Recomendarías la empresa?", barras: [{ label: "Detractor", pct: 42 }, { label: "Pasivo", pct: 33 }, { label: "Promotor", pct: 25 }] },
        { pregunta: "Relación con jefe directo", barras: [{ label: "1-2", pct: 25 }, { label: "3", pct: 33 }, { label: "4-5", pct: 42 }] },
        { pregunta: "¿Onboarding adecuado?", barras: [{ label: "Sí", pct: 58 }, { label: "No", pct: 42 }] },
      ],
    },
    casoEjemplo: {
      empleado: "M. Hernández",
      area: "Comercial",
      puesto: "Ejecutivo de cuenta sr.",
      jefe: "L. Martínez",
      fechaIngreso: "2023-08-15",
      fechaBaja: "2026-04-18",
      antiguedad: "2 años 8 meses",
      razonPrelim: "Sueldo / compensación",
      enviadaPor: "Correo",
      estado: "Completada",
      scoreCaso: "6 / 10",
      respuestas: [
        { pregunta: "Razón principal de salida", respuesta: "Recibí una oferta con +30% de compensación y mejores prestaciones." },
        { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "6 — Equipo bueno, pero el techo salarial es bajo y los aumentos llegan tarde." },
        { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Plan de carrera más claro, rangos salariales públicos y promociones con base en evidencia, no en antigüedad." },
        { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "4 — Me apoyó en momentos clave; me hubiera gustado más feedback frecuente." },
        { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí. Desarrollo parcial — capacitación formal nunca arrancó tras el primer año." },
      ],
      alertas: ["3ª salida de Comercial este Q por motivo salarial — escalar a Compensaciones para revisar banda."],
    },
  },
  {
    id: "bienvenida",
    name: "Encuesta de bienvenida",
    desc: "Día 30 / 60 / 90",
    estDefault: "Plantilla",
    escala: "1-5",
    individual: true,
    preguntas: [
      "¿Qué tan bien recibiste el onboarding? (1-5)",
      "¿Tienes claridad de tu rol y objetivos? (1-5)",
      "¿Tu equipo te ha hecho sentir bienvenido? (1-5)",
      "¿Tienes las herramientas que necesitas? (Sí/No)",
      "¿Recomendarías unirse a la empresa? (1-10)",
    ],
    resultado: {
      score: "4.2 / 5",
      respuestas: "18 / 22",
      distribucion: [
        { pregunta: "Onboarding", barras: [{ label: "1-2", pct: 6 }, { label: "3", pct: 22 }, { label: "4-5", pct: 72 }] },
        { pregunta: "Claridad de rol", barras: [{ label: "1-2", pct: 11 }, { label: "3", pct: 28 }, { label: "4-5", pct: 61 }] },
        { pregunta: "Sentirse bienvenido", barras: [{ label: "1-2", pct: 0 }, { label: "3", pct: 17 }, { label: "4-5", pct: 83 }] },
        { pregunta: "¿Tienes herramientas?", barras: [{ label: "Sí", pct: 78 }, { label: "No", pct: 22 }] },
        { pregunta: "¿Recomendarías?", barras: [{ label: "Detractor", pct: 11 }, { label: "Pasivo", pct: 28 }, { label: "Promotor", pct: 61 }] },
      ],
    },
    casoEjemplo: {
      empleado: "J. Castillo",
      area: "Comercial",
      puesto: "Ejecutivo de cuenta jr.",
      jefe: "L. Martínez",
      fechaIngreso: "2026-02-14",
      checkpoint: "Día 60",
      enviadaPor: "WhatsApp",
      estado: "Completada",
      scoreCaso: "4.0 / 5",
      respuestas: [
        { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — Buen recibimiento del equipo, materiales claros." },
        { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Las cuotas cambiaron 2 veces en los primeros 30 días, eso confunde." },
        { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "5 — El equipo me adoptó desde el día 1, muy buen ambiente." },
        { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "No — Acceso parcial al CRM y falta licencia de Sales Navigator." },
        { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "8" },
      ],
      alertas: ["Falta licencia de Sales Navigator — ticket #4521 abierto con TI hace 45 días."],
    },
  },
  {
    id: "eventos",
    name: "Pulso de eventos",
    desc: "Tras cambio importante",
    estDefault: "Plantilla",
    escala: "1-5",
    preguntas: [
      "¿Qué tan bien entiendes el cambio? (1-5)",
      "¿Cómo te sientes respecto al cambio? (1-5)",
      "¿Tienes el apoyo que necesitas? (Sí/No)",
      "¿Qué te preocupa más? (abierta)",
    ],
    resultado: {
      score: "3.6 / 5",
      respuestas: "182 / 248",
      distribucion: [
        { pregunta: "Comprensión del cambio", barras: [{ label: "1-2", pct: 18 }, { label: "3", pct: 35 }, { label: "4-5", pct: 47 }] },
        { pregunta: "Sentir sobre el cambio", barras: [{ label: "1-2", pct: 22 }, { label: "3", pct: 40 }, { label: "4-5", pct: 38 }] },
        { pregunta: "Apoyo recibido", barras: [{ label: "Sí", pct: 62 }, { label: "No", pct: 38 }] },
      ],
    },
  },
];

const AREAS_LIST = ["Toda la empresa", "Comercial", "Posventa", "Operaciones", "Administración", "Dirección"];

// 12 gerentes y directores activos con ciclo 360° completado o en curso
const EVALUADOS_360 = [
  {
    evaluado: "L. Martínez", puesto: "Gerente Comercial", area: "Comercial", jefe: "F. Domínguez (Dir. Comercial Norte)",
    ciclo: "Q1 2026", totalEvaluadores: 8, desglose: "1 jefe · 3 pares · 3 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.0, pares: 3.9, equipo: 4.2, jefe: 4.1 },
      { nombre: "Comunicación efectiva",        auto: 3.9, pares: 4.1, equipo: 3.75, jefe: 4.0 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.2, pares: 4.4, equipo: 4.3, jefe: 4.25 },
      { nombre: "Toma de decisiones",           auto: 4.4, pares: 3.7, equipo: 3.5, jefe: 3.9 },
      { nombre: "Desarrollo de talento",        auto: 3.5, pares: 3.9, equipo: 4.2, jefe: 4.0 },
      { nombre: "Resultados y ejecución",       auto: 4.3, pares: 4.2, equipo: 4.1, jefe: 4.4 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Excelente para alinear al equipo en momentos críticos. Podría delegar más decisiones operativas." },
      { rater: "Equipo", texto: "Es accesible y nos respalda con dirección. Nos gustaría tener más espacio para proponer iniciativas." },
      { rater: "Jefe", texto: "Sólida ejecución comercial. Trabajar en visión a 12-18 meses, no solo trimestre." },
    ],
  },
  {
    evaluado: "R. Solís", puesto: "Gerente de Finanzas", area: "Administración", jefe: "S. Ramírez (Dir. Administrativo)",
    ciclo: "Q1 2026", totalEvaluadores: 7, desglose: "1 jefe · 3 pares · 2 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 3.5, pares: 3.4, equipo: 3.2, jefe: 3.6 },
      { nombre: "Comunicación efectiva",        auto: 3.2, pares: 3.0, equipo: 2.9, jefe: 3.1 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.8, pares: 3.5, equipo: 3.4, jefe: 3.7 },
      { nombre: "Toma de decisiones",           auto: 4.5, pares: 4.3, equipo: 4.0, jefe: 4.4 },
      { nombre: "Desarrollo de talento",        auto: 3.0, pares: 2.8, equipo: 2.7, jefe: 3.0 },
      { nombre: "Resultados y ejecución",       auto: 4.7, pares: 4.6, equipo: 4.5, jefe: 4.7 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Rigor analítico excelente. A veces se traba en detalles y demora decisiones operativas." },
      { rater: "Equipo", texto: "Sabe muchísimo, pero la comunicación es seca. Cuesta acercarse a pedir feedback." },
      { rater: "Jefe", texto: "Owner técnico impecable. Plan de desarrollo: habilidades blandas y mentoría a su equipo." },
    ],
  },
  {
    evaluado: "G. Pérez", puesto: "Gerente Comercial Centro", area: "Comercial", jefe: "L. Martínez (Gte. Comercial)",
    ciclo: "Q1 2026", totalEvaluadores: 9, desglose: "1 jefe · 3 pares · 4 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.6, pares: 3.8, equipo: 3.2, jefe: 4.0 },
      { nombre: "Comunicación efectiva",        auto: 4.2, pares: 3.5, equipo: 2.8, jefe: 3.6 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.0, pares: 3.2, equipo: 2.9, jefe: 3.4 },
      { nombre: "Toma de decisiones",           auto: 4.5, pares: 4.0, equipo: 3.5, jefe: 4.1 },
      { nombre: "Desarrollo de talento",        auto: 3.8, pares: 3.0, equipo: 2.5, jefe: 3.2 },
      { nombre: "Resultados y ejecución",       auto: 4.8, pares: 4.5, equipo: 4.2, jefe: 4.6 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Top performer en cuota, pero su estilo demandante deja heridos en el equipo." },
      { rater: "Equipo", texto: "Cumple resultado pero al precio del bienestar. 4 bajas voluntarias de su equipo en 6 meses." },
      { rater: "Jefe", texto: "Resultados brillantes. Urge plan de coaching en liderazgo de personas — costo de rotación está siendo alto." },
    ],
  },
  {
    evaluado: "L. Cano", puesto: "Gerente de Posventa", area: "Posventa", jefe: "C. Mendoza (Dir. Operaciones)",
    ciclo: "Q4 2025", totalEvaluadores: 10, desglose: "1 jefe · 3 pares · 5 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.0, pares: 3.0, equipo: 2.3, jefe: 2.8 },
      { nombre: "Comunicación efectiva",        auto: 3.8, pares: 2.8, equipo: 2.1, jefe: 2.7 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.5, pares: 2.5, equipo: 2.0, jefe: 2.5 },
      { nombre: "Toma de decisiones",           auto: 4.2, pares: 3.2, equipo: 2.8, jefe: 3.0 },
      { nombre: "Desarrollo de talento",        auto: 3.5, pares: 2.4, equipo: 1.8, jefe: 2.3 },
      { nombre: "Resultados y ejecución",       auto: 4.3, pares: 3.5, equipo: 3.1, jefe: 3.4 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Conoce profundamente la operación, pero el clima en sus talleres es preocupante." },
      { rater: "Equipo", texto: "Trato hostil y desigualdad en asignación de órdenes. 5 bajas voluntarias en taller Sur en 8 meses." },
      { rater: "Jefe", texto: "Brecha alta entre autoevaluación y resto. Intervención de clima en marcha. Plan de acción a 90 días." },
    ],
  },
  {
    evaluado: "M. Vargas", puesto: "Supervisor de Turno 2", area: "Operaciones", jefe: "C. Mendoza (Dir. Operaciones)",
    ciclo: "Q1 2026", totalEvaluadores: 6, desglose: "1 jefe · 1 par · 3 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 3.5, pares: 3.0, equipo: 3.2, jefe: 3.0 },
      { nombre: "Comunicación efectiva",        auto: 3.2, pares: 3.0, equipo: 3.3, jefe: 3.0 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.8, pares: 3.5, equipo: 3.7, jefe: 3.5 },
      { nombre: "Toma de decisiones",           auto: 3.0, pares: 2.7, equipo: 2.8, jefe: 2.8 },
      { nombre: "Desarrollo de talento",        auto: 3.5, pares: 2.8, equipo: 3.0, jefe: 2.9 },
      { nombre: "Resultados y ejecución",       auto: 3.6, pares: 3.2, equipo: 3.3, jefe: 3.2 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Joven en el rol, todavía consolida autoridad. Buena disposición a aprender." },
      { rater: "Equipo", texto: "Es justo y nos escucha. A veces no defiende decisiones ante presión de Dirección." },
      { rater: "Jefe", texto: "Promesa de talento. Pasar por Programa de Liderazgo de Piso (cohorte H2 2026)." },
    ],
  },
  {
    evaluado: "C. Mendoza", puesto: "Director de Operaciones", area: "Operaciones", jefe: "Dirección General",
    ciclo: "Q4 2025", totalEvaluadores: 11, desglose: "1 jefe · 4 pares · 5 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.5, pares: 4.4, equipo: 4.6, jefe: 4.5 },
      { nombre: "Comunicación efectiva",        auto: 4.3, pares: 4.2, equipo: 4.5, jefe: 4.4 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.5, pares: 4.6, equipo: 4.7, jefe: 4.6 },
      { nombre: "Toma de decisiones",           auto: 4.4, pares: 4.5, equipo: 4.3, jefe: 4.5 },
      { nombre: "Desarrollo de talento",        auto: 4.0, pares: 4.3, equipo: 4.5, jefe: 4.4 },
      { nombre: "Resultados y ejecución",       auto: 4.6, pares: 4.5, equipo: 4.6, jefe: 4.7 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Referente del comité. Equilibra resultados y desarrollo de gente como pocos." },
      { rater: "Equipo", texto: "Crea espacio para que crezcamos. Nos defiende ante otras áreas." },
      { rater: "Jefe", texto: "Listo para responsabilidades más grandes. Plan de sucesión a Dirección General iniciado." },
    ],
  },
  {
    evaluado: "A. Herrera", puesto: "Director de Tecnología", area: "Dirección", jefe: "Dirección General",
    ciclo: "Q1 2026", totalEvaluadores: 8, desglose: "1 jefe · 3 pares · 3 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.2, pares: 3.6, equipo: 3.4, jefe: 3.7 },
      { nombre: "Comunicación efectiva",        auto: 3.5, pares: 2.8, equipo: 2.7, jefe: 2.9 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.8, pares: 3.0, equipo: 3.5, jefe: 3.2 },
      { nombre: "Toma de decisiones",           auto: 4.6, pares: 4.3, equipo: 4.4, jefe: 4.4 },
      { nombre: "Desarrollo de talento",        auto: 4.0, pares: 3.5, equipo: 4.0, jefe: 3.6 },
      { nombre: "Resultados y ejecución",       auto: 4.7, pares: 4.5, equipo: 4.5, jefe: 4.6 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Visión técnica excepcional. La traducción al lenguaje del negocio es el cuello de botella." },
      { rater: "Equipo", texto: "Nos respalda técnicamente. Los temas de personas no son su fuerte — los esquiva." },
      { rater: "Jefe", texto: "Activo crítico. Plan de desarrollo: comunicación ejecutiva y storytelling con negocio." },
    ],
  },
  {
    evaluado: "P. Castaño", puesto: "Gerente de Recursos Humanos", area: "Administración", jefe: "S. Ramírez (Dir. Administrativo)",
    ciclo: "Q1 2026", totalEvaluadores: 9, desglose: "1 jefe · 4 pares · 3 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 3.8, pares: 3.5, equipo: 3.7, jefe: 3.6 },
      { nombre: "Comunicación efectiva",        auto: 4.2, pares: 4.0, equipo: 4.3, jefe: 4.1 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.0, pares: 3.8, equipo: 4.1, jefe: 3.9 },
      { nombre: "Toma de decisiones",           auto: 3.5, pares: 3.2, equipo: 3.0, jefe: 3.3 },
      { nombre: "Desarrollo de talento",        auto: 4.3, pares: 4.1, equipo: 4.4, jefe: 4.2 },
      { nombre: "Resultados y ejecución",       auto: 3.5, pares: 3.0, equipo: 3.2, jefe: 3.1 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Empatía y escucha sobresalen. Cierra acciones lento — los planes de RH demoran trimestres." },
      { rater: "Equipo", texto: "Es la jefa más humana que hemos tenido. Necesitamos más músculo de ejecución arriba." },
      { rater: "Jefe", texto: "Rol estratégico. Reforzar disciplina de seguimiento y KPIs de RH (rotación, NPS interno)." },
    ],
  },
  {
    evaluado: "F. Domínguez", puesto: "Director Comercial Norte", area: "Comercial", jefe: "Dirección General",
    ciclo: "Q4 2025", totalEvaluadores: 10, desglose: "1 jefe · 4 pares · 4 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.5, pares: 3.5, equipo: 4.3, jefe: 4.4 },
      { nombre: "Comunicación efectiva",        auto: 4.3, pares: 3.4, equipo: 4.0, jefe: 4.1 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.8, pares: 2.8, equipo: 4.0, jefe: 3.5 },
      { nombre: "Toma de decisiones",           auto: 4.5, pares: 4.0, equipo: 4.4, jefe: 4.5 },
      { nombre: "Desarrollo de talento",        auto: 4.2, pares: 3.7, equipo: 4.3, jefe: 4.2 },
      { nombre: "Resultados y ejecución",       auto: 4.6, pares: 4.4, equipo: 4.5, jefe: 4.7 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Owner indiscutible de Comercial Norte. En comité a veces es difícil cerrar acuerdos cross-área con él." },
      { rater: "Equipo", texto: "Es nuestro defensor número uno. Crece a su gente sin pedir nada a cambio." },
      { rater: "Jefe", texto: "Resultados consistentes. Plan: trabajar colaboración horizontal con otras direcciones." },
    ],
  },
  {
    evaluado: "I. Salazar", puesto: "Gerente de Compras y Logística", area: "Operaciones", jefe: "C. Mendoza (Dir. Operaciones)",
    ciclo: "Q1 2026", totalEvaluadores: 7, desglose: "1 jefe · 2 pares · 3 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 3.8, pares: 3.5, equipo: 3.6, jefe: 3.5 },
      { nombre: "Comunicación efectiva",        auto: 3.5, pares: 3.3, equipo: 3.5, jefe: 3.4 },
      { nombre: "Colaboración y trabajo en equipo", auto: 3.6, pares: 3.7, equipo: 3.8, jefe: 3.7 },
      { nombre: "Toma de decisiones",           auto: 4.3, pares: 4.0, equipo: 4.0, jefe: 4.2 },
      { nombre: "Desarrollo de talento",        auto: 3.3, pares: 3.1, equipo: 3.0, jefe: 3.0 },
      { nombre: "Resultados y ejecución",       auto: 4.5, pares: 4.4, equipo: 4.3, jefe: 4.5 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Detallista y confiable. Cuesta sacarla del modo operativo a pensar a 18 meses." },
      { rater: "Equipo", texto: "Conoce a cada proveedor por nombre. Espacio para empoderarnos en decisiones diarias." },
      { rater: "Jefe", texto: "Sólida en operación. Plan: ejercicios de visión estratégica + KPIs de innovación." },
    ],
  },
  {
    evaluado: "E. Quintero", puesto: "Gerente de Marketing", area: "Comercial", jefe: "F. Domínguez (Dir. Comercial Norte)",
    ciclo: "Q1 2026", totalEvaluadores: 6, desglose: "1 jefe · 2 pares · 2 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.3, pares: 3.8, equipo: 4.2, jefe: 3.7 },
      { nombre: "Comunicación efectiva",        auto: 4.5, pares: 4.4, equipo: 4.6, jefe: 4.3 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.2, pares: 4.0, equipo: 4.3, jefe: 3.9 },
      { nombre: "Toma de decisiones",           auto: 3.5, pares: 3.0, equipo: 3.2, jefe: 2.8 },
      { nombre: "Desarrollo de talento",        auto: 4.0, pares: 3.8, equipo: 4.1, jefe: 3.7 },
      { nombre: "Resultados y ejecución",       auto: 3.5, pares: 2.8, equipo: 3.0, jefe: 2.7 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Creatividad y energía únicas en el comité. La disciplina de cierre/timeline es el reto." },
      { rater: "Equipo", texto: "Inspira y cree en nosotros. A veces los proyectos cambian de rumbo a mitad de camino." },
      { rater: "Jefe", texto: "Crítico fortalecer ejecución: KR trimestrales + revisión semanal de avance + sponsor del comité." },
    ],
  },
  {
    evaluado: "S. Ramírez", puesto: "Director Administrativo", area: "Dirección", jefe: "Dirección General",
    ciclo: "Q4 2025", totalEvaluadores: 10, desglose: "1 jefe · 4 pares · 4 equipo · auto", escala: 5,
    competencias: [
      { nombre: "Liderazgo y dirección",        auto: 4.0, pares: 4.1, equipo: 4.0, jefe: 4.2 },
      { nombre: "Comunicación efectiva",        auto: 4.0, pares: 4.0, equipo: 3.9, jefe: 4.1 },
      { nombre: "Colaboración y trabajo en equipo", auto: 4.2, pares: 4.4, equipo: 4.3, jefe: 4.3 },
      { nombre: "Toma de decisiones",           auto: 3.5, pares: 3.0, equipo: 3.2, jefe: 3.1 },
      { nombre: "Desarrollo de talento",        auto: 3.8, pares: 4.0, equipo: 4.1, jefe: 4.0 },
      { nombre: "Resultados y ejecución",       auto: 4.0, pares: 4.0, equipo: 3.9, jefe: 4.0 },
    ],
    comentarios: [
      { rater: "Pares", texto: "Dueño de procesos impecable. Aversión al riesgo lo lleva a sobre-analizar decisiones." },
      { rater: "Equipo", texto: "Respaldo total cuando hay tormenta. Querríamos más autonomía para movernos rápido." },
      { rater: "Jefe", texto: "Ancla del comité. Plan: framework decisional con timeboxing para acelerar definiciones." },
    ],
  },
];

// Bajas de los últimos 90 días con encuesta de salida aplicada
const BAJAS_SALIDA = [
  {
    empleado: "M. Hernández", area: "Comercial", puesto: "Ejecutivo de cuenta sr.", jefe: "L. Martínez",
    fechaIngreso: "2023-08-15", fechaBaja: "2026-04-18", antiguedad: "2 años 8 meses",
    razonPrelim: "Sueldo / compensación", enviadaPor: "Correo", estado: "Completada", scoreCaso: "6 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Recibí una oferta con +30% de compensación y mejores prestaciones." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "6 — Equipo bueno, pero el techo salarial es bajo y los aumentos llegan tarde." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Plan de carrera más claro, rangos salariales públicos y promociones con base en evidencia, no en antigüedad." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "4 — Me apoyó en momentos clave; me hubiera gustado más feedback frecuente." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí. Desarrollo parcial — capacitación formal nunca arrancó tras el primer año." },
    ],
    alertas: ["3ª salida de Comercial este Q por motivo salarial — escalar a Compensaciones para revisar banda."],
  },
  {
    empleado: "Javier Ortega", area: "Comercial", puesto: "Gerente Comercial Regional", jefe: "Dir. General",
    fechaIngreso: "2017-09-12", fechaBaja: "2026-03-22", antiguedad: "8 años 6 meses",
    razonPrelim: "Mejor oferta (competencia)", enviadaPor: "Presencial", estado: "Completada", scoreCaso: "7 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "OEM competidor con paquete +25% y oportunidad de Dirección Comercial Regional." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "7 — Buen aprendizaje pero techo de crecimiento bajo para perfiles senior." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Honestidad sobre el plan de sucesión. Llevo 2 años pidiendo promoción sin respuesta clara." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "5 — Excelente relación profesional con Dirección General." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Sí en mis primeros 4 años. Después se estancó." },
    ],
    alertas: ["Pérdida de talento crítico — cartera Tier-1 migrando. Revisar plan de retención de mandos."],
  },
  {
    empleado: "Beatriz Cordero", area: "Administración", puesto: "Asistente de RH Sr.", jefe: "Dir. RH",
    fechaIngreso: "2020-02-19", fechaBaja: "2026-03-12", antiguedad: "6 años 1 mes",
    razonPrelim: "Cambio de sector", enviadaPor: "Correo", estado: "Completada", scoreCaso: "7 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Migro a consultoría especializada en RH con paquete +30% y exposición a múltiples industrias." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "7 — Buena empresa, pero el área de RH necesita modernizarse." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Mayor inversión en HRIS y automatización. Tareas manuales saturan al equipo." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "5 — Mi jefa es excepcional, lo voy a extrañar." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Sí — incluso financiaron parte de mi certificación SHRM." },
    ],
    alertas: ["Sucesión no preparada. 3 procesos críticos requieren redistribución urgente."],
  },
  {
    empleado: "Alejandro Méndez", area: "Comercial", puesto: "Asesor Comercial Sr.", jefe: "G. Pérez",
    fechaIngreso: "2021-02-18", fechaBaja: "2026-03-12", antiguedad: "5 años 1 mes",
    razonPrelim: "Mejor oferta", enviadaPor: "Correo", estado: "Completada", scoreCaso: "5 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Migración a sector financiero con +20% y mejor estructura de comisiones." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "5 — Equipo bueno, pero el ritmo de G. Pérez quema y los aumentos no compensan." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Revisar la estructura de comisiones — bajamos cuota desde hace 2 años." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "3 — Exigente al extremo. Reconoce poco, exige mucho." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí. Desarrollo parcial — programa Sr no se completó." },
    ],
    alertas: ["Top performer perdido. Patrón con G. Pérez confirma diagnóstico 360°."],
  },
  {
    empleado: "Diana Castro", area: "Posventa", puesto: "Recepcionista de Servicio", jefe: "L. Cano",
    fechaIngreso: "2023-11-27", fechaBaja: "2026-04-03", antiguedad: "2 años 4 meses",
    razonPrelim: "Ambiente / falta de crecimiento", enviadaPor: "WhatsApp", estado: "Completada", scoreCaso: "3 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Pedí promoción a Coordinadora de Servicio, me dijeron 'no perfil'. No vi otro camino." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "3 — No al taller Sur. Hay favoritismo y trato dispar entre el equipo." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Liderazgo del jefe directo. La rotación del taller es por una sola persona." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "2 — Frío y selectivo en a quién apoya." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "No. Aprendí sola observando a las que llevan más tiempo." },
    ],
    alertas: ["3ª baja consecutiva del mismo taller con mismo motivo. Intervención de clima iniciada."],
  },
  {
    empleado: "Roberto Núñez", area: "Comercial", puesto: "Asesor Comercial Jr.", jefe: "G. Pérez",
    fechaIngreso: "2024-10-08", fechaBaja: "2026-04-20", antiguedad: "1 año 6 meses",
    razonPrelim: "Mejor oferta", enviadaPor: "Correo", estado: "Completada", scoreCaso: "6 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Distribuidor competidor me ofreció +15% para el mismo puesto." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "6 — Buena marca, pero sueldo Jr abajo del mercado." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Que la empresa hiciera contraoferta. Ni siquiera lo intentaron." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "3 — G. Pérez exige mucho a los Jr, casi sin coaching." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding parcial. Mi mentor (Alejandro) renunció a la par." },
    ],
    alertas: ["Banda salarial Jr requiere ajuste — 3 bajas en 6 meses con mismo motivo."],
  },
  {
    empleado: "Lucía Aguilar", area: "Comercial", puesto: "Asesor Comercial Jr.", jefe: "G. Pérez",
    fechaIngreso: "2024-01-14", fechaBaja: "2026-04-06", antiguedad: "2 años 3 meses",
    razonPrelim: "Sueldo debajo del mercado", enviadaPor: "Correo", estado: "Completada", scoreCaso: "4 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Otra empresa ofreció +25%. La mediana del mercado para mi perfil está $4K arriba." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "4 — Solo si te urge empleo. Para crecer, no es el lugar." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Banda salarial transparente y revisiones anuales sin pelear por ellas." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "3 — G. Pérez delega y desaparece, vuelve a presionar resultados." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí. Desarrollo no — 'estamos muy ocupados'." },
    ],
    alertas: ["Caso de negocio armado para Comité: subir banda Jr 8-12%."],
  },
  {
    empleado: "Karla Romero", area: "Posventa", puesto: "Asesor de Servicio", jefe: "L. Cano",
    fechaIngreso: "2024-07-07", fechaBaja: "2026-03-27", antiguedad: "1 año 8 meses",
    razonPrelim: "Ambiente del taller", enviadaPor: "WhatsApp", estado: "Completada", scoreCaso: "2 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Imposible seguir bajo el liderazgo actual del taller Sur." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "2 — Solo si NO es para el taller Sur." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Que RH actuara con los reportes que pasamos. Hubo señales suficientes." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "1 — Hostigamiento. Reporté 2 veces sin acción." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "No. Aprendí solo de mis compañeras." },
    ],
    alertas: ["Caso a escalar a Compliance. Patrón de reportes ignorados confirmado."],
  },
  {
    empleado: "Valeria Núñez", area: "Comercial", puesto: "Asesor Comercial Jr.", jefe: "G. Pérez",
    fechaIngreso: "2025-02-11", fechaBaja: "2026-04-15", antiguedad: "1 año 2 meses",
    razonPrelim: "Reubicación + mejor oferta", enviadaPor: "Correo", estado: "Completada", scoreCaso: "7 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Mi pareja se reubica a otra ciudad y un competidor allá me ofreció el mismo puesto con +15%." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "7 — Bueno para arrancar carrera comercial." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Esquema de trabajo remoto para puestos comerciales. Mi salida pudo evitarse." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "3 — G. Pérez es eficaz pero distante. Falta cercanía con Jr." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí. Desarrollo arrancó tarde." },
    ],
    alertas: ["Caso para abrir discusión de remoto en Comercial."],
  },
  {
    empleado: "Sofía Beltrán", area: "Operaciones", puesto: "Operador A", jefe: "C. Reyes (ex-Sup.)",
    fechaIngreso: "2025-07-15", fechaBaja: "2026-03-18", antiguedad: "8 meses",
    razonPrelim: "Desempeño en periodo de prueba", enviadaPor: "Presencial", estado: "Completada", scoreCaso: "5 / 10",
    respuestas: [
      { pregunta: "Razón principal de salida", respuesta: "Baja involuntaria. Reconozco que no alcancé la curva esperada en soldadura." },
      { pregunta: "¿Recomendarías a un amigo trabajar aquí? (1-10)", respuesta: "5 — Trato justo, pero el periodo de prueba es muy exigente sin suficiente capacitación previa." },
      { pregunta: "¿Qué pudo haber sido mejor?", respuesta: "Pruebas técnicas más realistas en selección. Hubiera identificado el mismatch antes." },
      { pregunta: "¿Cómo fue tu relación con tu jefe directo? (1-5)", respuesta: "4 — C. Reyes fue claro y me dio chances. La baja fue justa." },
      { pregunta: "¿Recibiste el onboarding y desarrollo esperados?", respuesta: "Onboarding sí (2 semanas). Desarrollo insuficiente para curva real del puesto." },
    ],
    alertas: ["Revisar pruebas técnicas de selección para soldadura."],
  },
];

// Ingresos de los últimos 90 días con encuesta de bienvenida aplicada (Día 30/60/90)
const INGRESOS_BIENVENIDA = [
  {
    empleado: "J. Castillo", area: "Comercial", puesto: "Ejecutivo de cuenta jr.", jefe: "L. Martínez",
    fechaIngreso: "2026-02-14", checkpoint: "Día 60", enviadaPor: "WhatsApp", estado: "Completada", scoreCaso: "4.0 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — Buen recibimiento del equipo, materiales claros." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Las cuotas cambiaron 2 veces en los primeros 30 días, eso confunde." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "5 — El equipo me adoptó desde el día 1, muy buen ambiente." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "No — Acceso parcial al CRM y falta licencia de Sales Navigator." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "8" },
    ],
    alertas: ["Falta licencia de Sales Navigator — ticket #4521 abierto con TI hace 45 días."],
  },
  {
    empleado: "M. Sánchez", area: "Comercial", puesto: "Asesor Comercial Sr.", jefe: "G. Pérez",
    fechaIngreso: "2026-02-24", checkpoint: "Día 60", enviadaPor: "Correo", estado: "Completada", scoreCaso: "3.4 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "3 — El primer día no había computadora lista, perdí casi 2 días esperando equipo." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Las cuotas se asignaron en mes 2; pasé los primeros 30 días sin meta clara." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "4 — Equipo amable, pero noto que están saturados (varias bajas recientes)." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí — pero tardaron 3 semanas en darme acceso al ERP." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "6" },
    ],
    alertas: ["Onboarding logístico fallido — equipo no listo el día 1. Acceso a sistemas demorado."],
  },
  {
    empleado: "A. Vargas", area: "Operaciones", puesto: "Operador B", jefe: "M. Vargas (Sup. Turno 2)",
    fechaIngreso: "2026-02-28", checkpoint: "Día 30", enviadaPor: "Presencial", estado: "Completada", scoreCaso: "4.4 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "5 — Excelente capacitación técnica con buddy asignado, muy claro." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "4 — Claros KPIs de turno desde el día 1." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "5 — Buen equipo de turno, todos colaborativos." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí — EPP completo entregado el primer día." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "9" },
    ],
    alertas: [],
  },
  {
    empleado: "L. Romo", area: "Posventa", puesto: "Mecánico A", jefe: "L. Cano",
    fechaIngreso: "2026-03-05", checkpoint: "Día 30", enviadaPor: "WhatsApp", estado: "Completada", scoreCaso: "3.0 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "3 — Aprendí en el camino, no hubo plan estructurado." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Me asignaron a taller Sur, sé qué hacer pero el ambiente es raro." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "3 — Compañeros sí. El jefe es muy seco con los nuevos." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "5 — A taller Sur no recomendaría." },
    ],
    alertas: ["Confirma diagnóstico de clima en taller Sur (L. Cano) — incluso ingresos perciben el problema."],
  },
  {
    empleado: "P. Ibarra", area: "Administración", puesto: "Auxiliar Contable", jefe: "R. Solís",
    fechaIngreso: "2026-03-10", checkpoint: "Día 30", enviadaPor: "Correo", estado: "Completada", scoreCaso: "4.2 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — Manual de procesos claro, buddy asignado." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "4 — KPIs definidos desde la 1ª semana." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "4 — Equipo profesional, formal pero amable." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí — todo listo desde el día 1." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "9" },
    ],
    alertas: [],
  },
  {
    empleado: "C. Bermúdez", area: "Comercial", puesto: "Asesor Comercial Jr.", jefe: "G. Pérez",
    fechaIngreso: "2026-03-15", checkpoint: "Día 60", enviadaPor: "Correo", estado: "Completada", scoreCaso: "3.2 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — Onboarding formal estuvo bien." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Cuotas reasignadas a mitad de Q, sin explicación clara." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "3 — Equipo desgastado por las bajas recientes; siento la presión." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "5 — Depende del equipo. Centro Comercial está bajo presión." },
    ],
    alertas: ["Ingreso reportando moral baja del equipo G. Pérez — confirma patrón identificado."],
  },
  {
    empleado: "T. Mendiola", area: "Posventa", puesto: "Recepcionista de Servicio", jefe: "L. Cano",
    fechaIngreso: "2026-03-22", checkpoint: "Día 60", enviadaPor: "WhatsApp", estado: "Completada", scoreCaso: "2.6 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "2 — No hubo onboarding formal, me 'subieron' a operar el día 2." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "2 — Nadie me explicó cómo se mide mi desempeño." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "4 — Compañeras sí. Jefe distante." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "No — sin acceso al sistema de citas, lo tramito a través de otra compañera." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "3 — A este taller, no." },
    ],
    alertas: ["Onboarding nulo en taller Sur. Confirma diagnóstico — escalar urgente a Operaciones."],
  },
  {
    empleado: "D. Robles", area: "Operaciones", puesto: "Operador A", jefe: "C. Reyes (ex-Sup.)",
    fechaIngreso: "2026-04-01", checkpoint: "Día 30", enviadaPor: "Presencial", estado: "Completada", scoreCaso: "4.6 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "5 — Programa formal de 2 semanas con buddy." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "5 — Indicadores claros y revisión semanal." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "4 — Equipo bueno, ritmo intenso." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "9" },
    ],
    alertas: [],
  },
  {
    empleado: "E. Castañeda", area: "Comercial", puesto: "Asesor Comercial Jr.", jefe: "L. Martínez (interino)",
    fechaIngreso: "2026-04-05", checkpoint: "Día 30", enviadaPor: "Correo", estado: "Completada", scoreCaso: "3.6 / 5",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — Bien estructurado, materiales nuevos del refresh 2026." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Cambio de jefe directo (Javier Ortega salió) generó confusión inicial." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "4 — Equipo en transición, pero respetuoso." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Sí." },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "7" },
    ],
    alertas: ["Ingreso impactado por la salida de Javier Ortega. Reasignación de jefe pendiente."],
  },
  {
    empleado: "B. Lozano", area: "Administración", puesto: "Asistente de RH", jefe: "P. Castaño",
    fechaIngreso: "2026-04-12", checkpoint: "Día 30", enviadaPor: "Correo", estado: "En curso", scoreCaso: "—",
    respuestas: [
      { pregunta: "¿Qué tan bien recibiste el onboarding? (1-5)", respuesta: "4 — En transición tras la salida de Beatriz Cordero." },
      { pregunta: "¿Tienes claridad de tu rol y objetivos? (1-5)", respuesta: "3 — Procesos en redefinición, hay zonas grises." },
      { pregunta: "¿Tu equipo te ha hecho sentir bienvenido? (1-5)", respuesta: "5 — Equipo muy receptivo." },
      { pregunta: "¿Tienes las herramientas que necesitas?", respuesta: "Pendiente de respuesta" },
      { pregunta: "¿Recomendarías unirse a la empresa? (1-10)", respuesta: "Pendiente" },
    ],
    alertas: ["Reemplazo de Beatriz Cordero — onboarding parcial por procesos en transferencia."],
  },
];

function Clima() {
  const [modal, setModal] = useState({ open: false, instrumento: null, mode: null });
  const [audiencia, setAudiencia] = useState("Toda la empresa");
  const [selected360Idx, setSelected360Idx] = useState(0);
  const [selectedSalidaIdx, setSelectedSalidaIdx] = useState(0);
  const [selectedBienvenidaIdx, setSelectedBienvenidaIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const fechaPlus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [fechaLimite, setFechaLimite] = useState(fechaPlus7);
  const [recordatorio, setRecordatorio] = useState(true);
  const [anonima, setAnonima] = useState(true);
  const [preguntasEditadas, setPreguntasEditadas] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [toastChannel, setToastChannel] = useState(null);
  const [empleadoForm, setEmpleadoForm] = useState({
    nombre: "",
    area: "Comercial",
    puesto: "",
    jefe: "",
    fechaIngreso: "",
    fechaBaja: "",
    razonPrelim: "Sueldo / compensación",
    checkpoint: "Día 30",
  });
  const [lanzamientos, setLanzamientos] = useState([
    { id: 1, instrumentoId: "pulso-rapido", instrumentoName: "Pulso semanal · S17", fecha: "21-abr", respuestas: "168/248", score: "7.2" },
    { id: 2, instrumentoId: "salida", instrumentoName: "Salida · M. Hernández", fecha: "18-abr", respuestas: "1/1", score: "—" },
    { id: 3, instrumentoId: "compromiso", instrumentoName: "Compromiso Q1", fecha: "03-mar", respuestas: "201/248", score: "7.0" },
  ]);

  const abrirModal = (instrumento, mode) => {
    setAudiencia("Toda la empresa");
    setFechaLimite(fechaPlus7);
    setRecordatorio(true);
    setAnonima(true);
    setPreguntasEditadas([...instrumento.preguntas]);
    setEditingIdx(null);
    setEditDraft("");
    setToastChannel(null);
    setEmpleadoForm({
      nombre: "",
      area: "Comercial",
      puesto: "",
      jefe: "",
      fechaIngreso: "",
      fechaBaja: instrumento.id === "salida" ? fechaHoy : "",
      razonPrelim: "Sueldo / compensación",
      checkpoint: "Día 30",
    });
    setModal({ open: true, instrumento, mode });
  };
  const cerrarModal = () => {
    setEditingIdx(null);
    setEditDraft("");
    setToastChannel(null);
    setModal({ open: false, instrumento: null, mode: null });
  };

  const iniciarEdicion = (idx) => {
    setEditingIdx(idx);
    setEditDraft(preguntasEditadas[idx]);
  };
  const guardarEdicion = () => {
    if (editingIdx === null) return;
    const texto = editDraft.trim();
    if (!texto) {
      // Reactivo vacío (p. ej. recién agregado): lo descartamos al guardar
      setPreguntasEditadas((prev) => prev.filter((_, i) => i !== editingIdx));
      setEditingIdx(null);
      setEditDraft("");
      return;
    }
    setPreguntasEditadas((prev) => prev.map((p, i) => (i === editingIdx ? texto : p)));
    setEditingIdx(null);
    setEditDraft("");
  };
  const cancelarEdicion = () => {
    // Si era un reactivo nuevo que quedó vacío, lo quitamos
    setPreguntasEditadas((prev) => prev.filter((p, i) => !(i === editingIdx && !p.trim())));
    setEditingIdx(null);
    setEditDraft("");
  };
  const eliminarPregunta = (idx) => {
    setPreguntasEditadas((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) { setEditingIdx(null); setEditDraft(""); }
  };
  const agregarPregunta = () => {
    const nuevoIdx = preguntasEditadas.length;
    setPreguntasEditadas((prev) => [...prev, ""]);
    setEditingIdx(nuevoIdx);
    setEditDraft("");
  };

  const camposIndividualValidos = () => {
    if (!modal.instrumento?.individual) return true;
    if (!empleadoForm.nombre.trim()) return false;
    if (!empleadoForm.jefe.trim()) return false;
    if (modal.instrumento.id === "bienvenida" && !empleadoForm.fechaIngreso) return false;
    if (modal.instrumento.id === "salida" && !empleadoForm.fechaBaja) return false;
    return true;
  };

  const lanzar = (canal) => {
    const ins = modal.instrumento;
    if (ins.individual && !camposIndividualValidos()) return;
    const fechaCorta = fechaHoy.slice(5).replace("-", "-") + "";
    const dia = fechaCorta.split("-")[1];
    const mesAbbr = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(fechaCorta.split("-")[0], 10) - 1];
    let sufijo;
    if (ins.individual) {
      const detalle = ins.id === "bienvenida" ? ` (${empleadoForm.checkpoint})` : "";
      sufijo = ` · ${empleadoForm.nombre.trim()}${detalle}`;
    } else {
      sufijo = audiencia === "Toda la empresa" ? "" : ` · ${audiencia}`;
    }
    const canalLbl = canal === "whatsapp" ? " (WhatsApp)" : canal === "correo" ? " (Correo)" : "";
    setLanzamientos((prev) => [
      {
        id: Date.now(),
        instrumentoId: ins.id,
        instrumentoName: `${ins.name}${sufijo}${canalLbl}`,
        fecha: `${dia}-${mesAbbr}`,
        respuestas: "0/—",
        score: "Pendiente",
      },
      ...prev,
    ]);
    if (canal) {
      setToastChannel(canal);
      setTimeout(() => { cerrarModal(); }, 1200);
    } else {
      cerrarModal();
    }
  };

  const esActivo = (ins) => ins.estDefault === "Activo" || lanzamientos.some((l) => l.instrumentoId === ins.id && l.score === "Pendiente");

  return (
    <div>
      <h2 style={S.h2}>Clima Laboral</h2>

      <div style={S.grid3}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Pulso semanal (último)</div>
            <div style={S.kpiValue}>7.2 / 10</div>
            <div style={S.kpiDelta(true)}>+0.3 vs semana anterior</div>
            <div style={S.kpiBenchmark("green")}>Meta: ≥7.0 · Excelente: ≥7.5</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>eNPS</div>
            <div style={S.kpiValue}>+18</div>
            <div style={S.kpiDelta(false)}>Promotores 42% / Detractores 24%</div>
            <div style={S.kpiBenchmark("yellow")}>Saludable: ≥+20 · Líder: ≥+30</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Tasa de respuesta</div>
            <div style={S.kpiValue}>68%</div>
            <div style={S.kpiDelta(true)}>168 / 248 colaboradores</div>
            <div style={S.kpiBenchmark("yellow")}>Meta: ≥75% · Mínimo válido: ≥60%</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
      </div>

      <h3 style={S.h3}>Tipos de instrumento</h3>
      <div style={S.grid3}>
        {INSTRUMENTOS.map((i) => {
          const activo = esActivo(i);
          return (
            <div key={i.id} style={S.card}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{i.name}</div>
              <div style={S.hint}>{i.desc}</div>
              <span style={S.badge(activo ? "#e8f5e9" : "#eee")}>{activo ? "Activo" : "Plantilla"}</span>
              <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
                {!i.soloVer && <button style={S.btn} onClick={() => abrirModal(i, "lanzar")}>Lanzar</button>}
                <button style={i.soloVer ? S.btn : S.btnGhost} onClick={() => abrirModal(i, "ver")}>Ver resultados</button>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={S.h3}>Resultados recientes</h3>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Instrumento</th>
            <th style={S.th}>Lanzado</th>
            <th style={S.th}>Respuestas</th>
            <th style={S.th}>Score</th>
            <th style={S.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {lanzamientos.map((l) => {
            const ins = INSTRUMENTOS.find((x) => x.id === l.instrumentoId);
            return (
              <tr key={l.id}>
                <td style={S.td}>{l.instrumentoName}</td>
                <td style={S.td}>{l.fecha}</td>
                <td style={S.td}>{l.respuestas}</td>
                <td style={S.td}>{l.score}</td>
                <td style={S.td}>
                  <button style={S.btnGhost} onClick={() => ins && abrirModal(ins, "ver")}>Ver</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {modal.open && modal.instrumento && (
        <div
          onClick={cerrarModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 8, padding: 24,
              width: 680, maxWidth: "94vw", maxHeight: "92vh", overflowY: "auto",
              border: "1px solid #ccc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {modal.instrumento.name} — {modal.mode === "lanzar" ? "Lanzar" : "Resultados"}
              </h3>
              <button
                onClick={cerrarModal}
                style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}
                aria-label="Cerrar"
              >×</button>
            </div>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: 16 }}>{modal.instrumento.desc}</p>

            {modal.mode === "lanzar" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 6 }}>
                    Preguntas ({preguntasEditadas.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {preguntasEditadas.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ color: "#666", minWidth: 16 }}>{i + 1}.</span>
                        {editingIdx === i ? (
                          <>
                            <input
                              type="text"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") guardarEdicion(); if (e.key === "Escape") cancelarEdicion(); }}
                              autoFocus
                              style={{ flex: 1, padding: "6px 8px", border: "1px solid #2563eb", borderRadius: 4, fontSize: 13 }}
                            />
                            <button
                              onClick={guardarEdicion}
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, padding: "5px 9px", border: "1px solid #0a7d2c", background: "#0a7d2c", color: "#fff", borderRadius: 3, cursor: "pointer" }}
                            >GUARDAR</button>
                            <button
                              onClick={cancelarEdicion}
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, padding: "5px 9px", border: "1px solid #ccc", background: "#fff", color: "#666", borderRadius: 3, cursor: "pointer" }}
                            >CANCELAR</button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1 }}>{p}</span>
                            <button
                              onClick={() => iniciarEdicion(i)}
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, padding: "5px 9px", border: "1px solid #ccc", background: "#fff", color: "#333", borderRadius: 3, cursor: "pointer" }}
                            >EDITAR</button>
                            <button
                              onClick={() => eliminarPregunta(i)}
                              title="Eliminar reactivo"
                              aria-label="Eliminar reactivo"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 7px", border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 3, cursor: "pointer" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={agregarPregunta}
                    disabled={editingIdx !== null}
                    style={{
                      marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
                      padding: "7px 12px", border: "1px dashed #94a3b8", background: "#fff",
                      color: editingIdx !== null ? "#cbd5e1" : "#475569", borderRadius: 4,
                      cursor: editingIdx !== null ? "not-allowed" : "pointer",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar reactivo
                  </button>
                </div>

                {modal.instrumento.individual && (() => {
                  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 4 };
                  const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };
                  const setF = (k, v) => setEmpleadoForm((prev) => ({ ...prev, [k]: v }));
                  const areasEmpresa = ["Comercial", "Posventa", "Operaciones", "Administración", "Dirección"];
                  return (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 14, marginBottom: 14, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#0f172a", marginBottom: 10 }}>
                        Datos del empleado
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={labelStyle}>Nombre del empleado *</div>
                          <input
                            type="text"
                            value={empleadoForm.nombre}
                            onChange={(e) => setF("nombre", e.target.value)}
                            placeholder="Nombre completo"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>Área *</div>
                          <select
                            value={empleadoForm.area}
                            onChange={(e) => setF("area", e.target.value)}
                            style={inputStyle}
                          >
                            {areasEmpresa.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={labelStyle}>Puesto</div>
                          <input
                            type="text"
                            value={empleadoForm.puesto}
                            onChange={(e) => setF("puesto", e.target.value)}
                            placeholder="Ej. Ejecutivo de cuenta"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>Jefe directo *</div>
                          <input
                            type="text"
                            value={empleadoForm.jefe}
                            onChange={(e) => setF("jefe", e.target.value)}
                            placeholder="Nombre del jefe"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>Fecha de ingreso{modal.instrumento.id === "bienvenida" ? " *" : ""}</div>
                          <input
                            type="date"
                            value={empleadoForm.fechaIngreso}
                            onChange={(e) => setF("fechaIngreso", e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        {modal.instrumento.id === "salida" && (
                          <>
                            <div>
                              <div style={labelStyle}>Fecha de baja *</div>
                              <input
                                type="date"
                                value={empleadoForm.fechaBaja}
                                onChange={(e) => setF("fechaBaja", e.target.value)}
                                style={inputStyle}
                              />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div style={labelStyle}>Razón preliminar de salida</div>
                              <select
                                value={empleadoForm.razonPrelim}
                                onChange={(e) => setF("razonPrelim", e.target.value)}
                                style={inputStyle}
                              >
                                {["Sueldo / compensación", "Crecimiento / desarrollo", "Jefe directo", "Carga / balance", "Cambio personal", "Otra oferta", "Otra"].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              {empleadoForm.razonPrelim === "Otra" && (
                                <div style={{ marginTop: 10 }}>
                                  <div style={labelStyle}>Explica la razón *</div>
                                  <textarea
                                    value={empleadoForm.razonPrelimOtra || ""}
                                    onChange={(e) => setF("razonPrelimOtra", e.target.value)}
                                    placeholder="Describe la razón específica de la salida del colaborador..."
                                    rows={3}
                                    style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontFamily: "inherit", lineHeight: 1.5 }}
                                    autoFocus
                                  />
                                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
                                    Esta explicación quedará registrada en el expediente del colaborador.
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {modal.instrumento.id === "bienvenida" && (
                          <div>
                            <div style={labelStyle}>Checkpoint *</div>
                            <select
                              value={empleadoForm.checkpoint}
                              onChange={(e) => setF("checkpoint", e.target.value)}
                              style={inputStyle}
                            >
                              {["Día 30", "Día 60", "Día 90"].map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {!modal.instrumento.individual && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 4 }}>
                        Audiencia
                      </div>
                      <select
                        value={audiencia}
                        onChange={(e) => setAudiencia(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
                      >
                        {AREAS_LIST.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={modal.instrumento.individual ? { gridColumn: "1 / -1" } : undefined}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 4 }}>
                      Fecha límite
                    </div>
                    <input
                      type="date"
                      value={fechaLimite}
                      onChange={(e) => setFechaLimite(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} />
                    Respuestas anónimas
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={recordatorio} onChange={(e) => setRecordatorio(e.target.checked)} />
                    Enviar recordatorio a los 3 días
                  </label>
                </div>

                {toastChannel && (
                  <div style={{
                    background: "#e8f5e9",
                    border: "1px solid #0a7d2c",
                    color: "#0a7d2c",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "10px 12px",
                    borderRadius: 4,
                    marginBottom: 12,
                  }}>
                    {(() => {
                      const destinatario = modal.instrumento.individual ? empleadoForm.nombre : audiencia;
                      if (toastChannel === "whatsapp") return `Encuesta enviada por WhatsApp a ${destinatario}`;
                      if (toastChannel === "correo") return `Encuesta enviada por correo a ${destinatario}`;
                      return null;
                    })()}
                  </div>
                )}

                {modal.instrumento.individual && !camposIndividualValidos() && (
                  <div style={{ fontSize: 12, color: "#b00020", marginBottom: 10 }}>
                    Completa los campos obligatorios (*) para enviar.
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 12 }}>
                  <button style={S.btnGhost} onClick={cerrarModal}>Cancelar</button>
                  <button
                    onClick={() => lanzar("correo")}
                    disabled={modal.instrumento.individual && !camposIndividualValidos()}
                    style={{
                      ...S.btnGhost,
                      borderColor: "#1e40af",
                      color: "#1e40af",
                      fontWeight: 700,
                      opacity: modal.instrumento.individual && !camposIndividualValidos() ? 0.4 : 1,
                      cursor: modal.instrumento.individual && !camposIndividualValidos() ? "not-allowed" : "pointer",
                    }}
                  >Enviar por correo</button>
                  <button
                    onClick={() => lanzar("whatsapp")}
                    disabled={modal.instrumento.individual && !camposIndividualValidos()}
                    style={{
                      ...S.btnGhost,
                      borderColor: "#0a7d2c",
                      color: "#0a7d2c",
                      fontWeight: 700,
                      opacity: modal.instrumento.individual && !camposIndividualValidos() ? 0.4 : 1,
                      cursor: modal.instrumento.individual && !camposIndividualValidos() ? "not-allowed" : "pointer",
                    }}
                  >Enviar por WhatsApp</button>
                  <button
                    onClick={() => lanzar(null)}
                    disabled={modal.instrumento.individual && !camposIndividualValidos()}
                    style={{
                      ...S.btn,
                      opacity: modal.instrumento.individual && !camposIndividualValidos() ? 0.4 : 1,
                      cursor: modal.instrumento.individual && !camposIndividualValidos() ? "not-allowed" : "pointer",
                    }}
                  >Lanzar (link directo)</button>
                </div>
              </>
            )}

            {modal.mode === "ver" && modal.instrumento.id === "360" && (() => {
              const r = EVALUADOS_360[selected360Idx];
              const raters = [
                { key: "auto",   label: "Auto",   color: "#475569", grad: "linear-gradient(180deg, #94a3b8 0%, #64748b 100%)" },
                { key: "pares",  label: "Pares",  color: "#0f172a", grad: "linear-gradient(180deg, #334155 0%, #1e293b 100%)" },
                { key: "equipo", label: "Equipo", color: "#7c2d12", grad: "linear-gradient(180deg, #c2410c 0%, #9a3412 100%)" },
                { key: "jefe",   label: "Jefe",   color: "#3f3f46", grad: "linear-gradient(180deg, #52525b 0%, #3f3f46 100%)" },
              ];
              const avgOtros = (c) => (c.pares + c.equipo + c.jefe) / 3;
              const promedioGlobal = (
                r.competencias.reduce((a, c) => a + (c.auto + c.pares + c.equipo + c.jefe) / 4, 0) / r.competencias.length
              );
              const fortalezas = [...r.competencias]
                .filter((c) => avgOtros(c) >= 4.0)
                .sort((a, b) => avgOtros(b) - avgOtros(a));
              const puntosCiegos = [...r.competencias]
                .map((c) => ({ ...c, gap: c.auto - avgOtros(c) }))
                .filter((c) => c.gap >= 0.3)
                .sort((a, b) => b.gap - a.gap);
              const fortalezasOcultas = [...r.competencias]
                .map((c) => ({ ...c, gap: avgOtros(c) - c.auto }))
                .filter((c) => c.gap >= 0.3)
                .sort((a, b) => b.gap - a.gap);
              return (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setPickerOpen(!pickerOpen)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "left", fontFamily: "inherit" }}
                      >
                        {r.evaluado}
                        <span style={{ fontSize: 11, color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Cambiar ▾</span>
                      </button>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.puesto} · {r.area} · Jefe: {r.jefe} · {r.ciclo}</div>
                      {pickerOpen && (
                        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#fff", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 8px 24px rgba(15,23,42,0.18)", zIndex: 200, minWidth: 320, maxHeight: 320, overflowY: "auto" }}>
                          <div style={{ ...S.kpiLabel, padding: "10px 12px 6px", borderBottom: "1px solid #f1f5f9" }}>Selecciona evaluado · {EVALUADOS_360.length} gerentes y directores</div>
                          {EVALUADOS_360.map((ev, i) => (
                            <div
                              key={i}
                              onClick={() => { setSelected360Idx(i); setPickerOpen(false); }}
                              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: i < EVALUADOS_360.length - 1 ? "1px solid #f1f5f9" : "none", background: i === selected360Idx ? "#eef5ff" : "#fff", fontSize: 13 }}
                              onMouseEnter={(e) => { if (i !== selected360Idx) e.currentTarget.style.background = "#f8fafc"; }}
                              onMouseLeave={(e) => { if (i !== selected360Idx) e.currentTarget.style.background = "#fff"; }}
                            >
                              <div style={{ fontWeight: 700 }}>{ev.evaluado}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{ev.puesto} · {ev.ciclo}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>Promedio global</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{promedioGlobal.toFixed(2)} / {r.escala}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                    <div style={S.kpi}>
                      <div style={S.kpiLabel}>Evaluadores</div>
                      <div style={S.kpiValue}>{r.totalEvaluadores}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.desglose}</div>
                    </div>
                    <div style={S.kpi}>
                      <div style={S.kpiLabel}>Competencias evaluadas</div>
                      <div style={S.kpiValue}>{r.competencias.length}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Escala 1–{r.escala}</div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                    {raters.map((rt) => (
                      <span key={rt.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#475569" }}>
                        <span style={{ width: 12, height: 12, background: rt.grad, borderRadius: 2 }} />
                        {rt.label}
                      </span>
                    ))}
                  </div>

                  {/* Competency table */}
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 10 }}>
                    Competencias por grupo de evaluador
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 18 }}>
                    {r.competencias.map((c, idx) => {
                      const avgC = (c.auto + c.pares + c.equipo + c.jefe) / 4;
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{c.nombre}</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                              Prom <strong style={{ color: "#0f172a" }}>{avgC.toFixed(2)}</strong>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {raters.map((rt) => {
                              const val = c[rt.key];
                              const widthPct = (val / r.escala) * 100;
                              return (
                                <div key={rt.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                                  <div style={{ width: 60, color: "#475569" }}>{rt.label}</div>
                                  <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 3, height: 14, position: "relative", overflow: "hidden" }}>
                                    <div
                                      style={{
                                        width: `${widthPct}%`,
                                        height: "100%",
                                        background: rt.grad,
                                        borderRadius: 3,
                                      }}
                                    />
                                  </div>
                                  <div style={{ width: 48, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: rt.color }}>{val.toFixed(2)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gap analysis */}
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 10 }}>
                    Brechas Auto vs. Otros
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0a7d2c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Fortalezas</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Otros la valoran ≥ 4.0</div>
                      {fortalezas.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Sin competencias en este rango.</div>
                      ) : fortalezas.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>{c.nombre}</strong>
                          <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}> · {avgOtros(c).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Puntos ciegos</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Auto &gt; Otros (sobreestima)</div>
                      {puntosCiegos.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Sin brechas significativas.</div>
                      ) : puntosCiegos.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>{c.nombre}</strong>
                          <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}> · gap +{c.gap.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Fortalezas ocultas</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Auto &lt; Otros (subestima)</div>
                      {fortalezasOcultas.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Sin brechas significativas.</div>
                      ) : fortalezasOcultas.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>{c.nombre}</strong>
                          <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}> · gap +{c.gap.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 10 }}>
                    Comentarios cualitativos
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {r.comentarios.map((co, i) => (
                      <div key={i} style={{ borderLeft: "3px solid #cbd5e1", padding: "6px 10px", background: "#f8fafc", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{co.rater}</div>
                        <div style={{ color: "#0f172a" }}>"{co.texto}"</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 12 }}>
                    <button style={S.btn} onClick={cerrarModal}>Cerrar</button>
                  </div>
                </>
              );
            })()}

            {modal.mode === "ver" && modal.instrumento.individual && modal.instrumento.casoEjemplo && (() => {
              const esBaja = modal.instrumento.id === "salida";
              const lista = esBaja ? BAJAS_SALIDA : INGRESOS_BIENVENIDA;
              const selIdx = esBaja ? selectedSalidaIdx : selectedBienvenidaIdx;
              const setSelIdx = esBaja ? setSelectedSalidaIdx : setSelectedBienvenidaIdx;
              const c = lista[selIdx];
              const headerTitle = esBaja ? `${lista.length} bajas en los últimos 90 días` : `${lista.length} ingresos en los últimos 90 días`;
              return (
                <>
                  {/* Header del caso */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setPickerOpen(!pickerOpen)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "left", fontFamily: "inherit" }}
                      >
                        {c.empleado}
                        <span style={{ fontSize: 11, color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Cambiar ▾</span>
                      </button>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{c.puesto} · {c.area} · Jefe: {c.jefe}</div>
                      {pickerOpen && (
                        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#fff", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 8px 24px rgba(15,23,42,0.18)", zIndex: 200, minWidth: 340, maxHeight: 360, overflowY: "auto" }}>
                          <div style={{ ...S.kpiLabel, padding: "10px 12px 6px", borderBottom: "1px solid #f1f5f9" }}>{headerTitle}</div>
                          {lista.map((p, i) => (
                            <div
                              key={i}
                              onClick={() => { setSelIdx(i); setPickerOpen(false); }}
                              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: i < lista.length - 1 ? "1px solid #f1f5f9" : "none", background: i === selIdx ? "#eef5ff" : "#fff", fontSize: 13 }}
                              onMouseEnter={(e) => { if (i !== selIdx) e.currentTarget.style.background = "#f8fafc"; }}
                              onMouseLeave={(e) => { if (i !== selIdx) e.currentTarget.style.background = "#fff"; }}
                            >
                              <div style={{ fontWeight: 700 }}>{p.empleado}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{p.puesto} · {p.area} · {esBaja ? `Baja ${p.fechaBaja}` : `Ingreso ${p.fechaIngreso} · ${p.checkpoint}`}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ ...S.badge(c.estado === "Completada" ? "#e8f5e9" : "#fff7e0"), fontSize: 11 }}>{c.estado}</span>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Enviada por {c.enviadaPor}</div>
                    </div>
                  </div>

                  {/* Datos del caso */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                    <div style={S.kpi}>
                      <div style={S.kpiLabel}>Ingreso</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{c.fechaIngreso}</div>
                    </div>
                    {esBaja ? (
                      <>
                        <div style={S.kpi}>
                          <div style={S.kpiLabel}>Baja</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{c.fechaBaja}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{c.antiguedad}</div>
                        </div>
                        <div style={S.kpi}>
                          <div style={S.kpiLabel}>Razón preliminar</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{c.razonPrelim}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={S.kpi}>
                          <div style={S.kpiLabel}>Checkpoint</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{c.checkpoint}</div>
                        </div>
                        <div style={S.kpi}>
                          <div style={S.kpiLabel}>Score</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{c.scoreCaso}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Respuestas */}
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 10 }}>
                    Respuestas del empleado
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {c.respuestas.map((qa, i) => (
                      <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 12px", background: "#f8fafc" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                          {i + 1}. {qa.pregunta}
                        </div>
                        <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5 }}>"{qa.respuesta}"</div>
                      </div>
                    ))}
                  </div>

                  {/* Alertas / acciones */}
                  {c.alertas && c.alertas.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
                        Alertas y acciones sugeridas
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {c.alertas.map((a, i) => (
                          <div key={i} style={{ borderLeft: "3px solid #c2410c", background: "#fff7ed", padding: "8px 12px", fontSize: 12, color: "#7c2d12" }}>
                            {a}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 12 }}>
                    <button style={S.btn} onClick={cerrarModal}>Cerrar</button>
                  </div>
                </>
              );
            })()}

            {modal.mode === "ver" && modal.instrumento.id !== "360" && !modal.instrumento.individual && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div style={S.kpi}>
                    <div style={S.kpiLabel}>Score</div>
                    <div style={S.kpiValue}>{modal.instrumento.resultado.score}</div>
                  </div>
                  <div style={S.kpi}>
                    <div style={S.kpiLabel}>Respuestas</div>
                    <div style={S.kpiValue}>{modal.instrumento.resultado.respuestas}</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 10 }}>
                  Distribución por pregunta
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {modal.instrumento.resultado.distribucion.map((d, idx) => (
                    <div key={idx}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#0f172a" }}>{d.pregunta}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.barras.map((b, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                            <div style={{ width: 90, color: "#475569" }}>{b.label}</div>
                            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 3, height: 14, position: "relative", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${b.pct}%`,
                                  height: "100%",
                                  background: "linear-gradient(180deg, #64748b 0%, #475569 100%)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <div style={{ width: 40, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{b.pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 12, marginTop: 16 }}>
                  <button style={S.btn} onClick={cerrarModal}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 3. LÍNEA DE DENUNCIA
// =============================================================
const INCIDENCIAS = [
  {
    id: "DN-024", fecha: "12-abr", tipo: "Acoso laboral", area: "Comercial",
    estado: "En investigación", hr: "Sí", severidad: "Alta",
    canal: "Línea ética 800 (anónima)",
    denunciante: { anonimo: true, descripcion: "Colaborador del área Comercial", relacion: "Reporte directo del denunciado" },
    denunciado: {
      nombre: "Jorge Briones", empNo: "EMP-0103", area: "Comercial",
      puesto: "Gerente Comercial Oriente", jefe: "F. Domínguez (Dir. Comercial Norte)",
      antiguedad: "4 años 2 meses", fechaIngreso: "06-feb-2022",
      reportes: 9, sueldo: 42000, expediente: "Sin sanciones previas · 1 reporte cerrado sin acción (2024)",
    },
    confidencialidad: "Estricta",
    descripcion: "Reporte de trato hostil, gritos en juntas y comentarios despectivos hacia integrantes del equipo durante los últimos 3 meses. Cuatro testigos anónimos respaldan los hechos.",
    evidencias: [
      "Capturas de Teams — 3 conversaciones con tono agresivo (mar–abr)",
      "Acta de junta del 28-mar con observaciones del HRBP",
      "Pulso de clima del equipo: score 5.2/10 vs 7.8 promedio del área",
    ],
    comentariosComite: [
      { autor: "Comité Ético", fecha: "15-abr", texto: "Caso clasificado prioritario. Asignar acompañamiento psicológico al denunciante." },
      { autor: "Legal", fecha: "20-abr", texto: "Documentar hallazgos para potencial acción disciplinaria conforme al art. 47 LFT." },
    ],
    proximosPasos: [
      "Cerrar recolección de evidencias antes del 30-abr",
      "Sesión del Comité Ético programada 03-may",
      "Activar protocolo de no represalia con denunciante",
    ],
    hojaRuta: [
      { paso: 1, accion: "Entrevista con denunciante", responsable: "Gerente RH", fecha: "15-abr", estado: "Hecho" },
      { paso: 2, accion: "Entrevista con denunciado", responsable: "Gerente RH + Legal", fecha: "20-abr", estado: "Hecho" },
      { paso: 3, accion: "Recolección de evidencias", responsable: "Comité ético", fecha: "30-abr", estado: "En curso" },
      { paso: 4, accion: "Resolución y comunicación", responsable: "Director RH", fecha: "10-may", estado: "Pendiente" },
    ],
  },
  {
    id: "DN-025", fecha: "18-abr", tipo: "Conflicto interpersonal", area: "Posventa",
    estado: "Abierta", hr: "No", severidad: "Media",
    canal: "Conversación directa con HRBP",
    denunciante: {
      anonimo: false, nombre: "Teresa Aguilar", empNo: "EMP-0218", area: "Posventa",
      puesto: "Supervisora de Posventa Turno A", jefe: "L. Cano (Gte. Posventa)",
      antiguedad: "5 años 7 meses", relacion: "Jefa directa de ambos denunciados",
    },
    denunciado: {
      colectivo: true,
      personas: [
        {
          nombre: "Daniel Vargas", empNo: "EMP-0341", area: "Posventa",
          puesto: "Técnico Sr. (Turno A)", jefe: "T. Aguilar (Sup. Posventa)",
          antiguedad: "3 años 2 meses", fechaIngreso: "12-feb-2023",
          sueldo: 18500, expediente: "1 amonestación verbal previa (jul-2025)",
        },
        {
          nombre: "Iván Mora", empNo: "EMP-0162", area: "Posventa",
          puesto: "Técnico Sr. (Turno A)", jefe: "T. Aguilar (Sup. Posventa)",
          antiguedad: "4 años 9 meses", fechaIngreso: "20-jul-2021",
          sueldo: 19200, expediente: "Sin sanciones previas · evaluación 'cumple' últimos 2 años",
        },
      ],
    },
    confidencialidad: "Estándar",
    descripcion: "Conflicto recurrente entre dos técnicos del turno matutino que está afectando el flujo de servicio. Ya hubo 2 quejas de clientes por demoras atribuibles a la fricción del equipo.",
    evidencias: [
      "2 tickets de clientes con tiempo de respuesta fuera de SLA",
      "Reporte de supervisora del 17-abr",
    ],
    comentariosComite: [],
    proximosPasos: [
      "Generar Hoja de Ruta antes del 30-abr (faltante)",
      "Sesión de mediación facilitada por HRBP",
      "Evaluar rotación temporal de turno si la mediación no resuelve",
    ],
    hojaRuta: [],
  },
  {
    id: "DN-026", fecha: "20-abr", tipo: "Sospecha de fraude", area: "Administración",
    estado: "En investigación", hr: "Sí", severidad: "Crítica",
    canal: "Línea ética 800 (anónima)",
    denunciante: { anonimo: true, descripcion: "Colaborador de Administración (mismo equipo del denunciado)", relacion: "Compañero de área con acceso al ERP" },
    denunciado: {
      nombre: "Alfredo Mendoza", empNo: "EMP-0277", area: "Administración",
      puesto: "Auxiliar Contable Sr.", jefe: "R. Solís (Gte. Finanzas)",
      antiguedad: "6 años 1 mes", fechaIngreso: "15-mar-2020",
      reportes: 0, sueldo: 21500, expediente: "Sin sanciones previas · evaluación 'supera' últimos 3 años · usuario power-user del ERP",
    },
    confidencialidad: "Estricta · Comité Ejecutivo",
    descripcion: "Sospecha de duplicación de facturas a proveedor único en los últimos 90 días. Monto estimado en revisión: $480K. Auditoría interna ya replicó la inconsistencia en muestreo.",
    evidencias: [
      "Reporte preliminar de Auditoría Interna · 14 facturas con CFDI duplicado",
      "Conciliación bancaria con desfase de $312K (mar 2026)",
      "Bitácora de accesos al ERP fuera de horario (5 eventos)",
    ],
    comentariosComite: [
      { autor: "Auditoría Interna", fecha: "21-abr", texto: "Patrón consistente con esquema de duplicación. Solicitar bloqueo cautelar del usuario en ERP." },
      { autor: "Legal", fecha: "23-abr", texto: "Preparar denuncia ante autoridad competente si se confirma el desfalco." },
    ],
    proximosPasos: [
      "Bloqueo cautelar de acceso al ERP — ya ejecutado",
      "Cierre de auditoría forense · fecha objetivo 08-may",
      "Coordinación con Legal y Compliance para decisión final",
    ],
    hojaRuta: [
      { paso: 1, accion: "Bloqueo cautelar de accesos", responsable: "TI + Legal", fecha: "21-abr", estado: "Hecho" },
      { paso: 2, accion: "Auditoría forense de facturas", responsable: "Auditoría Interna", fecha: "08-may", estado: "En curso" },
      { paso: 3, accion: "Entrevista al colaborador investigado", responsable: "RH + Legal", fecha: "10-may", estado: "Pendiente" },
      { paso: 4, accion: "Resolución y reporte a Consejo", responsable: "Director General", fecha: "20-may", estado: "Pendiente" },
    ],
  },
  {
    id: "DN-027", fecha: "22-abr", tipo: "Discriminación", area: "Operaciones",
    estado: "Abierta", hr: "No", severidad: "Alta",
    canal: "Línea ética 800 (anónima)",
    denunciante: { anonimo: true, descripcion: "Colaboradora de Operaciones (Planta 2)", relacion: "Reporte directo del denunciado" },
    denunciado: {
      nombre: "Ricardo Cardona", empNo: "EMP-0089", area: "Operaciones",
      puesto: "Supervisor de Planta 2", jefe: "C. Mendoza (Dir. Operaciones)",
      antiguedad: "8 años 3 meses", fechaIngreso: "08-ene-2018",
      reportes: 22, sueldo: 32000, expediente: "Sin sanciones previas · evaluación 'cumple' · 2 reportes informales de RH en 2024 sin formalizar",
    },
    confidencialidad: "Estricta",
    descripcion: "Reporte de trato diferenciado en asignación de turnos y oportunidades de capacitación entre colaboradores hombres y mujeres del mismo nivel. Datos preliminares de RH respaldan el patrón.",
    evidencias: [
      "Reporte de asignación de turnos Q1 2026 (sesgo del 38%)",
      "Solicitudes de capacitación rechazadas: 5/6 a mujeres",
    ],
    comentariosComite: [],
    proximosPasos: [
      "Generar Hoja de Ruta (faltante) — escalado a Comité Ético",
      "Solicitar reporte completo a People Analytics",
      "Definir entrevistas confidenciales con muestra del equipo",
    ],
    hojaRuta: [],
  },
  {
    id: "DN-028", fecha: "25-abr", tipo: "Violación de política", area: "Comercial",
    estado: "Resuelta", hr: "Sí", severidad: "Media",
    canal: "Reporte directo del Gerente",
    denunciante: {
      anonimo: false, nombre: "Luis Martínez", empNo: "EMP-0017", area: "Comercial",
      puesto: "Gerente Comercial", jefe: "F. Domínguez (Dir. Comercial Norte)",
      antiguedad: "9 años 4 meses", relacion: "Jefe del Director Comercial del denunciado",
    },
    denunciado: {
      nombre: "Francisco Suárez", empNo: "EMP-0445", area: "Comercial",
      puesto: "Ejecutivo de Cuenta Sr.", jefe: "G. Pérez (Gte. Comercial Centro)",
      antiguedad: "3 años 0 meses", fechaIngreso: "08-may-2023",
      reportes: 0, sueldo: 26500, expediente: "Top performer 2024-2025 · sin sanciones previas · cuota +18% YTD",
    },
    confidencialidad: "Estándar",
    descripcion: "Uso de descuento por encima del rango autorizado en 3 oportunidades sin aprobación previa del Director. Impacto: -$185K en margen del trimestre.",
    evidencias: [
      "3 cotizaciones aprobadas en CRM fuera de política",
      "Comparativo de margen vs cuota: -4.2 puntos",
    ],
    comentariosComite: [
      { autor: "Director Comercial", fecha: "28-abr", texto: "Confirmada la violación. Se aplicó acción disciplinaria conforme al reglamento (acta administrativa)." },
    ],
    resolucion: "Acta administrativa en expediente. Capacitación obligatoria de Política Comercial completada el 05-may. Sin recurrencia hasta la fecha.",
    proximosPasos: [
      "Seguimiento de comportamiento por 90 días",
      "Refuerzo de capacitación en política comercial al equipo Comercial",
    ],
    hojaRuta: [
      { paso: 1, accion: "Revisión de evidencias en CRM", responsable: "Director Comercial", fecha: "26-abr", estado: "Hecho" },
      { paso: 2, accion: "Reunión disciplinaria con el ejecutivo", responsable: "Director Comercial + RH", fecha: "28-abr", estado: "Hecho" },
      { paso: 3, accion: "Capacitación de política comercial", responsable: "RH", fecha: "05-may", estado: "Hecho" },
      { paso: 4, accion: "Comunicación al equipo del área", responsable: "Director Comercial", fecha: "06-may", estado: "Hecho" },
    ],
  },
];

// Casos cerrados de meses anteriores — alimentan el historial (resueltos vs no resueltos).
const CASOS_ARCHIVADOS = [
  {
    id: "DN-023", fecha: "06-mar", cierre: "24-mar", tipo: "Mal uso de recursos", area: "Operaciones",
    estado: "Resuelta", resultado: "Fundada", hr: "Sí", severidad: "Media",
    canal: "Línea ética 800 (anónima)",
    denunciante: { anonimo: true, descripcion: "Colaborador del área de Operaciones", relacion: "Compañero del denunciado" },
    denunciado: {
      nombre: "Raúl Espinoza", empNo: "EMP-0331", area: "Operaciones",
      puesto: "Supervisor de Almacén", jefe: "M. Quintana (Jefa de Operaciones)",
      antiguedad: "6 años 1 mes", fechaIngreso: "14-feb-2020",
      reportes: 5, sueldo: 24000, expediente: "1 llamada de atención verbal (2023)",
    },
    confidencialidad: "Estándar",
    descripcion: "Uso de vehículo y herramienta de la empresa para fines personales en fin de semana, sin autorización.",
    evidencias: ["Bitácora de salida del almacén (sábado)", "Reporte de GPS de la unidad U-12", "Testimonio de vigilancia"],
    comentariosComite: [
      { autor: "Comité Ético", fecha: "18-mar", texto: "Hechos confirmados. Procede acción disciplinaria sin despido por ser primera falta documentada." },
    ],
    resolucion: "Acta administrativa y reposición del costo de combustible. Capacitación en uso de activos completada el 22-mar.",
    proximosPasos: ["Seguimiento por 60 días", "Refuerzo de política de uso de activos al equipo"],
    hojaRuta: [
      { paso: 1, accion: "Entrevista con testigos", responsable: "Gerente RH", fecha: "10-mar", estado: "Hecho" },
      { paso: 2, accion: "Entrevista con denunciado", responsable: "Gerente RH + Legal", fecha: "14-mar", estado: "Hecho" },
      { paso: 3, accion: "Resolución del Comité", responsable: "Comité ético", fecha: "18-mar", estado: "Hecho" },
      { paso: 4, accion: "Acción disciplinaria y cierre", responsable: "Director RH", fecha: "24-mar", estado: "Hecho" },
    ],
  },
  {
    id: "DN-021", fecha: "11-feb", cierre: "02-mar", tipo: "Acoso laboral", area: "Posventa",
    estado: "Resuelta", resultado: "Fundada", hr: "Sí", severidad: "Alta",
    canal: "Reporte directo con HRBP",
    denunciante: {
      anonimo: false, nombre: "Verónica Lugo", empNo: "EMP-0276", area: "Posventa",
      puesto: "Asesora de Servicio", jefe: "C. Mendoza (Gte. Posventa)", antiguedad: "3 años 5 meses",
      relacion: "Reporte directo del denunciado",
    },
    denunciado: {
      nombre: "Hugo Pérez", empNo: "EMP-0150", area: "Posventa",
      puesto: "Jefe de Taller", jefe: "C. Mendoza (Gte. Posventa)",
      antiguedad: "8 años 0 meses", fechaIngreso: "20-ene-2018",
      reportes: 12, sueldo: 38000, expediente: "Reporte previo cerrado sin acción (2023)",
    },
    confidencialidad: "Estricta",
    descripcion: "Comentarios humillantes reiterados y asignación de cargas desproporcionadas como represalia.",
    evidencias: ["Mensajes de WhatsApp del grupo del taller", "2 testimonios firmados", "Pulso de clima del taller: 4.8/10"],
    comentariosComite: [
      { autor: "Comité Ético", fecha: "20-feb", texto: "Patrón de conducta confirmado. Recomendación: separación del cargo de liderazgo." },
      { autor: "Legal", fecha: "26-feb", texto: "Procede rescisión conforme al art. 47 LFT con expediente documentado." },
    ],
    resolucion: "Baja del denunciado por rescisión justificada. Acompañamiento psicológico activado para la denunciante. Reasignación de liderazgo del taller.",
    proximosPasos: ["Monitoreo de clima del taller por 90 días", "Protocolo de no represalia vigente"],
    hojaRuta: [
      { paso: 1, accion: "Entrevista con denunciante", responsable: "Gerente RH", fecha: "13-feb", estado: "Hecho" },
      { paso: 2, accion: "Recolección de evidencias", responsable: "Comité ético", fecha: "18-feb", estado: "Hecho" },
      { paso: 3, accion: "Entrevista con denunciado", responsable: "Gerente RH + Legal", fecha: "22-feb", estado: "Hecho" },
      { paso: 4, accion: "Resolución y comunicación", responsable: "Director RH", fecha: "02-mar", estado: "Hecho" },
    ],
  },
  {
    id: "DN-019", fecha: "20-ene", cierre: "05-feb", tipo: "Conflicto interpersonal", area: "Administración",
    estado: "Resuelta", resultado: "No fundada", hr: "Sí", severidad: "Baja",
    canal: "Buzón interno",
    denunciante: {
      anonimo: false, nombre: "Daniela Ortega", empNo: "EMP-0298", area: "Administración",
      puesto: "Analista de Nómina", jefe: "J. Fuentes (Jefe de Administración)", antiguedad: "2 años 3 meses",
      relacion: "Compañera del denunciado",
    },
    denunciado: {
      nombre: "Mario Salas", empNo: "EMP-0301", area: "Administración",
      puesto: "Analista de Cuentas por Pagar", jefe: "J. Fuentes (Jefe de Administración)",
      antiguedad: "2 años 8 meses", fechaIngreso: "12-sep-2023",
      reportes: 0, sueldo: 22000, expediente: "Sin antecedentes",
    },
    confidencialidad: "Estándar",
    descripcion: "Reporte de discusiones frecuentes y mal ambiente entre dos analistas del área.",
    evidencias: ["Entrevistas a ambas partes", "Sin evidencia de conducta sancionable"],
    comentariosComite: [
      { autor: "HRBP", fecha: "30-ene", texto: "No se acredita falta. Se trata de un conflicto de comunicación; procede mediación." },
    ],
    resolucion: "Caso no fundado. Sesión de mediación realizada el 04-feb con acuerdos de convivencia. Sin acción disciplinaria.",
    proximosPasos: ["Seguimiento informal del clima del área por 30 días"],
    hojaRuta: [
      { paso: 1, accion: "Entrevista con ambas partes", responsable: "HRBP", fecha: "26-ene", estado: "Hecho" },
      { paso: 2, accion: "Sesión de mediación", responsable: "HRBP + Jefe de área", fecha: "04-feb", estado: "Hecho" },
      { paso: 3, accion: "Cierre y acuerdos", responsable: "Gerente RH", fecha: "05-feb", estado: "Hecho" },
    ],
  },
];

const TODOS_CASOS = [...INCIDENCIAS, ...CASOS_ARCHIVADOS];

// Tendencia mensual (recibidas vs resueltas) — para el historial.
const HISTORIAL_MENSUAL = [
  { mes: "Jul", recibidas: 4, resueltas: 3 },
  { mes: "Ago", recibidas: 5, resueltas: 4 },
  { mes: "Sep", recibidas: 3, resueltas: 3 },
  { mes: "Oct", recibidas: 6, resueltas: 4 },
  { mes: "Nov", recibidas: 5, resueltas: 3 },
  { mes: "Dic", recibidas: 4, resueltas: 4 },
];

function Denuncia() {
  const [openId, setOpenId] = useState(null);
  const [pwdRequestId, setPwdRequestId] = useState(null);
  const [pwdInput, setPwdInput] = useState("");
  const [pwdError, setPwdError] = useState(false);

  const intentarAbrir = (id) => {
    setPwdRequestId(id);
    setPwdInput("");
    setPwdError(false);
  };
  const validarPassword = () => {
    if (pwdInput === "12345") {
      setOpenId(pwdRequestId);
      setPwdRequestId(null);
      setPwdInput("");
      setPwdError(false);
    } else {
      setPwdError(true);
    }
  };
  const cancelarPassword = () => {
    setPwdRequestId(null);
    setPwdInput("");
    setPwdError(false);
  };
  const incidencia = TODOS_CASOS.find((i) => i.id === openId);

  const estadoBadgeColor = (estado) =>
    estado === "Resuelta" ? "#e8f5e9" : estado === "En investigación" ? "#fff7e0" : "#fdecea";
  const severidadColor = (sev) =>
    sev === "Crítica" ? "#b00020" : sev === "Alta" ? "#c2410c" : sev === "Media" ? "#a16207" : "#475569";
  const pasoEstadoColor = (estado) =>
    estado === "Hecho" ? "#e8f5e9" : estado === "En curso" ? "#fff7e0" : "#eee";

  return (
    <div>
      <h2 style={S.h2}>Línea de Denuncia</h2>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Activas</div>
            <div style={S.kpiValue}>5</div>
            <div style={S.kpiBenchmark("yellow")}>Histórico mensual: 3-6</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Sin Hoja de Ruta</div>
            <div style={S.kpiValue}>2</div>
            <div style={S.kpiBenchmark("red")}>Meta: 0 (toda activa con plan)</div>
          </div>
          <TrafficLight light="red" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Resueltas (mes)</div>
            <div style={S.kpiValue}>3</div>
            <div style={S.kpiBenchmark("green")}>Meta: ≥3 / mes</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Tiempo medio resolución</div>
            <div style={S.kpiValue}>22 días</div>
            <div style={S.kpiBenchmark("yellow")}>SLA interno: ≤15 días</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
      </div>

      <h3 style={S.h3}>Bandeja de incidencias</h3>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Folio</th>
            <th style={S.th}>Fecha</th>
            <th style={S.th}>Tipo</th>
            <th style={S.th}>Área</th>
            <th style={S.th}>Estado</th>
            <th style={S.th}>Hoja de Ruta</th>
            <th style={S.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {INCIDENCIAS.map((i) => (
            <tr key={i.id}>
              <td style={S.td}><strong>{i.id}</strong></td>
              <td style={S.td}>{i.fecha}</td>
              <td style={S.td}>{i.tipo}</td>
              <td style={S.td}>{i.area}</td>
              <td style={S.td}>
                <span style={S.badge(estadoBadgeColor(i.estado))}>{i.estado}</span>
              </td>
              <td style={S.td}>
                {i.hr === "Sí"
                  ? <span style={S.badge("#e8f5e9")}>Generada</span>
                  : <span style={S.badge("#fdecea")}>Faltante</span>}
              </td>
              <td style={S.td}>
                <button style={S.btnGhost} onClick={() => intentarAbrir(i.id)}>Abrir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={S.h3}>Historial de casos — Resueltos vs No resueltos</h3>
      {(() => {
        const resueltos = TODOS_CASOS.filter((c) => c.estado === "Resuelta");
        const noResueltos = TODOS_CASOS.filter((c) => c.estado !== "Resuelta");
        const totalCasos = TODOS_CASOS.length;
        const tasa = totalCasos ? Math.round((resueltos.length / totalCasos) * 100) : 0;
        const maxMes = Math.max(1, ...HISTORIAL_MENSUAL.map((m) => m.recibidas));

        const CasoCard = ({ c, resuelto }) => {
          const hechos = c.hojaRuta.filter((p) => p.estado === "Hecho").length;
          const tot = c.hojaRuta.length || 1;
          const prog = Math.round((hechos / tot) * 100);
          const ac = resuelto ? "#0a7d2c" : "#c2410c";
          return (
            <button
              onClick={() => intentarAbrir(c.id)}
              title={`${c.id} · clic para abrir el expediente (confidencial)`}
              style={{
                textAlign: "left", width: "100%", cursor: "pointer",
                border: "1px solid " + COLOR.border,
                borderRadius: 0, padding: "11px 13px", background: "#fff",
                display: "flex", flexDirection: "column", gap: 8, boxShadow: COLOR.shadow,
                transition: "box-shadow 0.12s ease, transform 0.12s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = COLOR.shadowHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = COLOR.shadow; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ color: COLOR.textMuted, display: "inline-flex" }}><IconLock size={12} /></span>
                  <strong style={{ fontSize: 13, color: COLOR.ink }}>{c.id}</strong>
                  <span style={{ fontSize: 12, color: COLOR.textSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {c.tipo}</span>
                </div>
                <span style={{ ...S.badge("#f1f5f9"), color: severidadColor(c.severidad), fontWeight: 700, flexShrink: 0 }}>{c.severidad}</span>
              </div>
              <div style={{ fontSize: 11, color: COLOR.textMuted }}>
                {c.area} · Recibida {c.fecha}{resuelto && c.cierre ? ` · Cerrada ${c.cierre}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 4, background: hexA(ac, 0.12), overflow: "hidden" }}>
                  <div style={{ width: `${prog}%`, height: "100%", background: ac, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: ac }}>{hechos}/{tot}</span>
                {resuelto
                  ? <span style={{ ...S.badge("#e8f5e9"), color: "#0a7d2c", fontWeight: 700 }}>{c.resultado || "Resuelta"}</span>
                  : <span style={{ ...S.badge(c.hr === "Sí" ? "#fff7e0" : "#fdecea"), fontWeight: 700 }}>{c.estado}</span>}
              </div>
            </button>
          );
        };

        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 1.6fr", gap: 12, marginBottom: 14 }}>
              {/* Tasa de resolución */}
              <div style={{ ...S.card, marginBottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={S.kpiLabel}>Tasa de resolución (histórico)</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 34, fontWeight: 700, color: "#0a7d2c", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{tasa}%</div>
                  <div style={{ fontSize: 12, color: COLOR.textMuted }}>{resueltos.length} de {totalCasos} casos</div>
                </div>
                <div style={{ display: "flex", height: 12, overflow: "hidden", marginTop: 12, border: "1px solid " + COLOR.border }}>
                  <div style={{ width: `${tasa}%`, background: "linear-gradient(90deg, #16a34a 0%, #0a7d2c 100%)" }} title={`Resueltos: ${resueltos.length}`} />
                  <div style={{ flex: 1, background: "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)" }} title={`No resueltos: ${noResueltos.length}`} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: "#0a7d2c", fontWeight: 700 }}>● Resueltos {resueltos.length}</span>
                  <span style={{ color: "#c2410c", fontWeight: 700 }}>No resueltos {noResueltos.length} ●</span>
                </div>
              </div>

              {/* Tendencia 6 meses */}
              <div style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={S.kpiLabel}>Tendencia · recibidas vs resueltas</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: COLOR.textMuted }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#94a3b8", marginRight: 4 }} />Recibidas</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#0a7d2c", marginRight: 4 }} />Resueltas</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 96, paddingTop: 4 }}>
                  {HISTORIAL_MENSUAL.map((m) => (
                    <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 72, width: "100%", justifyContent: "center" }}>
                        <div title={`Recibidas: ${m.recibidas}`} style={{ position: "relative", width: 14, height: `${(m.recibidas / maxMes) * 100}%`, background: "#94a3b8" }}>
                          <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, color: "#64748b" }}>{m.recibidas}</span>
                        </div>
                        <div title={`Resueltas: ${m.resueltas}`} style={{ position: "relative", width: 14, height: `${(m.resueltas / maxMes) * 100}%`, background: "#0a7d2c" }}>
                          <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, color: "#0a7d2c" }}>{m.resueltas}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: COLOR.textMuted, fontWeight: 600 }}>{m.mes}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dos carriles de casos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#c2410c" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLOR.textSoft }}>No resueltos · en proceso ({noResueltos.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {noResueltos.map((c) => <CasoCard key={c.id} c={c} resuelto={false} />)}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0a7d2c" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLOR.textSoft }}>Resueltos ({resueltos.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {resueltos.map((c) => <CasoCard key={c.id} c={c} resuelto={true} />)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <IconLock size={11} /> Cada tarjeta abre el expediente y su histórico completo · acceso protegido (password).
            </div>
          </>
        );
      })()}

      {pwdRequestId && (
        <div
          onClick={cancelarPassword}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 8, padding: 24,
              width: 420, maxWidth: "92vw", border: "1px solid #ccc",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#fdecea", border: "1px solid #fca5a5",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "#b00020",
              }}>!</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Información confidencial</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Password requerido para abrir folio {pwdRequestId}</div>
              </div>
            </div>

            <div style={{ ...S.kpiLabel, marginBottom: 6, marginTop: 14 }}>Password</div>
            <input
              type="password"
              autoFocus
              value={pwdInput}
              onChange={(e) => { setPwdInput(e.target.value); if (pwdError) setPwdError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") validarPassword(); if (e.key === "Escape") cancelarPassword(); }}
              placeholder="Ingresa el password"
              style={{
                width: "100%", padding: "10px 12px",
                border: `1px solid ${pwdError ? "#b00020" : "#ccc"}`,
                borderRadius: 4, fontSize: 14, fontFamily: "inherit",
                boxSizing: "border-box", outline: "none",
              }}
            />
            {pwdError && (
              <div style={{ fontSize: 12, color: "#b00020", marginTop: 6, fontWeight: 600 }}>
                Password incorrecto. Intenta de nuevo.
              </div>
            )}

            <div style={{ fontSize: 11, color: "#64748b", marginTop: 14, padding: "8px 10px", background: "#f8fafc", borderLeft: "3px solid #cbd5e1", borderRadius: 2 }}>
              El acceso a expedientes de la Línea de Denuncia queda registrado en bitácora. Sólo personal autorizado del Comité Ético y RH puede consultar.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button style={S.btnGhost} onClick={cancelarPassword}>Cancelar</button>
              <button style={S.btn} onClick={validarPassword}>Abrir expediente</button>
            </div>
          </div>
        </div>
      )}

      {incidencia && (
        <div
          onClick={() => setOpenId(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 8, padding: 24,
              width: 760, maxWidth: "94vw", maxHeight: "92vh", overflowY: "auto",
              border: "1px solid #ccc",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {incidencia.id} · {incidencia.tipo}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {incidencia.area} · Recibida {incidencia.fecha} · {incidencia.canal}
                </div>
              </div>
              <button
                onClick={() => setOpenId(null)}
                style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}
                aria-label="Cerrar"
              >×</button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #e2e8f0" }}>
              <span style={S.badge(estadoBadgeColor(incidencia.estado))}>{incidencia.estado}</span>
              <span style={{ ...S.badge("#f1f5f9"), color: severidadColor(incidencia.severidad), fontWeight: 700 }}>
                Severidad: {incidencia.severidad}
              </span>
              <span style={S.badge("#f1f5f9")}>Confidencialidad: {incidencia.confidencialidad}</span>
              {incidencia.hr === "Sí"
                ? <span style={S.badge("#e8f5e9")}>Hoja de Ruta generada</span>
                : <span style={S.badge("#fdecea")}>Hoja de Ruta faltante</span>}
            </div>

            {/* Partes involucradas — detalle completo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {/* Denunciante */}
              <div style={{ ...S.kpi, padding: 14 }}>
                <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Denunciante</div>
                {incidencia.denunciante.anonimo ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Anónimo</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{incidencia.denunciante.descripcion}</div>
                    {incidencia.denunciante.relacion && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>Relación: {incidencia.denunciante.relacion}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{incidencia.denunciante.nombre}</div>
                      <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{incidencia.denunciante.empNo}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{incidencia.denunciante.puesto} · {incidencia.denunciante.area}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                      <strong>Jefe:</strong> {incidencia.denunciante.jefe}<br />
                      <strong>Antigüedad:</strong> {incidencia.denunciante.antiguedad}
                    </div>
                    {incidencia.denunciante.relacion && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>Relación: {incidencia.denunciante.relacion}</div>
                    )}
                  </>
                )}
              </div>

              {/* Denunciado */}
              <div style={{ ...S.kpi, padding: 14, borderColor: "#fca5a5", background: "#fff7f7" }}>
                <div style={{ ...S.kpiLabel, marginBottom: 6, color: "#b00020" }}>Denunciado{incidencia.denunciado.colectivo ? "s" : ""}</div>
                {incidencia.denunciado.colectivo ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {incidencia.denunciado.personas.map((p, i) => (
                      <div key={i} style={{ paddingTop: i > 0 ? 8 : 0, borderTop: i > 0 ? "1px dashed #fca5a5" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.nombre}</div>
                          <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{p.empNo}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{p.puesto} · {p.area}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                          <strong>Jefe:</strong> {p.jefe} · <strong>Antig.:</strong> {p.antiguedad} · <strong>Sueldo:</strong> ${p.sueldo.toLocaleString("es-MX")}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>{p.expediente}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{incidencia.denunciado.nombre}</div>
                      <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{incidencia.denunciado.empNo}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{incidencia.denunciado.puesto} · {incidencia.denunciado.area}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                      <strong>Jefe:</strong> {incidencia.denunciado.jefe}<br />
                      <strong>Antigüedad:</strong> {incidencia.denunciado.antiguedad} (ingreso {incidencia.denunciado.fechaIngreso})<br />
                      <strong>Reportes directos:</strong> {incidencia.denunciado.reportes} · <strong>Sueldo:</strong> ${incidencia.denunciado.sueldo.toLocaleString("es-MX")}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontStyle: "italic", borderTop: "1px dashed #fca5a5", paddingTop: 6 }}>
                      <strong>Expediente:</strong> {incidencia.denunciado.expediente}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
              Descripción del caso
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, marginBottom: 16, padding: "10px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              {incidencia.descripcion}
            </div>

            {/* Evidencias */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
              Evidencias ({incidencia.evidencias.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              {incidencia.evidencias.map((e, i) => <li key={i}>{e}</li>)}
            </ul>

            {/* Hoja de Ruta */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
              Hoja de Ruta
            </div>
            {incidencia.hojaRuta.length === 0 ? (
              <div style={{ padding: 14, background: "#fdecea", border: "1px dashed #b00020", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "#7f1d1d" }}>
                <strong>Pendiente de generar.</strong> Este caso aún no tiene plan de trabajo asignado.
                <div style={{ marginTop: 8 }}>
                  <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setOpenId(null)}>Generar Hoja de Ruta</button>
                </div>
              </div>
            ) : (
              <table style={{ ...S.table, marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>Acción</th>
                    <th style={S.th}>Responsable</th>
                    <th style={S.th}>Fecha</th>
                    <th style={S.th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {incidencia.hojaRuta.map((p) => (
                    <tr key={p.paso}>
                      <td style={S.td}>{p.paso}</td>
                      <td style={S.td}>{p.accion}</td>
                      <td style={S.td}>{p.responsable}</td>
                      <td style={S.td}>{p.fecha}</td>
                      <td style={S.td}><span style={S.badge(pasoEstadoColor(p.estado))}>{p.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Comentarios */}
            {incidencia.comentariosComite.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
                  Comentarios del Comité
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {incidencia.comentariosComite.map((c, i) => (
                    <div key={i} style={{ borderLeft: "3px solid #cbd5e1", padding: "6px 10px", background: "#f8fafc", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                        {c.autor} · {c.fecha}
                      </div>
                      <div style={{ color: "#0f172a" }}>"{c.texto}"</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Resolución (solo en resueltas) */}
            {incidencia.resolucion && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#0a7d2c", marginBottom: 8 }}>
                  Resolución
                </div>
                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, marginBottom: 16, padding: "10px 12px", background: "#e8f5e9", borderRadius: 6, border: "1px solid #0a7d2c" }}>
                  {incidencia.resolucion}
                </div>
              </>
            )}

            {/* Próximos pasos */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 8 }}>
              Próximos pasos
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              {incidencia.proximosPasos.map((p, i) => <li key={i}>{p}</li>)}
            </ul>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 12 }}>
              <button style={S.btn} onClick={() => setOpenId(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 4. COBERTURA DE PLANTILLA
// =============================================================
function Cobertura() {
  const [vacanteAbierta, setVacanteAbierta] = useState(null);

  const etapasReclutamiento = [
    "Solicitud (vacante autorizada)",
    "Sourcing y atracción",
    "Filtro de CV",
    "Entrevista RH",
    "Pruebas (técnicas / psicométricas)",
    "Entrevista con área solicitante",
    "Entrevista final / Dirección",
    "Oferta económica",
    "Verificación de referencias",
    "Contratación",
    "Onboarding 30-60-90+",
  ];

  const vacantes = [
    {
      id: "REQ-101", puesto: "Asesor Comercial Sr.", area: "Comercial", gerenciaFuncional: "Comercial Centro",
      solicita: "G. Pérez", solicitanteNombre: "Guillermo Pérez", solicitantePuesto: "Gerente Comercial Centro",
      jefeDirectoFuturo: "Guillermo Pérez",
      fechaApertura: "08-abr-2026", fechaObjetivo: "08-may-2026", abierta: 12,
      etapa: "Entrevistas", etapaActualIdx: 6, candidatos: 6,
      razon: "Reemplazo de Alejandro Méndez (B-003) — salida voluntaria 12-mar-2026",
      aprobadoPor: "Comité de Plantilla (08-abr-2026)",
      bandaMin: 26000, bandaMediana: 30000, bandaMax: 34000,
      bonoFirmaTarget: 5000, bonoTrimestralTarget: 6000,
      prestaciones: "Ley + GMM + Vales $2,000/mes",
      canalReclutamiento: "LinkedIn + Referidos + Headhunter ligero",
      responsableRH: "Paola Castaño (Gte. RH)",
      jobPostings: ["LinkedIn (87 aplicaciones)", "Indeed (32)", "Referidos internos (4)"],
      candidatosTop: [
        { id: "CAND-1042", nombre: "Ana Ramírez", score: 8.5, etapa: "Entrevista final", estado: "Avanzando" },
        { id: "CAND-1058", nombre: "Javier Torres", score: 7.2, etapa: "Pruebas técnicas", estado: "Avanzando" },
      ],
      observaciones: "Vacante crítica para Q2. A. Ramírez es top del pipeline (referida por A. Méndez, el que salió). G. Pérez tiene patrón de bajas Jr — atención al onboarding.",
    },
    {
      id: "REQ-102", puesto: "Mecánico A", area: "Posventa", gerenciaFuncional: "Taller Sucursal Norte",
      solicita: "L. Cano", solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      jefeDirectoFuturo: "Teresa Aguilar (Sup. Posventa Turno A)",
      fechaApertura: "02-abr-2026", fechaObjetivo: "02-may-2026", abierta: 28,
      etapa: "Sourcing", etapaActualIdx: 4, candidatos: 2,
      razon: "Reemplazo de Daniel Vázquez (B-011) — salida voluntaria 14-feb-2026 (cambio de giro)",
      aprobadoPor: "Comité de Plantilla (02-abr-2026)",
      bandaMin: 15000, bandaMediana: 18000, bandaMax: 21000,
      bonoFirmaTarget: 0, bonoTrimestralTarget: 0,
      prestaciones: "Ley + GMM básico + Vales $1,200",
      canalReclutamiento: "Bolsa CONALEP + Referidos del taller",
      responsableRH: "Paola Castaño (Gte. RH)",
      jobPostings: ["Bolsa CONALEP (18 aplicaciones)", "OCC Mundial (9)"],
      candidatosTop: [
        { id: "CAND-1063", nombre: "Mauricio Gómez", score: 7.8, etapa: "Pruebas técnicas", estado: "Avanzando" },
      ],
      observaciones: "Vacante de baja prioridad por estar en sucursal Norte (no Sur que es la crítica). Pool pequeño · evaluar subir banda 10% si no se cubre en 30 días.",
    },
    {
      id: "REQ-103", puesto: "Contador General", area: "Administración", gerenciaFuncional: "Finanzas",
      solicita: "R. Solís", solicitanteNombre: "Rodrigo Solís", solicitantePuesto: "Gerente de Finanzas",
      jefeDirectoFuturo: "Rodrigo Solís",
      fechaApertura: "25-mar-2026", fechaObjetivo: "25-abr-2026", abierta: 64,
      etapa: "Oferta", etapaActualIdx: 7, candidatos: 1,
      razon: "Reemplazo de Patricia Lozano (B-004) — salida voluntaria 15-ene-2026 (reubicación familiar)",
      aprobadoPor: "Director Administrativo (S. Ramírez) — 25-mar-2026",
      bandaMin: 35000, bandaMediana: 38000, bandaMax: 42000,
      bonoFirmaTarget: 0, bonoTrimestralTarget: 12000,
      prestaciones: "Ley + GMM Plus + Vales $2,500 + Auto utilitario",
      canalReclutamiento: "Headhunter especializado en Finanzas (fee 15%)",
      responsableRH: "Paola Castaño (Gte. RH)",
      jobPostings: ["Headhunter exclusivo (5 finalistas)"],
      candidatosTop: [
        { id: "CAND-1071", nombre: "Sofía Vega", score: 9.1, etapa: "Oferta económica", estado: "Oferta en revisión por +10.5% sobre presupuesto" },
      ],
      observaciones: "ALERTA · 64 días abierta (vs SLA 30). Oferta enviada $42K vs presupuesto $38K — pendiente aprobación de S. Ramírez. Si no cierra en 14 días, escalar.",
    },
    {
      id: "REQ-104", puesto: "Gerente de Operaciones (Planta 1)", area: "Operaciones", gerenciaFuncional: "Operaciones Planta 1",
      solicita: "Dirección", solicitanteNombre: "Carlos Mendoza", solicitantePuesto: "Director de Operaciones",
      jefeDirectoFuturo: "Carlos Mendoza",
      fechaApertura: "10-feb-2026", fechaObjetivo: "10-abr-2026", abierta: 71,
      etapa: "Onboarding", etapaActualIdx: 10, candidatos: 3,
      razon: "Jubilación planeada del gerente anterior (12 años de servicio)",
      aprobadoPor: "Dirección General (10-feb-2026)",
      bandaMin: 55000, bandaMediana: 58000, bandaMax: 65000,
      bonoFirmaTarget: 30000, bonoTrimestralTarget: 18000,
      prestaciones: "Ley + GMM Plus + Auto + Vales $3,000 + Bono anual 2 meses",
      canalReclutamiento: "Headhunter ejecutivo (búsqueda confidencial)",
      responsableRH: "Paola Castaño + Carlos Mendoza",
      jobPostings: ["Búsqueda confidencial vía headhunter (3 finalistas)"],
      candidatosTop: [
        { id: "CAND-0987", nombre: "Pedro Núñez", score: 8.9, etapa: "Onboarding Día 60", estado: "Contratado · adaptación excelente" },
      ],
      observaciones: "Vacante CERRADA. Pedro Núñez ingresó 01-abr-2026 · Día 60 con score 4.5/5. Mantener visible hasta cumplir 90 días.",
    },
    {
      id: "REQ-105", puesto: "Asistente de RH Sr.", area: "Administración", gerenciaFuncional: "RH",
      solicita: "Dir. RH", solicitanteNombre: "Paola Castaño", solicitantePuesto: "Gerente de Recursos Humanos",
      jefeDirectoFuturo: "Paola Castaño",
      fechaApertura: "14-mar-2026", fechaObjetivo: "14-jun-2026", abierta: 4,
      etapa: "Sourcing", etapaActualIdx: 2, candidatos: 0,
      razon: "Reemplazo de Beatriz Cordero (B-014) — salida voluntaria 12-mar-2026 (cambio a consultoría)",
      aprobadoPor: "Director Administrativo (S. Ramírez) — 14-mar-2026",
      bandaMin: 19000, bandaMediana: 22000, bandaMax: 25000,
      bonoFirmaTarget: 0, bonoTrimestralTarget: 0,
      prestaciones: "Ley + GMM + Vales $1,800",
      canalReclutamiento: "Referidos internos + LinkedIn",
      responsableRH: "Paola Castaño (auto-PM)",
      jobPostings: ["Referidos internos (4 candidatos)", "LinkedIn ads (5 aplicaciones)"],
      candidatosTop: [
        { id: "CAND-1085", nombre: "Karen Robles", score: 0, etapa: "Filtro de CV", estado: "Pre-evaluación" },
      ],
      observaciones: "Vacante crítica para RH. Operando con redundancia temporal de B. Lozano (ingreso reciente). Procesos de onboarding y clima dependen del cierre rápido.",
    },
    {
      id: "REQ-106", puesto: "Supervisor Posventa Turno B", area: "Posventa", gerenciaFuncional: "Taller Sucursal Sur",
      solicita: "L. Cano", solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      jefeDirectoFuturo: "Lorenzo Cano (en revisión)",
      fechaApertura: "20-abr-2026", fechaObjetivo: "20-jun-2026", abierta: 18,
      etapa: "Filtro CV", etapaActualIdx: 3, candidatos: 4,
      razon: "Nueva posición por crecimiento del Turno B + rotación documentada del taller (3 bajas voluntarias en 6 meses)",
      aprobadoPor: "L. Cano + C. Mendoza · con OBSERVACIÓN de intervención de clima",
      bandaMin: 24000, bandaMediana: 28000, bandaMax: 32000,
      bonoFirmaTarget: 0, bonoTrimestralTarget: 6000,
      prestaciones: "Ley + GMM + Vales $2,000",
      canalReclutamiento: "LinkedIn + Bolsa de trabajo + Headhunter ligero",
      responsableRH: "Paola Castaño (Gte. RH)",
      jobPostings: ["LinkedIn (22 aplicaciones)", "OCC Mundial (14)"],
      candidatosTop: [
        { id: "CAND-1090", nombre: "Ramón Cabral", score: 7.4, etapa: "Entrevista RH (programada)", estado: "Avanzando · con observación de jefe directo" },
      ],
      observaciones: "ALERTA · vacante con observación: tras el diagnóstico crítico del taller Sur (B-005, B-006, B-012), C. Mendoza está revisando si el nuevo supervisor debe reportar a L. Cano o tener jefe directo distinto.",
    },
    {
      id: "REQ-107", puesto: "Analista Financiero Jr.", area: "Administración", gerenciaFuncional: "Finanzas",
      solicita: "R. Solís", solicitanteNombre: "Rodrigo Solís", solicitantePuesto: "Gerente de Finanzas",
      jefeDirectoFuturo: "Sofía Vega (futura Contadora Gral.) o R. Solís",
      fechaApertura: "16-abr-2026", fechaObjetivo: "16-jun-2026", abierta: 36,
      etapa: "Entrevistas", etapaActualIdx: 5, candidatos: 5,
      razon: "Reemplazo de Andrés Solano (B-013) — salida voluntaria 04-mar-2026 (promoción a Contador General en otra empresa)",
      aprobadoPor: "Director Administrativo (S. Ramírez) — 16-abr-2026",
      bandaMin: 17000, bandaMediana: 19000, bandaMax: 22000,
      bonoFirmaTarget: 0, bonoTrimestralTarget: 4500,
      prestaciones: "Ley + GMM básico + Vales $1,500",
      canalReclutamiento: "LinkedIn + Universidades (recién egresados)",
      responsableRH: "Paola Castaño (Gte. RH)",
      jobPostings: ["LinkedIn (45 aplicaciones)", "Bolsa universitaria UNAM/ITAM/IPN (28)"],
      candidatosTop: [
        { nombre: "C. Bermúdez", score: 7.5, etapa: "Pruebas técnicas", estado: "Avanzando" },
        { nombre: "L. Estrada", score: 7.1, etapa: "Pruebas técnicas", estado: "Avanzando" },
      ],
      observaciones: "Pool joven y diverso. Caso de prevención: el reemplazo no debe quedarse 'estancado' como pasó con Solano (motivo de su salida fue falta de crecimiento — ver pestaña Rotación).",
    },
  ];

  const solicitudesMensuales = [
    { mes: "Jul 26", recibidas: 2, cerradas: 3 },
    { mes: "Ago 26", recibidas: 4, cerradas: 2 },
    { mes: "Sep 26", recibidas: 5, cerradas: 4 },
    { mes: "Oct 26", recibidas: 3, cerradas: 3 },
    { mes: "Nov 26", recibidas: 6, cerradas: 4 },
    { mes: "Dic 26", recibidas: 4, cerradas: 2 },
  ];
  const totalRecibidas = solicitudesMensuales.reduce((a, m) => a + m.recibidas, 0);
  const totalCerradas = solicitudesMensuales.reduce((a, m) => a + m.cerradas, 0);
  const maxBar = Math.max(...solicitudesMensuales.flatMap((m) => [m.recibidas, m.cerradas]));
  const yMaxMensual = Math.max(Math.ceil((maxBar + 1) / 2) * 2, 8);
  const yTicksMensual = [];
  for (let i = 0; i <= yMaxMensual; i += 2) yTicksMensual.push(i);
  yTicksMensual.reverse();
  let acumRec = 0;
  let acumCer = 0;
  const acumulado = solicitudesMensuales.map((m) => {
    acumRec += m.recibidas;
    acumCer += m.cerradas;
    return { mes: m.mes, acumRecibidas: acumRec, acumCerradas: acumCer };
  });
  const maxAcum = Math.max(...acumulado.map((m) => m.acumRecibidas));
  const yMaxAcum = Math.max(Math.ceil((maxAcum + 2) / 5) * 5, 10);

  const funnel = [
    { etapa: "Solicitudes recibidas", n: 27, dias: "—" },
    { etapa: "Candidatos sourceados", n: 286, dias: "3 días promedio" },
    { etapa: "Filtro de CV aprobado", n: 142, dias: "5 días promedio" },
    { etapa: "Entrevista RH", n: 64, dias: "9 días promedio" },
    { etapa: "Entrevista con gerente", n: 28, dias: "14 días promedio" },
    { etapa: "Entrega de papeles / pruebas", n: 14, dias: "21 días promedio" },
    { etapa: "Oferta enviada", n: 8, dias: "26 días promedio" },
    { etapa: "Contratación efectiva", n: 6, dias: "33 días promedio" },
  ];
  const topFunnel = Math.max(1, funnel[1]?.n ?? 1); // Para escala de barras: usamos sourceados como referencia
  const totalContratados = funnel[funnel.length - 1].n;
  const tasaGlobal = funnel[1]?.n > 0 ? ((totalContratados / funnel[1].n) * 100).toFixed(1) : "0.0";

  const porArea = [
    { area: "Comercial",      recibidas: 8, cerradas: 6, dias: 28 },
    { area: "Posventa",       recibidas: 6, cerradas: 4, dias: 38 },
    { area: "Operaciones",    recibidas: 5, cerradas: 3, dias: 52 },
    { area: "Administración", recibidas: 4, cerradas: 3, dias: 41 },
    { area: "Dirección",      recibidas: 2, cerradas: 1, dias: 67 },
    { area: "RH",             recibidas: 2, cerradas: 1, dias: 22 },
  ];

  return (
    <div>
      <h2 style={S.h2}>Cobertura de Plantilla</h2>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Plantilla autorizada</div>
            <div style={S.kpiValue}>248</div>
            <div style={S.kpiBenchmark("green")}>Plan anual 2026: 248</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Cubierta</div>
            <div style={S.kpiValue}>228</div>
            <div style={S.kpiBenchmark("yellow")}>Objetivo: 248 (autorizado)</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>% cobertura</div>
            <div style={S.kpiValue}>92%</div>
            <div style={S.kpiBenchmark("yellow")}>Meta: ≥95% · Crítico: &lt;90%</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Vacantes &gt; 60 días</div>
            <div style={S.kpiValue}>2</div>
            <div style={S.kpiBenchmark("red")}>Meta: 0 · Alerta: ≥1</div>
          </div>
          <TrafficLight light="red" />
        </div>
      </div>

      <h3 style={S.h3}>Solicitudes — mes a mes y acumulado</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Mensual: barras agrupadas recibidas vs cerradas */}
        <ChartCopy label="Solicitudes mensuales recibidas vs cerradas"><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "20px 22px 16px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
          <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>
              Mensual · últimos 7 meses
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Recibidas vs Cerradas</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                <span style={{ color: "#c2410c", fontWeight: 700 }}>Recibidas</span> · <span style={{ color: "#475569", fontWeight: 700 }}>Cerradas</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 6 }}>
            <div style={{ position: "relative", height: 180 }}>
              {yTicksMensual.map((y) => (
                <div key={y} style={{ position: "absolute", right: 6, top: `${((yMaxMensual - y) / yMaxMensual) * 100}%`, transform: "translateY(-50%)", fontSize: 10, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                  {y}
                </div>
              ))}
            </div>
            <div>
              <div style={{ position: "relative", height: 180 }}>
                {yTicksMensual.map((y) => (
                  <div key={y} style={{ position: "absolute", left: 0, right: 0, top: `${((yMaxMensual - y) / yMaxMensual) * 100}%`, height: 1, background: y === 0 ? "#cbd5e1" : "#f1f5f9" }} />
                ))}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 12, padding: "0 8px" }}>
                  {solicitudesMensuales.map((m) => (
                    <div key={m.mes} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: "100%" }}>
                      {[
                        { val: m.recibidas, grad: "linear-gradient(180deg, #ea580c 0%, #c2410c 100%)", color: "#c2410c" },
                        { val: m.cerradas,  grad: "linear-gradient(180deg, #64748b 0%, #475569 100%)", color: "#475569" },
                      ].map((b, j) => (
                        <div key={j} style={{ width: 14, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: b.color, marginBottom: 2 }}>{b.val}</span>
                          <div style={{ width: "100%", height: `${(b.val / yMaxMensual) * 100}%`, background: b.grad, borderRadius: "2px 2px 0 0", minHeight: 2 }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, padding: "6px 8px 0" }}>
                {solicitudesMensuales.map((m) => (
                  <div key={m.mes} style={{ flex: 1, fontSize: 10, textAlign: "center", color: "#475569", fontWeight: 500 }}>{m.mes}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 10, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569" }}>
            <span>Recibidas YTD: <strong style={{ color: "#c2410c" }}>{totalRecibidas}</strong></span>
            <span>Cerradas YTD: <strong style={{ color: "#475569" }}>{totalCerradas}</strong></span>
            <span>Pendientes: <strong style={{ color: "#0f172a" }}>{totalRecibidas - totalCerradas}</strong></span>
          </div>
        </div></ChartCopy>

        {/* Acumulado: línea/área */}
        <ChartCopy label="Solicitudes acumuladas — backlog del proceso"><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "20px 22px 16px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
          <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>
              Acumulado · brecha recibidas vs cerradas
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Backlog del proceso</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Backlog actual <strong style={{ color: "#c2410c", fontVariantNumeric: "tabular-nums" }}>{totalRecibidas - totalCerradas}</strong>
              </div>
            </div>
          </div>
          {/* Acumulado en barras horizontales por mes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {acumulado.map((a) => (
              <div key={a.mes} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <div style={{ width: 50, color: "#475569", fontWeight: 500 }}>{a.mes}</div>
                <div style={{ flex: 1, position: "relative", height: 18, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${(a.acumRecibidas / yMaxAcum) * 100}%`, background: "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)", borderRadius: 3 }} />
                  <div style={{ position: "absolute", top: 2, bottom: 2, left: 0, width: `${(a.acumCerradas / yMaxAcum) * 100}%`, background: "linear-gradient(90deg, #64748b 0%, #475569 100%)", borderRadius: 3 }} />
                </div>
                <div style={{ width: 64, textAlign: "right", color: "#0f172a", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {a.acumCerradas} / {a.acumRecibidas}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 8, fontSize: 11, color: "#64748b" }}>
            Las barras naranjas marcan recibidas acumuladas; las grises encima muestran las cerradas. La diferencia es el backlog histórico.
          </div>
        </div></ChartCopy>
      </div>

      <h3 style={S.h3}>Embudo de reclutamiento (YTD)</h3>
      <ChartCopy label="Embudo de reclutamiento YTD"><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "20px 28px 18px", marginBottom: 16, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>
              De sourcing a contratación
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Conversión por etapa</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
            Tasa global <strong style={{ color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{tasaGlobal}%</strong> sourcing → contratación
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {funnel.map((s, idx) => {
            const widthPct = idx === 0 ? 100 : (s.n / topFunnel) * 100;
            const prevN = idx > 0 ? funnel[idx - 1].n : 0;
            const conversionFromPrev = idx > 1 && prevN > 0 ? ((s.n / prevN) * 100).toFixed(0) : null;
            const isSourcing = idx === 1;
            const grad = idx === 0
              ? "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)"
              : "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)";
            return (
              <div key={s.etapa} style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px 110px", gap: 10, alignItems: "center", fontSize: 12 }}>
                <div style={{ color: "#0f172a", fontWeight: 600 }}>{s.etapa}</div>
                <div style={{ position: "relative", height: 28, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      bottom: 0,
                      width: `${widthPct}%`,
                      transform: "translateX(-50%)",
                      background: grad,
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 12,
                      letterSpacing: 0.2,
                      boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                    }}
                  >
                    {s.n}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {isSourcing ? "(base)" : conversionFromPrev !== null ? `${conversionFromPrev}% conversión` : `${s.n} casos`}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.2 }}>
                  {s.dias}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 14, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569" }}>
          <span>Mayor caída: <strong style={{ color: "#c2410c" }}>Sourcing → Filtro CV</strong> (50% queda fuera)</span>
          <span>Cuello de botella: <strong style={{ color: "#c2410c" }}>Entrevista RH → Gerente</strong> (44% conversión, 5 días extra)</span>
        </div>
      </div></ChartCopy>

      <h3 style={S.h3}>Solicitudes por área (YTD)</h3>
      <ChartCopy label="Solicitudes por área YTD"><div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 22px", marginBottom: 16, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(() => {
            const maxPorArea = Math.max(1, ...porArea.map((x) => x.recibidas));
            return porArea.map((a) => {
            const pendientes = a.recibidas - a.cerradas;
            return (
              <div key={a.area} style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 90px", gap: 10, alignItems: "center", fontSize: 12 }}>
                <div style={{ color: "#0f172a", fontWeight: 600 }}>{a.area}</div>
                <div style={{ position: "relative", height: 18, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(a.recibidas / maxPorArea) * 100}%`, background: "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)", borderRadius: 3 }} />
                  <div style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: `${(a.cerradas / maxPorArea) * 100}%`, background: "linear-gradient(90deg, #64748b 0%, #475569 100%)", borderRadius: 3 }} />
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#0f172a", fontWeight: 600 }}>
                  {a.cerradas}/{a.recibidas} ({pendientes} pend.)
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: a.dias > 45 ? "#c2410c" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                  {a.dias} días prom.
                </div>
              </div>
            );
          });
          })()}
        </div>
      </div></ChartCopy>

      <h3 style={S.h3}>Vacantes abiertas</h3>
      <p style={{ ...S.hint, marginTop: -4 }}>Haz click en cualquier vacante para ver el expediente completo.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Folio</th>
            <th style={S.th}>Puesto</th>
            <th style={S.th}>Área</th>
            <th style={S.th}>Solicita</th>
            <th style={S.th}>Días abierta</th>
            <th style={S.th}>Etapa actual</th>
            <th style={S.th}>Candidatos</th>
            <th style={S.th}>Estado</th>
            <th style={S.th}></th>
          </tr>
        </thead>
        <tbody>
          {vacantes.map((v) => (
            <tr
              key={v.id}
              onClick={() => setVacanteAbierta(v)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={S.td}><strong>{v.id}</strong></td>
              <td style={S.td}>{v.puesto}</td>
              <td style={S.td}>{v.area}</td>
              <td style={S.td}>{v.solicita}</td>
              <td style={S.td}>{v.abierta}</td>
              <td style={S.td}>{v.etapa}</td>
              <td style={S.td}>{v.candidatos}</td>
              <td style={S.td}>
                {v.abierta > 60 ? <span style={S.badge("#fdecea")}>Crítica</span>
                  : v.abierta > 30 ? <span style={S.badge("#fff7e0")}>Alerta</span>
                  : <span style={S.badge("#e8f5e9")}>OK</span>}
              </td>
              <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12 }}>Ver expediente →</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de vacante */}
      {vacanteAbierta && (() => {
        const v = vacanteAbierta;
        const pctAvance = Math.round(((v.etapaActualIdx + 1) / etapasReclutamiento.length) * 100);
        const sla = 30;
        const slaPct = Math.min(100, (v.abierta / sla) * 100);
        const slaColor = v.abierta > 60 ? "#b00020" : v.abierta > 30 ? "#d97706" : "#0a7d2c";
        const gradAvance = pctAvance >= 100
          ? "linear-gradient(90deg, #71b248 0%, #5a9438 100%)"
          : pctAvance >= 60
          ? "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)"
          : "linear-gradient(90deg, #64748b 0%, #475569 100%)";
        return (
          <div
            onClick={() => setVacanteAbierta(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, padding: 24, width: 1080, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid #ccc" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ ...S.kpiLabel, color: "#64748b" }}>{v.id}</span>
                    {v.abierta > 60
                      ? <span style={S.badge("#fdecea")}>Crítica</span>
                      : v.abierta > 30
                      ? <span style={S.badge("#fff7e0")}>Alerta</span>
                      : <span style={S.badge("#e8f5e9")}>OK</span>}
                    <span style={S.badge("#f1f5f9")}>{v.etapa}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{v.puesto}</h3>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{v.area} · {v.gerenciaFuncional}</div>
                </div>
                <button onClick={() => setVacanteAbierta(null)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Días abierta</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: slaColor }}>{v.abierta}</div>
                  <div style={{ position: "relative", height: 5, background: "#f1f5f9", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${slaPct}%`, background: slaColor, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>SLA: ≤30 días</div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>% Avance (11 etapas)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{pctAvance}%</div>
                  <div style={{ position: "relative", height: 5, background: "#f1f5f9", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pctAvance}%`, background: gradAvance, borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Candidatos en pipeline</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{v.candidatos}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{v.candidatosTop.length} top destacados</div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Fecha objetivo</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{v.fechaObjetivo}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Apertura: {v.fechaApertura}</div>
                </div>
              </div>

              {/* Solicitante + Económico */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ ...S.card, marginBottom: 0 }}>
                  <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Solicitante y aprobación</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div><strong>Solicitante:</strong> {v.solicitanteNombre}</div>
                    <div style={{ color: "#475569", marginBottom: 6 }}>{v.solicitantePuesto}</div>
                    <div><strong>Jefe directo futuro:</strong> {v.jefeDirectoFuturo}</div>
                    <div><strong>Aprobado por:</strong> {v.aprobadoPor}</div>
                    <div><strong>Responsable RH:</strong> {v.responsableRH}</div>
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "#f8fafc", borderLeft: "3px solid #cbd5e1", borderRadius: 2, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    <strong>Razón:</strong> {v.razon}
                  </div>
                </div>
                <div style={{ ...S.card, marginBottom: 0 }}>
                  <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Banda salarial autorizada</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Mín</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>${v.bandaMin.toLocaleString("es-MX")}</div>
                    </div>
                    <div style={{ flex: 1, position: "relative", height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: "33%", top: 0, bottom: 0, width: "34%", background: "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)", borderRadius: 4 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Máx</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>${v.bandaMax.toLocaleString("es-MX")}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 11, color: "#666", marginBottom: 10 }}>
                    Mediana objetivo: <strong style={{ color: "#0f172a" }}>${v.bandaMediana.toLocaleString("es-MX")}</strong>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, borderTop: "1px solid #e5e5e5", paddingTop: 8 }}>
                    <div><strong>Bono firma target:</strong> {v.bonoFirmaTarget > 0 ? `$${v.bonoFirmaTarget.toLocaleString("es-MX")}` : "—"}</div>
                    <div><strong>Bono trimestral target:</strong> {v.bonoTrimestralTarget > 0 ? `$${v.bonoTrimestralTarget.toLocaleString("es-MX")}` : "—"}</div>
                    <div><strong>Prestaciones:</strong> {v.prestaciones}</div>
                  </div>
                </div>
              </div>

              {/* Sourcing */}
              <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Sourcing y canales</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, fontSize: 12 }}>
                {v.jobPostings.map((j, i) => (
                  <span key={i} style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4 }}>{j}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}><strong>Estrategia:</strong> {v.canalReclutamiento}</div>

              {/* Candidatos top */}
              <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Candidatos destacados ({v.candidatosTop.length} de {v.candidatos})</div>
              {v.candidatosTop.length > 0 ? (
                <table style={{ ...S.table, marginBottom: 16, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Candidato</th>
                      <th style={S.th}>Score</th>
                      <th style={S.th}>Etapa</th>
                      <th style={S.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.candidatosTop.map((c, i) => (
                      <tr key={i}>
                        <td style={S.td}>
                          <strong>{c.nombre}</strong>
                          {c.id && <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace" }}>{c.id}</div>}
                        </td>
                        <td style={S.td}>{c.score > 0 ? c.score.toFixed(1) : "—"}</td>
                        <td style={S.td}>{c.etapa}</td>
                        <td style={S.td}>{c.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: 12, color: "#666", padding: "10px 12px", background: "#f8fafc", borderRadius: 4, marginBottom: 16, fontStyle: "italic" }}>
                  Sin candidatos en pipeline aún. Sourcing en curso.
                </div>
              )}

              {/* Checklist de etapas */}
              <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Checklist · Etapas del proceso</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                {etapasReclutamiento.map((etapa, idx) => {
                  const isDone = idx < v.etapaActualIdx + 1;
                  const isCurrent = idx === v.etapaActualIdx;
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px",
                      background: isDone ? "#f6fbf6" : isCurrent ? "#fff7ed" : "#fafafa",
                      border: `1px solid ${isDone ? "#86efac" : isCurrent ? "#fed7aa" : "#e5e5e5"}`,
                      borderRadius: 4,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: isDone ? "#0a7d2c" : isCurrent ? "#c2410c" : "#cbd5e1",
                        color: "#fff",
                        fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {isDone && !isCurrent ? "✓" : idx + 1}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: "#0f172a", flex: 1 }}>{etapa}</span>
                      {isCurrent && <span style={{ fontSize: 10, color: "#c2410c", fontWeight: 700, padding: "1px 6px", background: "#ffedd5", borderRadius: 10 }}>EN CURSO</span>}
                    </div>
                  );
                })}
              </div>

              {/* Observaciones */}
              <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Observaciones</div>
              <div style={{ fontSize: 13, padding: "10px 12px", background: "#fff7e0", borderLeft: "3px solid #d97706", borderRadius: 4, marginBottom: 16, lineHeight: 1.5 }}>
                {v.observaciones}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: "1px solid #eee" }}>
                <button style={S.btn} onClick={() => setVacanteAbierta(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// =============================================================
// 6. ROTACIÓN
// =============================================================
function Rotacion() {
  const [conceptoAbierto, setConceptoAbierto] = useState(null);
  const [bajaSeleccionadaId, setBajaSeleccionadaId] = useState(null);
  const [mostrarTodosCasos, setMostrarTodosCasos] = useState(false);
  const [vistaRot, setVistaRot] = useState("costo"); // "costo" | "pct"
  const [areaAbierta, setAreaAbierta] = useState(null);

  // Serie mes a mes (Jul–Dic 2026) — costo de rotación y % de rotación mensual.
  const rotacionMensual = [
    { mes: "Jul", anio: "'26", bajas: 2, costo: 198000, pct: 0.8 },
    { mes: "Ago", anio: "'26", bajas: 4, costo: 352000, pct: 1.6 },
    { mes: "Sep", anio: "'26", bajas: 3, costo: 286000, pct: 1.2 },
    { mes: "Oct", anio: "'26", bajas: 5, costo: 465000, pct: 2.0 },
    { mes: "Nov", anio: "'26", bajas: 3, costo: 243000, pct: 1.2 },
    { mes: "Dic", anio: "'26", bajas: 2, costo: 178000, pct: 0.8 },
  ];

  const bajas = [
    { area: "Comercial", n: 7, motivo: "Mejor oferta", tipo: "Voluntaria" },
    { area: "Posventa", n: 4, motivo: "Ambiente", tipo: "Voluntaria" },
    { area: "Operaciones", n: 3, motivo: "Desempeño", tipo: "Involuntaria" },
    { area: "Administración", n: 3, motivo: "Personal", tipo: "Voluntaria" },
  ];

  const costoUnitario = {
    directos: 25000, indirectos: 18000,
  };
  const totalBajas = bajas.reduce((a, r) => a + r.n, 0);
  const costoTotal = (costoUnitario.directos + costoUnitario.indirectos) * totalBajas;

  // Bajas representativas del periodo (8 de 27) — cada una con perfil completo y costo específico por concepto.
  const bajasRecientes = [
    {
      id: "B-001", empNo: "EMP-0287", nombre: "Javier Ortega", email: "javier.ortega@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Dirección Comercial Norte", puesto: "Gerente Comercial Regional",
      fechaIngreso: "12-sep-2017", fechaAviso: "08-mar-2026", fecha: "22-mar-2026",
      años: 8.6, sueldo: 55000, sueldoIntegrado: 62700,
      jefe: "Lic. M. Hernández (Dir. Gral.)", reportes: 6,
      motivo: "Mejor oferta (competencia directa)",
      motivoExtendido: "Migra a un OEM competidor con paquete 25% superior. Llevaba 2 años buscando promoción interna sin éxito; la última revisión salarial extraordinaria fue rechazada por Comité en Ene 2026.",
      observacionesJefe: "Excelente desempeño y relación con cartera. La fuga era predecible: no había plan de carrera ni revisión salarial extraordinaria. Reemplazo difícil; 2 cuentas Tier-1 ya migraron parcialmente con él.",
      tipo: "Voluntaria",
      costos: { directo: 62500, indirecto: 38000, oculto: 95000, hundido: 78000 },
    },
    {
      id: "B-002", empNo: "EMP-0156", nombre: "Carlos Reyes", email: "carlos.reyes@empresa.com.mx",
      area: "Operaciones", gerenciaFuncional: "Operaciones Planta 2", puesto: "Supervisor de Turno",
      fechaIngreso: "03-oct-2018", fechaAviso: "22-ene-2026", fecha: "05-feb-2026",
      años: 7.4, sueldo: 35000, sueldoIntegrado: 39200,
      jefe: "L. Cano (Gte. Operaciones)", reportes: 14,
      motivo: "Desempeño debajo del estándar",
      motivoExtendido: "Tres evaluaciones consecutivas en zona 'Mejorar'. PIP cerrado sin recuperación; baja involuntaria con convenio. Reincidencia en errores de paro de línea (3 eventos > 2h en 2025).",
      observacionesJefe: "Conocía profundamente la planta, pero su capacidad de liderazgo no creció al ritmo del puesto. La baja era inevitable; convenio liquidado al 70% del finiquito de ley.",
      tipo: "Involuntaria",
      costos: { directo: 48200, indirecto: 22500, oculto: 52000, hundido: 41000 },
    },
    {
      id: "B-003", empNo: "EMP-0324", nombre: "Alejandro Méndez", email: "alejandro.mendez@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Centro", puesto: "Asesor Comercial Sr.",
      fechaIngreso: "18-feb-2021", fechaAviso: "26-feb-2026", fecha: "12-mar-2026",
      años: 5.2, sueldo: 28000, sueldoIntegrado: 31800,
      jefe: "G. Pérez (Gte. Comercial Centro)", reportes: 0,
      motivo: "Mejor oferta (otra industria)",
      motivoExtendido: "Cambia a sector financiero con paquete +20% y mejor estructura de comisiones. Tenía conversaciones desde Dic 2025 — RH no detectó la señal.",
      observacionesJefe: "Top performer del trimestre. Pérdida sensible para cuota Q2. Recomendado revisar paquete de retención del resto del equipo Sr.",
      tipo: "Voluntaria",
      costos: { directo: 32800, indirecto: 18500, oculto: 38500, hundido: 26000 },
    },
    {
      id: "B-004", empNo: "EMP-0419", nombre: "Patricia Lozano", email: "patricia.lozano@empresa.com.mx",
      area: "Administración", gerenciaFuncional: "Finanzas", puesto: "Analista Financiero",
      fechaIngreso: "05-jul-2021", fechaAviso: "06-ene-2026", fecha: "15-ene-2026",
      años: 4.8, sueldo: 26000, sueldoIntegrado: 29100,
      jefe: "R. Solís (Gte. Finanzas)", reportes: 0,
      motivo: "Reubicación familiar",
      motivoExtendido: "Su pareja fue trasladada a Querétaro. Solicitó esquema remoto que no se autorizó por política de área. Salida amigable.",
      observacionesJefe: "Excelente analista. Se ofreció recomendación abierta y opción de regresar. Caso útil para reabrir discusión de trabajo remoto en Finanzas.",
      tipo: "Voluntaria",
      costos: { directo: 28900, indirecto: 17200, oculto: 34000, hundido: 22500 },
    },
    {
      id: "B-005", empNo: "EMP-0512", nombre: "Mariana Ortiz", email: "mariana.ortiz@empresa.com.mx",
      area: "Posventa", gerenciaFuncional: "Taller Sucursal Sur", puesto: "Mecánico A",
      fechaIngreso: "10-ene-2023", fechaAviso: "13-feb-2026", fecha: "28-feb-2026",
      años: 3.1, sueldo: 18000, sueldoIntegrado: 20100,
      jefe: "L. Cano (Gte. Posventa)", reportes: 0,
      motivo: "Ambiente del taller",
      motivoExtendido: "Entrevista de salida menciona trato hostil del jefe directo y desigualdad en asignación de órdenes de trabajo. 2 reportes previos a RH en 2025 sin acción documentada.",
      observacionesJefe: "RH detecta patrón: 3 bajas voluntarias del mismo taller en 6 meses, todas con el mismo motivo. Se programó intervención de clima en Mar 2026.",
      tipo: "Voluntaria",
      costos: { directo: 19500, indirecto: 14800, oculto: 28000, hundido: 15500 },
    },
    {
      id: "B-006", empNo: "EMP-0598", nombre: "Diana Castro", email: "diana.castro@empresa.com.mx",
      area: "Posventa", gerenciaFuncional: "Taller Sucursal Sur", puesto: "Recepcionista de Servicio",
      fechaIngreso: "27-nov-2023", fechaAviso: "18-mar-2026", fecha: "03-abr-2026",
      años: 2.3, sueldo: 14000, sueldoIntegrado: 15700,
      jefe: "L. Cano (Gte. Posventa)", reportes: 0,
      motivo: "Ambiente / falta de crecimiento",
      motivoExtendido: "Misma razón que Ortiz (B-005) — mismo taller, mismo jefe. Solicitó crecimiento a Coord. Servicio y se le negó por 'no perfil'.",
      observacionesJefe: "Confirma patrón sistemático en taller Sur. Caso escalado a Dirección de Operaciones para revisión del liderazgo de la sucursal.",
      tipo: "Voluntaria",
      costos: { directo: 14200, indirecto: 12500, oculto: 22000, hundido: 9800 },
    },
    {
      id: "B-007", empNo: "EMP-0701", nombre: "Roberto Núñez", email: "roberto.nunez@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Sur", puesto: "Asesor Comercial Jr.",
      fechaIngreso: "08-oct-2024", fechaAviso: "07-abr-2026", fecha: "20-abr-2026",
      años: 1.5, sueldo: 18000, sueldoIntegrado: 20500,
      jefe: "G. Pérez (Gte. Comercial Centro)", reportes: 0,
      motivo: "Mejor oferta (puesto idéntico)",
      motivoExtendido: "Distribuidor competidor lo invitó con sueldo +15%. Sin contraoferta posible por política para puestos Jr.",
      observacionesJefe: "Buen reclutamiento, dejó cuota a 60% YTD. Indica que el sueldo de entrada para Jr está por debajo del mercado local.",
      tipo: "Voluntaria",
      costos: { directo: 11800, indirecto: 14000, oculto: 25000, hundido: 8500 },
    },
    {
      id: "B-008", empNo: "EMP-0732", nombre: "Sofía Beltrán", email: "sofia.beltran@empresa.com.mx",
      area: "Operaciones", gerenciaFuncional: "Operaciones Planta 2", puesto: "Operador A",
      fechaIngreso: "15-jul-2025", fechaAviso: "—", fecha: "18-mar-2026",
      años: 0.8, sueldo: 13500, sueldoIntegrado: 15100,
      jefe: "C. Reyes (Supervisor Turno)", reportes: 0,
      motivo: "Desempeño en periodo de prueba",
      motivoExtendido: "Baja involuntaria al término del periodo de prueba extendido. Reportó dificultad para alcanzar curva esperada en línea de soldadura.",
      observacionesJefe: "Caso de mismatch perfil-puesto. Recomendado revisar pruebas técnicas previas a la contratación para operadores de soldadura.",
      tipo: "Involuntaria",
      costos: { directo: 6500, indirecto: 11800, oculto: 18500, hundido: 4500 },
    },
    {
      id: "B-009", empNo: "EMP-0421", nombre: "Alberto Galindo", email: "alberto.galindo@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Centro", puesto: "Asesor Comercial Sr.",
      fechaIngreso: "06-ago-2021", fechaAviso: "20-ene-2026", fecha: "08-feb-2026",
      años: 4.5, sueldo: 26000, sueldoIntegrado: 29500,
      jefe: "G. Pérez (Gte. Comercial Centro)", reportes: 0,
      motivo: "Mejor oferta (mismo sector)",
      motivoExtendido: "Distribuidor competidor en zona poniente lo contrató con paquete +18% más bono de firma. Su salida arrastró al Jr. Roberto Núñez (B-007) que era su mentee.",
      observacionesJefe: "Patrón preocupante: 2 voluntarias del mismo equipo en 3 meses con destino al mismo competidor. Se requiere auditoría de paquete vs mercado y revisión del esquema de comisiones.",
      tipo: "Voluntaria",
      costos: { directo: 27500, indirecto: 18000, oculto: 34000, hundido: 22000 },
    },
    {
      id: "B-010", empNo: "EMP-0688", nombre: "Lucía Aguilar", email: "lucia.aguilar@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Sur", puesto: "Asesor Comercial Jr.",
      fechaIngreso: "14-ene-2024", fechaAviso: "23-mar-2026", fecha: "06-abr-2026",
      años: 2.0, sueldo: 17000, sueldoIntegrado: 19200,
      jefe: "G. Pérez (Gte. Comercial Centro)", reportes: 0,
      motivo: "Sueldo debajo del mercado local",
      motivoExtendido: "Entrevista de salida revela que la mediana de mercado para su perfil está en $20-22K. Ya tenía 3 ofertas externas pendientes al renunciar.",
      observacionesJefe: "Tercera baja del equipo Jr en Q1 con la misma razón. Caso fuerte para subir banda salarial de entrada o repensar la estructura de comisiones temprana.",
      tipo: "Voluntaria",
      costos: { directo: 13800, indirecto: 13500, oculto: 24000, hundido: 9500 },
    },
    {
      id: "B-011", empNo: "EMP-0398", nombre: "Daniel Vázquez", email: "daniel.vazquez@empresa.com.mx",
      area: "Posventa", gerenciaFuncional: "Taller Sucursal Norte", puesto: "Mecánico B",
      fechaIngreso: "11-oct-2021", fechaAviso: "30-ene-2026", fecha: "14-feb-2026",
      años: 4.4, sueldo: 16000, sueldoIntegrado: 18100,
      jefe: "L. Cano (Gte. Posventa)", reportes: 0,
      motivo: "Cambio de giro (independiente)",
      motivoExtendido: "Abre su propio taller mecánico con socio. Llevaba 18 meses con plan de salida documentado.",
      observacionesJefe: "Salida planeada, sin acrimonia. Sigue siendo proveedor ocasional. Útil mantener buena relación por su red de clientes Tier-2.",
      tipo: "Voluntaria",
      costos: { directo: 18200, indirecto: 12800, oculto: 22000, hundido: 13500 },
    },
    {
      id: "B-012", empNo: "EMP-0712", nombre: "Karla Romero", email: "karla.romero@empresa.com.mx",
      area: "Posventa", gerenciaFuncional: "Taller Sucursal Sur", puesto: "Asesor de Servicio",
      fechaIngreso: "07-jul-2024", fechaAviso: "13-mar-2026", fecha: "27-mar-2026",
      años: 1.7, sueldo: 15000, sueldoIntegrado: 16900,
      jefe: "L. Cano (Gte. Posventa)", reportes: 0,
      motivo: "Ambiente del taller",
      motivoExtendido: "Tercera baja consecutiva del taller Sur por el mismo motivo (después de Ortiz B-005 y Castro B-006). Patrón sistemático con el mismo jefe directo.",
      observacionesJefe: "Confirma diagnóstico: el taller Sur tiene problema de liderazgo. Intervención formal autorizada por Dirección de Operaciones para Abr-May 2026.",
      tipo: "Voluntaria",
      costos: { directo: 11500, indirecto: 12000, oculto: 19500, hundido: 8000 },
    },
    {
      id: "B-013", empNo: "EMP-0455", nombre: "Andrés Solano", email: "andres.solano@empresa.com.mx",
      area: "Administración", gerenciaFuncional: "Contabilidad", puesto: "Auxiliar Contable Sr.",
      fechaIngreso: "02-may-2022", fechaAviso: "18-feb-2026", fecha: "04-mar-2026",
      años: 3.8, sueldo: 17000, sueldoIntegrado: 19100,
      jefe: "R. Solís (Gte. Finanzas)", reportes: 0,
      motivo: "Promoción en otra empresa",
      motivoExtendido: "Asciende a Contador General en una empresa más pequeña. Crecimiento que aquí no podía darse en menos de 3-4 años por estructura organizacional.",
      observacionesJefe: "Excelente colaborador con curva clara. Refleja que la estructura de Contabilidad no tiene escalones intermedios atractivos para perfiles ambiciosos.",
      tipo: "Voluntaria",
      costos: { directo: 19200, indirecto: 13500, oculto: 26000, hundido: 14500 },
    },
    {
      id: "B-014", empNo: "EMP-0233", nombre: "Beatriz Cordero", email: "beatriz.cordero@empresa.com.mx",
      area: "Administración", gerenciaFuncional: "RH", puesto: "Asistente de RH Sr.",
      fechaIngreso: "19-feb-2020", fechaAviso: "—", fecha: "12-mar-2026",
      años: 6.1, sueldo: 22000, sueldoIntegrado: 24700,
      jefe: "Dir. RH", reportes: 0,
      motivo: "Cambio de sector (consultoría)",
      motivoExtendido: "Migra a firma de consultoría en RH con paquete +30%. Llevaba 14 meses preparándose con certificación SHRM por su cuenta.",
      observacionesJefe: "Pérdida significativa para el área. Su salida obliga a redistribuir 3 procesos críticos (onboarding, clima y compensaciones). Sucesión no estaba lista.",
      tipo: "Voluntaria",
      costos: { directo: 31500, indirecto: 16800, oculto: 36000, hundido: 28500 },
    },
    {
      id: "B-015", empNo: "EMP-0814", nombre: "Hugo Marín", email: "hugo.marin@empresa.com.mx",
      area: "Operaciones", gerenciaFuncional: "Operaciones Planta 1", puesto: "Operador A",
      fechaIngreso: "23-sep-2023", fechaAviso: "08-ene-2026", fecha: "29-ene-2026",
      años: 2.4, sueldo: 14000, sueldoIntegrado: 15700,
      jefe: "M. Vargas (Supervisor Turno 2)", reportes: 0,
      motivo: "Faltas reiteradas e incumplimientos",
      motivoExtendido: "Baja involuntaria documentada tras 4 amonestaciones escritas y 1 PIP fallido. Tres incidentes de tardanza > 60 min en 30 días.",
      observacionesJefe: "Caso recurrente del turno 2. Hay patrón de relajamiento que requiere revisión del liderazgo del supervisor a cargo.",
      tipo: "Involuntaria",
      costos: { directo: 12800, indirecto: 11500, oculto: 20000, hundido: 9800 },
    },
    {
      id: "B-016", empNo: "EMP-0775", nombre: "Valeria Núñez", email: "valeria.nunez@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Centro", puesto: "Asesor Comercial Jr.",
      fechaIngreso: "11-feb-2025", fechaAviso: "01-abr-2026", fecha: "15-abr-2026",
      años: 1.2, sueldo: 17000, sueldoIntegrado: 19100,
      jefe: "G. Pérez (Gte. Comercial Centro)", reportes: 0,
      motivo: "Mejor oferta (misma industria, otra plaza)",
      motivoExtendido: "Se muda a distribuidor competidor en otra ciudad por reubicación de pareja + paquete +15%. Salida amigable.",
      observacionesJefe: "Cuarta baja consecutiva del equipo Comercial Centro en Q1-Q2. Patrón consistente: paquete competitivo bajo de entrada. Caso de negocio armado para Comité.",
      tipo: "Voluntaria",
      costos: { directo: 10500, indirecto: 13000, oculto: 23000, hundido: 7200 },
    },
    {
      id: "B-017", empNo: "EMP-0142", nombre: "Fernando Aldama", email: "fernando.aldama@empresa.com.mx",
      area: "Comercial", gerenciaFuncional: "Comercial Norte", puesto: "Jefe de Tienda",
      fechaIngreso: "14-jun-2019", fechaAviso: "—", fecha: "11-feb-2026",
      años: 6.7, sueldo: 32000, sueldoIntegrado: 36100,
      jefe: "Gerencia Comercial Norte (vacante)", reportes: 9,
      motivo: "Desempeño y faltas a integridad",
      motivoExtendido: "Baja involuntaria por hallazgos en auditoría interna: descuentos no autorizados a clientes vinculados. Hechos documentados con evidencia y reportados a Compliance.",
      observacionesJefe: "Salida obligada por hallazgos de Compliance. Caso de severidad alta — sucesión del puesto pendiente. Reemplazo se busca con due diligence reforzada.",
      tipo: "Involuntaria",
      costos: { directo: 44500, indirecto: 21000, oculto: 48000, hundido: 38500 },
    },
  ];

  // Costo económico real de cada baja (suma de los 4 componentes) y total real YTD por área.
  const costoTotalBaja = (b) => b.costos.directo + b.costos.indirecto + b.costos.oculto + b.costos.hundido;
  const costoRealArea = (area) => bajasRecientes.filter((b) => b.area === area).reduce((a, b) => a + costoTotalBaja(b), 0);

  // Notas personalizadas sobre el desglose, por baja y concepto. Si no hay, se usa la nota genérica del concepto.
  const notasPersonalizadas = {
    "B-001": {
      directo: {
        "Indemnización 90 días (LFT Art. 50)": "3 meses × sueldo integrado $62,700/mes — capado por LFT a $35,000",
        "Vacaciones pendientes + prima vacacional": "16 días no gozados de 2025 + prima 25%",
        "Aguinaldo proporcional": "78 días devengados (ene-mar 2026)",
        "Prima de antigüedad (12 días/año)": "12 días × 8.6 años, capado a 2 SM ($414/día)",
      },
      indirecto: {
        "Agencia / headhunter / job boards": "Headhunter especializado en mando comercial — fee 18% sueldo anual",
        "Tiempo de RH (sourcing + entrevistas)": "~45 horas (3 rondas, 6 finalistas, comité de selección)",
        "Capacitación inicial (3-4 semanas)": "Inmersión a cartera y gobernanza con consultor externo",
      },
      oculto: {
        "Productividad reducida (primeros 6 meses)": "Cartera migró parcialmente — reemplazo requiere 9 meses para recuperar cuota",
        "Errores y reprocesos imputables": "Pérdida estimada de 2 cuentas Tier-1 (auditado por Comercial)",
        "Tiempo de supervisión adicional": "Director General asume 8 h/sem hasta integración del reemplazo",
        "Conocimiento perdido (contexto, relaciones)": "Red de contactos con 14 distribuidores aliados — no transferible",
      },
      hundido: {
        "Cursos formales tomados": "Diplomado Sales Mgmt INCAE + Negociación Wharton (online)",
        "Certificaciones pagadas por la empresa": "Certificación de marca OEM × 3 renovaciones anuales",
        "Mentoría y coaching ejecutivo": "18 meses con consultor externo (Coaching Ejecutivo Tier 1)",
        "Tiempo invertido por managers": "Sesiones quincenales con Dirección General durante 4 años",
      },
    },
    "B-002": {
      directo: {
        "Indemnización 90 días (LFT Art. 50)": "Convenio al 70% del finiquito de ley (baja involuntaria documentada)",
        "Prima de antigüedad (12 días/año)": "12 días × 7.4 años, sin tope (no aplicaba)",
      },
      oculto: {
        "Productividad reducida (primeros 6 meses)": "Línea de producción operó a 75% durante 4 meses",
        "Errores y reprocesos imputables": "2 eventos de paro durante el PIP × $18K c/u",
      },
      hundido: {
        "Cursos formales tomados": "Lean Manufacturing + Liderazgo de Piso",
        "Certificaciones pagadas por la empresa": "Certif. Seguridad Industrial NOM-019 (3 renovaciones)",
      },
    },
    "B-003": {
      directo: {
        "Indemnización 90 días (LFT Art. 50)": "3 meses × sueldo integrado $31,800",
        "Vacaciones pendientes + prima vacacional": "11 días pendientes + prima 25%",
      },
      indirecto: {
        "Agencia / headhunter / job boards": "Job boards premium + referido interno (fee híbrido)",
      },
      oculto: {
        "Productividad reducida (primeros 6 meses)": "Top performer — reemplazo Jr a 40% de cuota los primeros 6 meses",
      },
      hundido: {
        "Cursos formales tomados": "Programa interno de Asesor Sr (16 semanas) + Negociación Avanzada",
      },
    },
    "B-004": {
      directo: {
        "Indemnización 90 días (LFT Art. 50)": "No aplicó — renuncia voluntaria. Sólo finiquito de ley",
        "Prima de antigüedad (12 días/año)": "12 días × 4.8 años, capado a 2 SM",
      },
      hundido: {
        "Certificaciones pagadas por la empresa": "Certif. NIIF Plenas + curso de Power BI avanzado",
      },
    },
    "B-008": {
      directo: {
        "Indemnización 90 días (LFT Art. 50)": "Periodo de prueba — sólo días trabajados, sin indemnización 90 días",
        "Prima de antigüedad (12 días/año)": "0.8 años — monto mínimo",
      },
      hundido: {
        "Cursos formales tomados": "Capacitación inicial de operador (2 semanas)",
        "Mentoría y coaching ejecutivo": "No aplica para nivel operativo en periodo de prueba",
      },
    },
  };

  // Factor de escalamiento por componente — refleja cómo cada componente varía con el perfil del colaborador.
  // Algunos componentes son fijos (gastos admin), otros escalan con sueldo o antigüedad, otros sólo aplican a ciertos perfiles.
  const sueldoPromedio = 25000;
  const antiguedadPromedio = 4.2;
  const escalaPorComponente = {
    directo: {
      "Indemnización 90 días (LFT Art. 50)": (b) => Math.min(2.3, b.sueldoIntegrado / 20000) * (b.años < 1 ? 0.2 : 1),
      "Vacaciones pendientes + prima vacacional": (b) => (b.sueldo / sueldoPromedio) * (Math.min(b.años, 5) / antiguedadPromedio),
      "Aguinaldo proporcional": (b) => b.sueldo / sueldoPromedio,
      "Prima de antigüedad (12 días/año)": (b) => Math.min(b.sueldo / sueldoPromedio, 1.65) * (b.años / antiguedadPromedio),
      "Gastos administrativos y notariales": (b) => 1 + (b.tipo === "Involuntaria" ? 0.25 : 0),
    },
    indirecto: {
      "Agencia / headhunter / job boards": (b) => Math.pow(b.sueldo / sueldoPromedio, 1.4),
      "Tiempo de RH (sourcing + entrevistas)": (b) => 0.7 + 0.5 * (b.sueldo / sueldoPromedio),
      "Pruebas técnicas y psicométricas": () => 1,
      "Onboarding y materiales": (b) => 0.85 + 0.15 * (b.sueldo / sueldoPromedio),
      "Capacitación inicial (3-4 semanas)": (b) => 0.8 + 0.4 * (b.sueldo / sueldoPromedio),
    },
    oculto: {
      "Productividad reducida (primeros 6 meses)": (b) => Math.pow(b.sueldo / sueldoPromedio, 1.3),
      "Errores y reprocesos imputables": (b) => 0.6 + 0.6 * (b.sueldo / sueldoPromedio),
      "Tiempo de supervisión adicional": (b) => 0.8 + 0.4 * (b.sueldo / sueldoPromedio),
      "Impacto en clima del equipo": (b) => b.tipo === "Voluntaria" ? 1.1 : 0.6,
      "Conocimiento perdido (contexto, relaciones)": (b) => (b.años / antiguedadPromedio) * (b.sueldo / sueldoPromedio),
    },
    hundido: {
      "Cursos formales tomados": (b) => b.años / antiguedadPromedio,
      "Certificaciones pagadas por la empresa": (b) => b.años / antiguedadPromedio,
      "Mentoría y coaching ejecutivo": (b) => b.sueldo >= 30000 ? (b.años / antiguedadPromedio) * 1.4 : 0.15,
      "Tiempo invertido por managers": (b) => Math.min(b.años / antiguedadPromedio, 2),
      "Conocimiento de procesos internos": (b) => b.años / antiguedadPromedio,
    },
  };

  // Calcula el desglose personalizado: aplica escalamiento por componente y normaliza al total real de la baja.
  // Devuelve cada componente con monto personalizado, % de variación vs el estándar de la empresa, y nota personalizada si existe.
  const breakdownPersonalizado = (baja, concepto) => {
    const target = baja.costos[concepto.campoCosto];
    const factores = concepto.desglose.map((d) => {
      const fn = escalaPorComponente[concepto.key]?.[d.label];
      return fn ? fn(baja) : 1;
    });
    const rawValues = concepto.desglose.map((d, i) => d.monto * factores[i]);
    const rawSum = rawValues.reduce((a, b) => a + b, 0) || 1;
    const ajuste = target / rawSum;
    const overrides = notasPersonalizadas[baja.id]?.[concepto.key] || {};
    return concepto.desglose.map((d, i) => {
      const monto = Math.round((rawValues[i] * ajuste) / 100) * 100;
      const variacionPct = ((monto - d.monto) / d.monto) * 100;
      return {
        label: d.label,
        monto,
        montoEstandar: d.monto,
        variacionPct,
        nota: overrides[d.label] || d.nota,
      };
    });
  };

  const conceptosCosto = [
    {
      key: "directo",
      campoCosto: "directo",
      concepto: "Liquidación / finiquito",
      tipo: "Directo",
      tipoColor: "#fdecea",
      monto: 25000,
      descripcion: "Erogaciones legales obligatorias al término de la relación laboral. Son los más visibles porque pasan por nómina y contabilidad.",
      formulaBase: "Calculado para una baja con 4.2 años promedio de antigüedad y sueldo mensual de $25,000. El costo real escala con antigüedad × sueldo integrado.",
      desglose: [
        { label: "Indemnización 90 días (LFT Art. 50)", monto: 15000, nota: "3 meses de salario integrado" },
        { label: "Vacaciones pendientes + prima vacacional", monto: 3500, nota: "Días no gozados a la fecha de baja" },
        { label: "Aguinaldo proporcional", monto: 2800, nota: "Días devengados del año en curso" },
        { label: "Prima de antigüedad (12 días/año)", monto: 2500, nota: "Tope: 2 salarios mínimos × días" },
        { label: "Gastos administrativos y notariales", monto: 1200, nota: "Tramitación y firma de convenio" },
      ],
      casosDetalle: "El costo aumenta con la antigüedad y el sueldo integrado. Las bajas voluntarias suelen liquidar 40-60% menos vía convenio.",
      mitigacion: "Difícil de mitigar — son obligaciones legales. Sí se puede optimizar negociando convenios o renuncias voluntarias documentadas.",
      mitigacionColor: "#fff7e0",
    },
    {
      key: "indirecto",
      campoCosto: "indirecto",
      concepto: "Reclutamiento + capacitación reemplazo",
      tipo: "Indirecto",
      tipoColor: "#eef5ff",
      monto: 18000,
      descripcion: "Costo de reemplazar a la persona: atraer al nuevo candidato, evaluarlo y ponerlo operativo.",
      formulaBase: "Promedio por baja basado en histórico 2025-2026. Escala con el nivel del puesto: posiciones senior o de mando duplican el costo de búsqueda.",
      desglose: [
        { label: "Agencia / headhunter / job boards", monto: 9000, nota: "15% del sueldo anual o fee fijo" },
        { label: "Tiempo de RH (sourcing + entrevistas)", monto: 3500, nota: "~22 horas × $160/h cargado" },
        { label: "Pruebas técnicas y psicométricas", monto: 1200, nota: "Batería estándar por puesto" },
        { label: "Onboarding y materiales", monto: 1800, nota: "Equipo, accesos, kit de bienvenida" },
        { label: "Capacitación inicial (3-4 semanas)", monto: 2500, nota: "Instructor + tiempo del nuevo colaborador" },
      ],
      casosDetalle: "Los puestos gerenciales y de Comercial Sr. concentran el mayor costo de reemplazo por el uso de headhunter externo.",
      mitigacion: "Banco de talento pre-calificado, referidos internos y onboarding documentado reducen este costo entre 25-40%.",
      mitigacionColor: "#f6fbf6",
    },
  ];

  return (
    <div>
      <h2 style={S.h2}>Rotación</h2>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Bajas YTD</div>
            <div style={S.kpiValue}>{totalBajas}</div>
            <div style={S.kpiBenchmark("yellow")}>Meta anual: ≤30 bajas</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>% rotación anualizada</div>
            <div style={S.kpiValue}>20.6%</div>
            <div style={S.kpiBenchmark("red")}>Industria 15-18% · Meta: ≤18%</div>
          </div>
          <TrafficLight light="red" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Costo unitario promedio</div>
            <div style={S.kpiValue}>$43,000</div>
            <div style={S.kpiBenchmark("yellow")}>Histórico promedio: $38,000</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Costo total estimado</div>
            <div style={S.kpiValue}>${(costoTotal / 1000000).toFixed(2)}M</div>
            <div style={S.kpiBenchmark("yellow")}>Presupuesto anual: $1.0M</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
      </div>

      <h3 style={S.h3}>Anatomía del costo por baja</h3>
      <p style={{ ...S.hint, marginTop: -4 }}>Haz click en cada concepto para ver el desglose.</p>
      {(() => {
        const mesesMap = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
        const parseBajaFecha = (s) => {
          const parts = s.split("-");
          return new Date(parseInt(parts[2]), mesesMap[parts[1]], parseInt(parts[0]));
        };
        const maxDate = bajasRecientes.reduce((m, b) => {
          const d = parseBajaFecha(b.fecha);
          return d > m ? d : m;
        }, new Date(0));
        const nombreMesActual = Object.keys(mesesMap).find((k) => mesesMap[k] === maxDate.getMonth());
        const labelMesActual = nombreMesActual ? `${nombreMesActual.charAt(0).toUpperCase() + nombreMesActual.slice(1)} ${maxDate.getFullYear()}` : "—";
        const bajasMesActual = bajasRecientes.filter((b) => {
          const d = parseBajaFecha(b.fecha);
          return d.getMonth() === maxDate.getMonth() && d.getFullYear() === maxDate.getFullYear();
        }).length;
        return (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Concepto</th>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Bajas del mes ({labelMesActual})</th>
                <th style={S.th}>Bajas acumuladas ({totalBajas} bajas acumuladas)</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {conceptosCosto.map((c) => (
                <tr
                  key={c.key}
                  onClick={() => {
                    setConceptoAbierto(c);
                    const masReciente = [...bajasRecientes].sort((a, b) => b.costos[c.campoCosto] - a.costos[c.campoCosto])[0];
                    setBajaSeleccionadaId(masReciente.id);
                    setMostrarTodosCasos(false);
                  }}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={S.td}><strong>{c.concepto}</strong></td>
                  <td style={S.td}><span style={S.badge(c.tipoColor)}>{c.tipo}</span></td>
                  <td style={S.td}>{bajasMesActual}</td>
                  <td style={S.td}>{totalBajas}</td>
                  <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12 }}>Ver desglose →</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      <h3 style={S.h3}>Rotación por área</h3>
      <p style={{ ...S.hint, marginTop: 0, marginBottom: 8 }}>Haz clic en un área para ver el desglose de sus bajas.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Área</th>
            <th style={S.th}>Bajas</th>
            <th style={S.th}>Motivo principal</th>
            <th style={S.th}>Tipo</th>
            <th style={S.th}>Costo real YTD</th>
            <th style={S.th}></th>
          </tr>
        </thead>
        <tbody>
          {bajas.map((b) => (
            <tr
              key={b.area}
              onClick={() => setAreaAbierta(b.area)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={S.td}><strong>{b.area}</strong></td>
              <td style={S.td}>{b.n}</td>
              <td style={S.td}>{b.motivo}</td>
              <td style={S.td}>{b.tipo}</td>
              <td style={S.td}><strong>${costoRealArea(b.area).toLocaleString("es-MX")}</strong></td>
              <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>Ver desglose →</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- Modal: desglose de bajas por área ---------- */}
      {areaAbierta && (() => {
        const lista = bajasRecientes.filter((b) => b.area === areaAbierta);
        const totalArea = lista.reduce((a, b) => a + costoTotalBaja(b), 0);
        const vol = lista.filter((b) => b.tipo === "Voluntaria").length;
        const invol = lista.length - vol;
        const fmt = (v) => "$" + v.toLocaleString("es-MX");
        return (
          <div onClick={() => setAreaAbierta(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: 860, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid " + COLOR.border, boxShadow: COLOR.shadowHover }}>
              <div style={{ position: "relative", padding: "20px 24px", background: `radial-gradient(circle at 100% 0%, ${hexA(COLOR.accentLight, 0.16)} 0%, transparent 60%), linear-gradient(135deg, ${hexA(COLOR.accentLight, 0.1)} 0%, ${hexA(COLOR.accent, 0.04)} 100%), #fff`, borderBottom: "1px solid " + COLOR.border }}>
                <button onClick={() => setAreaAbierta(null)} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: COLOR.textMuted, lineHeight: 1 }}>×</button>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLOR.accent }}>Desglose de bajas por área</div>
                <h3 style={{ margin: "6px 0 2px", fontSize: 20, fontWeight: 700, color: COLOR.ink }}>{areaAbierta}</h3>
                <div style={{ fontSize: 13, color: COLOR.textSoft }}>{lista.length} baja{lista.length !== 1 ? "s" : ""} YTD · {vol} voluntaria{vol !== 1 ? "s" : ""} · {invol} involuntaria{invol !== 1 ? "s" : ""}</div>
              </div>

              <div style={{ padding: 24 }}>
                {/* Resumen */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                  <div style={{ ...S.kpi, padding: 12 }}>
                    <div style={S.kpiLabel}>Bajas en el área</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{lista.length}</div>
                  </div>
                  <div style={{ ...S.kpi, padding: 12 }}>
                    <div style={S.kpiLabel}>Costo total estimado</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2, color: COLOR.accent }}>{fmt(totalArea)}</div>
                  </div>
                  <div style={{ ...S.kpi, padding: 12 }}>
                    <div style={S.kpiLabel}>Costo promedio por baja</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{fmt(Math.round(totalArea / (lista.length || 1)))}</div>
                  </div>
                </div>

                <table style={{ ...S.table, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Empleado</th>
                      <th style={S.th}>Puesto</th>
                      <th style={S.th}>Antig.</th>
                      <th style={S.th}>Fecha</th>
                      <th style={S.th}>Motivo</th>
                      <th style={S.th}>Tipo</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lista].sort((a, b) => costoTotalBaja(b) - costoTotalBaja(a)).map((b) => (
                      <tr key={b.id}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700 }}>{b.nombre}</div>
                          <div style={{ fontSize: 10, color: "#666" }}>{b.empNo}</div>
                        </td>
                        <td style={S.td}>{b.puesto}</td>
                        <td style={S.td}>{b.años} años</td>
                        <td style={S.td}>{b.fecha}</td>
                        <td style={S.td} title={b.motivoExtendido}>{b.motivo}</td>
                        <td style={S.td}><span style={S.badge(b.tipo === "Voluntaria" ? "#eef5ff" : "#fdecea")}>{b.tipo}</span></td>
                        <td style={{ ...S.td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(costoTotalBaja(b))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#fafafa" }}>
                      <td style={{ ...S.td, fontWeight: 700 }} colSpan={6}>Total {areaAbierta}</td>
                      <td style={{ ...S.td, fontWeight: 700, textAlign: "right" }}>{fmt(totalArea)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 10 }}>
                  Costo total = directo + indirecto + oculto + hundido de cada baja. Para el desglose por concepto de un caso, usa la sección de costo de baja de arriba.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button style={S.btn} onClick={() => setAreaAbierta(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <h3 style={S.h3}>Costo y % de rotación · mes a mes</h3>
      {(() => {
        const esCosto = vistaRot === "costo";
        const ac = esCosto ? COLOR.accent : "#2e4773";
        const acLight = esCosto ? COLOR.accentLight : "#3e5f96";
        const valor = (m) => (esCosto ? m.costo : m.pct);
        const maxV = Math.max(...rotacionMensual.map(valor));
        const totalCosto = rotacionMensual.reduce((a, m) => a + m.costo, 0);
        const totalBajas = rotacionMensual.reduce((a, m) => a + m.bajas, 0);
        const pctProm = (rotacionMensual.reduce((a, m) => a + m.pct, 0) / rotacionMensual.length);
        const fmtMonto = (v) => "$" + v.toLocaleString("es-MX");
        const fmtK = (v) => "$" + Math.round(v / 1000) + "K";
        const etiqueta = (m) => (esCosto ? fmtK(m.costo) : m.pct.toFixed(1) + "%");
        const tabBtn = (activo) => ({
          ...S.btnGhost, padding: "7px 14px", fontWeight: 700,
          background: activo ? ac : COLOR.surface,
          color: activo ? "#fff" : COLOR.textSoft,
          borderColor: activo ? ac : COLOR.border,
        });
        return (
          <div style={S.card}>
            {/* Cabecera: resumen + toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div style={S.kpiLabel}>Total gastado · Jul–Dic 2026</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: COLOR.accent, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtMonto(totalCosto)}</div>
                  <div style={{ fontSize: 11, color: COLOR.textMuted }}>{totalBajas} bajas · {fmtMonto(Math.round(totalCosto / totalBajas))} promedio por baja</div>
                </div>
                <div>
                  <div style={S.kpiLabel}>Rotación mensual promedio</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#2e4773", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{pctProm.toFixed(1)}%</div>
                  <div style={{ fontSize: 11, color: COLOR.textMuted }}>≈ {(pctProm * 12).toFixed(1)}% anualizado</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={tabBtn(esCosto)} onClick={() => setVistaRot("costo")}>$ Costo</button>
                <button style={tabBtn(!esCosto)} onClick={() => setVistaRot("pct")}>% Rotación</button>
              </div>
            </div>

            {/* Gráfica de barras mes a mes */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 200, paddingTop: 22, borderBottom: "2px solid " + COLOR.ink }}>
              {rotacionMensual.map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 46, display: "flex", justifyContent: "center", alignItems: "flex-end", flex: 1 }}>
                    <div
                      title={`${m.mes} ${m.anio}: ${esCosto ? fmtMonto(m.costo) : m.pct + "%"} · ${m.bajas} baja${m.bajas !== 1 ? "s" : ""}`}
                      style={{
                        width: "100%", maxWidth: 38,
                        height: `${Math.max((valor(m) / maxV) * 100, 2)}%`,
                        background: `linear-gradient(180deg, ${acLight} 0%, ${ac} 100%)`,
                        transition: "height 0.3s ease",
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: ac, whiteSpace: "nowrap" }}>
                        {etiqueta(m)}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: COLOR.textSoft }}>{m.mes}</div>
                  <div style={{ fontSize: 9, color: COLOR.textMuted }}>{m.anio}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 10 }}>
              {esCosto
                ? "Costo total de rotación por mes (liquidaciones, finiquitos, reemplazo y costos asociados)."
                : "Porcentaje de rotación mensual (bajas del mes ÷ plantilla promedio)."}
            </div>
          </div>
        );
      })()}

      {conceptoAbierto && (
        <div
          onClick={() => setConceptoAbierto(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 8, padding: 24,
              width: 1080, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto",
              border: "1px solid #ccc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{conceptoAbierto.concepto}</h3>
                  <span style={S.badge(conceptoAbierto.tipoColor)}>{conceptoAbierto.tipo}</span>
                </div>
                <p style={{ ...S.hint, margin: 0 }}>{conceptoAbierto.descripcion}</p>
              </div>
              <button
                onClick={() => setConceptoAbierto(null)}
                style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "16px 0" }}>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Monto unitario promedio</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>${conceptoAbierto.monto.toLocaleString("es-MX")}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>por cada baja</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Impacto YTD ({totalBajas} bajas)</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#b00020" }}>${(conceptoAbierto.monto * totalBajas).toLocaleString("es-MX")}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                  {((conceptoAbierto.monto / (costoUnitario.directos + costoUnitario.indirectos)) * 100).toFixed(0)}% del costo total por baja
                </div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Rango observado</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  ${Math.min(...bajasRecientes.map((b) => b.costos[conceptoAbierto.campoCosto])).toLocaleString("es-MX")} – ${Math.max(...bajasRecientes.map((b) => b.costos[conceptoAbierto.campoCosto])).toLocaleString("es-MX")}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>entre las {bajasRecientes.length} bajas YTD</div>
              </div>
            </div>

            <p style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginBottom: 12 }}>
              {conceptoAbierto.formulaBase}
            </p>

            {/* Caso seleccionado: perfil + desglose personalizado */}
            {(() => {
              const baja = bajasRecientes.find((b) => b.id === bajaSeleccionadaId) || bajasRecientes[0];
              const costoPersonal = baja.costos[conceptoAbierto.campoCosto];
              const desvPct = ((costoPersonal - conceptoAbierto.monto) / conceptoAbierto.monto) * 100;
              const desvColor = desvPct > 20 ? "#b00020" : desvPct < -20 ? "#0a7d2c" : "#64748b";
              const desglose = breakdownPersonalizado(baja, conceptoAbierto);
              return (
                <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 16, marginBottom: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12 }}>
                    <div>
                      <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Caso seleccionado</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{baja.nombre}</h3>
                        <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{baja.empNo}</span>
                        <span style={S.badge(baja.tipo === "Voluntaria" ? "#eef5ff" : "#fdecea")}>{baja.tipo}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        {baja.puesto} · {baja.gerenciaFuncional}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={S.kpiLabel}>Costo {conceptoAbierto.tipo.toLowerCase()} de este caso</div>
                      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>${costoPersonal.toLocaleString("es-MX")}</div>
                      <div style={{ fontSize: 11, color: desvColor, fontWeight: 700 }}>
                        {desvPct >= 0 ? "+" : ""}{desvPct.toFixed(0)}% vs promedio
                      </div>
                    </div>
                  </div>

                  {/* Datos del expediente */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12, padding: "10px 12px", background: "#fafafa", borderRadius: 4, border: "1px solid #e5e5e5", fontSize: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Área</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.area}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Jefe directo</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.jefe}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Antigüedad</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.años} años</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Reportes directos</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.reportes}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Sueldo nominal</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>${baja.sueldo.toLocaleString("es-MX")}/mes</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Sueldo integrado</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>${baja.sueldoIntegrado.toLocaleString("es-MX")}/mes</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Fecha de ingreso</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.fechaIngreso}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Fecha efectiva de baja</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{baja.fecha}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ ...S.kpiLabel, marginBottom: 4 }}>Motivo de baja</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{baja.motivo}</div>
                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{baja.motivoExtendido}</div>
                  </div>

                  <div style={{ padding: "10px 12px", background: "#fff7e0", border: "1px solid #f0d999", borderRadius: 4, marginBottom: 14 }}>
                    <div style={{ ...S.kpiLabel, marginBottom: 4 }}>Observaciones del jefe directo</div>
                    <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5 }}>{baja.observacionesJefe}</div>
                  </div>

                  {/* Desglose personalizado */}
                  <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Desglose para {baja.nombre.split(" ")[0]}</div>
                  <table style={{ ...S.table, marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Componente</th>
                        <th style={S.th}>Estándar</th>
                        <th style={S.th}>Este caso</th>
                        <th style={S.th}>% variación vs estándar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const variacionTotalPct = ((costoPersonal - conceptoAbierto.monto) / conceptoAbierto.monto) * 100;
                        const maxAbsVar = Math.max(50, ...desglose.map((d) => Math.abs(d.variacionPct)), Math.abs(variacionTotalPct));
                        const renderVarBar = (v) => {
                          const positivo = v >= 0;
                          const ancho = (Math.abs(v) / maxAbsVar) * 50; // 0-50% del bar
                          const color = positivo ? "#b00020" : "#0a7d2c";
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, position: "relative", height: 8, background: "#f1f5f9", borderRadius: 4, minWidth: 110, overflow: "hidden" }}>
                                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#cbd5e1" }} />
                                <div style={{
                                  position: "absolute",
                                  left: positivo ? "50%" : `${50 - ancho}%`,
                                  width: `${ancho}%`,
                                  top: 0, bottom: 0,
                                  background: color, borderRadius: 2,
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 56, textAlign: "right", color }}>
                                {positivo ? "+" : ""}{v.toFixed(0)}%
                              </span>
                            </div>
                          );
                        };
                        return (
                          <>
                            {desglose.map((d, i) => (
                              <tr key={i}>
                                <td style={S.td}>
                                  <div style={{ fontWeight: 600 }}>{d.label}</div>
                                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{d.nota}</div>
                                </td>
                                <td style={{ ...S.td, whiteSpace: "nowrap", color: "#475569" }}>${d.montoEstandar.toLocaleString("es-MX")}</td>
                                <td style={{ ...S.td, fontWeight: 700, whiteSpace: "nowrap" }}>${d.monto.toLocaleString("es-MX")}</td>
                                <td style={S.td}>{renderVarBar(d.variacionPct)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: "#fafafa" }}>
                              <td style={{ ...S.td, fontWeight: 700 }}>Total para este caso</td>
                              <td style={{ ...S.td, fontWeight: 700, color: "#475569" }}>${conceptoAbierto.monto.toLocaleString("es-MX")}</td>
                              <td style={{ ...S.td, fontWeight: 700 }}>${costoPersonal.toLocaleString("es-MX")}</td>
                              <td style={S.td}>{renderVarBar(variacionTotalPct)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Botón: ver / cambiar entre todos los casos */}
            <button
              onClick={() => setMostrarTodosCasos((v) => !v)}
              style={{ ...S.btnGhost, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: mostrarTodosCasos ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {mostrarTodosCasos ? "Ocultar otros casos" : `Ver / cambiar caso · ${bajasRecientes.length} bajas YTD`}
            </button>
            {mostrarTodosCasos && (
            <div style={{ overflowX: "auto", marginTop: 12, marginBottom: 16 }}>
              <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Click en cualquier fila para ver su desglose</div>
              <p style={{ ...S.hint, marginTop: 0, marginBottom: 10 }}>{conceptoAbierto.casosDetalle}</p>
              <table style={{ ...S.table, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Empleado</th>
                    <th style={S.th}>Área / Puesto</th>
                    <th style={S.th}>Antig.</th>
                    <th style={S.th}>Jefe directo</th>
                    <th style={S.th}>Motivo</th>
                    <th style={S.th}>Fecha</th>
                    <th style={S.th}>Tipo</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Costo {conceptoAbierto.tipo.toLowerCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bajasRecientes]
                    .sort((a, b) => b.costos[conceptoAbierto.campoCosto] - a.costos[conceptoAbierto.campoCosto])
                    .map((b) => {
                      const costo = b.costos[conceptoAbierto.campoCosto];
                      const desvPct = ((costo - conceptoAbierto.monto) / conceptoAbierto.monto) * 100;
                      const desvColor = desvPct > 20 ? "#b00020" : desvPct < -20 ? "#0a7d2c" : "#64748b";
                      const seleccionada = bajaSeleccionadaId === b.id;
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setBajaSeleccionadaId(b.id)}
                          style={{
                            cursor: "pointer",
                            background: seleccionada ? "#eef5ff" : "transparent",
                            outline: seleccionada ? "2px solid #3498db" : "none",
                            outlineOffset: -2,
                          }}
                          onMouseEnter={(e) => { if (!seleccionada) e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { if (!seleccionada) e.currentTarget.style.background = "transparent"; }}
                        >
                          <td style={S.td}>
                            <div style={{ fontWeight: 700 }}>{b.nombre}</div>
                            <div style={{ fontSize: 10, color: "#666" }}>{b.empNo}</div>
                          </td>
                          <td style={S.td}>
                            <div>{b.area}</div>
                            <div style={{ fontSize: 11, color: "#666" }}>{b.puesto}</div>
                          </td>
                          <td style={S.td}>{b.años} años</td>
                          <td style={S.td}>{b.jefe}</td>
                          <td style={S.td} title={b.motivoExtendido}>{b.motivo}</td>
                          <td style={S.td}>{b.fecha}</td>
                          <td style={S.td}>
                            <span style={S.badge(b.tipo === "Voluntaria" ? "#eef5ff" : "#fdecea")}>{b.tipo}</span>
                          </td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            <div style={{ fontWeight: 700 }}>${costo.toLocaleString("es-MX")}</div>
                            <div style={{ fontSize: 10, color: desvColor, fontWeight: 600 }}>
                              {desvPct >= 0 ? "+" : ""}{desvPct.toFixed(0)}% vs promedio
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  <tr style={{ background: "#fafafa" }}>
                    <td style={{ ...S.td, fontWeight: 700 }} colSpan={7}>Total {bajasRecientes.length} bajas YTD</td>
                    <td style={{ ...S.td, fontWeight: 700, textAlign: "right" }}>
                      ${bajasRecientes.reduce((a, b) => a + b.costos[conceptoAbierto.campoCosto], 0).toLocaleString("es-MX")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}

            <div style={{
              padding: "12px 14px",
              borderRadius: 4,
              background: conceptoAbierto.mitigacionColor,
              border: "1px solid #e5e5e5",
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              <div style={{ ...S.kpiLabel, marginBottom: 4 }}>Cómo mitigarlo</div>
              {conceptoAbierto.mitigacion}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button style={S.btn} onClick={() => setConceptoAbierto(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 7. CAPACITACIÓN Y ENTRENAMIENTO
// =============================================================
function Capacitacion() {
  const [cursoAbierto, setCursoAbierto] = useState(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const formInicial = {
    nombre: "", categoria: "Desarrollo de liderazgo", descripcion: "",
    empresaNombre: "", empresaContacto: "", empresaModalidad: "Presencial", certificacion: "",
    solicitanteNombre: "", solicitantePuesto: "", solicitanteArea: "Comercial",
    justificacion: "",
    participantesTotal: "", participantesPerfiles: "",
    fechaIni: "", fechaFin: "", horasTotales: "",
    costoTotal: "",
    roiEsperado: "", metricaPrincipal: "", baseline: "", target: "",
    comoSeMide: "", fechaMedicion: "", beneficiosEsperados: "",
  };
  const [form, setForm] = useState(formInicial);
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const parseFecha = (s) => {
    if (!s) return null;
    if (s.includes("-") && s.length <= 7) {
      const [d, m] = s.split("-");
      const monthIdx = meses.indexOf(m);
      const day = parseInt(d, 10);
      if (monthIdx < 0 || !day || day < 1 || day > 31) return null;
      const dt = new Date(2026, monthIdx, day);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  const formatFechaCorta = (d) => `${String(d.getDate()).padStart(2, "0")}-${meses[d.getMonth()]}`;

  const cursosInicial = [
    {
      id: "CAP-01", nombre: "Liderazgo nivel medio", solicita: "Operaciones",
      fechaIni: "01-may", fechaFin: "30-jun", costo: 85000, roi: "2.1x", est: "En curso", progreso: 35,
      descripcion: "Programa intensivo para desarrollar habilidades de liderazgo en mandos medios de Operaciones, con énfasis en gestión de equipos de planta y comunicación con dirección.",
      categoria: "Desarrollo de liderazgo",
      empresaCapacitadora: { nombre: "IPADE Business School", contacto: "Dr. Ramiro Anzaldúa · ranzaldua@ipade.mx", modalidad: "Híbrida (8 sesiones presenciales + 8 virtuales)", certificacion: "Certificado IPADE en Liderazgo Operativo" },
      solicitante: { nombre: "Carlos Mendoza", puesto: "Director de Operaciones", area: "Operaciones", justificacion: "Sucesión de mandos medios en planta. 3 supervisores no estaban listos para asumir gerencias en próximos 12-18 meses." },
      aprobadoPor: { nombre: "Dirección General", fecha: "08-abr-2026", costoAprobado: 85000 },
      pm: { nombre: "Paola Castaño", puesto: "Gerente de RH" },
      participantes: { total: 12, perfiles: "12 supervisores de planta de Operaciones (Planta 1 y Planta 2)" },
      objetivos: [
        "Gestión de equipos de 10-25 personas con KPIs operativos diarios",
        "Comunicación efectiva con dirección y otros departamentos",
        "Manejo de conflictos en piso y mediación entre turnos",
        "Planeación y delegación basada en datos",
      ],
      temario: ["Módulo 1: Fundamentos de liderazgo situacional", "Módulo 2: Comunicación con stakeholders", "Módulo 3: KPIs operativos y toma de decisiones", "Módulo 4: Resolución de conflictos", "Módulo 5: Coaching y feedback continuo", "Módulo 6: Proyecto integrador"],
      modalidad: "Híbrida · 16 sesiones de 4 horas (4 hrs/sem)",
      horasTotales: 64,
      costoDesglose: [
        { concepto: "Honorarios IPADE (instructor + materiales)", monto: 55000 },
        { concepto: "Renta de sala y coffee break (8 sesiones)", monto: 12000 },
        { concepto: "Plataforma virtual y grabaciones", monto: 8000 },
        { concepto: "Examen final y certificación", monto: 10000 },
      ],
      roiDetalle: {
        metricaPrincipal: "Reducción de % rotación voluntaria en equipos de los participantes",
        baseline: "Rotación voluntaria 2025: 18% anual en equipos de los 12 supervisores",
        target: "Reducir a ≤12% en los siguientes 12 meses post-programa",
        comoSeMide: "Tracking mensual de bajas voluntarias por equipo + score 360° de los participantes 6 meses después. ROI financiero = costo evitado de bajas (a $43K c/u) vs inversión en programa.",
        fechaMedicion: "1ª medición: Sep 2026 (90 días post) · 2ª: Dic 2026 (6 meses post)",
        beneficiosEsperados: "$180K en costos de rotación evitados (≈4 bajas evitadas) + mejora 0.3-0.5 puntos en score 360°",
      },
      evaluaciones: ["Evaluación pre-programa (diagnóstico individual)", "2 evaluaciones intermedias por módulo", "Proyecto integrador (caso real de su equipo)", "Evaluación post-programa a 90 días"],
    },
    {
      id: "CAP-02", nombre: "Cierre de ventas premium", solicita: "Comercial",
      fechaIni: "15-abr", fechaFin: "15-may", costo: 120000, roi: "3.4x", est: "En curso", progreso: 75,
      descripcion: "Programa de venta consultiva y negociación premium para ejecutivos Sr y gerentes comerciales. Enfoque en cuentas Tier-1 y ciclos de venta largos.",
      categoria: "Habilidades comerciales",
      empresaCapacitadora: { nombre: "Sandler Training México", contacto: "Lic. Adriana Garmendia · adriana.g@sandlermx.com", modalidad: "Presencial intensivo (10 sesiones)", certificacion: "Sandler Selling System — Nivel Avanzado" },
      solicitante: { nombre: "Federico Domínguez", puesto: "Director Comercial Norte", area: "Comercial", justificacion: "Pérdida de cuotas Tier-1 con 2 OEM en Q4 2025. Necesidad de elevar capacidad de negociación premium ante salida de Javier Ortega (B-001)." },
      aprobadoPor: { nombre: "Comité Ejecutivo", fecha: "28-mar-2026", costoAprobado: 120000 },
      pm: { nombre: "Luis Martínez", puesto: "Gerente Comercial" },
      participantes: { total: 10, perfiles: "8 Asesores Comerciales Sr. + 2 Gerentes Regionales" },
      objetivos: [
        "Técnicas avanzadas de cierre en ciclos de venta >90 días",
        "Negociación de paquetes premium sin sacrificar margen",
        "Manejo de objeciones de procurement y comités de compra",
        "Construcción de relaciones long-term con compradores Tier-1",
      ],
      temario: ["Módulo 1: Pain Funnel y diagnóstico estratégico", "Módulo 2: Up-front Contract y reglas del juego", "Módulo 3: Bonding & Rapport con comités", "Módulo 4: Discovery a profundidad", "Módulo 5: Presupuesto y autoridad de decisión", "Módulo 6: Cierre y manejo de objeciones", "Módulo 7: Role play con cuentas reales", "Módulo 8: Plan de cuenta y account-based selling"],
      modalidad: "Presencial · 10 sesiones de 6 horas (2 sesiones/sem)",
      horasTotales: 60,
      costoDesglose: [
        { concepto: "Honorarios Sandler (instructor certificado)", monto: 78000 },
        { concepto: "Licencias Sandler Online Reinforcement (12 meses)", monto: 18000 },
        { concepto: "Hotel sede y catering (10 sesiones)", monto: 16000 },
        { concepto: "Material impreso y kit del participante", monto: 8000 },
      ],
      roiDetalle: {
        metricaPrincipal: "Incremento en ticket promedio y tasa de conversión Tier-1",
        baseline: "Ticket promedio Q1 2026: $480K · Tasa conversión Tier-1: 22%",
        target: "Ticket promedio +25% ($600K) · Tasa conversión Tier-1 ≥30% en H2 2026",
        comoSeMide: "Dashboards de CRM con cohortes pre/post programa. Comparación cuenta a cuenta de pipeline trabajado por participantes. Medición independiente por Finanzas con criterio de atribución estricto (mínimo 1 ronda completa de venta).",
        fechaMedicion: "Medición continua mensual desde Jun 2026 · revisión formal trimestral con comité de ROI",
        beneficiosEsperados: "$408K incremental en revenue YTD H2 2026 (3.4x sobre $120K invertidos) — escenario base. Escenario optimista: $560K (4.7x).",
      },
      evaluaciones: ["Evaluación de venta consultiva pre-programa", "Role plays grabados cada 2 sesiones", "Plan de cuenta entregable final", "Coaching post-programa 1:1 (3 meses)"],
    },
    {
      id: "CAP-03", nombre: "NIIF actualización", solicita: "Administración",
      fechaIni: "10-jun", fechaFin: "20-jun", costo: 45000, roi: "1.2x", est: "Programado", progreso: 0,
      descripcion: "Actualización técnica en Normas Internacionales de Información Financiera 2026, con foco en NIIF 15 (ingresos) y NIIF 16 (arrendamientos) — relevante por nuevos contratos de arrendamiento operativo firmados en 2025.",
      categoria: "Actualización técnica regulatoria",
      empresaCapacitadora: { nombre: "Deloitte Academy", contacto: "C.P. Mario Trujillo · mtrujillo@deloitte.com", modalidad: "Virtual sincrónico (5 sesiones)", certificacion: "Constancia Deloitte Academy · 20 hrs DPC" },
      solicitante: { nombre: "Rodrigo Solís", puesto: "Gerente de Finanzas", area: "Administración", justificacion: "Reformas NIIF aplicables a partir de Ene-2026 + 3 hallazgos en auditoría externa 2025 relacionados con clasificación de arrendamientos." },
      aprobadoPor: { nombre: "Director Administrativo (S. Ramírez)", fecha: "02-may-2026", costoAprobado: 45000 },
      pm: { nombre: "Rodrigo Solís", puesto: "Gerente de Finanzas (auto-PM)" },
      participantes: { total: 6, perfiles: "Gte. Finanzas + Contralor + 3 Contadores Sr. + 1 Auditor Interno" },
      objetivos: [
        "Aplicación correcta de NIIF 15 a contratos de venta a OEMs",
        "Clasificación y registro de arrendamientos bajo NIIF 16",
        "Cierre de los 3 hallazgos pendientes de auditoría externa 2025",
        "Preparación para auditoría 2026 sin observaciones materiales",
      ],
      temario: ["Sesión 1: Resumen de cambios NIIF 2026", "Sesión 2: NIIF 15 — ingresos por contratos con clientes", "Sesión 3: NIIF 16 — arrendamientos (LESSEE & LESSOR)", "Sesión 4: Casos prácticos con contratos reales de la empresa", "Sesión 5: Cierre de hallazgos y plan de remediación"],
      modalidad: "Virtual sincrónico · 5 sesiones de 4 horas",
      horasTotales: 20,
      costoDesglose: [
        { concepto: "Honorarios Deloitte Academy (instructor)", monto: 32000 },
        { concepto: "Plataforma de e-learning + grabaciones (6 meses)", monto: 8000 },
        { concepto: "Material técnico digital + casos prácticos", monto: 5000 },
      ],
      roiDetalle: {
        metricaPrincipal: "Reducción de hallazgos en auditoría externa anual",
        baseline: "Auditoría 2025: 3 hallazgos materiales (NIIF 15 y 16) + 2 menores",
        target: "Auditoría 2026: 0 hallazgos materiales · ≤1 menor",
        comoSeMide: "Reporte del auditor externo (KPMG) al cierre del ejercicio 2026. ROI calculado vs costo evitado de provisiones por contingencias y honorarios extra por re-trabajo.",
        fechaMedicion: "Mar 2027 (informe de auditoría externa)",
        beneficiosEsperados: "$54K en honorarios de re-trabajo evitados + reducción de riesgo regulatorio (no cuantificado). ROI conservador 1.2x.",
      },
      evaluaciones: ["Diagnóstico pre-programa", "Examen final certificación Deloitte", "Aplicación en cierre Jun 2026 (validación real)"],
    },
    {
      id: "CAP-04", nombre: "Servicio al cliente posventa", solicita: "Posventa",
      fechaIni: "05-may", fechaFin: "12-may", costo: 38000, roi: "1.8x", est: "Solicitud", progreso: 0,
      descripcion: "Programa intensivo de servicio al cliente para personal de primer contacto en taller. Diseñado en respuesta al diagnóstico de clima del Taller Sur y el patrón de bajas voluntarias.",
      categoria: "Servicio y experiencia del cliente",
      empresaCapacitadora: { nombre: "Customer Experience Group (CXG)", contacto: "Mtra. Sandra Olivera · solivera@cxgroup.mx", modalidad: "Presencial en sucursales (4 sesiones)", certificacion: "Constancia CXG · 24 hrs prácticas" },
      solicitante: { nombre: "Teresa Aguilar", puesto: "Supervisora de Posventa Turno A", area: "Posventa", justificacion: "NPS Posventa bajó de 42 a 28 en últimos 6 meses. 2 quejas de clientes por demoras + diagnóstico de clima del Taller Sur exige acciones inmediatas." },
      aprobadoPor: { nombre: "Pendiente · Gte. Posventa (L. Cano)", fecha: "—", costoAprobado: 0 },
      pm: { nombre: "Pendiente de asignar (al aprobarse)", puesto: "—" },
      participantes: { total: 14, perfiles: "8 Asesores de Servicio + 4 Recepcionistas + 2 Jefes de Tienda" },
      objetivos: [
        "Comunicación empática con cliente bajo presión (vehículo descompuesto)",
        "Manejo de quejas y escalamiento estructurado",
        "Upselling consultivo de servicios complementarios",
        "Coordinación interna recepción ↔ taller para evitar tiempos muertos",
      ],
      temario: ["Sesión 1: Mapa del journey del cliente posventa", "Sesión 2: Comunicación empática y de-escalación", "Sesión 3: Manejo de quejas y casos críticos (role play)", "Sesión 4: Upselling consultivo + cierre de servicio"],
      modalidad: "Presencial en sucursal · 4 sesiones de 6 horas (sábados)",
      horasTotales: 24,
      costoDesglose: [
        { concepto: "Honorarios CXG (2 instructores)", monto: 26000 },
        { concepto: "Material y kit del participante", monto: 5000 },
        { concepto: "Coffee break y comida (4 sesiones)", monto: 4000 },
        { concepto: "Cliente misterioso post-programa (mediciones)", monto: 3000 },
      ],
      roiDetalle: {
        metricaPrincipal: "Incremento de NPS Posventa + tasa de retención de servicios",
        baseline: "NPS Posventa abr-2026: 28 · Tasa retención cita siguiente: 41%",
        target: "NPS ≥45 en Sep 2026 · Tasa retención ≥55%",
        comoSeMide: "Encuesta NPS post-servicio (automática por SMS 24 hrs después) + tracking de citas recurrentes en DMS. Medición auditada por cliente misterioso (incluido en costo) 3 veces post-programa.",
        fechaMedicion: "Medición mensual · revisión formal a 90 días post-programa",
        beneficiosEsperados: "$68K en ingresos adicionales por mayor retención (1.8x sobre $38K) + base para frenar la fuga del Taller Sur (no cuantificado).",
      },
      evaluaciones: ["Diagnóstico pre con cliente misterioso", "Role plays evaluados por instructor", "Cliente misterioso post-programa (3 mediciones)"],
    },
  ];
  const [cursos, setCursos] = useState(cursosInicial);
  const [incidenciaAbierta, setIncidenciaAbierta] = useState(null);
  const [mensajeAbierto, setMensajeAbierto] = useState(null); // formato: "pasoIdx-agenteIdx"

  // Incidencias de capacitación — accountability sobre programas cerrados sin seguimiento
  const incidenciasCap = [
    {
      id: "INC-CAP-001",
      cursoId: "CAP-2025-08", cursoNombre: "Excel avanzado para ventas",
      fechaCierre: "30-nov-2025", costoCurso: 65000,
      solicitanteNombre: "Federico Domínguez", solicitantePuesto: "Director Comercial Norte",
      tipo: "ROI no medido",
      severidad: "Alta", diasVencido: 173, estado: "Abierta",
      descripcion: "Programa cerrado hace 173 días sin reporte de ROI. El compromiso era medir incremento en productividad de pipeline (cotizaciones por ejecutivo/mes) a los 90 días post-programa. Nunca se entregó al Comité de RH.",
      evidencias: [
        "Cierre del programa: 30-nov-2025 (Deloitte Academy)",
        "Compromiso documentado en minuta del Comité: medición a 90 días (28-feb-2026)",
        "Acta del Comité: 3 recordatorios enviados (15-mar, 12-abr, 03-may) sin respuesta",
        "Costo no recuperado: $65,000 sin evidencia de retorno",
      ],
      accionComprometida: "Entregar reporte de ROI con datos del CRM (cotizaciones pre vs post) auditados por Finanzas.",
      responsableAccion: "Federico Domínguez + Paola Castaño (PM)",
      fechaCompromiso: "30-jun-2026",
      proximosPasos: [
        {
          accion: "Escalar a Dirección General si no se entrega antes del 30-jun-2026",
          agentes: [
            {
              tipo: "whatsapp", destinatario: "F. Domínguez", fecha: "15-may 09:30", estado: "leido",
              detalle: "Recordatorio + link al expediente INC-CAP-001",
              mensaje: { contenido: "Hola Fede 👋 Te recuerdo que el reporte de ROI del programa 'Excel avanzado para ventas' (CAP-2025-08) sigue pendiente desde nov-2025. La fecha límite para evitar escalación al Comité es el 30-jun-2026. ¿Puedes confirmarme fecha de entrega? Expediente completo: https://rh.empresa.mx/inc/INC-CAP-001 — Agente RH" },
            },
            {
              tipo: "whatsapp", destinatario: "F. Domínguez", fecha: "18-may 14:15", estado: "leido_sin_respuesta",
              detalle: "Segundo recordatorio · sin respuesta tras 72 hrs",
              mensaje: { contenido: "Fede, segundo recordatorio. Ya pasaron 3 días desde mi último mensaje (15-may) y veo que lo leíste pero no respondiste. Por favor dame al menos una fecha tentativa de entrega del ROI. Si no recibo respuesta antes del 21-may, escalaré al Comité y a Dirección General. — Agente RH" },
            },
            {
              tipo: "whatsapp", destinatario: "F. Domínguez", fecha: "21-may 08:00", estado: "entregado",
              detalle: "Tercer recordatorio · activa escalación si no se lee en 24 hrs",
              mensaje: { contenido: "Fede, tercer y ÚLTIMO recordatorio antes de escalar. La política interna es clara: 3 recordatorios sin respuesta → escalación automática a Dirección General. Tienes hasta mañana 22-may 08:00 para responder o el caso pasa al CEO con el expediente completo. — Agente RH" },
            },
            {
              tipo: "email", destinatario: "Dir. General (CC: Comité ROI)", fecha: "25-may (programado)", estado: "programado",
              detalle: "Escalación automática preparada — se dispara si no hay respuesta el 25-may",
              mensaje: {
                asunto: "[ESCALACIÓN] INC-CAP-001 · ROI vencido 175+ días · F. Domínguez (Comercial Norte)",
                contenido: "Estimada Dirección General,\n\nLe informo que el incidente INC-CAP-001 sigue sin atender por F. Domínguez (Director Comercial Norte) tras 3 recordatorios formales por WhatsApp y 175 días desde el cierre del programa.\n\nContexto:\n• Programa: 'Excel avanzado para ventas' (CAP-2025-08, Deloitte Academy)\n• Inversión: $65,000\n• ROI comprometido: medir a 90 días (28-feb-2026)\n• Estado actual: sin reporte, sin fecha tentativa\n\nSolicito su intervención directa con F. Domínguez. Es la 2ª ocurrencia del mismo tipo en su área (la 1ª fue 'Negociación efectiva' en 2024).\n\nExpediente completo y bitácora de recordatorios: https://rh.empresa.mx/inc/INC-CAP-001\n\nAtentamente,\nAgente RH (motor de accountability v2.3)" },
            },
            {
              tipo: "recordatorio", fecha: "Cada 72 hrs", estado: "activo",
              detalle: "Auto-recordatorio hasta cierre o escalación",
              mensaje: { contenido: "Trigger: status(INC-CAP-001) != 'Cerrado' && diasVencido > 60\nFrecuencia: Cada 72 horas\nPróxima ejecución: 24-may-2026 08:00\nAcciones encadenadas:\n  1. Enviar WhatsApp a F. Domínguez (responsable directo)\n  2. Incrementar contador de díasVencido (+3)\n  3. Si 3 recordatorios sin respuesta → activar escalación email a Dir. General\n  4. Notificar a P. Castaño (PM del programa) cada 5 ejecuciones\nÚltima ejecución exitosa: 21-may 08:00 (WhatsApp entregado)" },
            },
          ],
        },
        {
          accion: "Bloquear nuevas solicitudes de capacitación del área hasta cerrar este caso",
          agentes: [
            {
              tipo: "sistema", destinatario: "Módulo de Capacitación", fecha: "20-may 11:00", estado: "ejecutado",
              detalle: "Flag de bloqueo activado para área Comercial Norte",
              mensaje: { contenido: "Acción: WRITE\nTabla: feature_flags_areas\nRegistro:\n  area = 'Comercial Norte'\n  flag = 'bloqueo_solicitudes_capacitacion'\n  valor = true\n  razon_id = 'INC-CAP-001'\n  fecha_inicio = '2026-05-20 11:00:00'\n  fecha_fin_estimada = null (depende de cierre del incidente)\nUsuario: motor_de_reglas_v2 (sistema)\nResultado: OK · 1 fila actualizada\nEfecto: cualquier intento de crear CAP-XX nuevo por usuarios del área devolverá 403 con mensaje 'Bloqueado por INC-CAP-001'" },
            },
            {
              tipo: "email", destinatario: "Equipo Comercial Norte (4 personas)", fecha: "20-may 11:05", estado: "abierto",
              detalle: "Notificación abierta por 3 de 4 destinatarios",
              mensaje: {
                asunto: "[Aviso] Suspensión temporal de solicitudes de capacitación — Comercial Norte",
                contenido: "Equipo Comercial Norte,\n\nLes informo que con motivo del expediente abierto INC-CAP-001 (ROI vencido del programa de Excel avanzado), el módulo de Capacitación queda restringido para nuevas solicitudes del área hasta su resolución.\n\nLa restricción se levantará automáticamente cuando F. Domínguez entregue el reporte de ROI pendiente.\n\nCualquier excepción urgente (capacitación regulatoria, certificación obligatoria) debe pasar por aprobación del Comité de Capacitación.\n\nDestinatarios:\n• Federico Domínguez (Dir. Comercial Norte) — abierto 20-may 14:22\n• Luis Martínez (Gte. Comercial) — abierto 20-may 11:45\n• 2 colaboradores adicionales — 1 abierto, 1 sin abrir\n\nDudas: P. Castaño (Gte. RH)\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Definir en el comité del 15-jun política de 'no ROI, no nuevo curso'",
          agentes: [
            {
              tipo: "email", destinatario: "Comité de Capacitación (6 miembros)", fecha: "12-may 16:20", estado: "abierto",
              detalle: "Invitación enviada · 5 confirmados, 1 pendiente",
              mensaje: {
                asunto: "Comité de Capacitación · 15-jun · Política 'No ROI = No nuevo curso'",
                contenido: "Estimados miembros del Comité,\n\nLos invito a la sesión del 15-jun-2026 (10:00-11:30) para definir y aprobar la política 'No ROI = No nuevo curso'.\n\nMotivación: 6 incidencias abiertas en accountability de capacitación (suma de ~$270K en inversión sin ROI demostrado).\n\nAgenda:\n  10:00 — Revisión de casos (INC-CAP-001 a 006)\n  10:30 — Propuesta de política (documento adjunto en Drive)\n  11:00 — Discusión y aprobación\n  11:20 — Próximos pasos\n\nSala de Juntas A + Teams\n\nConfirmados:\n  ✓ P. Castaño (Gte. RH)\n  ✓ S. Ramírez (Dir. Administrativo)\n  ✓ R. Solís (Gte. Finanzas)\n  ✓ C. Mendoza (Dir. Operaciones)\n  ✓ L. Martínez (Gte. Comercial)\n  ⏳ F. Domínguez (Dir. Comercial Norte) — pendiente\n\nPor favor confirmar antes del 30-may.\n\nAgente RH" },
            },
            {
              tipo: "sistema", destinatario: "Drive corporativo", fecha: "14-may 10:00", estado: "ejecutado",
              detalle: "Documento de propuesta de política compartido (link en agenda)",
              mensaje: { contenido: "Acción: CREATE FILE\nUbicación: /RH/Politicas/Borradores/\nNombre: 'Propuesta_Politica_NoROI-NoCurso_v1.0.docx'\nTamaño: 24 KB · 8 páginas\nPermisos asignados: 6 miembros del Comité (lectura + comentarios)\nVigencia comentarios: hasta 14-jun-2026\nLink: https://drive.empresa.mx/RH/Politicas/Borradores/NoROI-NoCurso-v1.0\nÍndice:\n  1. Contexto y motivación (con datos de INC-CAP-001 a 006)\n  2. Definición de la política\n  3. Excepciones permitidas (regulatorio, certificación obligatoria)\n  4. Proceso de waiver vía Comité\n  5. Métricas de cumplimiento\n  6. Cronograma de implementación\nÚltima edición: 14-may 10:00 por motor_de_reglas_v2" },
            },
            {
              tipo: "calendario", destinatario: "Comité de Capacitación", fecha: "15-jun 10:00", estado: "programado",
              detalle: "Sesión agendada · 90 min",
              mensaje: {
                asunto: "Comité de Capacitación · Política No-ROI-No-Curso",
                contenido: "Cuándo: Lunes 15-jun-2026 · 10:00 – 11:30 (90 min)\nDónde: Sala de Juntas A + link de Teams\n\nAgenda:\n  • Revisión de las 6 incidencias abiertas (INC-CAP-001 a 006)\n  • Aprobación de política 'No ROI = No nuevo curso'\n  • Definición de cronograma de implementación\n\nMaterial: documento de propuesta en Drive (ver email del 12-may)\n\nInvitados: P. Castaño, S. Ramírez, R. Solís, C. Mendoza, L. Martínez, F. Domínguez\n\nRecordatorio automático: 1 día antes y 1 hora antes vía Outlook + WhatsApp" },
            },
          ],
        },
      ],
      patron: "Es la 2ª vez que Comercial Norte cierra un programa sin entregar ROI (la 1ª fue 'Negociación efectiva' en 2024).",
    },
    {
      id: "INC-CAP-002",
      cursoId: "CAP-2026-01", cursoNombre: "Onboarding Sales Hub (HubSpot)",
      fechaCierre: "20-ene-2026", costoCurso: 42000,
      solicitanteNombre: "Guillermo Pérez", solicitantePuesto: "Gerente Comercial Centro",
      tipo: "Ausentismo alto no escalado",
      severidad: "Alta", diasVencido: 122, estado: "En seguimiento",
      descripcion: "El programa tuvo 38% de ausentismo (de 8 inscritos, 3 no completaron). El solicitante no escaló la situación a tiempo ni propuso plan de recuperación. Los 3 ausentes fueron los Jr del equipo — quienes más necesitaban la herramienta.",
      evidencias: [
        "Reporte HubSpot Academy: 5 de 8 completaron certificación",
        "Asistencia de Roberto Núñez (B-007): 2 de 8 sesiones — renunció abr-2026",
        "Asistencia de Lucía Aguilar (B-010): 3 de 8 sesiones — renunció abr-2026",
        "Asistencia de Valeria Núñez (B-016): 4 de 8 sesiones — renunció abr-2026",
        "Costo no aprovechado: $15,750 (3 × $5,250 prorrateado)",
      ],
      accionComprometida: "Re-asignar las licencias HubSpot Academy a los nuevos Jr e implementar plan de seguimiento semanal.",
      responsableAccion: "Guillermo Pérez + RH (P. Castaño)",
      fechaCompromiso: "15-jun-2026",
      proximosPasos: [
        {
          accion: "Plan formal de retención del equipo Jr (cruzar con caso de negocio de banda salarial)",
          agentes: [
            {
              tipo: "whatsapp", destinatario: "G. Pérez", fecha: "10-may 09:15", estado: "leido_sin_respuesta",
              detalle: "Solicitud de plan de retención + fecha límite 30-may",
              mensaje: { contenido: "Hola Guillermo, tras la 3ª baja Jr de tu equipo en Q1-Q2 (Núñez, Aguilar, V. Núñez), necesitamos plan formal de retención. Por favor envíame antes del 30-may un documento con: 1) diagnóstico de motivos, 2) acciones específicas, 3) métricas de seguimiento. — P. Castaño / Agente RH" },
            },
            {
              tipo: "whatsapp", destinatario: "G. Pérez", fecha: "17-may 14:00", estado: "leido_sin_respuesta",
              detalle: "Segundo recordatorio · sin respuesta 7 días",
              mensaje: { contenido: "Guillermo, ya pasó una semana desde mi mensaje del 10-may. Veo que lo leíste pero no respondiste. Esto cruza con tu 360° (alta brecha auto vs equipo). Por favor responde antes del 24-may o tendré que escalarlo a F. Domínguez. — Agente RH" },
            },
            {
              tipo: "email", destinatario: "Comité de Compensaciones", fecha: "11-may 09:30", estado: "respondido",
              detalle: "Caso de negocio recibido · evaluación en curso por Comp&Ben",
              mensaje: {
                asunto: "[Caso de negocio] Subir banda salarial Jr Comercial · sustento de 4 bajas voluntarias",
                contenido: "Comité de Compensaciones,\n\nAdjunto caso de negocio para subir banda salarial de Asesores Comerciales Jr en 8-12%.\n\nEvidencia:\n• 4 bajas voluntarias en 6 meses (todas Jr de Comercial Centro)\n• Motivo declarado en 4/4 exit interviews: sueldo bajo mercado\n• Mediana de mercado: $20-22K vs nuestra banda $17-18K\n• Costo de rotación YTD: $94K (4 × $23.5K promedio indirecto + hundido)\n\nRetorno estimado de la inversión:\n• Costo anual incremental: ~$120K (12 Jr × $1K/mes × 12)\n• Bajas evitadas estimadas: 3/año = $70K en costos de rotación evitados\n• ROI conservador: break-even en 18 meses + retención de talento\n\n--- Respuesta del Comité (15-may) ---\nRecibido · entra a evaluación trimestral · respuesta formal antes del 30-jun.\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Incluir KPI de ausentismo en el reporte mensual del gerente",
          agentes: [
            {
              tipo: "sistema", destinatario: "Template de reportes mensuales", fecha: "08-may 12:00", estado: "ejecutado",
              detalle: "KPI agregado al template · vigente desde may-2026",
              mensaje: { contenido: "Acción: UPDATE TEMPLATE\nTabla: report_templates\nRegistro: template_id = 'mensual_gerente_comercial'\nCambios:\n  + Sección 'Capacitación del equipo'\n    - KPI: pct_ausentismo_programas (% no completados / inscritos)\n    - Umbral verde: ≤10% · ámbar: 10-25% · rojo: >25%\n    - Periodicidad: mensual con comparativo trimestral\nVigencia: desde may-2026 (reporte de jun-2026 será el 1ro con este KPI)\nResultado: OK · 1 fila actualizada\nNotificado a 8 destinatarios (todos los Gerentes Comerciales)" },
            },
            {
              tipo: "email", destinatario: "Todos los Gerentes Comerciales", fecha: "08-may 12:15", estado: "abierto",
              detalle: "Notificación del cambio · 6 de 8 abierto",
              mensaje: {
                asunto: "Nuevo KPI en su reporte mensual · Ausentismo en programas de capacitación",
                contenido: "Estimados Gerentes Comerciales,\n\nA partir del reporte mensual de junio incluiremos un nuevo KPI: % de ausentismo en programas de capacitación que su equipo tiene inscritos.\n\nMotivación: el caso INC-CAP-002 reveló que un programa con 38% de ausentismo no fue escalado, lo que terminó en pérdida de inversión ($15,750) cuando los participantes Jr renunciaron poco después.\n\nUmbrales:\n  ≤10% = verde\n  10-25% = ámbar (acción correctiva sugerida)\n  >25% = rojo (escalación automática al Director)\n\nApertura del email: 6 de 8 destinatarios.\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Conectar este caso con el 360° de G. Pérez (alta brecha auto vs equipo)",
          agentes: [
            {
              tipo: "calendario", destinatario: "G. Pérez + P. Castaño", fecha: "29-may 16:00", estado: "programado",
              detalle: "Sesión de coaching 1:1 agendada",
              mensaje: {
                asunto: "Coaching 1:1 · G. Pérez con P. Castaño",
                contenido: "Cuándo: 29-may-2026 · 16:00 – 17:00 (60 min)\nDónde: Oficina de RH · Sala 2\n\nObjetivo: revisar resultados del 360° de G. Pérez (brecha 0.8 entre auto y equipo) y conectar con el caso de accountability INC-CAP-002.\n\nAgenda:\n  • Revisión de hallazgos 360° (foco: Desarrollo de talento 3.8/4.2 brecha 1.2)\n  • Cruce con casos de retención del equipo Jr\n  • Plan de acción a 90 días\n\nMaterial: reporte 360° completo + dashboard de rotación de su equipo\n\nRecordatorio automático: 1 día antes vía WhatsApp" },
            },
            {
              tipo: "whatsapp", destinatario: "G. Pérez", fecha: "19-may 11:00", estado: "respondido",
              detalle: "Acepta participar · respondió 'Confirmado'",
              mensaje: { contenido: "Hola Guillermo, recibiste la invitación para coaching 1:1 el 29-may. Por favor confírmame asistencia.\n\n--- 19-may 11:24 · Respuesta de G. Pérez ---\nConfirmado. Lo necesito de hecho. Avísame si necesitas algo de mi lado antes. — Memo" },
            },
          ],
        },
      ],
      patron: "Patrón consistente con 360° de G. Pérez: top performer en cuota pero descuido sistemático del equipo Jr. 4 voluntarias en 6 meses.",
    },
    {
      id: "INC-CAP-003",
      cursoId: "CAP-2025-09", cursoNombre: "Seguridad e higiene básica NOM-019",
      fechaCierre: "10-dic-2025", costoCurso: 28000,
      solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      tipo: "Baja calificación al proveedor sin documentar",
      severidad: "Media", diasVencido: 163, estado: "Abierta",
      descripcion: "Encuesta post-programa arrojó score 5.2/10 al proveedor (Capacitec) — el peor del año. El solicitante no documentó los hallazgos ni gestionó descuento/restitución, y posteriormente recomendó al mismo proveedor para otro programa.",
      evidencias: [
        "Encuesta participantes: score promedio 5.2/10 (vs benchmark 7.5)",
        "Comentarios: 'instructor llegó tarde 4 de 5 sesiones', 'material desactualizado'",
        "Sin reporte formal al área de Compras",
        "Nueva propuesta del mismo proveedor (Capacitec) recomendada por L. Cano en marzo-2026",
      ],
      accionComprometida: "Documentar formalmente la baja calificación, agregar a Capacitec al watch-list de proveedores y solicitar descuento del 20% en el siguiente engagement (o cambio de proveedor).",
      responsableAccion: "Lorenzo Cano + Compras (I. Salazar)",
      fechaCompromiso: "31-may-2026",
      proximosPasos: [
        {
          accion: "Crear repositorio de calificaciones de proveedores de capacitación",
          agentes: [
            {
              tipo: "sistema", destinatario: "SharePoint corporativo", fecha: "12-may 10:00", estado: "ejecutado",
              detalle: "Repositorio creado · pendiente migrar evaluaciones históricas",
              mensaje: { contenido: "Acción: CREATE LIST\nUbicación: /RH/Repositorio_Proveedores_Capacitacion/\nColumnas:\n  - proveedor (texto)\n  - programa_id (foreign key)\n  - score_participantes (1-10)\n  - score_solicitante (1-10)\n  - año\n  - hallazgos (texto largo)\n  - watch_list (booleano)\nPermisos: RH (admin) + Compras (lectura) + Comité (lectura+comentarios)\nMigración pendiente: 23 programas históricos (2024-2025)\nDeadline migración: 15-jun-2026" },
            },
            {
              tipo: "email", destinatario: "I. Salazar (Gte. Compras)", fecha: "12-may 10:15", estado: "respondido",
              detalle: "Confirma colaborar en migración · plazo 15-jun",
              mensaje: {
                asunto: "Colaboración · Repositorio de proveedores de capacitación",
                contenido: "Hola Isabel,\n\nNecesito tu ayuda para poblar el nuevo repositorio de proveedores de capacitación que acabo de crear en SharePoint (incidente INC-CAP-003).\n\nLo que necesito de Compras:\n• Lista de proveedores activos 2024-2025 con tu evaluación interna\n• Notas de calidad de servicio si las tienes\n• Plazo: 15-jun para tener histórico completo\n\n--- 13-may 09:00 · Respuesta de I. Salazar ---\nClaro, te paso el listado este viernes. Acuérdate que Capacitec tiene 3 reportes míos previos que nadie tomó en cuenta. — Isa\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Política: ningún proveedor con score <7 puede ser re-contratado sin aprobación de Comité",
          agentes: [
            {
              tipo: "email", destinatario: "Comité de Capacitación", fecha: "14-may 09:00", estado: "abierto",
              detalle: "Propuesta de política compartida · pendiente votación",
              mensaje: {
                asunto: "Propuesta · Política de proveedores con score bajo en capacitación",
                contenido: "Comité,\n\nPropongo política para evitar re-contratar proveedores con bajo desempeño sin checkpoint formal.\n\nReglas:\n1. Cualquier proveedor con score <7/10 (sea de participantes o de solicitante) entra al 'watch-list'.\n2. Re-contratación requiere aprobación explícita del Comité con justificación.\n3. Score <5 = veto automático por 12 meses.\n\nCaso motivador: Capacitec (INC-CAP-003) — score 5.2 ignorado, hoy en propuesta para otro programa.\n\nVoten en el documento adjunto antes del 28-may.\n\nAgente RH" },
            },
            {
              tipo: "whatsapp", destinatario: "L. Cano", fecha: "16-may 11:30", estado: "no_leido",
              detalle: "Solicitud de comentarios sobre la política · 5 días sin leer",
              mensaje: { contenido: "Hola Lorenzo, te comparto la propuesta de política de proveedores que voté en el Comité. Como tu caso (Capacitec) la motivó, me interesa tu input antes del 28-may. Link al documento: [...]. — Agente RH" },
            },
            {
              tipo: "llamada", destinatario: "L. Cano", fecha: "20-may 10:00", estado: "perdida",
              detalle: "Llamada no atendida · 2do intento programado para 23-may",
              mensaje: { contenido: "Nota de intento de llamada:\n• Fecha: 20-may-2026 10:00\n• Duración: 0 seg (no atendida)\n• Buzón: sin mensaje grabado\n• Acción siguiente: programar 2do intento 23-may 09:00 con notificación previa por WhatsApp\n• Si no atiende, escalar a C. Mendoza (Dir. Operaciones)" },
            },
          ],
        },
      ],
      patron: "L. Cano acumula 2 alertas en Capacitación + diagnóstico crítico de clima en taller Sur (ver pestañas Clima y Denuncia).",
    },
    {
      id: "INC-CAP-004",
      cursoId: "CAP-2025-06", cursoNombre: "Servicio al cliente — fundamentos",
      fechaCierre: "30-oct-2025", costoCurso: 35000,
      solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      tipo: "No hay evidencia de aplicación en el trabajo",
      severidad: "Alta", diasVencido: 204, estado: "Abierta",
      descripcion: "Programa diseñado para mejorar NPS Posventa. A 6 meses del cierre, NPS bajó de 42 a 28 (sentido contrario al esperado). Cliente misterioso post-programa: sin mejora observable en los 14 participantes evaluados.",
      evidencias: [
        "NPS Posventa oct-2025 (pre): 42",
        "NPS Posventa abr-2026 (post 6 meses): 28",
        "Cliente misterioso post-programa: 5.8/10 (vs baseline 6.2)",
        "ROI declarado: 2.0x · ROI real: −1.2x (pérdida)",
      ],
      accionComprometida: "Análisis raíz: ¿faltó coaching de seguimiento? ¿se sumó al problema de clima del taller Sur? Diseñar intervención correctiva (relacionada con CAP-04 ya solicitado).",
      responsableAccion: "Lorenzo Cano + Director de Operaciones (C. Mendoza)",
      fechaCompromiso: "30-jun-2026",
      proximosPasos: [
        {
          accion: "Validar si el problema es de capacitación o de liderazgo de piso",
          agentes: [
            {
              tipo: "calendario", destinatario: "L. Cano + C. Mendoza", fecha: "27-may 09:00", estado: "programado",
              detalle: "Sesión de análisis · 90 min",
              mensaje: {
                asunto: "Análisis raíz · Caída NPS Posventa (INC-CAP-004)",
                contenido: "Cuándo: 27-may-2026 · 09:00 – 10:30 (90 min)\nDónde: Oficina C. Mendoza + Teams\n\nObjetivo: definir si la caída NPS Posventa (42→28) viene de la capacitación o del liderazgo del Taller Sur.\n\nAgenda:\n  • Revisión de datos NPS pre/post programa\n  • Cliente misterioso por sucursal (Norte vs Sur)\n  • Diagnóstico de clima del Taller Sur (cruce con B-005, B-006, B-012)\n  • Decisión: re-lanzar programa, intervenir liderazgo, o ambos\n\nInvitados: L. Cano, C. Mendoza, T. Aguilar (Sup. Posventa)\n\nMaterial: dashboards de NPS + reporte de clima Taller Sur" },
            },
            {
              tipo: "whatsapp", destinatario: "L. Cano", fecha: "19-may 08:30", estado: "leido_sin_respuesta",
              detalle: "Confirmación de sesión solicitada · sin respuesta",
              mensaje: { contenido: "Hola Lorenzo, urge cerrar el análisis del NPS Posventa (caso INC-CAP-004 lleva 204 días). Necesito que confirmes la sesión del 27-may. Por favor responde antes de mañana. — Agente RH" },
            },
            {
              tipo: "llamada", destinatario: "L. Cano", fecha: "22-may 15:00", estado: "perdida",
              detalle: "Llamada no atendida · escalando a C. Mendoza",
              mensaje: { contenido: "Nota de intento de llamada:\n• Fecha: 22-may-2026 15:00\n• Duración: 0 seg (no atendida)\n• Es la 3ª vez consecutiva que L. Cano no atiende (cruzar con INC-CAP-003 misma semana)\n• Acción siguiente: escalación inmediata a C. Mendoza (Dir. Operaciones)" },
            },
            {
              tipo: "email", destinatario: "C. Mendoza (Dir. Operaciones)", fecha: "23-may 09:00", estado: "respondido",
              detalle: "C. Mendoza confirma asistencia y solicitará seguimiento personalmente",
              mensaje: {
                asunto: "Escalación · L. Cano no responde sobre INC-CAP-004",
                contenido: "Carlos,\n\nL. Cano no responde a 3 contactos sobre el caso INC-CAP-004 (caída NPS Posventa, $35K sin ROI, 204 días vencido). Es la 2ª incidencia abierta de él en capacitación + el caso de clima del Taller Sur que tú ya conoces.\n\n¿Puedes intervenir personalmente para la sesión del 27-may?\n\n--- 23-may 09:42 · Respuesta de C. Mendoza ---\nVoy. De hecho ya iba a hablar con él esta semana por el caso del clima. Aprovecho. Confírmame agenda y yo me encargo. — CM\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Antes de aprobar CAP-04, exigir plan de aplicación medible",
          agentes: [
            {
              tipo: "sistema", destinatario: "Módulo de Capacitación · CAP-04", fecha: "10-may 14:00", estado: "ejecutado",
              detalle: "Flag agregado · requiere plan de aplicación antes de aprobar",
              mensaje: { contenido: "Acción: UPDATE\nTabla: cursos\nRegistro: id = 'CAP-04'\nCambios:\n  + requiere_plan_aplicacion = true\n  + razon = 'INC-CAP-004 abierto · solicitante mismo (L. Cano)'\n  + bloqueo_aprobacion = true\nEfecto: cualquier intento de aprobar CAP-04 en el módulo arroja error 'Plan de aplicación medible requerido · ver INC-CAP-004 antes de aprobar'.\nLevantamiento del bloqueo: manual por P. Castaño o automático al cerrar INC-CAP-004." },
            },
          ],
        },
        {
          accion: "Considerar repetir el programa con otro proveedor + sponsor distinto",
          agentes: [
            {
              tipo: "email", destinatario: "C. Mendoza", fecha: "19-may 16:00", estado: "respondido",
              detalle: "Acepta ser sponsor del re-lanzamiento si se aprueba",
              mensaje: {
                asunto: "Sponsor para re-lanzamiento del programa de Servicio al Cliente Posventa",
                contenido: "Carlos,\n\nDado el resultado de CAP-2025-06 (NPS bajó 42→28), evaluamos re-lanzar el programa con otro proveedor y sponsor distinto. ¿Estarías dispuesto a ser sponsor del re-lanzamiento? Lo veo más alineado contigo dada tu visibilidad de los 3 talleres.\n\n--- 19-may 17:14 · Respuesta de C. Mendoza ---\nSí, lo tomo. Pero condicionado a: 1) cambio de proveedor (no Capacitec ni el actual), 2) plan de aplicación con role plays semanales y cliente misterioso bimestral, 3) decisión final tras la sesión del 27-may. — CM\n\nAgente RH" },
            },
          ],
        },
      ],
      patron: "2ª incidencia abierta de L. Cano. Cruza con diagnóstico de clima del taller Sur (B-005, B-006, B-012).",
    },
    {
      id: "INC-CAP-005",
      cursoId: "CAP-2025-12", cursoNombre: "Power BI para análisis financiero",
      fechaCierre: "28-feb-2026", costoCurso: 52000,
      solicitanteNombre: "Rodrigo Solís", solicitantePuesto: "Gerente de Finanzas",
      tipo: "Solicitante no asignó tiempo para aplicación",
      severidad: "Media", diasVencido: 83, estado: "En seguimiento",
      descripcion: "Los 4 participantes (incluyendo Beatriz Cordero) terminaron el programa pero no se les asignó proyecto de aplicación. Beatriz renunció 2 semanas después; los otros 3 no han usado las dashboards aprendidas en el ERP.",
      evidencias: [
        "Acuerdo previo: 'Cada participante construirá 1 dashboard Power BI productivo en los 60 días post'",
        "Dashboards productivos a la fecha: 0 de 4",
        "Beatriz Cordero (1 de los 4) renunció el 12-mar-2026 (B-014)",
        "Costo de Beatriz no recuperable: $13,000 (1 de 4 cuotas)",
      ],
      accionComprometida: "R. Solís debe asignar 1 dashboard real a cada uno de los 3 participantes restantes con fecha de entrega y review semanal.",
      responsableAccion: "Rodrigo Solís",
      fechaCompromiso: "15-jul-2026",
      proximosPasos: [
        {
          accion: "Política: capacitaciones técnicas requieren proyecto de aplicación aprobado por el solicitante ANTES de inscribirse",
          agentes: [
            {
              tipo: "email", destinatario: "Comité de Capacitación", fecha: "16-may 11:00", estado: "abierto",
              detalle: "Propuesta de política · 4 de 6 abierto",
              mensaje: {
                asunto: "Propuesta · Plan de aplicación obligatorio para capacitaciones técnicas",
                contenido: "Comité,\n\nDado el caso INC-CAP-005 (Power BI, 4 participantes, 0 dashboards productivos al cierre), propongo nueva política:\n\nRegla: Antes de inscribir colaboradores en capacitaciones técnicas (>$30K o >20 hrs), el solicitante debe entregar un 'Plan de aplicación' aprobado por su director que incluya:\n  1. Proyecto específico que el participante construirá\n  2. Fecha límite de entrega (≤90 días post-programa)\n  3. Métricas de éxito (productividad, ahorro, calidad)\n  4. Sponsor (no puede ser el mismo solicitante)\n\nExcepciones: capacitación regulatoria obligatoria.\n\nVoto en documento adjunto antes del 30-may.\n\nAgente RH" },
            },
          ],
        },
        {
          accion: "Reasignar la licencia perdida de Beatriz a otro analista",
          agentes: [
            {
              tipo: "whatsapp", destinatario: "R. Solís", fecha: "13-may 10:45", estado: "respondido",
              detalle: "Solicita 2 semanas para identificar candidato · plazo 27-may",
              mensaje: { contenido: "Hola Rodrigo, recuerda que la licencia Power BI de Beatriz (B-014) quedó sin asignar tras su salida. Costo no recuperado: $13,000. ¿Puedes identificar al analista que asumirá el proyecto?\n\n--- 13-may 11:20 · Respuesta de R. Solís ---\nDame 2 semanas. Andrés (B-013) también salió así que estoy con sucesión doble en el área. Plazo: 27-may con nombre concreto. — RS" },
            },
            {
              tipo: "recordatorio", fecha: "Cada 7 días", estado: "activo",
              detalle: "Recordatorio activo hasta confirmar reasignación",
              mensaje: { contenido: "Trigger: status(reasignacion_licencia_powerbi_beatriz) != 'Asignado'\nFrecuencia: Cada 7 días\nPróxima ejecución: 27-may-2026 (plazo comprometido por R. Solís)\nAcción al expirar: WhatsApp automático + escalación a S. Ramírez si no hay respuesta dentro de 24 hrs después del plazo." },
            },
          ],
        },
      ],
      patron: "Caso de inversión hundida (ver Rotación): la capacitación de Beatriz pasó a costo hundido por renuncia 2 semanas después.",
    },
    {
      id: "INC-CAP-006",
      cursoId: "CAP-2025-10", cursoNombre: "Liderazgo de piso — Operaciones Planta 2",
      fechaCierre: "15-ene-2026", costoCurso: 48000,
      solicitanteNombre: "Carlos Mendoza", solicitantePuesto: "Director de Operaciones",
      tipo: "ROI parcialmente medido, pendiente cierre formal",
      severidad: "Baja", diasVencido: 35, estado: "En seguimiento",
      descripcion: "El solicitante (C. Mendoza) sí inició la medición de ROI a 90 días pero el reporte está incompleto: faltan datos de scope-down de bajas en 1 de los 3 turnos. Tiene plan claro de cierre.",
      evidencias: [
        "Reporte preliminar entregado el 15-abr-2026 (a tiempo)",
        "Pendiente: cierre de medición del turno 2 (datos de M. Vargas)",
        "ROI parcial calculado: 1.4x (target 1.5x)",
      ],
      accionComprometida: "Entregar reporte final con datos del turno 2 antes del 15-jun-2026.",
      responsableAccion: "Carlos Mendoza + Manuel Vargas (Sup. Turno 2)",
      fechaCompromiso: "15-jun-2026",
      proximosPasos: [
        {
          accion: "Caso modelo de buen seguimiento — usar como template para los demás solicitantes",
          agentes: [
            {
              tipo: "email", destinatario: "Todos los Directores", fecha: "18-may 09:00", estado: "abierto",
              detalle: "Template de seguimiento de ROI compartido · 7 de 9 abierto",
              mensaje: {
                asunto: "Template recomendado · Seguimiento de ROI de capacitación (basado en INC-CAP-006)",
                contenido: "Estimados Directores,\n\nComparto el template de seguimiento de ROI que C. Mendoza usó en el programa 'Liderazgo de piso · Planta 2' (INC-CAP-006).\n\nA diferencia de las otras 5 incidencias abiertas, este caso entregó:\n  ✓ Reporte preliminar a 90 días post (a tiempo)\n  ✓ Datos cuantitativos de productividad por turno\n  ✓ ROI parcial calculado (1.4x vs target 1.5x)\n  ✓ Plan documentado para cerrar el 15% faltante\n\nDocumento adjunto en Drive: 'Template_Seguimiento_ROI_v1.0.docx'\n\nAgenda: C. Mendoza presentará el caso al Comité Ejecutivo el 10-jun.\n\nApertura: 7 de 9 directores.\n\nAgente RH" },
            },
            {
              tipo: "calendario", destinatario: "Comité Ejecutivo", fecha: "10-jun 15:00", estado: "programado",
              detalle: "Sesión de C. Mendoza compartiendo el caso · 30 min",
              mensaje: {
                asunto: "Comité Ejecutivo · Caso modelo de ROI · C. Mendoza",
                contenido: "Cuándo: 10-jun-2026 · 15:00 – 15:30 (30 min)\nDónde: Sala Directorio + Teams\n\nPresentador: C. Mendoza (Director de Operaciones)\nTema: 'Cómo medimos el ROI del programa de Liderazgo de Piso · Planta 2'\n\nObjetivo: instalar buenas prácticas a partir del único caso de capacitación en la empresa con seguimiento formal entregado a tiempo.\n\nMaterial: template + datos del caso." },
            },
            {
              tipo: "whatsapp", destinatario: "C. Mendoza", fecha: "20-may 11:00", estado: "respondido",
              detalle: "Confirma participar como presentador · respondió 'Listo'",
              mensaje: { contenido: "Hola Carlos, ¿confirmas tu participación el 10-jun al Comité Ejecutivo para presentar el caso de tu programa de Liderazgo de Piso como ejemplo de buen seguimiento de ROI?\n\n--- 20-may 11:08 · Respuesta de C. Mendoza ---\nListo. Mando agenda y datos a tu equipo antes del 05-jun. — CM" },
            },
          ],
        },
      ],
      patron: "C. Mendoza es referente de accountability en el comité (ver 360°). Este es el único caso 'sano' en la lista.",
    },
  ];

  const agregarCurso = () => {
    const inicio = form.fechaIni ? new Date(form.fechaIni) : null;
    const fin = form.fechaFin ? new Date(form.fechaFin) : null;
    if (!form.nombre || !inicio || !fin || !form.costoTotal || !form.roiEsperado) {
      alert("Completa al menos: nombre, fechas, costo y ROI esperado.");
      return;
    }
    const nextId = `CAP-${String(cursos.length + 1).padStart(2, "0")}`;
    const costoNum = parseInt(form.costoTotal.replace(/[^0-9]/g, "")) || 0;
    const horasNum = parseInt(form.horasTotales) || 0;
    const partTotal = parseInt(form.participantesTotal) || 0;
    const nuevo = {
      id: nextId, nombre: form.nombre,
      solicita: form.solicitanteArea,
      fechaIni: formatFechaCorta(inicio), fechaFin: formatFechaCorta(fin),
      costo: costoNum, roi: form.roiEsperado, est: "Solicitud", progreso: 0,
      descripcion: form.descripcion || "Sin descripción.",
      categoria: form.categoria,
      empresaCapacitadora: {
        nombre: form.empresaNombre || "Por definir",
        contacto: form.empresaContacto || "—",
        modalidad: form.empresaModalidad,
        certificacion: form.certificacion || "—",
      },
      solicitante: {
        nombre: form.solicitanteNombre || "Por definir",
        puesto: form.solicitantePuesto || "—",
        area: form.solicitanteArea,
        justificacion: form.justificacion || "Sin justificación documentada.",
      },
      aprobadoPor: { nombre: "Pendiente de aprobación", fecha: "—", costoAprobado: 0 },
      pm: { nombre: "Pendiente de asignar", puesto: "—" },
      participantes: { total: partTotal, perfiles: form.participantesPerfiles || "—" },
      objetivos: form.justificacion ? [form.justificacion] : ["Por definir al aprobar"],
      temario: ["Por definir con la empresa capacitadora"],
      modalidad: form.empresaModalidad, horasTotales: horasNum,
      costoDesglose: [{ concepto: "Costo total estimado", monto: costoNum }],
      roiDetalle: {
        metricaPrincipal: form.metricaPrincipal || "Por definir",
        baseline: form.baseline || "Por levantar",
        target: form.target || "Por definir",
        comoSeMide: form.comoSeMide || "Metodología por definir",
        fechaMedicion: form.fechaMedicion || "Por programar",
        beneficiosEsperados: form.beneficiosEsperados || "Por cuantificar",
      },
      evaluaciones: ["Por definir con la empresa capacitadora"],
    };
    setCursos([...cursos, nuevo]);
    setForm(formInicial);
    setNuevoOpen(false);
  };

  // Calcular ventana del Gantt: del 1 del mes mínimo al último día del mes máximo + 1
  const fechasValidas = cursos
    .map((c) => ({ ini: parseFecha(c.fechaIni), fin: parseFecha(c.fechaFin) }))
    .filter((f) => f.ini && f.fin);
  const fallbackGantt = new Date(2026, 4, 1);
  const minDate = fechasValidas.length
    ? new Date(Math.min(...fechasValidas.map((f) => f.ini.getTime())))
    : fallbackGantt;
  const maxDate = fechasValidas.length
    ? new Date(Math.max(...fechasValidas.map((f) => f.fin.getTime())))
    : new Date(2026, 6, 30);
  const ganttIni = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const ganttFin = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0); // último día del mes siguiente
  const totalDias = Math.max(1, Math.ceil((ganttFin - ganttIni) / 86400000) + 1);

  // Generar columnas de meses
  const mesesGantt = [];
  let cursor = new Date(ganttIni);
  while (cursor <= ganttFin) {
    const mesIni = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const mesFin = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const diasMes = mesFin.getDate();
    const pctIni = ((mesIni - ganttIni) / 86400000 / totalDias) * 100;
    const pctAncho = (diasMes / totalDias) * 100;
    mesesGantt.push({ label: `${meses[mesIni.getMonth()].toUpperCase()} ${mesIni.getFullYear()}`, pctIni, pctAncho, diasMes });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Hoy (asumido 22-may-2026 por contexto del sistema)
  const hoy = new Date(2026, 4, 22);
  const hoyPct = Math.max(0, Math.min(100, ((hoy - ganttIni) / 86400000 / totalDias) * 100));

  const colorPorEstado = (est) => est === "En curso" ? "#0a7d2c" : est === "Programado" ? "#3498db" : "#d97706";
  const colorPorEstadoBg = (est) => est === "En curso" ? "#86efac" : est === "Programado" ? "#bfdbfe" : "#fde68a";

  return (
    <div>
      <h2 style={S.h2}>Capacitación y Entrenamiento</h2>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Cursos activos</div>
            <div style={S.kpiValue}>2</div>
            <div style={S.kpiBenchmark("green")}>Capacidad simultánea: 2-3</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Programados</div>
            <div style={S.kpiValue}>1</div>
            <div style={S.kpiBenchmark("yellow")}>Pipeline saludable: ≥3</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Inversión YTD</div>
            <div style={S.kpiValue}>$288K</div>
            <div style={S.kpiBenchmark("green")}>Presupuesto anual: $360K</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>ROI promedio</div>
            <div style={S.kpiValue}>1.8x</div>
            <div style={S.kpiBenchmark("green")}>Meta: ≥1.5x</div>
          </div>
          <TrafficLight light="green" />
        </div>
      </div>

      <h3 style={S.h3}>Pipeline de capacitación</h3>
      <p style={{ ...S.hint, marginTop: -4 }}>Haz click en cualquier curso para ver el desglose completo.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Folio</th>
            <th style={S.th}>Programa</th>
            <th style={S.th}>Solicita</th>
            <th style={S.th}>Inicio</th>
            <th style={S.th}>Fin</th>
            <th style={S.th}>Costo</th>
            <th style={S.th}>ROI esperado</th>
            <th style={S.th}>Estado</th>
            <th style={S.th}></th>
          </tr>
        </thead>
        <tbody>
          {cursos.map((c) => (
            <tr
              key={c.id}
              onClick={() => setCursoAbierto(c)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={S.td}><strong>{c.id}</strong></td>
              <td style={S.td}>{c.nombre}</td>
              <td style={S.td}>{c.solicita}</td>
              <td style={S.td}>{c.fechaIni}</td>
              <td style={S.td}>{c.fechaFin}</td>
              <td style={S.td}>${c.costo.toLocaleString("es-MX")}</td>
              <td style={S.td}>{c.roi}</td>
              <td style={S.td}>
                <span style={S.badge(
                  c.est === "En curso" ? "#e8f5e9" :
                  c.est === "Programado" ? "#eef5ff" : "#fff7e0"
                )}>{c.est}</span>
              </td>
              <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12 }}>Ver detalle →</td>
            </tr>
          ))}
        </tbody>
      </table>

      {cursoAbierto && (
        <div
          onClick={() => setCursoAbierto(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 8, padding: 24,
              width: 1000, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto",
              border: "1px solid #ccc",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ ...S.kpiLabel, color: "#64748b" }}>{cursoAbierto.id}</span>
                  <span style={S.badge(cursoAbierto.est === "En curso" ? "#e8f5e9" : cursoAbierto.est === "Programado" ? "#eef5ff" : "#fff7e0")}>{cursoAbierto.est}</span>
                  <span style={S.badge("#f1f5f9")}>{cursoAbierto.categoria}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cursoAbierto.nombre}</h3>
                <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0 0", lineHeight: 1.5, maxWidth: 720 }}>{cursoAbierto.descripcion}</p>
              </div>
              <button
                onClick={() => setCursoAbierto(null)}
                style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}
                aria-label="Cerrar"
              >×</button>
            </div>

            {/* KPIs principales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Costo total</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>${cursoAbierto.costo.toLocaleString("es-MX")}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{cursoAbierto.aprobadoPor.costoAprobado ? `Aprobado ${cursoAbierto.aprobadoPor.fecha}` : "Pendiente de aprobación"}</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>ROI esperado</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#0a7d2c" }}>{cursoAbierto.roi}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{cursoAbierto.roiDetalle.metricaPrincipal}</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Participantes</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{cursoAbierto.participantes.total}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{cursoAbierto.horasTotales} hrs · {cursoAbierto.modalidad.split(" · ")[0]}</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Progreso</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{cursoAbierto.progreso}%</div>
                <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 3, marginTop: 4 }}>
                  <div style={{ width: `${cursoAbierto.progreso}%`, height: "100%", background: "#0a7d2c", borderRadius: 3 }} />
                </div>
              </div>
            </div>

            {/* 2 columnas: solicitante + empresa */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Solicitante y patrocinio</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cursoAbierto.solicitante.nombre}</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>{cursoAbierto.solicitante.puesto} · {cursoAbierto.solicitante.area}</div>
                <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5, padding: "8px 10px", background: "#f8fafc", borderLeft: "3px solid #cbd5e1", borderRadius: 2, marginBottom: 10 }}>
                  <strong>Justificación:</strong> {cursoAbierto.solicitante.justificacion}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  <strong>Aprobado por:</strong> {cursoAbierto.aprobadoPor.nombre}{cursoAbierto.aprobadoPor.fecha !== "—" ? ` (${cursoAbierto.aprobadoPor.fecha})` : ""}<br />
                  <strong>Project Manager:</strong> {cursoAbierto.pm.nombre} · {cursoAbierto.pm.puesto}
                </div>
              </div>
              <div style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Empresa capacitadora</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cursoAbierto.empresaCapacitadora.nombre}</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Contacto: {cursoAbierto.empresaCapacitadora.contacto}</div>
                <div style={{ fontSize: 12, color: "#0f172a", marginBottom: 4 }}><strong>Modalidad:</strong> {cursoAbierto.modalidad}</div>
                <div style={{ fontSize: 12, color: "#0f172a", marginBottom: 4 }}><strong>Duración:</strong> {cursoAbierto.horasTotales} horas totales · {cursoAbierto.fechaIni} → {cursoAbierto.fechaFin}</div>
                <div style={{ fontSize: 12, color: "#0f172a" }}><strong>Certificación:</strong> {cursoAbierto.empresaCapacitadora.certificacion}</div>
              </div>
            </div>

            {/* Participantes */}
            <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Participantes</div>
            <div style={{ fontSize: 13, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 16 }}>
              <strong>{cursoAbierto.participantes.total} colaboradores</strong> — {cursoAbierto.participantes.perfiles}
            </div>

            {/* Objetivos */}
            <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Objetivos del programa</div>
            <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
              {cursoAbierto.objetivos.map((o, i) => <li key={i}>{o}</li>)}
            </ul>

            {/* Temario y costo desglose en 2 columnas */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Temario</div>
                <table style={{ ...S.table, fontSize: 12 }}>
                  <tbody>
                    {cursoAbierto.temario.map((t, i) => (
                      <tr key={i}><td style={S.td}>{t}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Desglose de costo</div>
                <table style={{ ...S.table, fontSize: 12 }}>
                  <tbody>
                    {cursoAbierto.costoDesglose.map((d, i) => (
                      <tr key={i}>
                        <td style={S.td}>{d.concepto}</td>
                        <td style={{ ...S.td, textAlign: "right", fontWeight: 600 }}>${d.monto.toLocaleString("es-MX")}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#fafafa" }}>
                      <td style={{ ...S.td, fontWeight: 700 }}>Total</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>${cursoAbierto.costo.toLocaleString("es-MX")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROI: cómo se mide */}
            <div style={{ ...S.card, marginBottom: 16, background: "#f6fbf6", borderColor: "#86efac" }}>
              <div style={{ ...S.kpiLabel, color: "#0a7d2c", marginBottom: 8 }}>Cómo se mide el ROI ({cursoAbierto.roi} esperado)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Métrica principal</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{cursoAbierto.roiDetalle.metricaPrincipal}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Fecha de medición</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{cursoAbierto.roiDetalle.fechaMedicion}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Baseline (estado actual)</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{cursoAbierto.roiDetalle.baseline}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Target (post-programa)</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{cursoAbierto.roiDetalle.target}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5, marginBottom: 8 }}>
                <strong>Metodología:</strong> {cursoAbierto.roiDetalle.comoSeMide}
              </div>
              <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5, padding: "8px 10px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4 }}>
                <strong>Beneficios esperados:</strong> {cursoAbierto.roiDetalle.beneficiosEsperados}
              </div>
            </div>

            {/* Evaluaciones */}
            <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Esquema de evaluación</div>
            <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
              {cursoAbierto.evaluaciones.map((e, i) => <li key={i}>{e}</li>)}
            </ul>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <button style={S.btn} onClick={() => setCursoAbierto(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <h3 style={{ ...S.h3, margin: 0 }}>Vista calendario</h3>
        <button style={S.btn} onClick={() => setNuevoOpen(true)}>+ Nueva entrada</button>
      </div>
      <p style={S.hint}>Gantt mensual con los programas activos, traslapes y responsables. Click en cualquier barra para ver el detalle.</p>
      <ChartCopy label="Gantt mensual de capacitación"><div style={S.card}>
        {/* Header con meses */}
        <div style={{ display: "flex", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <div style={{ width: 220, flexShrink: 0 }}>Programa</div>
          <div style={{ flex: 1, position: "relative", height: 18 }}>
            {mesesGantt.map((m, i) => (
              <div key={i} style={{ position: "absolute", left: `${m.pctIni}%`, width: `${m.pctAncho}%`, top: 0, borderLeft: "1px solid #e5e5e5", paddingLeft: 6, boxSizing: "border-box" }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Filas del Gantt — labels a la izquierda, timeline a la derecha con overlay HOY */}
        <div style={{ display: "flex" }}>
          {/* Columna de labels (220px) */}
          <div style={{ width: 220, flexShrink: 0 }}>
            {cursos.map((c) => (
              <div key={c.id} style={{ height: 38, borderTop: "1px solid #f1f5f9", paddingRight: 12, fontSize: 12, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.id}</div>
                <div style={{ color: "#475569", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</div>
              </div>
            ))}
          </div>

          {/* Columna timeline (flex 1) — contiene HOY como overlay */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Línea HOY que abarca todas las filas */}
            <div style={{ position: "absolute", left: `${hoyPct}%`, top: 0, bottom: 0, width: 2, background: "#b00020", zIndex: 3, pointerEvents: "none" }} title="Hoy">
              <div style={{ position: "absolute", top: -14, left: -14, fontSize: 9, color: "#fff", fontWeight: 700, background: "#b00020", padding: "1px 5px", borderRadius: 2, whiteSpace: "nowrap" }}>HOY</div>
            </div>

            {cursos.map((c) => {
              const ini = parseFecha(c.fechaIni);
              const fin = parseFecha(c.fechaFin);
              const fechasOk = ini && fin && fin >= ini;
              const pctIni = fechasOk ? ((ini - ganttIni) / 86400000 / totalDias) * 100 : 0;
              const pctAncho = fechasOk ? Math.max(2, ((fin - ini) / 86400000 / totalDias) * 100) : 0;
              return (
                <div key={c.id} style={{ height: 38, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center" }}>
                  <div style={{ width: "100%", position: "relative", height: 24, background: "#fafafa", borderRadius: 3 }}>
                    {/* Líneas verticales por mes */}
                    {mesesGantt.map((m, i) => (
                      <div key={i} style={{ position: "absolute", left: `${m.pctIni}%`, top: 0, bottom: 0, width: 1, background: "#e5e5e5" }} />
                    ))}
                    {/* Barra del curso */}
                    {fechasOk ? (
                    <div
                      onClick={() => setCursoAbierto(c)}
                      title={`${c.nombre} · ${c.fechaIni} → ${c.fechaFin} · $${c.costo.toLocaleString("es-MX")} · ROI ${c.roi}`}
                      style={{
                        position: "absolute",
                        left: `${pctIni}%`,
                        width: `${pctAncho}%`,
                        top: 2,
                        bottom: 2,
                        background: colorPorEstadoBg(c.est),
                        border: `1.5px solid ${colorPorEstado(c.est)}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#0f172a",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      transition: "transform 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scaleY(1.15)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scaleY(1)")}
                  >
                    {c.id} · ${(c.costo / 1000).toFixed(0)}K · {c.roi}
                  </div>
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10, color: "#94a3b8" }}>
                        Fechas inválidas ({c.fechaIni} → {c.fechaFin})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e5e5", fontSize: 11, color: "#475569" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: "#86efac", border: "1.5px solid #0a7d2c", borderRadius: 3 }} />
            En curso
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: "#bfdbfe", border: "1.5px solid #3498db", borderRadius: 3 }} />
            Programado
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: "#fde68a", border: "1.5px solid #d97706", borderRadius: 3 }} />
            Solicitud / Pendiente
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 2, height: 12, background: "#b00020" }} />
            Hoy
          </span>
        </div>
      </div></ChartCopy>

      {/* Incidencias de capacitación — accountability */}
      <h3 style={S.h3}>Incidencias de capacitación · Accountability</h3>
      <p style={{ ...S.hint, marginTop: -4 }}>
        Casos donde el solicitante no dio seguimiento al programa (ROI no medido, ausentismo no escalado, proveedor mal calificado, etc.). Click en cualquier fila para ver el caso.
      </p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Folio</th>
            <th style={S.th}>Curso · Cierre</th>
            <th style={S.th}>Solicitante</th>
            <th style={S.th}>Tipo de incidencia</th>
            <th style={S.th}>Severidad</th>
            <th style={S.th}>Días vencido</th>
            <th style={S.th}>Estado</th>
            <th style={S.th}></th>
          </tr>
        </thead>
        <tbody>
          {incidenciasCap.map((inc) => {
            const sevColor = inc.severidad === "Alta" ? "#fdecea" : inc.severidad === "Media" ? "#fff7e0" : "#eef5ff";
            const sevText = inc.severidad === "Alta" ? "#b00020" : inc.severidad === "Media" ? "#b58900" : "#1d4ed8";
            const estColor = inc.estado === "Abierta" ? "#fdecea" : inc.estado === "En seguimiento" ? "#fff7e0" : "#e8f5e9";
            return (
              <tr
                key={inc.id}
                onClick={() => setIncidenciaAbierta(inc)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={S.td}><strong>{inc.id}</strong></td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>{inc.cursoNombre}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{inc.cursoId} · Cerró {inc.fechaCierre}</div>
                </td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>{inc.solicitanteNombre}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{inc.solicitantePuesto}</div>
                </td>
                <td style={S.td}>{inc.tipo}</td>
                <td style={S.td}><span style={{ ...S.badge(sevColor), color: sevText, fontWeight: 700 }}>{inc.severidad}</span></td>
                <td style={S.td}>
                  <span style={{ fontWeight: 700, color: inc.diasVencido > 120 ? "#b00020" : inc.diasVencido > 60 ? "#d97706" : "#475569" }}>
                    {inc.diasVencido} días
                  </span>
                </td>
                <td style={S.td}><span style={S.badge(estColor)}>{inc.estado}</span></td>
                <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12 }}>Ver caso →</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal de incidencia */}
      {incidenciaAbierta && (
        <div
          onClick={() => setIncidenciaAbierta(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 8, padding: 24, width: 880, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid #ccc" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ ...S.kpiLabel, color: "#64748b" }}>{incidenciaAbierta.id}</span>
                  <span style={{ ...S.badge(incidenciaAbierta.severidad === "Alta" ? "#fdecea" : incidenciaAbierta.severidad === "Media" ? "#fff7e0" : "#eef5ff"), fontWeight: 700 }}>{incidenciaAbierta.severidad}</span>
                  <span style={S.badge(incidenciaAbierta.estado === "Abierta" ? "#fdecea" : incidenciaAbierta.estado === "En seguimiento" ? "#fff7e0" : "#e8f5e9")}>{incidenciaAbierta.estado}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{incidenciaAbierta.tipo}</h3>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                  {incidenciaAbierta.cursoNombre} ({incidenciaAbierta.cursoId}) · Cerrado el {incidenciaAbierta.fechaCierre}
                </div>
              </div>
              <button onClick={() => setIncidenciaAbierta(null)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Solicitante responsable</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{incidenciaAbierta.solicitanteNombre}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{incidenciaAbierta.solicitantePuesto}</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Días vencido</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: incidenciaAbierta.diasVencido > 120 ? "#b00020" : incidenciaAbierta.diasVencido > 60 ? "#d97706" : "#475569" }}>
                  {incidenciaAbierta.diasVencido}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>desde fecha de cierre del programa</div>
              </div>
              <div style={{ ...S.kpi, padding: 12 }}>
                <div style={S.kpiLabel}>Inversión en riesgo</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#b00020" }}>${incidenciaAbierta.costoCurso.toLocaleString("es-MX")}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>sin ROI demostrado</div>
              </div>
            </div>

            {/* Descripción */}
            <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Descripción del caso</div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, marginBottom: 16, padding: "10px 12px", background: "#fdecea", borderLeft: "3px solid #b00020", borderRadius: 4 }}>
              {incidenciaAbierta.descripcion}
            </div>

            {/* Evidencias */}
            <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Evidencias ({incidenciaAbierta.evidencias.length})</div>
            <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
              {incidenciaAbierta.evidencias.map((e, i) => <li key={i}>{e}</li>)}
            </ul>

            {/* Acción comprometida */}
            <div style={{ ...S.card, marginBottom: 12, background: "#fff7e0", borderColor: "#f0d999" }}>
              <div style={{ ...S.kpiLabel, color: "#b58900", marginBottom: 6 }}>Acción comprometida</div>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, marginBottom: 8 }}>
                {incidenciaAbierta.accionComprometida}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <div><strong>Responsable:</strong> {incidenciaAbierta.responsableAccion}</div>
                <div><strong>Fecha compromiso:</strong> {incidenciaAbierta.fechaCompromiso}</div>
              </div>
            </div>

            {/* Próximos pasos con actividad del agente */}
            {(() => {
              const tipoLabel = {
                whatsapp: "WhatsApp",
                email: "Email",
                llamada: "Llamada",
                sistema: "Sistema",
                calendario: "Calendario",
                recordatorio: "Auto-recordatorio",
              };
              const tipoIcon = {
                whatsapp: { char: "W", bg: "#25D366" },
                email: { char: "@", bg: "#0a7d2c" },
                llamada: { char: "☎", bg: "#3498db" },
                sistema: { char: "⚙", bg: "#475569" },
                calendario: { char: "▦", bg: "#7c3aed" },
                recordatorio: { char: "↻", bg: "#d97706" },
              };
              const estadoConfig = {
                leido: { label: "Leído", color: "#0a7d2c", bg: "#dcfce7", indicador: "✓✓", indicadorColor: "#2563eb" },
                leido_sin_respuesta: { label: "Leído sin respuesta", color: "#b45309", bg: "#fff7e0", indicador: "✓✓", indicadorColor: "#2563eb" },
                no_leido: { label: "No leído", color: "#64748b", bg: "#f1f5f9", indicador: "✓✓", indicadorColor: "#94a3b8" },
                entregado: { label: "Entregado", color: "#64748b", bg: "#f1f5f9", indicador: "✓", indicadorColor: "#94a3b8" },
                respondido: { label: "Respondido", color: "#0a7d2c", bg: "#dcfce7", indicador: "↩", indicadorColor: "#0a7d2c" },
                ejecutado: { label: "Ejecutado", color: "#1d4ed8", bg: "#dbeafe", indicador: "●", indicadorColor: "#1d4ed8" },
                programado: { label: "Programado", color: "#1d4ed8", bg: "#dbeafe", indicador: "⏳", indicadorColor: "#1d4ed8" },
                abierto: { label: "Abierto", color: "#0a7d2c", bg: "#dcfce7", indicador: "👁", indicadorColor: "#0a7d2c" },
                activo: { label: "Activo", color: "#0a7d2c", bg: "#dcfce7", indicador: "●", indicadorColor: "#0a7d2c" },
                perdida: { label: "Llamada perdida", color: "#b00020", bg: "#fdecea", indicador: "✗", indicadorColor: "#b00020" },
              };
              // Resumen de actividad para el header del bloque
              const totalAgentes = incidenciaAbierta.proximosPasos.reduce((sum, p) => sum + (typeof p === "object" ? (p.agentes?.length || 0) : 0), 0);
              const sinRespuesta = incidenciaAbierta.proximosPasos.reduce((sum, p) => sum + (typeof p === "object" ? (p.agentes?.filter(a => a.estado === "leido_sin_respuesta" || a.estado === "no_leido" || a.estado === "perdida").length || 0) : 0), 0);
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={S.kpiLabel}>Próximos pasos · Actividad del agente</div>
                    {totalAgentes > 0 && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {totalAgentes} acciones automáticas · {sinRespuesta > 0 ? <span style={{ color: "#b00020", fontWeight: 700 }}>{sinRespuesta} sin respuesta</span> : <span style={{ color: "#0a7d2c", fontWeight: 700 }}>todas atendidas</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {incidenciaAbierta.proximosPasos.map((p, i) => {
                      const accion = typeof p === "string" ? p : p.accion;
                      const agentes = typeof p === "string" ? [] : (p.agentes || []);
                      return (
                        <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 12px", background: "#fff" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: agentes.length > 0 ? 10 : 0 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {i + 1}
                            </div>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0f172a", lineHeight: 1.5 }}>{accion}</div>
                          </div>
                          {agentes.length > 0 && (
                            <div style={{ paddingLeft: 32, display: "flex", flexDirection: "column", gap: 6 }}>
                              {agentes.map((a, j) => {
                                const icon = tipoIcon[a.tipo] || { char: "?", bg: "#94a3b8" };
                                const est = estadoConfig[a.estado] || { label: a.estado, color: "#475569", bg: "#f1f5f9", indicador: "·", indicadorColor: "#94a3b8" };
                                const key = `${i}-${j}`;
                                const expandido = mensajeAbierto === key;
                                const tieneMensaje = !!a.mensaje;
                                const labelBoton = a.tipo === "whatsapp" ? "Ver mensaje" : a.tipo === "email" ? "Ver correo" : a.tipo === "llamada" ? "Ver nota de llamada" : a.tipo === "calendario" ? "Ver invitación" : a.tipo === "sistema" ? "Ver log" : "Ver trigger";
                                return (
                                  <div key={j} style={{ background: "#fafafa", borderRadius: 4, border: "1px solid #f1f5f9", overflow: "hidden" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px" }}>
                                      <div style={{ width: 22, height: 22, borderRadius: 4, background: icon.bg, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: a.tipo === "email" ? "serif" : "inherit" }}>
                                        {icon.char}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{tipoLabel[a.tipo] || a.tipo}</span>
                                          {a.destinatario && <span style={{ fontSize: 11, color: "#475569" }}>· {a.destinatario}</span>}
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>· {a.fecha}</span>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 10, background: est.bg, color: est.color, fontSize: 10, fontWeight: 700, marginLeft: "auto" }}>
                                            <span style={{ color: est.indicadorColor, fontFamily: "monospace", fontSize: 10 }}>{est.indicador}</span>
                                            {est.label}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{a.detalle}</div>
                                        {tieneMensaje && (
                                          <button
                                            onClick={() => setMensajeAbierto(expandido ? null : key)}
                                            style={{
                                              marginTop: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                                              padding: "2px 8px", border: "1px solid #cbd5e1", background: expandido ? "#0f172a" : "#fff",
                                              color: expandido ? "#fff" : "#0f172a", borderRadius: 3, cursor: "pointer",
                                              fontFamily: "inherit", textTransform: "uppercase",
                                            }}
                                          >
                                            {expandido ? "▾ Ocultar" : `▸ ${labelBoton}`}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {expandido && tieneMensaje && (
                                      <div style={{ borderTop: "1px solid #e5e5e5", padding: "10px 12px", background: a.tipo === "whatsapp" ? "#ecfdf5" : a.tipo === "email" ? "#fafaff" : "#fff" }}>
                                        {a.mensaje.asunto && (
                                          <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, paddingBottom: 6, borderBottom: "1px dashed #e5e5e5" }}>
                                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{a.tipo === "email" ? "Asunto: " : a.tipo === "calendario" ? "Evento: " : ""}</span>
                                            {a.mensaje.asunto}
                                          </div>
                                        )}
                                        <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: a.tipo === "sistema" ? "ui-monospace, monospace" : "inherit" }}>
                                          {a.mensaje.contenido}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Patrón */}
            <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 4, fontSize: 12, color: "#475569", marginBottom: 16 }}>
              <strong style={{ color: "#0f172a" }}>Patrón detectado:</strong> {incidenciaAbierta.patron}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <button style={S.btn} onClick={() => setIncidenciaAbierta(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de nueva entrada */}
      {nuevoOpen && (() => {
        const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 4, display: "block" };
        const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
        const sectionTitle = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#0f172a", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #e2e8f0" };
        return (
          <div
            onClick={() => setNuevoOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, padding: 24, width: 920, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid #ccc" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nueva solicitud de capacitación</h3>
                  <p style={{ ...S.hint, margin: "4px 0 0 0" }}>Folio se asignará automáticamente. Todos los campos son aproximados — se ajustan al aprobar con la empresa capacitadora.</p>
                </div>
                <button onClick={() => setNuevoOpen(false)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
              </div>

              {/* Sección: Programa */}
              <div style={sectionTitle}>1 · Programa</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre del programa *</label>
                  <input style={inputStyle} value={form.nombre} onChange={(e) => setF("nombre", e.target.value)} placeholder="Ej. Liderazgo nivel medio" />
                </div>
                <div>
                  <label style={labelStyle}>Categoría</label>
                  <select style={inputStyle} value={form.categoria} onChange={(e) => setF("categoria", e.target.value)}>
                    <option>Desarrollo de liderazgo</option>
                    <option>Habilidades comerciales</option>
                    <option>Actualización técnica regulatoria</option>
                    <option>Servicio y experiencia del cliente</option>
                    <option>Operación y procesos</option>
                    <option>Tecnología y herramientas</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Descripción breve</label>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.descripcion} onChange={(e) => setF("descripcion", e.target.value)} placeholder="Qué busca lograr el programa, contexto..." />
              </div>

              {/* Sección: Solicitante */}
              <div style={sectionTitle}>2 · Solicitante y justificación</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Nombre solicitante</label>
                  <input style={inputStyle} value={form.solicitanteNombre} onChange={(e) => setF("solicitanteNombre", e.target.value)} placeholder="Ej. Carlos Mendoza" />
                </div>
                <div>
                  <label style={labelStyle}>Puesto</label>
                  <input style={inputStyle} value={form.solicitantePuesto} onChange={(e) => setF("solicitantePuesto", e.target.value)} placeholder="Ej. Director de Operaciones" />
                </div>
                <div>
                  <label style={labelStyle}>Área *</label>
                  <select style={inputStyle} value={form.solicitanteArea} onChange={(e) => setF("solicitanteArea", e.target.value)}>
                    {["Comercial", "Posventa", "Operaciones", "Administración", "Dirección"].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Justificación (por qué se necesita)</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.justificacion} onChange={(e) => setF("justificacion", e.target.value)} placeholder="Problema o oportunidad que el programa resuelve..." />
              </div>

              {/* Sección: Empresa capacitadora */}
              <div style={sectionTitle}>3 · Empresa capacitadora</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Nombre de la empresa</label>
                  <input style={inputStyle} value={form.empresaNombre} onChange={(e) => setF("empresaNombre", e.target.value)} placeholder="Ej. IPADE Business School" />
                </div>
                <div>
                  <label style={labelStyle}>Contacto (nombre + email)</label>
                  <input style={inputStyle} value={form.empresaContacto} onChange={(e) => setF("empresaContacto", e.target.value)} placeholder="Ej. Dr. Anzaldúa · anzaldua@ipade.mx" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Modalidad</label>
                  <select style={inputStyle} value={form.empresaModalidad} onChange={(e) => setF("empresaModalidad", e.target.value)}>
                    <option>Presencial</option>
                    <option>Virtual sincrónico</option>
                    <option>Híbrida</option>
                    <option>Autoestudio (e-learning)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Certificación a obtener</label>
                  <input style={inputStyle} value={form.certificacion} onChange={(e) => setF("certificacion", e.target.value)} placeholder="Ej. Certificado IPADE en Liderazgo" />
                </div>
              </div>

              {/* Sección: Participantes y fechas */}
              <div style={sectionTitle}>4 · Participantes y agenda</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Participantes (#)</label>
                  <input type="number" min="1" style={inputStyle} value={form.participantesTotal} onChange={(e) => setF("participantesTotal", e.target.value)} placeholder="Ej. 12" />
                </div>
                <div>
                  <label style={labelStyle}>Perfiles</label>
                  <input style={inputStyle} value={form.participantesPerfiles} onChange={(e) => setF("participantesPerfiles", e.target.value)} placeholder="Ej. 12 supervisores de planta" />
                </div>
                <div>
                  <label style={labelStyle}>Horas totales</label>
                  <input type="number" min="1" style={inputStyle} value={form.horasTotales} onChange={(e) => setF("horasTotales", e.target.value)} placeholder="Ej. 64" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Fecha de inicio *</label>
                  <input type="date" style={inputStyle} value={form.fechaIni} onChange={(e) => setF("fechaIni", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Fecha de fin *</label>
                  <input type="date" style={inputStyle} value={form.fechaFin} onChange={(e) => setF("fechaFin", e.target.value)} />
                </div>
              </div>

              {/* Sección: Inversión */}
              <div style={sectionTitle}>5 · Inversión ($)</div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Costo total estimado * (MXN)</label>
                <input style={inputStyle} value={form.costoTotal} onChange={(e) => setF("costoTotal", e.target.value)} placeholder="Ej. 85000" />
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Incluye honorarios del instructor, materiales, hospedaje, certificación y medición post-programa.</div>
              </div>

              {/* Sección: ROI */}
              <div style={sectionTitle}>6 · ROI esperado y cómo se medirá</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>ROI esperado * (ej. 2.1x)</label>
                  <input style={inputStyle} value={form.roiEsperado} onChange={(e) => setF("roiEsperado", e.target.value)} placeholder="Ej. 2.1x" />
                </div>
                <div>
                  <label style={labelStyle}>Métrica principal *</label>
                  <input style={inputStyle} value={form.metricaPrincipal} onChange={(e) => setF("metricaPrincipal", e.target.value)} placeholder="Ej. Reducción de rotación voluntaria en equipos de los participantes" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Baseline (estado actual)</label>
                  <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.baseline} onChange={(e) => setF("baseline", e.target.value)} placeholder="Ej. Rotación voluntaria 2025: 18% anual" />
                </div>
                <div>
                  <label style={labelStyle}>Target (post-programa)</label>
                  <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.target} onChange={(e) => setF("target", e.target.value)} placeholder="Ej. Reducir a ≤12% en 12 meses post-programa" />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Cómo se medirá (metodología)</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.comoSeMide} onChange={(e) => setF("comoSeMide", e.target.value)} placeholder="Quién, qué fuente de datos, qué cadencia, cómo se calcula el ROI financiero..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Fecha(s) de medición</label>
                  <input style={inputStyle} value={form.fechaMedicion} onChange={(e) => setF("fechaMedicion", e.target.value)} placeholder="Ej. 90 días post + 6 meses post" />
                </div>
                <div>
                  <label style={labelStyle}>Beneficios esperados cuantificados</label>
                  <input style={inputStyle} value={form.beneficiosEsperados} onChange={(e) => setF("beneficiosEsperados", e.target.value)} placeholder="Ej. $180K en costos de rotación evitados + mejora 0.3 pts en score 360°" />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                <button style={S.btnGhost} onClick={() => { setForm(formInicial); setNuevoOpen(false); }}>Cancelar</button>
                <button style={S.btn} onClick={agregarCurso}>Crear solicitud</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// =============================================================
// 5. PROCESO DE SELECCIÓN
// =============================================================
function Seleccion({ onAbrirGuia }) {
  const [candidatoAbierto, setCandidatoAbierto] = useState(null);

  const etapas = [
    "Solicitud (vacante autorizada)",
    "Sourcing y atracción",
    "Filtro de CV",
    "Entrevista RH",
    "Pruebas (técnicas / psicométricas)",
    "Entrevista con área solicitante",
    "Entrevista final / Dirección",
    "Oferta económica",
    "Verificación de referencias",
    "Contratación",
    "Onboarding 30-60-90+",
  ];

  // Helper: construye un checklist de 11 etapas, marcando como completas hasta `hastaIdx` (exclusivo)
  const mkChecklist = (hastaIdx, datos = {}) => etapas.map((e, i) => ({
    idx: i, label: e,
    completado: i < hastaIdx,
    enCurso: i === hastaIdx,
    fecha: datos[i]?.fecha || (i < hastaIdx ? "—" : ""),
    responsable: datos[i]?.responsable || "",
    notas: datos[i]?.notas || "",
  }));

  const candidatos = [
    {
      id: "CAND-1042", nombre: "Ana Ramírez", email: "ana.ramirez@correo.mx",
      puesto: "Asesor Comercial Sr.", area: "Comercial", requisicion: "REQ-101",
      solicitanteNombre: "Guillermo Pérez", solicitantePuesto: "Gerente Comercial Centro",
      jefeDirecto: "Guillermo Pérez", fechaSolicitudVacante: "08-abr-2026",
      fechaIngresoEsperada: "01-jun-2026", diasEnProceso: 44, score: 8.5,
      canalReclutamiento: "Referido interno (Alejandro Méndez ex-B-003)",
      sueldoOfertado: 28000, sueldoPresupuesto: 30000, bonoFirma: 5000, bonoTrimestral: 6000,
      prestaciones: "Ley + GMM + Vales $2,000/mes",
      etapaActualIdx: 6, // En "Entrevista final / Dirección"
      notasGenerales: "Top de su pipeline previo. Buena referencia de Alejandro Méndez. Solicita arranque rápido por noviazgo con OEM regional.",
      historial: {
        0: { fecha: "08-abr", responsable: "G. Pérez · Comité Plantilla", notas: "REQ-101 autorizada en sesión del 08-abr (cubre salida de Alejandro Méndez B-003)." },
        1: { fecha: "10-abr", responsable: "Reclutamiento", notas: "Job posting en LinkedIn, Indeed + referidos. 87 aplicaciones recibidas." },
        2: { fecha: "16-abr", responsable: "Reclutamiento", notas: "12 CVs preseleccionados de los 87 aplicantes." },
        3: { fecha: "20-abr", responsable: "P. Castaño (Gte. RH)", notas: "Pasa filtro RH con score 8.7/10." },
        4: { fecha: "24-abr", responsable: "Proveedor externo", notas: "Psicométrica DISC + prueba de venta consultiva: aprobada." },
        5: { fecha: "06-may", responsable: "G. Pérez", notas: "Entrevista comercial: G. Pérez confirma fit, sugiere arrancar pronto." },
        6: { fecha: "28-may (programado)", responsable: "F. Domínguez (Dir. Comercial Norte)", notas: "Entrevista final agendada — sesión de 60 min." },
      },
    },
    {
      id: "CAND-1058", nombre: "Javier Torres", email: "j.torres@correo.mx",
      puesto: "Asesor Comercial Sr.", area: "Comercial", requisicion: "REQ-101",
      solicitanteNombre: "Guillermo Pérez", solicitantePuesto: "Gerente Comercial Centro",
      jefeDirecto: "Guillermo Pérez", fechaSolicitudVacante: "08-abr-2026",
      fechaIngresoEsperada: "01-jun-2026", diasEnProceso: 38, score: 7.2,
      canalReclutamiento: "LinkedIn (ad pagado)",
      sueldoOfertado: 0, sueldoPresupuesto: 30000, bonoFirma: 0, bonoTrimestral: 0,
      prestaciones: "Por definir si avanza",
      etapaActualIdx: 4,
      notasGenerales: "Backup de A. Ramírez para la misma vacante. Sólido pero menor fit con el rol senior.",
      historial: {
        0: { fecha: "08-abr", responsable: "G. Pérez · Comité Plantilla", notas: "REQ-101 autorizada (compartida con Ramírez)." },
        1: { fecha: "10-abr", responsable: "Reclutamiento", notas: "Contactado vía LinkedIn ads." },
        2: { fecha: "18-abr", responsable: "Reclutamiento", notas: "CV pasa filtro con calificación de 7.5." },
        3: { fecha: "25-abr", responsable: "P. Castaño", notas: "Entrevista RH: score 7.2/10, fortaleza en negociación." },
        4: { fecha: "29-may (programado)", responsable: "Proveedor externo", notas: "Psicométrica + prueba comercial agendada." },
      },
    },
    {
      id: "CAND-1063", nombre: "Mauricio Gómez", email: "m.gomez@correo.mx",
      puesto: "Mecánico A", area: "Posventa", requisicion: "REQ-102",
      solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      jefeDirecto: "Teresa Aguilar (Sup. Posventa Turno A)", fechaSolicitudVacante: "02-abr-2026",
      fechaIngresoEsperada: "10-jun-2026", diasEnProceso: 50, score: 7.8,
      canalReclutamiento: "Bolsa de trabajo CONALEP",
      sueldoOfertado: 0, sueldoPresupuesto: 18000, bonoFirma: 0, bonoTrimestral: 0,
      prestaciones: "Por definir si avanza",
      etapaActualIdx: 4,
      notasGenerales: "Cubre vacante crítica del taller Norte. Buen perfil técnico, certificación CONALEP nivel 4.",
      historial: {
        0: { fecha: "02-abr", responsable: "L. Cano · Comité Plantilla", notas: "REQ-102 autorizada por salida de D. Vázquez (B-011)." },
        1: { fecha: "05-abr", responsable: "Reclutamiento", notas: "Convocatoria abierta en bolsa CONALEP + referidos del taller." },
        2: { fecha: "14-abr", responsable: "Reclutamiento", notas: "8 CVs pre-filtrados con experiencia en motor diésel." },
        3: { fecha: "22-abr", responsable: "P. Castaño", notas: "Entrevista RH: pasa con 7.8. Honesto sobre periodo de prueba previo." },
        4: { fecha: "23-may (programado)", responsable: "Taller Norte", notas: "Prueba técnica práctica de 4 hrs en taller con T. Aguilar." },
      },
    },
    {
      id: "CAND-1071", nombre: "Sofía Vega", email: "s.vega@correo.mx",
      puesto: "Contador General", area: "Administración", requisicion: "REQ-103",
      solicitanteNombre: "Rodrigo Solís", solicitantePuesto: "Gerente de Finanzas",
      jefeDirecto: "Rodrigo Solís", fechaSolicitudVacante: "25-mar-2026",
      fechaIngresoEsperada: "15-jun-2026", diasEnProceso: 58, score: 9.1,
      canalReclutamiento: "Headhunter especializado (Finanzas)",
      sueldoOfertado: 42000, sueldoPresupuesto: 38000, bonoFirma: 0, bonoTrimestral: 12000,
      prestaciones: "Ley + GMM + Vales $2,500 + Auto utilitario",
      etapaActualIdx: 7, // En "Oferta económica"
      notasGenerales: "Candidata excepcional, viene de Big-Four. Pide $42K vs presupuesto $38K — requiere aprobación de S. Ramírez (Dir. Administrativo).",
      historial: {
        0: { fecha: "25-mar", responsable: "R. Solís · Comité Plantilla", notas: "REQ-103 autorizada (vacante por reubicación familiar de P. Lozano B-004)." },
        1: { fecha: "28-mar", responsable: "Reclutamiento + Headhunter", notas: "Contrato con headhunter especializado · fee 15% sueldo anual." },
        2: { fecha: "06-abr", responsable: "Reclutamiento", notas: "5 finalistas del headhunter, todos con CPC y experiencia Big-Four." },
        3: { fecha: "13-abr", responsable: "P. Castaño", notas: "Entrevista RH: score 9.1 (mejor del año en su rol). Excelente comunicación." },
        4: { fecha: "20-abr", responsable: "Proveedor externo", notas: "Pruebas técnicas NIIF + Excel avanzado: aprobada con score 95%." },
        5: { fecha: "30-abr", responsable: "R. Solís", notas: "Entrevista técnica con R. Solís: 'la quiero contratar ya'." },
        6: { fecha: "12-may", responsable: "S. Ramírez (Dir. Administrativo)", notas: "Entrevista final: aprobado el perfil. Pide validar tope salarial." },
        7: { fecha: "22-may (en curso)", responsable: "Comp&Ben + R. Solís", notas: "Oferta enviada $42K — pendiente aprobación por estar +10.5% del presupuesto." },
      },
    },
    {
      id: "CAND-0987", nombre: "Pedro Núñez", email: "p.nunez@correo.mx",
      puesto: "Gerente de Operaciones (Planta 1)", area: "Operaciones", requisicion: "REQ-104",
      solicitanteNombre: "Carlos Mendoza", solicitantePuesto: "Director de Operaciones",
      jefeDirecto: "Carlos Mendoza", fechaSolicitudVacante: "10-feb-2026",
      fechaIngresoEsperada: "01-abr-2026", diasEnProceso: 102, score: 8.9,
      canalReclutamiento: "Headhunter ejecutivo",
      sueldoOfertado: 55000, sueldoPresupuesto: 58000, bonoFirma: 30000, bonoTrimestral: 18000,
      prestaciones: "Ley + GMM Plus + Auto + Vales $3,000 + Bono anual 2 meses",
      etapaActualIdx: 10, // En Onboarding (todas previas completadas)
      notasGenerales: "Contratación cerrada. Día 60 del onboarding. Buena adaptación, ya tomó 2 decisiones operativas en línea con la estrategia.",
      historial: {
        0: { fecha: "10-feb", responsable: "C. Mendoza", notas: "REQ-104 autorizada por jubilación del anterior gerente." },
        1: { fecha: "12-feb", responsable: "Headhunter ejecutivo", notas: "Búsqueda confidencial en empresas del sector." },
        2: { fecha: "25-feb", responsable: "Reclutamiento", notas: "3 finalistas con experiencia en industria automotriz." },
        3: { fecha: "04-mar", responsable: "P. Castaño", notas: "Entrevista RH: 8.9. Excelente trayectoria, busca estabilidad de largo plazo." },
        4: { fecha: "10-mar", responsable: "Proveedor externo", notas: "Assessment Center de 1 día completo: 'recomendado fuertemente'." },
        5: { fecha: "16-mar", responsable: "C. Mendoza", notas: "Entrevista técnica/operativa: excelente." },
        6: { fecha: "20-mar", responsable: "Dirección General", notas: "Entrevista final: aprobado por unanimidad." },
        7: { fecha: "23-mar", responsable: "Comp&Ben", notas: "Oferta $55K (5% bajo presupuesto) + bono firma $30K aceptada." },
        8: { fecha: "26-mar", responsable: "Reclutamiento", notas: "3 referencias verificadas: todas positivas." },
        9: { fecha: "01-abr", responsable: "RH", notas: "Contratación formalizada. Firma de contrato y NDA." },
        10: { fecha: "01-abr → en curso", responsable: "C. Mendoza (sponsor)", notas: "Onboarding 30-60-90+ activo. Check-in Día 60 completado el 31-may con score 4.5/5." },
      },
    },
    {
      id: "CAND-1085", nombre: "Karen Robles", email: "k.robles@correo.mx",
      puesto: "Asistente de RH Sr.", area: "Administración", requisicion: "REQ-105",
      solicitanteNombre: "Paola Castaño", solicitantePuesto: "Gerente de Recursos Humanos",
      jefeDirecto: "Paola Castaño", fechaSolicitudVacante: "14-mar-2026",
      fechaIngresoEsperada: "15-jun-2026", diasEnProceso: 69, score: 0,
      canalReclutamiento: "Referido interno + LinkedIn",
      sueldoOfertado: 0, sueldoPresupuesto: 22000, bonoFirma: 0, bonoTrimestral: 0,
      prestaciones: "Por definir si avanza",
      etapaActualIdx: 2,
      notasGenerales: "Reemplazo de Beatriz Cordero (B-014). Vacante crítica — procesos de RH operando con redundancia temporal de B. Lozano (ingreso reciente).",
      historial: {
        0: { fecha: "14-mar", responsable: "P. Castaño + S. Ramírez", notas: "REQ-105 autorizada el mismo día que se confirmó la baja de B. Cordero." },
        1: { fecha: "17-mar", responsable: "Reclutamiento", notas: "Búsqueda activa · 4 referidos internos + LinkedIn ads." },
        2: { fecha: "22-may (en curso)", responsable: "Reclutamiento", notas: "9 CVs en revisión · primer filtro previsto 28-may." },
      },
    },
    {
      id: "CAND-1090", nombre: "Ramón Cabral", email: "r.cabral@correo.mx",
      puesto: "Supervisor Posventa Turno B", area: "Posventa", requisicion: "REQ-106",
      solicitanteNombre: "Lorenzo Cano", solicitantePuesto: "Gerente de Posventa",
      jefeDirecto: "Lorenzo Cano", fechaSolicitudVacante: "20-abr-2026",
      fechaIngresoEsperada: "01-jul-2026", diasEnProceso: 32, score: 7.4,
      canalReclutamiento: "Bolsa de trabajo + referidos",
      sueldoOfertado: 0, sueldoPresupuesto: 28000, bonoFirma: 0, bonoTrimestral: 0,
      prestaciones: "Por definir si avanza",
      etapaActualIdx: 3,
      notasGenerales: "Vacante crítica por la rotación documentada del taller. Solicitud incluye condición especial: que NO sea reportar a L. Cano directamente (escalación pendiente).",
      historial: {
        0: { fecha: "20-abr", responsable: "L. Cano + C. Mendoza", notas: "REQ-106 autorizada con observación: requiere aprobación Dir. Operaciones tras intervención de clima." },
        1: { fecha: "25-abr", responsable: "Reclutamiento", notas: "Convocatoria abierta · 22 aplicaciones." },
        2: { fecha: "08-may", responsable: "Reclutamiento", notas: "6 CVs preseleccionados." },
        3: { fecha: "26-may (en curso)", responsable: "P. Castaño", notas: "Entrevista RH agendada para próxima semana." },
      },
    },
  ];

  // Construye el checklist para cada candidato
  const candidatosConChecklist = candidatos.map((c) => ({
    ...c,
    checklist: mkChecklist(c.etapaActualIdx + 1, c.historial),
    pctAvance: Math.round(((c.etapaActualIdx + 1) / etapas.length) * 100),
  }));

  // Colores del branding (de las gráficas de Cobertura/Variaciones)
  const colorNaranja = "linear-gradient(90deg, #ea580c 0%, #c2410c 100%)";
  const colorGris = "linear-gradient(90deg, #64748b 0%, #475569 100%)";
  const colorVerde = "linear-gradient(90deg, #71b248 0%, #5a9438 100%)";
  const gradPorAvance = (pct) => pct >= 100 ? colorVerde : pct >= 60 ? colorNaranja : colorGris;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={S.h2}>Proceso de Selección</h2>
        </div>
        <button
          onClick={onAbrirGuia}
          style={{
            ...S.btn,
            background: "linear-gradient(135deg, #71b248 0%, #5a9438 100%)",
            border: "none",
            color: "#fff",
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
          }}
        >
          Guía de entrevista →
        </button>
      </div>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Candidatos activos</div>
            <div style={S.kpiValue}>28</div>
            <div style={S.kpiBenchmark("green")}>Pool saludable: ≥20</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Tiempo medio de cobertura</div>
            <div style={S.kpiValue}>38 días</div>
            <div style={S.kpiBenchmark("yellow")}>SLA: ≤30 días</div>
          </div>
          <TrafficLight light="yellow" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Tasa de oferta aceptada</div>
            <div style={S.kpiValue}>78%</div>
            <div style={S.kpiBenchmark("green")}>Meta: ≥70% · Excelente: ≥85%</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Onboardings activos</div>
            <div style={S.kpiValue}>4</div>
            <div style={S.kpiBenchmark("green")}>Capacidad mensual: 6</div>
          </div>
          <TrafficLight light="green" />
        </div>
      </div>

      <h3 style={S.h3}>Candidatos en pipeline</h3>
      <p style={{ ...S.hint, marginTop: -4 }}>Cada candidato lleva su propio checklist de las 11 etapas. Click para ver el expediente completo de contratación.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Candidato</th>
            <th style={S.th}>Puesto / REQ</th>
            <th style={S.th}>Solicitante</th>
            <th style={S.th}>Etapa actual</th>
            <th style={S.th} colSpan={2}>% Avance (11 etapas)</th>
            <th style={S.th}>Score</th>
            <th style={S.th}>Días</th>
            <th style={S.th}></th>
          </tr>
        </thead>
        <tbody>
          {candidatosConChecklist.map((c) => (
            <tr
              key={c.id}
              onClick={() => setCandidatoAbierto(c)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={S.td}>
                <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace" }}>{c.id}</div>
              </td>
              <td style={S.td}>
                <div>{c.puesto}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{c.requisicion} · {c.area}</div>
              </td>
              <td style={S.td}>
                <div style={{ fontWeight: 600 }}>{c.solicitanteNombre}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{c.solicitantePuesto}</div>
              </td>
              <td style={S.td}>
                <div style={{ fontWeight: 600 }}>{c.etapaActualIdx + 1}. {etapas[c.etapaActualIdx].split(" (")[0]}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{c.historial[c.etapaActualIdx]?.fecha || ""}</div>
              </td>
              <td style={{ ...S.td, width: 220, paddingRight: 4 }}>
                <div style={{ position: "relative", height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${c.pctAvance}%`, background: gradPorAvance(c.pctAvance), borderRadius: 5 }} />
                </div>
              </td>
              <td style={{ ...S.td, width: 50, fontWeight: 700, paddingLeft: 4 }}>{c.pctAvance}%</td>
              <td style={S.td}>{c.score > 0 ? c.score.toFixed(1) : "—"}</td>
              <td style={S.td}>{c.diasEnProceso}</td>
              <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 12 }}>Ver expediente →</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de candidato — checklist + detalle de contratación */}
      {candidatoAbierto && (() => {
        const c = candidatoAbierto;
        const sueldoVsPresupuesto = c.sueldoOfertado > 0
          ? ((c.sueldoOfertado - c.sueldoPresupuesto) / c.sueldoPresupuesto) * 100
          : null;
        const sueldoColor = sueldoVsPresupuesto === null ? "#64748b" : sueldoVsPresupuesto > 5 ? "#b00020" : sueldoVsPresupuesto < -5 ? "#0a7d2c" : "#d97706";
        const sueldoLight = sueldoVsPresupuesto === null ? "yellow" : sueldoVsPresupuesto > 5 ? "red" : sueldoVsPresupuesto < -5 ? "green" : "yellow";
        return (
          <div
            onClick={() => setCandidatoAbierto(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, padding: 24, width: 1080, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid #ccc" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{c.nombre}</h3>
                    <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{c.id}</span>
                    {c.pctAvance >= 100
                      ? <span style={S.badge("#dcfce7")}>Onboarding</span>
                      : c.pctAvance >= 60
                      ? <span style={S.badge("#ffedd5")}>Etapa final</span>
                      : <span style={S.badge("#f1f5f9")}>En proceso</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {c.puesto} · {c.area} · {c.requisicion} · Email: {c.email}
                  </div>
                </div>
                <button onClick={() => setCandidatoAbierto(null)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
              </div>

              {/* KPIs principales */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>% Avance</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{c.pctAvance}%</div>
                  <div style={{ position: "relative", height: 6, background: "#f1f5f9", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${c.pctAvance}%`, background: gradPorAvance(c.pctAvance), borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Etapa actual</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{c.etapaActualIdx + 1}. {etapas[c.etapaActualIdx].split(" (")[0]}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{c.historial[c.etapaActualIdx]?.fecha || "—"}</div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Días en proceso</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: c.diasEnProceso > 60 ? "#b00020" : c.diasEnProceso > 30 ? "#d97706" : "#0a7d2c" }}>{c.diasEnProceso}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>SLA interno: ≤30 días</div>
                </div>
                <div style={{ ...S.kpi, padding: 12 }}>
                  <div style={S.kpiLabel}>Score RH</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{c.score > 0 ? `${c.score.toFixed(1)} / 10` : "—"}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{c.score === 0 ? "Aún sin evaluación RH" : c.score >= 8 ? "Excelente" : c.score >= 7 ? "Aceptable" : "Bajo umbral"}</div>
                </div>
              </div>

              {/* Datos del puesto y económicos en 2 columnas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ ...S.card, marginBottom: 0 }}>
                  <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Datos de la requisición</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div><strong>Requisición:</strong> {c.requisicion}</div>
                    <div><strong>Puesto:</strong> {c.puesto}</div>
                    <div><strong>Área:</strong> {c.area}</div>
                    <div><strong>Solicitante:</strong> {c.solicitanteNombre} · {c.solicitantePuesto}</div>
                    <div><strong>Jefe directo (futuro):</strong> {c.jefeDirecto}</div>
                    <div><strong>Fecha solicitud:</strong> {c.fechaSolicitudVacante}</div>
                    <div><strong>Fecha ingreso esperada:</strong> {c.fechaIngresoEsperada}</div>
                    <div><strong>Canal de reclutamiento:</strong> {c.canalReclutamiento}</div>
                  </div>
                </div>
                <div style={{ ...S.card, marginBottom: 0 }}>
                  <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Económico</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Presupuesto</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>${c.sueldoPresupuesto.toLocaleString("es-MX")}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>autorizado en REQ</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Ofrecido</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: sueldoColor }}>
                        {c.sueldoOfertado > 0 ? `$${c.sueldoOfertado.toLocaleString("es-MX")}` : "Pendiente"}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: sueldoColor }}>
                        {sueldoVsPresupuesto !== null
                          ? `${sueldoVsPresupuesto >= 0 ? "+" : ""}${sueldoVsPresupuesto.toFixed(1)}% vs presupuesto`
                          : "Sin oferta aún"}
                      </div>
                    </div>
                  </div>
                  <div style={S.kpiBenchmark(sueldoLight)}>
                    {sueldoVsPresupuesto === null ? "Esperando oferta" : sueldoVsPresupuesto > 5 ? "Requiere aprobación por arriba de presupuesto" : sueldoVsPresupuesto < -5 ? "Bajo presupuesto · OK" : "Dentro de banda autorizada"}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
                    <div><strong>Bono de firma:</strong> {c.bonoFirma > 0 ? `$${c.bonoFirma.toLocaleString("es-MX")}` : "—"}</div>
                    <div><strong>Bono trimestral target:</strong> {c.bonoTrimestral > 0 ? `$${c.bonoTrimestral.toLocaleString("es-MX")}` : "—"}</div>
                    <div><strong>Prestaciones:</strong> {c.prestaciones}</div>
                  </div>
                </div>
              </div>

              {/* Notas generales */}
              <div style={{ ...S.kpiLabel, marginBottom: 6 }}>Notas del expediente</div>
              <div style={{ fontSize: 13, padding: "10px 12px", background: "#fff7e0", borderLeft: "3px solid #d97706", borderRadius: 4, marginBottom: 16, lineHeight: 1.5 }}>
                {c.notasGenerales}
              </div>

              {/* Checklist de las 11 etapas */}
              <div style={{ ...S.kpiLabel, marginBottom: 8 }}>Checklist · Etapas del proceso (11)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {c.checklist.map((step) => {
                  const isDone = step.completado;
                  const isCurrent = step.enCurso;
                  return (
                    <div key={step.idx} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 12px",
                      background: isDone ? "#f6fbf6" : isCurrent ? "#fff7ed" : "#fafafa",
                      border: `1px solid ${isDone ? "#86efac" : isCurrent ? "#fed7aa" : "#e5e5e5"}`,
                      borderRadius: 4,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: isDone ? "#0a7d2c" : isCurrent ? "#c2410c" : "#cbd5e1",
                        color: "#fff",
                        fontSize: 12, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {isDone ? "✓" : step.idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{step.label}</span>
                          {isCurrent && <span style={{ fontSize: 10, color: "#c2410c", fontWeight: 700, padding: "1px 6px", background: "#ffedd5", borderRadius: 10 }}>EN CURSO</span>}
                          {step.fecha && <span style={{ fontSize: 11, color: "#666" }}>· {step.fecha}</span>}
                          {step.responsable && <span style={{ fontSize: 11, color: "#666" }}>· {step.responsable}</span>}
                        </div>
                        {step.notas && <div style={{ fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 1.4 }}>{step.notas}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 16, marginTop: 16, borderTop: "1px solid #eee" }}>
                <button style={S.btn} onClick={() => setCandidatoAbierto(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      <h3 style={S.h3}>Herramientas integradas</h3>
      <div style={S.grid3}>
        {[
          "Descripción de puesto",
          "Guía de preguntas de entrevista",
          "Base de datos de candidatos",
          "Análisis de compensación",
          "Checklist de nuevo empleado",
          "Roadmap onboarding 30-60-90+",
          "Matriz de habilidades",
          "Plan de desarrollo de carrera",
          "Análisis de necesidades de capacitación",
        ].map((h) => (
          <div key={h} style={S.card}>
            <strong style={{ fontSize: 13 }}>{h}</strong>
            <div style={{ marginTop: 8 }}>
              <button style={S.btnGhost}>Abrir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================
// =============================================================
// CATÁLOGOS MAESTROS — benchmarks que alimentan todos los KPIs
// Cada regla se descompone en partes: texto fijo + números editables
// =============================================================
const t = (valor) => ({ tipo: "texto", valor });
const n = (valor) => ({ tipo: "numero", valor });

const BENCHMARKS_INICIALES = [
  // Dashboard general
  { id: "dash-1", modulo: "Dashboard General", kpi: "Costo total nómina (mes)", partes: [t("Aceptable: ≤+"), n(2), t("% mensual")], tipo: "% Variación", aplicaA: ["dashboard"] },
  { id: "dash-2", modulo: "Dashboard General", kpi: "% variable / nómina", partes: [t("Política interna: "), n(18), t("%")], tipo: "% Límite", aplicaA: ["dashboard", "nomina"] },
  { id: "dash-3", modulo: "Dashboard General", kpi: "Rotación anual", partes: [t("Industria "), n(15), t("-"), n(18), t("% · Meta: ≤"), n(18), t("%")], tipo: "Rango", aplicaA: ["dashboard", "rotacion"] },
  { id: "dash-4", modulo: "Dashboard General", kpi: "Clima (último pulso)", partes: [t("Meta: ≥"), n(7.0), t(" · Excelente: ≥"), n(7.5)], tipo: "Score 1-10", aplicaA: ["dashboard", "clima"] },
  { id: "dash-5", modulo: "Dashboard General", kpi: "Cobertura plantilla", partes: [t("Meta: ≥"), n(95), t("%")], tipo: "%", aplicaA: ["dashboard", "cobertura"] },
  { id: "dash-6", modulo: "Dashboard General", kpi: "Denuncias activas", partes: [t("Meta: "), n(0), t(" sin Hoja de Ruta")], tipo: "Conteo", aplicaA: ["dashboard", "denuncia"] },
  { id: "dash-7", modulo: "Dashboard General", kpi: "Capacitación: ROI promedio", partes: [t("Meta: ≥"), n(1.5), t("x")], tipo: "Múltiplo ROI", aplicaA: ["dashboard", "capacitacion"] },
  { id: "dash-8", modulo: "Dashboard General", kpi: "Tiempo medio de cobertura", partes: [t("SLA: ≤"), n(30), t(" días")], tipo: "Días", aplicaA: ["dashboard", "seleccion"] },
  // 1. Variaciones de Nómina
  { id: "nom-1", modulo: "1. Variaciones de Nómina", kpi: "Nómina base total", partes: [t("Estable vs media móvil (±"), n(2), t("%)")], tipo: "% Variación", aplicaA: ["nomina"] },
  { id: "nom-2", modulo: "1. Variaciones de Nómina", kpi: "Compensación variable", partes: [t("Variación esperada ≤±"), n(3), t("% vs MA")], tipo: "% Variación", aplicaA: ["nomina"] },
  { id: "nom-3", modulo: "1. Variaciones de Nómina", kpi: "Total nómina", partes: [t("Aceptable: ≤+"), n(2), t("% vs MA")], tipo: "% Variación", aplicaA: ["nomina"] },
  // 2. Clima Laboral
  { id: "cli-1", modulo: "2. Clima Laboral", kpi: "Pulso semanal", partes: [t("Meta: ≥"), n(7.0), t(" · Excelente: ≥"), n(7.5)], tipo: "Score 1-10", aplicaA: ["clima"] },
  { id: "cli-2", modulo: "2. Clima Laboral", kpi: "eNPS", partes: [t("Saludable: ≥+"), n(20), t(" · Líder: ≥+"), n(30)], tipo: "Score eNPS", aplicaA: ["clima"] },
  { id: "cli-3", modulo: "2. Clima Laboral", kpi: "Tasa de respuesta", partes: [t("Meta: ≥"), n(75), t("% · Mínimo válido: ≥"), n(60), t("%")], tipo: "%", aplicaA: ["clima"] },
  // 3. Línea de Denuncia
  { id: "den-1", modulo: "3. Línea de Denuncia", kpi: "Activas", partes: [t("Histórico mensual: "), n(3), t("-"), n(6)], tipo: "Rango", aplicaA: ["denuncia"] },
  { id: "den-2", modulo: "3. Línea de Denuncia", kpi: "Sin Hoja de Ruta", partes: [t("Meta: "), n(0), t(" (toda activa con plan)")], tipo: "Conteo", aplicaA: ["denuncia"] },
  { id: "den-3", modulo: "3. Línea de Denuncia", kpi: "Resueltas (mes)", partes: [t("Meta: ≥"), n(3), t(" / mes")], tipo: "Conteo", aplicaA: ["denuncia"] },
  { id: "den-4", modulo: "3. Línea de Denuncia", kpi: "Tiempo medio resolución", partes: [t("SLA interno: ≤"), n(15), t(" días")], tipo: "Días", aplicaA: ["denuncia"] },
  // 4. Cobertura
  { id: "cob-1", modulo: "4. Cobertura de Plantilla", kpi: "Plantilla autorizada", partes: [t("Plan anual 2026: "), n(248)], tipo: "Conteo", aplicaA: ["cobertura"] },
  { id: "cob-2", modulo: "4. Cobertura de Plantilla", kpi: "Cubierta", partes: [t("Objetivo: "), n(248), t(" (autorizado)")], tipo: "Conteo", aplicaA: ["cobertura"] },
  { id: "cob-3", modulo: "4. Cobertura de Plantilla", kpi: "% cobertura", partes: [t("Meta: ≥"), n(95), t("% · Crítico: <"), n(90), t("%")], tipo: "%", aplicaA: ["cobertura"] },
  { id: "cob-4", modulo: "4. Cobertura de Plantilla", kpi: "Vacantes >60 días", partes: [t("Meta: "), n(0), t(" · Alerta: ≥"), n(1)], tipo: "Conteo", aplicaA: ["cobertura"] },
  // 5. Selección
  { id: "sel-1", modulo: "5. Proceso de Selección", kpi: "Candidatos activos", partes: [t("Pool saludable: ≥"), n(20)], tipo: "Conteo", aplicaA: ["seleccion"] },
  { id: "sel-2", modulo: "5. Proceso de Selección", kpi: "Tiempo medio cobertura", partes: [t("SLA: ≤"), n(30), t(" días")], tipo: "Días", aplicaA: ["seleccion"] },
  { id: "sel-3", modulo: "5. Proceso de Selección", kpi: "Tasa de oferta aceptada", partes: [t("Meta: ≥"), n(70), t("% · Excelente: ≥"), n(85), t("%")], tipo: "%", aplicaA: ["seleccion"] },
  { id: "sel-4", modulo: "5. Proceso de Selección", kpi: "Onboardings activos", partes: [t("Capacidad mensual: "), n(6)], tipo: "Conteo", aplicaA: ["seleccion"] },
  // 6. Rotación
  { id: "rot-1", modulo: "6. Rotación", kpi: "Bajas YTD", partes: [t("Meta anual: ≤"), n(30), t(" bajas")], tipo: "Conteo", aplicaA: ["rotacion"] },
  { id: "rot-2", modulo: "6. Rotación", kpi: "% rotación anualizada", partes: [t("Industria "), n(15), t("-"), n(18), t("% · Meta: ≤"), n(18), t("%")], tipo: "%", aplicaA: ["rotacion"] },
  { id: "rot-3", modulo: "6. Rotación", kpi: "Costo unitario promedio", partes: [t("Histórico promedio: $"), n(38000)], tipo: "$", aplicaA: ["rotacion"] },
  { id: "rot-4", modulo: "6. Rotación", kpi: "Costo total estimado", partes: [t("Presupuesto anual: $"), n(1.0), t("M")], tipo: "$", aplicaA: ["rotacion"] },
  // 7. Capacitación
  { id: "cap-1", modulo: "7. Capacitación", kpi: "Cursos activos", partes: [t("Capacidad simultánea: "), n(2), t("-"), n(3)], tipo: "Conteo", aplicaA: ["capacitacion"] },
  { id: "cap-2", modulo: "7. Capacitación", kpi: "Programados", partes: [t("Pipeline saludable: ≥"), n(3)], tipo: "Conteo", aplicaA: ["capacitacion"] },
  { id: "cap-3", modulo: "7. Capacitación", kpi: "Inversión YTD", partes: [t("Presupuesto anual: $"), n(360), t("K")], tipo: "$", aplicaA: ["capacitacion"] },
  { id: "cap-4", modulo: "7. Capacitación", kpi: "ROI promedio", partes: [t("Meta: ≥"), n(1.5), t("x")], tipo: "Múltiplo ROI", aplicaA: ["capacitacion"] },
];

// Helper: convierte partes a string para mostrar/exportar
const partesAString = (partes) => partes.map((p) => p.tipo === "numero" ? (Number.isInteger(p.valor) ? p.valor.toLocaleString("es-MX") : p.valor) : p.valor).join("");

// Helper: icono candado SVG (no emoji)
const IconLock = ({ size = 11, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// =============================================================
// 8. DESEMPEÑO — Modelo de 9 Box (Potencial × Desempeño)
// =============================================================
// Casillas ordenadas por posición visual: índice 0..8, de arriba-izquierda
// (potencial alto / desempeño bajo) a abajo-derecha (potencial bajo / desempeño alto).
// Paleta homologada al branding cálido (naranjas / terracotas) con capas de
// transparencia y textura mediante gradientes radiales.
const hexA = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const cellBg = (accent) =>
  `radial-gradient(circle at 100% 0%, ${hexA(accent, 0.16)} 0%, transparent 58%), ` +
  `radial-gradient(circle at 0% 100%, ${hexA(accent, 0.08)} 0%, transparent 52%), ` +
  `linear-gradient(180deg, ${hexA(accent, 0.06)} 0%, ${hexA(accent, 0.02)} 100%), #ffffff`;

const NINE_BOX = [
  // Fila superior — POTENCIAL ALTO
  { id: 0, titulo: "Diamante en bruto", eje: "Pot. alto · Desemp. bajo", accent: "#5d6678",
    resumen: "Diagnosticar barreras y acelerar su desarrollo.",
    plan: {
      d30: ["1:1 de diagnóstico: detectar barreras (claridad de rol, recursos, motivación).", "Definir 3 objetivos medibles a 90 días.", "Asignar mentor interno."],
      d60: ["Capacitación dirigida a las brechas técnicas detectadas.", "Eliminar obstáculos operativos identificados.", "Revisión quincenal de avances con su jefe."],
      d90: ["Asignar un proyecto de visibilidad media.", "Medir el salto de desempeño vs. objetivos.", "Decidir: acelerar promoción o reforzar plan."],
    } },
  { id: 1, titulo: "Futuro líder", eje: "Pot. alto · Desemp. medio", accent: "#2e4773",
    resumen: "Estirar con retos, mentoría y proyectos visibles.",
    plan: {
      d30: ["Conversación de carrera: aspiración y rol objetivo.", "Inscribir en programa de liderazgo.", "Feedback 360° inicial."],
      d60: ["Asignar proyecto cross-funcional como líder.", "Job shadowing con un directivo.", "Revisión de competencias de liderazgo."],
      d90: ["Ampliar alcance / span de control.", "Medir resultados del proyecto liderado.", "Incluir formalmente en pipeline de sucesión."],
    } },
  { id: 2, titulo: "Estrella", eje: "Pot. alto · Desemp. alto", accent: "#233a63",
    resumen: "Retener, plan de sucesión y promoción.",
    plan: {
      d30: ["Reconocimiento formal del desempeño.", "Conversación de retención (compensación y carrera).", "Identificar posición clave de sucesión."],
      d60: ["Liderar una iniciativa estratégica.", "Exposición al comité directivo.", "Mentoría inversa hacia el equipo."],
      d90: ["Plan de promoción / ascenso definido.", "Esquema de retención (bono / equity / desarrollo).", "Formalizar como sucesor de una posición crítica."],
    } },
  // Fila media — POTENCIAL MEDIO
  { id: 3, titulo: "Enigma", eje: "Pot. medio · Desemp. bajo", accent: "#9c5152",
    resumen: "Conversación clara y objetivos a 90 días.",
    plan: {
      d30: ["Conversación franca de expectativas.", "Definir objetivos explícitos a 90 días.", "Identificar causa raíz: ajuste de puesto vs. motivación."],
      d60: ["Acompañamiento cercano y quick wins.", "Revisión semanal de avances.", "Ajustar funciones si hay desajuste de rol."],
      d90: ["Evaluar la mejora real.", "Decidir: consolidar, reubicar o plan de mejora formal.", "Documentar acuerdos."],
    } },
  { id: 4, titulo: "Pilar / Core", eje: "Pot. medio · Desemp. medio", accent: "#4c5c79",
    resumen: "Mantener motivado y desarrollar lateralmente.",
    plan: {
      d30: ["Reconocer su aporte estable.", "Encuesta de motivación e intereses.", "Detectar apetito de desarrollo lateral."],
      d60: ["Rotación o ampliación de funciones.", "Capacitación de actualización.", "Asignar responsabilidades de mayor alcance."],
      d90: ["Definir ruta: especialización o liderazgo.", "Plan de engagement a 12 meses.", "Reconocimiento por consistencia."],
    } },
  { id: 5, titulo: "Alto desempeño", eje: "Pot. medio · Desemp. alto", accent: "#36507a",
    resumen: "Reconocer y ampliar el alcance del rol.",
    plan: {
      d30: ["Reconocer resultados sobresalientes.", "Explorar si el potencial está subestimado.", "Plantear nuevos retos."],
      d60: ["Ampliar alcance del rol o complejidad.", "Asignar proyecto de mayor exigencia.", "Mentor para desarrollar potencial latente."],
      d90: ["Reevaluar potencial.", "Si crece → mover a Futuro líder.", "Si se mantiene → consolidar como experto clave."],
    } },
  // Fila inferior — POTENCIAL BAJO
  { id: 6, titulo: "Bajo rendimiento", eje: "Pot. bajo · Desemp. bajo", accent: "#983838",
    resumen: "Plan de mejora (PIP) y decisión a corto plazo.",
    plan: {
      d30: ["Plan de mejora formal (PIP) con metas y fechas.", "Documentar acuerdos por escrito.", "1:1 semanal de seguimiento."],
      d60: ["Soporte y capacitación puntual.", "Medir avance objetivo vs. metas del PIP.", "Alertar a RH si no hay progreso."],
      d90: ["Decisión final: reintegrar si mejora.", "Gestionar salida ordenada si no cumple.", "Cerrar expediente con RH."],
    } },
  { id: 7, titulo: "Confiable", eje: "Pot. bajo · Desemp. medio", accent: "#6f6b73",
    resumen: "Mantener en el rol con objetivos claros.",
    plan: {
      d30: ["Reconocer su consistencia y valor.", "Clarificar que su rol es apreciado.", "Definir objetivos de mantenimiento."],
      d60: ["Capacitación para sostener el desempeño.", "Detectar riesgo de estancamiento o desmotivación.", "Pequeños retos de rotación."],
      d90: ["Plan de retención ligero.", "Reconocimiento por estabilidad / antigüedad.", "Revisar bienestar y carga de trabajo."],
    } },
  { id: 8, titulo: "Especialista", eje: "Pot. bajo · Desemp. alto", accent: "#415a80",
    resumen: "Retener como experto y transferir conocimiento.",
    plan: {
      d30: ["Reconocer el expertise técnico.", "Conversación: ruta experto vs. gestión.", "Mapear conocimiento crítico que posee."],
      d60: ["Formalizar como referente técnico.", "Iniciar transferencia de conocimiento / documentación.", "Asignar mentoría a juniors."],
      d90: ["Plan de retención del experto.", "Incentivos por especialización.", "Plan de continuidad del conocimiento."],
    } },
];

const COLABORADORES_INICIALES = [
  { id: 1, box: 2, nombre: "Laura Cano Medina", edad: 44, correo: "laura.cano@empresa.com.mx", telefono: "55 1842 3390", departamento: "Dirección General", area: "Dirección", puesto: "Directora de Operaciones", jefe: "Consejo Directivo", aCargo: 38, antiguedad: "9 años", ultimaEval: "9.4 / 10", ubicacion: "Corporativo CDMX", notas: "Sucesora natural para Dirección General. Alto impacto en resultados 2025." },
  { id: 2, box: 5, nombre: "Carlos Mendoza Ruiz", edad: 41, correo: "carlos.mendoza@empresa.com.mx", telefono: "55 2290 7741", departamento: "Posventa", area: "Posventa", puesto: "Gerente de Posventa", jefe: "Laura Cano", aCargo: 22, antiguedad: "7 años", ultimaEval: "8.7 / 10", ubicacion: "Taller Norte", notas: "Resultados sólidos. Potencial de crecimiento por validar en proyecto cross-área." },
  { id: 3, box: 1, nombre: "Paola Castaño Vélez", edad: 35, correo: "paola.castano@empresa.com.mx", telefono: "55 3398 1120", departamento: "Recursos Humanos", area: "RH", puesto: "Coordinadora de Talento", jefe: "Laura Cano", aCargo: 4, antiguedad: "4 años", ultimaEval: "8.3 / 10", ubicacion: "Corporativo CDMX", notas: "Alto potencial de liderazgo. Candidata a programa de desarrollo gerencial." },
  { id: 4, box: 2, nombre: "Andrés Ríos Palacios", edad: 38, correo: "andres.rios@empresa.com.mx", telefono: "55 4471 5582", departamento: "Comercial", area: "Comercial", puesto: "Gerente Comercial", jefe: "Laura Cano", aCargo: 15, antiguedad: "6 años", ultimaEval: "9.1 / 10", ubicacion: "Sucursal Sur", notas: "Top performer comercial. En plan de sucesión para Dirección Comercial." },
  { id: 5, box: 4, nombre: "Mónica Quintana Ávila", edad: 33, correo: "monica.quintana@empresa.com.mx", telefono: "55 5563 2014", departamento: "Operaciones", area: "Operaciones", puesto: "Analista Senior de Operaciones", jefe: "Laura Cano", aCargo: 0, antiguedad: "3 años", ultimaEval: "7.6 / 10", ubicacion: "Planta", notas: "Desempeño estable. Explorar interés en rotación o especialización." },
  { id: 6, box: 4, nombre: "Sergio Beltrán Nava", edad: 29, correo: "sergio.beltran@empresa.com.mx", telefono: "55 6694 8830", departamento: "Comercial", area: "Comercial", puesto: "Ejecutivo de Cuenta", jefe: "Andrés Ríos", aCargo: 0, antiguedad: "2 años", ultimaEval: "7.4 / 10", ubicacion: "Sucursal Sur", notas: "Consistente. Buen candidato para desarrollo lateral." },
  { id: 7, box: 4, nombre: "Jorge Fuentes Coronado", edad: 47, correo: "jorge.fuentes@empresa.com.mx", telefono: "55 7712 4408", departamento: "Administración", area: "Administración", puesto: "Jefe de Administración", jefe: "Laura Cano", aCargo: 6, antiguedad: "11 años", ultimaEval: "7.8 / 10", ubicacion: "Corporativo CDMX", notas: "Pilar del equipo administrativo. Estable y confiable." },
  { id: 8, box: 8, nombre: "Tania Aguilar Mora", edad: 39, correo: "tania.aguilar@empresa.com.mx", telefono: "55 8830 9921", departamento: "Posventa", area: "Posventa", puesto: "Supervisora Técnica", jefe: "Carlos Mendoza", aCargo: 9, antiguedad: "8 años", ultimaEval: "8.9 / 10", ubicacion: "Taller Sur", notas: "Experta técnica de referencia. Clave en transferencia de conocimiento." },
  { id: 9, box: 7, nombre: "Ricardo Vega Lozano", edad: 52, correo: "ricardo.vega@empresa.com.mx", telefono: "55 9948 1167", departamento: "Operaciones", area: "Operaciones", puesto: "Supervisor de Almacén", jefe: "Mónica Quintana", aCargo: 7, antiguedad: "14 años", ultimaEval: "7.2 / 10", ubicacion: "Planta", notas: "Confiable y constante. Valorar reconocimiento por antigüedad." },
  { id: 10, box: 0, nombre: "Diana Navarro Estrada", edad: 27, correo: "diana.navarro@empresa.com.mx", telefono: "55 1057 6643", departamento: "Comercial", area: "Comercial", puesto: "Ejecutiva Jr. de Ventas", jefe: "Andrés Ríos", aCargo: 0, antiguedad: "1 año", ultimaEval: "6.4 / 10", ubicacion: "Sucursal Sur", notas: "Mucho potencial, desempeño aún bajo. Diagnosticar barreras de arranque." },
  { id: 11, box: 3, nombre: "Emilio Solís Tapia", edad: 36, correo: "emilio.solis@empresa.com.mx", telefono: "55 2168 7754", departamento: "Administración", area: "Administración", puesto: "Analista de Finanzas", jefe: "Jorge Fuentes", aCargo: 0, antiguedad: "5 años", ultimaEval: "6.7 / 10", ubicacion: "Corporativo CDMX", notas: "Resultados irregulares. Requiere conversación clara de expectativas." },
  { id: 12, box: 6, nombre: "Gabriel Lara Domínguez", edad: 31, correo: "gabriel.lara@empresa.com.mx", telefono: "55 3279 8865", departamento: "Operaciones", area: "Operaciones", puesto: "Operador de Línea", jefe: "Ricardo Vega", aCargo: 0, antiguedad: "2 años", ultimaEval: "5.6 / 10", ubicacion: "Planta", notas: "Bajo desempeño sostenido. Iniciar plan de mejora (PIP)." },
  { id: 13, box: 7, nombre: "Natalia Ibarra Reyes", edad: 43, correo: "natalia.ibarra@empresa.com.mx", telefono: "55 4380 9976", departamento: "Posventa", area: "Posventa", puesto: "Asesora de Servicio", jefe: "Carlos Mendoza", aCargo: 0, antiguedad: "10 años", ultimaEval: "7.1 / 10", ubicacion: "Taller Norte", notas: "Sólida en su rol. Estable y comprometida." },
  { id: 14, box: 1, nombre: "Fernando Cruz Beltrán", edad: 30, correo: "fernando.cruz@empresa.com.mx", telefono: "55 5491 1087", departamento: "Comercial", area: "Comercial", puesto: "Ejecutivo de Cuenta Sr.", jefe: "Andrés Ríos", aCargo: 2, antiguedad: "4 años", ultimaEval: "8.0 / 10", ubicacion: "Sucursal Sur", notas: "Alto potencial. Candidato a coordinación comercial." },
];

const AREAS_EMPRESA = ["Comercial", "Posventa", "Operaciones", "Administración", "Dirección", "RH"];
const iniciales = (nombre) => nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

function Desempeno() {
  const [colaboradores, setColaboradores] = useState(COLABORADORES_INICIALES);
  const [dragId, setDragId] = useState(null);
  const [overBox, setOverBox] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [planBoxId, setPlanBoxId] = useState(null);
  const [planForId, setPlanForId] = useState(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const formInicial = { nombre: "", edad: "", correo: "", telefono: "", departamento: "", area: "Comercial", puesto: "", jefe: "", aCargo: "", ubicacion: "", notas: "", box: 4 };
  const [form, setForm] = useState(formInicial);

  const enBox = (boxId) => colaboradores.filter((c) => c.box === boxId);
  const total = colaboradores.length;
  const enBoxes = (ids) => colaboradores.filter((c) => ids.includes(c.box)).length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const altoPotencial = enBoxes([0, 1, 2]);
  const estrellas = enBoxes([2]);
  const enRiesgo = enBoxes([6]);

  const detalle = colaboradores.find((c) => c.id === detalleId) || null;
  const planBox = NINE_BOX.find((b) => b.id === planBoxId) || null;
  const planPersona = colaboradores.find((c) => c.id === planForId) || null;

  const primerNombre = (n) => n.split(" ")[0];
  // Inyecta los datos de la persona en cada acción genérica de la casilla.
  const personalizar = (texto, p) => {
    if (!p) return texto;
    const nom = primerNombre(p.nombre);
    return texto
      .replace(/\bsu jefe\b/gi, `su jefe (${p.jefe})`)
      .replace(/^1:1\b/, `1:1 con ${nom}`)
      .replace(/^Conversación/, `Conversación con ${nom}`)
      .replace(/^Reconocer\b/, `Reconocer a ${nom} por`)
      .replace(/^Reconocimiento formal del desempeño\.?$/, `Reconocimiento formal del desempeño de ${nom}.`)
      .replace(/\bsu rol\b/gi, `su rol de ${p.puesto}`)
      .replace(/\bal equipo\b/gi, p.aCargo > 0 ? `a su equipo (${p.aCargo} personas)` : "al equipo");
  };
  // Diagnóstico de apertura sintetizado a partir de los datos del colaborador.
  const diagnostico = (p, box) => {
    if (!p) return null;
    const nom = primerNombre(p.nombre);
    const carga = p.aCargo > 0 ? `lidera a ${p.aCargo} persona${p.aCargo > 1 ? "s" : ""}` : "sin personas a cargo";
    return `${nom} (${p.puesto}, ${p.area}) lleva ${p.antiguedad} en la empresa, ${carga}, ` +
      `con última evaluación de ${p.ultimaEval}. Ubicado en «${box.titulo}» (${box.eje}), el foco es: ${box.resumen.toLowerCase()}`;
  };
  const abrirPlan = (boxId, personaId = null) => { setPlanForId(personaId); setPlanBoxId(boxId); };
  const cerrarPlan = () => { setPlanBoxId(null); setPlanForId(null); };
  const exportarPlanPDF = (persona, box) => {
    const prevTitle = document.title;
    document.title = persona ? `Plan de trabajo · ${persona.nombre}` : `Plan de trabajo · ${box.titulo}`;
    document.body.classList.add("printing-plan");
    const cleanup = () => {
      document.body.classList.remove("printing-plan");
      document.title = prevTitle;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 60);
  };

  // --- Drag & Drop ---
  const onDrop = (boxId) => {
    if (dragId == null) return;
    setColaboradores((prev) => prev.map((c) => (c.id === dragId ? { ...c, box: boxId } : c)));
    setDragId(null);
    setOverBox(null);
  };

  const guardarNotas = (texto) => {
    setColaboradores((prev) => prev.map((c) => (c.id === detalleId ? { ...c, notas: texto } : c)));
  };

  const crearColaborador = () => {
    if (!form.nombre.trim()) return;
    const nuevoId = Math.max(0, ...colaboradores.map((c) => c.id)) + 1;
    setColaboradores((prev) => [
      ...prev,
      {
        id: nuevoId,
        box: Number(form.box),
        nombre: form.nombre.trim(),
        edad: form.edad ? Number(form.edad) : "—",
        correo: form.correo.trim() || "—",
        telefono: form.telefono.trim() || "—",
        departamento: form.departamento.trim() || form.area,
        area: form.area,
        puesto: form.puesto.trim() || "—",
        jefe: form.jefe.trim() || "—",
        aCargo: form.aCargo ? Number(form.aCargo) : 0,
        antiguedad: "Recién ingresado",
        ultimaEval: "Sin evaluar",
        ubicacion: form.ubicacion.trim() || "—",
        notas: form.notas.trim() || "Sin notas.",
      },
    ]);
    setForm(formInicial);
    setNuevoOpen(false);
  };

  const colSub = ["Desempeño bajo", "Desempeño medio", "Desempeño alto"];
  const rowSub = ["Potencial alto", "Potencial medio", "Potencial bajo"];

  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLOR.textMuted, marginBottom: 4 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={S.h2}>Desempeño</h2>
        </div>
        <button style={{ ...S.btn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setForm(formInicial); setNuevoOpen(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo colaborador
        </button>
      </div>
      <div style={S.hint}>
        Modelo de 9 box: cruza el <strong>potencial</strong> (eje vertical) con el <strong>desempeño</strong> (eje horizontal).
        <strong> Arrastra</strong> a cada persona para reubicarla, o haz <strong>clic</strong> sobre ella para ver su ficha completa.
      </div>

      <div style={S.grid4}>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Colaboradores evaluados</div>
            <div style={S.kpiValue}>{total}</div>
            <div style={S.kpiBenchmark("green")}>Cobertura objetivo: 100% de plantilla</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Alto potencial</div>
            <div style={S.kpiValue}>{pct(altoPotencial)}%</div>
            <div style={S.kpiBenchmark(altoPotencial >= 3 ? "green" : "yellow")}>{altoPotencial} personas · Saludable: ≥15%</div>
          </div>
          <TrafficLight light={altoPotencial >= 3 ? "green" : "yellow"} />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>Estrellas (listos promoción)</div>
            <div style={S.kpiValue}>{estrellas}</div>
            <div style={S.kpiBenchmark("green")}>Plan de sucesión activo</div>
          </div>
          <TrafficLight light="green" />
        </div>
        <div style={{ ...S.kpi, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kpiLabel}>En riesgo (PIP)</div>
            <div style={S.kpiValue}>{enRiesgo}</div>
            <div style={S.kpiBenchmark(enRiesgo === 0 ? "green" : enRiesgo <= 2 ? "yellow" : "red")}>Meta: 0 · Alerta: ≥3</div>
          </div>
          <TrafficLight light={enRiesgo === 0 ? "green" : enRiesgo <= 2 ? "yellow" : "red"} />
        </div>
      </div>

      <h3 style={S.h3}>Matriz 9 Box</h3>

      <div style={{ display: "flex", gap: 10 }}>
        {/* Eje vertical: Potencial */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 12, fontWeight: 700, color: "#2e4773", textTransform: "uppercase", letterSpacing: 1.5 }}>
            Potencial →
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {/* Encabezado de columnas (Desempeño) */}
          <div style={{ display: "grid", gridTemplateColumns: "104px 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div />
            {colSub.map((c) => (
              <div key={c} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: COLOR.textSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{c}</div>
            ))}
          </div>

          {/* 3 filas (Potencial alto → bajo) */}
          {[0, 1, 2].map((fila) => (
            <div key={fila} style={{ display: "grid", gridTemplateColumns: "104px 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", textAlign: "right", fontSize: 12, fontWeight: 700, color: COLOR.textSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {rowSub[fila]}
              </div>
              {[0, 1, 2].map((col) => {
                const box = NINE_BOX[fila * 3 + col];
                const gente = enBox(box.id);
                const activo = overBox === box.id && dragId != null;
                return (
                  <div
                    key={box.id}
                    onDragOver={(e) => { e.preventDefault(); if (overBox !== box.id) setOverBox(box.id); }}
                    onDrop={(e) => { e.preventDefault(); onDrop(box.id); }}
                    style={{
                      background: cellBg(box.accent),
                      border: `1px solid ${activo ? hexA(box.accent, 0.6) : COLOR.border}`,
                      borderRadius: 0,
                      padding: 11,
                      minHeight: 150,
                      display: "flex", flexDirection: "column", gap: 9,
                      boxShadow: activo ? `0 0 0 3px ${hexA(box.accent, 0.25)}, ${COLOR.shadowHover}` : COLOR.shadow,
                      transition: "box-shadow 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: box.accent, lineHeight: 1.15 }}>{box.titulo}</div>
                      <span style={{ ...S.badge("#fff"), border: `1px solid ${hexA(box.accent, 0.4)}`, color: box.accent, fontSize: 12 }}>{gente.length}</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, flex: 1, alignContent: "flex-start" }}>
                      {gente.map((c) => (
                        <button
                          key={c.id}
                          draggable
                          onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDragId(null); setOverBox(null); }}
                          onClick={() => setDetalleId(c.id)}
                          title={`${c.nombre} · ${c.puesto} — clic para ver ficha, arrastra para mover`}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            fontSize: 12, fontWeight: 600, padding: "4px 9px 4px 4px", borderRadius: 999,
                            border: `1px solid ${hexA(box.accent, 0.3)}`,
                            background: "#fff", color: COLOR.inkSoft,
                            cursor: "grab", boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                            opacity: dragId === c.id ? 0.4 : 1,
                          }}
                        >
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: box.accent }}>
                            {iniciales(c.nombre)}
                          </span>
                          {c.nombre.split(" ")[0]} {c.nombre.split(" ")[1]?.[0] ? c.nombre.split(" ")[1][0] + "." : ""}
                        </button>
                      ))}
                      {gente.length === 0 && <span style={{ fontSize: 12, color: COLOR.textMuted, fontStyle: "italic" }}>Suelta aquí…</span>}
                    </div>

                    <button
                      onClick={() => abrirPlan(box.id)}
                      style={{
                        marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
                        padding: "7px 10px", borderRadius: 6,
                        border: `1px solid ${hexA(box.accent, 0.45)}`,
                        background: hexA(box.accent, 0.1), color: box.accent, cursor: "pointer",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      Acción recomendada
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Eje horizontal: Desempeño */}
          <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#2e4773", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>
            Desempeño →
          </div>
        </div>
      </div>

      {/* ---------- Modal: ficha del colaborador ---------- */}
      {detalle && (
        <div onClick={() => setDetalleId(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 560, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid " + COLOR.border, boxShadow: COLOR.shadowHover }}>
            {/* Cabecera con textura cálida */}
            <div style={{ position: "relative", padding: "22px 24px", background: `radial-gradient(circle at 100% 0%, ${hexA(NINE_BOX[detalle.box].accent, 0.2)} 0%, transparent 60%), linear-gradient(135deg, ${hexA(NINE_BOX[detalle.box].accent, 0.12)} 0%, ${hexA(NINE_BOX[detalle.box].accent, 0.05)} 100%), #fff`, borderBottom: "1px solid " + COLOR.border, borderRadius: "12px 12px 0 0" }}>
              <button onClick={() => setDetalleId(null)} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: COLOR.textMuted, lineHeight: 1 }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", background: NINE_BOX[detalle.box].accent, boxShadow: "0 2px 8px rgba(15,23,42,0.2)" }}>
                  {iniciales(detalle.nombre)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLOR.ink }}>{detalle.nombre}</div>
                  <div style={{ fontSize: 13, color: COLOR.textSoft, marginTop: 2 }}>{detalle.puesto} · {detalle.area}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...S.badge(hexA(NINE_BOX[detalle.box].accent, 0.14)), color: NINE_BOX[detalle.box].accent, border: `1px solid ${hexA(NINE_BOX[detalle.box].accent, 0.4)}` }}>
                      {NINE_BOX[detalle.box].titulo} · {NINE_BOX[detalle.box].eje}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
                {[
                  ["Edad", `${detalle.edad}${typeof detalle.edad === "number" ? " años" : ""}`],
                  ["Antigüedad", detalle.antiguedad],
                  ["Correo", detalle.correo],
                  ["Teléfono", detalle.telefono],
                  ["Departamento", detalle.departamento],
                  ["Área", detalle.area],
                  ["Jefe inmediato", detalle.jefe],
                  ["Personas a cargo", String(detalle.aCargo)],
                  ["Ubicación", detalle.ubicacion],
                  ["Última evaluación", detalle.ultimaEval],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={labelStyle}>{k}</div>
                    <div style={{ fontSize: 13, color: COLOR.ink, fontWeight: 600, wordBreak: "break-word" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={labelStyle}>Notas</div>
                <textarea
                  value={detalle.notas}
                  onChange={(e) => guardarNotas(e.target.value)}
                  rows={3}
                  style={{ ...S.input, resize: "vertical", lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 4 }}>Las notas se guardan automáticamente.</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 8 }}>
                <button style={{ ...S.btnGhost }} onClick={() => { abrirPlan(detalle.box, detalle.id); setDetalleId(null); }}>Ver acción recomendada</button>
                <button style={{ ...S.btn }} onClick={() => setDetalleId(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal: plan de trabajo ---------- */}
      {planBox && (
        <div className="plan-print-overlay" onClick={cerrarPlan} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
          <div className="plan-print-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 640, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid " + COLOR.border, boxShadow: COLOR.shadowHover }}>
            <div style={{ position: "relative", padding: "22px 24px", background: `radial-gradient(circle at 100% 0%, ${hexA(planBox.accent, 0.2)} 0%, transparent 60%), linear-gradient(135deg, ${hexA(planBox.accent, 0.12)} 0%, ${hexA(planBox.accent, 0.05)} 100%), #fff`, borderBottom: "1px solid " + COLOR.border, borderRadius: "12px 12px 0 0" }}>
              <button className="plan-no-print" onClick={cerrarPlan} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: COLOR.textMuted, lineHeight: 1 }}>×</button>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: planBox.accent, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /><line x1="9" y1="21" x2="15" y2="21" /></svg>
                Plan de trabajo {planPersona ? "personalizado" : "sugerido"}
              </div>
              {planPersona ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", background: planBox.accent }}>
                    {iniciales(planPersona.nombre)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLOR.ink }}>{planPersona.nombre}</h3>
                    <div style={{ fontSize: 13, color: COLOR.textSoft }}>{planPersona.puesto} · {planPersona.area} · <span style={{ color: planBox.accent, fontWeight: 700 }}>{planBox.titulo}</span></div>
                  </div>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: "8px 0 2px", fontSize: 18, fontWeight: 700, color: COLOR.ink }}>{planBox.titulo}</h3>
                  <div style={{ fontSize: 13, color: COLOR.textSoft }}>{planBox.eje} · {planBox.resumen}</div>
                </>
              )}
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              {planPersona ? (
                <div style={{ borderRadius: 8, padding: "12px 14px", background: hexA(planBox.accent, 0.06), border: `1px solid ${hexA(planBox.accent, 0.2)}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: planBox.accent, marginBottom: 4 }}>Diagnóstico</div>
                  <div style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.55 }}>{diagnostico(planPersona, planBox)}</div>
                </div>
              ) : (() => {
                const gente = enBox(planBox.id);
                return (
                  <div style={{ fontSize: 12, color: COLOR.textMuted }}>
                    {gente.length > 0
                      ? <>Aplica a {gente.length} colaborador{gente.length > 1 ? "es" : ""} en esta casilla: <strong style={{ color: COLOR.text }}>{gente.map((c) => c.nombre).join(", ")}</strong>. Abre la ficha de cada quien para un plan personalizado.</>
                      : "Sin colaboradores en esta casilla por ahora."}
                  </div>
                );
              })()}

              {[
                { t: "0–30 días", sub: "Diagnóstico y arranque", items: planBox.plan.d30 },
                { t: "30–60 días", sub: "Desarrollo y seguimiento", items: planBox.plan.d60 },
                { t: "60–90 días", sub: "Consolidación y decisión", items: planBox.plan.d90 },
              ].map((fase) => (
                <div key={fase.t} className="plan-fase" style={{ border: "1px solid " + COLOR.border, borderRadius: 0, padding: "12px 14px", background: hexA(planBox.accent, 0.04) }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: planBox.accent }}>{fase.t}</div>
                    <div style={{ fontSize: 11, color: COLOR.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{fase.sub}</div>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                    {fase.items.map((it, i) => (
                      <li key={i} style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.5 }}>{personalizar(it, planPersona)}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div style={{ fontSize: 11, color: COLOR.textMuted, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                {planPersona ? `Plan generado para ${primerNombre(planPersona.nombre)} a modo de simulación. Revísalo y ajústalo antes de aplicarlo.` : "Contenido generado a modo de simulación. Abre la ficha de un colaborador para personalizarlo."}
              </div>
              <div className="plan-no-print" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button style={{ ...S.btnGhost, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => exportarPlanPDF(planPersona, planBox)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Exportar a PDF
                </button>
                <button style={S.btn} onClick={cerrarPlan}>Entendido</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal: nuevo colaborador ---------- */}
      {nuevoOpen && (
        <div onClick={() => setNuevoOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 620, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", border: "1px solid " + COLOR.border, boxShadow: COLOR.shadowHover }}>
            <div style={{ position: "relative", padding: "20px 24px", background: `radial-gradient(circle at 100% 0%, ${hexA("#2e4773", 0.16)} 0%, transparent 60%), linear-gradient(135deg, ${hexA("#2e4773", 0.1)} 0%, ${hexA("#2e4773", 0.04)} 100%), #fff`, borderBottom: "1px solid " + COLOR.border, borderRadius: "12px 12px 0 0" }}>
              <button onClick={() => setNuevoOpen(false)} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: COLOR.textMuted, lineHeight: 1 }}>×</button>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLOR.ink }}>Nuevo colaborador</h3>
              <div style={{ fontSize: 13, color: COLOR.textSoft, marginTop: 2 }}>Captura los datos y ubícalo en una casilla del 9 box.</div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <div style={labelStyle}>Nombre completo *</div>
                  <input style={S.input} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre y apellidos" />
                </div>
                <div><div style={labelStyle}>Edad</div><input style={S.input} type="number" value={form.edad} onChange={(e) => setForm((f) => ({ ...f, edad: e.target.value }))} placeholder="Ej. 34" /></div>
                <div><div style={labelStyle}>Teléfono</div><input style={S.input} value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="55 0000 0000" /></div>
                <div style={{ gridColumn: "1 / span 2" }}><div style={labelStyle}>Correo</div><input style={S.input} value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} placeholder="nombre@empresa.com.mx" /></div>
                <div>
                  <div style={labelStyle}>Área</div>
                  <select style={S.input} value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}>
                    {AREAS_EMPRESA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div><div style={labelStyle}>Departamento</div><input style={S.input} value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} placeholder="Ej. Posventa" /></div>
                <div><div style={labelStyle}>Puesto</div><input style={S.input} value={form.puesto} onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))} placeholder="Ej. Ejecutivo de cuenta" /></div>
                <div><div style={labelStyle}>Jefe inmediato</div><input style={S.input} value={form.jefe} onChange={(e) => setForm((f) => ({ ...f, jefe: e.target.value }))} placeholder="Nombre del jefe" /></div>
                <div><div style={labelStyle}>Personas a cargo</div><input style={S.input} type="number" value={form.aCargo} onChange={(e) => setForm((f) => ({ ...f, aCargo: e.target.value }))} placeholder="0" /></div>
                <div><div style={labelStyle}>Ubicación</div><input style={S.input} value={form.ubicacion} onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))} placeholder="Ej. Corporativo CDMX" /></div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <div style={labelStyle}>Casilla inicial (9 box)</div>
                  <select style={S.input} value={form.box} onChange={(e) => setForm((f) => ({ ...f, box: e.target.value }))}>
                    {NINE_BOX.map((b) => <option key={b.id} value={b.id}>{b.titulo} — {b.eje}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <div style={labelStyle}>Notas</div>
                  <textarea style={{ ...S.input, resize: "vertical" }} rows={2} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones iniciales…" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <button style={S.btnGhost} onClick={() => setNuevoOpen(false)}>Cancelar</button>
                <button style={{ ...S.btn, opacity: form.nombre.trim() ? 1 : 0.4, cursor: form.nombre.trim() ? "pointer" : "not-allowed" }} disabled={!form.nombre.trim()} onClick={crearColaborador}>Agregar colaborador</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h3 style={S.h3}>Distribución del talento</h3>
      <div style={S.card}>
        {(() => {
          const maxCount = Math.max(1, ...NINE_BOX.map((b) => enBox(b.id).length));
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {NINE_BOX.map((box) => {
                const n = enBox(box.id).length;
                const w = Math.round((n / maxCount) * 100);
                return (
                  <div key={box.id} title={box.resumen} style={{ display: "grid", gridTemplateColumns: "190px 1fr 34px", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: box.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: box.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{box.titulo}</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 1, paddingLeft: 18 }}>{box.eje}</div>
                    </div>
                    <div style={{ background: hexA(box.accent, 0.08), borderRadius: 6, height: 26, position: "relative", overflow: "hidden" }}>
                      <div style={{
                        width: n === 0 ? 0 : `${Math.max(w, 6)}%`, height: "100%", borderRadius: 6,
                        background: `linear-gradient(90deg, ${hexA(box.accent, 0.75)} 0%, ${box.accent} 100%)`,
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: n === 0 ? COLOR.textMuted : COLOR.ink, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</div>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 4, borderTop: "1px solid " + COLOR.borderSoft, paddingTop: 8 }}>
                Nº de colaboradores por casilla · pasa el cursor sobre cada barra para ver el enfoque recomendado.
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Catalogos() {
  const [benchmarks, setBenchmarks] = useState(BENCHMARKS_INICIALES);
  const [editIdx, setEditIdx] = useState(null);
  const [draftPartes, setDraftPartes] = useState(null);
  const [toast, setToast] = useState(null);

  const empezarEdicion = (idx, partes) => {
    setEditIdx(idx);
    setDraftPartes(JSON.parse(JSON.stringify(partes)));
  };
  const actualizarNumero = (parteIdx, nuevoValor) => {
    setDraftPartes(draftPartes.map((p, i) => i === parteIdx ? { ...p, valor: nuevoValor } : p));
  };
  const guardarEdicion = (idx) => {
    setBenchmarks(benchmarks.map((b, i) => i === idx ? { ...b, partes: draftPartes, ultimaModificacion: "María González · " + new Date().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) } : b));
    setEditIdx(null);
    setDraftPartes(null);
    setToast("Benchmark actualizado · cambio publicado a todos los KPIs afectados");
    setTimeout(() => setToast(null), 2500);
  };
  const cancelarEdicion = () => {
    setEditIdx(null);
    setDraftPartes(null);
  };
  const resetearTodos = () => {
    if (window.confirm("¿Restablecer TODOS los benchmarks a sus valores iniciales? Esta acción no se puede deshacer.")) {
      setBenchmarks(BENCHMARKS_INICIALES);
      setToast("Benchmarks restablecidos a valores iniciales");
      setTimeout(() => setToast(null), 2500);
    }
  };

  // Agrupar por módulo
  const porModulo = {};
  benchmarks.forEach((b, idx) => {
    if (!porModulo[b.modulo]) porModulo[b.modulo] = [];
    porModulo[b.modulo].push({ ...b, idx });
  });

  const moduloColor = {
    "Dashboard General": "#0f172a",
    "1. Variaciones de Nómina": "#c2410c",
    "2. Clima Laboral": "#0a7d2c",
    "3. Línea de Denuncia": "#b00020",
    "4. Cobertura de Plantilla": "#1d4ed8",
    "5. Proceso de Selección": "#7c3aed",
    "6. Rotación": "#b58900",
    "7. Capacitación": "#0891b2",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={S.h2}>Catálogos maestros · Benchmarks del sistema</h2>
          <p style={S.hint}>
            Los benchmarks definen los umbrales (verde / amarillo / rojo) de cada KPI. Cambios aquí impactan automáticamente todos los módulos donde el KPI se muestra.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnGhost} onClick={resetearTodos}>Restablecer todos</button>
          <button style={S.btn}>Exportar catálogo</button>
        </div>
      </div>

      {/* Stats */}
      <div style={S.grid4}>
        <div style={{ ...S.kpi, padding: 12 }}>
          <div style={S.kpiLabel}>Benchmarks activos</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{benchmarks.length}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>en {Object.keys(porModulo).length} módulos</div>
        </div>
        <div style={{ ...S.kpi, padding: 12 }}>
          <div style={S.kpiLabel}>Modificados (sesión)</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{benchmarks.filter((b) => b.ultimaModificacion).length}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>cambios aplicados</div>
        </div>
        <div style={{ ...S.kpi, padding: 12 }}>
          <div style={S.kpiLabel}>Compartidos entre módulos</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{benchmarks.filter((b) => b.aplicaA.length > 1).length}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>se replican automáticamente</div>
        </div>
        <div style={{ ...S.kpi, padding: 12 }}>
          <div style={S.kpiLabel}>Bitácora</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Cada cambio queda registrado</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>quién, qué, cuándo</div>
        </div>
      </div>

      {/* Listado por módulo */}
      {Object.entries(porModulo).map(([modulo, items]) => (
        <div key={modulo} style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 4, height: 18, background: moduloColor[modulo] || "#64748b", borderRadius: 2 }} />
            <h3 style={{ ...S.h3, margin: 0, paddingLeft: 0, borderLeft: "none" }}>{modulo}</h3>
            <span style={{ fontSize: 11, color: "#666" }}>· {items.length} benchmark{items.length !== 1 ? "s" : ""}</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>KPI</th>
                <th style={S.th}>Tipo</th>
                <th style={{ ...S.th, width: "40%" }}>Regla del benchmark</th>
                <th style={S.th}>Se aplica en</th>
                <th style={S.th}>Última modificación</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const enEdicion = editIdx === b.idx;
                const partesActuales = enEdicion ? draftPartes : b.partes;
                return (
                  <tr key={b.id}>
                    <td style={S.td}><strong>{b.kpi}</strong></td>
                    <td style={S.td}>
                      <span style={S.badge("#f1f5f9")}>{b.tipo}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 2, flexWrap: "wrap", padding: "4px 8px", background: enEdicion ? "#fff7ed" : "#f8fafc", border: enEdicion ? "1px solid #fed7aa" : "1px solid transparent", borderRadius: 4, fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#0f172a", lineHeight: 1.8 }}>
                        {partesActuales.map((p, i) => p.tipo === "texto" ? (
                          <span key={i} style={{ whiteSpace: "pre" }}>{p.valor}</span>
                        ) : enEdicion ? (
                          <input
                            key={i}
                            type="number"
                            step="any"
                            value={p.valor}
                            onChange={(e) => actualizarNumero(i, e.target.value === "" ? "" : Number(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") guardarEdicion(b.idx);
                              if (e.key === "Escape") cancelarEdicion();
                            }}
                            autoFocus={i === partesActuales.findIndex((pp) => pp.tipo === "numero")}
                            style={{
                              width: `${Math.max(String(p.valor).length + 1, 3)}ch`,
                              padding: "1px 4px", border: "1.5px solid #c2410c",
                              borderRadius: 3, fontSize: 12, fontFamily: "ui-monospace, monospace",
                              fontWeight: 700, color: "#c2410c", background: "#fff",
                              outline: "none", textAlign: "center",
                            }}
                          />
                        ) : (
                          <span key={i} style={{ fontWeight: 700, color: "#c2410c" }}>{Number.isInteger(p.valor) ? p.valor.toLocaleString("es-MX") : p.valor}</span>
                        ))}
                      </div>
                      {enEdicion && (
                        <div style={{ fontSize: 10, color: "#666", marginTop: 4, fontStyle: "italic" }}>
                          Solo los números en naranja son editables. El texto y las unidades son fijos.
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {b.aplicaA.map((tab) => (
                          <span key={tab} style={{ fontSize: 10, padding: "1px 6px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, color: "#475569", fontFamily: "ui-monospace, monospace" }}>{tab}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: "#475569" }}>{b.ultimaModificacion || "—"}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      {enEdicion ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 11 }} onClick={cancelarEdicion}>Cancelar</button>
                          <button style={{ ...S.btn, padding: "5px 10px", fontSize: 11 }} onClick={() => guardarEdicion(b.idx)}>Guardar</button>
                        </div>
                      ) : (
                        <button style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 11 }} onClick={() => empezarEdicion(b.idx, b.partes)}>Editar valores</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 200,
          background: "#0f172a", color: "#fff",
          padding: "12px 18px", borderRadius: 6,
          fontSize: 13, fontWeight: 600,
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.25)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "#facc15" }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}

// =============================================================
// SHELL — Layout con sidebar a la DERECHA
// =============================================================
export default function SaaSRRHH() {
  const [tab, setTab] = useState("nomina");
  const [filter, setFilter] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const [vistaGuia, setVistaGuia] = useState(false);
  const [catalogosPwdOpen, setCatalogosPwdOpen] = useState(false);
  const [catalogosPwdInput, setCatalogosPwdInput] = useState("");
  const [catalogosPwdError, setCatalogosPwdError] = useState(false);
  const [catalogosUnlocked, setCatalogosUnlocked] = useState(false);

  const PERIODOS = monthsOrder;

  // Índice de búsqueda: conceptos/palabras clave que apuntan a cada pestaña
  const SEARCH_INDEX = [
    { tab: "nomina", concepts: ["nómina", "sueldo", "salario", "compensación", "compensación variable", "bono", "bonos", "comisión", "comisiones", "destajo", "% variable", "límite mensual", "monto autorizado", "concepto de compensación"] },
    { tab: "clima", concepts: ["clima", "pulso semanal", "encuesta", "encuestas", "enps", "evaluación 360", "360", "entrevista de salida", "encuesta de bienvenida", "satisfacción", "exit interview", "instrumentos"] },
    { tab: "denuncia", concepts: ["denuncia", "denuncias", "incidencia ética", "compliance", "ética", "hoja de ruta", "acoso", "discriminación", "fraude", "conflicto interpersonal", "violación de política", "ricardo cardona", "alfredo mendoza", "francisco suárez", "jorge briones"] },
    { tab: "cobertura", concepts: ["vacante", "vacantes abiertas", "requisición", "REQ-101", "REQ-102", "REQ-103", "REQ-104", "REQ-105", "REQ-106", "REQ-107", "cobertura", "plantilla", "headcount", "puestos abiertos", "sourcing", "guía de entrevista"] },
    { tab: "seleccion", concepts: ["candidato", "candidatos", "selección", "pipeline candidatos", "entrevista RH", "pruebas psicométricas", "oferta económica", "contratación", "onboarding 30-60-90", "ana ramírez", "javier torres", "mauricio gómez", "sofía vega", "pedro núñez", "karen robles", "ramón cabral"] },
    { tab: "rotacion", concepts: ["rotación", "baja", "bajas", "renuncia", "renuncias", "finiquito", "liquidación", "anatomía del costo", "costo de baja", "involuntaria", "voluntaria", "ortega", "carlos reyes", "alejandro méndez", "patricia lozano", "mariana ortiz", "diana castro", "roberto núñez", "sofía beltrán"] },
    { tab: "capacitacion", concepts: ["capacitación", "curso", "cursos", "programa", "training", "ROI capacitación", "incidencias capacitación", "accountability", "deloitte", "sandler", "ipade", "cxg", "gantt"] },
    { tab: "catalogos", concepts: ["catálogo", "benchmark", "benchmarks", "configuración benchmark", "umbrales", "metas", "reglas semáforo"], locked: true },
  ];

  // Resultados: para cada query, lista de { tab, label, matchedConcepts[] }
  const normalizar = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = normalizar(filter.trim());
  const resultadosBusqueda = !q
    ? null
    : TABS.concat([{ id: "catalogos", label: "Catálogos maestros", num: "•" }]).map((t) => {
        const indice = SEARCH_INDEX.find((s) => s.tab === t.id);
        const labelMatch = normalizar(t.label).includes(q);
        const matchedConcepts = indice ? indice.concepts.filter((c) => normalizar(c).includes(q)) : [];
        const matches = labelMatch || matchedConcepts.length > 0;
        return matches ? { ...t, matchedConcepts, isLabelMatch: labelMatch, locked: indice?.locked } : null;
      }).filter(Boolean);
  const filtered = TABS;

  const intentarAbrirCatalogos = () => {
    if (catalogosUnlocked) {
      setTab("catalogos");
    } else {
      setCatalogosPwdOpen(true);
      setCatalogosPwdInput("");
      setCatalogosPwdError(false);
    }
  };
  const validarPwdCatalogos = () => {
    if (CATALOGOS_ADMIN_PASSWORD && catalogosPwdInput === CATALOGOS_ADMIN_PASSWORD) {
      setCatalogosUnlocked(true);
      setCatalogosPwdOpen(false);
      setCatalogosPwdInput("");
      setCatalogosPwdError(false);
      setTab("catalogos");
    } else {
      setCatalogosPwdError(true);
    }
  };
  const cancelarPwdCatalogos = () => {
    setCatalogosPwdOpen(false);
    setCatalogosPwdInput("");
    setCatalogosPwdError(false);
  };

  const render = () => {
    switch (tab) {
      case "nomina": return <Nomina periodo={periodo} />;
      case "clima": return <Clima />;
      case "denuncia": return <Denuncia />;
      case "cobertura": return <Cobertura />;
      case "rotacion": return <Rotacion />;
      case "capacitacion": return <Capacitacion />;
      case "desempeno": return <Desempeno />;
      case "seleccion": return <Seleccion onAbrirGuia={() => setVistaGuia(true)} />;
      case "catalogos": return <Catalogos />;
      default: return null;
    }
  };

  if (vistaGuia) {
    return <GuiaEntrevista onClose={() => setVistaGuia(false)} />;
  }

  return (
    <div style={S.page} className="print-page">
      {/* Topbar */}
      <div style={S.topbar} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
            color: "#fff", fontWeight: 800, fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "-0.04em",
            boxShadow: "0 2px 8px rgba(194, 65, 12, 0.25)",
          }}>
            RH
          </div>
          <div>
            <div style={{ ...S.title, textTransform: "none" }}>Bienvenida María</div>
            <div style={S.subtitle}>Suite integral para Dirección y Gerencia de Recursos Humanos</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnGhost}>Empresa: Demo S.A.</button>
          <select
            style={S.btnGhost}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>Periodo: {p}</option>
            ))}
          </select>
          <button
            style={S.btn}
            onClick={() => {
              const tabActual = TABS.find((t) => t.id === tab)?.label || (tab === "catalogos" ? "Catálogos maestros" : "Vista");
              document.title = `${tabActual} · ${periodo} · Tablero RRHH`;
              setTimeout(() => window.print(), 50);
            }}
            title="Imprimir / Exportar a PDF la pestaña actual"
          >
            Exportar
          </button>
        </div>
      </div>

      {/* Layout: sidebar izquierdo + contenido */}
      <div style={S.layout}>
        {/* Sidebar de catálogo a la IZQUIERDA */}
        <aside style={S.sidebar} className="no-print">
          <div style={{ padding: "0 20px 12px" }}>
            <input
              type="text"
              placeholder="Buscar por palabra o concepto…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={S.sidebarFilter}
            />
            {resultadosBusqueda && (
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontWeight: 600, letterSpacing: 0.3 }}>
                {resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 ? "s" : ""} para "<span style={{ color: "#c2410c" }}>{filter}</span>"
              </div>
            )}
          </div>

          <div>
            {/* Modo búsqueda: muestra coincidencias con concepto resaltado */}
            {resultadosBusqueda ? (
              resultadosBusqueda.length === 0 ? (
                <div style={{ padding: "20px", fontSize: 12, color: "#999", textAlign: "center" }}>
                  Sin resultados para "{filter}"
                </div>
              ) : (
                resultadosBusqueda.map((t) => (
                  <div
                    key={t.id}
                    style={S.sidebarItem(tab === t.id)}
                    onClick={() => {
                      if (t.id === "catalogos") {
                        intentarAbrirCatalogos();
                      } else {
                        setTab(t.id);
                      }
                      setFilter("");
                    }}
                  >
                    <div style={S.sidebarNum(tab === t.id)}>{t.num}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{t.label}</span>
                        {t.locked && <span style={{ color: "#64748b", display: "inline-flex" }}><IconLock size={10} /></span>}
                      </div>
                      {t.matchedConcepts.length > 0 && (
                        <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {t.matchedConcepts.slice(0, 3).map((c, i) => (
                            <span key={i} style={{ fontSize: 9, padding: "1px 5px", background: "#fff7ed", color: "#c2410c", borderRadius: 3, fontWeight: 700, letterSpacing: 0.2 }}>{c}</span>
                          ))}
                          {t.matchedConcepts.length > 3 && (
                            <span style={{ fontSize: 9, color: "#94a3b8" }}>+{t.matchedConcepts.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Modo normal: módulos */
              <>
                <div style={{ padding: "8px 20px 6px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                    Módulos
                  </div>
                </div>
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    style={S.sidebarItem(tab === t.id)}
                    onClick={() => setTab(t.id)}
                  >
                    <div style={S.sidebarNum(tab === t.id)}>{t.num}</div>
                    <span>{t.label}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={S.sidebarSection}>
            <div style={S.sidebarTitle}>Configuración</div>
          </div>
          <div style={S.sidebarItem(false)}>
            <span style={{ fontSize: 13 }}>Usuarios y permisos</span>
          </div>
          <div style={S.sidebarItem(tab === "catalogos")} onClick={intentarAbrirCatalogos}>
            <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              Catálogos maestros
              {catalogosUnlocked
                ? <span style={{ fontSize: 9, color: "#0a7d2c", fontWeight: 700 }}>● desbloqueado</span>
                : <span style={{ color: "#64748b", display: "inline-flex" }}><IconLock size={12} /></span>}
            </span>
          </div>
          <div style={S.sidebarItem(false)}>
            <span style={{ fontSize: 13 }}>Integraciones</span>
          </div>
        </aside>

        {/* Contenido principal */}
        <div style={S.main} className="print-main">{render()}</div>
      </div>

      {/* Password modal · Catálogos maestros */}
      {catalogosPwdOpen && (
        <div
          onClick={cancelarPwdCatalogos}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 8, padding: 24, width: 440, maxWidth: "92vw", border: "1px solid #ccc" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconLock size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Catálogos maestros</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Acceso restringido · Password requerido</div>
              </div>
            </div>

            <div style={{ ...S.kpiLabel, marginBottom: 6, marginTop: 14 }}>Password</div>
            <input
              type="password"
              autoFocus
              value={catalogosPwdInput}
              onChange={(e) => { setCatalogosPwdInput(e.target.value); if (catalogosPwdError) setCatalogosPwdError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") validarPwdCatalogos(); if (e.key === "Escape") cancelarPwdCatalogos(); }}
              placeholder="Ingresa el password de administrador"
              style={{
                width: "100%", padding: "10px 12px",
                border: `1px solid ${catalogosPwdError ? "#b00020" : "#ccc"}`,
                borderRadius: 6, fontSize: 14, fontFamily: "inherit",
                boxSizing: "border-box", outline: "none",
              }}
            />
            {catalogosPwdError && (
              <div style={{ fontSize: 12, color: "#b00020", marginTop: 6, fontWeight: 600 }}>
                Password incorrecto. Intenta de nuevo.
              </div>
            )}

            <div style={{ fontSize: 11, color: "#64748b", marginTop: 14, padding: "8px 10px", background: "#f8fafc", borderLeft: "3px solid #cbd5e1", borderRadius: 2 }}>
              Los Catálogos maestros controlan los benchmarks de TODOS los KPIs del sistema. Cualquier cambio impacta inmediatamente todos los módulos. Acceso reservado a administradores de RH.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button style={S.btnGhost} onClick={cancelarPwdCatalogos}>Cancelar</button>
              <button style={S.btn} onClick={validarPwdCatalogos}>Desbloquear catálogo</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="no-print" style={{
        borderTop: "1px solid #e2e8f0",
        padding: "14px 28px",
        background: "#fafafa",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, color: "#64748b",
      }}>
        <div>© 2026 · Tablero de control para RRHH</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, letterSpacing: 0.2 }}>
          Powered by
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 9px", borderRadius: 4,
            background: "#000",
            color: "#facc15", fontWeight: 800, letterSpacing: 0.6, fontSize: 10,
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
          }}>
            AXON B2B
          </span>
        </div>
      </footer>
    </div>
  );
}
