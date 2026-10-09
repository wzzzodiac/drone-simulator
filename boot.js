import('./script.js?v=hangar-1').catch(error=>{
 document.getElementById('overlayTitle').textContent='GRAPHICS UNAVAILABLE';
 document.getElementById('overlayText').textContent='This flight needs WebGL 2. Enable browser graphics acceleration or try a compatible browser, then reload.';
 document.getElementById('overlayButton').textContent='RELOAD REQUIRED';
 document.getElementById('statusReadout').textContent='UNAVAILABLE';
 document.getElementById('statusBox').textContent='The 3D flight could not start.';
 for(const button of document.querySelectorAll('button'))button.disabled=true;
 document.getElementById('qualitySelect').disabled=true;
 console.error('Drone initialization failed:',error);
});
