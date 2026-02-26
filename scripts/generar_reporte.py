#!/usr/bin/env python3
"""Genera un informe mensual en HTML/PDF a partir de Markdown estructurado.

Formato esperado:

# INFORME DE ACTIVIDADES

## CABECERA
Linea 1: UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO
Linea 2: FACULTAD DE MEDICINA
Linea 3: SECRETARIA DE UNIVERSIDAD ABIERTA Y EDUCACION A DISTANCIA
Logo izquierdo: assets/logos/logo-unam.png
Logo derecho: assets/logos/logo-facmed.jpg

## DATOS
Nombre: ...
Correo: ...
...

## DESCRIPCION GENERAL
Texto libre (multilinea).

## PROYECTOS
### <Nombre del proyecto>
- Actividad 1
- Actividad 2
Probatorio: ruta/imagen1.png
Probatorio: ruta/imagen2.png
Probatorio: ruta/imagen3.png
Probatorio: ruta/imagen4.png

## FIRMAS
Nombre Firma 1 | Cargo 1
Nombre Firma 2 | Cargo 2
Nombre Firma 3 | Cargo 3
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import subprocess
from pathlib import Path


def md_inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    return text


def normalize_lines(raw: str) -> list[str]:
    return [line.rstrip() for line in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n")]


def resolve_image_src(raw_path: str, base_dir: Path) -> str:
    raw_path = raw_path.strip()
    if re.match(r"^(https?://|data:)", raw_path, re.IGNORECASE):
        return raw_path
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = (base_dir / candidate).resolve()
    return candidate.as_uri()


def parse_report(path: Path) -> dict:
    lines = normalize_lines(path.read_text(encoding="utf-8"))
    base_dir = path.parent.resolve()
    data: dict[str, object] = {
        "titulo": "INFORME DE ACTIVIDADES",
        "cabecera": {
            "Linea 1": "UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO",
            "Linea 2": "FACULTAD DE MEDICINA",
            "Linea 3": "SECRETARIA DE UNIVERSIDAD ABIERTA Y EDUCACION A DISTANCIA",
            "Logo izquierdo": "",
            "Logo derecho": "",
        },
        "datos": {},
        "descripcion": "",
        "proyectos": [],
        "firmas": [],
    }

    if not any(line.strip().startswith("##") for line in lines):
        raise ValueError("El archivo no contiene secciones '##'.")

    section = None
    current_project = None

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            if section == "DESCRIPCION GENERAL":
                data["descripcion"] += "\n"
            continue

        if line.startswith("# "):
            data["titulo"] = line[2:].strip()
            continue

        if line.startswith("## "):
            section = line[3:].strip().upper()
            current_project = None
            continue

        if section == "CABECERA":
            if ":" not in line:
                raise ValueError(f"Linea invalida en CABECERA: '{raw_line}'")
            key, val = line.split(":", 1)
            data["cabecera"][key.strip()] = val.strip()
            continue

        if section == "DATOS":
            if ":" not in line:
                raise ValueError(f"Linea invalida en DATOS: '{raw_line}'")
            key, val = line.split(":", 1)
            data["datos"][key.strip()] = val.strip()
            continue

        if section == "DESCRIPCION GENERAL":
            if data["descripcion"]:
                data["descripcion"] += "\n"
            data["descripcion"] += line
            continue

        if section == "PROYECTOS":
            if line.startswith("### "):
                current_project = {
                    "nombre": line[4:].strip(),
                    "titulo_probatorios": "",
                    "actividades": [],
                    "probatorios": [],
                }
                data["proyectos"].append(current_project)
                continue

            if current_project is None:
                raise ValueError("Se encontro contenido en PROYECTOS antes de un encabezado '###'.")

            if line.lower().startswith("probatorio:"):
                ruta = line.split(":", 1)[1].strip()
                current_project["probatorios"].append(resolve_image_src(ruta, base_dir))
                continue

            if re.match(r"(?i)^titulo probatorios?:", line):
                titulo_prob = line.split(":", 1)[1].strip()
                current_project["titulo_probatorios"] = titulo_prob
                continue

            # Conserva sangria y bullet original para soportar listas anidadas.
            current_project["actividades"].append(raw_line.rstrip())
            continue

        if section == "FIRMAS":
            if "|" in line:
                nombre, cargo = [x.strip() for x in line.split("|", 1)]
            else:
                nombre, cargo = line, ""
            data["firmas"].append({"nombre": nombre, "cargo": cargo})
            continue

    if not data["proyectos"]:
        raise ValueError("Debes definir al menos un proyecto en la seccion PROYECTOS.")

    for project in data["proyectos"]:
        count = len(project["probatorios"])
        if count != 4:
            raise ValueError(
                f"El proyecto '{project['nombre']}' tiene {count} probatorios. Deben ser exactamente 4."
            )

    if not data["firmas"]:
        raise ValueError("Debes incluir al menos una firma en la seccion FIRMAS.")

    left_logo = str(data["cabecera"].get("Logo izquierdo", "")).strip()
    right_logo = str(data["cabecera"].get("Logo derecho", "")).strip()
    if left_logo:
        data["cabecera"]["Logo izquierdo"] = resolve_image_src(left_logo, base_dir)
    if right_logo:
        data["cabecera"]["Logo derecho"] = resolve_image_src(right_logo, base_dir)

    return data


def split_paragraphs(text: str) -> list[str]:
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    return [" ".join(line.strip() for line in block.splitlines() if line.strip()) for block in blocks]


def render_nested_activity_list(lines: list[str]) -> str:
    """Renderiza listas anidadas a partir de líneas con sangría y bullets."""
    bullet_re = re.compile(r"^(\s*)(?:[-*+]|[oO]|[0-9]+\.)\s+(.+)$")
    root: list[dict] = []
    stack: list[tuple[int, list[dict]]] = [(-1, root)]
    last_item: dict | None = None

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue

        m = bullet_re.match(line)
        if m:
            indent = len(m.group(1).replace("\t", "    "))
            text = m.group(2).strip()

            while len(stack) > 1 and indent <= stack[-1][0]:
                stack.pop()

            item = {"text": text, "children": []}
            stack[-1][1].append(item)
            stack.append((indent, item["children"]))
            last_item = item
            continue

        text = line.strip()
        if last_item is not None:
            last_item["text"] = f"{last_item['text']} {text}".strip()
        else:
            item = {"text": text, "children": []}
            root.append(item)
            last_item = item

    def to_html(items: list[dict]) -> str:
        if not items:
            return ""
        parts = ["<ul>"]
        for item in items:
            child_html = to_html(item["children"])
            parts.append(f"<li>{md_inline(item['text'])}{child_html}</li>")
        parts.append("</ul>")
        return "".join(parts)

    return to_html(root)


def render_html(report: dict, source_path: Path) -> str:
    titulo = md_inline(str(report["titulo"]))
    cab = report["cabecera"]

    datos_html = "\n".join(
        f"<tr><th>{md_inline(str(k))}</th><td>{md_inline(str(v))}</td></tr>"
        for k, v in report["datos"].items()
    )

    descripcion_html = "\n".join(
        f"<p>{md_inline(paragraph)}</p>" for paragraph in split_paragraphs(str(report["descripcion"]))
    )

    proyectos_parts = []
    for idx, p in enumerate(report["proyectos"], start=1):
        actividades_list = [a for a in p["actividades"] if a.strip()]
        actividades_html = render_nested_activity_list(actividades_list)

        projects_html = (
            "<section class='project'>"
            f"<h3>{idx}. {md_inline(str(p['nombre']))}</h3>"
            "<h4>Actividades realizadas</h4>"
            f"{actividades_html}"
            "</section>"
        )
        proyectos_parts.append(projects_html)

    projects = list(report["proyectos"])
    final_project = projects[-1]
    regular_projects = projects[:-1]

    proof_pages = []
    for start in range(0, len(regular_projects), 2):
        chunk = regular_projects[start : start + 2]
        proof_blocks = []
        for offset, p in enumerate(chunk, start=1):
            project_number = start + offset
            proof_title = str(p.get("titulo_probatorios") or p["nombre"])
            imgs = []
            for pos, img_src in enumerate(p["probatorios"], start=1):
                safe_src = html.escape(img_src, quote=True)
                alt = html.escape(f"Probatorio {pos} de {p['nombre']}")
                imgs.append(
                    "<figure class='proof-item'>"
                    f"<img src='{safe_src}' alt='{alt}' loading='lazy'/>"
                    "</figure>"
                )

            proof_blocks.append(
                "<article class='proof-project'>"
                f"<h3>{project_number}. {md_inline(proof_title)}</h3>"
                f"<div class='proof-grid'>{''.join(imgs)}</div>"
                f"<div class='proof-footer'>Captura de proyecto: {md_inline(proof_title)}</div>"
                "</article>"
            )
        title_html = "<h2>Probatorios</h2>" if start == 0 else ""
        proof_pages.append(f"<section class='proof-page'>{title_html}{''.join(proof_blocks)}</section>")

    signature_items = []
    for firma in report["firmas"]:
        signature_items.append(
            "<div class='signature'>"
            "<div class='signature-line'></div>"
            f"<div class='signature-name'>{md_inline(str(firma['nombre']))}</div>"
            f"<div class='signature-role'>{md_inline(str(firma['cargo']))}</div>"
            "</div>"
        )

    if len(signature_items) >= 3:
        firmas_html = (
            "<div class='signature-row signature-row-top'>"
            f"{signature_items[0]}{signature_items[1]}"
            "</div>"
            "<div class='signature-row signature-row-bottom'>"
            f"{signature_items[2]}"
            "</div>"
        )
    else:
        firmas_html = f"<div class='signature-row signature-row-top'>{''.join(signature_items)}</div>"

    # Ultima pagina: siempre incluye al menos un bloque de probatorios y firmas.
    final_imgs = []
    final_title_text = str(final_project.get("titulo_probatorios") or final_project["nombre"])
    for pos, img_src in enumerate(final_project["probatorios"], start=1):
        safe_src = html.escape(img_src, quote=True)
        alt = html.escape(f"Probatorio {pos} de {final_project['nombre']}")
        final_imgs.append(
            "<figure class='proof-item'>"
            f"<img src='{safe_src}' alt='{alt}' loading='lazy'/>"
            "</figure>"
        )

    final_index = len(regular_projects) + 1
    final_title = "<h2>Probatorios</h2>" if not proof_pages else ""
    final_page = (
        "<section class='proof-page proof-page-final'>"
        f"{final_title}"
        "<article class='proof-project'>"
        f"<h3>{final_index}. {md_inline(final_title_text)}</h3>"
        f"<div class='proof-grid'>{''.join(final_imgs)}</div>"
        f"<div class='proof-footer'>Captura de proyecto: {md_inline(final_title_text)}</div>"
        "</article>"
        "<section class='signature-section'>"
        "<h2>Firmas</h2>"
        f"<div class='signatures'>{firmas_html}</div>"
        "</section>"
        "</section>"
    )
    proof_pages.append(final_page)

    left_logo_html = ""
    if str(cab.get("Logo izquierdo", "")).strip():
        src = html.escape(str(cab["Logo izquierdo"]), quote=True)
        left_logo_html = f"<img class='logo-left' src='{src}' alt='Logo izquierdo'/>"

    right_logo_html = ""
    if str(cab.get("Logo derecho", "")).strip():
        src = html.escape(str(cab["Logo derecho"]), quote=True)
        right_logo_html = f"<img class='logo-right' src='{src}' alt='Logo derecho'/>"

    header_lines = "".join(
        f"<div>{md_inline(str(cab.get(f'Linea {n}', '')))}</div>" for n in (1, 2, 3)
    )

    return f"""<!doctype html>
