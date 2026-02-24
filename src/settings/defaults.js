/**
 * @module settings/defaults
 * @description Default visualization settings and their constraints.
 * All settings are reactive and control visual parameters.
 */

import { ANIMATION_NAMES, DEFAULT_ANIMATION } from '../core/animations.js';

/**
 * @typedef {Object} NumberSetting
 * @property {number} value - Current value
 * @property {number} [min] - Minimum allowed value
 * @property {number} [max] - Maximum allowed value
 * @property {string} label - Display label for UI
 */

/**
 * @typedef {Object} BooleanSetting
 * @property {boolean} value - Current value
 * @property {string} label - Display label for UI
 */

/**
 * @typedef {Object} StringSetting
 * @property {string} value - Current value
 * @property {string} label - Display label for UI
 * @property {string[]} [options] - Optional array of options for dropdown
 */

/**
 * All visualization settings.
 * @constant
 * @type {Object.<string, NumberSetting|BooleanSetting|StringSetting>}
 */
export const defaultSettings = {
    // === Audio Sensitivity ===
    /** Bass frequency sensitivity multiplier */
    bassSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Bass Sensitivity" },
    /** Mid frequency sensitivity multiplier */
    midSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Mid Sensitivity" },
    /** High frequency sensitivity multiplier */
    highSensitivity: { value: 1.5, min: 0.1, max: 5, label: "High Sensitivity" },
    
    // === Bass Controls ===
    /** Bass-driven particle spawn rate */
    bassSpawnRate: { value: 50, min: 0, max: 200, label: "Bass -> Spawn Rate" },
    /** Bass-driven orbit radius */
    bassRadius: { value: 3, min: 0, max: 10, label: "Bass -> Orbit Radius" },
    /** Bass-driven bloom intensity */
    bassBloom: { value: 2, min: 0, max: 5, label: "Bass -> Bloom" },
    
    // === Mid Controls ===
    /** Mid-driven turbulence intensity */
    midTurbulence: { value: 2, min: 0, max: 5, label: "Mid -> Turbulence" },
    /** Mid-driven turbulence frequency */
    midFrequency: { value: 0.5, min: 0, max: 2, label: "Mid -> Frequency" },
    /** Mid-driven orbit speed */
    midSpeed: { value: 0.5, min: 0, max: 2, label: "Mid -> Orbit Speed" },
    
    // === High Controls ===
    /** High-driven particle size multiplier */
    highSize: { value: 2, min: 0, max: 5, label: "High -> Particle Size" },
    /** High-driven color rotation speed */
    highColorSpeed: { value: 3, min: 0, max: 10, label: "High -> Color Speed" },
    
    // === Overall Controls ===
    /** Global particle lifetime multiplier */
    overallLifetime: { value: 0.5, min: 0, max: 1, label: "Overall -> Lifetime" },
    
    // === Base Values ===
    /** Base particle spawn rate */
    baseSpawnRate: { value: 5, min: 1, max: 50, label: "Base Spawn Rate" },
    /** Base turbulence intensity */
    baseTurbulence: { value: 0.5, min: 0, max: 2, label: "Base Turbulence" },
    /** Base particle size */
    baseSize: { value: 1, min: 0.1, max: 3, label: "Base Size" },
    /** Base orbit radius */
    baseRadius: { value: 2, min: 0.5, max: 5, label: "Base Orbit Radius" },
    
    // === Bloom Post-Processing ===
    /** Base bloom strength */
    bloomStrength: { value: 0.75, min: 0, max: 3, label: "Base Bloom" },
    /** Bloom threshold for activation */
    bloomThreshold: { value: 0.1, min: 0, max: 2, label: "Bloom Threshold" },
    /** Bloom radius/blur amount */
    bloomRadius: { value: 0.5, min: 0, max: 1, label: "Bloom Radius" },
    
    // === Instanced Points Scene ===
    /** Pulse animation speed */
    pulseSpeed: { value: 6, min: 1, max: 20, label: "Pulse Speed" },
    /** Minimum line width */
    minWidth: { value: 6, min: 1, max: 30, label: "Min Width" },
    /** Maximum line width */
    maxWidth: { value: 20, min: 2, max: 30, label: "Max Width" },
    
    // === Audio-reactive Instanced Points ===
    /** Max Width base value */
    pointsMaxWidth: { value: 20, min: 2, max: 30, label: "Overall" },
    /** Max Width bass sensitivity */
    pointsMaxWidthBass: { value: 0.5, min: 0, max: 2, label: "Bass Sens" },
    /** Max Width mid sensitivity */
    pointsMaxWidthMid: { value: 0.3, min: 0, max: 2, label: "Mid Sens" },
    /** Max Width high sensitivity */
    pointsMaxWidthHigh: { value: 0.2, min: 0, max: 2, label: "High Sens" },
    
    /** Min Width base value */
    pointsMinWidth: { value: 6, min: 1, max: 30, label: "Overall" },
    /** Min Width bass sensitivity */
    pointsMinWidthBass: { value: 0.5, min: 0, max: 2, label: "Bass Sens" },
    /** Min Width mid sensitivity */
    pointsMinWidthMid: { value: 0.3, min: 0, max: 2, label: "Mid Sens" },
    /** Min Width high sensitivity */
    pointsMinWidthHigh: { value: 0.2, min: 0, max: 2, label: "High Sens" },
    
    /** Pulse Speed base value */
    pointsPulseSpeed: { value: 6, min: 1, max: 20, label: "Overall" },
    /** Pulse Speed bass sensitivity */
    pointsPulseSpeedBass: { value: 0.5, min: 0, max: 2, label: "Bass Sens" },
    /** Pulse Speed mid sensitivity */
    pointsPulseSpeedMid: { value: 0.3, min: 0, max: 2, label: "Mid Sens" },
    /** Pulse Speed high sensitivity */
    pointsPulseSpeedHigh: { value: 0.2, min: 0, max: 2, label: "High Sens" },
    
    // === Audio-reactive Bloom ===
    /** Bloom intensity base value */
    bloomIntensity: { value: 0.75, min: 0, max: 3, label: "Intensity" },
    /** Bloom bass sensitivity */
    bloomBass: { value: 0.5, min: 0, max: 2, label: "Bass Sens" },
    /** Bloom mid sensitivity */
    bloomMid: { value: 0.3, min: 0, max: 2, label: "Mid Sens" },
    /** Bloom high sensitivity */
    bloomHigh: { value: 0.2, min: 0, max: 2, label: "High Sens" },
    
// === Camera Controls ===
  /** Enable automatic camera rotation */
  autoRotate: { value: true, label: "Auto Rotate" },
  /** Camera rotation speed (negative for reverse) */
  autoRotateSpeed: { value: 2, min: -10, max: 10, label: "Rotate Speed" },

  // === Skinning Scene Animation ===
  /** Current animation for skinning scene (options populated at runtime) */
  currentAnimation: { value: "DanceLoop", label: "Animation", options: [] },

  // === Output ===
    /** Enable green screen background for OBS chroma key */
    greenScreen: { value: false, label: "Green Screen" },
    
// === Spout Output (Electron only) ===
  /** Enable Spout output */
  spoutEnabled: { value: false, label: "Enable Spout" },
  /** Spout sender name for receiver apps */
  spoutSenderName: { value: "Music Visualizer", label: "Sender Name" },
  /** Spout output resolution for performance */
  spoutResolution: { value: "1080p", options: ["720p", "1080p"], label: "Resolution" },
  /** Spout frame skip for performance (0 = no skip, 1 = 30fps, 2 = 20fps) */
  spoutFrameSkip: { value: 0, min: 0, max: 2, label: "Frame Skip (0=60fps, 1=30fps, 2=20fps)" }
};

/**
 * Create a reactive settings object from defaults.
 * @returns {Object} Settings object with reactive values
 */
export function createSettings() {
    const settings = {};
    for (const [key, config] of Object.entries(defaultSettings)) {
        settings[key] = { ...config };
    }
    return settings;
}
