import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateV5Payload } from "../src/adapters/novelai-v5-full.js";
import { guardScenePlanV2Shot } from "../src/services/actor-count-semantic-guard.js";
import { compileScenePlanV2Shot } from "../src/services/preset-composer-v2.js";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { auditScenePlanV2, validateScenePlanV2 } from "../src/state/image-director-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SET_PATH = path.join(ROOT, "benchmarks", "image-director", "benchmark-set.json");
const INSTRUCTION_PATH = path.join(ROOT, "docs", "image-maker", "codex-image-director.md");
const SCHEMA_PATH = path.join(ROOT, "src", "state", "scene-plan-v2.schema.json");
const WORK_PATH = path.join(ROOT, "benchmarks", "image-director", "workspace");
const DEFAULT_RESULTS_PATH = path.join(ROOT, "benchmarks", "image-director", "results");
const PROCESS_TIMEOUT_MS = 240_000;

const options = parseArguments(process.argv.slice(2));
const [benchmark, instruction] = await Promise.all([
  readJson(SET_PATH),
  readFile(INSTRUCTION_PATH, "utf8"),
]);
const selectedCases = benchmark.cases.filter((item) => !options.caseIds.length || options.caseIds.includes(item.id));
if (!selectedCases.length) throw new Error("No benchmark cases matched --case.");
if (!options.configs.length) throw new Error("Provide at least one --config model:effort.");
await mkdir(WORK_PATH, { recursive: true });
await mkdir(options.resultsPath, { recursive: true });

const matrix = {
  schema: "chaessi-image-director-benchmark-results/v1",
  benchmarkSet: path.relative(ROOT, SET_PATH).replaceAll("\\", "/"),
  cacheBypass: true,
  retries: 0,
  novelAiRequests: 0,
  startedAt: new Date().toISOString(),
  configs: [],
};

for (const config of options.configs) {
  const configResult = { model: config.model, reasoningEffort: config.effort, cases: [] };
  matrix.configs.push(configResult);
  for (const benchmarkCase of selectedCases) {
    process.stdout.write(`${options.aggregateOnly ? "EVAL " : "START"} ${config.model}/${config.effort} ${benchmarkCase.id}\n`);
    const result = options.aggregateOnly
      ? await evaluateExistingCase({ benchmarkCase, config, resultsPath: options.resultsPath })
      : await runCase({ benchmark, benchmarkCase, instruction, config, executable: options.executable, resultsPath: options.resultsPath });
    configResult.cases.push(result);
    process.stdout.write(`DONE  ${config.model}/${config.effort} ${benchmarkCase.id} ${result.evaluation.pass ? "PASS" : "FAIL"} ${result.process.durationMs}ms\n`);
  }
  configResult.summary = summarizeConfig(configResult);
}

async function evaluateExistingCase({ benchmarkCase, config, resultsPath }) {
  const runDir = path.join(resultsPath, safeName(`${config.model}_${config.effort}`), benchmarkCase.id);
  const [plan, prior] = await Promise.all([
    readJson(path.join(runDir, "director-plan.json")),
    readJson(path.join(runDir, "benchmark-result.json")),
  ]);
  const result = { ...prior, evaluation: evaluatePlan(benchmarkCase, plan) };
  await writeJson(path.join(runDir, "benchmark-result.json"), result);
  return result;
}
matrix.finishedAt = new Date().toISOString();
matrix.summary = summarizeMatrix(matrix);
await writeJson(path.join(options.resultsPath, "benchmark-results.json"), matrix);
process.stdout.write(`${JSON.stringify(matrix.summary, null, 2)}\n`);

