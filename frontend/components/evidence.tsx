"use client";

import { BarChart, Bar, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { decimal, metricNames, percent, type Metric, type Metrics, type Summary } from "../app/lab";

export function Bars({ data, category, series, label, percentAxis = false }: {
  data: Record<string, string | number | null>[]; category: string;
  series: { key: string; title: string }[]; label: string; percentAxis?: boolean;
}) {
  return <div className="chart" role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
        <CartesianGrid vertical={false} stroke="#27374a" />
        <XAxis dataKey={category} stroke="#acbbcc" tick={{ fontSize: 12 }} />
        <YAxis stroke="#acbbcc" domain={percentAxis ? [0, 1] : ["auto", "auto"]} tickFormatter={percentAxis ? percent : undefined} />
        <Tooltip contentStyle={{ background: "#101d2c", border: "1px solid #33465e", borderRadius: 8 }}
          formatter={value => typeof value === "number" ? percentAxis ? percent(value) : decimal(value) : value} />
        {series.length > 1 && <Legend />}
        {series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.title} fill={["#63e6bd", "#79aafa", "#f4c880", "#c79ffd"][index % 4]} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function MetricTable({ rows, fields }: { rows: Record<string, Metrics>; fields: Metric[] }) {
  return <div className="table-wrap"><table>
    <thead><tr><th scope="col">Grupo</th><th scope="col">n</th>{fields.map(key => <th scope="col" key={key}>{metricNames[key]}</th>)}<th scope="col">Incertidumbre</th></tr></thead>
    <tbody>{Object.entries(rows).map(([group, row]) => <tr key={group}><th scope="row">{group}</th><td>{row.n}</td>
      {fields.map(key => <td key={key}>{key === "roc_auc" || key === "f1" ? decimal(row[key]) : percent(row[key])}<small>n = {row.denominators[key]}</small></td>)}
      <td>{row.warnings.join(" ") || "—"}</td></tr>)}</tbody>
  </table></div>;
}

export function Comparison({ run, baseline }: { run: Summary; baseline: Pick<Summary, "performance" | "fairness"> }) {
  const rows = [
    ["Exactitud", baseline.performance.accuracy, run.performance.accuracy],
    ["F1", baseline.performance.f1, run.performance.f1],
    ["ROC-AUC", baseline.performance.roc_auc, run.performance.roc_auc],
    ["Paridad demográfica", baseline.fairness.dp_difference, run.fairness.dp_difference],
    ["Odds igualadas", baseline.fairness.eo_difference, run.fairness.eo_difference],
  ] as const;
  return <><div className="table-wrap"><table><thead><tr><th>Métrica</th><th>Línea base</th><th>Actual</th><th>Δ actual − base</th></tr></thead>
    <tbody>{rows.map(([name, before, after]) => <tr key={name}><th scope="row">{name}</th><td>{decimal(before)}</td><td>{decimal(after)}</td><td>{decimal(before === null || after === null ? null : after - before)}</td></tr>)}</tbody></table></div>
    <p className="muted">Identifica qué errores cambian y quién asume su costo antes de defender una mitigación. La comparación es exploratoria si se seleccionó la configuración tras observar el conjunto de prueba.</p></>;
}
