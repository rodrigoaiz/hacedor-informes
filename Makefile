.PHONY: reporte html pdf ayuda

DATA ?= datos/reporte-febrero-2026.md

ayuda:
	@echo "Uso:" 
	@echo "  make reporte DATA=datos/reporte-febrero-2026.md"
	@echo "  make html DATA=datos/reporte-febrero-2026.md"
	@echo "  make pdf DATA=datos/reporte-febrero-2026.md"

html:
	@base=$$(basename "$(notdir $(DATA))" .md); \
	python3 scripts/generar_reporte.py "$(DATA)" -o "salida/$$base.html"

pdf:
	@base=$$(basename "$(notdir $(DATA))" .md); \
	python3 scripts/generar_reporte.py "$(DATA)" -o "salida/$$base.html" --pdf --pdf-output "salida/$$base-carta.pdf"

reporte: pdf
