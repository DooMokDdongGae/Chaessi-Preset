async function reviewPositionPad() {
  const $ = id => document.getElementById(id);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const equal = (a, b, message) => check(JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)), message);
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('UI operation timed out');
  };
  const mode = value => { $('characterPositionMode').value = value; $('characterPositionMode').dispatchEvent(new Event('change', { bubbles: true })); };
  const chars = () => JSON.parse($('charactersJson').value);
  const field = (index, axis) => document.querySelector(`[data-character-index="${index}"] [data-character-field="${axis}"]`);
  const input = (index, axis, value) => {
    const node = field(index, axis);
    node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const fixtures = [
    { id: 'a', name: 'A', prompt: 'A', undesired: 'UC A', enabled: true, centers: [{ x: 0.2, y: 0.3 }], position_mode: 'custom' },
    { id: 'b', name: 'B', prompt: 'B', undesired: 'UC B', enabled: false, centers: [{ x: 0.8, y: 0.7 }], position_mode: 'auto' },
  ];
  $('charactersJson').value = JSON.stringify(fixtures);
  $('charactersJson').dispatchEvent(new Event('change'));
  document.querySelector('[data-character-index="0"] [data-move-character="down"]').click();
  equal(chars(), [fixtures[1], fixtures[0]], 'Reorder must move prompt/UC/enabled/centers/mode together');
  document.querySelector('[data-character-index="1"] [data-move-character="up"]').click();
  equal(chars(), fixtures, 'Reverse reorder must restore the full characters');
  document.querySelector('[data-character-index="1"] [data-toggle-character]').click();
  mode('custom');

  const marker = document.querySelector('[data-position-marker="0"]');
  for (const value of [0, 0.001, 0.5, 0.999, 1]) {
    input(0, 'x', value);
    check(Number(field(0, 'x').value) === value, 'numeric precision');
    check(Math.abs(parseFloat(marker.style.left) - value * 100) < 1e-8, 'numeric marker sync');
    check(marker === document.querySelector('[data-position-marker="0"]'), 'numeric edits must not recreate marker DOM');
  }
  for (const [value, expected] of [[-1, 0], [2, 1], ['', 0], ['not-a-number', 0]]) {
    input(0, 'x', value);
    check(Number(field(0, 'x').value) === expected, 'invalid number commit must match clamped state');
  }
  input(0, 'x', 0.2); input(0, 'y', 0.3);
  mode('auto');
  $('saveAsPresetButton').click();
  await wait(() => $('presetSaveDialog').open);
  $('presetSaveNameInput').value = 'Position review AI preservation';
  $('confirmSavePresetButton').click();
  await wait(() => !$('presetSaveDialog').open);
  const list = await (await fetch('/api/presets')).json();
  const savedId = list.items.find(item => item.name === 'Position review AI preservation').id;
  const saved = (await (await fetch('/api/presets/' + savedId)).json()).preset;
  equal(saved.prompt_parts.characters.map(c => c.centers[0]), [{x:0.2,y:0.3},{x:0.8,y:0.7}], 'AI choice saved coordinates');
  check(saved.prompt_parts.characters.every(c => c.position_mode === 'auto'), 'AI choice saved mode');
  mode('custom'); input(0, 'x', 0.9); input(1, 'x', 0.1);
  $('openPresetLoadButton').click();
  await wait(() => $('presetLoadDialog').open);
  document.querySelector(`[data-load-preset="${savedId}"]`).click();
  await wait(() => !$('presetLoadDialog').open);
  check($('characterPositionPadPanel').hidden, 'Full preset Load restores AI choice');
  mode('custom');
  equal(chars().map(c => c.centers[0]), [{x:0.2,y:0.3},{x:0.8,y:0.7}], 'AI choice Save/Load/Custom coordinates');

  input(0, 'x', 0.123); input(0, 'y', 0.789);
  document.querySelector('[data-character-preset-save="0"]').click();
  await wait(() => $('characterPresetDialog').open && !$('dialogSaveAsCharacterPresetButton').disabled);
  $('characterPresetNameInput').value = 'Position character review';
  $('dialogSaveAsCharacterPresetButton').click();
  await wait(() => [...document.querySelectorAll('[data-dialog-character-load]')].length > 0);
  const characterList = await (await fetch('/api/character-presets')).json();
  const characterId = characterList.items.find(item => item.name === 'Position character review').id;
  $('characterPresetDialog').close();
  input(0, 'x', 0.555);
  document.querySelector('[data-character-preset-save="0"]').click();
  await wait(() => $('characterPresetDialog').open && document.querySelector(`[data-dialog-character-load="${characterId}"]`));
  document.querySelector(`[data-dialog-character-load="${characterId}"]`).click();
  await wait(() => !$('characterPresetDialog').open);
  equal(chars()[0].centers[0], {x:0.123,y:0.789}, 'Character Preset coordinates restored');
  check(!$('characterPositionPadPanel').hidden, 'Character Preset Load must preserve Custom mode');

  const payload = { input: 'synthetic', model: 'nai-diffusion-5-full', action: 'generate', parameters: {
    ...saved.params, use_coords: true,
    v4_prompt: {use_coords:true,use_order:true,caption:{base_caption:'synthetic',char_captions:chars().map(c=>({char_caption:c.prompt,centers:c.centers}))}},
    v4_negative_prompt: {caption:{base_caption:'',char_captions:chars().map(c=>({char_caption:c.undesired,centers:c.centers}))}},
  }};
  for (const raw of [payload, {Source:'NovelAI Diffusion V5 0ADF9AB7', Comment:JSON.stringify({...payload.parameters, prompt:payload.input, model_name:'NovelAI Diffusion V5'})}]) {
    input(0, 'x', 0.444);
    $('rawJsonInput').value = JSON.stringify(raw);
    $('importRawButton').click();
    await wait(() => Number(field(0, 'x')?.value) === 0.123);
    equal(chars()[0].centers[0], {x:0.123,y:0.789}, 'Raw/metadata UI import coordinates');
  }
  return { reorder: true, numeric: true, fullPresetAiRoundTrip: true, characterPresetRoundTrip: true, rawAndMetadataImport: true, markerDomPreserved: true };
}
