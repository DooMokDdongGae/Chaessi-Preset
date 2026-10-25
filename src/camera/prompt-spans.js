// Source offsets are retained. Only complete, explicitly recognized atoms are owned.
// Mixed camera/pose emphasis, random alternatives and prose remain opaque.
const aliases = {
  yaw: {
    front: ['front view', 'from front'], frontDiagonal: ['three-quarter front view', 'three quarter front view', 'three-quarter view'],
    side: ['side view', 'from side', 'profile'], rearDiagonal: ['three-quarter rear view', 'three quarter rear view'],
    back: ['from behind', 'rear view', 'back view'],
    frontRight:['three-quarter front view from the right'],sideRight:['right side view'],rearRight:['three-quarter rear view from the right'],
    frontLeft:['three-quarter front view from the left'],sideLeft:['left side view'],rearLeft:['three-quarter rear view from the left'],
  },
  elevation: { eye: ['eye level', 'eye-level'], above: ['from above', 'high angle', 'slightly from above'], below: ['from below', 'low angle', 'slightly from below', 'slightly low angle'], bird: ["bird's-eye view", 'birds eye view', "bird's eye view"], worm: ["worm's-eye view", "worm's eye view"] },
  height: { floor: ['floor level', 'camera at floor level'], waist: ['camera at waist height', 'camera around waist height'], eye: ['camera at eye height'], high: ['camera above head height'] },
  framing: { close: ['close-up', 'close up'], upper: ['upper body'], cowboy: ['cowboy shot'], full: ['full body'], wide: ['wide shot'] },
  roll: { dutch: ['dutch angle'],positive:['dutch angle; frame rotated clockwise'],negative:['dutch angle; frame rotated counterclockwise'] },
  pan:{positive:['camera pans right; framing shifts right; subject left in frame'],negative:['camera pans left; framing shifts left; subject right in frame']},
  tilt:{positive:['camera tilts upward at a fixed position'],negative:['camera tilts downward at a fixed position']},
  gaze: { viewer: ['looking at viewer'] },
};
export const normalizeAtom = text => text.trim().toLowerCase().replaceAll('_', ' ');
export function classifyAtom(text) {
  const atom = normalizeAtom(text);
  for (const [axis, terms] of Object.entries(aliases)) for (const [term, names] of Object.entries(terms)) if (names.includes(atom)) return {axis, term};
  return null;
}
export function scanPrompt(text) {
  text = String(text ?? '');
  const errors = [], opaque = [], nodes = [];
  let cursor = 0;
  function sequence(nested = false) {
    const children = [];
    let start = cursor;
    const atom = end => {
      const raw = text.slice(start, end), leading = raw.length - raw.trimStart().length, trailing = raw.length - raw.trimEnd().length;
      if (raw.trim()) children.push({start:start+leading,end:end-trailing,text:raw.trim(),kind:'atom',classification:classifyAtom(raw),weight:1});
    };
    while (cursor < text.length) {
      if (text.startsWith('::', cursor)) {
        atom(cursor); cursor += 2;
        if (!nested) errors.push('Unexpected closing ::');
        return children;
      }
      const number = text.slice(cursor).match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))::/);
      if (number && !text.slice(start,cursor).trim()) {
        const groupStart = cursor; cursor += number[0].length;
        const inside = sequence(true);
        const leaves = inside.flatMap(n=>n.leaves || [n]);
        const safe = leaves.length > 0 && leaves.every(n=>n.classification) && inside.every(n=>n.kind==='atom');
        children.push({kind:'group',start:groupStart,end:cursor,text:text.slice(groupStart,cursor),weight:Number(number[1]),leaves,
          safe, axes:[...new Set(leaves.filter(n=>n.classification).map(n=>n.classification.axis))]});
        start=cursor; continue;
      }
      if (text.startsWith('||',cursor) || text[cursor]==='{' || text[cursor]==='[') {
        const open=text.startsWith('||',cursor)?'||':text[cursor], close=open==='{'?'}':open==='['?']':'||';
        const at=cursor; cursor+=open.length; let depth=1;
        while(cursor<text.length&&depth){if(open!=='||'&&text.startsWith(open,cursor)){depth++;cursor+=open.length;}else if(text.startsWith(close,cursor)){depth--;cursor+=close.length;}else cursor++;}
        if(depth)errors.push(`Unclosed ${open}`);
        opaque.push({start:at,end:cursor}); continue;
      }
      if (text[cursor]===',' || text[cursor]==='\n' || text[cursor]==='\r' || text[cursor]==='.' && /\s/.test(text[cursor+1] || '')) {atom(cursor);cursor++;start=cursor;continue;}
      cursor++;
    }
    atom(cursor); if(nested)errors.push('Unclosed numeric weight (::)'); return children;
  }
  // Consume the entire string, including text following a stray closing marker.
  while(cursor<text.length)nodes.push(...sequence());
  const bindings=[], blocked=[], hints=[];
  for(const node of nodes){
    if(node.kind==='atom'&&node.classification){bindings.push({...node,terms:[{...node.classification,text:node.text,weight:1}]});hints.push({...node.classification,weight:1});}
    if(node.kind==='group'){
      const terms=node.leaves.filter(n=>n.classification).map(n=>({...n.classification,text:n.text,weight:node.weight}));if(node.weight>0)hints.push(...terms);
      if(node.safe&&node.weight>0)bindings.push({...node,terms});else if(terms.length)blocked.push({...node,reason:'Mixed, nested or nonpositive camera weights are retained without changing their meaning.'});
    }
  }
  return {text,bindings,blocked,hints,errors,opaque};
}
export function promptFields(preset) {
  const parts=preset?.prompt_parts || {};
  return [{key:'base',label:'Base',text:String(parts.base||'')},...(parts.characters||[]).flatMap((c,i)=>c.enabled===false?[]:[{key:`character:${i}`,label:`Character ${i+1}`,text:String(c.prompt||'')}])];
}
export function readField(preset,key){return key==='base'?preset.prompt_parts.base:preset.prompt_parts.characters[Number(key.split(':')[1])]?.prompt;}
export function writeField(preset,key,text){if(key==='base')preset.prompt_parts.base=text;else {const c=preset.prompt_parts.characters[Number(key.split(':')[1])];if(!c)throw new Error('Camera prompt slot no longer exists.');c.prompt=text;}}
