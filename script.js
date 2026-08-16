import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $=id=>document.getElementById(id);
const host=$('sceneHost'),ringsReadout=$('ringsReadout'),strikesReadout=$('strikesReadout'),timeReadout=$('timeReadout'),bestReadout=$('bestReadout'),statusReadout=$('statusReadout'),speedReadout=$('speedReadout'),statusBox=$('statusBox');
const trainingMode=$('trainingMode'),timeAttackMode=$('timeAttackMode'),endlessMode=$('endlessMode'),modeDescription=$('modeDescription'),startButton=$('startButton'),pauseButton=$('pauseButton'),resetButton=$('resetButton'),audioButton=$('audioButton');
const overlay=$('overlay'),overlayTitle=$('overlayTitle'),overlayText=$('overlayText'),overlayButton=$('overlayButton');

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x020607,1);renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x020607,.018);
const camera=new THREE.PerspectiveCamera(64,16/10,.1,320);camera.position.set(0,2.8,9.7);
scene.add(new THREE.HemisphereLight(0x7ee8ff,0x06100d,1.5));
const keyLight=new THREE.DirectionalLight(0x69f0c1,2.2);keyLight.position.set(4,8,6);scene.add(keyLight);
const rimLight=new THREE.PointLight(0x5fd1ff,25,30,2);rimLight.position.set(-5,2,4);scene.add(rimLight);

const world=new THREE.Group();scene.add(world);
const drone=new THREE.Group();scene.add(drone);
const darkMat=new THREE.MeshStandardMaterial({color:0x0b2020,metalness:.75,roughness:.3});
const glowMat=new THREE.MeshStandardMaterial({color:0x5fd1ff,emissive:0x14516a,emissiveIntensity:2.2,metalness:.45,roughness:.25});
drone.add(new THREE.Mesh(new THREE.BoxGeometry(1.1,.3,.9),darkMat));
const rotors=[];
for(const sx of[-1,1])for(const sz of[-1,1]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.85,.08,.08),glowMat);arm.position.set(sx*.55,0,sz*.34);arm.rotation.y=sz*sx*.42;drone.add(arm);const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.035,24),new THREE.MeshStandardMaterial({color:0x69f0c1,emissive:0x123f34,emissiveIntensity:1.8,transparent:true,opacity:.82}));rotor.rotation.x=Math.PI/2;rotor.position.set(sx*.92,.08,sz*.6);drone.add(rotor);rotors.push(rotor);}
const nose=new THREE.Mesh(new THREE.ConeGeometry(.22,.5,6),glowMat);nose.rotation.x=Math.PI/2;nose.position.z=-.67;drone.add(nose);

const floor=new THREE.GridHelper(120,60,0x2c6b5b,0x15322c);floor.position.set(0,-5.2,-44);world.add(floor);
for(const x of[-7.5,7.5]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,150),new THREE.MeshBasicMaterial({color:0x173d36}));rail.position.set(x,-4.4,-65);world.add(rail);}
const starGeo=new THREE.BufferGeometry(),starCount=1000,starPos=new Float32Array(starCount*3);
for(let i=0;i<starCount;i++){starPos[i*3]=(Math.random()-.5)*70;starPos[i*3+1]=(Math.random()-.5)*38;starPos[i*3+2]=-Math.random()*220+20;}
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));world.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fc9bd,size:.06,transparent:true,opacity:.75})));

const fixedCourse=[[0,0,-14],[2.8,1.7,-26],[-3.4,2.6,-38],[3.7,-1.5,-50],[-1.7,-2.4,-62],[4.2,2.2,-74],[-4.5,.5,-86],[1.6,3,-98],[-3,-2.8,-110],[4.5,-.5,-122],[-1,1.2,-134],[0,0,-146]];
const ringMeshes=[];const ringInner=2.05;
function makeRing(x,y,z,index){const mat=new THREE.MeshStandardMaterial({color:0x2f6658,emissive:0x09251e,emissiveIntensity:1.2,metalness:.5,roughness:.35});const ring=new THREE.Mesh(new THREE.TorusGeometry(2.55,.23,14,48),mat);ring.position.set(x,y,z);ring.userData={index,checked:false};world.add(ring);ringMeshes.push(ring);return ring;}
function clearRings(){for(const r of ringMeshes)world.remove(r);ringMeshes.length=0;}
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
function updateModeUI(){trainingMode.classList.toggle('active',state.mode==='training');timeAttackMode.classList.toggle('active',state.mode==='attack');endlessMode.classList.toggle('active',state.mode==='endless');modeDescription.textContent=state.mode==='training'?'TRAINING // generous rings, three strikes, responsive controls.':state.mode==='attack'?'TIME ATTACK // smaller gates, one strike, faster course, separate best time.':'ENDLESS // procedural rings, one strike, continuously rising speed, best score by rings cleared.';}
function setRingVisuals(){ringMeshes.forEach((ring,i)=>{const active=i===state.ringIndex,passed=i<state.ringIndex;ring.visible=!passed;const dynamicScale=state.mode==='endless'?Math.max(.78,1-state.ringIndex*.0035):cfg().ringScale;ring.scale.setScalar(active?dynamicScale:1);ring.material.color.set(active?0x69f0c1:0x2f6658);ring.material.emissive.set(active?0x1c7a62:0x09251e);ring.material.emissiveIntensity=active?3.4:1.15;});}
function showOverlay(title,text,button='RETRY COURSE'){overlayTitle.textContent=title;overlayText.textContent=text;overlayButton.textContent=button;overlay.classList.add('visible');}
function hideOverlay(){overlay.classList.remove('visible');}

