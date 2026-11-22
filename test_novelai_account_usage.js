import assert from "node:assert/strict";
import {
  fetchNovelAiAccountUsage,
  normalizeAnlasBalance,
  normalizeStaminaPercent,
  parseNovelAiAccountUsage,
  projectNovelAiAccountUsage,
} from "./src/services/novelai-account-usage.js";

assert.equal(normalizeAnlasBalance(10000), 10000);
assert.equal(normalizeAnlasBalance({ fixedTrainingStepsLeft: 8000, purchasedTrainingSteps: 2000 }), 10000);
assert.equal(normalizeAnlasBalance({}), null);
assert.equal(normalizeAnlasBalance(undefined), null);

assert.equal(normalizeStaminaPercent({ percent: 73.25, isNegative: false }), 73.25);
assert.equal(normalizeStaminaPercent({ percent: 120, isNegative: false }), 100);
assert.equal(normalizeStaminaPercent({ percent: 40, isNegative: true }), 0);
assert.equal(normalizeStaminaPercent(undefined), null);

assert.deepEqual(parseNovelAiAccountUsage({
  subscription: {
    trainingStepsLeft: { fixedTrainingStepsLeft: 6000, purchasedTrainingSteps: 4000 },
    usage: { percent: 99.5, isNegative: false, timeUntilNextPercent: 600 },
  },
}), { anlasBalance: 10000, staminaPercent: 99.5, opusAvailable: false });
assert.deepEqual(projectNovelAiAccountUsage({ anlasBalance: 10000, staminaPercent: 99.5, privateField: "must-not-leak" }), {
  anlas_balance: 10000,
  stamina_percent: 99.5,
  opus_available: null,
});

for (const [active, tier, isNegative, expected] of [
  [true, 3, false, true],
  [false, 3, false, false],
  [true, 2, false, false],
  [true, 3, true, false],
]) {
  const usage = parseNovelAiAccountUsage({ subscription: { active, tier, usage: { isNegative } } });
  assert.equal(usage.opusAvailable, expected);
  assert.deepEqual(projectNovelAiAccountUsage({ ...usage, privateField: "must-not-leak" }), {
    anlas_balance: null, stamina_percent: null, opus_available: expected,
  });
}
assert.equal(projectNovelAiAccountUsage({ opusAvailable: null }).opus_available, null);

let observedAuthorization = "";
const fetched = await fetchNovelAiAccountUsage({
  token: "test-secret-token",
  fetchImpl: async (_url, options) => {
    observedAuthorization = options.headers.Authorization;
    return {
      ok: true,
      json: async () => ({
        subscription: {
          active: true,
          tier: 3,
          trainingStepsLeft: 1234,
          usage: { percent: 88, isNegative: false },
        },
      }),
    };
  },
});
assert.equal(observedAuthorization, "Bearer test-secret-token");
assert.deepEqual(fetched, { anlasBalance: 1234, staminaPercent: 88, opusAvailable: true });

console.log("NovelAI account usage tests passed.");
