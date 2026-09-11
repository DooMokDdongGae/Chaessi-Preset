import { validateScenePlanV2 } from "../state/image-director-contract.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";
import { createCharacterPart } from "../state/preset-schema.js";
import { guardActorCountSemantics } from "./actor-count-semantic-guard.js";
import { resolvePresetRandomPrompts } from "./prompt-random-resolver.js";
import { prepareResolvedPreset } from "./preset-composer.js";

export const PREPARED_GENERATION_V2_SCHEMA = "chaessi-prepared-generation/v2";
export const NAI_V5_DOCUMENTED_CHARACTER_LIMIT = 22;
export const POSITION_MAPPING_POLICIES = Object.freeze(["anchor-only", "same", "near-same"]);

export function compileScenePlanV2Shot(plan, assets, {
  shotId = plan?.shots?.[0]?.id,
  tagResolver = null,
  randomFn = Math.random,
  positionPolicy = "same",
  rewriteSafeImplicitActors = true,
} = {}) {
  const scenePlanValidation = validateScenePlanV2(plan);
  validateAssetBinding(plan.presetSelections, assets);
  const shot = plan.shots.find((item) => item.id === shotId);
  if (!shot) throw composerError("shot-not-found", `Unknown shot id: ${shotId}`);
  if (shot.generation.characters.length !== assets.characterPresets.length) {
    throw composerError("actor-count-mismatch", "Every selected actor must have one shot generation entry.");
  }

  const actorsById = new Map(shot.generation.characters.map((actor) => [actor.characterPresetId, actor]));
  const orderedActors = assets.characterPresets.map((identity, index) => ({
    identity,
    outfit: assets.outfitPresets[index] || null,
    direction: actorsById.get(identity.id),
    subject: subjectForCategory(identity.category),
    index,
  }));
  if (orderedActors.some((actor) => !actor.direction)) {
    throw composerError("actor-binding-mismatch", "Shot actor IDs do not match selected characterPresetIds.");
  }
  if (!POSITION_MAPPING_POLICIES.includes(positionPolicy)) {
    throw composerError("invalid-position-policy", `Unsupported position mapping policy: ${positionPolicy}`);
  }

  const subjectCount = compileSubjectCount(orderedActors.map((actor) => actor.subject));
  const semanticGuard = guardActorCountSemantics({
    declaredActors: orderedActors.length,
    rewriteSafe: rewriteSafeImplicitActors,
    fields: [
      { location: "base.mainPrompt", text: shot.generation.mainPrompt },
      { location: "base.supplement", text: shot.generation.supplement },
      ...orderedActors.map((actor, index) => ({ location: `actors[${index}].modifier`, text: actor.direction.scenePrompt })),
    ],
  });
  const globalResolved = resolveGeneratedText(semanticGuard.rewrittenFields["base.mainPrompt"], tagResolver);
  const baseSource = assets.stylePreset || {
    prompt: assets.basePreset.prompt_parts.base,
    undesired: assets.basePreset.prompt_parts.undesired,
  };
  const basePrompt = joinPrompt(
    subjectCount,
    stripAllSubjectCounts(baseSource.prompt),
    assets.qualityPreset?.prompt,
    assets.lightingPreset?.prompt,
    stripAllSubjectCounts(globalResolved.text),
    semanticGuard.rewrittenFields["base.supplement"],
  );
  const baseUndesired = joinPrompt(
    baseSource.undesired,
    assets.qualityPreset?.undesired,
    assets.lightingPreset?.undesired,
    shot.generation.undesiredPrompt,
  );

  const semanticSlots = {
    director: compileDirectorSlot(shot, assets.cameraPreset),
    actors: orderedActors.map((actor) => compileActorSlot(actor, orderedActors.length, tagResolver, positionPolicy,
      semanticGuard.rewrittenFields[`actors[${actor.index}].modifier`])),
  };
  const subjectMappingAudit = validateSubjectMapping(subjectCount, semanticSlots, basePrompt);
  if (!subjectMappingAudit.ok) {
    throw composerError("invalid-subject-mapping", "Subject tokens do not follow Anchor/Modifier rules.", subjectMappingAudit);
  }
  const positionAudit = auditActorPositions(semanticSlots.actors);
  if (!positionAudit.ok) {
    throw composerError("position-order-conflict", "Actor positions conflict with slot order or spatial prompt text.", positionAudit);
  }
  const interactionAudit = auditInteractions(semanticSlots.actors, tagResolver);
  const requirementConflicts = semanticSlots.actors.flatMap((actor) => actor.requirementConflicts);
  if (requirementConflicts.length) {
    throw composerError("requirement-conflict", "One or more action tags conflict with the selected outfit.", {
      conflicts: requirementConflicts,
    });
  }
  if (interactionAudit.errors.length) {
    throw composerError("invalid-interaction-tags", "Interaction tags are unverified or incomplete.", interactionAudit);
  }

  const mapped = mapSemanticSlotsToNaiCharacters(semanticSlots);
  if (mapped.characters.length > NAI_V5_DOCUMENTED_CHARACTER_LIMIT) {
    throw composerError("too-many-nai-slots", `Composer v2 is limited to ${NAI_V5_DOCUMENTED_CHARACTER_LIMIT} NAI character prompts.`);
  }
  const preset = structuredClone(assets.basePreset);
  preset.prompt_parts = { base: basePrompt, undesired: baseUndesired, characters: mapped.characters };
  if (shot.generation.seed !== null) preset.params.seed = shot.generation.seed;
  if (preset.params.model !== NOVELAI_V5_FULL_MODEL) throw composerError("wrong-model", "Composer v2 requires V5 Full.");
  const resolvedPreset = resolvePresetRandomPrompts(preset, randomFn);
  assertNoPipeSyntax(resolvedPreset);
  const prepared = prepareResolvedPreset(resolvedPreset);

  return {
    schema: PREPARED_GENERATION_V2_SCHEMA,
    shotId,
    subjectCount,
    semanticSlots,
    naiSlotMap: mapped.slotMap,
    resolvedPreset,
    payload: prepared.payload,
    requestBody: { preset: structuredClone(resolvedPreset) },
    validation: {
      scenePlan: scenePlanValidation,
      preset: prepared.presetValidation,
      payload: prepared.payloadValidation,
      interactions: interactionAudit,
      requirements: { ok: true, conflicts: [] },
      subjectMapping: subjectMappingAudit,
      semanticGuard,
      positions: positionAudit,
    },
    tagResolutions: {
      base: globalResolved.results,
      actors: semanticSlots.actors.map((actor) => ({ actorId: actor.actorId, results: actor.tagResolutions })),
    },
    warnings: [
      ...(assets.stylePreset ? ["Explicit stylePresetId replaced the base preset prompt and undesired prompt."] : []),
      ...interactionAudit.warnings,
      ...semanticGuard.issues.map((issue) => issue.resolution === "safe-rewrite"
        ? `Rewrote implicit actor cue at ${issue.location}: ${issue.rewrite.from} → ${issue.rewrite.to}.`
        : `Implicit extra actor cue at ${issue.location}: ${issue.term}.`),
    ],
  };
}

