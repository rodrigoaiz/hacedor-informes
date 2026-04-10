# Generador de informes mensuales

Herramienta interna para el área de Integración SUAYED · Facultad de Medicina, UNAM.  
Permite generar informes mensuales de actividades con formato institucional en PDF, desde una interfaz web o desde la línea de comandos.

---

## Webapp (modo recomendado)

### Desarrollo

```bash
npm install
npm run dev:webapp
```

- Frontend: http://localhost:4323
- API: http://localhost:4324

### Producción (Node.js directo)

```bash
npm run build      # Compila el frontend con Astro
npm start          # Sirve frontend + API en el puerto 4324
```

### Producción con Docker

```bash
docker compose up --build
```

La app queda disponible en http://localhost:4324.

Variables de entorno opcionales:

| Variable    | Descripción                            | Default |
|-------------|----------------------------------------|---------|
| `PORT`      | Puerto del servidor                    | `4324`  |
| `AUTH_USER` | Usuario para Basic Auth (opcional)     | —       |
| `AUTH_PASS` | Contraseña para Basic Auth (opcional)  | —       |

### Flujo de uso

1. Abre la webapp en el navegador
2. Completa el formulario: datos generales, descripción del mes, proyectos, actividades y probatorios (capturas de evidencia)
3. Haz clic en **Generar PDF** — el archivo se descarga automáticamente con formato institucional

---

## CLI (modo alternativo)

El CLI sigue funcionando de forma independiente a la webapp.

**Listar reportes disponibles:**

```bash
npm run listar
```

**Generar un reporte desde archivo Markdown:**

```bash
npm run generar 2026-02
npm run generar 02      # búsqueda parcial
```

**Ver el PDF generado:**

```bash
npm run ver 2026-02
```

Los archivos generados quedan en `salida/`.

### Formato del archivo Markdown

Los reportes usan frontmatter YAML al inicio:

```markdown
---
titulo: "Reporte Mensual Febrero 2026"
nombre: "Jesús Rodrigo Aizpuru Parra"
correo: "integracion.suayed01@facmed.unam.mx"
telefono: "5536798958"
jefe: "Joel Villamar Chulin"
fecha: "2 de marzo de 2026"
periodo: "1 de febrero al 28 de febrero de 2026"
rfc: "AIPJ840407V55"
nombre_firma_1: "Mtro. Jesús Rodrigo Aizpuru Parra"
cargo_firma_1: "Diseño Web e Integración"
nombre_firma_2: "Lic. Joel Villamar Chulin"
cargo_firma_2: "Coordinador de Diseño Web e Integración"
nombre_firma_3: "Dra. Lilia Macedo de la Concha"
cargo_firma_3: "Secretaria SUAYED"
---

## DESCRIPCIÓN GENERAL DE ACTIVIDADES
Tu descripción general aquí...

## ACTIVIDADES REALIZADAS

### Nombre del Proyecto
* Actividad 1
* Actividad 2

## PROBATORIOS

### Nombre del Proyecto

![Descripción de la evidencia](imagenes/captura1.png)
```

Ver `reportes/2026-02.md` como ejemplo completo.

### Saltos de página

```markdown
Contenido de la página 1...

<!-- SALTO-PAGINA -->

Contenido de la página 2...
```

---

## Estructura del proyecto

```
hace-reportes/
├── src/                        # Frontend Astro + React
│   ├── layouts/AppLayout.astro
│   ├── pages/index.astro
│   ├── islands/ReportComposer.jsx
│   └── styles/global.css
├── server/                     # API Express
│   ├── index.js
│   ├── routes/reports.js
│   ├── middleware/
│   └── services/report-service.js
├── lib/report-engine/          # Motor de generación (compartido por CLI y API)
│   ├── index.js
│   └── schema.js
├── plantillas/                 # Plantilla HTML y CSS del PDF institucional
├── assets/logos/               # Logos UNAM y FACMED
├── reportes/                   # Archivos .md para el CLI
├── salida/                     # PDFs generados por el CLI
├── Dockerfile
├── docker-compose.yml
└── generar-reporte.js          # Entrypoint del CLI
```

## Requisitos

- Node.js 22+
- Puppeteer (se instala con `npm install`; descarga Chromium automáticamente)
- Docker (solo para el modo contenedor)

Para el CLI: Pandoc es opcional (genera DOCX además de PDF si está disponible).
