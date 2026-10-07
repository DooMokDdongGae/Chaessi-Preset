import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
let getServerBaseUrl, startServerProcess, stopServerProcess, waitForServerHealth;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userDataDir = mkdtempSync(path.join(os.tmpdir(), "chaessi-position-pad-"));
const artifactDir = path.join(projectRoot, "tmp", "position-pad-validation");
const screenshotPath = path.join(artifactDir, "v5-custom-position-pad.png");
app.setPath("userData", userDataDir);
app.on('window-all-closed', () => {});

let window;
let testExitCode = 0;
console.log("[position-pad] waiting for Electron");
app.whenReady().then(run).catch((error) => {
  console.error(error);
  app.exit(1);
});

async function run() {
 try {
  process.env.PORT = "4192";
  ({ getServerBaseUrl, startServerProcess, stopServerProcess, waitForServerHealth } = await import("../electron/server-process.mjs"));
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(4192, '127.0.0.1', () => probe.close(resolve));
  });
  console.log("[position-pad] starting isolated server");
  await startServerProcess();
  await waitForServerHealth();
  console.log("[position-pad] loading UI");
  window = new BrowserWindow({ width: 1180, height: 920, show: true, webPreferences: { backgroundThrottling: false } });
  await window.loadURL(getServerBaseUrl());
  await waitFor(() => window.webContents.executeJavaScript("Boolean(document.querySelector('#characterLimitNotice')?.textContent)"));
  console.log("[position-pad] UI ready");

  await window.webContents.executeJavaScript(`(() => {
    const model = document.querySelector('#paramModel');
    model.value = 'nai-diffusion-5-full';
    model.dispatchEvent(new Event('change', { bubbles: true }));
    const add = document.querySelector('#addCharacterButton');
    for (let i = 0; i < 2 && document.querySelectorAll('#characterCards .character-card').length < 2; i++) add.click();
    const mode = document.querySelector('#characterPositionMode');
    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-position-marker="0"]')?.click();
    document.querySelector('#characterPositionPadPanel').scrollIntoView({ block: 'start' });
  })()`);
  await delay(150);
  console.log("[position-pad] V5 Custom ready");

  let ui = await readUi();
  assert.equal(ui.panelHidden, false);
  assert.equal(ui.markerCount, 2);
  assert.equal(ui.aspectRatio, "832 / 1216");
  assert.equal(ui.steps.every((step) => step === "0.001"), true);

  const drag = await window.webContents.executeJavaScript(`(() => {
    const pad = document.querySelector('#characterPositionPad').getBoundingClientRect();
    const marker = document.querySelector('[data-position-marker="0"]').getBoundingClientRect();
    window.initialDragMarker = document.querySelector('[data-position-marker="0"]');
    return {
      from: { x: Math.round(marker.left + marker.width / 2), y: Math.round(marker.top + marker.height / 2) },
      to: { x: Math.round(pad.left + pad.width * 0.75), y: Math.round(pad.top + pad.height * 0.25) }
    };
  })()`);
  window.webContents.sendInputEvent({ type: "mouseMove", ...drag.from });
  window.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...drag.from });
  window.webContents.sendInputEvent({ type: "mouseMove", ...drag.to });
  window.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...drag.to });
  await delay(100);
  console.log("[position-pad] pointer drag complete");
  assert.equal(await window.webContents.executeJavaScript("window.initialDragMarker === document.querySelector('[data-position-marker=\"0\"]')"), true, 'drag preserves marker DOM');
  ui = await readUi();
  assert.equal(Math.abs(Number(ui.values[0].x) - 0.75) <= 0.002, true, `drag x=${ui.values[0].x}`);
  assert.equal(Math.abs(Number(ui.values[0].y) - 0.25) <= 0.002, true, `drag y=${ui.values[0].y}`);

  await window.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('[data-character-index="0"]');
    const x = card.querySelector('[data-character-field="x"]');
    const y = card.querySelector('[data-character-field="y"]');
    x.value = '0.321'; x.dispatchEvent(new Event('input', { bubbles: true }));
    y.value = '0.654'; y.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  ui = await readUi();
  assert.equal(ui.markers[0].left, "32.1%");
  assert.equal(ui.markers[0].top, "65.4%");

  await window.webContents.executeJavaScript(`(() => {
    const second = document.querySelector('[data-character-index="1"]');
    const x = second.querySelector('[data-character-field="x"]');
    x.value = '0.8'; x.dispatchEvent(new Event('input', { bubbles: true }));
    second.querySelector('[data-move-character="up"]').click();
  })()`);
  ui = await readUi();
  assert.equal(ui.values[0].x, "0.8", "reorder moves the character and its center");
  assert.equal(ui.markers[0].left, "80%");
  await window.webContents.executeJavaScript("document.querySelector('[data-character-index=\"0\"] [data-remove-character]').click() ");
  ui = await readUi();
  assert.equal(ui.markerCount, 1);
  assert.equal(ui.values[0].x, "0.321", "delete keeps the adjacent character center");

  await window.webContents.executeJavaScript(`(() => {
    const model = document.querySelector('#paramModel');
    model.value = 'nai-diffusion-4-5-full';
    model.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  ui = await readUi();
  assert.equal(ui.panelHidden, true, "V4.5 does not expose the Position Pad");
  await window.webContents.executeJavaScript(`(() => {
    const model = document.querySelector('#paramModel');
    model.value = 'nai-diffusion-5-full';
    model.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  ui = await readUi();
  assert.equal(ui.panelHidden, false);
  assert.equal(ui.values[0].x, "0.321", "V4.5/V5 switch preserves center");
  assert.equal(ui.values[0].y, "0.654", "V4.5/V5 switch preserves center");

  await window.webContents.executeJavaScript(`(() => {
    const mode = document.querySelector('#characterPositionMode');
    mode.value = 'auto'; mode.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal((await readUi()).panelHidden, true);
  await window.webContents.executeJavaScript(`(() => {
    const mode = document.querySelector('#characterPositionMode');
    mode.value = 'custom'; mode.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal((await readUi()).values[0].x, '0.321');
  await window.webContents.executeJavaScript(`(() => {
    for (let i = 0; i < 31; i++) document.querySelector('#addCharacterButton').click();
  })()`);
  assert.equal((await readUi()).markerCount, 32);
  await window.webContents.executeJavaScript(`document.querySelector('[data-character-index="31"] [data-toggle-character]').click()`);
  assert.equal((await readUi()).markerCount, 31);
  await window.webContents.executeJavaScript(`document.querySelector('[data-character-index="31"] [data-toggle-character]').click()`);
  assert.equal((await readUi()).markerCount, 32);
  for (const modelId of ['nai-diffusion-4-5-full', 'nai-diffusion-5-full']) {
    await window.webContents.executeJavaScript(`(() => {
      const model = document.querySelector('#paramModel'); model.value = '${modelId}';
      model.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }
  assert.equal((await readUi()).markerCount, 32, 'slots 7–32 survive model round trip');
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-position-marker="0"]').click();
    document.querySelector('#characterPositionResetSelected').click();
  })()`);
  assert.deepEqual((await readUi()).values[0], { x: '0.5', y: '0.5' });
  for (const [width, height] of [[1024, 1024], [1216, 832], [832, 1216]]) {
    const ratio = await window.webContents.executeJavaScript(`(() => {
      for (const [id, value] of [['paramWidth', ${width}], ['paramHeight', ${height}]]) {
        const input = document.getElementById(id); input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const rect = document.querySelector('#characterPositionPad').getBoundingClientRect();
      return rect.width / rect.height;
    })()`);
    assert.equal(Math.abs(ratio - width / height) < 0.01, true, `aspect ${width}x${height}`);
  }
  // Distribute synthetic markers for a readable visual check; no generation occurs.
  await window.webContents.executeJavaScript(`(() => {
    document.querySelectorAll('#characterCards .character-card').forEach((card, index) => {
      for (const [axis, value] of [['x', 0.1 + (index % 4) * 0.26], ['y', 0.06 + Math.floor(index / 4) * 0.125]]) {
        const input = card.querySelector('[data-character-field="' + axis + '"]');
        input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  })()`);

  mkdirSync(artifactDir, { recursive: true });
  window.setSize(960, 920);
  await window.webContents.executeJavaScript("document.querySelector('#characterPositionPadPanel').scrollIntoView({ block: 'start' })");
  await delay(400);
  writeFileSync(screenshotPath, (await window.capturePage()).toPNG());
  ui = await readUi();
  window.webContents.debugger.attach('1.3');
  for (const [expression, expected] of [["document.querySelector('#characterPositionPad')", 5], ["document.querySelector('[data-position-marker]')", 0]]) {
    const { result } = await window.webContents.debugger.sendCommand('Runtime.evaluate', { expression });
    const { listeners } = await window.webContents.debugger.sendCommand('DOMDebugger.getEventListeners', { objectId: result.objectId });
    assert.equal(listeners.filter(item => item.type.includes('pointer')).length, expected, 'delegated pointer listener count');
  }
  window.webContents.debugger.detach();
  const reviewSource = readFileSync(path.join(projectRoot, 'tests', 'position-pad-review-ui.js'), 'utf8');
  console.log(await window.webContents.executeJavaScript(`(${reviewSource})()`));
  await checkPointerCleanup();
  for (const [name, mode, width, height, windowWidth] of [
    ['v5-ai-choice', 'auto', 832, 1216, 1180],
    ['v5-two-portrait', 'custom', 832, 1216, 1180],
    ['v5-two-square', 'custom', 1024, 1024, 1180],
    ['v5-two-landscape', 'custom', 1216, 832, 1180],
    ['v5-reorder', 'custom', 832, 1216, 1180],
    ['v5-overlap-narrow', 'custom', 832, 1216, 960],
  ]) {
    window.setSize(windowWidth, 1100);
    await window.webContents.executeJavaScript(`(() => {
      for (const [id,value] of [['characterPositionMode','${mode}'],['paramWidth',${width}],['paramHeight',${height}]]) {
        const el = document.getElementById(id); el.value = value;
        el.dispatchEvent(new Event(id === 'characterPositionMode' ? 'change' : 'input', {bubbles:true}));
      }
      if ('${name}' === 'v5-reorder') document.querySelector('[data-character-index="0"] [data-move-character="down"]').click();
      if ('${name}' === 'v5-overlap-narrow') {
        for (const el of document.querySelectorAll('[data-character-field="x"], [data-character-field="y"]')) {
          el.value = '0.5'; el.dispatchEvent(new Event('input', {bubbles:true}));
        }
        document.querySelector('.character-position').open = true;
      }
      document.getElementById('${mode}' === 'auto' ? 'characterPositionModeField' : 'characterPositionPadPanel').scrollIntoView({block:'start'});
      if ('${mode}' === 'auto') window.scrollBy(0, -165);
    })()`);
    await delay(400);
    writeFileSync(path.join(artifactDir, name + '.png'), (await window.capturePage()).toPNG());
  }
  console.log(JSON.stringify({ ok: true, screenshotPath, markerCount: ui.markerCount, aspectRatio: ui.aspectRatio, panelHidden: ui.panelHidden }, null, 2));
 } catch (error) {
  console.error(error);
  testExitCode = 1;
 } finally {
  console.log("[position-pad] cleaning up");
  window?.destroy();
  stopServerProcess();
  await delay(250);
  try { rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  catch { console.log('Synthetic test data retained for post-exit cleanup: ' + userDataDir); }
  app.exit(testExitCode);
 }
}

async function checkPointerCleanup() {
  for (const action of ['release', 'cancel', 'select', 'mode', 'model', 'resize', 'delete']) {
    await window.webContents.executeJavaScript(`(() => {
      const model = document.getElementById('paramModel'); model.value='nai-diffusion-5-full'; model.dispatchEvent(new Event('change'));
      const json = document.getElementById('charactersJson');
      json.value = JSON.stringify([0.2,0.8].map((x,i)=>({id:'test'+i,name:'Character '+(i+1),prompt:'synthetic'+i,undesired:'UC'+i,enabled:true,position_mode:'custom',centers:[{x,y:0.5}]})));
      json.dispatchEvent(new Event('change'));
      const mode = document.getElementById('characterPositionMode'); mode.value='custom'; mode.dispatchEvent(new Event('change'));
      document.getElementById('characterPositionPadPanel').scrollIntoView({block:'start'});
      window.reviewMarker = document.querySelector('[data-position-marker="0"]');
      document.getElementById('characterPositionPad').addEventListener('pointerdown', e => window.reviewPointer = e.pointerId, {once:true});
    })()`);
    await delay(50);
    const position = await window.webContents.executeJavaScript(`(() => { const r=window.reviewMarker.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()`);
    window.webContents.sendInputEvent({type:'mouseMove',...position});
    window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...position});
    await delay(30);
    assert.equal(await window.webContents.executeJavaScript("document.getElementById('characterPositionPad').hasPointerCapture(window.reviewPointer)"), true, 'native capture acquired');
    if (action === 'release') {
      window.webContents.sendInputEvent({type:'mouseMove',x:position.x-500,y:position.y});
      window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:position.x-500,y:position.y});
    } else if (action === 'resize') {
      window.setSize(1000,1000);
    } else {
      await window.webContents.executeJavaScript(`(() => {
        const pad=document.getElementById('characterPositionPad');
        if ('${action}' === 'cancel') pad.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.reviewPointer}));
        if ('${action}' === 'select') document.querySelector('[data-position-marker="1"]').click();
        if ('${action}' === 'mode') {const el=document.getElementById('characterPositionMode');el.value='auto';el.dispatchEvent(new Event('change'));}
        if ('${action}' === 'model') {const el=document.getElementById('paramModel');el.value='nai-diffusion-4-5-full';el.dispatchEvent(new Event('change'));}
        if ('${action}' === 'delete') document.querySelector('[data-remove-character="0"]').click();
      })()`);
    }
    await delay(50);
    assert.equal(await window.webContents.executeJavaScript("document.getElementById('characterPositionPad').hasPointerCapture(window.reviewPointer)"), false, action + ' clears capture');
    const before = await window.webContents.executeJavaScript("document.getElementById('charactersJson').value");
    window.webContents.sendInputEvent({type:'mouseMove',x:position.x+70,y:position.y+20});
    window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:position.x+70,y:position.y+20});
    await delay(30);
    assert.equal(await window.webContents.executeJavaScript("document.getElementById('charactersJson').value"), before, action + ' blocks stale drag');
  }
  await window.webContents.executeJavaScript("document.getElementById('addCharacterButton').click()");
  console.log('Native capture/release/cancel, outside pad, selection/mode/model/resize/delete drag cleanup passed.');
}

async function readUi() {
  return window.webContents.executeJavaScript(`(() => ({
    panelHidden: document.querySelector('#characterPositionPadPanel').hidden,
    aspectRatio: document.querySelector('#characterPositionPad').style.aspectRatio,
    markerCount: document.querySelectorAll('[data-position-marker]').length,
    markers: [...document.querySelectorAll('[data-position-marker]')].map((marker) => ({ left: marker.style.left, top: marker.style.top, active: marker.classList.contains('is-active') })),
    values: [...document.querySelectorAll('#characterCards .character-card')].map((card) => ({
      x: card.querySelector('[data-character-field="x"]').value,
      y: card.querySelector('[data-character-field="y"]').value,
    })),
    steps: [...document.querySelectorAll('[data-character-field="x"], [data-character-field="y"]')].map((input) => input.step),
  }))()`);
}

async function waitFor(check, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for Electron UI.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
