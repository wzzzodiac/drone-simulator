import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = id => document.getElementById(id);
const host = $('sceneHost');
const ringsReadout = $('ringsReadout');
const strikesReadout = $('strikesReadout');
const timeReadout = $('timeReadout');
const bestReadout = $('bestReadout');
const statusReadout = $('statusReadout');
const speedReadout = $('speedReadout');
const statusBox = $('statusBox');
const trainingMode = $('trainingMode');
const timeAttackMode = $('timeAttackMode');
const modeDescription = $('modeDescription');
const startButton = $('startButton');
const pauseButton = $('pauseButton');
const resetButton = $('resetButton');
const overlay = $('overlay');
const overlayTitle = $('overlayTitle');
const overlayText = $('overlayText');
const overlayButton = $('overlayButton');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x020607, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020607, 0.018);
const camera = new THREE.PerspectiveCamera(64, 16 / 10, 0.1, 300);
camera.position.set(0, 2.6, 10.5);

scene.add(new THREE.HemisphereLight(0x7ee8ff, 0x06100d, 1.5));
const keyLight = new THREE.DirectionalLight(0x69f0c1, 2.2);
keyLight.position.set(4, 8, 6);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x5fd1ff, 25, 30, 2);
rimLight.position.set(-5, 2, 4);
scene.add(rimLight);

const world = new THREE.Group();
scene.add(world);

const drone = new THREE.Group();
world.add(drone);
const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b2020, metalness: 0.75, roughness: 0.3 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0x5fd1ff, emissive: 0x14516a, emissiveIntensity: 2.2, metalness: 0.45, roughness: 0.25 });
const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.9), darkMat);
drone.add(body);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.08), glowMat);
  arm.position.set(sx * 0.55, 0, sz * 0.34);
  arm.rotation.y = sz * sx * 0.42;
  drone.add(arm);
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 24), new THREE.MeshStandardMaterial({ color: 0x69f0c1, emissive: 0x123f34, emissiveIntensity: 1.8, transparent: true, opacity: 0.82 }));
  rotor.rotation.x = Math.PI / 2;
  rotor.position.set(sx * 0.92, 0.08, sz * 0.6);
  drone.add(rotor);
}
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), glowMat);
nose.rotation.x = Math.PI / 2;
nose.position.z = -0.67;
drone.add(nose);
drone.position.set(0, 0, 0);

const floor = new THREE.GridHelper(100, 50, 0x2c6b5b, 0x15322c);
floor.position.y = -5.2;
floor.position.z = -34;
world.add(floor);

const rails = new THREE.Group();
for (const x of [-7.5, 7.5]) {
  const geo = new THREE.BoxGeometry(0.06, 0.06, 110);
  const mat = new THREE.MeshBasicMaterial({ color: 0x173d36 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, -4.4, -45);
  rails.add(mesh);
}
world.add(rails);

const starGeo = new THREE.BufferGeometry();
const starCount = 900;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 70;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 38;
  starPos[i * 3 + 2] = -Math.random() * 180 + 20;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
world.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fc9bd, size: 0.06, transparent: true, opacity: 0.75 })));

const course = [
  [0,0,-14],[2.8,1.7,-24],[-3.4,2.6,-34],[3.7,-1.5,-44],[-1.7,-2.4,-54],[4.2,2.2,-64],[-4.5,.5,-74],[1.6,3,-84],[-3,-2.8,-94],[4.5,-.5,-104],[-1,1.2,-114],[0,0,-124]
];
const ringMeshes = [];
const ringInner = 2.05;
for (let i = 0; i < course.length; i++) {
  const [x,y,z] = course[i];
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f6658, emissive: 0x09251e, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.23, 14, 48), mat);
  ring.position.set(x,y,z);
  ring.rotation.y = 0;
  ring.userData = { index: i, checked: false };
  world.add(ring);
  ringMeshes.push(ring);
}

const profiles = {
  training: { name: 'TRAINING', strikes: 3, speed: 8.5, acceleration: 0.06, ringScale: 1 },
  attack: { name: 'TIME ATTACK', strikes: 1, speed: 10.5, acceleration: 0.12, ringScale: 0.86 }
};
const state = {
  mode: 'training', running: false, paused: false, finished: false,
  ringIndex: 0, strikesLeft: 3, elapsed: 0, distance: 0, lastTime: 0,
  pointerActive: false, targetX: 0, targetY: 0, velocityX: 0, velocityY: 0,
  best: null
};

