import numpy as np
from fairlearn.metrics import (
    MetricFrame, demographic_parity_difference, equalized_odds_difference,
    false_negative_rate, false_positive_rate, selection_rate, true_positive_rate,
)
from sklearn.metrics import roc_auc_score

MIN_GROUP = 30
MIN_LABEL = 10


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def performance(y, predicted, scores):
    tn = int(np.sum((y == 0) & (predicted == 0)))
    tp = int(np.sum((y == 1) & (predicted == 1)))
    fn = int(np.sum((y == 1) & (predicted == 0)))
    fp = int(np.sum((y == 0) & (predicted == 1)))
    n = len(y)
    positives, negatives, selected = tp + fn, tn + fp, tp + fp
    values = {
        "accuracy": ratio(tp + tn, n),
        "precision": ratio(tp, selected),
        "recall": ratio(tp, positives),
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "roc_auc": float(roc_auc_score(y, scores)) if positives and negatives else None,
        "selection_rate": ratio(selected, n),
        "tpr": ratio(tp, positives),
        "fpr": ratio(fp, negatives),
        "fnr": ratio(fn, positives),
    }
    warning = []
    if n < MIN_GROUP:
        warning.append("Muestra pequeña.")
    if min(positives, negatives) < MIN_LABEL:
        warning.append("Poco soporte de alguna clase. Interpreta las tasas de error con cautela.")
    if any(value is None for value in values.values()):
        warning.append("Hay métricas sin denominador válido.")
    return {**values, "n": n, "tp": tp, "tn": tn, "fp": fp, "fn": fn, "warnings": warning,
            "denominators": {"accuracy": n, "precision": selected, "recall": positives,
                             "f1": 2 * tp + fp + fn, "roc_auc": positives * negatives,
                             "selection_rate": n, "tpr": positives, "fpr": negatives, "fnr": positives}}


def audit(y, predicted, scores, groups):
    group_metrics = {
        "selection_rate": selection_rate, "tpr": true_positive_rate,
        "fpr": false_positive_rate, "fnr": false_negative_rate,
    }
    frame = MetricFrame(metrics=group_metrics, y_true=y, y_pred=predicted, sensitive_features=groups)
    rows = {}
    for group, rates in frame.by_group.iterrows():
        mask = groups == group
        metrics = performance(y[mask], predicted[mask], scores[mask])
        for name, value in rates.items():
            if metrics["denominators"][name]:
                metrics[name] = float(value)
        rows[str(group)] = metrics
    sufficient = len(rows) >= 2 and all(row["n"] >= MIN_GROUP for row in rows.values())
    enough_labels = sufficient and all(min(row["denominators"]["tpr"], row["denominators"]["fpr"]) >= MIN_LABEL for row in rows.values())
    return {
        "groups": rows,
        "dp_difference": float(demographic_parity_difference(y, predicted, sensitive_features=groups)) if sufficient else None,
        "eo_difference": float(equalized_odds_difference(y, predicted, sensitive_features=groups)) if enough_labels else None,
        "support_rule": f"Para publicar diferencias se requieren dos grupos, {MIN_GROUP} filas por grupo y, para odds igualadas, {MIN_LABEL} ejemplos de cada clase por grupo.",
    }
