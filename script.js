import * as THREE from './vendor/three.module.js';
import {createDrone,createHangar,createGate,styleGate,releaseGate} from './hangar-visuals.js';

const $=id=>document.getElementById(id);
const host=$('sceneHost'),ringsReadout=$('ringsReadout'),strikesReadout=$('strikesReadout'),timeReadout=$('timeReadout'),bestReadout=$('bestReadout'),statusReadout=$('statusReadout'),speedReadout=$('speedReadout'),statusBox=$('statusBox');
const trainingMode=$('trainingMode'),timeAttackMode=$('timeAttackMode'),endlessMode=$('endlessMode'),modeDescription=$('modeDescription'),startButton=$('startButton'),pauseButton=$('pauseButton'),resetButton=$('resetButton'),audioButton=$('audioButton');
const overlay=$('overlay'),overlayTitle=$('overlayTitle'),overlayText=$('overlayText'),overlayButton=$('overlayButton');

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(64,16/10,.1,320);camera.position.set(0,2.8,9.7);
const world=new THREE.Group();scene.add(world);
const {drone,rotors}=createDrone();scene.add(drone);
const hangar=createHangar(scene);
let frame=0,disposed=false,graphicsLost=false;
function requestFrame(){if(!frame&&!document.hidden&&!disposed&&!graphicsLost)frame=requestAnimationFrame(loop);}
function stopFrame(){cancelAnimationFrame(frame);frame=0;}
function render(){if(!document.hidden&&!disposed&&!graphicsLost)renderer.render(scene,camera);}

const fixedCourse=[[0,0,-14],[2.8,1.7,-26],[-3.4,2.6,-38],[3.7,-1.5,-50],[-1.7,-2.4,-62],[4.2,2.2,-74],[-4.5,.5,-86],[1.6,3,-98],[-3,-2.8,-110],[4.5,-.5,-122],[-1,1.2,-134],[0,0,-146]];
const ringMeshes=[];const ringInner=2.05;
function makeRing(x,y,z,index){const ring=createGate(x,y,z,index);world.add(ring);ringMeshes.push(ring);return ring;}
function clearRings(){for(const r of ringMeshes){world.remove(r);if(!r.userData.retired)releaseGate(r);}ringMeshes.length=0;}
function buildFixedCourse(){clearRings();fixedCourse.forEach(([x,y,z],i)=>makeRing(x,y,z,i));}
function nextEndlessPosition(i){const difficulty=Math.min(1,i/45);const maxX=3.2+difficulty*2.0,maxY=2.0+difficulty*1.5;let x=(Math.random()*2-1)*maxX,y=(Math.random()*2-1)*maxY;if(i<3){x*=.55;y*=.55;}return[x,y];}
function buildEndlessCourse(count=9){clearRings();let z=-18;for(let i=0;i<count;i++){const [x,y]=nextEndlessPosition(i);makeRing(x,y,z,i);z-=18+Math.random()*5;}}
function appendEndlessRing(){const last=ringMeshes[ringMeshes.length-1];const i=ringMeshes.length;const [x,y]=nextEndlessPosition(i);const gap=18+Math.random()*6;makeRing(x,y,last.position.z-gap,i);}

