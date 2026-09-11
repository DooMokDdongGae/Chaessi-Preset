const IMPLICIT_ACTOR_PATTERN = /\b(another person|another woman|another man|arriving guest|male guest|female guest|customer|someone|staff member|passerby|crowd|couple|group|guest(?!\s+(?:ledger|book|room|suite|key|card|list|record)))\b/gi;
const DIRECTOR_SLOT_ACTOR_PATTERN = /\b(girl|boy|woman|man|person|people|guest|customer|staff|bellhop|employee|worker|waiter|waitress|she|he|her|him)\b/gi;

export function guardActorCountSemantics({ declaredActors, fields, rewriteSafe = true }) {
  if (!Number.isInteger(declaredActors) || declaredActors < 1) {
    throw new Error("declaredActors must be a positive integer.");
  }
  const rewrittenFields = {};
  const issues = [];
  for (const field of fields) {
    const original = String(field?.text || "");
    let rewritten = original;
    const matches = [...original.matchAll(IMPLICIT_ACTOR_PATTERN)];
    for (const match of matches) {
      const term = match[0];
      const minimumActors = minimumActorsFor(term);
      if (declaredActors >= minimumActors) continue;
      const safe = rewriteSafe ? applySafeRewrite(rewritten, term) : null;
      if (safe) rewritten = safe.text;
      issues.push({
        type: "implicit-extra-actor",
        term,
        declaredActors,
        minimumActors,
        location: field.location,
        resolution: safe ? "safe-rewrite" : "warning",
        ...(safe ? { rewrite: { from: safe.from, to: safe.to } } : {}),
      });
    }
    rewrittenFields[field.location] = rewritten;
  }
  return {
    ok: issues.every((issue) => issue.resolution === "safe-rewrite"),
    issues,
    rewrittenFields,
    requiresSemanticReview: issues.some((issue) => issue.resolution === "warning"),
  };
}

export function guardScenePlanV2Shot(plan, { shotId = plan?.shots?.[0]?.id, rewriteSafe = true } = {}) {
  const guardedPlan = structuredClone(plan);
  const shot = guardedPlan?.shots?.find((item) => item.id === shotId);
  if (!shot) throw guardError("shot-not-found", `Unknown shot id: ${shotId}`);
  const declaredActors = shot.generation.characters.length;
  const fields = [
    { location: "base.mainPrompt", text: shot.generation.mainPrompt },
    { location: "base.supplement", text: shot.generation.supplement },
    ...shot.generation.characters.map((actor, index) => ({
      location: `actors[${index}].modifier`,
      text: actor.scenePrompt,
    })),
  ];
  const report = guardActorCountSemantics({ declaredActors, fields, rewriteSafe });
  const directorSlotIssues = findDirectorSlotActorCues(shot);
  report.issues.push(...directorSlotIssues);
  report.ok = report.ok && directorSlotIssues.length === 0;
  report.requiresSemanticReview = report.requiresSemanticReview || directorSlotIssues.length > 0;
  shot.generation.mainPrompt = report.rewrittenFields["base.mainPrompt"];
  shot.generation.supplement = report.rewrittenFields["base.supplement"];
  shot.generation.characters.forEach((actor, index) => {
    actor.scenePrompt = report.rewrittenFields[`actors[${index}].modifier`];
  });
  return { plan: guardedPlan, report };
}

function findDirectorSlotActorCues(shot) {
  const fields = ["cameraHeight", "cameraAngle", "viewpoint", "subjectPlacement", "depth"];
  return fields.flatMap((field) => {
    const text = String(shot.direction[field] || "");
    return [...text.matchAll(DIRECTOR_SLOT_ACTOR_PATTERN)].map((match) => ({
      type: "director-slot-actor-cue",
      term: match[0],
      declaredActors: shot.generation.characters.length,
      location: `direction.${field}`,
      resolution: "warning",
    }));
  });
}

function minimumActorsFor(term) {
  const normalized = term.toLowerCase();
  if (normalized === "crowd" || normalized === "group") return 3;
  return 2;
}

function applySafeRewrite(text, term) {
  if (term.toLowerCase() !== "arriving guest") return null;
  const pattern = /welcoming\s+(?:an?\s+)?arriving guest/i;
  const match = text.match(pattern);
  if (!match) return null;
  const to = "holding a professional welcoming pose";
  return { text: text.replace(pattern, to), from: match[0], to };
}

function guardError(code, message) {
  return Object.assign(new Error(message), { code });
}