let audioCtx=null,audioMaster=null,audioNodes=[];
function startAmbient(){if(!state.audioEnabled)return;if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioMaster=audioCtx.createGain();audioMaster.gain.value=.018;audioMaster.connect(audioCtx.destination);const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=850;filter.Q.value=.5;filter.connect(audioMaster);[[110,'sine',.20],[164.81,'sine',.10],[220,'triangle',.035]].forEach(([freq,type,gain])=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;g.gain.value=gain;osc.connect(g);g.connect(filter);osc.start();audioNodes.push(osc,g);});}if(audioCtx.state==='suspended')audioCtx.resume();if(audioMaster)audioMaster.gain.setTargetAtTime(.018,audioCtx.currentTime,.25);}
function setAmbientEnabled(on){state.audioEnabled=on;audioButton.textContent=`AMBIENT: ${on?'ON':'OFF'}`;audioButton.setAttribute('aria-pressed',String(on));if(audioCtx&&audioMaster){audioMaster.gain.setTargetAtTime(on ? .018 : 0,audioCtx.currentTime,.2);}if(on)startAmbient();}

function resetCourse(customStatus){state.running=false;state.paused=false;state.finished=false;state.ringIndex=0;state.strikesLeft=cfg().strikes;state.elapsed=0;state.distance=0;state.targetX=0;state.targetY=0;drone.position.set(0,0,0);drone.rotation.set(0,0,0);world.position.z=0;camera.position.set(0,2.8,9.7);camera.lookAt(0,0,-6.5);state.mode==='endless'?buildEndlessCourse():buildFixedCourse();loadBest();setRingVisuals();updateModeUI();updateHud('STANDBY');pauseButton.disabled=true;pauseButton.textContent='PAUSE';startButton.textContent='START COURSE';const msg=state.mode==='training'?'Training course ready. Three strikes before certification becomes embarrassing.':state.mode==='attack'?'Time Attack armed. One mistake and the paperwork begins.':'Endless armed. One mistake. No finish line. Speed only goes one direction.';setStatus(customStatus||msg);showOverlay('COURSE STANDBY',state.mode==='endless'?'Procedural gates. One strike. Survive for as many rings as your mouse hand can negotiate.':state.mode==='training'?'Pass through 12 rings. You have three strikes.':'One strike. Smaller rings. Faster course. Good luck.','START COURSE');}
function setMode(mode){if(!profiles[mode]||mode===state.mode)return;const interrupted=state.running||state.paused;state.running=false;state.paused=false;state.mode=mode;resetCourse(interrupted?`${cfg().name} loaded. Previous course aborted.`:`${cfg().name} profile loaded.`);}
function startCourse(){if(state.finished)resetCourse();if(state.running&&!state.paused)return;startAmbient();state.running=true;state.paused=false;state.lastTime=performance.now();pauseButton.disabled=false;pauseButton.textContent='PAUSE';startButton.textContent='FLIGHT ACTIVE';hideOverlay();setStatus(state.mode==='endless'?'ENDLESS ACTIVE // keep reading the next gate; forward velocity will not negotiate.':'Course active. Follow the glowing gate and avoid becoming a very small insurance claim.');updateHud('ACTIVE');requestAnimationFrame(loop);}
function togglePause(){if(!state.running||state.finished)return;state.paused=!state.paused;pauseButton.textContent=state.paused?'RESUME':'PAUSE';if(state.paused){updateHud('PAUSED');setStatus('Simulation paused. The drone has discovered union rules.');showOverlay('SIMULATION PAUSED','Flight frozen. Telemetry remains visible.','RESUME');}else{hideOverlay();state.lastTime=performance.now();requestAnimationFrame(loop);}}
function finish(success){state.running=false;state.finished=true;pauseButton.disabled=true;if(state.mode==='endless'){if(!state.best||state.ringIndex>state.best){state.best=state.ringIndex;localStorage.setItem(bestKey(),String(state.best));}updateHud('FLIGHT FAILED');setStatus(`ENDLESS COMPLETE // ${state.ringIndex} rings cleared in ${state.elapsed.toFixed(2)} s.`);showOverlay('ENDLESS RUN OVER',`${state.ringIndex} rings cleared. Velocity eventually won the argument.`,'RETRY ENDLESS');return;}if(success){if(!state.best||state.elapsed<state.best){state.best=state.elapsed;localStorage.setItem(bestKey(),String(state.best));}updateHud('COURSE CLEAR');setStatus(`COURSE CLEAR // ${state.elapsed.toFixed(2)} s. Drone remains mostly reusable.`);showOverlay('COURSE COMPLETE',`${fixedCourse.length} checkpoints processed in ${state.elapsed.toFixed(2)} seconds.`,'RETRY COURSE');}else{updateHud('FLIGHT FAILED');setStatus(`FLIGHT FAILED // ${state.ringIndex}/${fixedCourse.length} checkpoints processed before structural optimism expired.`);showOverlay('CERTIFICATION DENIED',`${state.ringIndex} checkpoints processed. The hangar would like its drone back.`,'RETRY COURSE');}}
function registerStrike(reason){state.strikesLeft--;if(state.strikesLeft<=0){finish(false);return false;}setStatus(`${reason} // ${state.strikesLeft} ${state.strikesLeft===1?'strike':'strikes'} remaining.`);updateHud('IMPACT');return true;}
function advanceRing(){state.ringIndex++;if(state.mode==='endless'){while(ringMeshes.length-state.ringIndex<8)appendEndlessRing();setRingVisuals();return true;}setRingVisuals();if(state.ringIndex>=fixedCourse.length){finish(true);return false;}return true;}
function update(dt){state.elapsed+=dt;const speed=cfg().speed+state.elapsed*cfg().acceleration;state.distance+=speed*dt;world.position.z=state.distance;const responsiveness=1-Math.pow(cfg().handling,dt);drone.position.x+=(state.targetX-drone.position.x)*responsiveness;drone.position.y+=(state.targetY-drone.position.y)*responsiveness;drone.position.x=THREE.MathUtils.clamp(drone.position.x,-6.4,6.4);drone.position.y=THREE.MathUtils.clamp(drone.position.y,-4.25,4.65);const dx=state.targetX-drone.position.x,dy=state.targetY-drone.position.y;drone.rotation.z=THREE.MathUtils.lerp(drone.rotation.z,-dx*.12,.22);drone.rotation.x=THREE.MathUtils.lerp(drone.rotation.x,dy*.07,.22);drone.rotation.y=THREE.MathUtils.lerp(drone.rotation.y,-dx*.025,.12);rotors.forEach((r,i)=>r.rotation.z+=dt*(i%2?30:-30));const active=ringMeshes[state.ringIndex];if(active){active.rotation.z+=dt*.55;const z=active.position.z+world.position.z;if(z>-.55&&!active.userData.checked){active.userData.checked=true;const dynamicScale=state.mode==='endless'?Math.max(.78,1-state.ringIndex*.0035):cfg().ringScale;const radial=Math.hypot(drone.position.x-active.position.x,drone.position.y-active.position.y),aperture=ringInner*dynamicScale;if(radial<=aperture){setStatus(`RING ${String(state.ringIndex+1).padStart(2,'0')} CLEAR // trajectory acceptable.`);advanceRing();}else if(radial<=3*dynamicScale){if(registerStrike('RING FRAME IMPACT'))advanceRing();}else{if(registerStrike('CHECKPOINT MISSED'))advanceRing();}}}camera.position.x+=((drone.position.x*.24)-camera.position.x)*(1-Math.pow(.03,dt));camera.position.y+=((2.8+drone.position.y*.17)-camera.position.y)*(1-Math.pow(.03,dt));camera.position.z=9.7;camera.lookAt(drone.position.x*.14,drone.position.y*.10,-6.5);updateHud('ACTIVE');}
function loop(now){if(!state.running||state.paused||state.finished)return;const dt=Math.min(.033,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt);renderer.render(scene,camera);if(state.running&&!state.paused&&!state.finished)requestAnimationFrame(loop);}
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
trainingMode.addEventListener('click',()=>setMode('training'));timeAttackMode.addEventListener('click',()=>setMode('attack'));endlessMode.addEventListener('click',()=>setMode('endless'));startButton.addEventListener('click',startCourse);pauseButton.addEventListener('click',togglePause);resetButton.addEventListener('click',()=>resetCourse());overlayButton.addEventListener('click',e=>{e.stopPropagation();state.paused?togglePause():startCourse();});audioButton.addEventListener('click',()=>setAmbientEnabled(!state.audioEnabled));
function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}new ResizeObserver(resize).observe(host);window.addEventListener('resize',resize);
resetCourse();resize();renderer.setAnimationLoop(()=>{if(!state.running||state.paused||state.finished)renderer.render(scene,camera);});