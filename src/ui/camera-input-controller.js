import {getJson, postJson, postImage} from '../api/client.js';
import {defaultCamera, normalizeCamera, cameraTerms, compileCamera, CAMERA_SCHEMA, SHOTS, HEIGHTS, AXES} from '../camera-input/model.js';
import {t} from './i18n.js';

export function createCameraInputController({getPreset, applyPreset, importMetadata, getMode, setTextMode, showToast}) {
  const $ = id => document.getElementById(id);
  let camera = defaultCamera(), invalid = false, lastFocus = null;
  const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/src/ui/camera-input.css'; document.head.append(stylesheet);
  const button = document.createElement('button'); button.id = 'cameraInputOpen'; button.type = 'button';
  $('navImport').before(button);
  const badge = document.createElement('button'); badge.id = 'cameraInputBadge'; badge.type = 'button'; $('basePrompt').before(badge);
  const dialog = document.createElement('dialog'); dialog.id = 'cameraInputDialog'; dialog.className = 'camera-input-dialog';
  dialog.innerHTML = `<header class="dialog-header"><div><h2>Absolute camera</h2><p>Set a new view from the first image.</p></div><button id="cameraInputClose" type="button">Return to workbench</button></header>
    <div class="camera-input-toolbar"><label><input type="checkbox" id="cameraInputEnabled">Camera ON</label><button id="cameraInputNew" type="button">New camera · front 0°</button><button id="cameraInputImport" type="button">Start from image metadata</button><input id="cameraInputFile" type="file" accept="image/png,image/webp,image/jpeg" hidden><button id="cameraInputHelp" type="button">Help</button></div>
    <p class="camera-input-note">The sphere is a view selector, not a result preview. Left and right can produce the same tags. Pose and background may change.</p>
    <div class="camera-input-grid"><section class="camera-input-controls">
      <svg id="cameraInputSphere" viewBox="0 0 340 310" role="slider" tabindex="0" aria-label="Drag camera: horizontal direction, vertical elevation" aria-valuemin="-180" aria-valuemax="180">
        <defs><radialGradient id="cameraInputGradient" cx="34%" cy="25%"><stop stop-color="#24496b"/><stop offset="1" stop-color="#0c1b2c"/></radialGradient></defs>
        <circle cx="170" cy="150" r="119" fill="url(#cameraInputGradient)" stroke="#54738f"/>
        <ellipse cx="170" cy="150" rx="119" ry="44" fill="none" stroke="#5c83a3" stroke-dasharray="5 5"/>
        <ellipse cx="170" cy="150" rx="48" ry="119" fill="none" stroke="#385875"/>
        <path d="M51 150H289 M170 31V269" stroke="#34546f"/>
        <rect x="151" y="131" width="38" height="38" rx="6" fill="#172c42" stroke="#8ac3dc"/>
        <circle cx="170" cy="150" r="4" fill="#bdeeff"/>
        <line id="cameraInputRay" x1="170" y1="150" x2="170" y2="194" stroke="#6ddbd1" stroke-width="2"/>
        <circle id="cameraInputHandle" cx="170" cy="194" r="12" fill="#74edda" stroke="#e5fff8" stroke-width="2"/>
        <text x="170" y="292" fill="#d7e9f3" text-anchor="middle">Front 0°</text><text x="170" y="20" fill="#a6bdcf" text-anchor="middle">Behind ±180°</text>
      </svg>
      <p id="cameraInputCoordinates" data-no-i18n></p>
      <div class="camera-input-directions">${[-180,-135,-90,-45,0,45,90,135,180].map(n=>`<button type="button" data-camera-yaw="${n}" data-no-i18n>${n}°</button>`).join('')}</div>
      <label>Direction<input id="cameraInputYaw" type="range" min="-180" max="180" step="1"></label>
      <label>Elevation<input id="cameraInputElevation" type="range" min="-90" max="90" step="1"></label>
      <label>Distance / shot size<input id="cameraInputDistance" type="range" min="0" max="4" step="1"></label>
      <label>Shot size<select id="cameraInputShot">${SHOTS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>
      <details><summary>Framing options · experimental</summary><p>Pan and tilt describe framing intent. They do not move a physical camera.</p>
      <label>Camera height<select id="cameraInputHeight">${HEIGHTS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>
      <label>Pan<input id="cameraInputPan" type="range" min="-100" max="100" step="1"></label>
      <label>Tilt<input id="cameraInputTilt" type="range" min="-90" max="90" step="1"></label>
      <label>Roll / Dutch angle<input id="cameraInputRoll" type="range" min="-180" max="180" step="1"></label></details>
      <button id="cameraInputSize" type="button">Image size</button><p id="cameraInputFrame" data-no-i18n></p>
    </section><section class="camera-input-output">
      <h3>Camera wording and strength</h3><p>1 is neutral emphasis, not an optimized value. Manual wording stays until you reset its row.</p>
      <div class="camera-input-terms">${AXES.map(axis=>`<div class="camera-input-term"><label><span>${({shot:'Shot size',direction:'Direction',elevation:'Elevation',height:'Camera height',pan:'Pan',tilt:'Tilt',roll:'Roll / Dutch angle'})[axis]}</span><input data-camera-text="${axis}" aria-label="${axis} wording" data-no-i18n></label><label>Strength<input data-camera-weight="${axis}" inputmode="decimal" aria-label="${axis} strength" data-no-i18n></label><button type="button" data-camera-auto="${axis}">Auto</button></div>`).join('')}</div>
      <label><input id="cameraInputExclude" type="checkbox">Exclude standalone camera tags from the generated Base copy</label>
      <p>Original Base and Character text stays unchanged. Grouped expressions and Character tags require review.</p>
      <div id="cameraInputConflicts" class="camera-input-conflicts" role="status" data-no-i18n></div>
      <label>Camera block<textarea id="cameraInputBlock" readonly rows="3" data-no-i18n></textarea></label>
      <label>Generated Base preview<textarea id="cameraInputPreview" readonly rows="5" data-no-i18n></textarea></label>
      <p>Wildcards resolve once in the final review before Generate. Quality settings are included there.</p>
      <p id="cameraInputError" class="error" role="alert" data-no-i18n></p>
      <div class="camera-input-save"><label>Camera work name<input id="cameraInputName" maxlength="120"></label><button id="cameraInputSave" type="button">Save camera work</button></div>
      <label>Saved camera work<select id="cameraInputSaved"></select></label><button id="cameraInputLoad" type="button">Resume selected work</button>
      <p>Saved work contains prompts, settings and camera controls. Resuming starts in Text to Image; source images and masks are not saved here.</p>
      <details id="cameraInputLegacy" hidden><summary>Legacy camera record · read only</summary><p>Old camera data is preserved. Start a new absolute camera to use these prompts.</p><pre id="cameraInputLegacyRecord" data-no-i18n></pre></details>
    </section></div>`;
  document.body.append(dialog);
  const review = document.createElement('dialog'); review.id = 'cameraInputReview'; review.className = 'camera-input-review';
  review.innerHTML = `<header class="dialog-header"><h2>Review actual generation prompts</h2><button id="cameraInputCancelReview" type="button">Cancel</button></header><p>These resolved prompts and settings are fixed for this request.</p><pre id="cameraInputFinal" data-no-i18n></pre><div id="cameraInputReviewWarnings" data-no-i18n></div><label id="cameraInputAcknowledgeLabel"><input id="cameraInputAcknowledge" type="checkbox">Keep the listed manual expressions for this request</label><button id="cameraInputConfirm" type="button">Generate reviewed image</button>`;
  document.body.append(review);
  function showError(error) { $('cameraInputError').textContent = t(error?.message || ''); }
  function update() {
    button.textContent = t('Absolute camera'); badge.textContent = t(camera.enabled ? 'Camera ON · review / edit' : 'Camera OFF · set a view');
    badge.classList.toggle('camera-input-active', camera.enabled); $('cameraInputEnabled').checked = camera.enabled;
    for (const field of ['Yaw','Elevation','Pan','Tilt','Roll']) $('cameraInput'+field).value = camera[field.toLowerCase()];
    $('cameraInputShot').value = camera.shot; $('cameraInputHeight').value = camera.height;
    $('cameraInputDistance').value = SHOTS.indexOf(camera.shot); $('cameraInputExclude').checked = camera.excludeBaseTags;
    const yaw = Number(camera.yaw) * Math.PI / 180, elevation = Number(camera.elevation) * Math.PI / 180;
    const x = 170 + Math.sin(yaw) * Math.cos(elevation) * 119;
    const y = 150 + Math.cos(yaw) * Math.cos(elevation) * 44 - Math.sin(elevation) * 105;
    $('cameraInputHandle').setAttribute('cx', x); $('cameraInputHandle').setAttribute('cy', y);
    $('cameraInputRay').setAttribute('x2', x); $('cameraInputRay').setAttribute('y2', y);
    $('cameraInputSphere').setAttribute('aria-valuenow', camera.yaw);
    $('cameraInputSphere').setAttribute('aria-valuetext', `${camera.yaw}°, ${camera.elevation}°`);
    $('cameraInputCoordinates').textContent = `${t('Direction')} ${camera.yaw}° · ${t('Elevation')} ${camera.elevation}° · ${t('Scene center')} (0.5, 0.5)`;
    dialog.querySelectorAll('[data-camera-yaw]').forEach(b=>b.setAttribute('aria-pressed', String(Number(b.dataset.cameraYaw)===camera.yaw)));
    const preset = getPreset();
    $('cameraInputFrame').textContent = `${preset.params.width} × ${preset.params.height} · ${getMode()}`;
    $('cameraInputSize').disabled = getMode() !== 'text-to-image';
    // Keep incomplete text visible; never silently send the previous valid number.
    for (const axis of AXES) {
      const weight = dialog.querySelector(`[data-camera-weight="${axis}"]`);
      if (weight !== document.activeElement) weight.value = camera.weights[axis];
    }
    try {
      const terms = cameraTerms(camera);
      for (const term of terms) {
        const input = dialog.querySelector(`[data-camera-text="${term.axis}"]`);
        if (input !== document.activeElement) input.value = term.text;
        input.classList.toggle('camera-input-manual', term.manual);
      }
      const result = compileCamera(preset, camera);
      $('cameraInputBlock').value = result.block;
      $('cameraInputPreview').value = result.preset.prompt_parts.base;
      $('cameraInputConflicts').replaceChildren();
      if (result.conflicts.length) {
        const title = document.createElement('strong'); title.textContent = t('Manual camera expressions found'); $('cameraInputConflicts').append(title);
        for (const hit of result.conflicts) { const p = document.createElement('p'); p.textContent = `${hit.location} [${hit.start}–${hit.end}]: ${hit.text.trim()} · ${t(result.excluded.includes(hit) ? 'Excluded from generated copy' : 'Review required before generation')}`; $('cameraInputConflicts').append(p); }
      }
      invalid = false; showError(null);
    } catch (error) { invalid = true; showError(error); $('cameraInputBlock').value = ''; $('cameraInputPreview').value = ''; }
    $('cameraInputSave').disabled = invalid;
  }
  async function refreshSaved() {
    const {items} = await getJson('/api/camera-input/work');
    $('cameraInputSaved').replaceChildren(...items.map(item=>new Option(item.name, item.id)));
    $('cameraInputLoad').disabled = !items.length;
  }
  async function open() { lastFocus = document.activeElement; update(); if (!dialog.open) dialog.showModal(); await refreshSaved(); }
  function reset(enabled = true) { camera = defaultCamera(enabled); $('cameraInputLegacy').hidden = true; update(); }
  function run(fn) { return async () => { try { await fn(); } catch(error) { showError(error); showToast(error.message, true); } }; }
  button.onclick = badge.onclick = run(open);
  $('cameraInputClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => lastFocus?.focus?.());
  $('cameraInputEnabled').onchange = e => {camera.enabled = e.target.checked; update();};
  $('cameraInputNew').onclick = () => reset(true);
  $('cameraInputExclude').onchange = e => {camera.excludeBaseTags = e.target.checked; update();};
  for (const field of ['Yaw','Elevation','Pan','Tilt','Roll']) $('cameraInput'+field).oninput = e => {camera[field.toLowerCase()] = Number(e.target.value); update();};
  $('cameraInputShot').onchange = e => {camera.shot = e.target.value; update();};
  $('cameraInputDistance').oninput = e => {camera.shot = SHOTS[Number(e.target.value)]; update();};
  $('cameraInputHeight').onchange = e => {camera.height = e.target.value; update();};
  dialog.addEventListener('click', e => {
    const target = e.target.closest('[data-camera-yaw], [data-camera-auto]'); if (!target) return;
    if (target.dataset.cameraYaw !== undefined) camera.yaw = Number(target.dataset.cameraYaw);
    if (target.dataset.cameraAuto) delete camera.overrides[target.dataset.cameraAuto];
    update();
  });
  for (const field of dialog.querySelectorAll('[data-camera-weight]')) field.oninput = () => {
    camera.weights[field.dataset.cameraWeight] = /^-?\d+(?:\.\d{1,3})?$/.test(field.value) ? Number(field.value) : field.value; update();
  };
  for (const field of dialog.querySelectorAll('[data-camera-text]')) field.oninput = () => {camera.overrides[field.dataset.cameraText] = field.value; update();};
  const sphere = $('cameraInputSphere'); let drag = null;
  sphere.onpointerdown = e => { if (e.button !== 0) return; drag = {id:e.pointerId,x:e.clientX,y:e.clientY,yaw:camera.yaw,elevation:camera.elevation}; sphere.setPointerCapture(e.pointerId); e.preventDefault(); sphere.focus(); };
  sphere.onpointermove = e => { if (!drag || e.pointerId !== drag.id) return; camera.yaw = Math.round(Math.max(-180,Math.min(180,drag.yaw+(e.clientX-drag.x)*1.2))); camera.elevation = Math.round(Math.max(-90,Math.min(90,drag.elevation-(e.clientY-drag.y)*.6))); update(); };
  sphere.onpointerup = sphere.onpointercancel = sphere.onlostpointercapture = () => {drag = null;};
  sphere.onkeydown = e => {const key=e.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(key))return;e.preventDefault();if(key==='Home'){camera.yaw=0;camera.elevation=0;}if(key==='ArrowLeft')camera.yaw=Math.max(-180,camera.yaw-5);if(key==='ArrowRight')camera.yaw=Math.min(180,camera.yaw+5);if(key==='ArrowUp')camera.elevation=Math.min(90,camera.elevation+5);if(key==='ArrowDown')camera.elevation=Math.max(-90,camera.elevation-5);update();};
  $('cameraInputSize').onclick = () => {dialog.close();$('resolutionPicker').click();};
  $('cameraInputHelp').onclick = () => document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'camera-absolute'}}));
  $('cameraInputSave').onclick = run(async()=>{await postJson('/api/camera-input/work',{name:$('cameraInputName').value,camera:normalizeCamera(camera),preset:getPreset()});await refreshSaved();showToast(t('Camera work saved.'));});
  $('cameraInputLoad').onclick = run(async()=>{const {work}=await getJson('/api/camera-input/work/'+encodeURIComponent($('cameraInputSaved').value));await applyPreset(work.preset);setTextMode();camera=normalizeCamera(work.camera);update();showToast(t('Camera work resumed.'));});
  $('cameraInputImport').onclick = () => $('cameraInputFile').click();
  $('cameraInputFile').onchange = run(async()=>{const file=$('cameraInputFile').files[0];if(!file)return;const response=await postImage('/api/import/image',file);const metadata=response.import_result;if(!metadata?.parsed?.base_prompt&&!metadata?.parsed?.characters?.length)throw new Error(t('No readable generation metadata. Use a NovelAI PNG or WebP.'));await importMetadata(metadata);setTextMode();reset(true);$('cameraInputFile').value='';});
  document.addEventListener('chaessi:language-change',update);
  function request() { if (!camera.enabled) return null; return normalizeCamera(camera); }
  function confirmPrepared(prepared) {
    if (!prepared.camera_input) return Promise.resolve(true);
    $('cameraInputFinal').textContent = `Base\n${prepared.caption.base_caption}\n\n${prepared.caption.char_captions.map((c,i)=>`Character ${i+1}\n${c.char_caption}\nPosition ${JSON.stringify(c.centers)}`).join('\n\n')}\n\nUC\n${JSON.stringify(prepared.negative_caption,null,2)}\n\nSeed ${prepared.preset.params.seed}`;
    $('cameraInputReviewWarnings').textContent = prepared.camera_input.conflicts.map(hit=>`${hit.location}: ${hit.text.trim()} · ${t(prepared.camera_input.excluded.some(x=>x.location===hit.location&&x.start===hit.start)?'Excluded from generated copy':'Review required before generation')}`).join('\n');
    $('cameraInputAcknowledge').checked=false;$('cameraInputAcknowledgeLabel').hidden=!prepared.camera_input.needs_review;
    $('cameraInputConfirm').disabled=prepared.camera_input.needs_review;
    $('cameraInputAcknowledge').onchange=()=>{$('cameraInputConfirm').disabled=prepared.camera_input.needs_review&&!$('cameraInputAcknowledge').checked;};
    return new Promise(resolve=>{review.returnValue='cancel';review.addEventListener('close',()=>resolve(review.returnValue==='generate'),{once:true});$('cameraInputCancelReview').onclick=()=>review.close('cancel');$('cameraInputConfirm').onclick=()=>review.close('generate');review.showModal();});
  }
  async function fromHistory(record, resume = false) {
    const saved = record.camera_input;
    if (resume && saved?.schema !== CAMERA_SCHEMA) throw new Error(t('Only v3.8.2 camera work can be resumed.'));
    const preset = resume ? saved.original_preset : (saved?.original_preset || record.internal_preset);
    if (!preset) throw new Error(t('This record has no reusable prompts.'));
    await applyPreset(preset);
    if (record.generation?.seed !== undefined) {const p=getPreset();p.params.seed=record.generation.seed;await applyPreset(p);}
    setTextMode(); camera=resume?normalizeCamera(saved.state):defaultCamera(true);
    const legacy=record.camera_context;
    $('cameraInputLegacy').hidden=!legacy;
    $('cameraInputLegacyRecord').textContent=legacy?JSON.stringify(legacy,null,2):'';
    await open();
  }
  update();
  return {open, request, confirmPrepared, fromHistory, reset, isEnabled:()=>camera.enabled};
}
