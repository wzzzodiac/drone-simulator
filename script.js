import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = id => document.getElementById(id);
const host=$('sceneHost'), ringsReadout=$('ringsReadout'), strikesReadout=$('strikesReadout'), timeReadout=$('timeReadout'), bestReadout=$('bestReadout'), statusReadout=$('statusReadout'), speedReadout=$('speedReadout'), statusBox=$('statusBox');
const trainingMode=$('trainingMode'), timeAttackMode=$('timeAttackMode'), modeDescription=$('modeDescription'), startButton=$('startButton'), pauseButton=$('pauseButton'), resetButton=$('resetButton');
const overlay=$('overlay'), overlayTitle=$('overlayTitle'), overlayText=$('overlayText'), overlayButton=$('overlayButton');

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x020607,1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x020607,0.018);
const camera=new THREE.PerspectiveCamera(64,16/10,0.1,300);
camera.position.set(0,2.6,10.5);
scene.add(new THREE.HemisphereLight(0x7ee8ff,0x06100d,1.5));
const keyLight=new THREE.DirectionalLight(0x69f0c1,2.2); keyLight.position.set(4,8,6); scene.add(keyLight);
const rimLight=new THREE.PointLight(0x5fd1ff,25,30,2); rimLight.position.set(-5,2,4); scene.add(rimLight);

const world=new THREE.Group(); scene.add(world);
const drone=new THREE.Group(); world.add(drone);
const darkMat=new THREE.MeshStandardMaterial({color:0x0b2020,metalness:.75,roughness:.3});
const glowMat=new THREE.MeshStandardMaterial({color:0x5fd1ff,emissive:0x14516a,emissiveIntensity:2.2,metalness:.45,roughness:.25});
drone.add(new THREE.Mesh(new THREE.BoxGeometry(1.1,.3,.9),darkMat));
const rotors=[];
for(const sx of[-1,1]) for(const sz of[-1,1]){
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.85,.08,.08),glowMat); arm.position.set(sx*.55,0,sz*.34); arm.rotation.y=sz*sx*.42; drone.add(arm);
  const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.035,24),new THREE.MeshStandardMaterial({color:0x69f0c1,emissive:0x123f34,emissiveIntensity:1.8,transparent:true,opacity:.82}));
  rotor.rotation.x=Math.PI/2; rotor.position.set(sx*.92,.08,sz*.6); drone.add(rotor); rotors.push(rotor);
}
const nose=new THREE.Mesh(new THREE.ConeGeometry(.22,.5,6),glowMat); nose.rotation.x=Math.PI/2; nose.position.z=-.67; drone.add(nose);

const floor=new THREE.GridHelper(100,50,0x2c6b5b,0x15322c); floor.position.set(0,-5.2,-34); world.add(floor);
for(const x of[-7.5,7.5]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,110),new THREE.MeshBasicMaterial({color:0x173d36})); rail.position.set(x,-4.4,-45); world.add(rail); }
const starGeo=new THREE.BufferGeometry(), starCount=900, starPos=new Float32Array(starCount*3);
for(let i=0;i<starCount;i++){ starPos[i*3]=(Math.random()-.5)*70; starPos[i*3+1]=(Math.random()-.5)*38; starPos[i*3+2]=-Math.random()*180+20; }
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
world.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fc9bd,size:.06,transparent:true,opacity:.75})));

const course=[[0,0,-14],[2.8,1.7,-24],[-3.4,2.6,-34],[3.7,-1.5,-44],[-1.7,-2.4,-54],[4.2,2.2,-64],[-4.5,.5,-74],[1.6,3,-84],[-3,-2.8,-94],[4.5,-.5,-104],[-1,1.2,-114],[0,0,-124]];
const ringMeshes=[], ringInner=2.05;
course.forEach(([x,y,z],i)=>{
  const mat=new THREE.MeshStandardMaterial({color:0x2f6658,emissive:0x09251e,emissiveIntensity:1.2,metalness:.5,roughness:.35});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.55,.23,14,48),mat); ring.position.set(x,y,z); ring.userData={index:i,checked:false}; world.add(ring); ringMeshes.push(ring);
});