export function compileDirectorSlot(shot, cameraPreset) {
  const direction = shot.direction;
  const prompt = joinPrompt(
    stripAllSubjectCounts(cameraPreset?.prompt || ""),
    shotSizeTag(direction.shotSize),
    direction.cameraHeight,
    direction.cameraAngle,
    direction.viewpoint,
    direction.subjectPlacement,
    direction.depth,
  );
  return {
    role: "director",
    prompt,
    undesired: String(cameraPreset?.undesired || ""),
    centers: [{ x: 0.5, y: 0.5 }],
    positionMode: "custom",
  };
}

export function mapSemanticSlotsToNaiCharacters(semanticSlots) {
  const characters = [];
  const slotMap = [];
  push("director", semanticSlots.director, "Director Slot");
  semanticSlots.actors.forEach((actor, index) => {
    push(`actor-${index + 1}-anchor`, actor.anchorSlot, `Actor ${index + 1} Anchor`);
    push(`actor-${index + 1}-modifier`, actor.modifierSlot, `Actor ${index + 1} Modifier`);
  });
  return { characters, slotMap };

  function push(semanticRole, slot, name) {
    const naiIndex = characters.length + 1;
    characters.push(createCharacterPart({
      id: `composer_v2_slot_${naiIndex}`,
      name,
      enabled: true,
      prompt: slot.prompt,
      undesired: slot.undesired,
      centers: slot.centers,
      position_mode: slot.positionMode,
    }));
    slotMap.push({ semanticRole, naiCharacterNumber: naiIndex });
  }
}

