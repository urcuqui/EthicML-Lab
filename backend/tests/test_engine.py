import numpy as np
import pytest

from lab.engine import evaluate, fit, partition
from lab.scenarios import scholarship_data
from lab.schemas import Experiment


def test_partition_is_disjoint_deterministic_and_stratified():
    data = scholarship_data()
    train, test = partition(data)
    assert not set(train.id) & set(test.id)
    assert set(train.id) | set(test.id) == set(data.id)
    assert partition(data)[1].id.tolist() == test.id.tolist()
    assert test.historica.mean() == pytest.approx(data.historica.mean(), abs=.002)


def test_imputer_and_scaler_only_fit_training_rows():
    data = scholarship_data()
    pristine_train, test = partition(data)
    altered = data.copy()
    altered.loc[test.index, "ingreso"] = 1e9
    train, _ = partition(altered)
    config = Experiment(features=["ingreso", "distancia"])
    model, _ = fit(config, train)
    expected = pristine_train[config.features].median()
    np.testing.assert_allclose(model["imputer"].statistics_, expected)
    np.testing.assert_allclose(model["scale"].mean_, pristine_train[config.features].fillna(expected).mean())
    assert model["model"].n_features_in_ == 2


def test_fairlearn_mitigation_and_zero_perturbation():
    run = evaluate(Experiment(fairlearn_grid=True, grouping="interseccion", perturbation=0))
    assert run["evaluation"]["mitigation"]["selected_index"] in range(10)
    assert len(run["fairness"]["groups"]) == 4
    assert run["robustness"]["flip_rate"] == 0
    assert run["robustness"]["after"] == run["performance"]
