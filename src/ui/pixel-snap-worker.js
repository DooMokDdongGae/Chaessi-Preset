import {inspectPixelPng,snapPixels,scaleNearest,detectPixelGrid} from '../image-tools/pixel-snap-core.js';
// A worker is created per job and terminated on cancellation or replacement.
self.onmessage=async({data:{id,bytes,settings,detect}})=>{
  let bitmap;
  try{
    const input=inspectPixelPng(bytes);
    bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{colorSpaceConversion:'default'});
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});ctx.drawImage(bitmap,0,0);bitmap.close();bitmap=null;
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    if(detect){self.postMessage({id,detection:detectPixelGrid(image)});return;}
    const result=snapPixels(image,settings,percent=>self.postMessage({id,percent})),output=scaleNearest(result,result.settings.scale);
    canvas.width=output.width;canvas.height=output.height;ctx.putImageData(new ImageData(output.data,output.width,output.height),0,0);
    const png=await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer();
    self.postMessage({id,png,input,geometry:result.geometry,settings:result.settings,paletteSize:result.paletteSize},[png]);
  }catch(error){self.postMessage({id,error:error.message});}finally{bitmap?.close();}
};
