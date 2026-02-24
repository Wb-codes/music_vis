# Spout Output Implementation Checklist

## Overview
Add Spout output capability to the music visualizer by wrapping it in Electron. Each scene will have a checkbox to enable/disable Spout output.

## Prerequisites
- Windows OS (Spout is Windows-only)
- Spout SDK installed (comes with most VJ apps like Resolume, TouchDesigner, etc.)
- **CMake** installed from https://cmake.org/download/
- **Visual Studio Build Tools** with C++ desktop development workload
- **Windows SDK** (usually included with VS Build Tools)

---

## Phase 1: Project Setup

### 1.1 Update `package.json`
- [ ] Change `"main": "index.js"` to `"main": "electron/main.js"`
- [ ] Add to `devDependencies`:
  ```json
  "electron": "^28.0.0",
  "electron-rebuild": "^3.2.9"
  ```
- [ ] Add to `dependencies`:
  ```json
  "electron-spout": "github:cnSchwarzer/electron-spout"
  ```
- [ ] Add scripts:
  ```json
  "electron": "electron .",
  "electron-rebuild": "electron-rebuild -f -w electron-spout"
  ```
- [ ] Keep existing `"start"` and `"dev"` scripts unchanged for browser mode

### 1.2 Create Directory Structure
- [ ] Create `electron/` directory
- [ ] Ensure `preload.js` will be at project root level

---

## Phase 1.5: Architecture - Canvas-Only Output (No UI)

### Critical Requirement
Spout output must contain **only the Three.js render**, excluding all UI elements (settings panel, buttons, status indicators, overlays).

### Implementation Approach
Use **canvas capture** instead of offscreen window rendering:

1. **Two-Window Architecture**:
   - Main window: Visible to user with full UI (controls, overlays)
   - Hidden window: Offscreen renderer for Spout output only

2. **Or: Single Window with Canvas Extraction**:
   - Main window renders everything normally
   - Extract Three.js canvas content via IPC
   - Send only canvas pixels to Spout

### Recommended: Hidden Offscreen Window
```js
// In electron/main.js
let spoutWindow = null;  // Hidden window for Spout

async function enableSpout() {
  // Create hidden offscreen window
  spoutWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      offscreenUseSharedTexture: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });
  
  // Load a minimal page with just the canvas
  spoutWindow.loadFile('spout-output.html');
  spoutWindow.webContents.setFrameRate(60);
  
  spoutWindow.webContents.on('paint', (event, dirty, image, texture) => {
    if (texture && spoutSender) {
      spoutSender.sendTexture(texture);
    }
  });
}
```

### Alternative: Canvas Stream Approach
If two windows are too complex, capture the Three.js canvas directly:

```js
// In preload.js - expose canvas capture
contextBridge.exposeInMainWorld('spoutAPI', {
  // ... other methods
  captureCanvas: async () => {
    const canvas = document.querySelector('canvas');  // Three.js canvas
    if (!canvas) return null;
    
    // Use OffscreenCanvas for efficient capture
    const offscreen = canvas.transferControlToOffscreen();
    return offscreen;
  }
});
```

### Files to Create
- [ ] `spout-output.html` - Minimal HTML for hidden window (no UI, just canvas container)
- [ ] `spout-renderer.js` - Separate renderer that mirrors main visualization state

### State Synchronization
- Main window and Spout window must share visualization state
- Use IPC to sync: audio data, settings, scene selection
- Both windows run identical Three.js render loop

---

## Phase 2: Electron Main Process

### 2.1 Create `electron/main.js`
- [ ] Import required modules:
  ```js
  const { app, BrowserWindow, ipcMain } = require('electron');
  const path = require('path');
  ```
- [ ] Import electron-spout (with try/catch for graceful failure):
  ```js
  let SpoutOutput;
  try {
    SpoutOutput = require('electron-spout').SpoutOutput;
  } catch (e) {
    console.warn('Spout not available:', e.message);
  }
  ```

### 2.2 Create Main Window (With UI)
- [ ] Create main BrowserWindow with full UI:
  ```js
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });
  mainWindow.loadFile('index.html');
  ```

