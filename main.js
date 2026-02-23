/**
 * @module main
 * @description Main window entry point for the music visualizer.
 * Uses shared bootstrap initialization with Electron-specific features.
 */

import { initVisualization, stopAnimation } from './src/core/bootstrap.js';
import { initAudio, analyzeAudio, isAudioActive } from './src/audio/capture.js';
import { createPointsGUI, createParticlesGUI, createSkinningGUI, createSceneSelector, updateSceneSelector } from './src/gui/index.js';
import { createSettings } from './src/settings/defaults.js';
import { 
    syncSettingsToSpout, 
    syncAudioToSpout,
    syncSceneToSpout,
    isSpoutAvailable
} from './src/spout/sync.js';

// === State ===
const settings = createSettings();
let app = null;
let currentSceneType = 'particles';
let audioInitialized = false;

/**
 * Initialize the application with scene and Spout support.
 * @param {string} sceneType - Scene type to initialize
 */
async function init(sceneType) {
    currentSceneType = sceneType;
    
    // Initialize visualization
    app = await initVisualization({
        settings,
        sceneType,
        onSettingsChange: () => syncSettingsToSpout(settings),
        onAudioUpdate: (audioData) => {
            if (isAudioActive()) {
                syncAudioToSpout(audioData);
            }
        }
    });

    // Sync scene to Spout
    syncSceneToSpout(sceneType);

    // Create scene-specific GUI
    const container = document.getElementById('controls');
    const isElectron = window.isElectron === true;
    
    if (sceneType === 'points') {
        createPointsGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else if (sceneType === 'particles') {
        createParticlesGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else if (sceneType === 'skinning') {
        createSkinningGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else {
        console.warn('Unknown scene type:', sceneType);
    }

  // Hide scene indicator (using dropdown instead)
  const indicator = document.getElementById('scene-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Create scene selector dropdown
  createSceneSelector(sceneType, switchSceneWithGUI);
}

/**
 * Switch to a different scene without reinitializing audio.
 * @param {string} sceneType - The scene type to switch to
 */
export async function switchSceneWithGUI(sceneType) {
  if (sceneType === currentSceneType) return;

  console.log('Switching scene from', currentSceneType, 'to', sceneType);
  currentSceneType = sceneType;

  // Stop current animation
  stopAnimation();

  // Cleanup current scene
  if (app) {
    app.cleanup();
  }

  // Clear controls
  document.getElementById('controls').innerHTML = '';

  // Initialize new scene
  app = await initVisualization({
    settings,
    sceneType,
    onSettingsChange: () => syncSettingsToSpout(settings),
    onAudioUpdate: (audioData) => {
      if (isAudioActive()) {
        syncAudioToSpout(audioData);
      }
    }
  });

  // Sync scene to Spout
  syncSceneToSpout(sceneType);

  // Create scene-specific GUI
  const container = document.getElementById('controls');
  const isElectron = window.isElectron === true;

  if (sceneType === 'points') {
    createPointsGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'particles') {
    createParticlesGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'skinning') {
    createSkinningGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  }

  // Update scene selector dropdown
  updateSceneSelector(sceneType);
}

// === Event Listeners ===

// Start button - initialize audio once and start with particles scene
document.getElementById('start-btn')?.addEventListener('click', async () => {
  document.getElementById('start-overlay').style.display = 'none';

  // Initialize audio only once
  if (!audioInitialized) {
    await initAudio();
    audioInitialized = true;
  }

  // Start with particles scene
  await init('particles');
});
