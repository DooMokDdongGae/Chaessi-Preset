// Public V4/V5 size contract observed 2026-10-20; independently verified size table.
// These are data/validation rules, not vendor implementation code.
export const RESOLUTION_PRESETS = Object.freeze({
  Small: {Landscape:[768,512], Portrait:[512,768], Square:[640,640]},
  Normal: {Landscape:[1216,832], Portrait:[832,1216], Square:[1024,1024]},
  Large: {Landscape:[1536,1024], Portrait:[1024,1536], Square:[1472,1472]},
  Wallpaper: {Landscape:[1920,1088], Portrait:[1088,1920]},
});
export const RESOLUTION_MAX_PIXELS = 3_145_728;
export function classifyResolution(width,height) {
  for (const [category,shapes] of Object.entries(RESOLUTION_PRESETS))
    for (const [orientation,[w,h]] of Object.entries(shapes))
      if (Number(width)===w && Number(height)===h) return {category,orientation};
  return {category:'Custom',orientation:Number(width)===Number(height)?'Square':Number(width)>Number(height)?'Landscape':'Portrait'};
}
export function resolutionError(width,height) {
  const w=Number(width),h=Number(height);
  if (!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64) return 'Width and height must be whole numbers of at least 64 pixels.';
  if (w%64||h%64) return 'Width and height must be multiples of 64. Values are not rounded automatically.';
  if (w*h>RESOLUTION_MAX_PIXELS) return 'The image must contain no more than 3,145,728 pixels.';
  return null;
}
export function assertResolution(width,height) {const error=resolutionError(width,height);if(error)throw new Error(error);}
