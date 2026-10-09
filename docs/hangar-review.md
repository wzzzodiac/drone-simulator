# Drone Simulator / Hangar 07 review

2026-10-09. Branch `codex/drone-flight-hangar`, based on published commit `d605d822ea17c5cfcd8e3eccf64c199f8f38175f`. This proposal does not change main, the Hub, Black Hole or Space Ship.

## Run and compare

Serve the checkout with `python -m http.server 8002 --bind 127.0.0.1`. Open `http://127.0.0.1:8002/` to fly or `/docs/hangar/` for the [comparison gallery](hangar/index.html). No build, installation or external service is needed.

The gallery includes before/after desktop (1440×1000) and mobile (390×844) screenshots of all three modes plus standby, and a 9-second 960×600 video. Scene captures use the original chase-camera parameters and three simulated seconds with automatic steering to the next gate. Full-page captures show the intentionally different layouts. Endless screenshots are not an identical randomized course: Three.js object UUID creation consumes the global RNG, and the new graphics create a different number of objects.

The video is 216 real WebGL canvas frames at fixed 1/48-second simulation steps, encoded at 24 FPS. It is a motion demonstration, not a recording of real-time performance or human play.

## Visual direction

The former empty grid becomes an indoor industrial flight range: repeated structural ribs, ceiling lights, wall panels, floor markings and atmospheric depth. The drone uses a pale metal shell, carbon arms, motor housings, correctly oriented horizontal rotors, camera and landing feet. Gates retain the original torus dimensions, with a segmented metal housing, restrained illuminated trim and four inward pointers identifying the next checkpoint. Amber is reserved for the active gate and primary controls. Scene geometry and texture painting are procedural, implemented directly with the existing Three.js 0.180.0 dependency.

The presentation module `hangar-visuals.js` owns assets and their visual updates. The game owns its course, collision rules, time and render schedule. The environment is scenery: it adds no collision obstacles. Floor shadows, ambient wall shading and illumination are artistic approximations, not physical simulation. No Blender, image generation, downloaded art, paid services or additional dependencies were used.

The flight window, telemetry and main controls now precede configuration on mobile. Desktop uses a compact top bar and a side console; tested desktop and portrait viewports expose Start/Pause/Reset without scrolling. Short landscape viewports can require vertical scrolling. Existing mode behavior, audio, best records and pointer mappings are preserved. Auto/High/Low quality cap pixel ratio at 1.5/2/1 respectively.

## Runtime changes and validation

`tests/hangar-smoke.cjs` uses an existing Playwright installation via `PLAYWRIGHT_MODULE`, a browser executable via `BROWSER_PATH`, and served URLs via `BASE_URL` and optional `BASELINE_URL`. Test-only module instrumentation is injected through the browser route; no debug API ships in the application.

- Start, overlay resume/retry, reset, mode changes, mode announcements, mouse input and injected touch drag/release.
- Three modes at desktop and mobile viewport sizes, resize checks at 360×800, 768×1024, 844×390 and 1920×1080; no horizontal overflow or camera-aspect drift.
- Ring-frame collision, missed checkpoint, completion, failure status and persisted best time. Terminal status no longer gets overwritten by the final update's ACTIVE label.
- One render scheduler replaces the former perpetual idle render loop. No continuous render submissions in standby or pause. Injected document visibility changes pause the flight; it requires explicit resume after becoming visible.
- GPU geometry and texture counts remain stable through 30 resets. Passed Endless gates are removed from the rendered world and their individual material/geometry resources disposed; eight unpassed gates remain after 100 advances. The indexed CPU-side course history is still retained for the existing progression model, so this is not a claim of constant total memory during arbitrarily long runs.
- Keyboard focus enters the pause/result overlay; hidden overlays are inert. Missing WebGL shows a readable unavailable state; context loss offers reload and disables flight controls.
- Resize observer, active animation request, renderer, scene resources and audio context are released on final page exit; browser back/forward cache retains the session and resumes paused. No browser back/forward-cache coverage is claimed.

All 75 checks passed. See [verification.json](hangar/verification.json) for the check list, browser version, measurements and resource counts. An additional uninstrumented browser smoke check started, paused and reset all three modes; the gallery's images and 9-second video playback also loaded without console or resource errors. Audio toggle/state was exercised through the browser, not evaluated by listening.

### Simulation comparison

The baseline and new implementation are compared using the same course RNG seed and automatic steering at 0.01-second steps. Test instrumentation isolates mesh-construction UUID randomness in both implementations, so the course inputs match. Rendering is excluded from this state comparison. This preserves the random course distribution without claiming identical real-life random sequences across versions.

Exact equality is checked for profile, ring index, strikes, elapsed time, distance, completion state, drone position and rotation, chase-camera position, and every gate's position/check state:

- Training: all 12 gates, 1,379 steps / 13.79 simulated seconds.
- Time Attack: all 12 gates, 1,088 steps / 10.88 simulated seconds.
- Endless: 3,000 steps / 30 simulated seconds, 20 gates.

### Performance and limits

Short 2.4-second browser frame-interval samples during automated steering run near the 120 Hz ceiling on the available Windows desktop / NVIDIA RTX 4070 SUPER, in Edge 154.0.4258.62. Exact per-mode FPS, P95 intervals, draw calls and triangle counts are in the JSON report. These are frame-cadence samples, not GPU timer queries or sustained thermal measurements.

Mobile evidence is viewport emulation at 390×844, device pixel ratio 3, on the desktop GPU. Auto rendering caps the effective pixel ratio at 1.5. Physical phones, low-end GPUs, Safari, Firefox, screen readers, thermal/battery behavior and perceived audio quality were not tested. The scene uses about 310–345 draw calls in these samples; quality controls reduce fill cost, not scene complexity.
