"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, BarChart3, BookOpen, Boxes, ClipboardCheck, Database, FileText, FlaskConical, GraduationCap, LayoutDashboard, Scale, ShieldCheck, SlidersHorizontal, Workflow, ArrowUpRight } from "lucide-react";
import { Button } from "../components/button";
import { DataExplorer, GroupOptions } from "../components/data-explorer";
import { Explainability, FairnessView, Mitigation, Performance, Robustness, Stat } from "../components/run-views";
import {
  api, defaults, decisionFields, features, governanceFields, modelName, references,
  type Config, type Dataset, type Run, type Scenario, type Summary,
} from "./lab";

const sections = [
  ["overview", "Resumen", LayoutDashboard], ["scenarios", "Escenarios", Boxes],
  ["data", "Explorador de datos", Database], ["performance", "Rendimiento", BarChart3],
  ["fairness", "Equidad", Scale], ["explainability", "Explicabilidad", Workflow],
  ["privacy", "Privacidad y gobernanza", ShieldCheck], ["robustness", "Seguridad y robustez", Activity],
  ["mitigation", "Laboratorio de mitigación", SlidersHorizontal], ["decision", "Decisión ética", ClipboardCheck],
  ["reports", "Informes", FileText], ["method", "Metodología", BookOpen], ["educator", "Modo docente", GraduationCap],
] as const;

type Section = typeof sections[number][0];
const intro: Partial<Record<Section, string>> = {
  scenarios: "Reconoce la decisión automatizada, la población afectada y los supuestos de los datos.",
  data: "Inspecciona los registros sintéticos y contrasta las dos etiquetas disponibles.",
  performance: "Entrena un clasificador y evalúa sus errores en una partición de prueba fija.",
  fairness: "Examina quién recibe recomendaciones y cómo se distribuyen los errores.",
  explainability: "Investiga qué variables usa el modelo para distinguir positivos y negativos.",
  privacy: "Documenta finalidad, procedencia, acceso y controles para el uso de los datos.",
  robustness: "Mide cómo cambian las predicciones ante variaciones numéricas acotadas.",
  mitigation: "Prueba configuraciones alternativas con los mismos datos de evaluación.",
  decision: "Defiende una decisión de despliegue a partir de evidencia y límites explícitos.",
  reports: "Exporta la evidencia, la configuración y la decisión registrada.",
};

const needsRun = new Set<Section>(["performance", "fairness", "explainability", "privacy", "robustness", "mitigation", "decision", "reports"]);
const hasConfig = new Set<Section>(["performance", "fairness", "robustness", "mitigation"]);

function readSection(): Section {
  const hash = window.location.hash.slice(1);
  return sections.find(([id]) => id === hash)?.[0] || "overview";
}

function Writeup({ title, fields, values, decision = false, onSave, disabled }: {
  title: string; fields: Record<string, string>; values: Record<string, string> | null;
  decision?: boolean; onSave: (data: Record<string, string>) => void; disabled: boolean;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(Object.fromEntries(Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value)])));
  }
  return <form className="panel" onSubmit={submit}><h2>{title}</h2>
    {decision && <label>Decisión<select name="outcome" defaultValue={values?.outcome || "Solicitar más evidencia"}>
      {["Desplegar", "Desplegar con condiciones", "Solicitar más evidencia", "No desplegar"].map(item => <option key={item}>{item}</option>)}
    </select></label>}
    <div className="two form-fields">{Object.entries(fields).map(([key, label]) => <label key={key}>{label}
      <textarea name={key} defaultValue={values?.[key] || ""} required={decision} minLength={key === "rationale" ? 10 : undefined} maxLength={decision ? 4000 : 2000} rows={3} />
    </label>)}</div><Button disabled={disabled}>Guardar {decision ? "decisión" : "evaluación"}</Button>
  </form>;
}

