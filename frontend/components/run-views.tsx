"use client";

import { useState } from "react";
import { Bars, Comparison, MetricTable } from "./evidence";
import { decimal, modelName, percent, type Metric, type Run } from "../app/lab";

const performanceFields: Metric[] = ["accuracy", "precision", "recall", "f1", "roc_auc"];
const fairnessFields: Metric[] = ["selection_rate", "tpr", "fpr", "fnr"];

export function Stat({ label, value }: { label: string; value: string | number }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

export function Performance({ run }: { run: Run }) {
  const p = run.performance;
  return <>
    <div className="stat-grid"><Stat label="Exactitud" value={percent(p.accuracy)} /><Stat label="Precisión" value={percent(p.precision)} /><Stat label="Sensibilidad" value={percent(p.recall)} /><Stat label="ROC-AUC" value={decimal(p.roc_auc)} /></div>
    <section className="panel"><h2>Matriz de confusión</h2><p>{modelName(run.config.model)} · Umbral {run.config.threshold} · Etiqueta {run.config.target}</p>
      <div className="table-wrap"><table><thead><tr><th>Etiqueta observada</th><th>Predicción negativa</th><th>Predicción positiva</th></tr></thead><tbody>
        <tr><th scope="row">Negativa</th><td>{p.tn} VN</td><td>{p.fp} FP</td></tr><tr><th scope="row">Positiva</th><td>{p.fn} FN</td><td>{p.tp} VP</td></tr></tbody></table></div>
    </section>
    <section className="panel"><h2>Desempeño global y por grupo</h2><MetricTable rows={{ Global: p, ...run.fairness.groups }} fields={performanceFields} />
      <p className="muted">En F1, el denominador es 2VP + FP + FN. En ROC-AUC, es el número de pares positivo-negativo. La partición fija está estratificada por adjudicación histórica.</p></section>
    <section className="panel"><h2>Las mismas predicciones frente a ambas etiquetas</h2><MetricTable rows={run.reference_comparison} fields={performanceFields} />
      <p>La elegibilidad es una referencia hipotética. Las métricas describen acuerdo predictivo con cada etiqueta.</p></section>
  </>;
}

export function FairnessView({ run }: { run: Run }) {
  const result = run.fairness;
  const rows = Object.entries(result.groups).map(([group, metrics]) => ({ group, selection_rate: metrics.selection_rate, tpr: metrics.tpr, fpr: metrics.fpr, fnr: metrics.fnr }));
  return <>
    <div className="stat-grid"><Stat label="Diferencia de paridad demográfica" value={decimal(result.dp_difference)} /><Stat label="Diferencia de odds igualadas" value={decimal(result.eo_difference)} /><Stat label="Prueba" value={run.performance.n} /></div>
    <section className="panel"><h2>Tasas por grupo · {run.config.grouping}</h2>
      <Bars data={rows} category="group" label="Tasas de selección y error por grupo" percentAxis series={[{key:"selection_rate", title:"Selección"},{key:"tpr", title:"Verdaderos positivos"},{key:"fpr", title:"Falsos positivos"},{key:"fnr", title:"Falsos negativos"}]} />
      <MetricTable rows={result.groups} fields={fairnessFields} /><p>{result.support_rule} N/D indica evidencia insuficiente o métrica indefinida.</p></section>
    <section className="panel"><h2>Interpretación y límites</h2><ul>
      <li>La paridad demográfica mide la mayor diferencia de selección entre grupos. Puede ser inadecuada cuando igualar selecciones oculta necesidades o consecuencias distintas.</li>
      <li>Odds igualadas toma la mayor brecha entre las tasas de verdaderos y falsos positivos. Depende de la calidad de la etiqueta usada para separar positivos y negativos.</li>
      <li>Con tasas de base distintas, igualar los errores puede dejar tasas de selección distintas. Define qué daño importa y revisa a quién afecta.</li>
      <li>Una brecha describe un patrón en esta muestra. Para juzgarlo, considera el propósito, la etiqueta, el tamaño del grupo y el contexto de asignación.</li>
    </ul></section>
  </>;
}

export function Explainability({ run }: { run: Run }) {
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const result = run.explainability;
  const importance = group ? result.by_group[group] : result.global;
  const cases = result.observations.filter(row => !group || group === row.group);
  const item = cases.find(row => row.id === selected) || cases[0];
  return <>
    <section className="panel"><h2>Importancia por permutación</h2><p>{result.method}</p>
      <label>Subconjunto<select value={group} onChange={e => { setGroup(e.target.value); setSelected(null); }}><option value="">Toda la prueba</option>{Object.keys(result.by_group).map(name => <option key={name}>{name}</option>)}</select></label>
      <Bars data={importance} category="feature" label="Caída de ROC-AUC al permutar" series={[{ key: "mean", title: "Caída media de ROC-AUC" }]} />
      <div className="table-wrap"><table><thead><tr><th>Variable</th><th>Caída media de ROC-AUC</th><th>Desviación entre permutaciones</th></tr></thead><tbody>
        {importance.map(row => <tr key={row.feature}><th scope="row">{row.feature}</th><td>{decimal(row.mean)}</td><td>{decimal(row.std)}</td></tr>)}</tbody></table></div>
      <p>Los grupos con poco soporte se omiten. Las variables correlacionadas pueden sustituirse entre sí y alterar las importancias. Estas asociaciones predictivas por sí solas no demuestran causalidad ni justicia.</p>
    </section>
    {item && <section className="panel"><h2>Inspección individual</h2><label>Observación de prueba<select value={item.id} onChange={e => setSelected(Number(e.target.value))}>{cases.map(row => <option key={row.id} value={row.id}>Fila {row.id} · {row.group}</option>)}</select></label>
      <p>Puntuación positiva {percent(item.score)} · {item.score >= run.config.threshold ? "Recomendar" : "No recomendar"}</p>
      <div className="table-wrap"><table><thead><tr><th>Variable</th><th>Valor original</th><th>Δ de puntuación original − sustitución</th></tr></thead><tbody>
        {Object.entries(item.deltas).map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{item.values[name as keyof typeof item.values] ?? "Faltante"}</td><td>{decimal(value ?? null)}</td></tr>)}</tbody></table></div></section>}
  </>;
}

