import { rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  CHARACTER_PRESET_CATEGORY_SCHEMA,
  cloneBuiltInCharacterPresetCategories,
  normalizeCharacterPresetCategoryName,
} from "../state/character-preset-categories.js";
import {
  assertNoSecretMaterial,
  ensureDir,
  readJsonFile,
  storeError,
} from "./file-store-utils.js";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_CATEGORY_NAME_LENGTH = 120;

export function createCharacterPresetCategoryStore({ rootDir }) {
  const categoryDir = path.join(rootDir, "data", "character-preset-categories");
  const categoryFile = path.join(categoryDir, "categories.json");

  return {
    filePath: categoryFile,

    async listCategories() {
      const loaded = await readStoredConfig({ allowCorruptFallback: true });
      return {
        schema: CHARACTER_PRESET_CATEGORY_SCHEMA,
        categories: mergeWithBuiltIns(loaded.config?.categories),
        warning: loaded.warning,
      };
    },

    async addCategory(value) {
      const name = normalizeCharacterPresetCategoryName(validateCategoryName(value));
      const loaded = await readStoredConfig({ allowCorruptFallback: false });
      const categories = mergeWithBuiltIns(loaded.config?.categories);
      assertUniqueName(categories.map((category) => category.name), name, "category_exists", "Category already exists.");
      categories.push({
        name,
        order: categories.length,
        builtIn: false,
        subcategories: [],
      });
      await writeConfig(categories);
      return {
        schema: CHARACTER_PRESET_CATEGORY_SCHEMA,
        categories,
        warning: null,
      };
    },

    async addSubcategory(categoryValue, subcategoryValue) {
      const categoryName = normalizeCharacterPresetCategoryName(validateCategoryName(categoryValue));
      const subcategoryName = validateCategoryName(subcategoryValue);
      const loaded = await readStoredConfig({ allowCorruptFallback: false });
      const categories = mergeWithBuiltIns(loaded.config?.categories);
      const category = categories.find((item) => sameName(item.name, categoryName));
      if (!category) {
        throw storeError(404, "category_not_found", "Category not found.");
      }
      assertUniqueName(
        category.subcategories,
        subcategoryName,
        "subcategory_exists",
        "Subcategory already exists in this category.",
      );
      category.subcategories.push(subcategoryName);
      await writeConfig(categories);
      return {
        schema: CHARACTER_PRESET_CATEGORY_SCHEMA,
        categories,
        warning: null,
      };
    },
  };

  async function readStoredConfig({ allowCorruptFallback }) {
    if (!existsSync(categoryFile)) return { config: null, warning: null };
    try {
      const config = await readJsonFile(categoryFile);
      if (!config || config.schema !== CHARACTER_PRESET_CATEGORY_SCHEMA || !Array.isArray(config.categories)) {
        throw new Error("Unsupported category configuration.");
      }
      return { config, warning: null };
    } catch {
      if (!allowCorruptFallback) {
        throw storeError(
          409,
          "category_config_corrupt",
          "The saved category configuration is invalid. Categories were not changed.",
        );
      }
      return {
        config: null,
        warning: "Saved category configuration is invalid. Built-in categories are being used.",
      };
    }
  }

  async function writeConfig(categories) {
    const config = {
      schema: CHARACTER_PRESET_CATEGORY_SCHEMA,
      categories: categories.map((category, order) => ({
        name: category.name,
        order,
        builtIn: category.builtIn === true,
        subcategories: [...category.subcategories],
      })),
    };
    assertNoSecretMaterial(config, categoryFile);
    await ensureDir(categoryDir);
    const temporaryFile = path.join(categoryDir, `categories.${process.pid}.${Date.now()}.tmp`);
    try {
      await writeFile(temporaryFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      await rename(temporaryFile, categoryFile);
    } catch (error) {
      await unlink(temporaryFile).catch(() => {});
      throw error;
    }
  }
}

export function validateCategoryName(value) {
  const name = String(value ?? "").trim().normalize("NFC");
  if (!name) {
    throw storeError(400, "invalid_category_name", "Category name cannot be empty.");
  }
  if (CONTROL_CHARACTERS.test(name)) {
    throw storeError(400, "invalid_category_name", "Category name cannot contain control characters.");
  }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw storeError(400, "invalid_category_name", `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`);
  }
  return name;
}

export function mergeWithBuiltIns(storedCategories = []) {
  const merged = cloneBuiltInCharacterPresetCategories();
  for (const stored of Array.isArray(storedCategories) ? storedCategories : []) {
    if (!stored || typeof stored !== "object") continue;
    let name;
    try {
      name = normalizeCharacterPresetCategoryName(validateCategoryName(stored.name));
    } catch {
      continue;
    }
    let category = merged.find((item) => sameName(item.name, name));
    if (!category) {
      category = {
        name,
        order: merged.length,
        builtIn: false,
        subcategories: [],
      };
      merged.push(category);
    }
    for (const value of Array.isArray(stored.subcategories) ? stored.subcategories : []) {
      try {
        const subcategory = validateCategoryName(value);
        if (!category.subcategories.some((existing) => sameName(existing, subcategory))) {
          category.subcategories.push(subcategory);
        }
      } catch {
        // Invalid stored names are ignored without blocking startup.
      }
    }
  }
  return merged.map((category, order) => ({ ...category, order }));
}

function assertUniqueName(existingNames, candidate, type, message) {
  if (existingNames.some((name) => sameName(name, candidate))) {
    throw storeError(409, type, message);
  }
}

function sameName(left, right) {
  return String(left).trim().normalize("NFC").toLocaleLowerCase()
    === String(right).trim().normalize("NFC").toLocaleLowerCase();
}