const profiles={training:{name:'TRAINING',strikes:3,speed:8.5,acceleration:.06,ringScale:1},attack:{name:'TIME ATTACK',strikes:1,speed:10.5,acceleration:.12,ringScale:.86}};
const state={mode:'training',running:false,paused:false,finished:false,ringIndex:0,strikesLeft:3,elapsed:0,distance:0,lastTime:0,pointerActive:false,targetX:0,targetY:0,best:null};
const cfg=()=>profiles[state.mode];
const bestKey=()=>`droneRingBest_${state.mode}`;
function loadBest(){const v=Number(localStorage.getItem(bestKey()));state.best=Number.isFinite(v)&&v>0?v:null;}
function setStatus(text){statusBox.textContent=text;}
function updateHud(status=state.running?'ACTIVE':'STANDBY'){
  ringsReadout.textContent=`${state.ringIndex} / ${course.length}`;
  strikesReadout.textContent=Array.from({length:cfg().strikes},(_,i)=>i<state.strikesLeft?'○':'×').join(' ');
  timeReadout.textContent=`${state.elapsed.toFixed(2)} s`; bestReadout.textContent=state.best?`${state.best.toFixed(2)} s`:'—'; statusReadout.textContent=status;
  const speed=cfg().speed+state.elapsed*cfg().acceleration; speedReadout.textContent=`VELOCITY: ${(speed/cfg().speed).toFixed(2)}×`;
}
function updateModeUI(){
  trainingMode.classList.toggle('active',state.mode==='training'); timeAttackMode.classList.toggle('active',state.mode==='attack');
  modeDescription.textContent=state.mode==='training'?'TRAINING // generous rings, three strikes, stable speed.':'TIME ATTACK // smaller gates, one strike, faster acceleration, separate best time.';
}
function setRingVisuals(){
  ringMeshes.forEach((ring,i)=>{const active=i===state.ringIndex,passed=i<state.ringIndex;ring.visible=!passed;ring.scale.setScalar(active?cfg().ringScale:1);ring.material.color.set(active?0x69f0c1:0x2f6658);ring.material.emissive.set(active?0x1c7a62:0x09251e);ring.material.emissiveIntensity=active?3.4:1.15;});
}
function showOverlay(title,text,button='RETRY COURSE'){overlayTitle.textContent=title;overlayText.textContent=text;overlayButton.textContent=button;overlay.classList.add('visible');}
function hideOverlay(){overlay.classList.remove('visible');}
function resetCourse(customStatus){
  state.running=false;state.paused=false;state.finished=false;state.ringIndex=0;state.strikesLeft=cfg().strikes;state.elapsed=0;state.distance=0;state.targetX=0;state.targetY=0;
  drone.position.set(0,0,0);drone.rotation.set(0,0,0);world.position.z=0;camera.position.set(0,2.6,10.5);
  ringMeshes.forEach(r=>{r.userData.checked=false;r.rotation.z=0;});
  loadBest();setRingVisuals();updateModeUI();updateHud('STANDBY');pauseButton.disabled=true;pauseButton.textContent='PAUSE';startButton.textContent='START COURSE';
  setStatus(customStatus||(state.mode==='training'?'Training course ready. Three strikes before certification becomes embarrassing.':'Time Attack armed. One mistake and the paperwork begins.'));
  showOverlay('COURSE STANDBY',state.mode==='training'?'Pass through 12 rings. You have three strikes.':'One strike. Smaller rings. Faster course. Good luck.','START COURSE');
}
function setMode(mode){
  if(!profiles[mode]||mode===state.mode)return;
  const interrupted=state.running||state.paused; state.running=false;state.paused=false;state.mode=mode;
  resetCourse(interrupted?`${cfg().name} loaded. Previous course aborted.`:`${cfg().name} profile loaded.`);
}
function startCourse(){if(state.finished)resetCourse();if(state.running&&!state.paused)return;state.running=true;state.paused=false;state.lastTime=performance.now();pauseButton.disabled=false;pauseButton.textContent='PAUSE';startButton.textContent='FLIGHT ACTIVE';hideOverlay();setStatus('Course active. Follow the glowing gate and avoid becoming a very small insurance claim.');updateHud('ACTIVE');requestAnimationFrame(loop);}
function togglePause(){if(!state.running||state.finished)return;state.paused=!state.paused;pauseButton.textContent=state.paused?'RESUME':'PAUSE';if(state.paused){updateHud('PAUSED');setStatus('Simulation paused. The drone has discovered union rules.');showOverlay('SIMULATION PAUSED','The rings will remain judgmental until you resume.','RESUME');}else{hideOverlay();state.lastTime=performance.now();requestAnimationFrame(loop);}}
function finish(success){
  state.running=false;state.finished=true;pauseButton.disabled=true;
  if(success){if(!state.best||state.elapsed<state.best){state.best=state.elapsed;localStorage.setItem(bestKey(),String(state.best));}updateHud('COURSE CLEAR');setStatus(`COURSE CLEAR // ${state.elapsed.toFixed(2)} s. Drone remains mostly reusable.`);showOverlay('COURSE COMPLETE',`${course.length} checkpoints processed in ${state.elapsed.toFixed(2)} seconds.`,'RETRY COURSE');}
  else{updateHud('FLIGHT FAILED');setStatus(`FLIGHT FAILED // ${state.ringIndex}/${course.length} checkpoints processed before structural optimism expired.`);showOverlay('CERTIFICATION DENIED',`${state.ringIndex} checkpoints processed. The hangar would like its drone back.`,'RETRY COURSE');}
}
function registerStrike(reason){state.strikesLeft--;if(state.strikesLeft<=0){finish(false);return false;}setStatus(`${reason} // ${state.strikesLeft} ${state.strikesLeft===1?'strike':'strikes'} remaining.`);updateHud('IMPACT');return true;}
function advanceRing(){state.ringIndex++;setRingVisuals();if(state.ringIndex>=course.length){finish(true);return false;}return true;}
function update(dt){
  state.elapsed+=dt;const speed=cfg().speed+state.elapsed*cfg().acceleration;state.distance+=speed*dt;world.position.z=state.distance;
  const responsiveness=1-Math.pow(.002,dt);drone.position.x+=(state.targetX-drone.position.x)*responsiveness;drone.position.y+=(state.targetY-drone.position.y)*responsiveness;
  drone.position.x=THREE.MathUtils.clamp(drone.position.x,-6.2,6.2);drone.position.y=THREE.MathUtils.clamp(drone.position.y,-4.1,4.5);
  drone.rotation.z=THREE.MathUtils.lerp(drone.rotation.z,-(state.targetX-drone.position.x)*.08,.12);drone.rotation.x=THREE.MathUtils.lerp(drone.rotation.x,(state.targetY-drone.position.y)*.045,.12);
  rotors.forEach((r,i)=>r.rotation.z+=dt*(i%2?25:-25));
  const active=ringMeshes[state.ringIndex];
  if(active){active.rotation.z+=dt*.55;const z=active.position.z+world.position.z;if(z>-.55&&!active.userData.checked){active.userData.checked=true;const radial=Math.hypot(drone.position.x-active.position.x,drone.position.y-active.position.y),aperture=ringInner*cfg().ringScale;
    if(radial<=aperture){setStatus(`RING ${String(state.ringIndex+1).padStart(2,'0')} CLEAR // trajectory acceptable.`);advanceRing();}
    else if(radial<=3*cfg().ringScale){if(registerStrike('RING FRAME IMPACT'))advanceRing();}
    else{if(registerStrike('CHECKPOINT MISSED'))advanceRing();}
  }}
  camera.position.x+=((drone.position.x*.22)-camera.position.x)*(1-Math.pow(.02,dt));camera.position.y+=((2.6+drone.position.y*.18)-camera.position.y)*(1-Math.pow(.02,dt));camera.lookAt(drone.position.x*.12,drone.position.y*.13,-7);updateHud('ACTIVE');
}
function loop(now){if(!state.running||state.paused||state.finished)return;const dt=Math.min(.033,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt);renderer.render(scene,camera);if(state.running&&!state.paused&&!state.finished)requestAnimationFrame(loop);}
function pointerToTarget(e){const rect=host.getBoundingClientRect();const nx=((e.clientX-rect.left)/rect.width)*2-1,ny=-(((e.clientY-rect.top)/rect.height)*2-1);state.targetX=nx*5.8;state.targetY=ny*3.8;}
host.addEventListener('pointerdown',e=>{e.preventDefault();state.pointerActive=true;host.setPointerCapture?.(e.pointerId);pointerToTarget(e);});
host.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'&&!state.pointerActive)return;pointerToTarget(e);});
host.addEventListener('pointerup',e=>{state.pointerActive=false;host.releasePointerCapture?.(e.pointerId);});host.addEventListener('pointercancel',()=>state.pointerActive=false);
trainingMode.addEventListener('click',()=>setMode('training'));timeAttackMode.addEventListener('click',()=>setMode('attack'));startButton.addEventListener('click',startCourse);pauseButton.addEventListener('click',togglePause);resetButton.addEventListener('click',()=>resetCourse());overlayButton.addEventListener('click',()=>state.paused?togglePause():startCourse());
function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
new ResizeObserver(resize).observe(host);window.addEventListener('resize',resize);
resetCourse();resize();renderer.setAnimationLoop(()=>{if(!state.running||state.paused||state.finished)renderer.render(scene,camera);});