export function Robustness({ run }: { run: Run }) {
  const r = run.robustness;
  return <><div className="stat-grid"><Stat label="Predicciones que cambian" value={percent(r.flip_rate)} /><Stat label="Cambio absoluto medio de puntuación" value={percent(r.mean_score_change)} /><Stat label="Confianza media original" value={percent(r.mean_confidence_before)} /><Stat label="Confianza media perturbada" value={percent(r.mean_confidence_after)} /></div>
    <section className="panel"><h2>Prueba de sensibilidad</h2><p>Ruido uniforme hasta ±{percent(r.magnitude)} del rango de cada variable continua incluida, con recorte a los límites del dominio. Semilla {r.seed}. Variables: {r.features.join(", ") || "ninguna"}.</p>
      <p>La confianza se resume como la media de max(p, 1 − p). Esta prueba describe sensibilidad bajo la perturbación especificada. Una evaluación exhaustiva requeriría otros escenarios.</p>
      <MetricTable rows={{ Original: run.performance, Perturbado: r.after }} fields={performanceFields} /></section></>;
}

export function Mitigation({ run }: { run: Run }) {
  return <section className="panel"><h2>Comparación de experimentos</h2>{run.baseline ? <>
    <p>Línea base: {modelName(run.baseline.config.model)} · <code>{run.baseline.id}</code></p>
    <p>Actual: {modelName(run.config.model)} · <code>{run.id}</code></p>
    <Comparison run={run} baseline={run.baseline} />
    <h3>Errores por grupo</h3><MetricTable rows={Object.fromEntries([
      ...Object.entries(run.baseline.fairness.groups).map(([name, row]) => [`${name} · Base`, row]),
      ...Object.entries(run.fairness.groups).map(([name, row]) => [`${name} · Actual`, row]),
    ])} fields={fairnessFields} />
  </> : <p>Selecciona una línea base en la configuración. Puedes excluir variables, cambiar de modelo, ajustar el umbral o reponderar las combinaciones de grupo y etiqueta con frecuencias del entrenamiento.</p>}</section>;
}
