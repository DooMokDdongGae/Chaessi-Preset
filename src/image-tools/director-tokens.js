import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {DirectorTokenizer} from '../ui/director-tokenizer.js';
let loaded;
export async function countDirectorTokens(text){loaded??=readFile(new URL('../../assets/tokenizers/clip-merges.deflate',import.meta.url)).then(bytes=>new DirectorTokenizer(JSON.parse(inflateRawSync(bytes))));return (await loaded).count(text);}
