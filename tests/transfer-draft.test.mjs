import test from "node:test";
import assert from "node:assert/strict";
import {planTransfer, transferCatalogue} from "../src/ui/transfer-plan.js";
import {createTransferEditor} from "../src/ui/transfer-editor.js";
import {createCharacterPart} from "../src/state/preset-schema.js";

const slot = (id, overrides = {}) => createCharacterPart({id, name:id, ...overrides});
const makeDraft = characters => ({
  metadata:{name:"Synthetic", id:"local"},
  params:{model:"nai-diffusion-5-full", effort:"high"},
  prompt_parts:{base:"style, ", undesired:"avoid", characters},
});
const source = {image:3, number:1, field:"positive"};
const item = (slot, field, mode, text) => ({source, slot, field, mode, text});
const body = items => ({requestId:crypto.randomUUID(), revision:"current", items});
function catalogue(draft, limit = 32) {
  return {...transferCatalogue(draft, limit, new Map()), revision:"current"};
}

test("catalogue includes Off slots, preserves hidden tails and omits ambiguous IDs even when their duplicate is hidden", () => {
  const draft = makeDraft([slot("a"), slot("b", {enabled:false}), slot("a"), slot("hidden")]);
  const identities = new Map();
  const first = transferCatalogue(draft, 2, identities);
  assert.equal(first.canCreate, 0);
  assert.deepEqual(first.targets.map(x => x.number), [0, 2]);
  const token = first.targets[1].slot;
  draft.prompt_parts.characters.reverse();
  draft.params.effort = "medium";
  const second = transferCatalogue(draft, 32, identities);
  assert.equal(second.targets.find(x => x.number === 3).slot, token);
  assert.deepEqual(second.targets.map(t => t.fields), Array(3).fill(["positive"]));
  assert.equal(JSON.stringify(first).includes("hidden"), false);
});

test("exact free mapping, ordered replace/append, literal separator and explicit clear consent", () => {
  const draft = makeDraft([slot("a")]), {prompt_parts:parts} = draft;
  const cat = catalogue(draft), key = cat.targets[1].slot;
  const plan = planTransfer(body([
    item("base", "positive", "append", "\n한글::1.2\t"),
    item(key, "undesired", "replace", ""), item(key, "undesired", "append", " B "),
    item(key, "undesired", "append", " C "), item("base", "undesired", "append", ""),
  ]), cat, parts);
  assert.deepEqual(plan.groups.map(g => [g.number, g.property, g.before, g.after, g.clear]), [
    [0,"base","style, ","style, , \n한글::1.2\t",false], [1,"undesired",""," B ,  C ",true],
    [0,"undesired","avoid","avoid",false],
  ]);
  assert.equal(parts.base,"style, ");
});

test("multiple consecutive new slots are shared across repeated references regardless of item order", () => {
  const draft = makeDraft([slot("a")]), cat = catalogue(draft, 3);
  const rows = [item("new:2","positive","replace","x"), item("new:1","undesired","append","y"), item("new:2","positive","append","z")];
  const plan = planTransfer(body(rows),cat,draft.prompt_parts);
  assert.equal(plan.createCount, 2);
  assert.deepEqual(plan.groups.map(g => [g.number, g.after]), [[3,"x, z"],[2,"y"]]);
  for (const invalid of ["new:0","new:01","new:2","new:3","a"]) {
    assert.throws(() => planTransfer(body([item(invalid,"positive","append","x")]),cat,draft.prompt_parts), /INVALID/);
  }
});

test("a complete batch fails for invalid shape, source, inaccessible field, lossy text or size", () => {
  const draft = makeDraft([]); draft.params.effort = "medium";
  const cat = catalogue(draft), valid = item("base","positive","replace","alpha");
  const wrong = [{...valid, text:null}, {...valid, extra:"x"}, {...valid, mode:"APPEND"},
    {...valid, source:{...source, image:0}}, {...valid, source:{...source, path:"a"}},
    {...valid, field:"undesired"}, {...valid, text:"\u0000"}, {...valid, text:"a\r\nb"},
    {...valid, text:"\ud800"}, {...valid, text:"가".repeat(90000)}];
  for (const invalid of wrong)
    assert.throws(() => planTransfer(body([valid, invalid]),cat,draft.prompt_parts), /INVALID|TOO_LARGE/);
  assert.throws(() => planTransfer({...body([valid]), revision:"old"},cat,draft.prompt_parts), /STALE/);
  assert.equal(draft.prompt_parts.base,"style, ");
});

