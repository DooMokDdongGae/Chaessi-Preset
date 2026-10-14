import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolveDataRoot } from '../mcp/server.mjs';

// Read-only smoke test. Its console output contains counts/booleans only,
// never user prompt text, category names, image bytes or credentials.
const root=resolveDataRoot(), data=path.join(root,'data');
async function fingerprint() {
  const files=[];
  async function walk(folder) {
    let entries; try {entries=await readdir(folder,{withFileTypes:true});} catch(e) {if(e.code==='ENOENT') return;throw e;}
    for(const entry of entries) {
      const target=path.join(folder,entry.name);
      if(entry.isDirectory()) await walk(target);
      else if(entry.isFile()) files.push([path.relative(data,target),createHash('sha256').update(await readFile(target)).digest('hex')]);
    }
  }
  for(const section of ['character-presets','character-preset-categories','presets','base-prompts','undesired-prompts','params-presets','generations']) await walk(path.join(data,section));
  return createHash('sha256').update(JSON.stringify(files.sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
}
const before=await fingerprint();
const client=new Client({name:'chaessi-local-smoke',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../mcp/server.mjs',import.meta.url)),'--data-root',root],stderr:'pipe'});
async function call(name,args={}) {
  const result=await client.callTool({name,arguments:args});
  assert.ok(!result.isError,`MCP ${name} failed`);
  return result.structuredContent||JSON.parse(result.content.find(x=>x.type==='text').text);
}
try {
  await client.connect(transport);
  const status=await call('get_status');assert.ok(status.data_available);
  const categories=await call('list_categories');
  let page=await call('list_presets',{limit:100}), count=page.items.length;
  const firstPreset=page.items[0];
  while(page.next_offset!==null) {page=await call('list_presets',{limit:100,offset:page.next_offset,expected_snapshot:page.snapshot});count+=page.items.length;}
  assert.equal(count,page.total);
  if(firstPreset) assert.equal((await call('get_preset',{id:firstPreset.id})).id,firstPreset.id);
  const history=await call('list_history',{limit:100});
  let imageRead=false;
  if(history.items.length) {
    const record=await call('get_history',{id:history.items[0].id});assert.equal(typeof record.final_prompt,'string');
    if(record.image_available) {
      const result=await client.callTool({name:'get_history_image',arguments:{id:record.id}});
      if(!result.isError) {
        const image=result.content.find(x=>x.type==='image');assert.ok(image);
        assert.deepEqual(Buffer.from(image.data,'base64'),await readFile(record.image_path));imageRead=true;
      } else assert.match(result.content[0].text,/image_too_large/);
    }
  }
  const after=await fingerprint();assert.equal(after,before,'User data changed during the read-only smoke test.');
  console.log(JSON.stringify({connected:true,categories:categories.items.length,character_presets:count,history_records:history.total,preset_skipped:page.skipped_count,history_skipped:history.skipped_count,original_image_read:imageRead,user_data_unchanged:true}));
} finally {await client.close();}
