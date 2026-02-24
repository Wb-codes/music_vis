/**
 * @module core/renderer
 * @description Three.js WebGPU renderer setup and management.
 * Handles camera, controls, and post-processing configuration.
 */

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

import { RENDERER_CONFIG } from './constants.js';

/**
 * @typedef {Object} RendererSetup
 * @property {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @property {THREE.PerspectiveCamera} camera - Main camera
 * @property {OrbitControls} controls - Camera controls
 * @property {THREE.PostProcessing} postProcessing - Post-processing stack
 * @property {Object} bloomPass - Bloom pass configuration
 */

/** @type {THREE.WebGPURenderer|null} */
let renderer = null;

/** @type {THREE.PerspectiveCamera|null} */
let camera = null;

/** @type {OrbitControls|null} */
let controls = null;

/** @type {THREE.PostProcessing|null} */
let postProcessing = null;

/** @type {Object|null} */
let bloomPass = null;

/** @type {boolean} */
let isInitialized = false;

/**
 * Check if WebGPU is available.
 * @returns {boolean}
 */
export function isWebGPUAvailable() {
    return WebGPU.isAvailable();
}

/**
 * Get WebGPU error message element.
 * @returns {HTMLElement}
 */
export function getWebGPUErrorMessage() {
    return WebGPU.getErrorMessage();
}

/**
 * Initialize the WebGPU renderer.
 * Creates renderer, camera, controls, and attaches to DOM.
 * @param {Object} [options] - Configuration options
 * @param {number} [options.width] - Canvas width (default: window.innerWidth)
 * @param {number} [options.height] - Canvas height (default: window.innerHeight)
 * @param {HTMLElement} [options.container] - Container element (default: document.body)
 * @param {boolean} [options.autoRotate] - Enable auto rotation (default: true)
 * @param {number} [options.autoRotateSpeed] - Rotation speed (default: 2)
 * @returns {Promise<RendererSetup>}
 * @throws {Error} If WebGPU is not available
 */
