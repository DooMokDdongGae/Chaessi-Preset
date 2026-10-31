// No external service is contacted by the confirmation/input tests.
import './mock-novelai.mjs';
import {appendFile} from 'node:fs/promises';
import path from 'node:path';
const provider = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const address = String(url);
  if (address.startsWith('https://image.novelai.net/ai/generate-image')) {
    await appendFile(path.join(process.env.CHAESSI_USER_DATA_DIR, 'mock-generations.jsonl'), JSON.stringify({at:Date.now(),mock:true})+'\n');
    return provider(url, options);
  }
  if (address === 'https://image.novelai.net/user/data') return Response.json({subscription:{tier:3,active:true,trainingStepsLeft:{fixedTrainingStepsLeft:1000,purchasedTrainingSteps:0},usage:{percent:100,isNegative:false}}});
  if (/^https?:/.test(address)) throw new Error('External network disabled in confirmation tests');
  return provider(url, options);
};
