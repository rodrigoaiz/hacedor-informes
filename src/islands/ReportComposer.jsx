import React, { useMemo, useState } from 'react';

function createId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEvidence(index = 0) {
  return {
    id: createId(),
    titulo: `Probatorio ${index + 1}`,
    file: null,
    previewUrl: '',
  };
}

const seedProject = () => ({
  id: createId(),
  nombre: '',
  descripcion: '',
  actividades: [''],
  probatorios: [createEvidence(0), createEvidence(1), createEvidence(2), createEvidence(3)],
});

const seedReport = {
  titulo: 'Reporte Mensual',
  nombre: '',
  correo: '',
  telefono: '',
  jefe: 'Joel Villamar Chulin',
  fecha: new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  periodo: '',
  rfc: '',
  descripcionGeneral: '',
  firmas: [
    { nombre: '', cargo: '' },
    { nombre: 'Lic. Joel Villamar Chulin', cargo: 'Coordinador de Diseño Web e Integración' },
    { nombre: 'Dra. Lilia Macedo de la Concha', cargo: 'Secretaria SUAYED' },
  ],
  proyectos: [seedProject()],
};

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function textInputClass() {
  return 'input-surface';
}

export default function ReportComposer() {
  const [report, setReport] = useState(seedReport);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const projectCount = report.proyectos.length;
  const activityCount = useMemo(
    () => report.proyectos.reduce((total, project) => total + project.actividades.filter(Boolean).length, 0),
    [report.proyectos]
  );
  const evidenceCount = useMemo(
    () => report.proyectos.reduce((total, project) => total + project.probatorios.filter((item) => item.file).length, 0),
    [report.proyectos]
  );

  function updateField(field, value) {
    setReport((current) => ({ ...current, [field]: value }));
  }

  function updateFirma(index, field, value) {
    setReport((current) => ({
      ...current,
      firmas: current.firmas.map((firma, firmaIndex) =>
        firmaIndex === index ? { ...firma, [field]: value } : firma
      ),
    }));
  }

  function updateProject(projectId, updater) {
    setReport((current) => ({
      ...current,
      proyectos: current.proyectos.map((project) => (project.id === projectId ? updater(project) : project)),
    }));
  }

  function addProject() {
    setReport((current) => ({ ...current, proyectos: [...current.proyectos, seedProject()] }));
  }

  function removeProject(projectId) {
    setReport((current) => ({
      ...current,
      proyectos: current.proyectos.length === 1 ? current.proyectos : current.proyectos.filter((project) => project.id !== projectId),
    }));
  }

  function addActivity(projectId) {
    updateProject(projectId, (project) => ({ ...project, actividades: [...project.actividades, ''] }));
  }

  function updateActivity(projectId, activityIndex, value) {
    updateProject(projectId, (project) => ({
      ...project,
      actividades: project.actividades.map((activity, index) => (index === activityIndex ? value : activity)),
    }));
  }

  function removeActivity(projectId, activityIndex) {
    updateProject(projectId, (project) => ({
      ...project,
      actividades:
        project.actividades.length === 1
          ? project.actividades
          : project.actividades.filter((_, index) => index !== activityIndex),
    }));
  }

  function addEvidence(projectId) {
    updateProject(projectId, (project) => ({
      ...project,
      probatorios: [...project.probatorios, createEvidence(project.probatorios.length)],
    }));
  }

  function updateEvidence(projectId, evidenceId, updater) {
    updateProject(projectId, (project) => ({
      ...project,
      probatorios: project.probatorios.map((probatorio) =>
        probatorio.id === evidenceId ? updater(probatorio) : probatorio
      ),
    }));
  }

  function removeEvidence(projectId, evidenceId) {
    updateProject(projectId, (project) => ({
      ...project,
      probatorios: project.probatorios.filter((probatorio) => probatorio.id !== evidenceId),
    }));
  }

  function onFileChange(projectId, evidenceId, file) {
    if (!file) {
      updateEvidence(projectId, evidenceId, (probatorio) => ({ ...probatorio, file: null, previewUrl: '' }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    updateEvidence(projectId, evidenceId, (probatorio) => ({ ...probatorio, file, previewUrl }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Generando PDF, esto puede tardar unos segundos...' });

    try {
      const formData = new FormData();
      const reportData = {
        ...report,
        proyectos: report.proyectos.map((project) => ({
          nombre: project.nombre,
          descripcion: project.descripcion,
          actividades: project.actividades,
          probatorios: project.probatorios.map((probatorio) => ({
            titulo: probatorio.titulo,
            fileField: probatorio.id,
          })),
        })),
      };

      formData.append('reportData', JSON.stringify(reportData));

      report.proyectos.forEach((project) => {
        project.probatorios.forEach((probatorio) => {
          if (probatorio.file) {
            formData.append('probatorios', probatorio.file, `${probatorio.id}__${probatorio.file.name}`);
          }
        });
      });

      const response = await fetch('/api/reportes/generar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo generar el reporte.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(report.periodo || 'reporte').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', message: 'PDF generado y descargado correctamente.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ocurrio un error al generar el reporte.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusClass =
    status.type === 'error'
      ? 'bg-[var(--error-bg)] text-[var(--error-ink)]'
      : status.type === 'success'
        ? 'bg-[var(--success-bg)] text-[var(--success-ink)]'
        : 'status-idle';

  return (
    <section className="grid gap-6 pb-10 xl:grid-cols-[1.25fr_0.75fr]">
      <form className="grid gap-6" onSubmit={handleSubmit}>
        <section className="panel-surface">
          <div className="section-heading">
            <p className="eyebrow">Datos generales</p>
            <h2 className="section-title">Cabecera del informe</h2>
            <p className="section-copy">Captura los datos institucionales que aparecerán en la portada y tabla informativa.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titulo del reporte">
              <input className={textInputClass()} value={report.titulo} onChange={(e) => updateField('titulo', e.target.value)} required />
            </Field>
            <Field label="Periodo a reportar" hint="Ejemplo: 1 de abril al 30 de abril de 2026">
              <input className={textInputClass()} value={report.periodo} onChange={(e) => updateField('periodo', e.target.value)} required />
            </Field>
            <Field label="Nombre completo">
              <input className={textInputClass()} value={report.nombre} onChange={(e) => updateField('nombre', e.target.value)} required />
            </Field>
            <Field label="RFC">
              <input className={textInputClass()} value={report.rfc} onChange={(e) => updateField('rfc', e.target.value)} required />
            </Field>
            <Field label="Correo institucional">
              <input className={textInputClass()} type="email" value={report.correo} onChange={(e) => updateField('correo', e.target.value)} required />
            </Field>
            <Field label="Telefono">
              <input className={textInputClass()} value={report.telefono} onChange={(e) => updateField('telefono', e.target.value)} required />
            </Field>
            <Field label="Jefe inmediato">
              <input className={textInputClass()} value={report.jefe} onChange={(e) => updateField('jefe', e.target.value)} required />
            </Field>
            <Field label="Fecha de emision">
              <input className={textInputClass()} value={report.fecha} onChange={(e) => updateField('fecha', e.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="panel-surface">
          <div className="section-heading">
            <p className="eyebrow">Narrativa base</p>
            <h2 className="section-title">Descripcion general</h2>
            <p className="section-copy">Resume el contexto del mes y el tipo de trabajo realizado.</p>
          </div>

          <Field label="Descripcion general">
            <textarea
              className={`${textInputClass()} min-h-40 resize-y`}
              value={report.descripcionGeneral}
              onChange={(e) => updateField('descripcionGeneral', e.target.value)}
              required
            />
          </Field>
        </section>

        <section className="panel-surface">
          <div className="section-heading">
            <p className="eyebrow">Contenido del reporte</p>
            <h2 className="section-title">Proyectos y actividades</h2>
            <p className="section-copy">Cada bloque genera una subseccion del informe y puede incluir probatorios asociados.</p>
          </div>

          <div className="grid gap-6">
            {report.proyectos.map((project, projectIndex) => (
              <article key={project.id} className="project-shell">
                <div className="project-shell-header">
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '1.75rem',
                        height: '1.75rem',
                        borderRadius: '0.45rem',
                        background: 'var(--accent)',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      {projectIndex + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)] opacity-80">Proyecto {projectIndex + 1}</p>
                      <p className="text-sm text-[var(--ink-soft)]">Define actividades y evidencias del bloque.</p>
                    </div>
                  </div>
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => removeProject(project.id)}
                  >
                    Eliminar proyecto
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre del proyecto">
                    <input
                      className={textInputClass()}
                      value={project.nombre}
                      onChange={(e) => updateProject(project.id, (current) => ({ ...current, nombre: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Descripcion breve" hint="Opcional; se coloca antes de las actividades.">
                    <input
                      className={textInputClass()}
                      value={project.descripcion}
                      onChange={(e) => updateProject(project.id, (current) => ({ ...current, descripcion: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Actividades</p>
                    <button className="action-button" type="button" onClick={() => addActivity(project.id)}>
                      Agregar actividad
                    </button>
                  </div>
                  {project.actividades.map((activity, activityIndex) => (
                    <div key={`${project.id}-${activityIndex}`} className="flex gap-3">
                      <input
                        className={`${textInputClass()} flex-1`}
                        placeholder="Describe una actividad realizada"
                        value={activity}
                        onChange={(e) => updateActivity(project.id, activityIndex, e.target.value)}
                        required
                      />
                      <button className="icon-button" type="button" onClick={() => removeActivity(project.id, activityIndex)}>
                        −
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Probatorios</p>
                  </div>

                  {project.probatorios.length === 0 ? (
                    <div className="soft-note">
                      Aun no agregas evidencias para este proyecto.
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    {project.probatorios.map((probatorio) => (
                      <div key={probatorio.id} className="rounded-[0.9rem] border p-4" style={{ borderColor: 'var(--line-soft)', background: 'white' }}>
                        <Field label="Titulo del probatorio">
                          <input
                            className={textInputClass()}
                            value={probatorio.titulo}
                            onChange={(e) =>
                              updateEvidence(project.id, probatorio.id, (current) => ({ ...current, titulo: e.target.value }))
                            }
                          />
                        </Field>

                        <div className="mt-3 flex items-start gap-4 rounded-[0.85rem] border border-dashed px-4 py-4 transition" style={{ borderColor: 'oklch(0.42 0.09 214 / 0.28)', background: 'var(--accent-subtle)' }}>
                          <label className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 text-sm text-[var(--ink-soft)]">
                            <span className="font-semibold text-[var(--ink-strong)]">Seleccionar imagen</span>
                            <input
                              className="hidden"
                              type="file"
                              accept="image/*"
                              onChange={(e) => onFileChange(project.id, probatorio.id, e.target.files?.[0] ?? null)}
                            />
                            <span>PNG, JPG o WEBP.</span>
                          </label>

                          <button
                            className="thumbnail-shell"
                            type="button"
                            onClick={() => probatorio.previewUrl && setLightbox({ src: probatorio.previewUrl, title: probatorio.titulo })}
                            disabled={!probatorio.previewUrl}
                            title={probatorio.previewUrl ? 'Ver imagen grande' : 'Sin imagen cargada'}
                          >
                            {probatorio.previewUrl ? (
                              <img
                                alt={probatorio.titulo || 'Vista previa del probatorio'}
                                className="h-full w-full rounded-[0.9rem] object-cover"
                                src={probatorio.previewUrl}
                              />
                            ) : (
                              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', opacity: 0.5 }}>Sin imagen</span>
                            )}
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="text-xs leading-5 text-[var(--ink-soft)]">
                            {probatorio.previewUrl ? 'Haz clic en la miniatura para ampliar.' : 'Puedes dejar este probatorio vacio sin afectar la generacion.'}
                          </span>
                          <button
                            className="text-sm font-semibold transition"
                            style={{ color: 'var(--accent)' }}
                            type="button"
                            onClick={() => removeEvidence(project.id, probatorio.id)}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <button className="action-button" type="button" onClick={() => addEvidence(project.id)}>
                      Agregar probatorio
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5">
            <button className="action-button" type="button" onClick={addProject}>
              Agregar proyecto
            </button>
          </div>
        </section>

        <section className="panel-surface">
          <div className="section-heading">
            <p className="eyebrow">Cierre institucional</p>
            <h2 className="section-title">Firmantes</h2>
            <p className="section-copy">Se muestran al pie del documento final.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {report.firmas.map((firma, index) => (
              <div key={`firma-${index}`} className="grid gap-3 rounded-[0.9rem] border p-4" style={{ borderColor: 'var(--line-soft)', background: 'var(--accent-subtle)' }}>
                <Field label="Nombre">
                  <input className={textInputClass()} value={firma.nombre} onChange={(e) => updateFirma(index, 'nombre', e.target.value)} required />
                </Field>
                <Field label="Cargo">
                  <input className={textInputClass()} value={firma.cargo} onChange={(e) => updateFirma(index, 'cargo', e.target.value)} required />
                </Field>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Generando...' : 'Generar PDF'}
          </button>
          <p className="text-sm leading-6 text-[var(--ink-soft)]">El archivo se descargará al terminar la generación.</p>
        </div>
      </form>

      <aside className="grid gap-6 self-start xl:sticky xl:top-6">
        <section className="panel-surface">
          <p className="eyebrow">Resumen rapido</p>
          <h2 className="section-title">Estado del reporte</h2>
          <div className="mt-5 grid gap-3">
            <div className="summary-row">
              <span>Proyectos</span>
              <strong>{projectCount}</strong>
            </div>
            <div className="summary-row">
              <span>Actividades con texto</span>
              <strong>{activityCount}</strong>
            </div>
            <div className="summary-row">
              <span>Probatorios cargados</span>
              <strong>{evidenceCount}</strong>
            </div>
          </div>
        </section>

        <section className="panel-surface">
          <p className="eyebrow">Validacion</p>
          <h2 className="section-title">Señal del sistema</h2>
          <div className={`status-panel ${statusClass}`}>
            {status.message || 'Completa el formulario y genera el PDF cuando estés listo.'}
          </div>
        </section>

        <section className="panel-surface">
          <p className="eyebrow">Notas</p>
          <ul className="grid gap-3 text-sm leading-6 text-[var(--ink-soft)]">
            <li>Usa una descripcion general breve y ejecutiva.</li>
            <li>Procura que cada proyecto tenga al menos una actividad concreta.</li>
            <li>Las evidencias con mejor resolucion suelen producir un PDF mas limpio.</li>
          </ul>
        </section>

        <section className="panel-surface">
          <p className="eyebrow">Formato</p>
          <h2 className="section-title">Criterio de salida</h2>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            El documento se genera en PDF con el formato institucional actual y queda listo para revision o entrega.
          </p>
        </section>
      </aside>

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,32,41,0.68)] px-4 py-6" onClick={() => setLightbox(null)}>
          <div className="max-h-[92vh] w-full max-w-4xl rounded-[1rem] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-[var(--ink-strong)]">{lightbox.title || 'Probatorio'}</p>
              <button className="action-button" type="button" onClick={() => setLightbox(null)}>
                Cerrar
              </button>
            </div>
            <img alt={lightbox.title || 'Vista ampliada'} className="max-h-[80vh] w-full rounded-[1rem] object-contain" src={lightbox.src} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
