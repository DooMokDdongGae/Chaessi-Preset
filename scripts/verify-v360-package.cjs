// Run with the packaged executable in ELECTRON_RUN_AS_NODE mode; never starts the app or reads user data.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
(async () => {
  const root = path.resolve(process.argv[2]);
  const sharp = require(path.join(root, "node_modules", "sharp"));
  assert.equal(sharp.versions.sharp, "0.35.5");
  const { receivedImageToPng } = await import(pathToFileURL(path.join(root, "src/services/generation-png.js")));
  const { parseNovelAiPngMetadata } = await import(pathToFileURL(path.join(root, "src/importers/nai-metadata.js")));
  const image = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 20, b: 30, alpha: .5 } } }).webp({ lossless: true }).toBuffer();
  const result = await receivedImageToPng(image, { input: "adult", model: "nai-diffusion-5-full-medium", action: "generate", parameters: { steps: 14, sampler: "k_euler_ancestral", n_samples: 1, seed: 1 } });
  assert.deepEqual(await sharp(image).raw().toBuffer(), await sharp(result.imageBytes).raw().toBuffer());
  assert.equal(parseNovelAiPngMetadata(result.imageBytes).parsed.params.effort, "medium");
  const fs = require("node:fs");
  const { buildToolPlan } = await import(pathToFileURL(path.join(root, 'src/image-tools/plan.js')));
  const { countDirectorTokens } = await import(pathToFileURL(path.join(root, 'src/image-tools/director-tokens.js')));
  const { createDefaultPreset } = await import(pathToFileURL(path.join(root, 'src/state/preset-schema.js')));
  assert.equal(await countDirectorTokens('blue hair, blue dress'), 5);
  const sourcePng = await sharp(image).png().toBuffer();
  const tool = await buildToolPlan({ tool: 'max-enhance', source: sourcePng, origin: createDefaultPreset({ params: { model: 'nai-diffusion-5-full', effort: 'medium' } }), settings: { effort: 'medium' } });
  assert.equal(tool.payload.parameters.upscaled_enhance, true);
  assert.equal(tool.payload.parameters.steps, 14);
  assert.equal(tool.endpoint, 'https://image.novelai.net/ai/generate-image-stream');
  const { saveImageOperation } = await import(pathToFileURL(path.join(root, 'src/image-tools/store.js')));
  const temporary = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'chaessi-package-tools-'));
  try {
    const saved = await saveImageOperation(temporary, { plan: tool, variants: [{ bytes: sourcePng, label: 'Max' }], costActual: 0 });
    const imported = parseNovelAiPngMetadata(fs.readFileSync(path.join(temporary, saved.image_path)));
    assert.equal(imported.image_operation.tool, 'max-enhance'); assert.equal(imported.parsed.params.effort, 'medium');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  for (const file of ["assets/licenses/sharp-win32-x64-NOTICES.md", "assets/licenses/sharp-win32-x64-LICENSE", "src/state/effort-state.js", "src/ui/prompt-workflow.js", "mcp/server.mjs"]) assert.ok(fs.existsSync(path.join(root, file)), file);
  for (const file of ['src/image-tools/service.js','src/ui/image-tools-controller.js','src/ui/image-tools.css','assets/tokenizers/clip-merges.deflate','assets/licenses/openai-clip-LICENSE','assets/manuals/ko/image-tools.png','assets/manuals/en/image-tools.png','assets/manuals/ja/image-tools.png']) assert.ok(fs.existsSync(path.join(root, file)), file);
  for (const file of ["scripts/launch-v360-live-with-saved-token.mjs", 'scripts/launch-image-tools-live-with-saved-token.mjs', "tests/v360.test.mjs", '.cache', 'data']) assert.equal(fs.existsSync(path.join(root, file)), false, file);
  console.log("Packaged Electron Node runtime: sharp/WebP/PNG/RGBA/Medium import, image operation History, Max flag, CLIP, multilingual tool assets and notices pass; verification scripts/data excluded. Paid calls: 0.");
})().catch(error => { console.error(error); process.exitCode = 1; });
