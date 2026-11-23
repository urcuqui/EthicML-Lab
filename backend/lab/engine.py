import hashlib
from importlib.metadata import version

import numpy as np
from fairlearn.reductions import DemographicParity, GridSearch
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .metrics import MIN_GROUP, audit, performance
from .scenarios import GROUPS, LABELS, SCENARIOS, SEED, ScenarioDefinition
from .schemas import Experiment


def partition(data, seed=SEED):
    return train_test_split(data, random_state=seed, test_size=.3, stratify=data.historica)


def grouping(data, name):
    if name == "interseccion":
        return (data.genero + " · " + data.zona).to_numpy()
    return data[name].to_numpy()


def fit(config, train, seed=SEED):
    model = (LogisticRegression(random_state=seed, max_iter=1000) if config.model == "logistic"
             else RandomForestClassifier(n_estimators=120, min_samples_leaf=6, random_state=seed, n_jobs=1))
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("model", model),
    ])
    if config.fairlearn_grid:
        search = GridSearch(pipeline, DemographicParity(), constraint_weight=.5,
                            grid_size=10, grid_limit=2, sample_weight_name="model__sample_weight")
        search.fit(train[config.features], train[config.target], sensitive_features=grouping(train, config.grouping))
        return search.predictors_[search.best_idx_], {
            "method": "Fairlearn GridSearch · DemographicParity", "grid_size": 10,
            "grid_limit": 2, "constraint_weight": .5, "selected_index": search.best_idx_,
        }
    kwargs = {}
    if config.reweight:
        groups = grouping(train, config.grouping)
        labels = train[config.target]
        group_count = labels.groupby(groups).transform("size")
        label_count = labels.groupby(labels).transform("size")
        joint_count = labels.groupby([groups, labels]).transform("size")
        kwargs["model__sample_weight"] = (group_count * label_count / (len(train) * joint_count)).to_numpy()
    fitted = pipeline.fit(train[config.features], train[config.target], **kwargs)
    return fitted, {"method": "marginal_frequency_weights" if config.reweight else "none"}


def explain(pipeline, x, y, test, groups, scores, features, seed):
    def importance(data, labels):
        result = permutation_importance(pipeline, data, labels, scoring="roc_auc", n_repeats=5, random_state=seed)
        return [{"feature": name, "mean": float(mean), "std": float(std)}
                for name, mean, std in zip(features, result.importances_mean, result.importances_std)]

    global_importance = importance(x, y)
    by_group = {}
    for group in sorted(set(groups)):
        mask = groups == group
        if mask.sum() >= MIN_GROUP and min(np.bincount(y[mask], minlength=2)) >= 10:
            by_group[group] = importance(x.loc[mask], y[mask])
    # Replace one input at a time with the training median. Deltas are not additive.
    deltas = {}
    for feature, median in zip(features, pipeline["imputer"].statistics_):
        changed = x.assign(**{feature: median})
        deltas[feature] = scores - pipeline.predict_proba(changed)[:, 1]
    observations = [
        {"id": int(row.id), "group": groups[i], "score": float(scores[i]),
         "values": {name: None if np.isnan(row[name]) else float(row[name]) for name in features},
         "deltas": {name: float(deltas[name][i]) for name in features}}
        for i, (_, row) in enumerate(test.iterrows())
    ]
    return {"global": global_importance, "by_group": by_group, "observations": observations,
            "method": "Permutación sobre ROC-AUC, 5 repeticiones. Para casos individuales se sustituye una variable por su mediana de entrenamiento. Las diferencias pueden interactuar y no son aditivas. SHAP no está habilitado."}


def evaluate(config: Experiment):
    definition = SCENARIOS[config.scenario]
    scenario = definition.metadata
    seed = scenario['seed']
    data = definition.generate()
    train, test = partition(data, seed)
    pipeline, mitigation = fit(config, train, seed)
    x = test[config.features]
    y = test[config.target].to_numpy()
    scores = pipeline.predict_proba(x)[:, 1]
    predictions = (scores >= config.threshold).astype(int)
    groups = grouping(test, config.grouping)
    changed = x.copy()
    rng = np.random.default_rng(seed)
    modified = []
    for name, (lower, upper) in definition.feature_bounds.items():
        if name in definition.discrete_features:
            continue
        delta = config.perturbation * (upper - lower)
        noise = rng.uniform(-delta, delta, len(x))
        if name in config.features:
            changed[name] = (x[name] + noise).clip(lower, upper)
            modified.append(name)
    shifted_scores = pipeline.predict_proba(changed)[:, 1]
    shifted_predictions = (shifted_scores >= config.threshold).astype(int)
    return {
        "scenario": scenario,
        "config": config.model_dump(),
        "evaluation": {
            "seed": seed, "test_fraction": .3, "stratified_by": "historica",
            "train_n": len(train), "test_n": len(test),
            "dataset_sha256": hashlib.sha256(data.to_csv(index=False).encode()).hexdigest(),
            "test_ids_sha256": hashlib.sha256(test.id.to_numpy(dtype="<i8").tobytes()).hexdigest(),
            "versions": {lib: version(lib) for lib in ("scikit-learn", "numpy", "pandas", "scipy", "fairlearn")},
            "mitigation": mitigation,
            "model_params": pipeline["model"].get_params(),
            "preprocessing": {"imputer": "median", "scaler": "StandardScaler"},
            "engine_version": "1.0.0",
        },
        "performance": performance(y, predictions, scores),
        "reference_comparison": {label: performance(test[label].to_numpy(), predictions, scores) for label in LABELS},
        "fairness": audit(y, predictions, scores, groups),
        "explainability": explain(pipeline, x, y, test, groups, scores, config.features, seed),
        "robustness": {
            "seed": seed, "magnitude": config.perturbation, "features": modified,
            "flip_rate": float(np.mean(predictions != shifted_predictions)),
            "mean_score_change": float(np.mean(np.abs(scores - shifted_scores))),
            "mean_confidence_before": float(np.mean(np.maximum(scores, 1 - scores))),
            "mean_confidence_after": float(np.mean(np.maximum(shifted_scores, 1 - shifted_scores))),
            "after": performance(y, shifted_predictions, shifted_scores),
        },
    }


def describe(definition: ScenarioDefinition):
    data = definition.generate()
    features = definition.feature_bounds
    rows = data.astype(object).where(data.notna(), None).to_dict("records")
    edges = {
        name: (np.arange(lower - .5, upper + 1.5) if name in definition.discrete_features
               else np.linspace(lower, upper, 11))
        for name, (lower, upper) in features.items()
    }
    partitions = {name: list(data.groupby(grouping(data, name))) for name in (*GROUPS, "interseccion")}

    def histograms(part):
        return {
            name: [{"range": f"{bins[i]:.1f}–{bins[i+1]:.1f}", "n": int(count)}
                   for i, count in enumerate(np.histogram(part[name].dropna(), bins=bins)[0])]
            for name, bins in edges.items()
        }

    return {
        "rows": rows,
        "missing": {key: int(value) for key, value in data.isna().sum().items()},
        "labels": {label: int(data[label].sum()) for label in LABELS},
        "label_agreement": float((data.historica == data.elegibilidad).mean()),
        "distributions": histograms(data),
        "group_distributions": {
            name: {group: histograms(part) for group, part in groups}
            for name, groups in partitions.items()
        },
        "profiles": {
            name: [
                {"group": group, "n": len(part), **{key: float(part[key].mean()) for key in (*features, *LABELS)}}
                for group, part in groups
            ]
            for name, groups in partitions.items()
        },
    }