async function runCase({ benchmark, benchmarkCase, instruction, config, executable, resultsPath }) {
  const runDir = path.join(resultsPath, safeName(`${config.model}_${config.effort}`), benchmarkCase.id);
  await mkdir(runDir, { recursive: true });
  const finalPath = path.join(runDir, "director-plan.json");
  const prompt = buildPrompt({ benchmark, benchmarkCase, instruction });
  const args = [
    "exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", WORK_PATH,
    "--output-schema", SCHEMA_PATH, "--output-last-message", finalPath, "--json",
    "--model", config.model, "-c", `model_reasoning_effort=${JSON.stringify(config.effort)}`, "-",
  ];
  const startedAt = Date.now();
  const processResult = await runProcess({ executable, args, stdin: prompt, timeoutMs: PROCESS_TIMEOUT_MS });
  const durationMs = Date.now() - startedAt;
  const publicProcess = {
    success: processResult.exitCode === 0,
    exitCode: processResult.exitCode,
    durationMs,
    retryCount: 0,
    cacheBypass: true,
    timedOut: processResult.timedOut,
    diagnostic: sanitizeDiagnostic(processResult.stderr),
    usage: extractUsage(processResult.stdout),
  };
  let plan = null;
  let evaluation = failedEvaluation("Codex process did not complete successfully.");
  if (publicProcess.success) {
    try {
      plan = await readJson(finalPath);
      evaluation = evaluatePlan(benchmarkCase, plan);
    } catch (error) {
      evaluation = failedEvaluation(error.message);
    }
  }
  const result = {
    caseId: benchmarkCase.id,
    promptHash: sha256(prompt),
    process: publicProcess,
    evaluation,
  };
  await writeJson(path.join(runDir, "benchmark-result.json"), result);
  if (!plan) await writeFile(path.join(runDir, "director-plan.invalid.txt"), sanitizeDiagnostic(processResult.stdout).slice(-12000), "utf8");
  return result;
}

function buildPrompt({ benchmark, benchmarkCase, instruction }) {
  const context = {
    request: benchmarkCase.request,
    mode: benchmarkCase.mode,
    count: benchmarkCase.count,
    presetSelections: benchmarkCase.presetSelections,
    actors: benchmarkCase.actors,
    optionalPresetSummaries: benchmark.optionalPresetSummaries,
    canvas: benchmark.canvas,
    constraints: benchmarkCase.constraints,
    seedPolicy: "Leave every generation.seed null.",
  };
  return `${instruction.trim()}\n\n# BENCHMARK EXECUTION CONSTRAINTS
You are a read-only Image Director subprocess. Do not inspect files, call tools, modify code, discuss the task, or ask questions.
Return exactly one JSON object matching chaessi-scene-plan/v2 and the supplied output schema.
Copy request, mode, count, and presetSelections exactly. Produce exactly ${benchmarkCase.count} shots named shot_001 through shot_${String(benchmarkCase.count).padStart(3, "0")}.
Every shot must contain exactly ${benchmarkCase.actors.length} generation.characters entries in the same order as presetSelections.characterPresetIds. Each entry must include position with either null or normalized x/y coordinates.
Keep cameraHeight, cameraAngle, viewpoint, subjectPlacement, and depth free of person nouns and personal pronouns. Put actor action, gaze, expression, and relationships in direction action/gaze/expression and generation.characters[].scenePrompt.
Do not repeat identity or outfit preset tags in generation text. Use an empty visibleFeaturesPrompt so Composer can preserve the selected identity preset.
For sequence mode, every shot after shot_001 must set carriesFrom to an earlier shot and must track prop state. For editorial mode, carriesFrom may be null.
Do not invent NovelAI parameters or call any external service.

DIRECTOR_CONTEXT_JSON
${JSON.stringify(context, null, 2)}
END_DIRECTOR_CONTEXT_JSON`;
}

function evaluatePlan(benchmarkCase, plan) {
  const errors = [];
  let contract = false;
  try { validateScenePlanV2(plan); contract = true; }
  catch (error) { errors.push(`contract: ${error.message}`); }
  const countExact = plan?.count === benchmarkCase.count && plan?.shots?.length === benchmarkCase.count;
  const requestExact = plan?.request === benchmarkCase.request && plan?.mode === benchmarkCase.mode;
  const presetsExact = stableJson(plan?.presetSelections) === stableJson(benchmarkCase.presetSelections);
  const expectedActorIds = benchmarkCase.presetSelections.characterPresetIds;
  const actorCountsExact = Boolean(plan?.shots?.every((shot) =>
    shot.generation?.characters?.length === expectedActorIds.length
    && stableJson(shot.generation.characters.map((actor) => actor.characterPresetId)) === stableJson(expectedActorIds)));
  if (!countExact) errors.push("count mismatch");
  if (!requestExact) errors.push("request or mode mismatch");
  if (!presetsExact) errors.push("preset selections changed");
  if (!actorCountsExact) errors.push("actor count or actor order mismatch");

  let audit = { ok: false, errors: ["contract validation failed"], warnings: [] };
  if (contract) {
    try { audit = auditScenePlanV2(plan); }
    catch (error) { errors.push(`audit: ${error.message}`); }
  }

  const preflight = { ok: contract, shots: [] };
  if (contract) {
    const assets = fixtureAssets(benchmarkCase);
    for (const shot of plan.shots) {
      const shotResult = { shotId: shot.id, ok: false, guard: null, payload: null, error: null };
      try {
        const guarded = guardScenePlanV2Shot(plan, { shotId: shot.id, rewriteSafe: true });
        shotResult.guard = { ok: guarded.report.ok, requiresSemanticReview: guarded.report.requiresSemanticReview, issues: guarded.report.issues };
        if (guarded.report.requiresSemanticReview) throw new Error("semantic guard requires review");
        const prepared = compileScenePlanV2Shot(guarded.plan, assets, { shotId: shot.id, tagResolver: null, positionPolicy: "same" });
        const payload = validateV5Payload(prepared.payload);
        shotResult.payload = payload;
        if (!payload.ok) throw new Error(payload.errors.join("; "));
        shotResult.ok = true;
      } catch (error) {
        shotResult.error = error.message;
        preflight.ok = false;
      }
      preflight.shots.push(shotResult);
    }
  }

  const semantics = semanticMetrics(benchmarkCase, plan);
  const blockingErrors = [
    ...errors,
    ...(audit.errors || []).map((item) => `audit: ${item}`),
    ...preflight.shots.filter((shot) => !shot.ok).map((shot) => `${shot.shotId}: ${shot.error}`),
  ];
  return {
    pass: contract && countExact && requestExact && presetsExact && actorCountsExact && audit.ok && preflight.ok && semantics.requestCoverage,
    contract: { ok: contract },
    countExact,
    requestExact,
    presetsExact,
    actorCountsExact,
    audit,
    preflight,
    semantics,
    blockingErrors,
  };
}

