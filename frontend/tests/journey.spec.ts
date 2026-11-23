import { expect, test } from "@playwright/test";

test("BecaJusta: datos, dos modelos, mitigación, decisión e informe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explorar BecaJusta" }).click();
  await page.getByRole("link", { name: "Inspeccionar datos" }).click();
  await expect(page.getByText("1800", { exact: true })).toBeVisible();
  await page.getByLabel("Buscar").fill("faltante");
  await expect(page.getByText(/filas · Página/)).not.toContainText("1800 filas");

  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "Rendimiento", exact: true }).click();
  await page.getByRole("combobox", { name: "Modelo", exact: true }).selectOption("logistic");
  await page.getByRole("button", { name: "Ejecutar experimento" }).click();
  await expect(page.getByRole("status")).toHaveText("Experimento calculado y guardado.");
  const baseline = await page.getByRole("combobox", { name: "Experimento activo", exact: true }).inputValue();
  await expect(page.getByRole("heading", { name: "Matriz de confusión" })).toBeVisible();

  await nav.getByRole("link", { name: "Equidad", exact: true }).click();
  await expect(page.getByText("Diferencia de odds igualadas", { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Explicabilidad", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inspección individual" })).toBeVisible();

  await nav.getByRole("link", { name: "Laboratorio de mitigación" }).click();
  await page.getByRole("combobox", { name: "Modelo", exact: true }).selectOption("forest");
  await page.getByRole("combobox", { name: "Línea base", exact: true }).selectOption(baseline);
  await page.getByLabel("Reponderar por grupo y etiqueta").check();
  await page.getByRole("button", { name: "Ejecutar experimento" }).click();
  await expect(page.getByText("Δ actual − base")).toBeVisible();

  await nav.getByRole("link", { name: "Decisión ética" }).click();
  const rationale = "Se necesita evidencia independiente y revisión de los falsos negativos.";
  await page.getByLabel("Justificación").fill(rationale);
  for (const label of ["Riesgos residuales", "Grupos afectados", "Limitaciones", "Mitigaciones", "Controles humanos", "Responsables", "Acciones pendientes"]) {
    await page.getByLabel(label, { exact: true }).fill("Registro de prueba del recorrido BecaJusta.");
  }
  await page.getByRole("button", { name: "Guardar decisión" }).click();
  await expect(page.getByRole("status")).toHaveText("Decisión guardada.");
  await nav.getByRole("link", { name: "Informes", exact: true }).click();
  for (const [name, suffix] of [["Descargar Markdown", ".md"], ["Descargar JSON", ".json"]]) {
    const event = page.waitForEvent("download");
    await page.getByRole("link", { name }).click();
    const download = await event;
    expect(download.suggestedFilename()).toContain(suffix);
    expect(await download.failure()).toBeNull();
  }
  await page.getByRole("link", { name: "Vista imprimible" }).click();
  await expect(page.getByRole("heading", { name: "BecaJusta · Informe de evaluación" })).toBeVisible();
  await expect(page.getByText(rationale, { exact: true })).toBeVisible();
});

test("el resumen y la navegación caben en una pantalla móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Evalúa modelos.");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("navigation").getByRole("link", { name: "Metodología", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Metodología");
});
