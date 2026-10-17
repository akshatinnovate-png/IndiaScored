/**
 * The trained IndiaScored model, evaluated in the browser.
 *
 * `public/model/indiascored-model.json` is exported from the Python bundle by
 * `backend/scripts/export_browser_model.py`. This module reproduces the
 * Python pipeline step for step: feature derivation, median/most-frequent
 * imputation, standard scaling, one-hot encoding, the five LightGBM folds
 * with their isotonic calibrators, and exact path-dependent TreeSHAP over
 * the raw model. `model.test.ts` checks it against the Python outputs.
 */

export interface Tree {
  f: number[]; // split feature, -1 at a leaf
  t: number[]; // threshold; x <= t goes left
  l: number[];
  r: number[];
  v: number[]; // leaf value
  c?: number[]; // training-sample count, for TreeSHAP
}

export interface ModelJson {
  feature_names: string[];
  numeric: { columns: string[]; median: number[]; mean: number[]; scale: number[] };
  categorical: { columns: string[]; most_frequent: string[]; categories: string[][] };
  folds: Array<{ trees: Tree[]; iso_x: number[]; iso_y: number[] }>;
  explainer: { expected_value: number; trees: Tree[] };
}

/** Frozen from training; see backend/indiascored/scoring/features.py. */
const SMS_REFERENCE_CEILING = 60.0;

type RawRecord = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function derived(record: RawRecord, column: string): number | null {
  if (column === "loan_amount_log") {
    return Math.log1p(toNumber(record.loan_amount_requested) ?? 0);
  }
  if (column === "sms_norm") {
    const sms = toNumber(record.sms_count) ?? 0;
    return Math.min(Math.max(sms / (SMS_REFERENCE_CEILING + 1), 0), 1);
  }
  return toNumber(record[column]);
}

/** The preprocessor's output row, in `feature_names` order. */
export function encode(model: ModelJson, record: RawRecord): number[] {
  const { numeric, categorical } = model;
  const row: number[] = [];
  numeric.columns.forEach((column, i) => {
    const value = derived(record, column) ?? numeric.median[i];
    row.push((value - numeric.mean[i]) / numeric.scale[i]);
  });
  categorical.columns.forEach((column, i) => {
    const raw = record[column];
    const value = raw === null || raw === undefined || raw === "" ? categorical.most_frequent[i] : String(raw);
    for (const category of categorical.categories[i]) row.push(value === category ? 1 : 0);
  });
  return row;
}

function treeOutput(tree: Tree, x: number[]): number {
  let node = 0;
  while (tree.f[node] !== -1) {
    node = x[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node];
  }
  return tree.v[node];
}

/** numpy.interp with clipping, as IsotonicRegression(out_of_bounds="clip"). */
function interpolate(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  if (xs[hi] === xs[lo]) return ys[hi];
  return ys[lo] + ((x - xs[lo]) * (ys[hi] - ys[lo])) / (xs[hi] - xs[lo]);
}

/**
 * Calibrated probability of default: the mean over the calibration folds.
 * scikit-learn feeds each isotonic calibrator the booster's raw margin
 * (LightGBM's decision_function), not its sigmoid probability.
 */
export function probabilityOfDefault(model: ModelJson, x: number[]): number {
  let total = 0;
  for (const fold of model.folds) {
    let margin = 0;
    for (const tree of fold.trees) margin += treeOutput(tree, x);
    total += interpolate(margin, fold.iso_x, fold.iso_y);
  }
  return total / model.folds.length;
}

// --- Path-dependent TreeSHAP (Lundberg et al., 2018, Algorithm 2) ----------

interface Path {
  feature: number[];
  zero: number[];
  one: number[];
  weight: number[];
}

function extendPath(p: Path, depth: number, zero: number, one: number, feature: number): void {
  p.feature[depth] = feature;
  p.zero[depth] = zero;
  p.one[depth] = one;
  p.weight[depth] = depth === 0 ? 1 : 0;
  for (let i = depth - 1; i >= 0; i--) {
    p.weight[i + 1] += (one * p.weight[i] * (i + 1)) / (depth + 1);
    p.weight[i] = (zero * p.weight[i] * (depth - i)) / (depth + 1);
  }
}

function unwindPath(p: Path, depth: number, index: number): void {
  const one = p.one[index];
  const zero = p.zero[index];
  let next = p.weight[depth];
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const tmp = p.weight[i];
      p.weight[i] = (next * (depth + 1)) / ((i + 1) * one);
      next = tmp - (p.weight[i] * zero * (depth - i)) / (depth + 1);
    } else {
      p.weight[i] = (p.weight[i] * (depth + 1)) / (zero * (depth - i));
    }
  }
  for (let i = index; i < depth; i++) {
    p.feature[i] = p.feature[i + 1];
    p.zero[i] = p.zero[i + 1];
    p.one[i] = p.one[i + 1];
  }
}

function unwoundPathSum(p: Path, depth: number, index: number): number {
  const one = p.one[index];
  const zero = p.zero[index];
  let next = p.weight[depth];
  let total = 0;
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const tmp = (next * (depth + 1)) / ((i + 1) * one);
      total += tmp;
      next = p.weight[i] - tmp * zero * ((depth - i) / (depth + 1));
    } else {
      total += p.weight[i] / zero / ((depth - i) / (depth + 1));
    }
  }
  return total;
}

function copyPath(parent: Path, length: number): Path {
  return {
    feature: parent.feature.slice(0, length),
    zero: parent.zero.slice(0, length),
    one: parent.one.slice(0, length),
    weight: parent.weight.slice(0, length),
  };
}

function recurse(
  tree: Tree,
  x: number[],
  phi: number[],
  node: number,
  depthIn: number,
  parent: Path,
  parentZero: number,
  parentOne: number,
  parentFeature: number,
): void {
  let depth = depthIn;
  const path = copyPath(parent, depth + 1);
  extendPath(path, depth, parentZero, parentOne, parentFeature);

  const split = tree.f[node];
  if (split === -1) {
    for (let i = 1; i <= depth; i++) {
      const w = unwoundPathSum(path, depth, i);
      phi[path.feature[i]] += w * (path.one[i] - path.zero[i]) * tree.v[node];
    }
    return;
  }

  const counts = tree.c!;
  const left = tree.l[node];
  const right = tree.r[node];
  const hot = x[split] <= tree.t[node] ? left : right;
  const cold = hot === left ? right : left;
  const hotZero = counts[hot] / counts[node];
  const coldZero = counts[cold] / counts[node];
  let incomingZero = 1;
  let incomingOne = 1;

  let index = 0;
  while (index <= depth && path.feature[index] !== split) index++;
  if (index !== depth + 1) {
    incomingZero = path.zero[index];
    incomingOne = path.one[index];
    unwindPath(path, depth, index);
    depth -= 1;
  }

  recurse(tree, x, phi, hot, depth + 1, path, hotZero * incomingZero, incomingOne, split);
  recurse(tree, x, phi, cold, depth + 1, path, coldZero * incomingZero, 0, split);
}

/** SHAP values in log-odds space, one per encoded feature. */
export function shapValues(model: ModelJson, x: number[]): number[] {
  const phi = new Array<number>(x.length).fill(0);
  const empty: Path = { feature: [], zero: [], one: [], weight: [] };
  for (const tree of model.explainer.trees) {
    if (tree.f[0] === -1) continue; // a stump moves only the base value
    recurse(tree, x, phi, 0, 0, empty, 1, 1, -1);
  }
  return phi;
}
