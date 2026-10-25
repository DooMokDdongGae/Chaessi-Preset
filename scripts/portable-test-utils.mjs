import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import net from 'node:net';import {once} from 'node:events';
export async function freePort(){const p=net.createServer();p.listen(0,'127.0.0.1');await once(p,'listening');const port=p.address().port;await new Promise(r=>p.close(r));return port;}
export async function launchPortable(executable,profile,serverPort){
 await mkdir(profile,{recursive:true});const debugPort=await freePort();
 const extraction=await mkdtemp(path.join(profile,'portable-run-'));
 const env={...process.env,TEMP:extraction,TMP:extraction,PORT:String(serverPort),NAI_ACCESS_TOKEN:'',NOVELAI_TOKEN:'',NODE_OPTIONS:''};delete env.ELECTRON_RUN_AS_NODE;delete env.CHAESSI_PRIVATE_TEST_PROFILE;delete env.CHAESSI_USER_DATA_DIR;
 const child=spawn(path.resolve(executable),[`--user-data-dir=${path.resolve(profile)}`,`--remote-debugging-port=${debugPort}`],{env,windowsHide:true,stdio:'ignore'});
 let spawnError;child.once('error',e=>spawnError=e);
 const {chromium}=createRequire(import.meta.url)(process.env.CHAESSI_PLAYWRIGHT||'playwright');
 const url=`http://127.0.0.1:${debugPort}`;let ready=false;
 for(let i=0;i<120;i++){if(spawnError)throw spawnError;try{if((await fetch(url+'/json/version',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error('Portable executable did not expose its isolated test window.');
 const browser=await chromium.connectOverCDP(url),context=browser.contexts()[0];
 let page=context.pages()[0];if(!page)page=await context.waitForEvent('page');
 try{await page.waitForFunction(()=>document.querySelector('#presetName')?.value,{},{timeout:45000});}
 catch(error){await page.screenshot({path:path.join(profile,'boot-failure.png')}).catch(()=>{});await writeFile(path.join(profile,'boot-failure.json'),JSON.stringify({url:page.url(),text:await page.locator('body').innerText().catch(()=>''),port:serverPort,debugPort}));await page.close().catch(()=>{});await browser.close().catch(()=>{});throw error;}
 console.log(JSON.stringify({portable_connected:true,version:(await(await fetch(`http://127.0.0.1:${serverPort}/api/health`)).json()).version}));
 return {browser,page,profile,async close(){await page.close().catch(()=>{});await browser.close().catch(()=>{});for(let i=0;i<40;i++){try{await fetch(`http://127.0.0.1:${serverPort}/api/health`,{signal:AbortSignal.timeout(200)});}catch{return;}await new Promise(r=>setTimeout(r,100));}throw Error('Isolated portable server did not stop.');}};
}
