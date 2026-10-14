export function createToolCanvas(canvas,{onChange=()=>{},getMode=()=> 'view',getTool=()=> 'pen',getColor=()=> '#ff0000',getSize=()=>20,onSelection=()=>{}}={}) {
  const ctx=canvas.getContext('2d',{willReadFrequently:true});let undo=[],redo=[],drawing=false,previous=null,start=null,dirty=false;
  const LIMIT=16_777_216,BUDGET=64*1024*1024;
  const snapshot=()=>ctx.getImageData(0,0,canvas.width,canvas.height);
  const selectionMode=()=>getMode()==='focused-inpaint'||getMode()==='canvas'&&getTool()==='select';
  function checkpoint(){const item=snapshot();undo.push(item);let size=undo.reduce((n,p)=>n+p.data.length,0);while(undo.length>1&&size>BUDGET)size-=undo.shift().data.length;redo=[];}
  function restore(item){canvas.width=item.width;canvas.height=item.height;ctx.putImageData(item,0,0);dirty=true;onChange();}
  function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width-1,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height-1,(e.clientY-r.top)*canvas.height/r.height))};}
  function stroke(a,b){ctx.save();ctx.globalCompositeOperation=getTool()==='eraser'?'destination-out':'source-over';ctx.strokeStyle=getColor();ctx.lineWidth=Number(getSize());ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();}
  function fill(p){const img=snapshot(),d=img.data,w=img.width,h=img.height,x=Math.floor(p.x),y=Math.floor(p.y),i=(y*w+x)*4,target=Array.from(d.subarray(i,i+4)),hex=getColor().replace('#',''),color=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),255];
    if(color.every((v,k)=>v===target[k]))return;
    const queue=new Int32Array(w*h);let read=0,write=0;
    function visit(n){const o=n*4;if(!target.every((v,k)=>v===d[o+k]))return;d.set(color,o);queue[write++]=n;}
    visit(y*w+x);while(read<write){const n=queue[read++],xx=n%w,yy=Math.floor(n/w);if(xx)visit(n-1);if(xx<w-1)visit(n+1);if(yy)visit(n-w);if(yy<h-1)visit(n+w);}
    ctx.putImageData(img,0,0);
  }
  canvas.addEventListener('pointerdown',e=>{if(!['canvas','focused-inpaint'].includes(getMode()))return;e.preventDefault();canvas.setPointerCapture(e.pointerId);start=point(e);previous=start;drawing=true;if(!selectionMode()){checkpoint();if(getTool()==='fill'){fill(start);drawing=false;dirty=true;onChange();}else stroke(start,{x:start.x+.01,y:start.y+.01});}});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);if(!selectionMode()){stroke(previous,p);previous=p;}else onSelection(selection(start,p));});
  const finish=e=>{if(!drawing)return;drawing=false;if(!selectionMode()){dirty=true;onChange();}else onSelection(selection(start,point(e)));};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',()=>{if(drawing&&!selectionMode()){dirty=true;onChange();}drawing=false;});
  return {
    async load(url){const image=new Image();image.src=url;await image.decode();if(image.width*image.height>LIMIT)throw new Error('Image dimensions exceed the tool limit.');canvas.width=image.width;canvas.height=image.height;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);undo=[];redo=[];dirty=false;},
    undo(){if(!undo.length)return;redo.push(snapshot());restore(undo.pop());},redo(){if(!redo.length)return;undo.push(snapshot());restore(redo.pop());},
    resize(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>LIMIT)throw new Error('Image dimensions exceed the tool limit.');checkpoint();const temp=document.createElement('canvas');temp.width=width;temp.height=height;temp.getContext('2d').drawImage(canvas,0,0,width,height);canvas.width=width;canvas.height=height;ctx.drawImage(temp,0,0);dirty=true;onChange();},
    crop(r){if(!Object.values(r).every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>canvas.width||r.y+r.height>canvas.height)throw new Error('Crop must stay inside the image.');checkpoint();const image=ctx.getImageData(r.x,r.y,r.width,r.height);canvas.width=r.width;canvas.height=r.height;ctx.putImageData(image,0,0);dirty=true;onChange();},
    base64:()=>canvas.toDataURL('image/png').split(',')[1],isDirty:()=>dirty,markSaved(){dirty=false;},size:()=>({width:canvas.width,height:canvas.height}),
  };
}
function selection(a,b){return {x:Math.floor(Math.min(a.x,b.x)),y:Math.floor(Math.min(a.y,b.y)),width:Math.max(8,Math.ceil(Math.abs(a.x-b.x))),height:Math.max(8,Math.ceil(Math.abs(a.y-b.y)))};}