<html lang='es'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>{titulo}</title>
  <style>
    :root {{
      --ink: #111827;
      --muted: #4b5563;
      --line: #d1d5db;
      --paper: #ffffff;
      --accent: #1f3864;
      --bg: #f3f4f6;
    }}

    * {{ box-sizing: border-box; }}

    @page {{
      size: Letter;
      margin: 18mm 15mm 18mm 15mm;
    }}

    body {{
      margin: 0;
      padding: 20px;
      background: linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%);
      color: var(--ink);
      font-family: Arial, sans-serif;
      line-height: 1.4;
      font-size: 11pt;
    }}

    .page {{
      max-width: 820px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 28px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }}

    .print-header {{
      display: grid;
      grid-template-columns: 100px 1fr 100px;
      align-items: center;
      column-gap: 8px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 8px;
      margin-bottom: 12px;
    }}

    .print-layout {{
      width: 100%;
      border-collapse: collapse;
      border: none;
    }}

    .print-layout td {{
      border: none;
      padding: 0;
      vertical-align: top;
    }}

    .print-header img {{
      width: 86px;
      height: auto;
      object-fit: contain;
    }}

    .print-header .logo-right {{
      justify-self: end;
    }}

    .header-lines {{
      text-align: center;
      font-size: 10.5pt;
      font-weight: 700;
      line-height: 1.25;
    }}

    h1 {{
      margin: 8px 0 16px;
      font-size: 16pt;
      text-align: center;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }}

    h2 {{
      margin: 18px 0 8px;
      font-size: 12.5pt;
      text-transform: uppercase;
      color: var(--accent);
      letter-spacing: 0.2px;
    }}

    h3 {{
      margin: 14px 0 8px;
      font-size: 11.5pt;
    }}

    h4 {{
      margin: 10px 0 6px;
      font-size: 10.5pt;
      color: var(--muted);
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--line);
      font-size: 10.5pt;
    }}

    th, td {{
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }}

    th {{
      width: 34%;
      background: #f8fafc;
      font-weight: 700;
    }}

    p {{ margin: 0 0 8px; }}
    ul {{ margin: 0 0 8px 18px; padding: 0; }}
    li {{ margin-bottom: 4px; }}
    ul ul {{ margin-top: 4px; margin-bottom: 4px; list-style-type: circle; }}
    ul ul ul {{ list-style-type: square; }}

    .project {{
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      page-break-inside: auto;
      break-inside: auto;
    }}

    .proof-page {{
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid-page;
    }}

    .proof-project {{
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid-page;
    }}

    .proof-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }}

    .proof-item {{
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 6px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .proof-item img {{
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      display: block;
      background: #f3f4f6;
    }}

    .proof-item figcaption {{
      font-size: 9pt;
      color: var(--muted);
      margin-top: 4px;
      text-align: center;
    }}

    .proof-footer {{
      margin-top: 6px;
      text-align: center;
      font-size: 8.5pt;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}

    .signature-section {{
      margin-top: 16px;
      page-break-before: avoid;
      break-before: avoid-page;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .signatures {{ display: grid; gap: 14px; }}
    .signature-row {{ display: grid; gap: 18px; }}
    .signature-row-top {{ grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px;}}
    .signature-row-bottom {{
      grid-template-columns: minmax(240px, 360px);
      justify-content: center;
      margin-top: 24px;

    }}

    .signature-line {{
      margin: 30px 0 8px;
      border-bottom: 1px solid #111827;
      height: 1px;
    }}

    .signature {{
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .signature-name {{
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9.5pt;
      text-align: center;
      line-height: 1.25;
    }}

    .signature-role {{
      font-size: 8.5pt;
      color: var(--muted);
      text-transform: uppercase;
      text-align: center;
      margin-top: 3px;
      line-height: 1.25;
    }}

    .footer-note {{
      margin-top: 16px;
      font-size: 8pt;
      color: #6b7280;
    }}

    @media print {{
      @page {{
        size: Letter;
        margin: 14mm 15mm 14mm 15mm;
      }}

      body {{ background: #fff; padding: 0; }}
      .page {{ box-shadow: none; border: none; border-radius: 0; max-width: none; padding: 0; }}
      .print-layout thead {{ display: table-header-group; }}
      .print-layout tbody {{ display: table-row-group; }}
      .print-header {{
        background: #fff;
        border-bottom: 1px solid #9ca3af;
        padding: 0 0 2.5mm;
        margin-bottom: 4mm;
      }}
      .content {{ margin-top: 0; }}
      h1 {{ margin-top: 0; }}
      .proof-page {{ page-break-after: always; break-after: page; }}
      .proof-page:last-of-type {{ page-break-after: auto; break-after: auto; }}
      .proof-project {{ page-break-inside: avoid; break-inside: avoid-page; }}
      .proof-project {{ padding: 4px; margin-bottom: 4px; }}
      .proof-project h3 {{ margin: 0 0 4px; font-size: 10pt; }}
      .proof-grid {{
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 4px;
        margin-top: 3px;
      }}
      .proof-item {{ padding: 3px; }}
      .proof-item img {{ height: 26mm; aspect-ratio: auto; }}
      .proof-item figcaption {{ margin-top: 1px; font-size: 7.5pt; }}
      .proof-footer {{ margin-top: 3px; font-size: 7.5pt; }}
      .signature-section {{
        margin-top: 18px;
        page-break-before: avoid;
        break-before: avoid-page;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }}
      .signatures {{
        gap: 18px;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }}
      .signature-row {{ gap: 18px; }}
      .signature-row-top {{ margin-top: 16px; }}
      .signature-row-bottom {{ margin-top: 16px; }}
      .signature-line {{ margin: 26px 0 7px; }}
      .signature-name {{ font-size: 8.2pt; }}
      .signature-role {{ font-size: 7.2pt; }}
      .footer-note {{ display: none; }}
    }}

    @media screen and (max-width: 720px) {{
      body {{ padding: 10px; }}
      .page {{ padding: 14px; border-radius: 8px; }}
      .print-header {{ grid-template-columns: 70px 1fr 70px; }}
      .print-header img {{ width: 60px; }}
      .proof-grid {{ grid-template-columns: 1fr; }}
      .signature-row-top, .signature-row-bottom {{ grid-template-columns: 1fr; }}
      th {{ width: 45%; }}
    }}
  </style>
</head>
<body>
  <main class='page'>
    <table class='print-layout'>
      <thead>
        <tr>
          <td>
            <header class='print-header'>
              <div>{left_logo_html}</div>
              <div class='header-lines'>{header_lines}</div>
              <div>{right_logo_html}</div>
            </header>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <section class='content'>
              <h1>{titulo}</h1>

              <section>
                <h2>Datos Generales</h2>
                <table>
                  <tbody>
                    {datos_html}
                  </tbody>
                </table>
              </section>

              <section>
                <h2>Descripcion General de Actividades</h2>
                {descripcion_html}
              </section>

              <section>
                <h2>Actividades Realizadas</h2>
                {''.join(proyectos_parts)}
              </section>

              <section>
                {''.join(proof_pages)}
              </section>

              <p class='footer-note'>Generado desde: {html.escape(str(source_path))}</p>
            </section>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</body>
</html>
"""


def convert_html_to_pdf_chrome(html_path: Path, pdf_path: Path) -> None:
    node_bin = shutil.which("node")
    chrome_bin = shutil.which("google-chrome-stable") or shutil.which("google-chrome")
    runner = Path(__file__).resolve().parent / "chrome_pdf.js"
    if node_bin and runner.exists():
        cmd = [node_bin, str(runner), str(html_path.resolve()), str(pdf_path.resolve())]
        if chrome_bin:
            cmd.append(chrome_bin)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and pdf_path.exists():
            return
        msg = (result.stderr or result.stdout or "Error desconocido").strip()
        raise RuntimeError(f"Fallo Puppeteer: {msg}")

    chrome_bin = shutil.which("google-chrome-stable") or shutil.which("google-chrome")
    if chrome_bin is None:
        raise RuntimeError("No se encontro Google Chrome para generar PDF en formato carta.")

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        chrome_bin,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path.resolve()}",
        html_path.resolve().as_uri(),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "Error desconocido").strip())
    if not pdf_path.exists():
        raise RuntimeError("No se genero el PDF esperado con Google Chrome.")


def convert_html_to_pdf_soffice(html_path: Path, pdf_path: Path) -> None:
    if shutil.which("soffice") is None:
        raise RuntimeError("No se encontro 'soffice'.")

    outdir = pdf_path.parent.resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    cmd = ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(outdir), str(html_path.resolve())]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "Error desconocido").strip())

    generated_pdf = outdir / f"{html_path.stem}.pdf"
    if not generated_pdf.exists():
        raise RuntimeError("No se genero el PDF esperado con soffice.")
    if generated_pdf.resolve() != pdf_path.resolve():
        if pdf_path.exists():
            pdf_path.unlink()
        generated_pdf.replace(pdf_path)


def run() -> int:
    parser = argparse.ArgumentParser(description="Genera reporte mensual HTML y opcionalmente PDF (Carta).")
    parser.add_argument("archivo_md", type=Path, help="Archivo Markdown fuente")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("salida/reporte.html"),
        help="Ruta del archivo HTML de salida",
    )
    parser.add_argument(
        "--pdf",
        action="store_true",
        help="Genera tambien PDF carta. Intenta con Google Chrome y si falla usa LibreOffice.",
    )
    parser.add_argument(
        "--pdf-output",
        type=Path,
        default=None,
        help="Ruta del PDF de salida. Si no se define, usa el mismo nombre del HTML.",
    )
    args = parser.parse_args()

    report = parse_report(args.archivo_md)
    html_out = render_html(report, args.archivo_md.resolve())

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_out, encoding="utf-8")
    print(f"Reporte HTML generado: {args.output}")

    if args.pdf:
        pdf_output = args.pdf_output or args.output.with_suffix(".pdf")
        try:
            convert_html_to_pdf_chrome(args.output, pdf_output)
            print("Motor PDF: Google Chrome")
        except RuntimeError as chrome_err:
            print(f"Aviso: {chrome_err} -> intentando con LibreOffice.")
            convert_html_to_pdf_soffice(args.output, pdf_output)
            print("Motor PDF: LibreOffice (puede usar A4 segun configuracion local)")
        print(f"Reporte PDF generado: {pdf_output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(run())
