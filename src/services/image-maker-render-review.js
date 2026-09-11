export function classifyImageMakerRenderReview({ structuralIssues = [], renderObservation = {} } = {}) {
  if (!Array.isArray(structuralIssues)) throw new Error("structuralIssues must be an array.");
  if (!renderObservation || typeof renderObservation !== "object" || Array.isArray(renderObservation)) throw new Error("renderObservation must be an object.");
  if (structuralIssues.length) {
    return {
      status: "failed",
      classification: "structural-failure",
      failureType: "SEMANTIC_RENDER",
      structuralIssues,
      renderObservation,
    };
  }
  const artifactKeys = ["extraPerson", "extraProp", "styleDecoration", "backgroundElement"];
  const hasRendererArtifact = artifactKeys.some((key) => renderObservation[key] === true);
  return {
    status: "passed",
    classification: hasRendererArtifact ? "renderer-artifact" : "matched-intent",
    structuralIssues: [],
    renderObservation,
  };
}
