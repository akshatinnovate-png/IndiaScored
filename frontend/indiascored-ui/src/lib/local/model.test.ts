/**
 * Checks the in-browser model against outputs of the real Python pipeline.
 *
 *     npm run test:model
 *
 * Regenerate the fixture with backend/scripts/export_browser_model.py
 * whenever the model is retrained.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { scoreRecord } from "./engine.ts";
import type { ModelJson } from "./model.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const model: ModelJson = JSON.parse(readFileSync(here("../../../public/model/indiascored-model.json"), "utf8"));
const cases = JSON.parse(readFileSync(here("./__fixtures__/reference-scores.json"), "utf8"));

let worstPd = 0;
let worstShap = 0;
for (const { input, score_card: expected } of cases) {
  const actual = scoreRecord(model, input, expected.drivers.length);

  assert.equal(actual.grade, expected.grade, "grade");
  assert.equal(actual.india_score, expected.india_score, "india_score");
  assert.equal(actual.decision, expected.decision, "decision");
  assert.equal(actual.sanctioned_amount, expected.sanctioned_amount, "sanctioned_amount");
  worstPd = Math.max(worstPd, Math.abs(actual.probability_of_default - expected.probability_of_default));

  const byFeature = new Map(actual.drivers.map((d) => [d.feature, d.contribution]));
  for (const driver of expected.drivers) {
    worstShap = Math.max(worstShap, Math.abs((byFeature.get(driver.feature) ?? 0) - driver.contribution));
  }
}

assert.ok(worstPd < 1e-6, `PD drift ${worstPd}`);
assert.ok(worstShap < 1e-6, `SHAP drift ${worstShap}`);
console.log(`model parity OK: ${cases.length} cases, max |ΔPD| ${worstPd.toExponential(2)}, max |ΔSHAP| ${worstShap.toExponential(2)}`);
