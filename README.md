# TABLERO DE CONTROL PARA RRHH

Suite integral para Dirección y Gerencia de Recursos Humanos.
Versión inicial sin branding — fondo blanco, letras negras.

## Módulos (7 pestañas + Dashboard)

0. **Dashboard** — Vista ejecutiva con KPIs y alertas
1. **Variaciones de Nómina** — Compensación variable por área con límites
2. **Clima Laboral** — Pulsos, 360°, encuestas de salida
3. **Línea de Denuncia** — Incidencias → Hojas de Ruta
4. **Cobertura de Plantilla** — Vacantes y embudo del proceso
5. **Rotación** — % y costos directos, indirectos, ocultos, hundidos
6. **Capacitación** — Pipeline, calendario, costo y ROI
7. **Proceso de Selección** — Pipeline completo + onboarding 30-60-90+

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Build de producción

```bash
npm run build
npm run preview
```

## Estructura

```
saas-rrhh/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx          # Entry point
    └── SaaSRRHH.jsx      # Componente principal con todos los módulos
```

## Stack

- Vite 5
- React 18
- Estilos inline (sin Tailwind ni CSS externo — fácil de portar al branding Profit120 después)

## Próximos pasos

- Branding Profit120 (colores, tipografía Inter, gradientes)
- Profundizar cada módulo individualmente
- Persistencia (localStorage / API)
- Autenticación y roles
