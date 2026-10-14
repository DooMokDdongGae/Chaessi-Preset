// Independent CLIP byte-BPE; merge data verified against OpenAI CLIP and NovelAI.
export class DirectorTokenizer {
  constructor({merges}) {
    if(!Array.isArray(merges)||merges.length!==48894)throw new Error('Invalid Director tokenizer data.');
    const bytes=[];for(const [start,end]of [[33,127],[161,173],[174,256]])for(let i=start;i<end;i++)bytes.push(i);
    const codepoints=[...bytes];let extra=0;for(let i=0;i<256;i++)if(!bytes.includes(i)){bytes.push(i);codepoints.push(256+extra++);}
    this.byteToChar=Object.fromEntries(bytes.map((b,i)=>[b,String.fromCodePoint(codepoints[i])]));
    const chars=codepoints.map(p=>String.fromCodePoint(p)),pairs=merges.map(line=>line.trim().split(/\s+/));
    this.ranks=new Map(pairs.map((p,i)=>[p.join('\0'),i]));this.encoder=new Map([...chars,...chars.map(c=>c+'</w>'),...pairs.map(p=>p.join('')),'<|startoftext|>','<|endoftext|>'].map((v,i)=>[v,i]));this.cache=new Map();
  }
  encode(value){
    let text=String(value??'').normalize('NFC');for(let i=0;i<2;i++)text=text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,decimal,hex,named)=>{if(decimal||hex){const n=parseInt(decimal||hex,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'�';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[named.toLowerCase()];});
    text=text.replace(/\s+/gu,' ').trim().toLowerCase();const ids=[];
    for(const match of text.matchAll(/<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|\p{L}+|\p{N}|[^\s\p{L}\p{N}]+/gu)){
      const token=[...new TextEncoder().encode(match[0])].map(b=>this.byteToChar[b]).join('');ids.push(...this.bpe(token));
    }return ids;
  }
  count(text){return this.encode(text).length;}
  bpe(token){if(this.cache.has(token))return this.cache.get(token);if(this.encoder.has(token)&&token.startsWith('<|'))return [this.encoder.get(token)];
    let parts=[...token];parts[parts.length-1]+='</w>';
    while(parts.length>1){let best=Infinity,index=-1;for(let i=0;i<parts.length-1;i++){const rank=this.ranks.get(parts[i]+'\0'+parts[i+1]);if(rank!==undefined&&rank<best){best=rank;index=i;}}if(index<0)break;
      const a=parts[index],b=parts[index+1],next=[];for(let i=0;i<parts.length;){if(parts[i]===a&&parts[i+1]===b){next.push(a+b);i+=2;}else next.push(parts[i++]);}parts=next;
    }
    const ids=parts.map(p=>{if(!this.encoder.has(p))throw new Error('Director tokenizer could not encode this text.');return this.encoder.get(p);});if(this.cache.size>2048)this.cache.clear();this.cache.set(token,ids);return ids;
  }
}
export async function loadDirectorTokenizer(){const r=await fetch('/assets/tokenizers/clip-merges.deflate');if(!r.ok)throw new Error('Director tokenizer unavailable.');return new DirectorTokenizer(JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('deflate-raw'))).text()));}
