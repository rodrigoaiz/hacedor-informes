# Plan de implementacion - webapp MVP

## Objetivo

Convertir `hace-reportes` en una webapp interna que permita capturar un reporte mensual desde navegador, subir probatorios, generar el PDF en linea y devolverlo listo para descarga, manteniendo la logica actual de renderizado y preparandolo para una UI institucional, clara, moderna, confiable y sobria.

## Decision tecnica

- Frontend: `Astro` con `Tailwind CSS`
- Interactividad puntual: `React islands`
- Backend: `Express.js`
- Motor de generacion: modulo reutilizable extraido de `generar-reporte.js`
- PDF: `Puppeteer`
- Uploads temporales: `multer`
- Despliegue: `Docker`
- Proteccion MVP: autenticacion basica por variables de entorno

## Principios del MVP

- Reutilizar al maximo el motor actual antes de redisenar logica
- Separar claramente UI, API y motor de generacion
- Mantener el flujo simple: capturar -> validar -> generar -> descargar
- Evitar una SPA completa; usar islands solo donde den valor real
- Priorizar estabilidad de generacion PDF sobre features secundarias

## Arquitectura propuesta

```text
hace-reportes/
  src/                       # Astro app
    components/
    islands/
    layouts/
    pages/
    styles/
  server/
    index.js                 # Arranque Express
    routes/
      reports.js             # POST /api/reportes/generar
    middleware/
      auth.js
      upload.js
    services/
      report-service.js
  lib/
    report-engine/
      index.js               # API principal del motor
      markdown.js            # armado de markdown intermedio
      template.js            # render HTML final
      pdf.js                 # Puppeteer
      assets.js              # logos, imagenes, paths
      schema.js              # normalizacion y validacion
  public/
  docs/
  Dockerfile
  docker-compose.yml
```

## Flujo funcional

1. El usuario entra a la webapp y se autentica con credenciales basicas.
2. Completa el formulario por bloques:
   - datos generales
   - descripcion general
   - actividades por proyecto
   - probatorios por proyecto
   - firmantes
3. Las islands validan estructura y muestran resumen del reporte.
4. El frontend envia `multipart/form-data` a `POST /api/reportes/generar`.
5. Express guarda archivos temporalmente y construye un objeto de reporte.
6. El motor genera HTML y luego PDF con Puppeteer.
7. El backend responde con el PDF para descarga.
8. Se limpian archivos temporales al terminar.

## Alcance del MVP

### Incluye

- Formulario web completo
- Soporte para multiples proyectos
- Soporte para multiples actividades por proyecto
- Upload de imagenes de probatorios
- Generacion de PDF en linea
- Descarga directa del PDF
- Manejo basico de errores
- Proteccion con Basic Auth
- Docker para entorno reproducible

### No incluye en esta etapa

- Guardado de borradores en BD
- Historial de reportes generados
- Edicion colaborativa
- DOCX desde la webapp
- Vista previa pixel-perfect en tiempo real
- Roles/permisos avanzados

## UI/UX objetivo

### Direccion visual

- Institucional sin verse burocratica
- Sobria pero contemporanea
- Clara en jerarquia y lectura
- Confiable y ordenada
- Moderna en detalles, no en adornos excesivos

### Traduccion visual

- Tema claro
- Paleta neutra con acento institucional controlado
- Tipografia seria y actual, evitando look de dashboard generico
- Layout por bloques con fuerte jerarquia editorial
- Feedback de progreso visible y tranquilo
- Ayudas contextuales breves en cada seccion

### Uso de islands

Usar islands solo para:

- constructor de proyectos y actividades
- carga y vista previa de probatorios
- validacion progresiva
- resumen previo a generar
- estado de generacion

Evitar islands para:

- layout general
- navegacion
- estructura estatica
- textos de ayuda simples

## Fases de implementacion

### Fase 0 - Base y dependencias

Objetivo: preparar el proyecto para convivir con Astro + Express.

Tareas:

- instalar `astro`, `tailwindcss`, `@astrojs/react`, `react`, `react-dom`, `express`, `multer`, `zod`, `basic-auth`
- definir scripts de desarrollo y build
- decidir si Astro y Express comparten proceso o se levantan por separado

Resultado esperado:

- estructura inicial lista para iterar

### Fase 1 - Extraer motor de generacion

Objetivo: desacoplar la generacion del CLI actual.

Tareas:

- mover la logica de `generar-reporte.js` a `lib/report-engine/`
- exponer una funcion tipo `generateReport({ data, files, output })`
- soportar input estructurado sin depender de leer un `.md` existente
- mantener compatibilidad con el script CLI actual

Resultado esperado:

- un motor reutilizable desde CLI y API

### Fase 2 - Normalizacion y validacion

Objetivo: garantizar entradas consistentes.

Tareas:

- definir schema con `zod`
- normalizar datos del formulario al formato interno del motor
- validar cantidad minima de datos por proyecto
- validar tipos/tamanos de imagenes

