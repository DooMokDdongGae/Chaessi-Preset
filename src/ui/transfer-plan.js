// Pure planning. Existing slots are addressed only through the current catalogue.
const reject = code => { throw new Error(code); };
const keys = (value, names) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const validField = value => value === "positive" || value === "undesired";
const encoder = new TextEncoder();

export function transferCatalogue(preset, limit, identities) {
  const fields = preset.params.effort === "medium" ? ["positive"] : ["positive", "undesired"];
  const slots = preset.prompt_parts.characters;
  const counts = new Map();
  for (const {id} of slots) counts.set(id, (counts.get(id) || 0) + 1);
  for (const id of identities.keys()) if (counts.get(id) !== 1) identities.delete(id);
  const targets = [{slot:"base", number:0, fields}];
  for (let i = 0; i < Math.min(limit, slots.length); i++) {
    const {id} = slots[i];
    if (typeof id !== "string" || !id || counts.get(id) !== 1) continue;
    if (!identities.has(id)) identities.set(id, crypto.randomUUID());
    targets.push({slot:identities.get(id), number:i + 1, fields});
  }
  return {limit, canCreate:Math.max(0, limit - slots.length), targets};
}

export function planTransfer(body, catalogue, parts) {
  if (!keys(body, ["requestId", "revision", "items"]) || typeof body.requestId !== "string" ||
      !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(body.requestId) ||
      typeof body.revision !== "string" || !Array.isArray(body.items) ||
      !body.items.length || body.items.length > 128) reject("INVALID");
  if (body.revision !== catalogue.revision) reject("STALE");
  const available = new Map(catalogue.targets.map(target => [target.slot, target]));
  const newSlots = new Set();
  const groups = new Map();
  const steps = [];
  for (const item of body.items) {
    if (!keys(item, ["source", "slot", "field", "mode", "text"]) || !keys(item.source, ["image", "number", "field"]) ||
        !Number.isSafeInteger(item.source.image) || item.source.image < 1 ||
        !Number.isSafeInteger(item.source.number) || item.source.number < 0 || !validField(item.source.field) ||
        !validField(item.field) || !["append", "replace"].includes(item.mode) ||
        typeof item.slot !== "string" || typeof item.text !== "string" || !item.text.isWellFormed() ||
        /[\u0000-\u0008\u000b-\u001f]/u.test(item.text)) reject("INVALID");
    if (encoder.encode(item.text).byteLength > 256 * 1024) reject("TOO_LARGE");

    let destination = available.get(item.slot);
    if (!destination) {
      const match = /^new:([1-9]\d*)$/.exec(item.slot);
      const ordinal = match && Number(match[1]);
      if (!ordinal || ordinal > catalogue.canCreate) reject("INVALID");
      destination = {number:parts.characters.length + ordinal, fields:available.get("base").fields};
      newSlots.add(ordinal);
    }
    if (!destination.fields.includes(item.field)) reject("INVALID");
    const number = destination.number;
    const key = number + "/" + item.field;
    const property = item.field === "undesired" ? "undesired" : number ? "prompt" : "base";
    let group = groups.get(key);
    if (!group) {
      const before = number === 0 ? parts[property] : parts.characters[number - 1]?.[property] ?? "";
      group = {number, field:item.field, property, before, after:before, clear:false};
      groups.set(key, group);
    }
    const separator = item.mode === "append" && group.after !== "" && item.text !== "" ? ", " : "";
    group.after = item.mode === "replace" ? item.text : group.after + separator + item.text;
    group.clear ||= item.mode === "replace" && item.text === "";
    steps.push({source:item.source, number, field:item.field, mode:item.mode, text:item.text, separator});
  }
  for (let i = 1; i <= newSlots.size; i++) if (!newSlots.has(i)) reject("INVALID");
  return {groups:[...groups.values()], steps, createCount:newSlots.size, originalCount:parts.characters.length};
}
