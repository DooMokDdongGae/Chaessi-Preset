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
}), { anlasBalance: 10000, staminaPercent: 99.5 });
assert.deepEqual(projectNovelAiAccountUsage({ anlasBalance: 10000, staminaPercent: 99.5, privateField: "must-not-leak" }), {
  anlas_balance: 10000,
  stamina_percent: 99.5,
});

let observedAuthorization = "";
const fetched = await fetchNovelAiAccountUsage({
  token: "test-secret-token",
  fetchImpl: async (_url, options) => {
    observedAuthorization = options.headers.Authorization;
    return {
      ok: true,
      json: async () => ({
        subscription: {
          trainingStepsLeft: 1234,
          usage: { percent: 88, isNegative: false },
        },
      }),
    };
  },
});
assert.equal(observedAuthorization, "Bearer test-secret-token");
assert.deepEqual(fetched, { anlasBalance: 1234, staminaPercent: 88 });

console.log("NovelAI account usage tests passed.");
