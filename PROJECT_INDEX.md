# Music Visualizer - Project Index

## Project Overview

A real-time audio-reactive music visualizer built with Three.js WebGPU and Electron. Features three unique GPU-accelerated visualization scenes with Spout output support for streaming to OBS, Resolume, TouchDesigner, and other VJ software on Windows.

**Technology Stack:**
- Three.js v0.179.0 with WebGPU renderer
- Electron v28.0.0 (desktop wrapper)
- TSL (Three.js Shading Language) for GPU compute shaders
- Spout SDK via electron-spout native module
- Web Audio API for real-time frequency analysis

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Entry Points                              │
├───────────────────────┬───────────────────────┬─────────────────────┤
│   Browser (main.js)   │   Electron Main     │   Spout Window      │
│                       │   (electron/main.js)│   (spout-renderer.js)│
├───────────────────────┴───────────────────────┴─────────────────────┤
│                        Shared Core                                │
│            ┌──────────────┬──────────────┐                       │
│            │  Bootstrap   │   Renderer   │                       │
│            │  (bootstrap) │   (renderer) │                       │
│            └──────────────┴──────────────┘                       │
├─────────────────────────────────────────────────────────────────┤
│                      Scene Registry                               │
│         particles.js    points.js    skinning.js                  │
├─────────────────────────────────────────────────────────────────┤
│                      Audio System                                 │
│            capture.js ←→ uniforms.js                             │
├─────────────────────────────────────────────────────────────────┤
│                      Settings & GUI                               │
│         defaults.js ←→ gui/index.js                              │
├─────────────────────────────────────────────────────────────────┤
│                      Spout Sync                                   │
│                    spout/sync.js                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
music_vis/
├── index.html                    # Main app HTML with UI overlay
├── main.js                       # Browser entry point (~203 lines)
├── spout-output.html             # Hidden Spout window HTML (no UI)
├── spout-renderer.js             # Spout window entry point (~58 lines)
├── preload.js                    # Electron IPC bridge (~41 lines)
├── package.json                  # Dependencies & scripts
├── README.md                     # User documentation
├── SPOUT_IMPLEMENTATION.md       # Implementation checklist
│
├── electron/
│   └── main.js                   # Electron main process (~277 lines)
│                                   # - Creates main window
│                                   # - Creates hidden Spout window
│                                   # - Handles Spout sender
│                                   # - Manages IPC
│
├── src/
│   ├── core/
│   │   ├── bootstrap.js          # Shared initialization (~228 lines)
│   │   │                           # initVisualization(), animate()
│   │   ├── renderer.js           # WebGPU setup (~309 lines)
│   │   │                           # Renderer, camera, controls, post-processing
│   │   ├── animation.js          # Timing utilities
│   │   ├── constants.js          # Shared constants
│   │   └── index.js              # Core exports
│   │
│   ├── scenes/
│   │   ├── registry.js           # Scene management (~116 lines)
│   │   │                           # initScene(), updateScene(), switchScene()
│   │   ├── base.js               # Common scene utilities
│   │   ├── particles.js          # Linked particles scene (~350 lines)
│   │   │                           # GPU compute shaders, dynamic links
│   │   ├── points.js             # Instanced points scene
│   │   │                           # Hilbert curve, flowing points
│   │   ├── skinning.js           # Animated character scene
│   │   │                           # GLTF model, point cloud overlay
│   │   └── index.js              # Scene exports
│   │
│   ├── audio/
│   │   ├── capture.js            # Audio capture (~411 lines)
│   │   │                           # initAudio(), analyzeAudio()
│   │   │                           # Browser: screen/tab capture
│   │   │                           # Electron: desktopCapturer API
│   │   ├── uniforms.js           # TSL audio uniforms
│   │   └── index.js              # Audio exports
│   │
│   ├── gui/
│   │   ├── index.js              # GUI creation (~732 lines)
│   │   │                           # createFolder(), addSlider()
│   │   │                           # Scene-specific GUIs
│   │   └── audio-selector.js     # Audio source selector
│   │
│   ├── settings/
│   │   ├── defaults.js           # Default settings (~162 lines)
│   │   │                           # All 40+ visualization parameters
│   │   ├── utils.js              # Settings serialization
│   │   └── index.js              # Settings exports
│   │
│   └── spout/
│       ├── sync.js               # IPC synchronization
│       │                           # Settings/audio/scene sync
│       └── index.js              # Spout exports
│
└── models/
    └── gltf/
        ├── Michelle.glb          # Character model for skinning scene
        └── animations.blend      # Source Blender file
