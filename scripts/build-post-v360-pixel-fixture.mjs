// Original hand-coded pixel art; no reference image or generative service.
import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';
import {snapPixels,scaleNearest,detectPixelGrid} from '../src/image-tools/pixel-snap-core.js';
const target=path.resolve('assets/manuals/sources');await fs.mkdir(target,{recursive:true});
const width=96,height=72,data=new Uint8ClampedArray(width*height*4);
const colors={ink:[30,55,59,255],glass:[163,219,219,255],light:[221,246,230,255],frame:[61,114,108,255],wood:[142,101,65,255],clay:[206,112,60,255],soil:[86,67,52,255],leaf:[56,133,74,255],lime:[129,185,82,255],orange:[237,149,49,255],skin:[221,168,112,255],shirt:[245,226,176,255],apron:[74,119,72,255],trousers:[101,83,68,255],water:[64,169,186,255],sun:[255,221,109,255]};
function pixel(x,y,c){if(x>=0&&y>=0&&x<width&&y<height)data.set(colors[c]??c,(y*width+x)*4);}
function rect(x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixel(xx,yy,c);}
// Glasshouse roof, wall lattice, walkway and pot benches.
for(let y=8;y<32;y++)for(let x=12;x<85;x++)if(y>=28-Math.floor((36-Math.abs(x-48))/2))pixel(x,y,'glass');
rect(12,29,73,35,'glass');rect(11,62,75,3,'ink');rect(13,65,72,3,'wood');
for(let x=12;x<86;x+=12)rect(x,28,2,35,'frame');for(let y=29;y<64;y+=11)rect(12,y,73,2,'frame');
for(let x=11;x<=48;x++){const y=27-Math.floor((x-11)/2);rect(x,y,2,2,'frame');rect(96-x,y,2,2,'frame');}
rect(47,9,2,54,'frame');rect(42,38,14,26,'light');rect(42,37,14,2,'ink');rect(54,38,2,26,'frame');rect(52,48,1,2,'clay');
rect(18,49,20,3,'wood');rect(60,49,20,3,'wood');rect(20,52,2,11,'wood');rect(77,52,2,11,'wood');
for(const x of [20,29,62,72]){rect(x,44,7,6,'clay');rect(x+1,43,5,1,'soil');rect(x+3,37,1,7,'leaf');rect(x,39,4,2,'leaf');rect(x+3,36,4,2,'lime');pixel(x+6,35,'lime');}
// Upright adult gardener, distinct from earlier material.
rect(30,47,5,8,'trousers');rect(37,47,4,8,'trousers');rect(28,55,7,3,'ink');rect(37,55,7,3,'ink');
rect(29,33,13,15,'shirt');rect(31,33,9,17,'apron');rect(31,31,10,4,'skin');rect(30,22,11,10,'skin');rect(29,24,3,5,'ink');rect(30,21,11,4,'orange');rect(32,18,8,4,'orange');
pixel(38,26,'ink');pixel(40,27,'skin');rect(40,35,7,4,'shirt');rect(45,37,4,3,'skin');
rect(47,37,9,6,'water');rect(48,34,5,3,'water');rect(49,35,3,2,'light');rect(55,39,5,2,'water');pixel(60,41,'water');pixel(61,43,'water');
rect(70,15,5,5,'sun');pixel(69,14,'sun');pixel(76,20,'sun');
// Transparent canvas and a deliberate partial-alpha reflection.
for(let x=17;x<30;x++)pixel(x,32,[221,246,230,128]);
const logical={width,height,data},enlarged=scaleNearest(logical,6),png=img=>sharp(Buffer.from(img.data),{raw:{width:img.width,height:img.height,channels:4}}).png().toBuffer();
await fs.writeFile(path.join(target,'greenhouse-pixel-logical.png'),await png(logical));
await fs.writeFile(path.join(target,'greenhouse-pixel-input.png'),await png(enlarged));
await sharp(await png(enlarged)).blur(.6).png().toFile(path.join(target,'greenhouse-pixel-soft.png'));
const shifted=await sharp(await png(enlarged)).extract({left:1,top:2,width:enlarged.width-1,height:enlarged.height-2}).raw().toBuffer({resolveWithObject:true});
await sharp(shifted.data,{raw:shifted.info}).png().toFile(path.join(target,'greenhouse-pixel-offset.png'));
const detection=detectPixelGrid(enlarged),snapped=snapPixels(enlarged,{gridX:6,gridY:6});
await fs.mkdir('.cache/post-v360-verification',{recursive:true});await fs.writeFile('.cache/post-v360-verification/pixel-quality.json',JSON.stringify({source:'Independently hand-coded greenhouse and gardener; no image reference',detection,exact_rgba_recovery:Buffer.from(snapped.data).equals(Buffer.from(data)),logical_size:{width,height},input_size:{width:enlarged.width,height:enlarged.height},alpha_values:[0,128,255],offset_case:{cropped_left:1,cropped_top:2,expected_offset_x:5,expected_offset_y:4},anlas:0},null,2));
console.log(JSON.stringify({detection,exact:Buffer.from(snapped.data).equals(Buffer.from(data)),target}));
