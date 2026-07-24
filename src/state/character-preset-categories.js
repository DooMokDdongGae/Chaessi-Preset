export const CHARACTER_PRESET_CATEGORY_SCHEMA = "chaessi-character-preset-categories/v1";
export const DEFAULT_CHARACTER_PRESET_CATEGORY = "\uAE30\uD0C0";
export const FEMALE_CLOTHING_CATEGORY = "\uC5EC\uC131 \uC758\uC0C1";
export const MALE_CLOTHING_CATEGORY = "\uB0A8\uC131 \uC758\uC0C1";

export const CHARACTER_PRESET_CATEGORY_ALIASES = Object.freeze({
  "\uC5EC\uC131 \uC544\uC6C3\uD54F": FEMALE_CLOTHING_CATEGORY,
  "\uB0A8\uC131 \uC544\uC6C3\uD54F": MALE_CLOTHING_CATEGORY,
});

const FEMALE_CLOTHING_SUBCATEGORIES = Object.freeze([
  "Casual / \uCE90\uC8FC\uC5BC",
  "Street / \uC2A4\uD2B8\uB9AC\uD2B8",
  "Sporty / \uC2A4\uD3EC\uD2F0",
  "Office / \uC624\uD53C\uC2A4",
  "Girly / \uAC78\uB9AC",
  "Glam / \uAE00\uB7A8",
  "Boudoir / \uBD80\uB450\uC544\uB974",
  "Uniform / \uC720\uB2C8\uD3FC",
]);

const MALE_CLOTHING_SUBCATEGORIES = Object.freeze([
  "Casual / \uCE90\uC8FC\uC5BC",
  "Street / \uC2A4\uD2B8\uB9AC\uD2B8",
  "Sporty / \uC2A4\uD3EC\uD2F0",
  "Office / \uC624\uD53C\uC2A4",
  "Dandy / \uB304\uB514",
  "Glam / \uAE00\uB7A8",
  "Boudoir / \uBD80\uB450\uC544\uB974",
  "Uniform / \uC720\uB2C8\uD3FC",
]);

export const BUILT_IN_CHARACTER_PRESET_CATEGORIES = Object.freeze([
  createBuiltInCategory("\uC5EC\uC131 \uCE90\uB9AD\uD130"),
  createBuiltInCategory("\uB0A8\uC131 \uCE90\uB9AD\uD130"),
  createBuiltInCategory(FEMALE_CLOTHING_CATEGORY, FEMALE_CLOTHING_SUBCATEGORIES),
  createBuiltInCategory(MALE_CLOTHING_CATEGORY, MALE_CLOTHING_SUBCATEGORIES),
  createBuiltInCategory("\uAD6C\uB3C4\u00B7\uCE74\uBA54\uB77C"),
  createBuiltInCategory("\uBC30\uACBD\u00B7\uC18C\uD488"),
  createBuiltInCategory("\uC870\uBA85"),
  createBuiltInCategory("\uADF8\uB9BC\uCCB4"),
  createBuiltInCategory("\uD488\uC9C8"),
  createBuiltInCategory(DEFAULT_CHARACTER_PRESET_CATEGORY),
]);

export function normalizeCharacterPresetCategoryName(value) {
  const name = String(value || "").trim();
  return CHARACTER_PRESET_CATEGORY_ALIASES[name] || name || DEFAULT_CHARACTER_PRESET_CATEGORY;
}

export function createBuiltInCategory(name, subcategories = []) {
  return Object.freeze({
    name,
    builtIn: true,
    subcategories: Object.freeze([...subcategories]),
  });
}

export function cloneBuiltInCharacterPresetCategories() {
  return BUILT_IN_CHARACTER_PRESET_CATEGORIES.map((category, order) => ({
    name: category.name,
    order,
    builtIn: true,
    subcategories: [...category.subcategories],
  }));
}