### 2.3 Create Hidden Spout Window (No UI)
- [ ] Create hidden offscreen window for Spout output:
  ```js
  let spoutWindow = null;
  let spoutSender = null;
  let spoutEnabled = false;

  async function createSpoutWindow() {
    spoutWindow = new BrowserWindow({
      show: false,  // Never visible
      width: 1920,
      height: 1080,
      webPreferences: {
        offscreen: true,
        offscreenUseSharedTexture: true,  // GPU direct sharing
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      }
    });
    await spoutWindow.loadFile('spout-output.html');
    spoutWindow.webContents.setFrameRate(60);
    
    spoutWindow.webContents.on('paint', (event, dirty, image, texture) => {
      if (texture && spoutSender && spoutEnabled) {
        spoutSender.sendTexture(texture);
      }
    });
  }
  ```

### 2.4 State Synchronization Between Windows
- [ ] Create IPC handlers for syncing visualization state:
  - [ ] `spout:sync-settings` → forward settings from main to spout window
  - [ ] `spout:sync-audio` → forward audio data to spout window
  - [ ] `spout:sync-scene` → forward scene selection to spout window
  - [ ] `spout:sync-time` → forward elapsed time for animation sync

### 2.5 Create IPC Handlers
- [ ] `spout:check-available` → returns boolean if Spout is available
- [ ] `spout:enable` → initialize Spout sender, create hidden window
- [ ] `spout:disable` → cleanup Spout sender, destroy hidden window
- [ ] `spout:get-status` → returns current enabled state
- [ ] Forward sync messages from main window to spout window:
  ```js
  ipcMain.on('sync:settings', (event, settings) => {
    if (spoutWindow) {
      spoutWindow.webContents.send('sync:settings', settings);
    }
  });
  ```

### 2.6 Handle Window Lifecycle
- [ ] Clean up spout window on app quit
- [ ] Clean up spout window on main window close
- [ ] Handle spout window recreation if needed

---

## Phase 3: Preload Script

### 3.1 Create `preload.js`
- [ ] Import modules:
  ```js
  const { contextBridge, ipcRenderer } = require('electron');
  ```
- [ ] Expose safe API to renderer:
  ```js
  contextBridge.exposeInMainWorld('spoutAPI', {
    isAvailable: () => ipcRenderer.invoke('spout:check-available'),
    enable: () => ipcRenderer.invoke('spout:enable'),
    disable: () => ipcRenderer.invoke('spout:disable'),
    getStatus: () => ipcRenderer.invoke('spout:get-status'),
    onStatusChange: (callback) => {
      ipcRenderer.on('spout:status-changed', (event, enabled) => callback(enabled));
    },
    // Sync methods - send state to spout window
    syncSettings: (settings) => ipcRenderer.send('sync:settings', settings),
    syncAudio: (audioData) => ipcRenderer.send('sync:audio', audioData),
    syncScene: (sceneType) => ipcRenderer.send('sync:scene', sceneType)
  });
  ```
- [ ] Also expose `isElectron` flag:
  ```js
  contextBridge.exposeInMainWorld('isElectron', true);
  ```

### 3.2 Add Sync Listener for Spout Window
- [ ] In preload, also expose receiver for spout window:
  ```js
  contextBridge.exposeInMainWorld('spoutSync', {
    onSettings: (callback) => ipcRenderer.on('sync:settings', (e, s) => callback(s)),
    onAudio: (callback) => ipcRenderer.on('sync:audio', (e, a) => callback(a)),
    onScene: (callback) => ipcRenderer.on('sync:scene', (e, scene) => callback(scene))
  });
  ```

---

## Phase 4: Spout Output Page (No UI)

