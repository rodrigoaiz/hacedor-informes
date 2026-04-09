# Generador de informes mensuales

Genera informes de actividades desde un archivo Markdown estructurado y produce automáticamente HTML, PDF y DOCX.

## 🚀 Uso rápido

**Ver reportes disponibles:**

```bash
npm run listar
```

**Generar un reporte es super simple:**

```bash
npm run generar 2026-02
```

También funciona con búsquedas parciales:

```bash
npm run generar 02    # Busca 2026-02
npm run generar 03    # Busca 2026-03
```

**Ver el reporte generado:**

```bash
npm run ver 2026-02   # Abre el PDF en tu visor
```

Eso es todo. El script automáticamente:
- ✅ Busca el archivo en la carpeta `reportes/`
- ✅ Incluye los logos institucionales en la cabecera
- ✅ Genera HTML, PDF y DOCX
- ✅ Los guarda en `salida/`

## 📋 Requisitos
- Node.js 16+
- Pandoc (para generación de DOCX)
- Las dependencias se instalan con: `npm install`

## 📁 Estructura
- `reportes/`: Coloca aquí tus archivos `.md` de reportes mensuales
- `plantillas/`: Plantillas HTML y CSS para el formato
- `assets/logos/`: Logos institucionales (UNAM y FACMED) - aparecen automáticamente en cada reporte
- `salida/`: Aquí se generan los reportes HTML y PDF

## 📝 Crear un nuevo reporte

1. Crea un archivo en `reportes/`, ejemplo: `reportes/2026-04.md`
2. Usa el formato con frontmatter YAML (ver ejemplo en `reportes/2026-02.md`)
3. Coloca tus capturas/evidencias en `reportes/imagenes/`
4. Referencia las imágenes en el Markdown: `![Descripción](imagenes/captura1.png)`
5. Genera con: `npm run generar 2026-04`

📚 **Ver [GUIA-IMAGENES.md](GUIA-IMAGENES.md) para más detalles sobre cómo usar imágenes**

### Saltos de página

Para forzar un salto de página en el PDF, usa este comentario HTML en tu markdown:

```markdown
Contenido de la página 1...

<!-- SALTO-PAGINA -->

Contenido de la página 2...
```

El comentario es válido en Markdown y no rompe los estilos.

---

## � Formato del archivo Markdown

Los reportes usan **frontmatter YAML** al inicio para los datos, seguido de Markdown normal:

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

### Nombre del Proyecto 1
Descripción y detalles del proyecto.
* Actividad 1
* Actividad 2

### Nombre del Proyecto 2
Otro proyecto...
```

Ver `reportes/2026-02.md` como ejemplo completo.

---

## 🔧 Modo avanzado (opcional)

Si prefieres usar Python (sistema legacy):

```bash
python3 scripts/generar_reporte.py datos/reporte-febrero-2026.md -o salida/reporte-febrero-2026.html --pdf
```

O con Make:
```bash
make reporte DATA=datos/reporte-febrero-2026.md
```

**Nota:** El sistema Python usa un formato diferente (ver `datos/reporte-febrero-2026.md`).

---

## 🎨 Personalización

### Cambiar los logos institucionales

Los logos se cargan automáticamente desde `assets/logos/`:
- `logo-unam.png` - Logo izquierdo
- `logo-facmed.png` - Logo derecho

Para cambiarlos, simplemente reemplaza estos archivos con tus propios logos (mantén los nombres).

**Recomendaciones:**
- Formato: PNG con fondo transparente
- Tamaño: ~500x500 pixels
- El script los redimensiona automáticamente a 100px de ancho

### Personalizar el diseño

Puedes modificar:
- `plantillas/template.html` - Estructura del documento
- `plantillas/style.css` - Estilos, colores, tipografía
