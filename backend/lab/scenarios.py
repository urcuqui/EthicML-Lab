import argparse
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd

SEED = 421
FEATURES = {
    "promedio": (0, 5),
    "ingreso": (0, 12),
    "horas_estudio": (0, 50),
    "distancia": (0, 80),
    "acceso_digital": (0, 1),
}
GROUPS = ("genero", "zona")
LABELS = ("historica", "elegibilidad")
REFERENCES = {
    "NIST AI RMF": "https://airc.nist.gov/airmf-resources/airmf/5-sec-core/",
    "Principios de IA de la OCDE": "https://oecd.ai/en/ai-principles",
    "Model Cards": "https://arxiv.org/abs/1810.03993",
    "Datasheets for Datasets": "https://arxiv.org/abs/1803.09010",
    "Fairlearn": "https://fairlearn.org/main/user_guide/assessment/index.html",
}
BECAJUSTA = {
    "id": "becajusta",
    "name": "BecaJusta",
    "title": "Asignación de becas universitarias",
    "context": "Una universidad usa un clasificador para recomendar becas a estudiantes postulantes. Una recomendación negativa puede reducir su acceso a financiación y continuidad académica.",
    "construction": "La zona rural simulada se asocia con mayor distancia, menores ingresos y menor acceso digital. La adjudicación histórica penaliza explícitamente la zona rural y el grupo B, y favorece el acceso digital. La elegibilidad usa promedio, horas e ingreso con ruido sintético y representa una política hipotética discutible.",
    "limitations": [
        "La población y sus relaciones son sintéticas. Los efectos observados corresponden a los supuestos del generador.",
        "La elegibilidad de referencia expresa una política simulada. Su validez ética se discute por separado.",
        "Ajustar configuraciones después de ver el conjunto de prueba vuelve exploratoria la comparación. Una decisión operativa requiere evaluación independiente.",
        "Los atributos sensibles se reservan para auditoría y reponderación opcional. Sus variables correlacionadas pueden transmitir información indirectamente.",
    ],
    "variables": {
        "id": "Identificador sintético de fila, excluido del modelo.",
        "promedio": "Promedio académico entre 0 y 5.",
        "ingreso": "Ingreso familiar mensual simulado, en unidades relativas entre 0 y 12.",
        "horas_estudio": "Horas semanales de estudio entre 0 y 50.",
        "distancia": "Distancia en kilómetros entre 0 y 80.",
        "acceso_digital": "Indicador binario de acceso a recursos digitales.",
        "genero": "Atributo sensible simulado con categorías A y B.",
        "zona": "Zona urbana o rural simulada y atributo de auditoría.",
        "historica": "Adjudicación histórica con penalizaciones simuladas.",
        "elegibilidad": "Referencia hipotética que se usa para contrastar las decisiones históricas.",
    },
    "version": "1.0.0",
    "seed": SEED,
    "rows": 1800,
    "features": list(FEATURES),
}


@lru_cache
def scholarship_data() -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    n = BECAJUSTA["rows"]
    rural = rng.random(n) < .32
    group_b = rng.random(n) < .54
    grade = rng.normal(3.55, .55, n).clip(0, 5)
    income = (rng.lognormal(1.1, .55, n) - .8 * rural).clip(0, 12)
    study = rng.normal(19, 7, n).clip(0, 50)
    distance = rng.normal(13 + 24 * rural, 9, n).clip(0, 80)
    digital = (rng.random(n) < (.88 - .37 * rural - .08 * (income < 2))).astype(int)
    merit = 1.7 * (grade - 3.5) + .04 * (study - 18) - .28 * (income - 3)
    historical = merit + .6 * digital - .95 * rural - .6 * group_b + rng.normal(0, .75, n)
    frame = pd.DataFrame({
        "id": np.arange(1, n + 1),
        "promedio": grade.round(3),
        "ingreso": income.round(3),
        "horas_estudio": study.round(3),
        "distancia": distance.round(3),
        "acceso_digital": digital,
        "genero": np.where(group_b, "B", "A"),
        "zona": np.where(rural, "rural", "urbana"),
        "historica": (historical > 0).astype(int),
        "elegibilidad": (merit + rng.normal(0, .4, n) > 0).astype(int),
    })
    frame.loc[rng.random(n) < .065, "ingreso"] = np.nan
    return frame


@dataclass(frozen=True)
class ScenarioDefinition:
    metadata: dict
    generate: Callable[[], pd.DataFrame]
    feature_bounds: dict[str, tuple[float, float]]
    discrete_features: frozenset[str]


SCENARIOS = {
    "becajusta": ScenarioDefinition(BECAJUSTA, scholarship_data, FEATURES, frozenset({"acceso_digital"})),
}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    scholarship_data().to_csv(parser.parse_args().output, index=False)
