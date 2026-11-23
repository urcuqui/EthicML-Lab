"use client";

import { useMemo, useState } from "react";
import { Button } from "./button";
import { Bars } from "./evidence";
import { decimal, percent, type Dataset, type Feature, type Group, type Scenario } from "../app/lab";

export function GroupOptions() {
  return <><option value="zona">Zona</option><option value="genero">Género simulado</option><option value="interseccion">Género × zona</option></>;
}

export function DataExplorer({ data, scenario }: { data: Dataset; scenario: Scenario }) {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<Group>("zona");
  const [subgroup, setSubgroup] = useState("");
  const [feature, setFeature] = useState<Feature>(scenario.features[0]);
  const [page, setPage] = useState(0);
  const features = scenario.features;
  const histograms = data.group_distributions[group];
  const frequencies = subgroup ? histograms[subgroup][feature] : data.distributions[feature];
  const columns = Object.keys(scenario.variables);
  const filtered = useMemo(() => data.rows.filter(row =>
    (!zone || row.zona === zone) && (!label || String(row.historica) === label) &&
    Object.values(row).some(value => String(value ?? "faltante").toLowerCase().includes(query.trim().toLowerCase()))
  ), [data, zone, label, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  return <>
    <div className="stat-grid">
      <article><span>Filas sintéticas</span><strong>{data.rows.length}</strong></article>
      <article><span>Adjudicación histórica positiva</span><strong>{percent(data.labels.historica / data.rows.length)}</strong></article>
      <article><span>Elegibilidad positiva</span><strong>{percent(data.labels.elegibilidad / data.rows.length)}</strong></article>
      <article><span>Acuerdo entre etiquetas</span><strong>{percent(data.label_agreement)}</strong></article>
    </div>
    <section className="panel"><h2>Registros</h2>
      <div className="controls">
        <label>Buscar<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="ID, valores o faltante" /></label>
        <label>Zona<select value={zone} onChange={e => { setZone(e.target.value); setPage(0); }}><option value="">Todas</option><option value="urbana">Urbana</option><option value="rural">Rural</option></select></label>
        <label>Adjudicación histórica<select value={label} onChange={e => { setLabel(e.target.value); setPage(0); }}><option value="">Todas</option><option value="1">Positiva</option><option value="0">Negativa</option></select></label>
      </div>
      <div className="table-wrap"><table><thead><tr>{columns.map(key => <th key={key} scope="col">{key}</th>)}</tr></thead>
        <tbody>{filtered.slice(page * 12, (page + 1) * 12).map(row => <tr key={row.id}>{columns.map(key => <td key={key}>{row[key] ?? "—"}</td>)}</tr>)}</tbody></table></div>
      <div className="toolbar"><span>{filtered.length} filas · Página {page + 1} de {pages}</span><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </section>
    <div className="two">
      <section className="panel"><h2>Distribución</h2><label>Variable<select value={feature} onChange={e => setFeature(e.target.value as Feature)}>{features.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Subgrupo de distribución<select value={subgroup} onChange={e => setSubgroup(e.target.value)}><option value="">Todos los registros</option>{Object.keys(histograms).map(name => <option key={name}>{name}</option>)}</select></label>
        <p>{data.missing[feature]} valores faltantes en {feature} en el dataset completo. El histograma cuenta valores observados.</p>
        <Bars data={frequencies} category="range" series={[{ key: "n", title: "Registros" }]} label={`Distribución de ${feature}`} />
        <details><summary>Ver frecuencias</summary><ul>{frequencies.map(bin => <li key={bin.range}>{bin.range} · {bin.n}</li>)}</ul></details>
      </section>
      <section className="panel"><h2>Perfiles de grupo y proxies</h2><label>Agrupar por<select value={group} onChange={e => { setGroup(e.target.value as Group); setSubgroup(""); }}><GroupOptions /></select></label>
        <p>Compara promedios y proporciones. Las diferencias sugieren qué variables conviene examinar como proxies.</p>
        <div className="table-wrap"><table><thead><tr>{["Grupo", "n", ...features, "Histórica", "Elegibilidad"].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>
          {data.profiles[group].map(row => <tr key={row.group}><th scope="row">{row.group}</th><td>{row.n}</td>{features.map(name => <td key={name}>{decimal(row[name])}</td>)}<td>{percent(row.historica)}</td><td>{percent(row.elegibilidad)}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
    <section className="panel"><h2>Ficha del dataset</h2><p>{scenario.construction}</p><dl>{columns.map(key => <div key={key}><dt>{key}</dt><dd>{scenario.variables[key]} Faltantes: {data.missing[key]}.</dd></div>)}</dl>
    <ul>{scenario.limitations.map(note => <li key={note}>{note}</li>)}</ul></section>
  </>;
}
