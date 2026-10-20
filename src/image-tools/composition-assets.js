import sharp from 'sharp';
import {base64Png, inspectToolPng, shaOptions} from './image-assets.js';
import {validateComposition, renderCompositionPixels, characterCenter, clamp} from './composition-geometry.js';

// Chebyshev distance stays within the existing square generation-padding contract.
export function compositionApplyMask(logical,width,height,seam) {
  const distances=new Uint8Array(logical.length);distances.fill(255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(logical[i]){distances[i]=0;continue;}
    let d=255;if(x)d=Math.min(d,distances[i-1]+1);
    if(y){d=Math.min(d,distances[i-width]+1);if(x)d=Math.min(d,distances[i-width-1]+1);if(x+1<width)d=Math.min(d,distances[i-width+1]+1);}distances[i]=d;
  }
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x;let d=distances[i];if(x+1<width)d=Math.min(d,distances[i+1]+1);
    if(y+1<height){d=Math.min(d,distances[i+width]+1);if(x)d=Math.min(d,distances[i+width-1]+1);if(x+1<width)d=Math.min(d,distances[i+width+1]+1);}distances[i]=d;
  }
  const mask=new Uint8Array(logical.length);
  for(let i=0;i<mask.length;i++){if(!distances[i])mask[i]=255;else if(distances[i]<=seam){const a=1-distances[i]/(seam+1);mask[i]=Math.round(255*a*a*(3-2*a));}}
  return mask;
}

export async function prepareComposition(source, settings, preset) {
  const size = await inspectToolPng(source), recipe = validateComposition(settings.composition, {width:size.width,height:size.height});
  const rgba = await sharp(source, shaOptions).ensureAlpha().raw().toBuffer();
  const manual = base64Png(settings.manual_mask_png), maskSize = await inspectToolPng(manual);
  if (maskSize.width !== size.width || maskSize.height !== size.height) throw new Error('Manual mask must match the immutable source.');
  const m = await sharp(manual, shaOptions).ensureAlpha().raw().toBuffer();
  const alpha = new Uint8Array(size.width * size.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = m[i*4+3];
  const rendered = renderCompositionPixels(rgba, alpha, recipe), {width, height} = recipe.frame;
  if (!rendered.selected) throw new Error('Paint a region or open empty space before generating.');
  if (!rendered.image.some((v,i) => i%4===3 && v>0)) throw new Error('Keep some of the image inside the output frame.');
  const png = (data, channels) => sharp(data, {raw:{width,height,channels}}).png().toBuffer();
  const image = await png(rendered.image, 4), logical = await png(rendered.mask, 1);
  const seam = Number(settings.seam ?? 8);
  if (!Number.isInteger(seam) || seam < 0 || seam > 32 || seam > Number(settings.padding ?? 16)) throw new Error('Seam must be 0–32 px and no wider than generation padding.');
  // Preserve the interior. Only the logical selection plus a bounded seam can change.
  const apply = compositionApplyMask(rendered.mask,width,height,seam), applyMask = await png(apply,1);
  const mapped = structuredClone(preset);
  mapped.prompt_parts.characters = (mapped.prompt_parts.characters || []).map((c,i) => ({...c,
    centers:(c.centers || [{x:.5,y:.5}]).map(p => {
      const pos = characterCenter(p, recipe.bindings[i] || 'source', recipe);
      if (c.enabled !== false && c.position_mode === 'custom' && (pos.x < 0 || pos.x > 1 || pos.y < 0 || pos.y > 1)) throw new Error('A character position is outside the frame. Move its marker or choose automatic placement.');
      return {x:clamp(pos.x,0,1),y:clamp(pos.y,0,1)};
    })}));
  return {source:image, mask:logical, manual, applyMask, geometry:recipe, preset:mapped};
}
export async function composeComposition(plan, generated) {
  const size = await inspectToolPng(generated), {width,height} = plan.geometry.frame;
  if (size.width !== width || size.height !== height) throw new Error('Composition result dimensions do not match the reviewed frame.');
  const input = await sharp(plan.assets.image).ensureAlpha().raw().toBuffer(), output = await sharp(generated).ensureAlpha().raw().toBuffer();
  const apply = await sharp(plan.applyMask).removeAlpha().greyscale().raw().toBuffer();
  for (let i = 0; i < apply.length; i++) {
    const o=i*4,a=apply[i]/255;
    if(!a){input.copy(output,o,o,o+4);continue;}
    if(a===1)continue;
    const sa=input[o+3]*(1-a),ga=output[o+3]*a,alpha=sa+ga;
    for(let c=0;c<3;c++)output[o+c]=alpha?Math.round((input[o+c]*sa+output[o+c]*ga)/alpha):0;
    output[o+3]=Math.round(alpha);
  }
  return sharp(output,{raw:{width,height,channels:4}}).png().toBuffer();
}
