# 📸 Guía para usar imágenes en tus reportes

## Ubicación de las imágenes

Coloca todas tus capturas de pantalla y evidencias en:
```
reportes/imagenes/
```

## Cómo referenciarlas en el Markdown

En tu archivo `.md`, usa rutas relativas:

```markdown
![Descripción de la imagen](imagenes/captura1.png)
![Otra evidencia](imagenes/captura2.png)
```

## ✅ Ejemplo completo

**1. Estructura de archivos:**
```
reportes/
├── 2026-04.md          ← Tu reporte
└── imagenes/
    ├── captura1.png    ← Tu evidencia 1
    ├── captura2.png    ← Tu evidencia 2
    └── captura3.png    ← Tu evidencia 3
```

**2. En tu Markdown (2026-04.md):**
```markdown
---
titulo: "Reporte Abril 2026"
nombre: "..."
# ... resto del frontmatter
---

## ACTIVIDADES REALIZADAS

### Proyecto Web
Desarrollo de interfaz gráfica.
* Creación de componentes
* Pruebas de usabilidad

## PROBATORIOS

### Proyecto Web

![Captura de la interfaz principal](imagenes/captura1.png)
![Detalle del componente](imagenes/captura2.png)
![Resultados de pruebas](imagenes/captura3.png)
```

**3. Generar el reporte:**
```bash
npm run generar 2026-04
```

El script automáticamente:
- ✅ Encuentra las imágenes en `reportes/imagenes/`
- ✅ Convierte las rutas relativas a rutas absolutas
- ✅ Las incluye correctamente en el PDF

## 🌐 Alternativa: URLs externas

Si prefieres usar imágenes de internet (requiere conexión):
```markdown
![Evidencia](https://mi-servidor.com/imagen.png)
```

## 💡 Consejos

- **Formatos recomendados:** PNG para capturas, JPG para fotos
- **Tamaño:** Máximo 1920x1080 pixels para buena calidad sin archivos pesados
- **Nombres:** Usa nombres descriptivos: `captura-login.png`, `evidencia-pruebas.png`
- **Organización:** Puedes crear subcarpetas: `imagenes/proyecto1/captura1.png`

## ⚠️ Advertencias

Si ves un mensaje como:
```
⚠️  Advertencia: No se encontró la imagen: imagenes/captura1.png
```

Significa que la imagen no existe. Verifica:
1. Que el archivo esté en `reportes/imagenes/`
2. Que el nombre coincida exactamente (mayúsculas/minúsculas)
3. Que la extensión sea correcta (.png, .jpg, etc.)
