import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHARACTER_PRESET_CATEGORY_SCHEMA,
  cloneBuiltInCharacterPresetCategories,
} from "./src/state/character-preset-categories.js";
import {
  createCharacterPresetCategoryStore,
} from "./src/services/character-preset-category-store.js";
import {
  createCharacterPresetStore,
  normalizeCharacterPreset,
} from "./src/services/character-preset-store.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const names = {
  expression: "\uD45C\uC815",
  smile: "\uBBF8\uC18C",
  sad: "\uC2AC\uD508 \uD45C\uC815",
  style: "\uADF8\uB9BC\uCCB4",
  watercolor: "\uC218\uCC44\uD654",
  lighting: "\uC870\uBA85",
  other: "\uAE30\uD0C0",
  femaleOutfitAlias: "\uC5EC\uC131 \uC544\uC6C3\uD54F",
  femaleClothing: "\uC5EC\uC131 \uC758\uC0C1",
};

await testCategoryStore();
await testPresetCompatibility();
await testServerApi();
await testUiWiring();
console.log("Character preset category tests passed.");

async function testCategoryStore() {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-category-store-"));
  try {
    let store = createCharacterPresetCategoryStore({ rootDir: root });
    const defaults = await store.listCategories();
    assert.equal(defaults.schema, CHARACTER_PRESET_CATEGORY_SCHEMA);
    assert.deepEqual(defaults.categories, cloneBuiltInCharacterPresetCategories());

    const added = await store.addCategory(`  ${names.expression}  `);
    assert.equal(added.categories.at(-1).name, names.expression);
    await store.addSubcategory(names.expression, names.smile);
    await store.addSubcategory(names.style, names.watercolor);
    await store.addSubcategory(names.lighting, names.smile);

    store = createCharacterPresetCategoryStore({ rootDir: root });
    const restored = await store.listCategories();
    assert.equal(restored.categories.at(-1).name, names.expression);
    assert.deepEqual(
      restored.categories.find((item) => item.name === names.expression).subcategories,
      [names.smile],
    );
    assert.ok(restored.categories.find((item) => item.name === names.style).subcategories.includes(names.watercolor));
    assert.ok(restored.categories.find((item) => item.name === names.lighting).subcategories.includes(names.smile));

    await assert.rejects(() => store.addCategory("   "), errorType("invalid_category_name", 400));
    await assert.rejects(() => store.addCategory("Line\nBreak"), errorType("invalid_category_name", 400));
    await assert.rejects(() => store.addCategory(names.expression), errorType("category_exists", 409));
    await assert.rejects(() => store.addCategory(names.expression.toLocaleUpperCase()), errorType("category_exists", 409));
    await assert.rejects(
      () => store.addSubcategory(names.expression, `  ${names.smile}  `),
      errorType("subcategory_exists", 409),
    );
    await store.addSubcategory(names.expression, "Faces / Soft+1");

    const config = JSON.parse(await readFile(store.filePath, "utf8"));
    assert.equal(config.schema, CHARACTER_PRESET_CATEGORY_SCHEMA);
    assert.equal(JSON.stringify(config).includes("prompt"), false);
    assert.equal(JSON.stringify(config).includes("token"), false);

    await writeFile(store.filePath, "{broken", "utf8");
    const corruptFallback = await store.listCategories();
    assert.equal(corruptFallback.categories.length, 10);
    assert.ok(corruptFallback.warning);
    await assert.rejects(() => store.addCategory("Safe"), errorType("category_config_corrupt", 409));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function testPresetCompatibility() {
  const custom = normalizeCharacterPreset({
    id: "custom_category",
    category: names.expression,
    subcategory: names.smile,
    prompt: "smiling",
  });
  assert.equal(custom.schema, "chaessi-character-preset/v1");
  assert.equal(custom.category, names.expression);
  assert.equal(custom.subCategory, names.smile);

  const orphan = normalizeCharacterPreset({
    id: "orphan_category",
    category: "Legacy Custom",
    subCategory: "Legacy Sub",
  });
  assert.equal(orphan.category, "Legacy Custom");
  assert.equal(orphan.subCategory, "Legacy Sub");

  const missing = normalizeCharacterPreset({ id: "missing_category" });
  assert.equal(missing.category, names.other);
  assert.equal(missing.subCategory, "");

  const alias = normalizeCharacterPreset({
    id: "alias_category",
    category: names.femaleOutfitAlias,
    subCategory: "Uniform / \uC720\uB2C8\uD3FC",
  });
  assert.equal(alias.category, names.femaleClothing);
  assert.equal(alias.subCategory, "Uniform / \uC720\uB2C8\uD3FC");

  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-character-preset-"));
  try {
    const store = createCharacterPresetStore({ rootDir: root });
    const saved = await store.saveCharacterPreset(custom, {
      thumbnail: { bytes: Buffer.from("thumbnail"), contentType: "image/webp" },
    });
    const loaded = await store.getCharacterPreset(saved.id);
    assert.equal(loaded.category, names.expression);
    assert.equal(loaded.subCategory, names.smile);
    assert.ok(loaded.thumbnail_path.endsWith("thumbnail.webp"));
    assert.equal((await readFile(path.join(root, loaded.thumbnail_path))).toString(), "thumbnail");
    assert.equal((await store.listCharacterPresets())[0].subCategory, names.smile);
    const saveAs = await store.saveCharacterPreset({ ...custom, id: undefined, name: "Save As" });
    assert.notEqual(saveAs.id, saved.id);
    await store.deleteCharacterPreset(saved.id);
    await store.deleteCharacterPreset(saveAs.id);
    assert.equal((await store.listCharacterPresets()).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function testServerApi() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "chaessi-category-api-"));
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), CHAESSI_USER_DATA_DIR: dataRoot },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  try {
    await waitForHealth(port);
    let response = await getJson(port, "/api/character-preset-categories");
    assert.equal(response.categories.length, 10);

    response = await postJson(port, "/api/character-preset-categories", { name: names.expression }, 201);
    assert.equal(response.categories.at(-1).name, names.expression);
    response = await postJson(port, "/api/character-preset-categories/subcategories", {
      category: names.expression,
      name: names.smile,
    }, 201);
    assert.ok(response.categories.at(-1).subcategories.includes(names.smile));

    const saved = await postJson(port, "/api/character-presets", {
      preset: {
        name: "Custom category API preset",
        category: names.expression,
        subCategory: names.smile,
        prompt: "smiling",
        undesired: "sad",
      },
    });
    const loaded = await getJson(port, `/api/character-presets/${encodeURIComponent(saved.preset.id)}`);
    assert.equal(loaded.preset.category, names.expression);
    assert.equal(loaded.preset.subCategory, names.smile);
    await deleteJson(port, `/api/character-presets/${encodeURIComponent(saved.preset.id)}`);

    const duplicate = await fetch(`http://127.0.0.1:${port}/api/character-preset-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: names.expression }),
    });
    assert.equal(duplicate.status, 409);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.error.type, "category_exists");
  } finally {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    await rm(dataRoot, { recursive: true, force: true });
    if (child.exitCode && child.exitCode !== 0) throw new Error(stderr || `server exited ${child.exitCode}`);
  }
}

async function testUiWiring() {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  const app = await readFile(path.join(ROOT, "src", "app.js"), "utf8");
  for (const id of [
    "manageCharacterPresetCategoriesButton",
    "characterPresetCategoryManagerDialog",
    "categoryManagerAddCategoryButton",
    "categoryManagerAddSubCategoryButton",
  ]) assert.ok(html.includes(`id="${id}"`), `missing UI id: ${id}`);
  assert.ok(app.includes('postJson("/api/character-preset-categories"'));
  assert.ok(app.includes('postJson("/api/character-preset-categories/subcategories"'));
  assert.ok(app.includes("getAllCharacterPresetCategories"));
  assert.ok(app.includes("normalizeCharacterPresetSubCategory"));
}

function errorType(type, statusCode) {
  return (error) => error?.type === type && error?.statusCode === statusCode;
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Server did not become ready.");
}

async function getJson(port, pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return body;
}

async function postJson(port, pathname, value, expectedStatus = 200) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const body = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(body));
  return body;
}

async function deleteJson(port, pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { method: "DELETE" });
  assert.equal(response.ok, true, await response.text());
}
