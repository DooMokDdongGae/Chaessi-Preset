import { assertNoSecretMaterial, sanitizeStoreId } from "../services/file-store-utils.js";

export const IMAGE_DIRECTOR_REQUEST_SCHEMA = "chaessi-image-director-request/v1";
export const SCENE_PLAN_V2_SCHEMA = "chaessi-scene-plan/v2";

const MODES = new Set(["single", "editorial", "sequence"]);
const SHOT_SIZES = new Set(["establishing", "wide", "full-body", "cowboy", "medium", "close-up", "detail"]);
const RHYTHM_ROLES = new Set(["establishing", "hero", "portrait", "action", "service", "transition", "detail", "resolution"]);
const CONTINUITY_POLICIES = new Set(["locked", "tracked", "free"]);

export function validateImageDirectorRequest(request) {
  assertPlainObject(request, "director request");
  exactKeys(request, ["schema", "request", "count", "mode", "presetSelections", "directing"] , "director request");
  assertNoSecretMaterial(request, "director request");
  if (request.schema !== IMAGE_DIRECTOR_REQUEST_SCHEMA) throw new Error("Unsupported Image Director request schema.");
  requiredText(request.request, "request");
  positiveInteger(request.count, "count");
  enumValue(request.mode, MODES, "mode");
  if (request.mode === "single" && request.count !== 1) throw new Error("single mode requires count=1.");
  if (request.mode !== "single" && request.count < 2) throw new Error(`${request.mode} mode requires at least two shots.`);
  validatePresetSelections(request.presetSelections);
  assertPlainObject(request.directing, "directing");
  exactKeys(request.directing, [
    "keepCharacterConsistent", "keepOutfitConsistent", "varyCamera", "varyPose",
    "varyExpression", "preserveLocation", "trackProps", "additionalConstraints",
  ], "directing");
  for (const key of ["keepCharacterConsistent", "keepOutfitConsistent", "varyCamera", "varyPose", "varyExpression", "preserveLocation", "trackProps"]) {
    if (typeof request.directing[key] !== "boolean") throw new Error(`directing.${key} must be boolean.`);
  }
  optionalText(request.directing.additionalConstraints, "directing.additionalConstraints");
  return { ok: true, errors: [], warnings: [] };
}

export function validateScenePlanV2(plan) {
  assertPlainObject(plan, "scene-plan");
  exactKeys(plan, ["schema", "request", "mode", "count", "presetSelections", "continuity", "shots"], "scene-plan");
  assertNoSecretMaterial(plan, "scene-plan");
  if (plan.schema !== SCENE_PLAN_V2_SCHEMA) throw new Error("Unsupported scene-plan v2 schema.");
  requiredText(plan.request, "request");
  positiveInteger(plan.count, "count");
  enumValue(plan.mode, MODES, "mode");
  if (plan.mode === "single" && plan.count !== 1) throw new Error("single mode requires count=1.");
  if (!Array.isArray(plan.shots) || plan.shots.length !== plan.count) throw new Error("shots length must equal count.");
  validatePresetSelections(plan.presetSelections);
  validateContinuityPolicy(plan.continuity, plan.mode);

  const ids = new Set();
  plan.shots.forEach((shot, arrayIndex) => {
    validateShot(shot, arrayIndex + 1, plan.presetSelections);
    if (ids.has(shot.id)) throw new Error(`Duplicate shot id: ${shot.id}`);
    ids.add(shot.id);
  });
  for (const shot of plan.shots) {
    const priorIds = new Set(plan.shots.slice(0, shot.index - 1).map((item) => item.id));
    if (shot.continuity.carriesFrom !== null && !priorIds.has(shot.continuity.carriesFrom)) {
      throw new Error(`${shot.id}.continuity.carriesFrom must reference an earlier shot.`);
    }
  }
  return { ok: true, errors: [], warnings: [] };
}

