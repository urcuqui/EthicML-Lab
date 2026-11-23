from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .scenarios import SCENARIOS


class Experiment(BaseModel):
    scenario: str = "becajusta"
    model: Literal["logistic", "forest"] = "logistic"
    threshold: float = Field(.5, ge=.01, le=.99)
    features: list[str] = Field(default_factory=list, max_length=64)
    grouping: Literal["genero", "zona", "interseccion"] = "zona"
    target: Literal["historica", "elegibilidad"] = "historica"
    reweight: bool = False
    fairlearn_grid: bool = False
    perturbation: float = Field(.05, ge=0, le=.2)
    baseline_id: str | None = Field(None, max_length=36)

    @model_validator(mode="before")
    @classmethod
    def default_features(cls, data):
        if isinstance(data, dict) and "features" not in data:
            scenario_id = data.get("scenario", "becajusta")
            if isinstance(scenario_id, str) and scenario_id in SCENARIOS:
                return {**data, "features": list(SCENARIOS[scenario_id].feature_bounds)}
        return data

    @model_validator(mode="after")
    def validate_configuration(self):
        if self.reweight and self.fairlearn_grid:
            raise ValueError("Selecciona una técnica de reponderación por experimento.")
        scenario = SCENARIOS.get(self.scenario)
        if scenario and (not self.features or len(set(self.features)) != len(self.features) or
                         set(self.features) - scenario.feature_bounds.keys()):
            raise ValueError("Selecciona características predictivas válidas y sin duplicados.")
        return self


class Decision(BaseModel):
    outcome: Literal["Desplegar", "Desplegar con condiciones", "Solicitar más evidencia", "No desplegar"]
    rationale: str = Field(min_length=10, max_length=4000)
    residual_risks: str = Field(min_length=1, max_length=4000)
    affected_groups: str = Field(min_length=1, max_length=4000)
    limitations: str = Field(min_length=1, max_length=4000)
    mitigations: str = Field(min_length=1, max_length=4000)
    human_controls: str = Field(min_length=1, max_length=4000)
    owners: str = Field(min_length=1, max_length=4000)
    pending: str = Field(min_length=1, max_length=4000)

    model_config = {"str_strip_whitespace": True}


class Governance(BaseModel):
    purpose: str = Field("", max_length=2000)
    minimization: str = Field("", max_length=2000)
    provenance: str = Field("", max_length=2000)
    retention: str = Field("", max_length=2000)
    access: str = Field("", max_length=2000)
    risks: str = Field("", max_length=2000)
    verified: str = Field("", max_length=2000)
    pending: str = Field("", max_length=2000)
