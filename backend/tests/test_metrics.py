import numpy as np
import pytest

from lab.metrics import audit, performance


def known_case():
    return (
        np.tile([1, 1, 0, 0], 20),
        np.concatenate((np.tile([1, 1, 1, 0], 10), np.tile([1, 0, 0, 0], 10))),
        np.repeat(["A", "B"], 40),
    )


def test_fairlearn_gaps_and_rate_complements():
    y, predicted, groups = known_case()
    result = audit(y, predicted, predicted, groups)
    assert result["dp_difference"] == pytest.approx(.5)
    assert result["eo_difference"] == pytest.approx(.5)
    for row in result["groups"].values():
        assert row["tpr"] + row["fnr"] == pytest.approx(1)
        assert row["denominators"]["fpr"] == 20


def test_gap_invariant_to_order_and_group_names():
    y, predicted, groups = known_case()
    renamed = np.where(groups == "A", "Z", "Y")
    original = audit(y, predicted, predicted, groups)
    reordered = audit(y[::-1], predicted[::-1], predicted[::-1], renamed[::-1])
    for key in ("dp_difference", "eo_difference"):
        assert original[key] == reordered[key]


def test_missing_classes_and_predictions_return_undefined_rates():
    y = np.zeros(60, dtype=int)
    result = audit(y, y, y, np.repeat(["A", "B"], 30))
    assert result["dp_difference"] == 0
    assert result["eo_difference"] is None
    assert result["groups"]["A"]["tpr"] is None
    row = performance(y, y, y)
    assert row["precision"] is None and row["roc_auc"] is None
    assert row["accuracy"] == 1