export default function Page() {
  const [section, setSection] = useState<Section>("overview");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [config, setConfig] = useState<Config>(defaults);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [teacher, setTeacher] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const scenario = scenarios.find(item => item.id === config.scenario);
  const title = sections.find(([id]) => id === section)?.[1];
  const completed = [
    { id: "data", title: "Explorar los datos", done: !!dataset },
    { id: "performance", title: "Entrenar y medir", done: history.length > 0 },
    { id: "mitigation", title: "Comparar mitigaciones", done: history.some(item => !!item.config.baseline_id) },
    { id: "decision", title: "Argumentar una decisión", done: history.some(item => !!item.decision) },
  ];

  useEffect(() => {
    const sync = () => { setSection(readSection()); setNotice(""); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  async function loadLab() {
    setLoading(true);
    setError("");
    try {
      const [catalog, saved] = await Promise.all([api<Scenario[]>("/scenarios"), api<Summary[]>("/experiments")]);
      setScenarios(catalog);
      setHistory(saved);
      if (saved[0]) {
        const latest = await api<Run>("/experiments/" + saved[0].id);
        setRun(latest);
        setConfig(latest.config);
      }
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadLab(); }, []);

  async function loadData(scenarioId: string) {
    setDataLoading(true);
    setError("");
    try { setDataset(await api<Dataset>(`/scenarios/${scenarioId}/dataset`)); }
    catch (err) { setError((err as Error).message); }
    finally { setDataLoading(false); }
  }

  useEffect(() => {
    if (section === "data" && scenario && !dataset && !dataLoading && !error) void loadData(scenario.id);
  }, [section, scenario, dataset, dataLoading, error]);

  function patch(next: Partial<Config>) {
    setConfig(current => ({ ...current, ...next }));
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function save(kind: "decision" | "governance", values: Record<string, string>) {
    if (!run) return;
    void perform(async () => {
      const saved = await api<Run>(`/experiments/${run.id}/${kind}`, { method: "PUT", body: JSON.stringify(values) });
      setRun(saved);
      setHistory(previous => previous.map(item => item.id === saved.id ? { ...item, [kind]: saved[kind] } : item));
      setNotice(kind === "decision" ? "Decisión guardada." : "Evaluación de gobernanza guardada.");
    });
  }

  function selectRun(id: string) {
    if (!id) return;
    void perform(async () => {
      const next = await api<Run>("/experiments/" + id);
      if (next.config.scenario !== config.scenario) setDataset(null);
      setRun(next);
      setConfig(next.config);
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      const created = await api<Run>("/experiments", { method: "POST", body: JSON.stringify(config) });
      setRun(created);
      setHistory(previous => [created, ...previous]);
      setNotice("Experimento calculado y guardado.");
    });
  }

  const availableBaselines = history.filter(item =>
    item.config.scenario === config.scenario && item.config.target === config.target && item.config.grouping === config.grouping
  );
  const link = run ? `/api/experiments/${run.id}/report` : "";
  let content: ReactNode;

  if (section === "overview") content = <>
    <section className="hero">
      <div className="hero-grid" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><div className="hero-icon"><FlaskConical size={54} strokeWidth={1.35} /></div></div>
      <div className="hero-copy"><span className="eyebrow">LABORATORIO DE ÉTICA APLICADA</span><h1>Evalúa modelos.<br /><em>Defiende decisiones.</em></h1>
        <p>Investiga cómo un modelo de machine learning distribuye oportunidades y errores. Ejecuta experimentos reproducibles y argumenta qué harías con sus resultados.</p>
        <a className="button primary" href="#scenarios">Explorar BecaJusta</a>
      </div>
    </section>
    <div className="stat-grid overview-stats"><Stat label="Escenarios disponibles" value={scenarios.length} /><Stat label="Experimentos guardados" value={history.length} />
      <Stat label="Decisiones registradas" value={history.filter(item => item.decision).length} /><Stat label="Etapas completadas" value={`${completed.filter(item => item.done).length}/${completed.length}`} /></div>
    <div className="two overview-details">
      <section className="panel case"><h2>Escenario disponible</h2><div className="case-icon"><GraduationCap size={24} /></div><h3>BecaJusta</h3>
        <p>Una universidad usa predicciones para recomendar becas. Investiga qué aprende el modelo de unas decisiones históricas sesgadas.</p>
        <a href="#scenarios" className="text-link">Abrir escenario <ArrowUpRight size={15} /></a>
      </section>
      <section className="panel"><h2>Progreso del laboratorio</h2><ol className="steps">{completed.map(item => <li key={item.id}>
        <a href={`#${item.id}`}>{item.title}</a><span className={item.done ? "done" : "muted"}>{item.done ? "Completado" : "Pendiente"}</span>
      </li>)}</ol></section>
    </div>
    <div className="two"><section className="panel"><h2>Riesgos a investigar</h2><ul><li>Sesgo incorporado a la etiqueta histórica.</li><li>Variables que actúan como proxies de zona.</li><li>Recomendaciones sensibles a errores de medición.</li></ul><a className="text-link" href="#method">Consultar metodología</a></section>
    <section className="panel"><h2>Evaluaciones previas</h2>{history.length ? <ul>{history.slice(0, 5).map(item => <li key={item.id}><button className="text-link" disabled={busy} onClick={() => { selectRun(item.id); window.location.hash = "performance"; }}>{modelName(item.config.model)} · {item.id.slice(0, 8)}</button></li>)}</ul> : <p>Los resultados calculados aparecerán después de ejecutar un experimento.</p>}</section></div>
  </>;

  if (section === "scenarios") content = scenarios.map(item => <section className="panel case" key={item.id}><div className="case-icon"><GraduationCap size={25} /></div><h2>{item.name}</h2><h3>{item.title}</h3><p>{item.context}</p><p>{item.construction}</p><p>Versión {item.version} · {item.rows} registros sintéticos · Semilla {item.seed}</p>
    <ul>{item.limitations.map(note => <li key={note}>{note}</li>)}</ul><a className="button primary" href="#data" onClick={() => { if (config.scenario !== item.id) setDataset(null); if (config.scenario !== item.id) patch({ scenario: item.id, features: item.features, baseline_id: null }); }}>Inspeccionar datos</a></section>);
  if (section === "data") content = dataset && scenario ? <DataExplorer key={scenario.id} data={dataset} scenario={scenario} /> :
    <section className="panel"><p>{error ? "No se pudieron cargar los datos." : "Cargando datos sintéticos…"}</p>{error && scenario && <Button onClick={() => loadData(scenario.id)}>Reintentar</Button>}</section>;
  if (section === "method") content = <>
    <section className="panel"><h2>De la pregunta a la decisión</h2><dl>
      <div><dt>Govern</dt><dd>Define responsabilidades, controles humanos y usos permitidos de la evidencia.</dd></div>
      <div><dt>Map</dt><dd>Describe la decisión, la población, los supuestos y los daños plausibles.</dd></div>
      <div><dt>Measure</dt><dd>Documenta resultados calculados, denominadores, contexto y límites de la muestra.</dd></div>
      <div><dt>Manage</dt><dd>Compara intervenciones y registra riesgos residuales, responsables y acciones.</dd></div>
    </dl><p>El laboratorio practica la evaluación de una clasificación binaria sintética. La validez poblacional, la causalidad, la seguridad integral, la conformidad legal y la certificación quedan fuera de su alcance.</p></section>
    <section className="panel"><h2>Cómo leer el análisis</h2><p><strong>Evidencia</strong> identifica qué se midió y con qué configuración. <strong>Interpretación</strong> relaciona el resultado con un daño o beneficio plausible. <strong>Incertidumbre</strong> delimita la calidad de las etiquetas y el soporte de la muestra. <strong>Recomendación</strong> explica qué decisión tomar, quién responde y qué evidencia falta.</p><ul>{Object.entries(references).map(([name, url]) => <li key={name}><a className="text-link" href={url}>{name}</a></li>)}</ul></section>
  </>;
  if (section === "educator") content = <section className="panel">
    <h2>Material docente</h2>{teacher ? <>
      <h3>Objetivos y guía</h3><p>Pide una línea base antes de observar resultados. Después, contrasta etiquetas, investiga proxies y compara una intervención con la misma partición. Cierra con una defensa escrita de la decisión.</p>
      <h3>Discusión</h3><ul><li>¿Qué pierde una persona con una recomendación negativa equivocada?</li><li>¿Cómo cambian las conclusiones al evaluar frente a la elegibilidad?</li><li>¿Qué evidencia pedirías antes de un piloto?</li></ul>
      <h3>Rúbrica</h3><p>Califica de 0 a 2 cada criterio. Otorga 0 si falta, 1 si se menciona y 2 si se justifica con evidencia o un control verificable.</p>
      <ul><li>Reproducibilidad y uso apropiado de etiquetas.</li><li>Interpretación de disparidades e incertidumbre.</li><li>Comparación de mitigaciones y sus costos.</li><li>Decisión, controles humanos y responsables.</li></ul>
      <p>Se espera una justificación coherente con el contexto. Diferentes decisiones pueden ser defendibles.</p>
      <div className="toolbar"><Button variant="outline" onClick={() => { setTeacher(false); setConfirmReset(false); }}>Cerrar material</Button>
        <Button variant="danger" disabled={busy} onClick={() => setConfirmReset(true)}>Restablecer laboratorio</Button></div>
      {confirmReset && <div className="callout"><p>Se eliminarán de SQLite todos los experimentos, decisiones y evaluaciones de gobernanza.</p><div className="toolbar">
        <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancelar</Button>
        <Button variant="danger" disabled={busy} onClick={() => perform(async () => {
          await api("/experiments", { method: "DELETE" });
          setHistory([]); setRun(null); setConfig(defaults); setDataset(null); setConfirmReset(false); setNotice("Laboratorio restablecido.");
        })}>Confirmar restablecimiento</Button></div></div>}
    </> : <><p>Acceso local al material docente y al restablecimiento del laboratorio.</p><Button onClick={() => setTeacher(true)}>Abrir modo docente</Button></>}
  </section>;

  if (needsRun.has(section)) content = <>
    {!!history.length && <div className="run-select"><label>Experimento activo<select disabled={busy} value={run?.id || ""} onChange={e => selectRun(e.target.value)}>
      {history.map(item => <option key={item.id} value={item.id}>{modelName(item.config.model)} · {item.id.slice(0, 8)}{item.decision ? " · Con decisión" : ""}</option>)}
    </select></label>{run && <span className="done">Evidencia calculada</span>}</div>}
    {hasConfig.has(section) && <form className="panel" onSubmit={submit}>
      <h2>Configurar experimento</h2>
      <div className="controls">
        <label>Modelo<select value={config.model} onChange={e => patch({ model: e.target.value as Config["model"] })}><option value="logistic">Logistic Regression</option><option value="forest">Random Forest</option></select></label>
        <label>Etiqueta<select value={config.target} onChange={e => patch({ target: e.target.value as Config["target"], baseline_id: null })}><option value="historica">Adjudicación histórica</option><option value="elegibilidad">Elegibilidad de referencia</option></select></label>
        <label>Agrupación<select value={config.grouping} onChange={e => patch({ grouping: e.target.value as Config["grouping"], baseline_id: null })}><GroupOptions /></select></label>
        <label>Umbral de decisión<input type="number" required min=".01" max=".99" step=".01" value={Number.isNaN(config.threshold) ? "" : config.threshold} onChange={e => patch({ threshold: e.target.valueAsNumber })} /></label>
      </div>
      <details open={section === "mitigation" || section === "robustness"}><summary>Características, mitigación y robustez</summary>
        <fieldset><legend>Variables de entrenamiento</legend><div className="checks">{(scenario?.features || features).map(feature => <label key={feature}><input type="checkbox" checked={config.features.includes(feature)} onChange={e => patch({ features: e.target.checked ? (scenario?.features || features).filter(name => name === feature || config.features.includes(name)) : config.features.filter(item => item !== feature) })} />{feature}</label>)}</div></fieldset>
        <label className="check"><input type="checkbox" checked={config.reweight} onChange={e => patch({ reweight: e.target.checked, fairlearn_grid: e.target.checked ? false : config.fairlearn_grid })} />Reponderar por grupo y etiqueta</label>
        <label className="check"><input type="checkbox" checked={!!config.fairlearn_grid} onChange={e => patch({ fairlearn_grid: e.target.checked, reweight: e.target.checked ? false : config.reweight })} />Fairlearn GridSearch con paridad demográfica</label>
        <p className="muted">GridSearch selecciona un candidato en entrenamiento considerando error y paridad. Su puntuación puede requerir recalibración. Comprueba la disparidad obtenida con el umbral elegido.</p>
        <div className="controls"><label>Línea base<select value={config.baseline_id || ""} onChange={e => patch({ baseline_id: e.target.value || null })}><option value="">Sin comparación</option>
          {availableBaselines.map(item => <option key={item.id} value={item.id}>{modelName(item.config.model)} · {item.id.slice(0, 8)}</option>)}</select></label>
          <label>Perturbación (% del rango)<input type="number" required min="0" max="20" step="1" value={Number.isNaN(config.perturbation) ? "" : Math.round(config.perturbation * 100)} onChange={e => patch({ perturbation: e.target.valueAsNumber / 100 })} /></label></div>
      </details>
      <Button disabled={busy || loading || !scenario || !config.features.length}>{busy ? "Calculando…" : "Ejecutar experimento"}</Button>
    </form>}
    {!run && <section className="panel"><h2>Evidencia disponible</h2><p>Ejecuta un experimento para consultar resultados calculados.</p>{!hasConfig.has(section) && <a href="#performance" className="button primary">Configurar modelo</a>}</section>}
    {run && section === "performance" && <Performance run={run} />}
    {run && section === "fairness" && <FairnessView run={run} />}
    {run && section === "explainability" && <Explainability key={run.id} run={run} />}
    {run && section === "robustness" && <Robustness run={run} />}
    {run && section === "mitigation" && <Mitigation run={run} />}
    {run && section === "privacy" && <>
      <section className="panel"><h2>Inventario y controles</h2><p>Género y zona son atributos sensibles simulados. Ingreso, distancia y acceso digital podrían facilitar la vinculación de registros en una población real. Los identificadores de fila son sintéticos.</p><ul>
        <li>Limitar variables a la finalidad aprobada y separar los atributos de auditoría.</li><li>Revisar la procedencia y el permiso de uso antes de incorporar datos reales.</li>
        <li>Definir plazos de conservación y un procedimiento de eliminación.</li><li>Asignar permisos, registrar acceso y responsabilizar a una persona de la revisión periódica.</li>
      </ul></section>
      <Writeup key={run.id + "privacy"} title="Evaluación guiada" fields={governanceFields} values={run.governance} onSave={values => save("governance", values)} disabled={busy} />
    </>}
    {run && section === "decision" && <>
      <section className="panel"><h2>Preguntas de reflexión</h2><ul><li>¿Qué evidencia respalda la decisión y qué supuesto podría cambiarla?</li><li>¿Quién asume el costo de falsos negativos o falsos positivos?</li><li>¿Cómo impugnaría una persona una recomendación y quién revisaría su caso?</li></ul></section>
      <Writeup key={run.id + "decision"} title="Registro de decisión" fields={decisionFields} values={run.decision} decision onSave={values => save("decision", values)} disabled={busy} />
    </>}
    {run && section === "reports" && <section className="panel"><h2>Informe de evaluación</h2><p>{run.scenario.name} · {modelName(run.config.model)} · <code>{run.id}</code></p>
      <p>{run.decision ? `Decisión registrada: ${run.decision.outcome}` : "La decisión sigue pendiente. El informe indicará su estado."}</p>
      <div className="toolbar"><a className="button primary" href={link + "?format=md"} download>Descargar Markdown</a><a className="button outline" href={link + "?format=json"} download>Descargar JSON</a><a className="button outline" href={`/report?id=${run.id}`}>Vista imprimible</a></div>
    </section>}
    {run && <details className="panel"><summary>Configuración y reproducción · {run.id.slice(0, 8)}</summary><pre>{JSON.stringify({ config: run.config, ...run.evaluation }, null, 2)}</pre></details>}
  </>;

  return <div className="shell">
    <a className="skip" href="#main">Ir al contenido</a>
    <aside className="sidebar"><a className="brand" href="#overview"><span className="brand-icon"><FlaskConical size={21} /></span><span>EthicML <b>Lab</b><small>Ética aplicada a ML</small></span></a>
      <nav aria-label="Navegación del laboratorio">{sections.map(([id, label, Icon]) => <a key={id} href={`#${id}`} aria-current={section === id ? "page" : undefined}><Icon size={18} strokeWidth={1.7} />{label}</a>)}</nav>
      <div className="sidebar-foot"><span /> Entorno local</div>
    </aside>
    <div className="main-column"><header className="topbar"><span>Laboratorio <b>/</b> {title}</span><span className="local"><span /> Datos sintéticos</span></header>
      <main id="main" tabIndex={-1}>
        {section !== "overview" && <header className="page-heading"><h1>{title}</h1>{intro[section] && <p>{intro[section]}</p>}</header>}
        {loading && <p role="status" className="callout">Cargando laboratorio…</p>}
        {notice && <p role="status" className="callout">{notice}</p>}
        {error && <div role="alert" className="callout error">{error} {(!scenarios.length || !history.length && section === "overview") && <Button variant="outline" onClick={loadLab}>Reintentar</Button>}</div>}
        {content}
      </main>
    </div>
  </div>;
}
