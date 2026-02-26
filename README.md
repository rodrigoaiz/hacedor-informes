# Generador de informes mensuales

Genera informes de actividades desde un archivo Markdown estructurado y produce:
- HTML listo para revisar.
- PDF tamaño carta automático (opcional), usando Google Chrome headless.

## Requisitos
- Python 3.10+
- Para PDF: Google Chrome (`google-chrome-stable`) recomendado
- LibreOffice (`soffice`) como fallback si no hay Chrome

## Estructura
- `scripts/generar_reporte.py`: script principal.
- `plantillas/reporte-mensual.md`: plantilla base para nuevos reportes.
- `datos/reporte-febrero-2026.md`: ejemplo con tus datos.
- `assets/logos/`: logos para cabecera.
- `evidencias/`: carpeta sugerida para imágenes probatorias.
- `salida/`: carpeta donde se guarda HTML/PDF.

## Uso
Generar solo HTML:
```bash
python3 scripts/generar_reporte.py datos/reporte-febrero-2026.md -o salida/reporte-febrero-2026.html
```

Generar HTML + PDF carta:
```bash
python3 scripts/generar_reporte.py datos/reporte-febrero-2026.md -o salida/reporte-febrero-2026.html --pdf
```

Definir nombre de PDF:
```bash
python3 scripts/generar_reporte.py datos/reporte-febrero-2026.md -o salida/reporte-febrero-2026.html --pdf --pdf-output salida/febrero-2026-carta.pdf
```

Con `make` (atajo recomendado):
```bash
make reporte DATA=datos/reporte-febrero-2026.md
```

## Formato del Markdown
```md
# INFORME DE ACTIVIDADES

## CABECERA
Linea 1: UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO
Linea 2: FACULTAD DE MEDICINA
Linea 3: SECRETARIA DE UNIVERSIDAD ABIERTA Y EDUCACION A DISTANCIA
Logo izquierdo: ../assets/logos/logo-unam.png
Logo derecho: ../assets/logos/logo-facmed.jpg

## DATOS
Nombre: ...
Correo: ...
...

## DESCRIPCION GENERAL
Texto libre.

## PROYECTOS
### Nombre del proyecto
- Actividad 1
- Actividad 2
Probatorio: ../evidencias/proyecto/probatorio-1.png
Probatorio: ../evidencias/proyecto/probatorio-2.png
Probatorio: ../evidencias/proyecto/probatorio-3.png
Probatorio: ../evidencias/proyecto/probatorio-4.png

## FIRMAS
NOMBRE 1 | CARGO 1
NOMBRE 2 | CARGO 2
NOMBRE 3 | CARGO 3
```

## Reglas de validación
- Cada proyecto debe tener **exactamente 4** líneas `Probatorio:`.
- Debe existir al menos una firma.
- Si usas logos/rutas relativas, se resuelven respecto al `.md` fuente.

## Notas de paginado
- El PDF se genera en tamaño carta (`@page size: Letter`).
- La cabecera con logos se imprime en todas las páginas.
- La sección de probatorios se pagina en bloques de 2 proyectos (8 imágenes por página).
- Cada bloque de probatorios por proyecto (4 imágenes) se mantiene unido y no se divide entre páginas.
- Las firmas se marcan para evitar salto de página aislado; en reportes muy largos puede requerir ajuste fino de contenido/márgenes.
- Si Chrome no está disponible, se usa LibreOffice y puede salir en A4 según configuración local.
