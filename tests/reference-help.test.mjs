import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {manualChapters} from '../src/ui/manual-content.js';

test('V5 reference chapters have complete localized support, options, cost and independent-library guidance', () => {
  const ids=['v5-reference','v5-reference-types','v5-reference-cost','reference-library'];
  for(const id of ids) {
    const c=manualChapters.find(c=>c.id===id);
    assert.ok(c,id);
    for(const locale of ['ko','en','ja']) {
      assert.equal(c[locale].length,4);
      assert.ok(c[locale].every(Boolean));
      assert.equal(c[locale][2].length,6);
    }
  }
  const support=manualChapters.find(c=>c.id==='v5-reference');
  for(const locale of ['ko','en','ja']) {
    const text=JSON.stringify(support[locale]);
    for(const required of ['V5 Full','High','Medium','I2I','Inpaint','V5 Vibe','16']) assert.ok(text.includes(required),`${locale}: ${required}`);
  }
  const models=manualChapters.find(c=>c.id==='models');
  assert.doesNotMatch(JSON.stringify(models),/enable an encoded Vibe|인코딩된 바이브를 사용하는 텍스트 생성을 지원|エンコード済みの Vibe を有効/);
});

test('Reused V5 help illustrations match the reviewed unchanged source inventory and exclude Vibe comparison boards', async () => {
  const inventory=JSON.parse(await readFile(new URL('../assets/manuals/v5-reference-provenance.json',import.meta.url),'utf8'));
  const expected=new Map(inventory.assets.map(a=>[a.file,a.sha256]));
  for(const c of manualChapters.filter(c=>['v5-reference','v5-reference-types','v5-reference-cost','reference-library'].includes(c.id))) {
    const files=[...(c.imageFile?[`assets/manuals/examples/${c.imageFile}`]:[]),...c.illustrations.map(i=>`assets/manuals/examples/${i.file}`)];
    assert.equal(c.image,null,'Prior full-screen Vibe UI must not be active how-to art');
    for(const file of files) {
      assert.doesNotMatch(file,/quality-0[78]-vibe/);
      assert.ok(expected.has(file),file);
      const hash=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
      assert.equal(hash,expected.get(file),file);
    }
  }
  const reader=await readFile(new URL('../src/ui/manual-reader.js',import.meta.url),'utf8');
  assert.ok(reader.includes("['#preciseReferencePanel > .section-row', 'v5-reference']"));
  // Library dialog is created later during app initialization; use the stable host.
  assert.ok(reader.includes("['#referenceLibraryTools', 'reference-library']"));
});
