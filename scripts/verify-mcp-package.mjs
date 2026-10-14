import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

const appRoot=fileURLToPath(new URL('../dist/win-unpacked/resources/app/',import.meta.url));
const serverPath=path.join(appRoot,'mcp/server.mjs');
await access(serverPath);
await access(path.join(appRoot,'src/state/preset-sorting.js'));
for (const privatePath of ['data','.env','tests/mcp.test.mjs','scripts/verify-mcp-local.mjs']) {
  await assert.rejects(access(path.join(appRoot,privatePath)),`${privatePath} should not be packaged`);
}
const root=await mkdtemp(path.join(tmpdir(),'chaessi-mcp-package-'));
const folder=path.join(root,'data/character-presets/package_fixture');
await mkdir(folder,{recursive:true});
await writeFile(path.join(folder,'character-preset.json'),JSON.stringify({id:'package_fixture',name:'Packaged MCP',category:'Custom category',prompt:'blue shirt'}));
const client=new Client({name:'chaessi-package-smoke',version:'1.0.0'});
try {
  await client.connect(new StdioClientTransport({command:path.resolve(appRoot,'../../Chaessi Preset.exe'),args:[serverPath,'--data-root',root],env:{...getDefaultEnvironment(),ELECTRON_RUN_AS_NODE:'1'},stderr:'pipe'}));
  assert.equal((await client.listTools()).tools.length,7);
  const result=await client.callTool({name:'list_presets',arguments:{}});
  assert.ok(!result.isError);
  const list=result.structuredContent||JSON.parse(result.content[0].text);
  assert.equal(list.items[0].prompt,'blue shirt');
  console.log('PASS packaged MCP stdio handshake, tools, saved preset read and private-data exclusions');
} finally {await client.close();await rm(root,{recursive:true,force:true});}
