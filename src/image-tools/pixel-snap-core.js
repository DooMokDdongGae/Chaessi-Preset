// Independently written grid sampling and median-cut palette reduction.
// No provider code, network, DOM, dependencies or model weights.
export const PIXEL_SNAP_VERSION='chaessi-grid-v1';
export const PIXEL_SNAP_MAX_PIXELS=16_777_216;
export const PIXEL_SNAP_MAX_EDGE=16384;

export function checkPixelSize(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>PIXEL_SNAP_MAX_EDGE||height>PIXEL_SNAP_MAX_EDGE||width*height>PIXEL_SNAP_MAX_PIXELS)throw new Error('Pixel Snap supports up to 16 megapixels and 16,384 pixels per side.');
}
export function inspectPixelPng(buffer){
  const bytes=new Uint8Array(buffer.buffer??buffer,buffer.byteOffset??0,buffer.byteLength);
  if(bytes.length>64*1024*1024||bytes.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v))throw new Error('Choose a PNG no larger than 64 MB.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);checkPixelSize(width,height);
  let end=false,profile=false;
  for(let i=8;i+12<=bytes.length;){const length=view.getUint32(i),type=String.fromCharCode(...bytes.subarray(i+4,i+8));if(i+12+length>bytes.length)throw new Error('Incomplete PNG.');if(type==='acTL')throw new Error('Animated PNG is not supported. Choose a still PNG.');if(['iCCP','cICP'].includes(type))profile=true;i+=12+length;if(type==='IEND'){end=true;break;}}
  if(!end)throw new Error('Incomplete PNG.');
  return {width,height,bitDepth:bytes[24],profile};
}
export function normalizePixelSettings(settings={}){
  const number=(key,fallback,min,max,integer=false)=>{const n=Number(settings[key]??fallback);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error('Invalid Pixel Snap setting: '+key);return n;};
  const gridX=number('gridX',4,1,128),gridY=number('gridY',gridX,1,128);
  const offsetX=number('offsetX',0,0,127.999),offsetY=number('offsetY',0,0,127.999);
  if(offsetX>=gridX||offsetY>=gridY)throw new Error('Offsets must be smaller than their grid sizes.');
  const edges=settings.edges??'keep',palette=settings.palette??'preserve',alpha=settings.alpha??'preserve';
  if(!['keep','crop'].includes(edges)||!['preserve','auto','limit'].includes(palette)||!['preserve','binary'].includes(alpha))throw new Error('Invalid Pixel Snap mode.');
  return {algorithm:PIXEL_SNAP_VERSION,gridX,gridY,offsetX,offsetY,edges,palette,colors:number('colors',32,2,256,true),alpha,threshold:number('threshold',128,1,255,true),scale:number('scale',1,1,16,true)};
}
export function pixelGeometry(width,height,settings){
  const s=normalizePixelSettings(settings);checkPixelSize(width,height);
  const axis=(length,grid,offset)=>{const first=s.edges==='keep'?Math.floor(-offset/grid):Math.ceil(-offset/grid),last=s.edges==='keep'?Math.ceil((length-offset)/grid):Math.floor((length-offset)/grid);return {first,count:last-first,start:offset+first*grid,end:offset+last*grid};};
  const x=axis(width,s.gridX,s.offsetX),y=axis(height,s.gridY,s.offsetY);
  if(x.count<1||y.count<1)throw new Error('No complete cell fits. Keep partial edge cells or reduce the grid size.');
  checkPixelSize(x.count,y.count);checkPixelSize(x.count*s.scale,y.count*s.scale);
  return {logical:{width:x.count,height:y.count},output:{width:x.count*s.scale,height:y.count*s.scale},bounds:{x:x.start,y:y.start,right:x.end,bottom:y.end}};
}
function checkImage(image){checkPixelSize(image.width,image.height);if(image.data?.length!==image.width*image.height*4)throw new Error('Invalid RGBA image.');}
function rgbaKey(data,i){return data[i+3]===0?0:((data[i]*0x1000000)+(data[i+1]<<16)+(data[i+2]<<8)+data[i+3])>>>0;}
function writeKey(out,index,key){out[index]=key>>>24;out[index+1]=(key>>>16)&255;out[index+2]=(key>>>8)&255;out[index+3]=key&255;}
function cellColor(image,x0,y0,x1,y1){
  const {data,width}=image,counts=new Map();
  // Interior samples avoid resampling seams. All returned RGBA values are
  // observed source values; ties prefer the sample nearest the cell center.
  const left=Math.max(0,Math.min(width-1,Math.floor(x0))),right=Math.min(width,Math.max(left+1,Math.ceil(x1)));
  const top=Math.max(0,Math.min(image.height-1,Math.floor(y0))),bottom=Math.min(image.height,Math.max(top+1,Math.ceil(y1)));
  const nx=Math.min(7,right-left),ny=Math.min(7,bottom-top);let best=0,bestCount=-1,bestDistance=Infinity;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const px=Math.min(right-1,Math.floor(left+(x+.5)*(right-left)/nx)),py=Math.min(bottom-1,Math.floor(top+(y+.5)*(bottom-top)/ny)),key=rgbaKey(data,(py*width+px)*4);
    const distance=(px-(left+right-1)/2)**2+(py-(top+bottom-1)/2)**2;
    const v=counts.get(key)??{n:0,d:Infinity};v.n++;v.d=Math.min(v.d,distance);counts.set(key,v);
  }
  for(const [key,v]of counts)if(v.n>bestCount||(v.n===bestCount&&v.d<bestDistance)){best=key;bestCount=v.n;bestDistance=v.d;}
  return best;
}
export function snapPixels(image,settings={},progress=()=>{}){
  checkImage(image);const s=normalizePixelSettings(settings),geometry=pixelGeometry(image.width,image.height,s),{width,height}=geometry.logical;
  const data=new Uint8ClampedArray(width*height*4),b=geometry.bounds;
  if(s.gridX===1&&s.gridY===1&&s.offsetX===0&&s.offsetY===0)data.set(image.data);
  else for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const x0=Math.max(0,b.x+x*s.gridX),x1=Math.min(image.width,b.x+(x+1)*s.gridX),y0=Math.max(0,b.y+y*s.gridY),y1=Math.min(image.height,b.y+(y+1)*s.gridY);
      const insetX=(x1-x0)>=3?(x1-x0)*.2:0,insetY=(y1-y0)>=3?(y1-y0)*.2:0;
      writeKey(data,(y*width+x)*4,cellColor(image,x0+insetX,y0+insetY,x1-insetX,y1-insetY));
    }
    if(y%32===0)progress(Math.round(y/height*65));
  }
  for(let i=0;i<data.length;i+=4){if(s.alpha==='binary')data[i+3]=data[i+3]>=s.threshold?255:0;if(data[i+3]===0)data[i]=data[i+1]=data[i+2]=0;}
  const paletteSize=s.palette==='preserve'?null:reducePalette(data,s.palette==='auto'?0:s.colors);
  progress(90);return {data,width,height,geometry,settings:s,paletteSize};
}
function reducePalette(data,requested){
  // Bounded RGB histogram; alpha remains a separate per-pixel value. Transparent
  // RGB never participates. Representatives are actual colors, not averages.
  const histogram=new Map();
  for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const key=(data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3);let bin=histogram.get(key);if(!bin){bin={key,rgb:[data[i],data[i+1],data[i+2]],weight:0};histogram.set(key,bin);}bin.weight+=data[i+3];}
  if(!histogram.size)return 0;
  const target=requested||Math.min(64,Math.max(2,2**Math.ceil(Math.log2(Math.sqrt(histogram.size)*2))));
  const box=items=>{const ranges=[0,1,2].map(c=>{let min=255,max=0;for(const v of items){min=Math.min(min,v.rgb[c]);max=Math.max(max,v.rgb[c]);}return max-min;});return {items,axis:ranges.indexOf(Math.max(...ranges)),score:Math.max(...ranges)*items.reduce((a,v)=>a+v.weight,0)};};
  const boxes=[box([...histogram.values()])];
  while(boxes.length<target){let index=-1,score=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].items.length>1&&boxes[i].score>score){index=i;score=boxes[i].score;}if(index<0)break;
    const b=boxes.splice(index,1)[0],items=b.items.sort((a,c)=>a.rgb[b.axis]-c.rgb[b.axis]||a.key-c.key),half=items.reduce((a,v)=>a+v.weight,0)/2;let sum=0,split=1;
    for(let i=0;i<items.length-1;i++){sum+=items[i].weight;split=i+1;if(sum>=half)break;}
    boxes.push(box(items.slice(0,split)),box(items.slice(split)));
  }
  const palette=boxes.map(b=>b.items.reduce((a,v)=>v.weight>a.weight?v:a).rgb),mapped=new Map();
  for(const [key,bin]of histogram){let selected=palette[0],distance=Infinity;for(const rgb of palette){const d=rgb.reduce((a,v,c)=>a+(v-bin.rgb[c])**2,0);if(d<distance){distance=d;selected=rgb;}}mapped.set(key,selected);}
  for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const rgb=mapped.get((data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3));data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];}
  return palette.length;
}
export function scaleNearest(image,scale){
  checkImage(image);if(!Number.isInteger(scale)||scale<1||scale>16)throw new Error('Export scale must be an integer from 1 to 16.');
  const width=image.width*scale,height=image.height*scale;checkPixelSize(width,height);
  if(scale===1)return {width,height,data:new Uint8ClampedArray(image.data)};
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<image.height;y++){const row=new Uint8ClampedArray(width*4);for(let x=0;x<image.width;x++)for(let k=0;k<scale;k++)row.set(image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4),(x*scale+k)*4);for(let k=0;k<scale;k++)data.set(row,(y*scale+k)*width*4);}
  return {width,height,data};
}
export function detectPixelGrid(image){
  checkImage(image);
  function axis(horizontal){
    const length=horizontal?image.width:image.height,other=horizontal?image.height:image.width,profile=new Float64Array(length),samples=Math.min(96,other);
    for(let k=0;k<samples;k++){const line=Math.floor((k+.5)*other/samples);for(let p=1;p<length;p++){
      const i=(horizontal?line*image.width+p:p*image.width+line)*4,j=i-(horizontal?4:image.width*4),a=image.data[i+3]/255,b=image.data[j+3]/255;
      let d=Math.abs(a-b)*255;for(let c=0;c<3;c++)d+=Math.abs(image.data[i+c]*a-image.data[j+c]*b);profile[p]+=d/samples;
    }}
    const total=profile.reduce((a,v)=>a+v,0),peak=profile.reduce((a,v)=>Math.max(a,v),0);
    const supportedEdges=profile.reduce((n,v)=>n+(v>peak*.15?1:0),0);
    if(total<Math.max(20,length*.3)||supportedEdges<4)return {grid:1,offset:0,confidence:0};
    let best={grid:1,offset:0,confidence:0};
    // Half-pixel candidates also cover art resized by non-integer factors.
    for(let grid=2;grid<=Math.min(64,length/4);grid+=.5){const bins=new Float64Array(Math.round(grid*2));for(let p=1;p<length;p++)bins[Math.round((p%grid)*2)%bins.length]+=profile[p];
      for(let bin=0;bin<bins.length;bin++){const captured=bins[bin]/total,baseline=1/Math.ceil(grid),confidence=Math.max(0,(captured-baseline)/(1-baseline));if(confidence>best.confidence+.015||(confidence>.65&&confidence>=best.confidence-.005&&grid>best.grid))best={grid,offset:bin/2,confidence};}
    }
    return best;
  }
  const x=axis(true),y=axis(false),confidence=Math.min(x.confidence,y.confidence);
  return {gridX:x.grid,gridY:y.grid,offsetX:x.offset,offsetY:y.offset,confidence,level:confidence>=.65?'high':confidence>=.4?'medium':'low'};
}
