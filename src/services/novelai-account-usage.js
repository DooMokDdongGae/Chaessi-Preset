const NOVELAI_USER_DATA_ENDPOINT = "https://image.novelai.net/user/data";

export async function fetchNovelAiAccountUsage({ token, fetchImpl = fetch, signal } = {}) {
  const authToken = String(token || "").trim();
  if (!authToken) throw accountUsageError("missing_token", "NovelAI token missing.", 500);

  const response = await fetchImpl(NOVELAI_USER_DATA_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: "application/json",
    },
    signal,
  });
  if (!response.ok) {
    throw accountUsageError(
      "novelai_account_usage_failed",
      "NovelAI account usage request failed.",
      response.status || 502,
    );
  }

  return parseNovelAiAccountUsage(await response.json());
}

export function parseNovelAiAccountUsage(payload) {
  const subscription = payload?.subscription;
  if (!subscription || typeof subscription !== "object") {
    throw accountUsageError("invalid_account_usage", "NovelAI account response has no subscription data.", 502);
  }

  return {
    anlasBalance: normalizeAnlasBalance(subscription.trainingStepsLeft),
    staminaPercent: normalizeStaminaPercent(subscription.usage),
  };
}

export function projectNovelAiAccountUsage(usage) {
  return {
    anlas_balance: usage?.anlasBalance ?? null,
    stamina_percent: usage?.staminaPercent ?? null,
  };
}

export function normalizeAnlasBalance(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (value && typeof value === "object") {
    const fixedValue = Number(value.fixedTrainingStepsLeft);
    const purchasedValue = Number(value.purchasedTrainingSteps);
    if (!Number.isFinite(fixedValue) && !Number.isFinite(purchasedValue)) return null;
    const fixed = Number.isFinite(fixedValue) ? fixedValue : 0;
    const purchased = Number.isFinite(purchasedValue) ? purchasedValue : 0;
    return Math.max(0, Math.floor(fixed + purchased));
  }
  return null;
}

export function normalizeStaminaPercent(usage) {
  if (!usage || typeof usage !== "object") return null;
  const percent = Number(usage.percent);
  if (!Number.isFinite(percent)) return null;
  if (usage.isNegative === true) return 0;
  return Math.min(100, Math.max(0, percent));
}

function accountUsageError(type, publicMessage, statusCode) {
  const error = new Error(publicMessage);
  error.type = type;
  error.publicMessage = publicMessage;
  error.statusCode = statusCode;
  return error;
}

export { NOVELAI_USER_DATA_ENDPOINT };
