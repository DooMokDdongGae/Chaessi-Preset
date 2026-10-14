import {inflateRawSync} from 'node:zlib';
import {crc32} from './png-integrity.js';
// Dedicated bounded decoder: do not alter the legacy generator's ZIP handling.
export function decodeToolZip(buffer,{allowWebp=false}={}) {
  let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('Incomplete image ZIP response.');
  const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),total=0;const images=[];
  if(count>20)throw new Error('Unexpected ZIP image count.');
  for(let i=0;i<count;i++){
    if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid ZIP directory.');
    const flags=buffer.readUInt16LE(offset+8),method=buffer.readUInt16LE(offset+10),crc=buffer.readUInt32LE(offset+16),size=buffer.readUInt32LE(offset+20),rawSize=buffer.readUInt32LE(offset+24);
    const n=buffer.readUInt16LE(offset+28),x=buffer.readUInt16LE(offset+30),c=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42),name=buffer.toString('utf8',offset+46,offset+46+n);
    offset+=46+n+x+c;
    if(!(allowWebp?/^image[^/\\]*\.(png|webp)$/i:/^image[^/\\]*\.png$/i).test(name))continue;
    total+=rawSize;
    if(flags&1||total>128*1024*1024||local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw new Error('Unsafe ZIP image.');
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    if(start+size>buffer.length)throw new Error('Truncated ZIP image.');
    const compressed=buffer.subarray(start,start+size);
    const bytes=method===0?compressed:method===8?inflateRawSync(compressed,{maxOutputLength:rawSize+1}):null;
    if(!bytes||bytes.length!==rawSize||crc32(bytes)!==crc)throw new Error('Invalid ZIP image checksum.');
    images.push({name,bytes});
  }
  if(!images.length||images.length>6)throw new Error('No usable PNG result in ZIP.');
  return images;
}