function semanticMetrics(benchmarkCase, plan) {
  const shots = Array.isArray(plan?.shots) ? plan.shots : [];
  const unique = (selector) => new Set(shots.map(selector).map(normalize)).size;
  const directionText = shots.map((shot) => stableJson(shot.direction || {})).join(" ").toLowerCase();
  const generationText = shots.map((shot) => stableJson(shot.generation || {})).join(" ").toLowerCase();
  const cameraVariation = unique((shot) => `${shot.direction?.shotSize}|${shot.direction?.cameraHeight}|${shot.direction?.cameraAngle}|${shot.direction?.viewpoint}`);
  const placementVariation = unique((shot) => shot.direction?.subjectPlacement);
  const actionVariation = unique((shot) => `${shot.direction?.pose}|${shot.direction?.action}`);
  const expressionVariation = unique((shot) => `${shot.direction?.gaze}|${shot.direction?.expression}`);
  const duplicateAcceptable = cameraVariation >= 3 && actionVariation >= 4;
  const sequenceContinuity = benchmarkCase.mode !== "sequence" || shots.slice(1).every((shot) => Boolean(shot.continuity?.carriesFrom));
  const interactionAccuracy = benchmarkCase.id !== "two-actor-editorial" || shots.every((shot) => {
    const text = `${shot.direction?.action || ""} ${shot.direction?.gaze || ""} ${shot.generation?.supplement || ""} ${(shot.generation?.characters || []).map((actor) => actor.scenePrompt).join(" ")}`.toLowerCase();
    return /(ledger|record|document|page|handoff|review|eye contact)/.test(text)
      && /(together|shared|exchange|pass|receive|handoff|coordinate|both|toward|opposite|beside|review|compare|indicate|reciprocal|eye contact|left|right)/.test(text);
  });
  const difficultCoverage = benchmarkCase.id !== "difficult-direction" || [
    /overhead|top[- ]down|bird.?s[- ]eye/.test(directionText),
    /low angle|floor[- ]level|ground[- ]level/.test(directionText),
    /corner|edge|far (?:left|right)|upper (?:left|right)|lower (?:left|right)/.test(directionText),
    /foreground/.test(directionText + generationText) && /background|distant/.test(directionText + generationText),
    /asymmetr/.test(directionText + generationText),
  ].every(Boolean);
  const requestCoverage = duplicateAcceptable && sequenceContinuity && interactionAccuracy && difficultCoverage;
  return {
    cameraVariation,
    placementVariation,
    actionVariation,
    expressionVariation,
    duplicateAcceptable,
    sequenceContinuity,
    interactionAccuracy,
    difficultCoverage,
    requestCoverage,
  };
}