```

---

## Module Reference

### Core Modules

#### `src/core/bootstrap.js` (Primary Entry)
**Exports:** `initVisualization()`, `stopAnimation()`, `startAnimation()`, `getCurrentScene()`, `isAppInitialized()`

**Key Functions:**
- `initVisualization(options)` - Main initialization accepting:
  - `settings` - Settings object
  - `sceneType` - 'particles' | 'points' | 'skinning'
  - `rendererConfig` - {width, height, autoRotate, autoRotateSpeed}
  - `onSettingsChange` - Callback
  - `onAudioUpdate` - Callback for audio data
  - `onRender` - Pre-render callback
- `animate()` - Main animation loop (private)

**Dependencies:** WebGPU check → renderer.js → scene registry → animation loop

#### `src/core/renderer.js`
**Exports:** `initRenderer()`, `getRenderer()`, `getCamera()`, `getControls()`, `setupPostProcessing()`, `updateBloom()`, `updateControls()`, `render()`, `setAnimationLoop()`

**State Management:**
- Singleton renderer, camera, controls instances
- Post-processing pipeline with bloom effect
- Handles window resize automatically

### Scene Modules

#### `src/scenes/registry.js`
**Exports:** `initScene()`, `updateScene()`, `getCurrentSceneType()`, `switchScene()`, `getSceneName()`, `getAvailableScenes()`

**Registry:**
```javascript
{
  particles: { init: initParticlesScene, update: updateParticlesScene },
  points:    { init: initPointsScene,    update: updatePointsScene },
  skinning:  { init: initSkinningScene,  update: updateSkinningScene }
}
```

#### `src/scenes/particles.js`
**Exports:** `initParticlesScene()`, `updateParticlesScene()`, `particlesScene` (state object)

**Techniques:**
- Storage buffer attributes for GPU particle data
- Compute shaders for particle physics (TSL)
- Dynamic proximity-based linking
- Audio-reactive spawn rate, turbulence, size

**Key Uniforms:**
- `nbToSpawn` - Particles to spawn per frame
- `turbAmplitude`, `turbFrequency` - Noise parameters
- `particleSize`, `particleLifetime` - Visual parameters

#### `src/scenes/points.js`
**Exports:** `initPointsScene()`, `updatePointsScene()`

**Features:**
- Hilbert curve for point distribution
- Instanced rendering with varying widths
- Audio-reactive pulse speed and width

#### `src/scenes/skinning.js`
**Exports:** `initSkinningScene()`, `updateSkinningScene()`

**Features:**
- GLTF model loading (Michelle.glb)
- Animated skeleton/skinning
- Point cloud overlay on character
- Audio-reactive animation speed

### Audio Modules

#### `src/audio/capture.js`
**Exports:** `initAudio()`, `analyzeAudio()`, `selectAudioSource()`, `isAudioActive()`, `getAudioSources()`, `getSelectedAudioSource()`, `closeAudio()`, `initDummyAudio()`

**Modes:**
1. **Browser:** Uses `getDisplayMedia()` for screen/tab audio
2. **Electron:** Uses `desktopCapturer` to enumerate windows/screens
3. **Dummy:** Synthetic audio for OBS Browser Source (no permission dialogs)

**Audio Analysis:**
- FFT size: 512
- Smoothing: 0.75
- Frequency bands: Bass (~8%), Mid (~40%), High (~52%)
- Returns: {bass, mid, high, overall} normalized 0-1

#### `src/audio/uniforms.js`
**Exports:** `audioBass`, `audioMid`, `audioHigh`, `audioOverall` (TSL uniform nodes)
**Function:** `updateAudioUniforms({bass, mid, high, overall})`

Used in TSL shaders for audio reactivity without texture uploads.

### Settings Module

#### `src/settings/defaults.js`
**Exports:** `defaultSettings` (frozen object), `createSettings()` (factory)

**Setting Categories:**
- Audio Sensitivity (bass/mid/high multipliers)
- Bass Response (spawn rate, radius, bloom)
- Mid Response (turbulence, frequency, speed)
- High Response (size, color speed)
- Bloom (intensity, threshold, radius)
- Camera (auto-rotate, speed)
- Spout (enabled, sender name, resolution, frame skip)

**Setting Schema:**
```javascript
{
  value: number|boolean|string,
  min?: number, max?: number,
  label: string,
  options?: string[] // for string settings
}
```

### GUI Module

#### `src/gui/index.js`
**Exports:**
- `createGUI()` - Generic settings GUI
- `createPointsGUI()` - Points scene controls
- `createParticlesGUI()` - Particles scene controls
- `createSkinningGUI()` - Skinning scene controls
- `createSceneSelector()` - Scene dropdown
- `createSpoutControls()` - Spout settings (Electron only)
- `createFolder()`, `addSlider()`, `addCheckbox()`, `addTextInput()`

**UI Pattern:** Collapsible folders with sliders and checkboxes

### Spout Module

#### `src/spout/sync.js`
**Exports:**
- `syncSettingsToSpout()` - Serialize and send settings
- `syncAudioToSpout()` - Send audio analysis
- `syncSceneToSpout()` - Send scene type
- `setupSpoutSyncListeners()` - Setup sync receivers
- `isSpoutAvailable()`, `isSpoutSyncAvailable()`

**Sync Flow:**
```
Main Window → IPC → Electron Main → IPC → Spout Window
```

---

## Entry Point Details

### `main.js` (Browser)
**Responsibilities:**
1. Initialize audio capture
2. Detect OBS Browser Source (uses dummy audio)
3. Initialize visualization via `initVisualization()`
4. Create scene-specific GUI
5. Handle scene switching
6. Sync to Spout window (if in Electron)

**Scene Switching:**
```javascript
await switchSceneWithGUI(sceneType)
// 1. Stop animation
// 2. Cleanup current scene
// 3. Clear controls
// 4. Reinitialize with new scene
// 5. Sync to Spout
```

### `electron/main.js`
**Key Functions:**
- `createMainWindow()` - Visible user window
- `createSpoutWindow()` - Hidden offscreen window (1920x1080 or 1280x720)
- `destroySpoutWindow()` - Cleanup

**IPC Handlers:**
- `spout:check-available` - Check if native module loaded
- `spout:enable` - Create Spout sender
- `spout:disable` - Destroy Spout sender
- `spout:update-name` - Change sender name
- `spout:update-frame-skip` - Adjust frame rate
- `audio:get-sources` - Enumerate audio sources
- `sync:*` - Forward sync messages to Spout window

**Paint Event Handler:**
```javascript
spoutWindow.webContents.on('paint', (event, dirty, image, texture) => {
  if (texture) {
    spoutSender.updateTexture(texture);  // GPU path (fast)
  } else if (image) {
    spoutSender.updateFrame(image.getBitmap(), size);  // CPU fallback
  }
});
```

### `spout-renderer.js` (Hidden Window)
**Responsibilities:**
1. Receive sync from main window via `spoutSync`
2. Initialize visualization with fixed 1920x1080 resolution
3. Apply settings updates from main window
4. Handle scene changes

**No GUI elements** - pure visualization output only.

---

## Data Flow

### Audio Flow
```
Audio Source → AnalyserNode → ByteFrequencyData
                              ↓
                    calculate frequency bands
                              ↓
              {bass, mid, high, overall} → TSL uniforms
                              ↓
                         Scene update
                              ↓
                    Audio-reactive visuals
