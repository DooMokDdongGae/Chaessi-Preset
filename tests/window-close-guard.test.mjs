import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowCloseGuard} from '../src/ui/window-close-guard.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const target = new EventTarget(), state = {busy:false, dirty:false, discarded:0, prompts:0, notices:0, closed:0};
  let respond;
  const unload = () => { const event = new Event('beforeunload', {cancelable:true}); target.dispatchEvent(event); return event.defaultPrevented; };
  const controller = createWindowCloseGuard({target,
    confirmDiscard: () => { state.prompts++; return new Promise(resolve => { respond=resolve; }); },
    notifyBusy: () => { state.notices++; },
    close: () => { if (!unload()) state.closed++; },
  });
  controller.register({isBusy:()=>state.busy,isDirty:()=>state.dirty,discard:()=>{state.discarded++;state.dirty=false;}});
  return {state, controller, unload, answer:value=>respond(value)};
}

test('clean window unloads without a consent prompt', () => {
  const f=fixture();assert.equal(f.unload(),false);assert.equal(f.state.prompts,0);
});
test('closed editor dirty state is still protected; cancel retains edits', async () => {
  const f=fixture();f.state.dirty=true;assert.equal(f.unload(),true);
  f.answer(false);await flush();assert.equal(f.state.dirty,true);assert.equal(f.state.discarded,0);assert.equal(f.state.closed,0);
});
test('explicit discard permits a second guarded close and only then releases edits', async () => {
  const f=fixture();f.state.dirty=true;assert.equal(f.unload(),true);assert.equal(f.state.discarded,0);
  f.answer(true);await flush();assert.equal(f.state.discarded,1);assert.equal(f.state.closed,1);
});
test('repeated X does not reuse another prompt or discard before consent', async () => {
  const f=fixture();f.state.dirty=true;f.unload();f.unload();assert.equal(f.state.prompts,1);
  f.answer(false);await flush();f.unload();assert.equal(f.state.prompts,2);f.answer(false);await flush();assert.equal(f.state.discarded,0);
});
test('save or generation in progress vetoes closure with visible notice', () => {
  const f=fixture();f.state.busy=true;f.state.dirty=true;assert.equal(f.unload(),true);
  assert.equal(f.state.notices,1);assert.equal(f.state.prompts,0);assert.equal(f.state.discarded,0);
});
test('save started during pending consent remains protected even after approval', async () => {
  const f=fixture();f.state.dirty=true;f.unload();f.state.busy=true;f.answer(true);await flush();
  assert.equal(f.state.closed,0);assert.equal(f.state.discarded,0);assert.equal(f.state.dirty,true);assert.equal(f.state.notices,1);
});
test('one approval covers multiple dirty editors; clean saved editor is unchanged', async () => {
  const f=fixture();let secondDirty=true,secondDiscarded=0,cleanDiscarded=0;f.state.dirty=true;
  f.controller.register({isBusy:()=>false,isDirty:()=>secondDirty,discard:()=>{secondDirty=false;secondDiscarded++;}});
  f.controller.register({isBusy:()=>false,isDirty:()=>false,discard:()=>{cleanDiscarded++;}});
  f.unload();f.answer(true);await flush();assert.equal(f.state.closed,1);assert.equal(secondDiscarded,1);assert.equal(cleanDiscarded,0);assert.equal(f.state.prompts,1);
});
test('another editor saving prevents all dirty editor discards', () => {
  const f=fixture();f.state.dirty=true;
  f.controller.register({isBusy:()=>true,isDirty:()=>false,discard:()=>assert.fail('busy editor discarded')});
  assert.equal(f.unload(),true);assert.equal(f.state.prompts,0);assert.equal(f.state.discarded,0);
});
