import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import sharp from 'sharp';
import {manualChapters} from '../src/ui/manual-content.js';
import {APP_VERSION} from '../src/state/build-version.js';
test('Build version matches the package source and About contains no stale literal version',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(APP_VERSION,pkg.version);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="healthStatus"/g)||[]).length,1);assert.ok(html.indexOf('id="healthStatus"')<html.indexOf('id="openImageIntakeButton"'));assert.doesNotMatch(html.slice(html.indexOf('<dialog id="aboutDialog"')),/3\.5\.0|3\.6\.0/);
});
test('All thirteen tool topics and all three languages resolve to decodable packaged illustrations',async()=>{
 assert.equal(manualChapters.filter(c=>c.tool).length,13);const checked=new Set();
 for(const c of manualChapters)for(const locale of ['ko','en','ja']){
  const files=[`assets/manuals/${locale}/${c.image}.png`,...(c.illustrations??[]).map(i=>{assert.ok(i.caption[locale]);return i.screenshot?`assets/manuals/${locale}/${i.screenshot}.png`:`assets/manuals/examples/${i.file}`;})];
  for(const f of files){assert.ok(!f.includes('..'));if(checked.has(f))continue;checked.add(f);const data=await readFile(new URL('../'+f,import.meta.url));const image=await sharp(data).metadata();assert.ok(image.width>0&&image.height>0);assert.ok(!image.exif&&!image.xmp,'No source metadata in help assets');}
 }
 assert.ok(checked.size>=90);
});