```

### Settings Flow
```
User Input → GUI slider → settings[key].value = newValue
                              ↓
                    onSettingChange callback
                              ↓
              syncSettingsToSpout(settings)
                              ↓
                    IPC: sync:settings
                              ↓
              deserializeSettings(spoutWindow)
                              ↓
                    Update visualization
```

### Scene Flow
```
Scene Selector → switchSceneWithGUI(type)
                     ↓
              cleanup current scene
                     ↓
              initVisualization({sceneType: type})
                     ↓
              create[Scene]GUI()
                     ↓
              syncSceneToSpout(type)
                     ↓
              IPC: sync:scene
                     ↓
              Spout window reinitializes
```

---

## Key Dependencies

### Runtime
- `three@^0.179.0` - WebGPU renderer, TSL, post-processing
- `electron-spout` - Native Spout SDK bindings (Windows only)

### Dev
- `electron@^28.0.0` - Desktop app wrapper
- `electron-rebuild` - Rebuild native modules
- `cmake-js@^8.0.0` - Build electron-spout
- `serve@^14.2.5` - Static file server for browser mode

### Three.js Add-ons
```javascript
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

---

## Configuration

### URL Parameters
- `?scene=particles` - Start with specific scene
- `?autostart=true` - Auto-start visualizer
- `?audio=dummy` - Use synthetic audio
- `?cdn=true` - Use CDN imports (for OBS Browser Source)
- `?obs=true` - OBS detection mode

