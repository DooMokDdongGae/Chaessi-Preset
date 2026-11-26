// NovelAI caps the sum of absolute strengths only for a multi-Vibe selection.
export function effectiveVibeStrengths(weights, normalize) {
  const total = weights.reduce((sum, weight) => sum + Math.abs(weight), 0);
  if (!Number.isFinite(total)) throw new Error("The combined Vibe Strength is too large.");
  return normalize && weights.length > 1 && total > 1 ? weights.map(weight => weight / total) : [...weights];
}

// V4.5 Full Text to Image, one output. The V5 effort multiplier and stamina do not apply.
export function estimateVibeCost({ width, height, steps, sm, sm_dyn }, count, opusEligible = null) {
  if (![width, height, steps].every(value => Number.isSafeInteger(value) && value > 0)
      || !Number.isInteger(count) || count < 1 || count > 16) throw new Error("Invalid Vibe cost settings.");
  const pixels = width * height;
  const stepsCost = Math.ceil(0.000002951823174884865 * pixels + 0.0000005753298233447344 * pixels * steps);
  const sampling = sm ? (sm_dyn ? 1.4 : 1.2) : 1;
  const base = Math.max(2, Math.ceil(stepsCost * sampling));
  if (base > 140) throw new Error("The generation exceeds NovelAI's price limit.");
  const surcharge = Math.max(0, count - 4) * 2;
  const eligibleSize = pixels <= 1_048_576 && steps <= 28;
  const allowanceTotal = eligibleSize ? surcharge : base + surcharge;
  return { base, surcharge, total: opusEligible === true ? allowanceTotal : base + surcharge,
    allowanceTotal, conditional: eligibleSize && opusEligible == null };
}