function fixtureAssets(benchmarkCase) {
  return {
    basePreset: createDefaultPreset({
      metadata: { id: benchmarkCase.presetSelections.basePresetId, name: "Director benchmark V5" },
      prompt_parts: { base: "benchmark base style, 1girl", undesired: "low quality", characters: [] },
      params: { model: "nai-diffusion-5-full", width: 832, height: 1216, seed: 9000, n_samples: 1 },
    }),
    characterPresets: benchmarkCase.actors.map((actor) => component(actor.id, actor.sex === "boy" ? "남성 캐릭터" : "여성 캐릭터", actor.identity)),
    outfitPresets: benchmarkCase.actors.map((actor) => component(actor.outfitPresetId, "의상", actor.outfit)),
    stylePreset: component("style_benchmark_editorial", "그림체", "editorial illustration style"),
    qualityPreset: component("quality_benchmark_v5", "품질", "very aesthetic"),
    cameraPreset: null,
    lightingPreset: null,
  };
}

function component(id, category, prompt) {
  return { schema: "chaessi-character-preset/v1", id, name: id, category, subCategory: "", enabled: true, prompt, undesired: "", centers: [{ x: 0.5, y: 0.5 }] };
}

function summarizeConfig(config) {
  const successful = config.cases.filter((item) => item.process.success);
  const evaluated = config.cases.filter((item) => item.evaluation.pass);
  const durations = successful.map((item) => item.process.durationMs);
  const usage = successful.map((item) => item.process.usage).filter(Boolean);
  return {
    processSuccess: successful.length,
    cases: config.cases.length,
    evaluationPass: evaluated.length,
    allPassed: evaluated.length === config.cases.length,
    totalDurationMs: durations.reduce((sum, value) => sum + value, 0),
    meanDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    usage: usage.length === successful.length && usage.length ? sumUsage(usage) : null,
  };
}

function summarizeMatrix(matrix) {
  return matrix.configs.map((config) => ({ model: config.model, reasoningEffort: config.reasoningEffort, ...config.summary }));
}

function failedEvaluation(message) {
  return { pass: false, blockingErrors: [message] };
}

function extractUsage(stdout) {
  let latest = null;
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const found = findUsage(JSON.parse(line));
      if (found) latest = found;
    } catch {}
  }
  return latest;
}

function findUsage(value) {
  if (!value || typeof value !== "object") return null;
  if (Number.isFinite(value.input_tokens) && Number.isFinite(value.output_tokens)) {
    return {
      inputTokens: value.input_tokens,
      cachedInputTokens: Number.isFinite(value.cached_input_tokens) ? value.cached_input_tokens : null,
      outputTokens: value.output_tokens,
    };
  }
  for (const child of Object.values(value)) {
    const found = findUsage(child);
    if (found) return found;
  }
  return null;
}

function sumUsage(values) {
  return values.reduce((sum, value) => ({
    inputTokens: sum.inputTokens + value.inputTokens,
    cachedInputTokens: sum.cachedInputTokens === null || value.cachedInputTokens === null ? null : sum.cachedInputTokens + value.cachedInputTokens,
    outputTokens: sum.outputTokens + value.outputTokens,
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
}

function runProcess({ executable, args, stdin, timeoutMs }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      resolve({ exitCode: -1, stdout: "", stderr: error.message, timedOut: false });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => { stderr += `\n${error.message}`; });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode: Number.isInteger(exitCode) ? exitCode : -1, stdout, stderr, timedOut });
    });
    child.stdin.end(stdin, "utf8");
  });
}

function parseArguments(args) {
  const configs = [];
  const caseIds = [];
  let executable = process.env.CHAESSI_CODEX_EXECUTABLE || "codex";
  let resultsPath = DEFAULT_RESULTS_PATH;
  let aggregateOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--config") {
      const [model, effort] = String(args[++index] || "").split(":");
      if (!model || !effort) throw new Error("--config must be model:effort.");
      configs.push({ model, effort });
    } else if (args[index] === "--case") caseIds.push(String(args[++index] || ""));
    else if (args[index] === "--codex") executable = String(args[++index] || "");
    else if (args[index] === "--results") resultsPath = path.resolve(String(args[++index] || ""));
    else if (args[index] === "--aggregate-only") aggregateOnly = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  return { configs, caseIds, executable, resultsPath, aggregateOnly };
}

function sanitizeDiagnostic(value) {
  return String(value || "")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(?:api[_-]?key|access[_-]?token)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
    .trim().slice(-4000);
}
function stableJson(value) { return JSON.stringify(sortObject(value)); }
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  return value;
}
function normalize(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function sha256(value) { return createHash("sha256").update(String(value), "utf8").digest("hex"); }
function safeName(value) { return value.replace(/[^A-Za-z0-9_.-]+/g, "_"); }
async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