// Deterministic checks only. Visual meaning still requires a director review.
export function auditScenePlanV2(plan) {
  validateScenePlanV2(plan);
  const errors = [];
  const warnings = [];
  const signatures = new Map();
  const fixedLocation = plan.shots[0]?.continuity.location;
  const fixedOutfit = plan.shots[0]?.continuity.outfitState;

  for (const shot of plan.shots) {
    const direction = shot.direction;
    const signature = [
      direction.shotSize, direction.cameraAngle, direction.subjectPlacement,
      direction.pose, direction.action, direction.gaze, direction.expression,
    ]
      .map(normalizeText).join("|");
    if (signatures.has(signature)) errors.push(`${shot.id} repeats the camera/pose/expression signature of ${signatures.get(signature)}.`);
    else signatures.set(signature, shot.id);
    const combined = normalizeText(Object.values(direction).flat().join(" "));
    if (direction.shotSize === "close-up" && /walking|running|full body/.test(combined)) {
      errors.push(`${shot.id} uses a close-up for an action that requires wider body visibility.`);
    }
    if (/head out of frame/.test(combined) && (direction.expression || direction.gaze)) {
      errors.push(`${shot.id} describes expression or gaze while the head is out of frame.`);
    }
    if (/from behind/.test(combined) && /looking at (the )?viewer/.test(combined)) {
      errors.push(`${shot.id} combines from-behind staging with looking at viewer.`);
    }
    if (plan.continuity.location === "locked" && shot.continuity.location !== fixedLocation) {
      errors.push(`${shot.id} changes a locked location.`);
    }
    if (plan.continuity.outfit === "locked" && shot.continuity.outfitState !== fixedOutfit) {
      errors.push(`${shot.id} changes a locked outfit.`);
    }
    if (!shot.direction.visibilityRequirements.length) warnings.push(`${shot.id} has no visibility requirements.`);
    if (!shot.generation.supplement.trim()) warnings.push(`${shot.id} has no natural-language supplement.`);
  }
  if (plan.mode === "sequence") {
    plan.shots.slice(1).forEach((shot) => {
      if (!shot.continuity.carriesFrom) errors.push(`${shot.id} must carry state from an earlier shot in sequence mode.`);
    });
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    requiresSemanticReview: [
      "user request coverage", "preset content fidelity", "visual similarity beyond exact signatures",
      "camera/crop/action fit beyond known contradictions", "expression/intent fit",
      "physical plausibility and occlusion", "prompt vocabulary quality",
    ],
  };
}

// Compatibility adapter for the current Phase 1 composer. It refuses information loss.
export function projectShotToScenePlanV1(plan, shotId) {
  validateScenePlanV2(plan);
  const shot = plan.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`Unknown shot id: ${shotId}`);
  if (shot.generation.characters.length || shot.generation.undesiredPrompt) {
    throw new Error("Current v1 composer cannot consume per-character or undesired prompt overrides.");
  }
  return {
    schema: "chaessi-scene-plan/v1",
    request: plan.request,
    basePresetId: plan.presetSelections.basePresetId,
    scene: {
      mainPrompt: shot.generation.mainPrompt,
      supplement: shot.generation.supplement,
    },
    ...(shot.generation.seed === null ? {} : { overrides: { seed: shot.generation.seed } }),
  };
}

function validatePresetSelections(selections) {
  assertPlainObject(selections, "presetSelections");
  exactKeys(selections, [
    "basePresetId", "characterPresetIds", "outfitPresetIds", "stylePresetId",
    "qualityPresetId", "cameraPresetId", "lightingPresetId",
  ], "presetSelections");
  exactId(selections.basePresetId, "presetSelections.basePresetId");
  for (const key of ["characterPresetIds", "outfitPresetIds"]) {
    if (!Array.isArray(selections[key])) throw new Error(`presetSelections.${key} must be an array.`);
    const seen = new Set();
    selections[key].forEach((id, index) => {
      exactId(id, `presetSelections.${key}[${index}]`);
      if (seen.has(id)) throw new Error(`presetSelections.${key} contains a duplicate ID.`);
      seen.add(id);
    });
  }
  for (const key of ["stylePresetId", "qualityPresetId", "cameraPresetId", "lightingPresetId"]) {
    if (selections[key] !== null) exactId(selections[key], `presetSelections.${key}`);
  }
}

function validateContinuityPolicy(continuity, mode) {
  assertPlainObject(continuity, "continuity");
  exactKeys(continuity, ["characterIdentity", "outfit", "location", "props", "screenDirection"], "continuity");
  for (const key of Object.keys(continuity)) enumValue(continuity[key], CONTINUITY_POLICIES, `continuity.${key}`);
  if (mode === "sequence" && continuity.characterIdentity === "free") throw new Error("Sequence identity cannot be free.");
}

function validateShot(shot, expectedIndex, selections) {
  assertPlainObject(shot, `shot ${expectedIndex}`);
  exactKeys(shot, ["id", "index", "intent", "rhythmRole", "direction", "continuity", "generation"], `shot ${expectedIndex}`);
  if (!/^shot_[0-9]{3,}$/.test(shot.id)) throw new Error(`Shot ${expectedIndex} has an invalid id.`);
  if (shot.index !== expectedIndex) throw new Error(`Shot indices must be contiguous and ordered from 1.`);
  requiredText(shot.intent, `${shot.id}.intent`);
  enumValue(shot.rhythmRole, RHYTHM_ROLES, `${shot.id}.rhythmRole`);
  validateDirection(shot.direction, shot.id);
  validateShotContinuity(shot.continuity, shot.id);
  validateGeneration(shot.generation, shot.id, selections);
}