// The adapter reads ordinary form values and patches the real draft. This fixture
// intentionally has no persistence, network, clipboard or generation capability.
function fixture() {
  const draft = makeDraft([slot("synthetic", {enabled:false, prompt:"old", centers:[{x:.21,y:.67}], position_mode:"custom"})]);
  const state = {currentPreset:draft, selectedCharacterPositionIndex:0};
  const fields = {basePrompt:{value:draft.prompt_parts.base}, undesiredPrompt:{value:"avoid"},
    model:{value:draft.params.model}, effort:{value:"high"}, charactersJson:{value:JSON.stringify(draft.prompt_parts.characters,null,2)}};
  let cards = [];
  const controls = {characterPositionMode:{value:"custom"}, addCharacterButton:{disabled:false},
    characterCards:{querySelectorAll:() => cards}};
  const render = characters => { cards = characters.map((c,i) => {
    const values = {prompt:{value:c.prompt}, undesired:{value:c.undesired}, name:{value:c.name},
      x:{value:String(c.centers[0].x)}, y:{value:String(c.centers[0].y)}};
    const folded = {textContent:c.prompt};
    return {dataset:{characterIndex:String(i)}, querySelector(selector) {
      return selector === ".character-folded-preview" ? folded : values[selector.match(/"(.+?)"/)[1]];
    }};
  }); };
  render(draft.prompt_parts.characters);
  globalThis.document = {getElementById:id => controls[id]};
  let fail = false;
  const editor = createTransferEditor({state, fields, renderCharacterCards:render, renderCharacterPositionPad:() => {},
    refresh:() => { if (fail) { fail = false; throw new Error("synthetic failure"); }}});
  return {draft, fields, editor, failOnce:() => { fail = true; }};
}

test("commit and Undo restore exact form and draft, retaining all pre-existing slot attributes", () => {
  const {draft, fields, editor} = fixture();
  const original = structuredClone(draft), mirror = fields.charactersJson.value;
  const cat = catalogue(draft), target = cat.targets[1].slot;
  const plan = planTransfer(body([item("base","positive","append","A"), item(target,"undesired","replace","\n B"),
    item("new:1","positive","replace","\n Z ")]),cat,draft.prompt_parts);
  const undo = editor.write(plan);
  assert.equal(fields.basePrompt.value, "style, , A");
  const [retained, added] = draft.prompt_parts.characters;
  assert.deepEqual(retained, {...original.prompt_parts.characters[0], undesired:"\n B"});
  assert.equal(added.position_mode,"custom");
  assert.deepEqual(JSON.parse(fields.charactersJson.value), draft.prompt_parts.characters);
  assert.ok(editor.read().signature);
  // The normal tab handler materializes a fresh array without changing its data.
  draft.prompt_parts.characters = structuredClone(draft.prompt_parts.characters);
  undo();
  assert.deepEqual(draft, original);
  assert.equal(fields.charactersJson.value, mirror);
  assert.equal(fields.basePrompt.value, original.prompt_parts.base);
});

test("failed projection rolls back all targets and new slots; unfinished form edits are detected", () => {
  const {draft, fields, editor, failOnce} = fixture();
  const original = structuredClone(draft), mirror = fields.charactersJson.value;
  const cat = catalogue(draft);
  const plan = planTransfer(body([item("base","positive","replace","x"), item("new:1","positive","replace","y")]),cat,draft.prompt_parts);
  failOnce();
  assert.throws(() => editor.write(plan), /synthetic failure/);
  assert.deepEqual(draft, original); assert.equal(fields.basePrompt.value, original.prompt_parts.base);
  assert.equal(fields.charactersJson.value,mirror);
  fields.charactersJson.value = "[";
  assert.throws(() => editor.read(),/STALE/);
});
