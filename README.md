# Drone Simulator

A small 3D browser game built with Three.js. Pilot a visible third-person drone through ring courses using mouse or touch controls.

## Features

- Third-person 3D drone view with chase camera
- Mouse control on desktop
- Press-and-drag control on mobile
- Responsive steering with visible banking / tilt
- **Training** mode: 12 checkpoints and 3 strikes
- **Time Attack** mode: 12 smaller checkpoints, 1 strike and faster acceleration
- **Endless** mode: procedural rings, 1 strike and continuously rising forward speed
- Ring impact / missed-checkpoint detection
- Separate best times for fixed courses and best ring count for Endless
- Soft procedural ambient audio using the Web Audio API
- Pause, reset and in-window start / resume / retry controls
- Responsive engineering-console UI matching the other projects in the hub

## Controls

Move the pointer inside the 3D flight window. The drone follows it while the course advances toward the camera.

Pass through the glowing active ring. Hitting the ring frame or missing the checkpoint costs a strike.

Use **AMBIENT: ON/OFF** to toggle the background audio. Browsers require a user interaction before audio can begin, so the ambient layer starts after the first flight interaction.

## Modes

### Training

A fixed 12-ring course with three strikes. Intended for learning the steering and perspective.

### Time Attack

The same fixed course with one strike, smaller gates and higher speed. Best time is stored locally in the browser.

### Endless

Procedural gates continue spawning ahead of the drone. Forward speed rises over time and the run ends on the first missed gate or frame impact. Best score is stored as rings cleared.

## Tech

- HTML
- CSS
- JavaScript modules
- Three.js loaded from jsDelivr
- Web Audio API
- `localStorage` for local records
- No backend

## GitHub Pages

Published at:

`https://wzzzodiac.github.io/drone-simulator/`
