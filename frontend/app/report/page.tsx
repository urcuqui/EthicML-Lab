"use client";

import { useEffect, useState } from "react";
import { Button } from "../../components/button";
import { FairnessView, Mitigation, Performance, Robustness } from "../../components/run-views";
import { api, decisionFields, governanceFields, modelName, type Run } from "../lab";

type Report = Run & { references: Record<string, string> };

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
      setError("Identificador de experimento inválido.");
      return;
    }
    api<Report>(`/experiments/${id}/report?format=view`).then(setReport).catch(err => setError(err.message));
  }, []);
  return <main className="print-report">
    <div className="toolbar no-print"><a href="/#reports" className="button outline">Volver a informes</a><Button disabled={!report} onClick={() => window.print()}>Imprimir informe</Button></div>
    {error ? <p role="alert">{error}</p> : !report ? <p role="status">Cargando informe…</p> : <>
      <header><h1>{report.scenario.name} · Informe de evaluación</h1><p>{modelName(report.config.model)} · {report.id} · {report.created_at}</p></header>
      <section className="panel"><h2>Escenario y riesgos</h2><p>{report.scenario.context}</p><p>{report.scenario.construction}</p><ul>{report.scenario.limitations.map(note => <li key={note}>{note}</li>)}</ul></section>
      <Performance run={report} /><FairnessView run={report} /><Mitigation run={report} /><Robustness run={report} />
      <section className="panel"><h2>Explicabilidad</h2><p>{report.explainability.method}</p><pre>{JSON.stringify({ global: report.explainability.global, por_grupo: report.explainability.by_group }, null, 2)}</pre></section>
      <section className="panel"><h2>Gobernanza</h2>{report.governance ? <dl>{Object.entries(governanceFields).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{report.governance?.[key] || "Pendiente"}</dd></div>)}</dl> : <p>Evaluación pendiente.</p>}</section>
      <section className="panel"><h2>Decisión y acciones pendientes</h2>{report.decision ? <><h3>{report.decision.outcome}</h3><dl>{Object.entries(decisionFields).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{report.decision?.[key]}</dd></div>)}</dl></> : <p>Decisión pendiente.</p>}</section>
      <section className="panel"><h2>Reproducibilidad</h2><pre>{JSON.stringify({ config: report.config, ...report.evaluation }, null, 2)}</pre></section>
      <section className="panel"><h2>Referencias metodológicas</h2><ul>{Object.entries(report.references).map(([name, url]) => <li key={name}><a href={url}>{name}</a></li>)}</ul></section>
    </>}
  </main>;
}
