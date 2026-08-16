# Drone Simulator

A small 3D browser game built with Three.js. Pilot a drone through a sequence of rings using mouse or touch controls.

## Features

- 3D perspective ring course
- Mouse control on desktop
- Press-and-drag control on mobile
- 12 checkpoints with different X/Y offsets
- Training mode with 3 strikes
- Time Attack mode with 1 strike, smaller rings and faster acceleration
- Ring impact / missed-checkpoint detection
- Course timer and separate best times per mode
- Responsive engineering-console UI matching the other projects in the hub

## Controls

Move the pointer inside the 3D flight window. The drone follows it while the course advances toward the camera.

Pass through the glowing active ring. Hitting the ring frame or missing the checkpoint costs a strike.

## Tech

- HTML
- CSS
- JavaScript modules
- Three.js loaded from jsDelivr
- No backend

## GitHub Pages

Enable GitHub Pages from the `main` branch root. The expected URL is:

`https://wzzzodiac.github.io/drone-simulator/`