### 4.1 Create `spout-output.html`
- [ ] Create minimal HTML file for hidden window:
  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; }
      body { overflow: hidden; background: #14171a; }
      canvas { display: block; }
    </style>
    <script type="importmap">
    {
      "imports": {
        "three": "./node_modules/three/build/three.webgpu.js",
        "three/webgpu": "./node_modules/three/build/three.webgpu.js",
        "three/tsl": "./node_modules/three/build/three.tsl.js",
        "three/addons/": "./node_modules/three/examples/jsm/"
      }
    }
    </script>
  </head>
  <body>
    <script type="module" src="spout-renderer.js"></script>
  </body>
  </html>
  ```

### 4.2 Create `spout-renderer.js`
- [ ] Create renderer script for hidden window (no UI elements):
  - [ ] Import same Three.js modules as main.js
  - [ ] Initialize renderer (same config as main window)
  - [ ] Initialize scenes (same scene code)
  - [ ] Listen for sync events from main window:
    ```js
    if (window.spoutSync) {
      window.spoutSync.onSettings((settings) => {
        // Update local settings
      });
      window.spoutSync.onAudio((audioData) => {
        // Update audio uniforms
      });
      window.spoutSync.onScene((sceneType) => {
        // Switch scene
      });
    }
    ```
  - [ ] **NO GUI creation** - settings come from main window
  - [ ] **NO overlays, buttons, or status indicators**
  - [ ] Full resolution render (1920x1080 or configurable)

### 4.3 Handle Resolution Configuration
- [ ] Add resolution options to settings:
  ```js
  spoutResolution: { value: '1920x1080', options: ['1280x720', '1920x1080', '2560x1440'] }
  ```
- [ ] Update spout window dimensions on resolution change

---

## Phase 5: Settings Integration

### 5.1 Update `main.js` - Add Spout Settings
- [ ] Add to `settings` object in `main.js`:
  ```js
  spoutEnabled: { value: false, label: "Enable Spout" },
  spoutSenderName: { value: "Music Visualizer", label: "Sender Name" }
  ```
- [ ] Sender name identifies the source in receiving software (Resolume, TouchDesigner, OBS, etc.)
- [ ] Default: "Music Visualizer" - appears as the source name in SpoutReceiver and compatible apps

### 5.2 Update `createGUI()` function
- [ ] Detect if running in Electron:
  ```js
  const isElectron = window.isElectron === true;
  ```
- [ ] Only show Spout checkbox when in Electron:
  ```js
  if (isElectron && window.spoutAPI) {
    // Add Spout folder to GUI
  }
  ```
- [ ] Create checkbox handler:
  ```js
  checkbox.onchange = async () => {
    if (checkbox.checked) {
      await window.spoutAPI.enable();
    } else {
      await window.spoutAPI.disable();
    }
    settings.spoutEnabled.value = checkbox.checked;
  };
  ```

### 5.3 Add State Syncing to Main Window
- [ ] Sync settings to spout window on change:
  ```js
  function syncToSpout() {
    if (window.spoutAPI && settings.spoutEnabled.value) {
      window.spoutAPI.syncSettings(settings);
    }
  }
  ```
- [ ] Call `syncToSpout()` after any setting change
- [ ] Sync audio data in `updateAudioData()`:
  ```js
  if (window.spoutAPI && settings.spoutEnabled.value) {
    window.spoutAPI.syncAudio({ bass, mid, high, overall });
  }
  ```
- [ ] Sync scene selection on scene change:
  ```js
  window.spoutAPI.syncScene(sceneType);
  ```

### 5.4 Add Per-Scene Spout State (Optional Enhancement)
- [ ] Store spout state per scene:
  ```js
  let spoutEnabledParticles = false;
  let spoutEnabledPoints = false;
  let spoutEnabledSkinning = false;
  ```
- [ ] Add checkbox to each scene's folder in GUI
- [ ] Persist state to localStorage

---

## Phase 6: UI Updates

### 6.1 Update `index.html`
- [ ] No changes needed - GUI is generated dynamically in `main.js`
- [ ] Ensure no CSS conflicts with new checkbox

### 6.2 Visual Feedback
- [ ] Update `#audio-status` area to show Spout status when active:
  ```html
  <span id="spout-status"></span>
  ```
- [ ] Add styling for Spout status indicator

---

## Phase 7: Testing

### 7.1 Browser Mode (Ensure No Breaking Changes)
- [ ] Run `npm start` or `npm run dev`
- [ ] Verify app loads normally in browser
- [ ] Verify no console errors about Spout
- [ ] Verify all three scenes work correctly
- [ ] Verify all existing controls function

### 7.2 Electron Mode (New Functionality)
- [ ] Run `npm run electron`
- [ ] Verify app loads in Electron
- [ ] Check browser console for `window.spoutAPI` availability
- [ ] Open Settings panel
- [ ] Verify Spout checkbox appears in GUI
- [ ] Test enabling Spout output
- [ ] Open SpoutReceiver.exe or compatible app
- [ ] Verify "Music Visualizer" appears as source
- [ ] **Verify Spout output has NO UI elements** (controls, overlays hidden)
- [ ] Verify Spout output matches visualization content
- [ ] Test disabling Spout output
- [ ] Test toggling during animation
- [ ] Test switching between scenes
- [ ] Verify both windows stay in sync

### 7.3 Edge Cases
- [ ] Test app behavior when Spout SDK not installed
- [ ] Test rapid toggle on/off
- [ ] Test memory usage over time
- [ ] Test window resize during Spout output
- [ ] Test resolution changes in Spout output
- [ ] Test audio sync between windows

---

## Phase 8: Finalization

### 8.1 Documentation
- [ ] Add section to README or create USAGE.md:
  - How to run browser version: `npm start`
  - How to run Electron version: `npm run electron`
  - Spout requirements and setup
  - **Spout output is clean (no UI) - visualization only**
  - Troubleshooting common issues

### 8.2 Package.json Final State
Expected scripts after implementation:
```json
{
  "scripts": {
    "start": "serve -p 3002",
    "dev": "serve -p 3002",
    "electron": "electron .",
    "electron-rebuild": "electron-rebuild -f -w electron-spout"
  }
}
```

---

## Notes

### Architecture: Two-Window Design
The Spout output uses a **hidden offscreen window** to render the visualization cleanly:

```
┌─────────────────────────────┐     IPC Sync      ┌─────────────────────────────┐
│     MAIN WINDOW             │ ─────────────────► │   SPOUT WINDOW (hidden)     │
│  (visible to user)          │                    │  (offscreen, no UI)         │
│                             │                    │                             │
│  ┌─────────────────────┐   │                    │  ┌─────────────────────┐   │
│  │ Three.js Canvas     │   │                    │  │ Three.js Canvas     │   │
│  │ + UI overlays       │   │                    │  │ (clean, no UI)      │   │
│  │ + Settings panel    │   │                    │  │                     │   │
│  │ + Buttons           │   │                    │  └──────────┬──────────┘   │
│  └─────────────────────┘   │                    │             │              │
└─────────────────────────────┘                    └─────────────┼──────────────┘
                                                                 │
                                                                 ▼
                                                        ┌──────────────┐
                                                        │ Spout Sender │
                                                        │ (GPU shared) │
                                                        └──────────────┘
```

### Backward Compatibility
- All existing functionality preserved
- Browser mode unchanged (`npm start`)
- Electron mode is opt-in (`npm run electron`)
- Settings gracefully handle missing Spout API

### Per-Scene Implementation
Each scene maintains its own Spout enabled state:
```js
// In main.js, add to each scene object:
let particlesScene = {
  // ... existing properties
  spoutEnabled: false
};

let pointsScene = {
  // ... existing properties  
  spoutEnabled: false
};

let skinningScene = {
  // ... existing properties
  spoutEnabled: false
};
```

### GUI Checkbox Pattern
```js
// Add Spout checkbox to each scene's settings folder
function addSpoutCheckbox(container, sceneObject, sceneName) {
  if (!window.spoutAPI) return;
  
  const row = document.createElement('div');
  row.className = 'control-row';
  
  const label = document.createElement('label');
  label.textContent = 'Spout Output';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = sceneObject.spoutEnabled;
  
  checkbox.onchange = async () => {
    if (checkbox.checked) {
      await window.spoutAPI.enable();
    } else {
      await window.spoutAPI.disable();
    }
    sceneObject.spoutEnabled = checkbox.checked;
  };
  
  row.appendChild(label);
  row.appendChild(checkbox);
  container.appendChild(row);
}
```

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add Electron dependencies and scripts |
| `electron/main.js` | Create | Electron main process with two-window architecture |
| `preload.js` | Create | IPC bridge for Spout API + sync methods |
| `spout-output.html` | Create | Minimal HTML for hidden Spout window (no UI) |
| `spout-renderer.js` | Create | Renderer for Spout window (visualization only) |
| `main.js` | Modify | Add Spout checkbox + sync calls |
| `SPOUT_IMPLEMENTATION.md` | Create | This checklist |

## Estimated Effort
- Phase 1-2: ~1.5 hours (two-window setup)
- Phase 3-4: ~1 hour (preload + spout renderer)
- Phase 5-6: ~30 min (settings integration)
- Phase 7-8: ~1 hour (testing + docs)
- **Total: ~3.5-4 hours**
