import json

METRICS = {
    "accuracy": "Exactitud", "precision": "Precisión", "recall": "Sensibilidad",
    "f1": "F1", "roc_auc": "ROC-AUC", "selection_rate": "Selección",
    "tpr": "VP", "fpr": "FP", "fnr": "FN",
}
DECISION = {
    "outcome": "Decisión", "rationale": "Justificación", "residual_risks": "Riesgos residuales",
    "affected_groups": "Grupos afectados", "limitations": "Limitaciones", "mitigations": "Mitigaciones",
    "human_controls": "Controles humanos", "owners": "Responsables", "pending": "Acciones pendientes",
}
GOVERNANCE = {
    "purpose": "Finalidad", "minimization": "Minimización", "provenance": "Procedencia",
    "retention": "Conservación", "access": "Acceso", "risks": "Riesgos identificados",
    "verified": "Verificaciones realizadas", "pending": "Controles pendientes",
}


def table(headers, rows):
    return "\n".join("| " + " | ".join(str(item) for item in row) + " |"
                     for row in (headers, ["---"] * len(headers), *rows))


def number(value):
    return "N/D" if value is None else f"{value:.4f}"


def metric_table(groups, metrics=METRICS):
    rows = [[name, row["n"], *(f'{number(row[key])} (n={row["denominators"][key]})' for key in metrics),
             " ".join(row["warnings"]) or "—"] for name, row in groups.items()]
    return table(["Grupo", "Filas", *(METRICS[key] for key in metrics), "Incertidumbre"], rows)


def snapshot(data):
    return "```json\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n```"


def notes(values, labels):
    if not values:
        return "Pendiente de registrar."
    return "\n\n".join(f"**{title}**\n\n{values.get(key) or 'Pendiente.'}" for key, title in labels.items())


def markdown(report):
    scenario = report["scenario"]
    performance = report["performance"]
    fairness = report["fairness"]
    baseline = report["baseline"]
    comparison = "Este experimento se ejecutó sin una línea base seleccionada."
    if baseline:
        pairs = [(label, baseline["performance"][key], performance[key])
                 for key, label in METRICS.items()]
        pairs += [(label, baseline["fairness"][key], fairness[key])
                  for key, label in (("dp_difference", "Paridad demográfica"), ("eo_difference", "Odds igualadas"))]
        comparison = (
            f'Experimento de referencia `{baseline["id"]}`.\n\n'
            + table(["Métrica", "Línea base", "Actual", "Δ actual − base"], [
                [label, number(before), number(after), number(None if before is None or after is None else after - before)]
                for label, before, after in pairs
            ]) + "\n\n" + metric_table(baseline["fairness"]["groups"])
            + "\n\n### Configuración de la línea base\n\n"
            + snapshot({"config": baseline["config"], "evaluation": baseline.get("evaluation")})
        )
    sections = [
        (None, f'# {scenario["name"]} · Informe de evaluación\n\nExperimento `{report["id"]}` · {report["created_at"]}'),
        ("Escenario, riesgos y limitaciones", "\n\n".join([
            scenario["context"], scenario["construction"],
            f'Dataset versión {scenario["version"]}, {scenario["rows"]} filas, semilla {scenario["seed"]}.',
            "\n".join(f"- {note}" for note in scenario["limitations"]),
        ])),
        ("Desempeño global y por grupo", metric_table({"Global": performance, **fairness["groups"]})),
        ("Matriz de confusión", table(["Etiqueta observada", "Predicción negativa", "Predicción positiva"], [
            ["Negativa", performance["tn"], performance["fp"]],
            ["Positiva", performance["fn"], performance["tp"]],
        ])),
        ("Comparación de etiquetas", metric_table(report["reference_comparison"])),
        ("Equidad", (
            f'Paridad demográfica {number(fairness["dp_difference"])} · Odds igualadas {number(fairness["eo_difference"])}.\n\n'
            f'{fairness["support_rule"]} Las brechas dependen de la etiqueta y la muestra.'
        )),
        ("Comparación con la línea base", comparison),
        ("Explicabilidad global y por grupo", report["explainability"]["method"] + "\n\n" + snapshot({
            key: report["explainability"][key] for key in ("global", "by_group")
        })),
        ("Robustez", snapshot(report["robustness"])),
        ("Gobernanza", notes(report["governance"], GOVERNANCE)),
        ("Decisión y acciones pendientes", notes(report["decision"], DECISION)),
        ("Configuración y reproducibilidad", snapshot({"config": report["config"], "evaluation": report["evaluation"]})),
        ("Referencias metodológicas", "\n".join(f"- [{key}]({url})" for key, url in report["references"].items())),
    ]
    return "\n\n".join(f"## {title}\n\n{body}" if title else body for title, body in sections) + "\n"