Resultado esperado:

- errores claros antes de invocar Puppeteer

### Fase 3 - API Express

Objetivo: exponer la generacion por HTTP.

Rutas:

- `POST /api/reportes/generar`
- `GET /api/health`

Tareas:

- configurar `multer` con storage temporal
- agregar middleware de auth basica
- implementar servicio que arme directorio temporal por request
- responder con `application/pdf`
- limpiar temporales siempre, incluso en error

Resultado esperado:

- endpoint funcional de generacion

### Fase 4 - Frontend Astro

Objetivo: construir la experiencia principal.

Paginas iniciales:

- `src/pages/index.astro` - formulario principal
- `src/pages/login` solo si luego se cambia Basic Auth por sesion; para MVP no es necesario

Componentes sugeridos:

- `AppShell.astro`
- `ReportHeader.astro`
- `SectionBlock.astro`
- `Field.astro`
- `HelpNote.astro`
- `StatusPanel.astro`

Islands sugeridas:

- `ProjectsBuilder.tsx`
- `EvidenceUploader.tsx`
- `ReportSummary.tsx`
- `GenerateButton.tsx`

Resultado esperado:

- flujo usable end-to-end desde navegador

### Fase 5 - Sistema visual con Tailwind

Objetivo: consolidar una interfaz consistente.

Tareas:

- definir tokens base en `tailwind.config`
- mapear colores, espacios, radios, sombras y tipografia
- crear utilidades de layout para bloques de formulario
- integrar estados de foco, error, exito y carga

Resultado esperado:

- base visual reusable y alineada con la direccion UX

### Fase 6 - Dockerizacion

Objetivo: empaquetar todo listo para ejecutar.

Tareas:

- crear `Dockerfile` con base compatible con Chromium/Puppeteer
- definir `docker-compose.yml`
- exponer variables de entorno: puerto, usuario, password, tmp dir
- probar generacion completa dentro del contenedor

Resultado esperado:

- entorno portable para local o servidor

### Fase 7 - Endurecimiento MVP

Objetivo: dejarlo listo para uso interno real.

Tareas:

- mensajes de error legibles
- limite de tamano de archivos
- timeout de generacion
- manejo de fallas de Puppeteer
- logging basico por request
- limpieza de temporales en escenarios anormales

Resultado esperado:

- comportamiento estable para usuarios internos

## Contrato de datos sugerido

```ts
type ReportInput = {
  titulo: string
  nombre: string
  correo: string
  telefono: string
  jefe: string
  fecha: string
  periodo: string
  rfc: string
  descripcionGeneral: string
  proyectos: Array<{
    nombre: string
    descripcion?: string
    actividades: string[]
    probatorios: Array<{
      titulo: string
      file: FileRef
    }>
  }>
  firmas: [
    { nombre: string; cargo: string },
    { nombre: string; cargo: string },
    { nombre: string; cargo: string }
  ]
}
```

## Endpoints MVP

### `POST /api/reportes/generar`

Entrada:

- `multipart/form-data`
- campos serializados del reporte
- archivos de probatorios

Salida exitosa:

- `200 application/pdf`
- header `Content-Disposition: attachment`

Salida con error:

- `400` validacion
- `401` acceso no autorizado
- `413` archivo demasiado grande
- `500` error de generacion

## Dependencias sugeridas

```bash
npm install astro express multer zod basic-auth tailwindcss @tailwindcss/vite @astrojs/react react react-dom
```

Si se separan builds o se requiere soporte extra:

```bash
npm install -D concurrently
```

## Riesgos y mitigacion

- Puppeteer en contenedor: usar imagen base preparada para Chromium
- Formularios largos: dividir por secciones claras y resumen persistente
- Uploads pesados: limitar peso y cantidad desde frontend y backend
- Retrasos al generar PDF: mostrar estado de progreso y bloquear doble envio
- Mezcla de responsabilidades: mantener el motor en `lib/report-engine/`

## Criterios de aceptacion del MVP

- Un usuario interno puede llenar el formulario sin tocar Markdown
- Puede agregar proyectos, actividades e imagenes sin friccion
- El sistema genera un PDF consistente con el formato actual
- El PDF se descarga desde navegador en una sola accion
- La app corre via Docker de forma reproducible
- La interfaz transmite claridad, orden y confianza

## Orden recomendado para empezar manana mismo

1. Extraer el motor a `lib/report-engine/`
2. Crear `server/index.js` con `GET /api/health`
3. Crear `POST /api/reportes/generar` con datos mock sin frontend
4. Inicializar Astro + Tailwind
5. Construir el formulario base en `src/pages/index.astro`
6. Implementar `ProjectsBuilder.tsx`
7. Implementar `EvidenceUploader.tsx`
8. Conectar frontend con API real
9. Dockerizar
10. Afinar UI/UX final

## Siguiente entregable recomendado

Tras este plan, el siguiente documento util debe ser un backlog tecnico por tareas concretas, con estimacion por bloque y orden de implementacion diario.
