const { z } = require('zod');

const firmaSchema = z.object({
  nombre: z.string().trim().min(1, 'Cada firma requiere nombre.'),
  cargo: z.string().trim().min(1, 'Cada firma requiere cargo.'),
});

const probatorioSchema = z.object({
  titulo: z.string().trim().optional().default(''),
  fileField: z.string().trim().optional().default(''),
});

const proyectoSchema = z.object({
  nombre: z.string().trim().min(1, 'Cada proyecto requiere nombre.'),
  descripcion: z.string().trim().optional().default(''),
  actividades: z.array(z.string().trim()).min(1, 'Cada proyecto requiere actividades.'),
  probatorios: z.array(probatorioSchema).default([]),
});

const reportInputSchema = z.object({
  titulo: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  correo: z.string().trim().email(),
  telefono: z.string().trim().min(1),
  jefe: z.string().trim().min(1),
  fecha: z.string().trim().min(1),
  periodo: z.string().trim().min(1),
  rfc: z.string().trim().min(1),
  descripcionGeneral: z.string().trim().min(1),
  proyectos: z.array(proyectoSchema).min(1, 'Debes capturar al menos un proyecto.'),
  firmas: z.tuple([firmaSchema, firmaSchema, firmaSchema]),
});

function normalizeStructuredInput(rawInput) {
  const parsed = reportInputSchema.parse(rawInput);

  return {
    ...parsed,
    proyectos: parsed.proyectos.map((proyecto) => ({
      ...proyecto,
      descripcion: proyecto.descripcion || '',
      actividades: proyecto.actividades.map((actividad) => actividad.trim()).filter(Boolean),
      probatorios: proyecto.probatorios
        .map((probatorio, index) => ({
          titulo: probatorio.titulo || `Probatorio ${index + 1}`,
          fileField: probatorio.fileField || '',
        }))
        .filter((probatorio) => probatorio.fileField),
    })),
  };
}

module.exports = {
  normalizeStructuredInput,
  reportInputSchema,
};
