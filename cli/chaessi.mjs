import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createImageMakerBackend } from "../src/services/image-maker-backend.js";
import { runImageMakerRequest } from "../src/services/image-maker-runner.js";
import { runMultiImageMakerRequest } from "../src/services/image-maker-multi-runner.js";
import { loadDanbooruTagResolver } from "../src/services/danbooru-tag-resolver.js";
import { assertNoSecretMaterial } from "../src/services/file-store-utils.js";

const HELP = `Chaessi Image Maker
  node cli/chaessi.mjs presets --data-root <absolute-root>
  node cli/chaessi.mjs dry-run --data-root <absolute-root> --input <scene-plan.json> --out-dir <new-directory>
  node cli/chaessi.mjs direct-generate --data-root <absolute-root> --input <request.json> --director-plan <scene-plan-v2.json> [--base-url http://127.0.0.1:4174] [--run-id <id>] [--classified-dir <dir>] [--rag-csv <file>] [--dry-run]
  node cli/chaessi.mjs multi-generate --data-root <absolute-root> --input <request-v2.json> --director-plan <multi-scene-plan-v2.json> [--base-url http://127.0.0.1:4174] [--run-id <id>] [--classified-dir <dir>] [--rag-csv <file>] [--dry-run]

direct-generate stores trace artifacts under data/image-maker-runs. It only contacts a loopback Chaessi Local API and never reads or prints a token.`;

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help") {
    console.log(HELP);
  } else if (command === "presets") {
    const options = parseOptions(args, { values: ["--data-root"] });
    requireOptions(options, ["--data-root"]);
    const backend = await createImageMakerBackend({ dataRoot: options["--data-root"] });
    const result = { ok: true, dataRoot: backend.dataRoot, items: await backend.listPresets() };
    assertNoSecretMaterial(result, "preset list");
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "dry-run") {
    const options = parseOptions(args, { values: ["--data-root", "--input", "--out-dir"] });
    requireOptions(options, ["--data-root", "--input", "--out-dir"]);
    const backend = await createImageMakerBackend({ dataRoot: options["--data-root"] });
    const plan = await readJson(options["--input"]);
    const prepared = await backend.prepare(plan);
    const output = path.resolve(options["--out-dir"]);
    const manifest = {
      schema: prepared.schema, dataRoot: backend.dataRoot, scenePlan: plan,
      validation: prepared.validation, warnings: prepared.warnings,
      seed: prepared.resolvedPreset.params.seed,
      localApi: { method: "POST", pathname: "/api/novelai/generate", bodyFile: "request-body.json", sent: false },
    };
    const files = { "resolved-preset.json": prepared.resolvedPreset, "payload.json": prepared.payload,
      "request-body.json": prepared.requestBody, "manifest.json": manifest };
    for (const [name, value] of Object.entries(files)) assertNoSecretMaterial(value, name);
    await mkdir(output);
    for (const [name, value] of Object.entries(files)) await writeFile(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ ok: true, output, model: prepared.payload.model, validation: prepared.validation, sent: false }, null, 2));
  } else if (command === "direct-generate" || command === "multi-generate") {
    const options = parseOptions(args, {
      values: ["--data-root", "--input", "--director-plan", "--base-url", "--run-id", "--classified-dir", "--rag-csv"],
      flags: ["--dry-run"],
    });
    requireOptions(options, ["--data-root", "--input", "--director-plan"]);
    const resolver = options["--classified-dir"] || options["--rag-csv"]
      ? await loadDanbooruTagResolver({ classifiedDir: options["--classified-dir"], ragCsvPath: options["--rag-csv"] })
      : null;
    const common = {
      request: await readJson(options["--input"]),
      directorPlan: await readJson(options["--director-plan"]),
      dataRoot: path.resolve(options["--data-root"]),
      baseUrl: options["--base-url"] || "http://127.0.0.1:4174",
      runId: options["--run-id"],
      dryRun: options["--dry-run"] === true,
      tagResolver: resolver,
    };
    const outcome = command === "multi-generate"
      ? await runMultiImageMakerRequest(common)
      : await runImageMakerRequest(common);
    console.log(JSON.stringify({
      ok: true,
      status: outcome.status,
      runId: outcome.runId,
      runDir: outcome.runDir,
      sent: outcome.generationResult?.localApiCalls === 1 || Number(outcome.manifest?.completedCount || 0) > 0,
      generation: outcome.generationResult?.generation || null,
      requestedCount: outcome.manifest?.requestedCount,
      preparedCount: outcome.manifest?.preparedCount,
      completedCount: outcome.manifest?.completedCount,
      shots: outcome.manifest?.shots,
    }, null, 2));
  } else {
    throw new Error("Unknown command. Use --help.");
  }
} catch (error) {
  const safe = String(error.message || "Operation failed").replace(/pst-[A-Za-z0-9_-]+|Bearer\s+\S+/gi, "[redacted]");
  console.error(JSON.stringify({ ok: false, error: safe, code: error.code, runId: error.runId, runDir: error.runDir }));
  process.exitCode = 1;
}

function parseOptions(args, { values, flags = [] }) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (Object.hasOwn(options, key)) throw new Error("Invalid or duplicate CLI option.");
    if (flags.includes(key)) { options[key] = true; continue; }
    if (!values.includes(key) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Invalid or duplicate CLI option.");
    options[key] = args[index + 1];
    index += 1;
  }
  return options;
}
function requireOptions(options, keys) {
  for (const key of keys) if (!options[key]) throw new Error(`Required option: ${key}`);
}
async function readJson(file) {
  return JSON.parse((await readFile(path.resolve(file), "utf8")).replace(/^\uFEFF/, ""));
}
