# Axon · Rentabilidad de RRHH

Tablero para Dirección y Gerencia de Recursos Humanos, usado en el workshop de rentabilidad de RRHH de Axon.
Branding Axon: amarillo #FDCA00 y negro (logos en `src/assets/`).

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
- Estilos inline (sin Tailwind ni CSS externo — fácil de portar al branding Axon después)

## Próximos pasos

- Branding Axon (colores, tipografía Inter, gradientes)
- Profundizar cada módulo individualmente
- Persistencia (localStorage / API)
- Autenticación y roles

## Chat "Pregúntale a la IA" (Aula)

Cada Aula trae un chat que solo responde preguntas del módulo que se está viendo (el tema y las reglas viven en `server/chat.js`, no en el navegador).

1. Crea un archivo `.env.local` en la raíz con tu clave de Anthropic:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Arranca la app con `npm run dev` (o `npm run build && npm run preview`). La ruta `/api/chat` la sirve Vite.
3. En Vercel, agrega `ANTHROPIC_API_KEY` en las variables de entorno; la función está en `api/chat.js`.

La clave nunca se envía al navegador. `.env.local` está en `.gitignore`.

## Registro de asistencia

Al abrir la app aparece una pantalla de registro (nombre y correo) con el logo del cliente. No es seguridad: se puede entrar sin llenar nada.

- Cada registro se guarda en `asistencia/registro.csv` (no se sube a git).
- Para descargar la lista: abre `/api/asistencia` en el navegador (ej. `http://localhost:5173/api/asistencia`).
- En Vercel el disco no es permanente: los registros quedan en los logs de la función `api/asistencia`.