function cfg(){ return profiles[state.mode]; }
function bestKey(){ return `droneRingBest_${state.mode}`; }
function loadBest(){ const v = Number(localStorage.getItem(bestKey())); state.best = Number.isFinite(v) && v > 0 ? v : null; }
function setStatus(text){ statusBox.textContent = text; }
function updateHud(status = state.running ? 'ACTIVE' : 'STANDBY'){
  ringsReadout.textContent = `${state.ringIndex} / ${course.length}`;
  strikesReadout.textContent = Array.from({length: cfg().strikes}, (_,i) => i < state.strikesLeft ? '○' : '×').join(' ');
  timeReadout.textContent = `${state.elapsed.toFixed(2)} s`;
  bestReadout.textContent = state.best ? `${state.best.toFixed(2)} s` : '—';
  statusReadout.textContent = status;
  const speed = cfg().speed + state.elapsed * cfg().acceleration;
  speedReadout.textContent = `VELOCITY: ${(speed / cfg().speed).toFixed(2)}×`;
}
function updateModeUI(){
  trainingMode.classList.toggle('active', state.mode === 'training');
  timeAttackMode.classList.toggle('active', state.mode === 'attack');
  modeDescription.textContent = state.mode === 'training'
    ? 'TRAINING // generous rings, three strikes, stable speed.'
    : 'TIME ATTACK // smaller gates, one strike, faster acceleration, separate best time.';
}
function setRingVisuals(){
  ringMeshes.forEach((ring,i)=>{
    const active = i === state.ringIndex;
    const passed = i < state.ringIndex;
    ring.visible = !passed;
    ring.scale.setScalar(active ? cfg().ringScale : 1);
    ring.material.color.set(active ? 0x69f0c1 : 0x2f6658);
    ring.material.emissive.set(active ? 0x1c7a62 : 0x09251e);
    ring.material.emissiveIntensity = active ? 3.4 : 1.15;
  });
}
function resetCourse(customStatus){
  state.running = false; state.paused = false; state.finished = false; state.ringIndex = 0;
  state.strikesLeft = cfg().strikes; state.elapsed = 0; state.distance = 0; state.targetX = 0; state.targetY = 0;
  state.velocityX = 0; state.velocityY = 0; drone.position.set(0,0,0); drone.rotation.set(0,0,0);
  world.position.z = 0;
  loadBest(); setRingVisuals(); updateModeUI(); updateHud('STANDBY');
  pauseButton.disabled = true; pauseButton.textContent = 'PAUSE'; startButton.textContent = 'START COURSE';
  setStatus(customStatus || (state.mode === 'training' ? 'Training course ready. Three strikes before certification becomes embarrassing.' : 'Time Attack armed. One mistake and the paperwork begins.'));
  showOverlay('COURSE STANDBY', state.mode === 'training' ? 'Pass through 12 rings. You have three strikes.' : 'One strike. Smaller rings. Faster course. Good luck.', 'START COURSE');
}
function setMode(mode){ if(state.running) return; state.mode = mode; resetCourse(`${cfg().name} profile loaded.`); }
function showOverlay(title,text,button='RETRY COURSE'){ overlayTitle.textContent=title; overlayText.textContent=text; overlayButton.textContent=button; overlay.classList.add('visible'); }
function hideOverlay(){ overlay.classList.remove('visible'); }
function startCourse(){
  if(state.finished) resetCourse();
  if(state.running && !state.paused) return;
  state.running = true; state.paused = false; state.lastTime = performance.now(); pauseButton.disabled=false; pauseButton.textContent='PAUSE'; startButton.textContent='FLIGHT ACTIVE'; hideOverlay(); setStatus('Course active. Follow the glowing gate and avoid becoming a very small insurance claim.'); updateHud('ACTIVE'); requestAnimationFrame(loop);
}
function togglePause(){
  if(!state.running || state.finished) return;
  state.paused = !state.paused; pauseButton.textContent = state.paused ? 'RESUME' : 'PAUSE';
  if(state.paused){ updateHud('PAUSED'); setStatus('Simulation paused. The drone has discovered union rules.'); showOverlay('SIMULATION PAUSED','The rings will remain judgmental until you resume.','RESUME'); }
  else { hideOverlay(); state.lastTime = performance.now(); requestAnimationFrame(loop); }
}
function finish(success){
  state.running=false; state.finished=true; pauseButton.disabled=true;
  if(success){
    if(!state.best || state.elapsed < state.best){ state.best = state.elapsed; localStorage.setItem(bestKey(), String(state.best)); }
    updateHud('COURSE CLEAR'); setStatus(`COURSE CLEAR // ${state.elapsed.toFixed(2)} s. Drone remains mostly reusable.`); showOverlay('COURSE COMPLETE',`${course.length} / ${course.length} rings cleared in ${state.elapsed.toFixed(2)} seconds.`,'RETRY COURSE');
  } else {
    updateHud('FLIGHT FAILED'); setStatus(`FLIGHT FAILED // ${state.ringIndex}/${course.length} rings cleared before structural optimism expired.`); showOverlay('CERTIFICATION DENIED',`${state.ringIndex} rings cleared. The hangar would like its drone back.`,'RETRY COURSE');
  }
}
function registerStrike(reason){
  state.strikesLeft--;
  if(state.strikesLeft <= 0){ finish(false); return; }
  setStatus(`${reason} // ${state.strikesLeft} ${state.strikesLeft===1?'strike':'strikes'} remaining.`);
  updateHud('IMPACT');
}