const profiles={
  training:{name:'TRAINING',strikes:3,speed:10.0,acceleration:.08,ringScale:1,handling:.00006},
  attack:{name:'TIME ATTACK',strikes:1,speed:12.5,acceleration:.16,ringScale:.86,handling:.000035},
  endless:{name:'ENDLESS',strikes:1,speed:9.5,acceleration:.34,ringScale:1,handling:.000025}
};
const state={mode:'training',running:false,paused:false,finished:false,ringIndex:0,strikesLeft:3,elapsed:0,distance:0,lastTime:0,pointerActive:false,targetX:0,targetY:0,best:null,audioEnabled:true};
const cfg=()=>profiles[state.mode];
const bestKey=()=>state.mode==='endless'?'droneRingBest_endless':`droneRingBest_${state.mode}`;
function loadBest(){const v=Number(localStorage.getItem(bestKey()));state.best=Number.isFinite(v)&&v>0?v:null;}
function setStatus(text){statusBox.textContent=text;}
function updateHud(status=state.running?'ACTIVE':'STANDBY'){
  ringsReadout.textContent=state.mode==='endless'?`${state.ringIndex} / ∞`:`${state.ringIndex} / ${fixedCourse.length}`;
  strikesReadout.textContent=Array.from({length:cfg().strikes},(_,i)=>i<state.strikesLeft?'○':'×').join(' ');
  timeReadout.textContent=`${state.elapsed.toFixed(2)} s`;
  bestReadout.textContent=state.best?(state.mode==='endless'?`${state.best} rings`:`${state.best.toFixed(2)} s`):'—';
  statusReadout.textContent=status;
  const speed=cfg().speed+state.elapsed*cfg().acceleration;speedReadout.textContent=`VELOCITY: ${(speed/cfg().speed).toFixed(2)}×`;
}
function updateModeUI(){for(const [button,mode] of [[trainingMode,'training'],[timeAttackMode,'attack'],[endlessMode,'endless']])button.setAttribute('aria-pressed',String(state.mode===mode));trainingMode.classList.toggle('active',state.mode==='training');timeAttackMode.classList.toggle('active',state.mode==='attack');endlessMode.classList.toggle('active',state.mode==='endless');modeDescription.textContent=state.mode==='training'?'TRAINING // generous rings, three strikes, responsive controls.':state.mode==='attack'?'TIME ATTACK // smaller gates, one strike, faster course, separate best time.':'ENDLESS // procedural rings, one strike, continuously rising speed, best score by rings cleared.';}
function setRingVisuals(){ringMeshes.forEach((ring,i)=>{const active=i===state.ringIndex,passed=i<state.ringIndex;if(passed){ring.visible=false;if(!ring.userData.retired){world.remove(ring);releaseGate(ring);ring.clear();ring.userData={index:i,checked:true,retired:true};}return;}const dynamicScale=state.mode==='endless'?Math.max(.78,1-state.ringIndex*.0035):cfg().ringScale;ring.scale.setScalar(active?dynamicScale:1);styleGate(ring,active);});}
function showOverlay(title,text,button='RETRY COURSE'){overlayTitle.textContent=title;overlayText.textContent=text;overlayButton.textContent=button;overlay.classList.add('visible');overlay.inert=false;overlay.setAttribute('aria-hidden','false');if(state.finished||state.paused)overlayButton.focus({preventScroll:true});requestFrame();}
function hideOverlay(){overlay.classList.remove('visible');overlay.inert=true;overlay.setAttribute('aria-hidden','true');}

let audioCtx=null,audioMaster=null,audioNodes=[];
function startAmbient(){if(!state.audioEnabled)return;if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioMaster=audioCtx.createGain();audioMaster.gain.value=.018;audioMaster.connect(audioCtx.destination);const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=850;filter.Q.value=.5;filter.connect(audioMaster);[[110,'sine',.20],[164.81,'sine',.10],[220,'triangle',.035]].forEach(([freq,type,gain])=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;g.gain.value=gain;osc.connect(g);g.connect(filter);osc.start();audioNodes.push(osc,g);});}if(audioCtx.state==='suspended')audioCtx.resume();if(audioMaster)audioMaster.gain.setTargetAtTime(.018,audioCtx.currentTime,.25);}
function setAmbientEnabled(on){state.audioEnabled=on;audioButton.textContent=`AMBIENT: ${on?'ON':'OFF'}`;audioButton.setAttribute('aria-pressed',String(on));if(audioCtx&&audioMaster){audioMaster.gain.setTargetAtTime(on ? .018 : 0,audioCtx.currentTime,.2);}if(on)startAmbient();}

