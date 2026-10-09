import * as THREE from './vendor/three.module.js';

// Presentation only. The caller owns simulation time, collision tests and rendering.
const alloy = new THREE.MeshStandardMaterial({color:0xc8ccbd,metalness:.5,roughness:.48});
const carbon = new THREE.MeshStandardMaterial({color:0x18252c,metalness:.5,roughness:.6});
const orange = new THREE.MeshStandardMaterial({color:0xffae52,metalness:.25,roughness:.45});
const lens = new THREE.MeshStandardMaterial({color:0x9fdbe4,emissive:0x5aa1b5,emissiveIntensity:.7,metalness:.3,roughness:.2});
function mesh(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
function box(parent,w,h,d,material,x=0,y=0,z=0){return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);}

export function createDrone(){
 const drone=new THREE.Group();drone.name='DroneRoot';const rotors=[];
 box(drone,.8,.22,1.12,carbon,0,0,0);
 const hull=box(drone,.72,.22,.84,alloy,0,.13,0);hull.rotation.x=-.08;
 box(drone,.24,.025,.75,orange,0,.265,0);
 for(const x of [-.29,.29])for(let i=0;i<5;i++)box(drone,.08,.014,.035,carbon,x,.256,i*.085-.12);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const arm=box(drone,.86,.09,.15,carbon,sx*.57,0,sz*.35);arm.rotation.y=-sx*sz*.45;
  mesh(drone,new THREE.CylinderGeometry(.15,.14,.18,16),alloy,sx*.91,.04,sz*.6);
  const hub=new THREE.Group();hub.name=`Rotor_${sx}_${sz}`;hub.position.set(sx*.91,.16,sz*.6);drone.add(hub);rotors.push(hub);
  box(hub,.93,.014,.065,carbon);box(hub,.065,.014,.93,carbon);
  mesh(hub,new THREE.CylinderGeometry(.064,.064,.035,12),orange,0,.025,0);
  const guard=mesh(drone,new THREE.TorusGeometry(.48,.018,6,32),carbon,sx*.91,.11,sz*.6);guard.rotation.x=Math.PI/2;
  box(drone,.07,.22,.065,carbon,sx*.38,-.2,sz*.34);
  box(drone,.12,.045,.28,alloy,sx*.38,-.32,sz*.34);
 }
 const camera=mesh(drone,new THREE.CylinderGeometry(.13,.13,.17,16),carbon,0,-.04,-.61);camera.rotation.x=Math.PI/2;
 const glass=mesh(drone,new THREE.CircleGeometry(.09,16),lens,0,-.04,-.70);glass.rotation.y=Math.PI;
 for(const x of [-.27,.27])box(drone,.095,.045,.03,lens,x,.05,.575);
 return {drone,rotors};
}

function floorTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 g.fillStyle='#343f43';g.fillRect(0,0,512,512);
 // Deterministic surface grain, independent of the course RNG.
 for(let i=0;i<7000;i++){const x=(i*127)%512,y=(i*193+Math.floor(i/512)*17)%512;g.fillStyle=i%2?'#3b464a':'#303b40';g.fillRect(x,y,2,1);}
 g.strokeStyle='#202d32';g.lineWidth=2;g.strokeRect(1,1,510,510);
 g.fillStyle='#949685';g.fillRect(35,0,3,512);g.fillRect(474,0,3,512);
 g.fillStyle='#ba9762';for(let i=0;i<4;i++)g.fillRect(251,i*128+30,10,45);
 g.font='bold 15px monospace';g.fillStyle='#75827e';g.fillText('FLIGHT / 01',55,470);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,24);return t;
}