function update(dt){
  state.elapsed += dt;
  const speed = cfg().speed + state.elapsed * cfg().acceleration;
  state.distance += speed * dt;
  world.position.z = state.distance;

  const responsiveness = 1 - Math.pow(0.002, dt);
  drone.position.x += (state.targetX - drone.position.x) * responsiveness;
  drone.position.y += (state.targetY - drone.position.y) * responsiveness;
  drone.position.x = THREE.MathUtils.clamp(drone.position.x, -6.2, 6.2);
  drone.position.y = THREE.MathUtils.clamp(drone.position.y, -4.1, 4.5);
  drone.rotation.z = THREE.MathUtils.lerp(drone.rotation.z, -(state.targetX - drone.position.x) * 0.08, 0.12);
  drone.rotation.x = THREE.MathUtils.lerp(drone.rotation.x, (state.targetY - drone.position.y) * 0.045, 0.12);

  const active = ringMeshes[state.ringIndex];
  if(active){
    active.rotation.z += dt * 0.55;
    const z = active.position.z + world.position.z;
    if(z > -0.55 && !active.userData.checked){
      active.userData.checked = true;
      const dx = drone.position.x - active.position.x;
      const dy = drone.position.y - active.position.y;
      const radial = Math.hypot(dx,dy);
      const aperture = ringInner * cfg().ringScale;
      if(radial <= aperture){
        state.ringIndex++;
        setRingVisuals();
        setStatus(`RING ${String(state.ringIndex).padStart(2,'0')} CLEAR // trajectory acceptable.`);
        if(state.ringIndex >= course.length){ finish(true); return; }
      } else if(radial <= 3.0 * cfg().ringScale){
        registerStrike('RING FRAME IMPACT');
        if(!state.running) return;
        state.ringIndex++;
        setRingVisuals();
        if(state.ringIndex >= course.length){ finish(true); return; }
      } else {
        registerStrike('CHECKPOINT MISSED');
        if(!state.running) return;
        state.ringIndex++;
        setRingVisuals();
        if(state.ringIndex >= course.length){ finish(true); return; }
      }
    }
  }

  camera.position.x += ((drone.position.x * 0.22) - camera.position.x) * (1 - Math.pow(0.02, dt));
  camera.position.y += ((2.6 + drone.position.y * 0.18) - camera.position.y) * (1 - Math.pow(0.02, dt));
  camera.lookAt(drone.position.x * 0.12, drone.position.y * 0.13, -7);
  updateHud('ACTIVE');
}
function loop(now){
  if(!state.running || state.paused || state.finished) return;
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0); state.lastTime = now; update(dt); renderer.render(scene,camera);
  if(state.running && !state.paused && !state.finished) requestAnimationFrame(loop);
}
function pointerToTarget(event){
  const rect = host.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  state.targetX = nx * 5.8;
  state.targetY = ny * 3.8;
}
host.addEventListener('pointerdown',e=>{e.preventDefault();state.pointerActive=true;host.setPointerCapture?.(e.pointerId);pointerToTarget(e)});
host.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'&&!state.pointerActive)return;pointerToTarget(e)});
host.addEventListener('pointerup',e=>{state.pointerActive=false;host.releasePointerCapture?.(e.pointerId)});
host.addEventListener('pointercancel',()=>state.pointerActive=false);
trainingMode.addEventListener('click',()=>setMode('training'));
timeAttackMode.addEventListener('click',()=>setMode('attack'));
startButton.addEventListener('click',startCourse);
pauseButton.addEventListener('click',togglePause);
resetButton.addEventListener('click',()=>resetCourse());
overlayButton.addEventListener('click',()=> state.paused ? togglePause() : startCourse());

function resize(){ const w=host.clientWidth,h=host.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.render(scene,camera); }
new ResizeObserver(resize).observe(host);
window.addEventListener('resize',resize);

resetCourse();
resize();
renderer.setAnimationLoop(()=>{ if(!state.running || state.paused || state.finished) renderer.render(scene,camera); });