function resetCourse(customStatus){stopFrame();state.pointerActive=false;state.running=false;state.paused=false;state.finished=false;state.ringIndex=0;state.strikesLeft=cfg().strikes;state.elapsed=0;state.distance=0;state.targetX=0;state.targetY=0;drone.position.set(0,0,0);drone.rotation.set(0,0,0);world.position.z=0;hangar.update(0);camera.position.set(0,2.8,9.7);camera.lookAt(0,0,-6.5);state.mode==='endless'?buildEndlessCourse():buildFixedCourse();loadBest();setRingVisuals();updateModeUI();updateHud('STANDBY');pauseButton.disabled=true;pauseButton.textContent='PAUSE';startButton.textContent='START COURSE';const msg=state.mode==='training'?'Training course ready. Three strikes before certification becomes embarrassing.':state.mode==='attack'?'Time Attack armed. One mistake and the paperwork begins.':'Endless armed. One mistake. No finish line. Speed only goes one direction.';setStatus(customStatus||msg);showOverlay('COURSE STANDBY',state.mode==='endless'?'Procedural gates. One strike. Survive for as many rings as your mouse hand can negotiate.':state.mode==='training'?'Pass through 12 rings. You have three strikes.':'One strike. Smaller rings. Faster course. Good luck.','START COURSE');}
function setMode(mode){if(!profiles[mode]||mode===state.mode)return;const interrupted=state.running||state.paused;state.running=false;state.paused=false;state.mode=mode;resetCourse(interrupted?`${cfg().name} loaded. Previous course aborted.`:`${cfg().name} profile loaded.`);}
function startCourse(){if(state.finished)resetCourse();if(state.running&&!state.paused)return;startAmbient();state.running=true;state.paused=false;state.lastTime=performance.now();pauseButton.disabled=false;pauseButton.textContent='PAUSE';startButton.textContent='FLIGHT ACTIVE';hideOverlay();setStatus(state.mode==='endless'?'ENDLESS ACTIVE // keep reading the next gate; forward velocity will not negotiate.':'Course active. Follow the glowing gate and avoid becoming a very small insurance claim.');updateHud('ACTIVE');requestFrame();}
function togglePause(){if(!state.running||state.finished)return;state.paused=!state.paused;pauseButton.textContent=state.paused?'RESUME':'PAUSE';if(state.paused){stopFrame();updateHud('PAUSED');setStatus('Simulation paused. The drone has discovered union rules.');showOverlay('SIMULATION PAUSED','Flight frozen. Telemetry remains visible.','RESUME');}else{hideOverlay();state.lastTime=performance.now();requestFrame();}}
function finish(success){state.running=false;state.finished=true;pauseButton.disabled=true;if(state.mode==='endless'){if(!state.best||state.ringIndex>state.best){state.best=state.ringIndex;localStorage.setItem(bestKey(),String(state.best));}updateHud('FLIGHT FAILED');setStatus(`ENDLESS COMPLETE // ${state.ringIndex} rings cleared in ${state.elapsed.toFixed(2)} s.`);showOverlay('ENDLESS RUN OVER',`${state.ringIndex} rings cleared. Velocity eventually won the argument.`,'RETRY ENDLESS');return;}if(success){if(!state.best||state.elapsed<state.best){state.best=state.elapsed;localStorage.setItem(bestKey(),String(state.best));}updateHud('COURSE CLEAR');setStatus(`COURSE CLEAR // ${state.elapsed.toFixed(2)} s. Drone remains mostly reusable.`);showOverlay('COURSE COMPLETE',`${fixedCourse.length} checkpoints processed in ${state.elapsed.toFixed(2)} seconds.`,'RETRY COURSE');}else{updateHud('FLIGHT FAILED');setStatus(`FLIGHT FAILED // ${state.ringIndex}/${fixedCourse.length} checkpoints processed before structural optimism expired.`);showOverlay('CERTIFICATION DENIED',`${state.ringIndex} checkpoints processed. The hangar would like its drone back.`,'RETRY COURSE');}}
function registerStrike(reason){state.strikesLeft--;if(state.strikesLeft<=0){finish(false);return false;}setStatus(`${reason} // ${state.strikesLeft} ${state.strikesLeft===1?'strike':'strikes'} remaining.`);updateHud('IMPACT');return true;}
function advanceRing(){state.ringIndex++;if(state.mode==='endless'){while(ringMeshes.length-state.ringIndex<8)appendEndlessRing();setRingVisuals();return true;}setRingVisuals();if(state.ringIndex>=fixedCourse.length){finish(true);return false;}return true;}
function update(dt){state.elapsed+=dt;const speed=cfg().speed+state.elapsed*cfg().acceleration;state.distance+=speed*dt;world.position.z=state.distance;const responsiveness=1-Math.pow(cfg().handling,dt);drone.position.x+=(state.targetX-drone.position.x)*responsiveness;drone.position.y+=(state.targetY-drone.position.y)*responsiveness;drone.position.x=THREE.MathUtils.clamp(drone.position.x,-6.4,6.4);drone.position.y=THREE.MathUtils.clamp(drone.position.y,-4.25,4.65);const dx=state.targetX-drone.position.x,dy=state.targetY-drone.position.y;drone.rotation.z=THREE.MathUtils.lerp(drone.rotation.z,-dx*.12,.22);drone.rotation.x=THREE.MathUtils.lerp(drone.rotation.x,dy*.07,.22);drone.rotation.y=THREE.MathUtils.lerp(drone.rotation.y,-dx*.025,.12);rotors.forEach((r,i)=>r.rotation.y+=dt*(i%2?30:-30));hangar.update(state.distance,drone.position.x);const active=ringMeshes[state.ringIndex];if(active){active.rotation.z+=dt*.55;const z=active.position.z+world.position.z;if(z>-.55&&!active.userData.checked){active.userData.checked=true;const dynamicScale=state.mode==='endless'?Math.max(.78,1-state.ringIndex*.0035):cfg().ringScale;const radial=Math.hypot(drone.position.x-active.position.x,drone.position.y-active.position.y),aperture=ringInner*dynamicScale;if(radial<=aperture){setStatus(`RING ${String(state.ringIndex+1).padStart(2,'0')} CLEAR // trajectory acceptable.`);advanceRing();}else if(radial<=3*dynamicScale){if(registerStrike('RING FRAME IMPACT'))advanceRing();}else{if(registerStrike('CHECKPOINT MISSED'))advanceRing();}}}camera.position.x+=((drone.position.x*.24)-camera.position.x)*(1-Math.pow(.03,dt));camera.position.y+=((2.8+drone.position.y*.17)-camera.position.y)*(1-Math.pow(.03,dt));camera.position.z=9.7;camera.lookAt(drone.position.x*.14,drone.position.y*.10,-6.5);if(!state.finished)updateHud('ACTIVE');}
function loop(now){frame=0;if(document.hidden||disposed)return;if(state.running&&!state.paused&&!state.finished){const dt=Math.min(.033,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt);if(state.running&&!state.paused&&!state.finished)requestFrame();}render();}
function pointerToTarget(e){const rect=host.getBoundingClientRect();const nx=((e.clientX-rect.left)/rect.width)*2-1,ny=-(((e.clientY-rect.top)/rect.height)*2-1);state.targetX=nx*6.2;state.targetY=ny*4.15;}