export function createHangar(scene){
 scene.background=new THREE.Color(0x142631);scene.fog=new THREE.FogExp2(0x142631,.012);
 scene.add(new THREE.HemisphereLight(0xe2f1f0,0x303039,2.4));
 const key=new THREE.DirectionalLight(0xffe2b4,3.4);key.position.set(-5,12,7);scene.add(key);
 const fill=new THREE.DirectionalLight(0xa7dce7,1.7);fill.position.set(8,4,-12);scene.add(fill);
 const steel=new THREE.MeshStandardMaterial({color:0x344952,metalness:.5,roughness:.64});
 const wc=document.createElement('canvas');wc.width=wc.height=512;const wg=wc.getContext('2d');
 const wash=wg.createLinearGradient(0,0,0,512);wash.addColorStop(0,'#222f39');wash.addColorStop(.35,'#657476');wash.addColorStop(.7,'#56666b');wash.addColorStop(1,'#26353e');wg.fillStyle=wash;wg.fillRect(0,0,512,512);
 wg.strokeStyle='#33434a';wg.lineWidth=3;for(let x=0;x<512;x+=128){wg.strokeRect(x+5,65,118,340);for(const y of [75,395]){wg.fillStyle='#8a9691';wg.fillRect(x+11,y,3,3);wg.fillRect(x+115,y,3,3);}}
 wg.fillStyle='#b5bbaa';wg.font='bold 72px sans-serif';wg.fillText('07',40,230);wg.font='12px monospace';wg.fillText('FLIGHT RANGE',43,257);wg.fillStyle='#ac8a57';wg.fillRect(0,340,512,6);
 const wallTexture=new THREE.CanvasTexture(wc);wallTexture.colorSpace=THREE.SRGBColorSpace;wallTexture.wrapS=THREE.RepeatWrapping;wallTexture.repeat.set(24,1);
 const wallMat=new THREE.MeshStandardMaterial({map:wallTexture,metalness:.15,roughness:.84,side:THREE.DoubleSide});
 const lightMat=new THREE.MeshBasicMaterial({color:0xc1ddd7});
 const amber=new THREE.MeshBasicMaterial({color:0xbf8850});
 const texture=floorTexture();const group=new THREE.Group();scene.add(group);
 const floor=mesh(group,new THREE.PlaneGeometry(24,576),new THREE.MeshStandardMaterial({map:texture,roughness:.87,metalness:.15}),0,-5.8,-240);floor.rotation.x=-Math.PI/2;
 const rightTexture=wallTexture.clone();const rightWall=wallMat.clone();rightWall.map=rightTexture;
 for(const x of [-12.3,12.3]){const wall=mesh(group,new THREE.PlaneGeometry(576,16),x<0?wallMat:rightWall,x,2,-240);wall.rotation.y=x<0?Math.PI/2:-Math.PI/2;}
 box(group,25,.3,576,steel,0,10,-240);
 const segments=[];
 for(let i=0;i<15;i++){
  const rib=new THREE.Group();group.add(rib);segments.push(rib);
  for(const x of [-11.7,11.7]){
   box(rib,.38,15.5,.45,steel,x,2,0);
   box(rib,.08,.06,11,lightMat,x,-4.8,-6);
   box(rib,.06,.1,11,amber,x,5,-6);
   const brace=box(rib,.28,5,.28,steel,x*.89,7.7,0);brace.rotation.z=x<0?-.55:.55;
   box(rib,.05,2,6,carbon,x*.997,.7,-6);
  }
  box(rib,24,.28,.45,steel,0,9.3,0);
  for(const x of [-6,6])box(rib,1.8,.08,5,lightMat,x,9.1,-5);
 }
 // Far opening and sparse aperture slats establish scale without obscuring gates.
 box(group,19,12,.1,new THREE.MeshBasicMaterial({color:0x54737c}),0,1,-285);
 const sc=document.createElement('canvas');sc.width=sc.height=128;const sg=sc.getContext('2d');const shade=sg.createRadialGradient(64,64,4,64,64,64);shade.addColorStop(0,'rgba(2,8,13,.4)');shade.addColorStop(1,'rgba(2,8,13,0)');sg.fillStyle=shade;sg.fillRect(0,0,128,128);
 const shadow=mesh(group,new THREE.PlaneGeometry(4,4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}),0,-5.77,0);shadow.rotation.x=-Math.PI/2;
 return {update(distance,x=0){texture.offset.y=distance/24;wallTexture.offset.x=distance/24;rightTexture.offset.x=-distance/24;shadow.position.x=x;segments.forEach((r,i)=>r.position.z=16-i*24+distance%24);},texture};
}

const ringGeometry=new THREE.TorusGeometry(2.55,.23,10,64);
const trimGeometry=new THREE.TorusGeometry(2.55,.043,6,64);
const panelGeometry=new THREE.BoxGeometry(.46,.2,.42);
const trimIdle=new THREE.MeshBasicMaterial({color:0x719696});
const trimActive=new THREE.MeshBasicMaterial({color:0xffc675});
export function createGate(x,y,z,index){
 const material=new THREE.MeshStandardMaterial({color:0x516a70,metalness:.65,roughness:.42});
 const gate=new THREE.Mesh(ringGeometry,material);gate.position.set(x,y,z);gate.userData={index,checked:false};
 const trim=mesh(gate,trimGeometry,trimIdle,0,0,.22);gate.userData.trim=trim;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;const p=mesh(gate,panelGeometry,alloy,Math.cos(a)*2.55,Math.sin(a)*2.55,0);p.rotation.z=a+Math.PI/2;}
 // Four inward pointers keep the active aperture identifiable without bloom.
 const pointers=new THREE.Group();gate.add(pointers);gate.userData.pointers=pointers;
 const tri=new THREE.Shape();tri.moveTo(-.11,0);tri.lineTo(.11,0);tri.lineTo(0,-.22);tri.closePath();
 const pointerGeo=new THREE.ShapeGeometry(tri);
 gate.userData.pointerGeo=pointerGeo;
 for(let i=0;i<4;i++){const a=i*Math.PI/2;const p=mesh(pointers,pointerGeo,trimActive,-Math.sin(a)*2.25,Math.cos(a)*2.25,.26);p.rotation.z=a;}
 return gate;
}
export function styleGate(gate,active){
 gate.material.color.set(active?0xc6a16e:0x516a70);
 gate.userData.trim.material=active?trimActive:trimIdle;
 gate.userData.pointers.visible=active;
}
export function releaseGate(gate){gate.material.dispose();gate.userData.pointerGeo.dispose();}
