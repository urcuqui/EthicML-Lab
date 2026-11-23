from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .engine import describe, evaluate
from .reports import markdown
from .scenarios import REFERENCES, SCENARIOS
from .schemas import Decision, Experiment, Governance
from .storage import Base, Run, engine


@asynccontextmanager
async def lifespan(_):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="EthicML Lab", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/scenarios")
def scenarios():
    return [definition.metadata for definition in SCENARIOS.values()]


@lru_cache
def dataset_details(scenario):
    return describe(SCENARIOS[scenario])


@app.get("/scenarios/{scenario}/dataset")
def dataset(scenario: str):
    if scenario not in SCENARIOS:
        raise HTTPException(404, "Escenario desconocido.")
    return dataset_details(scenario)


def get_run(session, run_id):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(404, "Experimento inexistente.")
    return run


@app.get("/experiments")
def experiments():
    with Session(engine) as session:
        return [run.as_dict(detail=False) for run in session.scalars(select(Run).order_by(Run.created_at.desc()))]


@app.post("/experiments", status_code=201)
def run_experiment(config: Experiment):
    if config.scenario not in SCENARIOS:
        raise HTTPException(404, "Escenario desconocido.")
    with Session(engine) as session:
        if config.baseline_id:
            baseline = get_run(session, config.baseline_id)
            if any(baseline.result["config"][key] != getattr(config, key) for key in ("scenario", "target", "grouping")):
                raise HTTPException(422, "La comparación requiere escenario, etiqueta y agrupación iguales.")
        result = evaluate(config)
        result["baseline"] = None
        if config.baseline_id:
            evaluation = baseline.result["evaluation"]
            if any(evaluation[key] != result["evaluation"][key] for key in ("dataset_sha256", "test_ids_sha256")):
                raise HTTPException(422, "La línea base requiere el mismo dataset y la misma partición de prueba.")
            result["baseline"] = {
                "id": baseline.id, "created_at": baseline.created_at,
                **{key: baseline.result[key] for key in ("config", "performance", "fairness", "evaluation")},
            }
        run = Run(result=result)
        session.add(run)
        session.commit()
        return run.as_dict()


@app.get("/experiments/{run_id}")
def experiment(run_id: str):
    with Session(engine) as session:
        return get_run(session, run_id).as_dict()


@app.put("/experiments/{run_id}/decision")
def decide(run_id: str, decision: Decision):
    with Session(engine) as session:
        run = get_run(session, run_id)
        run.decision = decision.model_dump()
        session.commit()
        return run.as_dict()


@app.put("/experiments/{run_id}/governance")
def govern(run_id: str, governance: Governance):
    with Session(engine) as session:
        run = get_run(session, run_id)
        run.governance = governance.model_dump()
        session.commit()
        return run.as_dict()


@app.get("/experiments/{run_id}/report")
def report(run_id: str, format: Literal["json", "md", "view"] = "json"):
    result = experiment(run_id)
    result["explainability"].pop("observations")
    result["references"] = REFERENCES
    if format == "view":
        return result
    headers = {"Content-Disposition": f'attachment; filename="{result["scenario"]["id"]}-{result["id"]}.{format}"'}
    if format == "md":
        return Response(markdown(result), media_type="text/markdown", headers=headers)
    return JSONResponse(result, headers=headers)


@app.delete("/experiments", status_code=204)
def reset_lab():
    with Session(engine) as session:
        session.execute(delete(Run))
        session.commit()
