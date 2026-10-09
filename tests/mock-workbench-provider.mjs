import "./mock-novelai.mjs";
const imageFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) === "https://image.novelai.net/user/data") return new Response(JSON.stringify({ subscription: { trainingStepsLeft: { fixedTrainingStepsLeft: 100, purchasedTrainingSteps: 0 }, usage: 0 } }), { status: 200, headers: { "content-type": "application/json" } });
  if (String(url).startsWith("https://") && !String(url).startsWith("https://image.novelai.net/ai/generate-image")) throw new Error("External request blocked in isolated workbench test");
  return imageFetch(url, options);
};
