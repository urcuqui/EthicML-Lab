export const features = ["promedio", "ingreso", "horas_estudio", "distancia", "acceso_digital"] as const;
export type Feature = string;
export type Group = "zona" | "genero" | "interseccion";
export type Target = "historica" | "elegibilidad";
export type Config = {
  scenario: string; model: "logistic" | "forest"; threshold: number; features: Feature[];
  grouping: Group; target: Target; reweight: boolean; fairlearn_grid?: boolean; perturbation: number; baseline_id: string | null;
};
export const defaults: Config = {
  scenario: "becajusta", model: "logistic", threshold: .5, features: [...features],
  grouping: "zona", target: "historica", reweight: false, fairlearn_grid: false, perturbation: .05, baseline_id: null,
};

export type Metric = "accuracy" | "precision" | "recall" | "f1" | "roc_auc" | "selection_rate" | "tpr" | "fpr" | "fnr";
export type Metrics = Record<Metric, number | null> & {
  n: number; tp: number; tn: number; fp: number; fn: number; denominators: Record<Metric, number>; warnings: string[];
};
export type Fairness = {
  groups: Record<string, Metrics>; dp_difference: number | null; eo_difference: number | null; support_rule: string;
};
export type Scenario = {
  id: string; name: string; title: string; context: string; construction: string;
  limitations: string[]; variables: Record<string, string>; version: string; seed: number; rows: number; features: Feature[];
};
export type Dataset = {
  rows: Record<string, number | string | null>[]; missing: Record<string, number>;
  labels: Record<Target, number>; label_agreement: number;
  distributions: Record<Feature, { range: string; n: number }[]>;
  group_distributions: Record<Group, Record<string, Record<Feature, { range: string; n: number }[]>>>;
  profiles: Record<Group, (Record<Feature | Target, number> & { group: string; n: number })[]>;
};
export type Importance = { feature: Feature; mean: number; std: number };
export type Observation = {
  id: number; group: string; score: number; values: Partial<Record<Feature, number | null>>;
  deltas: Partial<Record<Feature, number>>;
};
export type Summary = {
  id: string; created_at: string; config: Config; performance: Metrics; fairness: Fairness;
  decision: Record<string, string> | null; governance: Record<string, string> | null;
};
export type Run = Summary & {
  scenario: Scenario; evaluation: { seed: number; train_n: number; test_n: number } & Record<string, unknown>;
  reference_comparison: Record<Target, Metrics>; baseline: Pick<Summary, "id" | "created_at" | "config" | "performance" | "fairness"> | null;
  explainability: { global: Importance[]; by_group: Record<string, Importance[]>; observations: Observation[]; method: string };
  robustness: { seed: number; magnitude: number; features: Feature[]; flip_rate: number; mean_score_change: number;
    mean_confidence_before: number; mean_confidence_after: number; after: Metrics };
};

export const decisionFields = {
  rationale: "Justificación", residual_risks: "Riesgos residuales", affected_groups: "Grupos afectados",
  limitations: "Limitaciones", mitigations: "Mitigaciones", human_controls: "Controles humanos",
  owners: "Responsables", pending: "Acciones pendientes",
};
export const governanceFields = {
  purpose: "Finalidad", minimization: "Minimización", provenance: "Procedencia",
  retention: "Conservación", access: "Acceso", risks: "Riesgos identificados",
  verified: "Verificaciones realizadas", pending: "Controles pendientes",
};
export const references = {
  "NIST AI RMF": "https://airc.nist.gov/airmf-resources/airmf/5-sec-core/",
  "Principios de IA de la OCDE": "https://oecd.ai/en/ai-principles",
  "Model Cards": "https://arxiv.org/abs/1810.03993",
  "Datasheets for Datasets": "https://arxiv.org/abs/1803.09010",
  "Fairlearn": "https://fairlearn.org/main/user_guide/assessment/index.html",
};
export const metricNames: Record<Metric, string> = {
  accuracy: "Exactitud", precision: "Precisión", recall: "Sensibilidad", f1: "F1", roc_auc: "ROC-AUC",
  selection_rate: "Selección", tpr: "VP (%)", fpr: "FP (%)", fnr: "FN (%)",
};
export const modelName = (model: Config["model"]) => model === "logistic" ? "Logistic Regression" : "Random Forest";
export const percent = (value: number | null) => value === null ? "N/D" : new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 }).format(value);
export const decimal = (value: number | null) => value === null ? "N/D" : value.toFixed(3);

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, { cache: "no-store", ...options,
    headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : error?.detail?.[0]?.msg || "No se pudo completar la solicitud. Verifica que el backend esté activo.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
