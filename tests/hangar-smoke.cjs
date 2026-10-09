// Existing tooling only. No production test hooks are shipped.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:8774/drone-simulator/';
const baseline=process.env.BASELINE_URL;
const report={checks:[],performance:[],errors:[],resources:[],parity:[]};
const expose='\nwindow.qa={state,drone,world,camera,renderer,scene,ringMeshes,update,resetCourse,setMode,startCourse,togglePause,finish,profiles,resize,registerStrike,advanceRing,setAmbientEnabled,get audio(){return audioCtx},get master(){return audioMaster}};';
function ok(name,condition){assert.ok(condition,name);report.checks.push(name);console.log('PASS',name)}
async function instrument(page){await page.route('**/script.js*',async route=>{const r=await route.fetch();let source=await r.text();
 // Three.js UUID creation also consumes Math.random. Isolate mesh construction
 // in BOTH checkouts so identical course seeds mean identical course inputs.
 source=source.replace('function makeRing(', 'function visualMakeRing(');
 source=source.replace('const $=', 'let visualSeed=991;\nconst $=');
 source+='\nfunction makeRing(...args){const random=Math.random;Math.random=()=>((visualSeed=(visualSeed*1664525+1013904223)>>>0)/4294967296);try{return visualMakeRing(...args)}finally{Math.random=random}}';
 await route.fulfill({response:r,body:source+expose})});}
