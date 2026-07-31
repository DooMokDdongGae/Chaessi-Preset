export const PRECISE_REFERENCE_TYPES = Object.freeze({
  CHARACTER: "character",
  STYLE: "style",
  CHARACTER_AND_STYLE: "character&style",
});

export const MAX_PRECISE_REFERENCES = 16;

export function applyPreciseReferences(payload, references = []) {
  const active = normalizePreciseReferences(references).filter((reference) => reference.enabled);
  if (!active.length) return payload;

  const next = structuredClone(payload);
  next.parameters.director_reference_images = active.map((reference) => reference.image_base64);
  next.parameters.director_reference_descriptions = active.map((reference) => ({
    caption: {
      base_caption: reference.type,
      char_captions: [],
    },
    legacy_uc: false,
  }));
  next.parameters.director_reference_information_extracted = active.map(() => 1);
  next.parameters.director_reference_strength_values = active.map((reference) => reference.strength);
  next.parameters.director_reference_secondary_strength_values = active.map((reference) => 1 - reference.fidelity);
  return next;
}

export function normalizePreciseReferences(references = []) {
  if (!Array.isArray(references)) throw preciseReferenceError("Precise references must be an array.");
  if (references.length > MAX_PRECISE_REFERENCES) {
    throw preciseReferenceError(`Use no more than ${MAX_PRECISE_REFERENCES} Precise References.`);
  }
  return references.map((reference, index) => normalizePreciseReference(reference, index));
}

export function validatePreciseReferencePayload(payload, references = []) {
  const active = normalizePreciseReferences(references).filter((reference) => reference.enabled);
  const errors = [];
  const fields = [
    "director_reference_images",
    "director_reference_descriptions",
    "director_reference_information_extracted",
    "director_reference_strength_values",
    "director_reference_secondary_strength_values",
  ];

  if (!active.length) {
    for (const field of fields) {
      if (payload.parameters?.[field] !== undefined) errors.push(`${field} must be absent without active references`);
    }
    return { ok: errors.length === 0, errors, warnings: [] };
  }

  for (const field of fields) {
    if (!Array.isArray(payload.parameters?.[field]) || payload.parameters[field].length !== active.length) {
      errors.push(`${field} length does not match active Precise References`);
    }
  }
  const warnings = [];
  const styleStrength = active
    .filter((reference) => reference.type !== PRECISE_REFERENCE_TYPES.CHARACTER)
    .reduce((total, reference) => total + reference.strength, 0);
  if (styleStrength > 0.8) warnings.push("High combined Style reference strength may be too strong for Inpaint.");
  return { ok: errors.length === 0, errors, warnings };
}

function normalizePreciseReference(reference, index) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    throw preciseReferenceError(`Precise Reference ${index + 1} is invalid.`);
  }
  const type = String(reference.type || PRECISE_REFERENCE_TYPES.CHARACTER);
  if (!Object.values(PRECISE_REFERENCE_TYPES).includes(type)) {
    throw preciseReferenceError(`Precise Reference ${index + 1} has an unsupported type.`);
  }
  const imageBase64 = cleanBase64(reference.image_base64);
  if (!imageBase64) throw preciseReferenceError(`Precise Reference ${index + 1} has no PNG image.`);
  return {
    id: String(reference.id || `reference-${index + 1}`).slice(0, 80),
    enabled: reference.enabled !== false,
    type,
    strength: finiteNumber(reference.strength, 1, `Precise Reference ${index + 1} strength`),
    fidelity: finiteNumber(reference.fidelity, 1, `Precise Reference ${index + 1} fidelity`),
    image_base64: imageBase64,
    source_info: normalizeSourceInfo(reference.source_info),
  };
}

function cleanBase64(value) {
  const text = String(value || "").trim();
  const clean = text.includes(",") ? text.slice(text.indexOf(",") + 1) : text;
  return clean && /^[A-Za-z0-9+/=\r\n]+$/.test(clean) ? clean : "";
}

function finiteNumber(value, fallback, label) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(number)) throw preciseReferenceError(`${label} must be a finite number.`);
  return Number(number.toFixed(4));
}

function normalizeSourceInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    file_name: String(source.file_name || "reference-image").replace(/[\u0000-\u001f]/g, "").slice(0, 180),
    original_width: positiveIntegerOrNull(source.original_width),
    original_height: positiveIntegerOrNull(source.original_height),
    transmitted_width: positiveIntegerOrNull(source.transmitted_width),
    transmitted_height: positiveIntegerOrNull(source.transmitted_height),
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function preciseReferenceError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.type = "invalid_precise_reference";
  error.publicMessage = message;
  return error;
}