export async function initRenderer(options = {}) {
  console.log('[Renderer] Checking WebGPU availability...');
  
  if (!WebGPU.isAvailable()) {
    console.error('[Renderer] WebGPU not available');
    const errorMsg = WebGPU.getErrorMessage();
    console.error('[Renderer] Error message:', errorMsg);
    document.body.appendChild(errorMsg);
    throw new Error('No WebGPU support');
  }
  
  console.log('[Renderer] WebGPU is available');

  if (isInitialized) {
    console.log('[Renderer] Already initialized, returning existing setup');
    return getRendererSetup();
  }

  const {
    width = RENDERER_CONFIG.width,
    height = RENDERER_CONFIG.height,
    container = document.body,
    autoRotate = true,
    autoRotateSpeed = 2
  } = options;

  try {
    console.log('[Renderer] Creating camera...');
    // Create camera
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 15);
    console.log('[Renderer] Camera created');

    console.log('[Renderer] Creating WebGPU renderer...');
    // Create renderer
    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setClearColor(0x14171a);
    renderer.setPixelRatio(RENDERER_CONFIG.pixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    console.log('[Renderer] Renderer created, canvas added to DOM');
    
    console.log('[Renderer] Initializing WebGPU context...');
    await renderer.init();
    console.log('[Renderer] WebGPU context initialized successfully');

    console.log('[Renderer] Creating OrbitControls...');
    // Create controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = autoRotateSpeed;
    controls.maxDistance = 200;
    console.log('[Renderer] Controls created');

    isInitialized = true;
    console.log('[Renderer] Initialization complete');
    return getRendererSetup();
    
  } catch (err) {
    console.error('[Renderer] Initialization failed:', err);
    console.error('[Renderer] Error stack:', err.stack);
    
    // Cleanup on failure
    if (renderer && renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
    camera = null;
    controls = null;
    
    // Show error in UI
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(200, 50, 50, 0.9); color: white; padding: 20px;
      border-radius: 10px; font-family: sans-serif; z-index: 10000;
      max-width: 80%; text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>WebGPU Initialization Failed</h3>
      <p>Error: ${err.message}</p>
      <p>User Agent: ${navigator.userAgent}</p>
      <p>This may be due to CEF/OBS Browser Source restrictions.</p>
      <p>Try using Electron app with Spout output instead.</p>
    `;
    document.body.appendChild(errorDiv);
    
    throw err;
  }
}

/**
 * Setup post-processing for a scene.
 * @param {THREE.Scene} scene - The scene to process
 * @param {Object} [bloomConfig] - Bloom configuration
 * @param {number} [bloomConfig.strength=0.75] - Bloom strength
 * @param {number} [bloomConfig.threshold=0.1] - Bloom threshold
 * @param {number} [bloomConfig.radius=0.5] - Bloom radius
 * @returns {THREE.PostProcessing}
 */
export function setupPostProcessing(scene, bloomConfig = {}) {
    const { strength = 0.75, threshold = 0.1, radius = 0.5 } = bloomConfig;

    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode('output');
    bloomPass = bloom(scenePassColor, strength, threshold, radius);
    postProcessing = new THREE.PostProcessing(renderer, scenePassColor.add(bloomPass));

    return postProcessing;
}

/**
 * Update bloom parameters.
 * @param {Object} config - Bloom configuration
 * @param {number} [config.strength] - Bloom strength
 * @param {number} [config.threshold] - Bloom threshold
 * @param {number} [config.radius] - Bloom radius
 */
export function updateBloom(config) {
    if (!bloomPass) return;
    if (config.strength !== undefined) bloomPass.strength.value = config.strength;
    if (config.threshold !== undefined) bloomPass.threshold.value = config.threshold;
    if (config.radius !== undefined) bloomPass.radius.value = config.radius;
}

/**
 * Update controls parameters.
 * @param {Object} config - Controls configuration
 * @param {boolean} [config.autoRotate] - Enable auto rotation
 * @param {number} [config.autoRotateSpeed] - Rotation speed
 */
export function updateControls(config) {
    if (!controls) return;
    if (config.autoRotate !== undefined) controls.autoRotate = config.autoRotate;
    if (config.autoRotateSpeed !== undefined) controls.autoRotateSpeed = config.autoRotateSpeed;
}

/**
 * Reset camera to default position.
 * @param {THREE.Vector3} [position] - Camera position (default: 0, 0, 15)
 * @param {THREE.Vector3} [target] - Look at target (default: 0, 0, 0)
 */
export function resetCamera(position, target) {
    if (!camera || !controls) return;
    camera.position.set(position?.x ?? 0, position?.y ?? 0, position?.z ?? 15);
    controls.target.set(target?.x ?? 0, target?.y ?? 0, target?.z ?? 0);
    controls.update();
}

/**
 * Handle window resize.
 * @param {number} [width] - New width (default: window.innerWidth)
 * @param {number} [height] - New height (default: window.innerHeight)
 */
export function onWindowResize(width, height) {
    if (!camera || !renderer) return;
    
    const w = width ?? window.innerWidth;
    const h = height ?? window.innerHeight;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

/**
 * Get the current renderer setup.
 * @returns {RendererSetup}
 */
export function getRendererSetup() {
    return { renderer, camera, controls, postProcessing, bloomPass };
}

/**
 * Get the renderer instance.
 * @returns {THREE.WebGPURenderer|null}
 */
export function getRenderer() {
    return renderer;
}

/**
 * Get the camera instance.
 * @returns {THREE.PerspectiveCamera|null}
 */
export function getCamera() {
    return camera;
}

/**
 * Get the controls instance.
 * @returns {OrbitControls|null}
 */
export function getControls() {
    return controls;
}

/**
 * Check if renderer is initialized.
 * @returns {boolean}
 */
export function isRendererInitialized() {
    return isInitialized;
}

/**
 * Set the animation loop callback.
 * @param {Function} callback - Animation callback function
 */
export function setAnimationLoop(callback) {
    if (!renderer) return;
    renderer.setAnimationLoop(callback);
}

/**
 * Stop the animation loop.
 */
export function stopAnimationLoop() {
    if (!renderer) return;
    renderer.setAnimationLoop(null);
}

/**
 * Render the current frame (for post-processing).
 */
export function render() {
    if (!postProcessing || !controls) return;
    controls.update();
    postProcessing.render();
}

/**
 * Get the post-processing instance.
 * @returns {THREE.PostProcessing|null}
 */
export function getPostProcessing() {
    return postProcessing;
}
