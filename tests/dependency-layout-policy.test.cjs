const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { excludedDependencyPath: excluded, assertDependencyPolicy } = require("../scripts/dependency-layout-policy.cjs");
const { copyDependencies, verifyCopiedDependencies } = require("../scripts/package-dependencies.cjs");
function json(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v));}
function fixture(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'chaessi-layout-policy-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test("only reviewed package/version trees are excluded; runtime names remain",()=>{
  const zod={name:'zod',version:'4.6.7'};
  assert.ok(excluded(zod,'src/v4/core/tests/json.test.ts'));
  for(const file of ['v4/core/api.cjs','src/v4/core/api.ts','src/v4/locales/de.ts','LICENSE','package.json'])assert.equal(excluded(zod,file),false,file);
  assert.equal(excluded({...zod,version:'4.6.8'},'src/v4/core/tests/test.ts'),false);
  assert.equal(excluded({name:'unreviewed',version:'1'},'test/index.js'),false);
});
test("entrypoint/export wildcard and notice conflicts fail closed",t=>{
  const root=fixture(t),pkg={name:'qs',version:'6.16.1'};
  assert.throws(()=>assertDependencyPolicy(root,{...pkg,main:'test/index.js'}),/entrypoint/);
  assert.throws(()=>assertDependencyPolicy(root,{...pkg,exports:{'./*':'./*'}}),/entrypoint/);
  json(path.join(root,'test/NOTICE.json'),{});
  assert.throws(()=>assertDependencyPolicy(root,{...pkg,main:'lib/index.js'}),/notice/);
});
test("exact development files are pruned while public metadata, source maps and runtime helpers remain",()=>{
  assert.ok(excluded({name:'qs',version:'6.16.1'},'.nycrc'));
  assert.ok(excluded({name:'@msgpack/msgpack',version:'3.1.3'},'dist.cjs/tsconfig.dist.cjs.tsbuildinfo'));
  assert.ok(excluded({name:'fast-uri',version:'3.1.9'},'.github/workflows/ci.yml'));
  for(const file of ['.github/FUNDING.yml','.github/SECURITY.md','.github/THREAT_MODEL.md','lib/index.js.map','lib/index.d.ts','README.md','LICENSE.md'])assert.equal(excluded({name:'qs',version:'6.16.1'},file),false,file);
  assert.equal(excluded({name:'qs',version:'6.16.2'},'.nycrc'),false);
  assert.equal(excluded({name:'hono',version:'4.11.9'},'dist/helper/testing/index.js'),false);
  assert.ok(excluded({name:'object-inspect',version:'1.13.4'},'example/circular.js'));
  assert.equal(excluded({name:'object-inspect',version:'1.13.4'},'util.inspect.js'),false);
  assert.equal(excluded({name:'ajv',version:'8.17.1'},'.runkit_example.js'),false);
});
test("fresh staging removes only reviewed fixtures, keeps source/licenses/runtime and rejects reintroduced tests",t=>{
  const root=fixture(t),src=path.join(root,'source'),app=path.join(root,'staging');
  const native=`@img/sharp-${process.platform}-${process.arch}`;
  const packages={'node_modules/sharp':{name:'sharp',version:'1',optionalDependencies:{[native]:'1'}},[`node_modules/${native}`]:{name:native,version:'1'},'node_modules/qs':{name:'qs',version:'6.16.1',main:'lib/index.js'}};
  const top={dependencies:{sharp:'1',qs:'6.16.1'}};json(path.join(src,'package.json'),top);json(path.join(src,'package-lock.json'),{packages});
  for(const [loc,pkg]of Object.entries(packages))json(path.join(src,loc,'package.json'),pkg);
  for(const file of ['qs/test/parser.test.js','qs/lib/index.js','qs/LICENSE.md']){const p=path.join(src,'node_modules',file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,file);}
  json(path.join(app,'package.json'),top);const copied=copyDependencies(src,app);
  assert.equal(fs.existsSync(path.join(app,'node_modules/qs/test')),false);
  for(const file of ['qs/lib/index.js','qs/LICENSE.md'])assert.equal(fs.readFileSync(path.join(app,'node_modules',file),'utf8'),file);
  assert.ok(fs.existsSync(path.join(src,'node_modules/qs/test/parser.test.js')));
  assert.equal(verifyCopiedDependencies(app,copied).fileCount,5);
  json(path.join(app,'node_modules/qs/test/extra.json'),{});
  assert.throws(()=>verifyCopiedDependencies(app,copied),/Unexpected packaged dependency/);
});