// UI inside the flight window must not be interpreted as drone input.
overlay.addEventListener('pointerdown',e=>e.stopPropagation());
overlay.addEventListener('pointermove',e=>e.stopPropagation());
overlay.addEventListener('pointerup',e=>e.stopPropagation());
overlay.addEventListener('pointercancel',e=>e.stopPropagation());

host.addEventListener('pointerdown',e=>{if(e.target.closest?.('#overlay'))return;e.preventDefault();state.pointerActive=true;host.setPointerCapture?.(e.pointerId);pointerToTarget(e);});
host.addEventListener('pointermove',e=>{if(e.target.closest?.('#overlay'))return;if(e.pointerType!=='mouse'&&!state.pointerActive)return;pointerToTarget(e);});
host.addEventListener('pointerup',e=>{if(e.target.closest?.('#overlay'))return;state.pointerActive=false;host.releasePointerCapture?.(e.pointerId);});
host.addEventListener('pointercancel',()=>state.pointerActive=false);
trainingMode.addEventListener('click',()=>setMode('training'));timeAttackMode.addEventListener('click',()=>setMode('attack'));endlessMode.addEventListener('click',()=>setMode('endless'));startButton.addEventListener('click',startCourse);pauseButton.addEventListener('click',togglePause);resetButton.addEventListener('click',()=>resetCourse());overlayButton.addEventListener('click',e=>{e.stopPropagation();if(graphicsLost){location.reload();return;}state.paused?togglePause():startCourse();});audioButton.addEventListener('click',()=>setAmbientEnabled(!state.audioEnabled));
function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestFrame();}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);window.addEventListener('resize',resize);
$('qualitySelect').addEventListener('change',()=>{const quality=$('qualitySelect').value;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='low'?1:quality==='high'?2:1.5));resize();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFrame();if(state.running&&!state.paused&&!state.finished)togglePause();audioCtx?.suspend();}else{requestFrame();if(state.audioEnabled&&audioCtx)audioCtx.resume();}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();graphicsLost=true;stopFrame();state.running=false;state.paused=false;for(const button of document.querySelectorAll('button'))button.disabled=true;$('qualitySelect').disabled=true;overlayButton.disabled=false;showOverlay('GRAPHICS INTERRUPTED','The graphics context was lost. Reload the page to restart the flight.','RELOAD PAGE');});
window.addEventListener('pagehide',event=>{stopFrame();audioCtx?.suspend();if(event.persisted)return;disposed=true;resizeObserver.disconnect();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();audioCtx?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted){if(state.running&&!state.paused)togglePause();requestFrame();}});
resetCourse();resize();
