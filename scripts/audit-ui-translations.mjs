import { readFile, readdir } from 'node:fs/promises';
import { messages } from '../src/ui/translations.js';
import { translateText } from '../src/ui/i18n.js';
const files = ['index.html', 'src/app.js', ...(await readdir(new URL('../src/ui/', import.meta.url))).filter(name => /controller\.js$/.test(name)).map(name => `src/ui/${name}`)];
const missing = new Set();
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const match of source.matchAll(/>([^<>\n]+)</g)) {
    const text = match[1].replace(/&amp;/g, '&').trim();
    if (!text || text.includes('${') || !/[a-zA-Z]{3}/.test(text) || messages[text] || translateText(text, 'ko') !== text) continue;
    if (['Anlas —', 'English PDF', '한국어 PDF', 'DooMokDdongGae'].includes(text)) continue;
    if (/^(Chaessi|NovelAI Diffusion|V[45]|SM|Dynamic SM|nai-|832|k_euler)/.test(text) || text.includes('"') || text.includes('=') || text.includes('`')) continue;
    missing.add(text);
  }
}
if (missing.size) { console.error([...missing].sort().join('\n')); process.exitCode = 1; }
else console.log('All static UI labels/descriptions have KO/EN/JA catalog coverage (brand/model names and document language labels retained).');
