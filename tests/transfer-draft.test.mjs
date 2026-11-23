import test from "node:test";
import assert from "node:assert/strict";
import {planTransfer, transferCatalogue} from "../src/ui/transfer-plan.js";
import {createTransferEditor} from "../src/ui/transfer-editor.js";
import {installTransferPreview} from "../src/ui/transfer-preview.js";
import {t} from "../src/ui/i18n.js";
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
  assert.deepEqual(plan.createdSlots, [{number:2, requested:true}, {number:3, requested:true}]);
  assert.deepEqual(plan.groups.map(g => [g.number, g.after]), [[3,"x, z"],[2,"y"]]);
  for (const invalid of ["new:0","new:01","new:-1","new:3","a"]) {
    assert.throws(() => planTransfer(body([item(invalid,"positive","append","x")]),cat,draft.prompt_parts), /INVALID/);
  }
});

test("a later slot can be requested alone through the model limit, preserving its actual number", () => {
  for (const limit of [6, 32]) {
    const draft = makeDraft([]);
    const cat = catalogue(draft, limit);
    const makePlan = ordinal => planTransfer(body([item("new:" + ordinal, "positive", "replace", "last")]), cat, draft.prompt_parts);
    const plan = makePlan(limit);
    assert.equal(plan.groups[0].number, limit);
    assert.equal(plan.createdSlots.length, limit);
    assert.deepEqual(plan.createdSlots.filter(slot => slot.requested), [{number:limit, requested:true}]);
    assert.throws(() => makePlan(limit + 1), /INVALID/);
    assert.equal(draft.prompt_parts.characters.length, 0);
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
  const plan = planTransfer(body([item("base","positive","replace","x"), item("new:3","positive","replace","y")]),cat,draft.prompt_parts);
  failOnce();
  assert.throws(() => editor.write(plan), /synthetic failure/);
  assert.deepEqual(draft, original); assert.equal(fields.basePrompt.value, original.prompt_parts.base);
  assert.equal(fields.charactersJson.value,mirror);
  fields.charactersJson.value = "[";
  assert.throws(() => editor.read(),/STALE/);
});

test("reverse and repeated sparse requests use real slot numbers, preserve other slots, and undo every addition", () => {
  const {draft, fields, editor} = fixture();
  const {prompt_parts:parts} = draft, original = structuredClone(draft), mirror = fields.charactersJson.value;
  const ids = new Map();
  const cat = {...transferCatalogue(draft, 6, ids), revision:"current"};
  const operation = body([item("new:4","positive","replace","5"), item("new:2","undesired","replace","3"),
    item("new:4","positive","append","끝")]);
  const plan = planTransfer(operation, cat, parts);
  assert.deepEqual(plan.steps.map(step => step.number), [5, 3, 5]);
  assert.deepEqual(plan.createdSlots.map(slot => [slot.number, slot.requested]), [[2,false], [3,true], [4,false], [5,true]]);
  assert.deepEqual(draft, original);

  const undo = editor.write(plan);
  assert.deepEqual(parts.characters[0], original.prompt_parts.characters[0]);
  assert.deepEqual(parts.characters.slice(1).map(c => [c.name, c.enabled, c.prompt, c.undesired]), [
    ["Character 2", false, "", ""], ["Character 3", true, "", "3"],
    ["Character 4", false, "", ""], ["Character 5", true, "5, 끝", ""],
  ]);
  assert.equal(new Set(parts.characters.map(c => c.id)).size, 5);
  assert.deepEqual(JSON.parse(fields.charactersJson.value), parts.characters);
  const updated = {...transferCatalogue(draft, 6, ids), revision:"updated"};
  assert.equal(updated.canCreate, 1);
  assert.equal(updated.targets[1].slot, cat.targets[1].slot);
  assert.throws(() => planTransfer(operation, updated, parts), /STALE/);
  // Empty, disabled slots remain ordinary selectable targets on later requests.
  const gap = updated.targets.find(target => target.number === 2);
  const followup = {...body([item(gap.slot,"positive","replace","2")]), revision:"updated"};
  const undoGap = editor.write(planTransfer(followup, updated, parts));
  assert.equal(parts.characters[1].enabled, false);
  assert.equal(parts.characters[1].prompt, "2");
  undoGap();
  undo();
  assert.deepEqual(draft, original);
  assert.equal(fields.charactersJson.value, mirror);
});

test("preview names skipped ranges and enables a single Apply; only empty replacement requires a checkbox", () => {
  const originalDocument = globalThis.document;
  const nodes = new Map();
  function element(tagName) {
    return {tagName, dataset:{}, children:[], listeners:{}, addEventListener(event, handler) { this.listeners[event] = handler; },
      append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; }};
  }
  function get(id) {
    if (!nodes.has(id)) nodes.set(id, element("div"));
    return nodes.get(id);
  }
  const dialog = get("transferPreviewDialog");
  const inputs = parent => parent.children.flatMap(row => row.children || []).filter(child => child.tagName === "input");
  const create = get("transferConfirmCreate"), clear = get("transferConfirmClear");
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  dialog.querySelector = () => [...inputs(create), ...inputs(clear)].find(input => !input.checked);
  get("transferCancel").focus = () => {};
  globalThis.document = {getElementById:get, createElement:element, createTextNode:text => ({textContent:text}), querySelector:() => null};
  let receive;
  const draft = makeDraft([]);
  try {
    installTransferPreview({bridge:{onRequest:handler => { receive = handler; }, finish:async () => {}},
      read:() => ({draft, signature:"unchanged", limit:6}), write:() => assert.fail("preview must not change the draft")});
    const preview = text => {
      const {revision} = receive({operation:"targets"});
      return receive({operation:"preview", expiresAt:Date.now() + 120000,
        body:{...body([item("new:6","positive","replace",text)]), revision}});
    };
    assert.equal(preview("later").state,"pending");
    assert.deepEqual(create.children.map(p => p.textContent), [
      t("Applying will create Character slots {numbers}.", {numbers:"6"}),
      t("Skipped Character slots {numbers} will be created empty and turned off.", {numbers:"1–5"}),
    ]);
    assert.equal(inputs(create).length,0);
    assert.equal(get("transferApply").disabled,false);
    get("transferCancel").listeners.click();
    preview("");
    assert.equal(inputs(clear).length,1);
    assert.equal(get("transferApply").disabled,true);
    inputs(clear)[0].checked = true;
    dialog.listeners.change();
    assert.equal(get("transferApply").disabled,false);
  } finally {
    if (dialog.open) get("transferCancel").listeners.click();
    globalThis.document = originalDocument;
  }
});