function compileActorSlot(actor, actorCount, tagResolver, positionPolicy, scenePromptText) {
  const position = actor.direction.position || null;
  const slotPositions = mapActorPosition(position, positionPolicy);
  const anchorPrompt = ensureAnchorSubject(
    joinPrompt(actor.identity.prompt, actor.direction.visibleFeaturesPrompt), actor.subject,
  );
  const sceneResolved = resolveGeneratedText(scenePromptText, tagResolver);
  const outfitPrompt = stripAllSubjectCounts(actor.outfit?.prompt || "");
  const modifierPrompt = stripAllSubjectCounts(joinPrompt(outfitPrompt, sceneResolved.text));
  const actionTags = collectActionTags(modifierPrompt, tagResolver);
  return {
    actorId: actor.identity.id,
    sex: actor.subject,
    position,
    anchorSlot: {
      role: "anchor",
      presetId: actor.identity.id,
      prompt: anchorPrompt,
      undesired: String(actor.identity.undesired || ""),
      centers: slotPositions.anchor.centers,
      positionMode: slotPositions.anchor.positionMode,
    },
    modifierSlot: {
      role: "modifier",
      outfitPresetId: actor.outfit?.id || null,
      prompt: modifierPrompt,
      undesired: joinPrompt(actor.outfit?.undesired, actor.direction.undesiredPrompt),
      centers: slotPositions.modifier.centers,
      positionMode: slotPositions.modifier.positionMode,
    },
    actionTags,
    tagResolutions: sceneResolved.results,
    requirementConflicts: tagResolver?.validateRequirements({ actionTags, outfitPrompt }) || [],
  };
}

function auditInteractions(actors, tagResolver) {
  const interactions = actors.flatMap((actor, actorIndex) => extractInteractionTags(actor.modifierSlot.prompt)
    .map((item) => ({ ...item, actorIndex })));
  const errors = [];
  const warnings = [];
  for (const item of interactions) {
    if (!tagResolver?.hasTag(item.action, "action")) {
      errors.push({ type: "unverified-interaction-tag", actorIndex: item.actorIndex, tag: item.raw });
    }
  }
  const byAction = new Map();
  interactions.forEach((item) => {
    if (!byAction.has(item.action)) byAction.set(item.action, []);
    byAction.get(item.action).push(item);
  });
  for (const [action, items] of byAction) {
    const roles = new Set(items.map((item) => item.role));
    const mutualActors = new Set(items.filter((item) => item.role === "mutual").map((item) => item.actorIndex));
    const paired = (roles.has("source") && roles.has("target")) || mutualActors.size >= 2;
    if (!paired) errors.push({ type: "unpaired-interaction-tag", action, roles: [...roles] });
  }
  if (actors.length > 1 && !interactions.length) {
    warnings.push("No verified interaction tags were used; natural-language relation text remains in the base supplement or actor scene prompts.");
  }
  return { ok: errors.length === 0, errors, warnings, interactions };
}

