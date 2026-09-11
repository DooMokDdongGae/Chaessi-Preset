import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  auditScenePlanV2,
  projectShotToScenePlanV1,
  validateImageDirectorRequest,
  validateScenePlanV2,
} from "./src/state/image-director-contract.js";
import { validateScenePlan } from "./src/state/scene-plan.js";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./examples/image-maker/${name}`, import.meta.url), "utf8"));
}

const cases = [
  ["single", "director-request-single.json", "director-single.json"],
  ["editorial", "director-request-editorial-6.json", "director-editorial-6.json"],
  ["sequence", "director-request-sequence-4.json", "director-sequence-4.json"],
];

for (const [name, requestFile, planFile] of cases) {
  test(`${name} director request and scene-plan pass deterministic checks`, async () => {
    const request = await fixture(requestFile);
    const plan = await fixture(planFile);
    assert.equal(validateImageDirectorRequest(request).ok, true);
    assert.equal(validateScenePlanV2(plan).ok, true);
    const audit = auditScenePlanV2(plan);
    assert.equal(audit.ok, true, audit.errors.join("\n"));
    assert.deepEqual(audit.errors, []);
    assert.deepEqual(audit.warnings, []);
    assert.equal(plan.request, request.request);
    assert.equal(plan.count, request.count);
    assert.equal(plan.mode, request.mode);
    assert.deepEqual(plan.presetSelections, request.presetSelections);
    assert.equal(plan.shots.every((shot) => !Object.hasOwn(shot.generation, "intent")), true);
    assert.equal(plan.shots.every((shot) => shot.direction.visibilityRequirements.length > 0), true);
  });
}

test("single scene-plan projects losslessly to the current v1 composer contract", async () => {
  const plan = await fixture("director-single.json");
  const projected = projectShotToScenePlanV1(plan, "shot_001");
  assert.equal(validateScenePlan(projected).ok, true);
  assert.equal(projected.basePresetId, plan.presetSelections.basePresetId);
  assert.equal(projected.scene.mainPrompt, plan.shots[0].generation.mainPrompt);
  assert.equal(projected.scene.supplement, plan.shots[0].generation.supplement);
  assert.equal(projected.overrides.seed, plan.shots[0].generation.seed);
  assert.throws(() => projectShotToScenePlanV1(invalidPlanPlaceholder, "shot_001"));
});

test("actor position is backward-compatible and constrained to normalized coordinates", async () => {
  const plan = await fixture("director-editorial-6.json");
  plan.shots[0].generation.characters[0].position = null;
  assert.equal(validateScenePlanV2(plan).ok, true);
  plan.shots[0].generation.characters[0].position = { x: 0.25, y: 0.55 };
  assert.equal(validateScenePlanV2(plan).ok, true);
  plan.shots[0].generation.characters[0].position.x = 1.01;
  assert.throws(() => validateScenePlanV2(plan), /from 0 to 1/);
});

test("v2 refuses silent loss and catches structural, continuity and known visual contradictions", async () => {
  const editorial = await fixture("director-editorial-6.json");
  assert.throws(() => projectShotToScenePlanV1(editorial, "shot_001"), /cannot consume/);

  const duplicate = structuredClone(editorial);
  for (const key of ["shotSize", "cameraAngle", "subjectPlacement", "pose", "action", "gaze", "expression"]) {
    duplicate.shots[1].direction[key] = duplicate.shots[0].direction[key];
  }
  assert.equal(auditScenePlanV2(duplicate).ok, false);

  const locked = structuredClone(editorial);
  locked.shots[2].continuity.location = "roof garden";
  assert.match(auditScenePlanV2(locked).errors.join(" "), /locked location/);

  const closeWalking = structuredClone(editorial);
  closeWalking.shots[3].direction.action = "walking full body through lobby";
  assert.match(auditScenePlanV2(closeWalking).errors.join(" "), /close-up/);

  const unknownCharacter = structuredClone(editorial);
  unknownCharacter.shots[0].generation.characters[0].characterPresetId = "character_unknown";
  assert.throws(() => validateScenePlanV2(unknownCharacter), /unselected/);

  const sequence = await fixture("director-sequence-4.json");
  sequence.shots[2].continuity.carriesFrom = null;
  assert.match(auditScenePlanV2(sequence).errors.join(" "), /carry state/);

  const leakedMetadata = await fixture("director-single.json");
  leakedMetadata.shots[0].generation.intent = "should be metadata";
  assert.throws(() => validateScenePlanV2(leakedMetadata), /unsupported/);
});

const invalidPlanPlaceholder = null;