async function load(page){await instrument(page);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.resources.push(r.url())});await page.goto(base);await page.waitForFunction(()=>window.qa);await page.waitForTimeout(100);}
async function frozen(page,label){const a=await page.evaluate(()=>[qa.state.elapsed,qa.renderer.info.render.frame]);await page.waitForTimeout(120);ok(label,JSON.stringify(a)===JSON.stringify(await page.evaluate(()=>[qa.state.elapsed,qa.renderer.info.render.frame])));}
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});report.browser=await browser.version();try{
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:name==='mobile'?3:1,hasTouch:name==='mobile',isMobile:name==='mobile'});await load(p);
  ok(`${name}: controls in first viewport`,await p.locator('.control-bar').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight));
  ok(`${name}: no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await frozen(p,`${name}: standby does not continuously render`);
  for(const [mode,id]of [['training','trainingMode'],['attack','timeAttackMode'],['endless','endlessMode']]){
   await p.click('#'+id);ok(`${name}/${mode}: profile announced`,await p.locator('#'+id).getAttribute('aria-pressed')==='true');
   await p.click('#overlayButton');await p.waitForTimeout(300);
   ok(`${name}/${mode}: flight advances and overlay becomes inert`,await p.evaluate(()=>qa.state.elapsed>.15&&document.getElementById('overlay').inert));
   await p.click('#pauseButton');await p.waitForTimeout(50);await frozen(p,`${name}/${mode}: pause freezes simulation and GPU submissions`);
   await p.click('#overlayButton');await p.waitForTimeout(100);ok(`${name}/${mode}: overlay resumes`,await p.evaluate(()=>!qa.state.paused&&qa.state.running));
   await p.click('#resetButton');ok(`${name}/${mode}: reset restores course`,await p.evaluate(()=>qa.state.elapsed===0&&qa.state.ringIndex===0&&!qa.state.running));
  }
  await p.click('#trainingMode');await p.click('#startButton');const rect=await p.locator('#sceneHost').boundingBox();
  if(name==='mobile'){
   const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width*.3,y:rect.y+rect.height*.6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*.75,y:rect.y+rect.height*.4}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await p.mouse.move(rect.x+rect.width*.75,rect.y+rect.height*.4);
  ok(`${name}: pointer maps correctly`,await p.evaluate(()=>Math.abs(qa.state.targetX-3.1)<.04&&Math.abs(qa.state.targetY-.83)<.04&&!qa.state.pointerActive));
  await p.click('#resetButton');await p.click('#audioButton');ok(`${name}: audio off announced`,await p.locator('#audioButton').getAttribute('aria-pressed')==='false');
  for(const q of ['low','high','auto']){await p.selectOption('#qualitySelect',q);ok(`${name}: ${q} pixel ratio`,await p.evaluate(q=>qa.renderer.getPixelRatio()===Math.min(devicePixelRatio,q==='low'?1:q==='high'?2:1.5),q));}
  for(const [w,h]of [[360,800],[768,1024],[844,390],[1920,1080]]){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(50);ok(`${name}: resize ${w}x${h}`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&Math.abs(qa.camera.aspect-document.getElementById('sceneHost').clientWidth/document.getElementById('sceneHost').clientHeight)<.01));}
  await p.close();
 }
 const p=await browser.newPage({viewport:{width:1440,height:1000}});await load(p);
 for(const mode of ['training','attack','endless']){
  const result=await p.evaluate(mode=>{qa.setMode(mode);qa.resetCourse();const initial=qa.state.strikesLeft;const r=qa.ringMeshes[0];qa.state.distance=-r.position.z-.56;qa.drone.position.set(r.position.x+2.5*(mode==='attack'?.86:1),r.position.y,0);qa.state.targetX=qa.drone.position.x;qa.state.targetY=qa.drone.position.y;qa.update(.01);return {initial,after:qa.state.strikesLeft,finished:qa.state.finished,status:document.getElementById('statusReadout').textContent};},mode);
  ok(`${mode}: ring frame collision and failure status`,result.after===result.initial-1&&result.finished===(mode!=='training')&&(mode==='training'||result.status==='FLIGHT FAILED'));
 }
 const missed=await p.evaluate(()=>{qa.setMode('training');qa.resetCourse();qa.state.distance=13.44;qa.drone.position.set(6,4,0);qa.state.targetX=6;qa.state.targetY=4;qa.update(.01);return [qa.state.strikesLeft,qa.state.ringIndex]});ok('missed checkpoint consumes one strike and advances',JSON.stringify(missed)==='[2,1]');
 const clear=await p.evaluate(()=>{qa.setMode('training');qa.resetCourse();for(let i=0;i<2000&&!qa.state.finished;i++){const r=qa.ringMeshes[qa.state.ringIndex];qa.state.targetX=r.position.x;qa.state.targetY=r.position.y;qa.update(.01)}return {finished:qa.state.finished,rings:qa.state.ringIndex,best:qa.state.best,status:document.getElementById('statusReadout').textContent,saved:localStorage.getItem('droneRingBest_training')}});
 ok('12-gate course completion and best stored',clear.finished&&clear.rings===12&&clear.best>0&&Number(clear.saved)===clear.best&&clear.status==='COURSE CLEAR');
 await p.click('#overlayButton');ok('finished course retry starts fresh',await p.evaluate(()=>qa.state.running&&!qa.state.finished&&qa.state.ringIndex===0));await p.click('#pauseButton');
 await p.evaluate(()=>{qa.setMode('endless');qa.startCourse()});ok('changing profile during flight resets state',await p.evaluate(()=>qa.state.mode==='endless'&&qa.state.elapsed<.1));
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});await frozen(p,'hidden document stops simulation and rendering');ok('hidden document pauses flight',await p.evaluate(()=>qa.state.paused));
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(50);await frozen(p,'visible again remains paused until explicit resume');
 const memory=await p.evaluate(()=>{qa.setMode('training');qa.resetCourse();qa.renderer.render(qa.scene,qa.camera);const before={...qa.renderer.info.memory};for(let i=0;i<30;i++){qa.resetCourse();qa.renderer.render(qa.scene,qa.camera)}return {before,after:{...qa.renderer.info.memory}}});ok('30 resets keep GPU geometry/texture counts stable',JSON.stringify(memory.before)===JSON.stringify(memory.after));report.resetMemory=memory;
 const endless=await p.evaluate(()=>{qa.setMode('endless');qa.resetCourse();for(let i=0;i<100;i++){qa.state.ringIndex=i;qa.advanceRing()}qa.renderer.render(qa.scene,qa.camera);return {rings:qa.world.children.length,history:qa.ringMeshes.length,geometries:qa.renderer.info.memory.geometries}});ok('Endless retires passed gates from rendered world',endless.rings===8&&endless.history>=108);report.endless=endless;
 // Actual rendering cadence sampled during automated steering; not a mobile hardware benchmark.
 for(const [name,width,height,dpr]of [['desktop',1440,1000,1],['mobile-emulation',390,844,3]]){
  const perf=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});await load(perf);
  for(const mode of ['training','attack','endless']){
   const result=await perf.evaluate(mode=>new Promise(resolve=>{qa.setMode(mode);qa.resetCourse();qa.startCourse();const intervals=[];let start=performance.now(),last=start;function step(t){const r=qa.ringMeshes[qa.state.ringIndex];if(r){qa.state.targetX=r.position.x;qa.state.targetY=r.position.y}intervals.push(t-last);last=t;if(t-start<2400)requestAnimationFrame(step);else{qa.togglePause();intervals.shift();intervals.sort((a,b)=>a-b);const gl=qa.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95:intervals[Math.floor(intervals.length*.95)],calls:qa.renderer.info.render.calls,triangles:qa.renderer.info.render.triangles,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'})}}requestAnimationFrame(step)}),mode);
   report.performance.push({viewport:name,mode,...result});console.log('PERF',name,mode,result.fps.toFixed(1),result.calls);
  }await perf.close();
 }
 if(baseline){
  const before=await browser.newPage();await instrument(before);await before.goto(baseline);await before.waitForFunction(()=>window.qa);
  for(const mode of ['training','attack','endless']){
   const run=async page=>page.evaluate(mode=>{qa.setMode(mode);let seed=2604;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);qa.resetCourse();qa.renderer.setAnimationLoop(null);let steps=0;for(;steps<3000&&!qa.state.finished;steps++){const r=qa.ringMeshes[qa.state.ringIndex];qa.state.targetX=r.position.x;qa.state.targetY=r.position.y;qa.update(.01)}return {steps,mode:qa.state.mode,ringIndex:qa.state.ringIndex,strikes:qa.state.strikesLeft,elapsed:qa.state.elapsed,distance:qa.state.distance,finished:qa.state.finished,drone:qa.drone.position.toArray(),rotation:qa.drone.rotation.toArray(),camera:qa.camera.position.toArray(),rings:qa.ringMeshes.map(r=>({position:r.position.toArray(),checked:r.userData.checked,index:r.userData.index}))}},mode);
   const old=await run(before),current=await run(p);assert.deepEqual(current,old);ok(`${mode}: deterministic gameplay matches original`,true);report.parity.push({mode,steps:current.steps,rings:current.ringIndex,elapsed:current.elapsed});
  }await before.close();
 }
 await p.evaluate(()=>{qa.resetCourse();qa.startCourse();qa.togglePause()});
 ok('paused overlay receives keyboard focus',await p.locator('#overlayButton').evaluate(e=>document.activeElement===e));
 await p.keyboard.press('Enter');ok('Enter resumes from pause overlay',await p.evaluate(()=>qa.state.running&&!qa.state.paused));
 await p.evaluate(()=>qa.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
 await p.waitForFunction(()=>document.getElementById('overlayTitle').textContent==='GRAPHICS INTERRUPTED');
 ok('lost graphics context offers reload and disables flight controls',await p.locator('#startButton').isDisabled()&&await p.locator('#overlayButton').textContent()==='RELOAD PAGE');
 await p.close();
 const unavailable=await browser.newPage();await unavailable.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args)}});await unavailable.goto(base);await unavailable.waitForFunction(()=>document.getElementById('overlayTitle').textContent==='GRAPHICS UNAVAILABLE');ok('WebGL failure provides readable unavailable state',await unavailable.locator('#startButton').isDisabled());await unavailable.close();
 ok('no unexpected console or page errors',report.errors.length===0);ok('all resources loaded',report.resources.length===0);
}finally{fs.mkdirSync(path.resolve(__dirname,'../docs/hangar'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../docs/hangar/verification.json'),JSON.stringify(report,null,2));await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