function collectActionTags(prompt, resolver) {
  if (!resolver) return [];
  const tags = [];
  for (const fragment of String(prompt).split(",")) {
    const value = fragment.trim();
    const interaction = value.match(/^(?:source|target|mutual)#(.+)$/i);
    const candidate = interaction ? interaction[1] : value;
    if (resolver.hasTag(candidate, "action")) tags.push(normalizeLooseTag(candidate));
  }
  return [...new Set(tags)];
}

function extractInteractionTags(text) {
  return String(text || "").split(",").map((fragment) => {
    const raw = fragment.trim();
    const match = raw.match(/^(source|target|mutual)#(.+)$/i);
    return match ? { raw, role: match[1].toLowerCase(), action: normalizeLooseTag(match[2]) } : null;
  }).filter(Boolean);
}

function validateAssetBinding(selections, assets) {
  if (assets?.basePreset?.metadata?.id !== selections.basePresetId) {
    throw composerError("base-binding-mismatch", "Resolved base preset does not match scene-plan selection.");
  }
  compareIds(selections.characterPresetIds, assets.characterPresets, "character");
  compareIds(selections.outfitPresetIds, assets.outfitPresets, "outfit");
  for (const [selectionKey, assetKey] of [["stylePresetId", "stylePreset"], ["qualityPresetId", "qualityPreset"], ["cameraPresetId", "cameraPreset"], ["lightingPresetId", "lightingPreset"]]) {
    if ((assets[assetKey]?.id || null) !== selections[selectionKey]) {
      throw composerError("component-binding-mismatch", `${selectionKey} does not match resolved assets.`);
    }
  }
}

function compareIds(expected, actual, label) {
  const ids = (actual || []).map((item) => item.id);
  if (JSON.stringify(expected || []) !== JSON.stringify(ids)) {
    throw composerError("component-binding-mismatch", `${label} preset order does not match scene-plan selection.`);
  }
}

function compileSubjectCount(subjects) {
  const counts = new Map();
  subjects.forEach((subject) => counts.set(subject, (counts.get(subject) || 0) + 1));
  return ["girl", "boy"].filter((subject) => counts.has(subject))
    .map((subject) => `${counts.get(subject)}${subject}${counts.get(subject) === 1 ? "" : "s"}`)
    .join(", ");
}

function subjectForCategory(category) {
  if (category === "여성 캐릭터") return "girl";
  if (category === "남성 캐릭터") return "boy";
  throw composerError("unsupported-subject-category", `Cannot derive a NovelAI subject from category ${category}.`);
}

function resolveGeneratedText(text, resolver) {
  return resolver ? resolver.resolvePromptFragments(text) : { text: String(text || ""), results: [] };
}

function ensureAnchorSubject(text, subject) {
  const clean = stripAllSubjectCounts(text);
  const fragments = clean.split(",").map((item) => item.trim()).filter(Boolean);
  return joinPrompt(subject, fragments.join(", "));
}

function stripAllSubjectCounts(text) {
  return stripCounts(text, false);
}

function stripCounts(text, keepPlainSubject) {
  return String(text || "").split(",").map((item) => item.trim()).filter((item) => {
    const normalized = normalizeSubjectFragment(item);
    if (/^\d+(?:\+)?(?:girl|girls|boy|boys|other|others)$/.test(normalized)) return false;
    if (["solo", "single_character", "multiple_girls", "multiple_boys", "multiple_others"].includes(normalized)) return false;
    if (!keepPlainSubject && ["girl", "boy", "other"].includes(normalized)) return false;
    return true;
  }).join(", ");
}

function validateSubjectMapping(subjectCount, semanticSlots, basePrompt) {
  const errors = [];
  const baseSubjects = subjectDeclarations(basePrompt);
  const expectedBaseSubjects = subjectCount.split(",").map((item) => item.trim()).filter(Boolean);
  if (JSON.stringify(baseSubjects) !== JSON.stringify(expectedBaseSubjects)) {
    errors.push(`Base must contain only the computed subject declarations: ${subjectCount}.`);
  }
  if (subjectDeclarations(semanticSlots.director.prompt).length) errors.push("Director Slot contains a subject token.");
  for (const [index, actor] of semanticSlots.actors.entries()) {
    const anchorSubjects = subjectDeclarations(actor.anchorSlot.prompt);
    if (anchorSubjects.length !== 1 || anchorSubjects[0] !== actor.sex) {
      errors.push(`Actor ${index + 1} Anchor must contain exactly one ${actor.sex} token.`);
    }
    if (subjectDeclarations(actor.modifierSlot.prompt).length) {
      errors.push(`Actor ${index + 1} Modifier contains a forbidden subject token.`);
    }
  }
  const expected = compileSubjectCount(semanticSlots.actors.map((actor) => actor.sex));
  if (subjectCount !== expected) errors.push(`Base subject count must be ${expected}.`);
  return { ok: errors.length === 0, errors, actorCount: semanticSlots.actors.length, subjectCount };
}

function subjectDeclarations(text) {
  return String(text || "").split(",").map(normalizeSubjectFragment)
    .filter((item) => /^(?:girl|boy|\d+(?:\+)?(?:girl|girls|boy|boys))$/.test(item));
}

function normalizeSubjectFragment(value) {
  return normalizeLooseTag(value)
    .replace(/^[{[]+/, "").replace(/[}\]]+$/, "")
    .replace(/^-?\d+(?:\.\d+)?::/, "").replace(/::$/, "");
}

function mapActorPosition(position, policy) {
  if (!position) {
    const automatic = { centers: [{ x: 0.5, y: 0.5 }], positionMode: "auto" };
    return { anchor: automatic, modifier: structuredClone(automatic) };
  }
  const anchor = { centers: [position], positionMode: "custom" };
  if (policy === "anchor-only") {
    return { anchor, modifier: { centers: [position], positionMode: "auto" } };
  }
  const modifierPosition = policy === "near-same"
    ? { x: Math.min(1, position.x + 0.005), y: position.y }
    : position;
  return { anchor, modifier: { centers: [modifierPosition], positionMode: "custom" } };
}

function auditActorPositions(actors) {
  const errors = [];
  const positioned = actors.filter((actor) => actor.position !== null);
  for (let index = 1; index < positioned.length; index += 1) {
    if (positioned[index - 1].position.x > positioned[index].position.x) {
      errors.push(`Actor ${index} is positioned to the right of Actor ${index + 1}, contrary to slot order.`);
    }
  }
  actors.forEach((actor, index) => {
    if (!actor.position) return;
    const text = actor.modifierSlot.prompt.toLowerCase();
    const placement = spatialPlacementCues(text);
    if (placement.left && actor.position.x > 0.5) errors.push(`Actor ${index + 1} says left but has x=${actor.position.x}.`);
    if (placement.right && actor.position.x < 0.5) errors.push(`Actor ${index + 1} says right but has x=${actor.position.x}.`);
  });
  return {
    ok: errors.length === 0,
    errors,
    actorPositions: actors.map((actor) => ({ actorId: actor.actorId, position: actor.position })),
  };
}

function spatialPlacementCues(text) {
  const side = String(text || "");
  const cue = (direction) => new RegExp([
    `\\b(?:standing|seated|sitting|placed|positioned|located)\\s+(?:slightly\\s+)?(?:on\\s+|at\\s+|to\\s+)?(?:the\\s+)?${direction}\\b`,
    `\\b(?:on|at|to|toward|towards)\\s+the\\s+${direction}\\b`,
    `\\b${direction}(?:-hand)?\\s+side\\b`,
    `\\b${direction}\\s+of\\s+(?:center|frame|the\\s+frame)\\b`,
    `\\bframe\\s+${direction}\\b`,
    `\\bscreen[- ]${direction}\\s+(?:edge|side)\\b`,
  ].join("|"), "i").test(side);
  return { left: cue("left"), right: cue("right") };
}

function shotSizeTag(value) {
  return ({ establishing: "wide shot", "full-body": "full body", cowboy: "cowboy shot", medium: "upper body", "close-up": "close-up", detail: "object focus" })[value] || value;
}

function assertNoPipeSyntax(preset) {
  const texts = [preset.prompt_parts.base, preset.prompt_parts.undesired,
    ...preset.prompt_parts.characters.flatMap((item) => [item.prompt, item.undesired])];
  if (texts.some((text) => /\|/.test(String(text)))) {
    throw composerError("pipe-syntax-not-supported", "Resolved v2 prompts cannot contain | while NAI character prompt slots are in use.");
  }
}

function joinPrompt(...values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
}

function normalizeLooseTag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function composerError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}
