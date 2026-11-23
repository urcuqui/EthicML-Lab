from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from lab import api


def test_dataset_to_decision_and_report(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "engine", create_engine(f"sqlite:///{tmp_path / 'lab.sqlite3'}"))
    with TestClient(api.app) as client:
        assert client.get("/scenarios").json()[0]["name"] == "BecaJusta"
        dataset = client.get("/scenarios/becajusta/dataset").json()
        assert len(dataset["rows"]) == 1800
        assert dataset["missing"]["ingreso"] > 0
        assert client.post("/experiments", json={"features": ["genero"]}).status_code == 422

        response = client.post("/experiments", json={})
        assert response.status_code == 201, response.text
        baseline = response.json()
        response = client.post("/experiments", json={"model": "forest", "reweight": True, "baseline_id": baseline["id"]})
        assert response.status_code == 201, response.text
        run = response.json()
        assert run["evaluation"]["test_ids_sha256"] == baseline["evaluation"]["test_ids_sha256"]
        assert run["baseline"]["performance"] == baseline["performance"]

        path = f'/experiments/{run["id"]}'
        decision = {
            "outcome": "Solicitar más evidencia", "rationale": "Las etiquetas necesitan verificación independiente.",
            "residual_risks": "Sesgo de adjudicación", "affected_groups": "Zona rural",
            "limitations": "Muestra sintética", "mitigations": "Reponderación",
            "human_controls": "Revisión individual", "owners": "Comité", "pending": "Validación externa",
        }
        assert client.put(path + "/decision", json=decision).json()["decision"] == decision
        assert client.put(path + "/governance", json={"purpose": "Docencia"}).status_code == 200
        report = client.get(path + "/report?format=json")
        assert "attachment" in report.headers["Content-Disposition"]
        assert report.json()["decision"] == decision
        assert "observations" not in report.json()["explainability"]
        assert report.json()["governance"]["purpose"] == "Docencia"
        assert "Comparación con la línea base" in client.get(path + "/report?format=md").text
        assert len(client.get("/experiments").json()) == 2
        assert client.delete("/experiments").status_code == 204
        assert client.get("/experiments").json() == []