### Settings Files
- `src/settings/defaults.js` - Default values
- `src/settings/utils.js` - Serialization (localStorage)

### Electron Windows
**Main Window:**
- Size: 1280x720
- Context isolation: enabled
- Preload: `preload.js`

**Spout Window:**
- Size: 1920x1080 (configurable: 720p, 1080p)
- Offscreen: true
- OffscreenUseSharedTexture: true (GPU sharing)
- Never visible (show: false)

---

## Development Commands

```bash
# Browser mode (port 3002)
npm start
npm run dev

# Electron mode
npm run electron

# Rebuild Spout native module (Windows)
npm run rebuild-spout
npm run electron-rebuild
```

---

## Platform-Specific Features

### Windows (Electron)
- **Spout Output:** Native GPU texture sharing to VJ apps
- **System Audio:** Desktop capture via desktopCapturer API
- **Requirements:** CMake, Visual Studio Build Tools

### Browser
- **Audio Source:** Screen/tab sharing (requires "Share audio" checkbox)
- **WebGPU:** Requires Chrome 113+ or Edge 113+
- **OBS Browser Source:** CDN imports, dummy audio mode

### Both
- Three.js WebGPU renderer
- TSL compute shaders
- Real-time frequency analysis
- Scene switching
- Settings persistence

---

## Extension Points

### Adding a New Scene
1. Create `src/scenes/newscene.js`:
```javascript
export async function initNewScene(renderer, camera, controls) {
  const scene = new THREE.Scene();
  // ... scene setup
  return scene;
}

export function updateNewScene(delta, settings, renderer, audioData) {
  // ... update logic
}
```

2. Register in `src/scenes/registry.js`:
```javascript
import { initNewScene, updateNewScene } from './newscene.js';

const sceneRegistry = {
  // ... existing scenes
  newscene: { init: initNewScene, update: updateNewScene }
};
```

3. Add to constants in `src/core/constants.js`:
```javascript
export const SCENE_NAMES = {
  // ... existing
  newscene: 'New Scene Name'
};
```

4. Create GUI in `src/gui/index.js`:
```javascript
export function createNewSceneGUI(settings, container, onChange, isElectron) {
  // ... UI creation
}
```

### Adding New Settings
1. Define in `src/settings/defaults.js`:
```javascript
newSetting: { 
  value: 1.0, 
  min: 0, 
  max: 10, 
  label: "New Setting" 
}
```

2. Use in scene update function
3. Add to GUI if user-configurable

---

## Troubleshooting

### WebGPU Not Available
- Check browser: Chrome 113+, Edge 113+
- Verify WebGPU support: https://webgpureport.org/
- OBS Browser Source: Use CDN mode (`?cdn=true`)

### Spout Build Errors
- Install CMake with PATH
- Install Visual Studio Build Tools (C++ workload)
- Run `npm run rebuild-spout`

### No Audio in Browser
- Ensure "Share audio" checkbox when selecting screen/tab
- Try Electron mode for system audio capture

### Black Screen in OBS
- Spout uses bitmap fallback (WebGPU shared texture limitations)
- Check Spout sender name in OBS Spout plugin
- Ensure Spout enabled in Settings panel

---

## File Statistics

| File | Lines | Purpose |
|------|-------|---------|
| `src/gui/index.js` | 732 | GUI creation and management |
| `src/audio/capture.js` | 411 | Audio capture and analysis |
| `src/scenes/particles.js` | 350 | Linked particles scene with GPU compute |
| `src/core/renderer.js` | 309 | WebGPU renderer setup |
| `electron/main.js` | 277 | Electron main process |
| `src/core/bootstrap.js` | 228 | Shared initialization |
| `src/settings/defaults.js` | 162 | Default settings |
| `src/scenes/registry.js` | 116 | Scene management |
| `main.js` | 203 | Browser entry point |
| `spout-renderer.js` | 58 | Spout window entry |
| `preload.js` | 41 | IPC bridge |

**Total Source Code:** ~3000 lines (excluding node_modules)

---

## License & Credits

- **License:** ISC
- **Three.js:** https://threejs.org/
- **Electron Spout:** https://github.com/cnSchwarzer/electron-spout
- **Spout SDK:** https://github.com/leadedge/Spout2

---

*Generated for LLM context - Last updated: 2026-02-24*
