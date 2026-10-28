// Wildcard tests only: all NovelAI traffic is intercepted; no paid requests.
import './mock-novelai.mjs';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
const provider = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const address = String(url);
  if (address.startsWith('https://image.novelai.net/ai/generate-image')) {
    const payload = JSON.parse(await options.body.get('request').text());
    const root = process.env.CHAESSI_USER_DATA_DIR;
    if (payload.input.includes('FAIL_WILDCARD')) return new Response('Wildcard test provider failure', {status: 503});
    if (payload.input.includes('WAIT_WILDCARD')) {
      await writeFile(path.join(root, 'wildcard-request-started'), '1');
      for (let n = 0; n < 200; n++) {
        if (await readFile(path.join(root, 'wildcard-request-release')).then(() => true).catch(() => false)) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    return provider(url, options);
  }
  if (address === 'https://image.novelai.net/user/data') return Response.json({subscription: {tier: 3, active: true, trainingStepsLeft: {fixedTrainingStepsLeft: 1000, purchasedTrainingSteps: 0}, usage: {percent: 100, isNegative: false}}});
  if (address.startsWith('https:')) return new Response('External network disabled in Wildcard tests', {status: 403});
  return provider(url, options);
};