function validateDirection(direction, shotId) {
  assertPlainObject(direction, `${shotId}.direction`);
  exactKeys(direction, [
    "shotSize", "cameraHeight", "cameraAngle", "viewpoint", "bodyOrientation", "pose",
    "action", "gaze", "expression", "subjectPlacement", "depth", "lighting",
    "visibilityRequirements",
  ], `${shotId}.direction`);
  enumValue(direction.shotSize, SHOT_SIZES, `${shotId}.direction.shotSize`);
  for (const key of ["cameraHeight", "cameraAngle", "viewpoint", "bodyOrientation", "pose", "action", "gaze", "expression", "subjectPlacement", "depth", "lighting"]) {
    requiredText(direction[key], `${shotId}.direction.${key}`);
  }
  textArray(direction.visibilityRequirements, `${shotId}.direction.visibilityRequirements`);
}

function validateShotContinuity(continuity, shotId) {
  assertPlainObject(continuity, `${shotId}.continuity`);
  exactKeys(continuity, ["location", "outfitState", "props", "screenDirection", "carriesFrom"], `${shotId}.continuity`);
  requiredText(continuity.location, `${shotId}.continuity.location`);
  requiredText(continuity.outfitState, `${shotId}.continuity.outfitState`);
  requiredText(continuity.screenDirection, `${shotId}.continuity.screenDirection`);
  if (continuity.carriesFrom !== null && typeof continuity.carriesFrom !== "string") throw new Error(`${shotId}.continuity.carriesFrom must be a shot id or null.`);
  if (!Array.isArray(continuity.props)) throw new Error(`${shotId}.continuity.props must be an array.`);
  const ids = new Set();
  continuity.props.forEach((prop, index) => {
    assertPlainObject(prop, `${shotId}.continuity.props[${index}]`);
    exactKeys(prop, ["id", "state"], `${shotId}.continuity.props[${index}]`);
    exactId(prop.id, `${shotId}.continuity.props[${index}].id`);
    requiredText(prop.state, `${shotId}.continuity.props[${index}].state`);
    if (ids.has(prop.id)) throw new Error(`${shotId} contains a duplicate prop id.`);
    ids.add(prop.id);
  });
}

function validateGeneration(generation, shotId, selections) {
  assertPlainObject(generation, `${shotId}.generation`);
  exactKeys(generation, ["mainPrompt", "supplement", "characters", "undesiredPrompt", "seed"], `${shotId}.generation`);
  requiredText(generation.mainPrompt, `${shotId}.generation.mainPrompt`);
  optionalText(generation.supplement, `${shotId}.generation.supplement`);
  optionalText(generation.undesiredPrompt, `${shotId}.generation.undesiredPrompt`);
  if (generation.seed !== null) integerRange(generation.seed, 0, 4294967295, `${shotId}.generation.seed`);
  if (!Array.isArray(generation.characters)) throw new Error(`${shotId}.generation.characters must be an array.`);
  const selected = new Set(selections.characterPresetIds);
  const seen = new Set();
  generation.characters.forEach((character, index) => {
    assertPlainObject(character, `${shotId}.generation.characters[${index}]`);
    optionalKeys(character, ["characterPresetId", "visibleFeaturesPrompt", "scenePrompt", "undesiredPrompt"], ["position"], `${shotId}.generation.characters[${index}]`);
    exactId(character.characterPresetId, `${shotId}.generation.characters[${index}].characterPresetId`);
    if (!selected.has(character.characterPresetId)) throw new Error(`${shotId} references an unselected character preset.`);
    if (seen.has(character.characterPresetId)) throw new Error(`${shotId} duplicates a character preset.`);
    seen.add(character.characterPresetId);
    optionalText(character.visibleFeaturesPrompt, `${shotId}.generation.characters[${index}].visibleFeaturesPrompt`);
    requiredText(character.scenePrompt, `${shotId}.generation.characters[${index}].scenePrompt`);
    optionalText(character.undesiredPrompt, `${shotId}.generation.characters[${index}].undesiredPrompt`);
    if (character.position !== undefined && character.position !== null) validateActorPosition(character.position, `${shotId}.generation.characters[${index}].position`);
  });
}

function validateActorPosition(position, label) {
  assertPlainObject(position, label);
  exactKeys(position, ["x", "y"], label);
  for (const axis of ["x", "y"]) {
    if (typeof position[axis] !== "number" || !Number.isFinite(position[axis]) || position[axis] < 0 || position[axis] > 1) {
      throw new Error(`${label}.${axis} must be a finite number from 0 to 1.`);
    }
  }
}

function exactId(value, label) {
  if (typeof value !== "string" || !value || sanitizeStoreId(value) !== value) throw new Error(`${label} must be an exact preset ID.`);
}
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}
function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`${label} is missing fields: ${missing.join(", ")}.`);
}
function optionalKeys(value, required, optional, label) {
  const allowed = [...required, ...optional];
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`${label} is missing fields: ${missing.join(", ")}.`);
}
function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty text.`);
}
function optionalText(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
}
function textArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty text.`);
}
function integerRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max}.`);
}
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer.`);
}
function enumValue(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} has an unsupported value.`);
}
function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
