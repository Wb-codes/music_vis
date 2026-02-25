/**
 * @module scenes/points
 * @description Instanced points scene with audio-reactive hilbert curve visualization.
 * Points flow along 3D Hilbert curve paths with pulsing animation and radial displacement.
 * Supports multiple curves at different scales.
 */

import * as THREE from 'three/webgpu';
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js';
import {
  color, storage, Fn, instancedBufferAttribute, instanceIndex, sin, time, float, uniform,
  shapeCircle, mix, vec3, normalize, add, positionLocal
} from 'three/tsl';

import { calculateAudioMagnitude, createSmoothedAudioTracker } from '../audio/reactive.js';

/**
 * Points scene state and configuration.
 * @type {Object}
 */
export const pointsScene = {
  /** @type {THREE.Scene|null} */
  scene: null,
  /** @type {Array<Object>} */
  curveSystems: [],
  /** @type {THREE.PointLight|null} */
  light: null,
  /** @type {THREE.Mesh|null} */
  backgroundMesh: null,

  // === Uniforms ===
  /** @type {import('three/tsl').UniformNode} */
  pulseSpeed: uniform(1),
  /** @type {import('three/tsl').UniformNode} */
  baseSize: uniform(8),
  /** @type {import('three/tsl').UniformNode} */
  audioSizeBoost: uniform(0),
  /** @type {import('three/tsl').UniformNode} */
  sizeRandomness: uniform(0.5),
  /** @type {import('three/tsl').UniformNode} */
  displacementAmount: uniform(0),
  /** @type {import('three/tsl').UniformNode} */
  rotationSpeed: uniform(0.1),
  /** @type {import('three/tsl').UniformNode} */
  waveSpeed: uniform(0.5),
  /** @type {import('three/tsl').UniformNode} */
  waveLength: uniform(30),
  /** @type {number} */
  targetCurveCount: 1,

  // === Audio Tracking ===
  audioTracker: createSmoothedAudioTracker(0.08),
  currentRotation: 0,
};

/**
 * Create a single Hilbert curve system
 * @param {number} scale - Scale of the curve
 * @param {number} index - Curve index for color variation
 * @returns {Object} Curve system data
 */
function createCurveSystem(scale, index) {
  const points = GeometryUtils.hilbert3D(new THREE.Vector3(0, 0, 0), scale, 1, 0, 1, 2, 3, 4, 5, 6, 7);
  const spline = new THREE.CatmullRomCurve3(points);
  const divisions = Math.round(6 * points.length);

  const position = new THREE.Vector3();
  const pointColor = new THREE.Color();

  const positions = [];
  const colors = [];
  const sizes = new Float32Array(divisions);
  const basePositions = [];

  for (let i = 0; i < divisions; i++) {
    const t = i / divisions;
    spline.getPoint(t, position);
    
    // Store base position for displacement
    basePositions.push(position.x, position.y, position.z);
    positions.push(position.x, position.y, position.z);

    // Color gradient along the curve with variation per curve
    const hue = (t + (index * 0.2)) % 1.0;
    pointColor.setHSL(hue, 1.0, 0.5, THREE.SRGBColorSpace);
    colors.push(pointColor.r, pointColor.g, pointColor.b);

    sizes[i] = 4.0;
  }

  // Create storage buffers
  const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(positions), 3);
  const colorsAttribute = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
  
  const instanceSizeBufferAttribute = new THREE.StorageInstancedBufferAttribute(sizes, 1);
  const instanceSizeStorage = storage(instanceSizeBufferAttribute, 'float', instanceSizeBufferAttribute.count);
  
  const basePositionsArray = new Float32Array(basePositions);
  const basePositionsBufferAttribute = new THREE.StorageInstancedBufferAttribute(basePositionsArray, 3);
  const basePositionsStorage = storage(basePositionsBufferAttribute, 'vec3', basePositionsBufferAttribute.count);
  
  const displacementArray = new Float32Array(divisions * 3);
  const displacementBufferAttribute = new THREE.StorageInstancedBufferAttribute(displacementArray, 3);
  const displacementStorage = storage(displacementBufferAttribute, 'vec3', displacementBufferAttribute.count);

  // Create compute shader
  const computeNodes = Fn(() => {
    const idx = instanceIndex;
    const t = float(idx).div(float(divisions));
    
    // === TRAVELING WAVE along the curve ===
    // Wave position moves along the curve based on time and speed
    const wavePosition = time.mul(pointsScene.waveSpeed).mod(1);
    const waveLength = pointsScene.waveLength.div(100); // Normalize 0-100 to 0-1
    
    // Distance from current point to wave position (absolute, no wrap needed with mod)
    const dist = t.sub(wavePosition).abs();
    
    // Gaussian wave shape - creates a smooth "snake" of lit points
    // Points closer to wave position get bigger
    // Slower wave with smoother falloff
    const waveWidth = float(0.08).add(waveLength.mul(float(0.5))); // 0.08 to 0.58 - wider and smoother
    const normalizedDist = dist.div(waveWidth);
    // Gaussian falloff: e^(-x^2) for much smoother transitions
    const squareDist = normalizedDist.mul(normalizedDist);
    const negSquareDist = float(0).sub(squareDist); // -x^2
    const waveValue = negSquareDist.exp(); // Gaussian bell curve
    const clampedWave = waveValue;
    
    // Traveling wave adds to pulse
    const pulsePhase = time.mul(pointsScene.pulseSpeed).add(t.mul(10).add(float(index).mul(3)));
    const pulseValue = sin(pulsePhase).mul(0.5).add(0.5);
    
    // Calculate size: base + pulse + traveling wave + audio boost
    const base = pointsScene.baseSize;
    const pulseAdd = pulseValue.mul(2); // Pulse adds up to 2
    const waveAdd = clampedWave.mul(12); // Wave adds up to 12 - bigger waves
    
    // SLOW smooth randomness
    const slowTime = time.mul(0.02);
    const randomSeed = slowTime.add(float(index).mul(0.5)).add(idx.mul(0.005));
    const randomWave1 = sin(randomSeed.mul(10));
    const randomWave2 = sin(randomSeed.mul(7).add(1));
    const randomWave3 = sin(randomSeed.mul(3).add(2));
    const combinedWaves = randomWave1.add(randomWave2).add(randomWave3).div(3);
    const randomValue = combinedWaves.mul(0.5).add(0.5);
    
    const randomnessFactor = pointsScene.sizeRandomness;
    const randomMultiplier = randomValue.mul(randomnessFactor).add(float(1).sub(randomnessFactor));
    
    const audioAdd = pointsScene.audioSizeBoost.mul(randomMultiplier);
    const finalSize = base.add(pulseAdd).add(waveAdd).add(audioAdd);
    
    instanceSizeStorage.element(idx).assign(finalSize);
    
    // Calculate radial displacement
    const basePos = basePositionsStorage.element(idx);
    const radialDir = normalize(basePos);
    const displacement = radialDir.mul(pointsScene.displacementAmount);
    
    displacementStorage.element(idx).assign(displacement);
  })().compute(divisions);

  // Create material
  const attributeRange = instancedBufferAttribute(instanceSizeBufferAttribute);
  const pointColors = mix(
    vec3(0.0), 
    instancedBufferAttribute(colorsAttribute), 
    attributeRange.div(float(20))
  );

  const material = new THREE.PointsNodeMaterial({
    colorNode: pointColors,
    opacityNode: shapeCircle(),
    positionNode: add(
      instancedBufferAttribute(positionAttribute),
      displacementStorage.toAttribute()
    ),
    sizeNode: instancedBufferAttribute(instanceSizeBufferAttribute),
    vertexColors: true,
    sizeAttenuation: false,
    alphaToCoverage: true
  });

  const instancedPoints = new THREE.Sprite(material);
  instancedPoints.count = divisions;

  return {
    mesh: instancedPoints,
    computeNodes,
    divisions,
    scale,
    index
  };
}

/**
 * Initialize the instanced points scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initPointsScene(renderer, camera, controls) {
  const scene = new THREE.Scene();

  // Create initial curve system
  const curveScales = [25.0, 18.0, 12.0, 8.0, 5.0];
  
  for (let i = 0; i < 5; i++) {
    const curveSystem = createCurveSystem(curveScales[i], i);
    pointsScene.curveSystems.push(curveSystem);
    scene.add(curveSystem.mesh);
  }

  // === Background ===
  const backgroundGeom = new THREE.IcosahedronGeometry(100, 5).applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const backgroundMaterial = new THREE.MeshStandardNodeMaterial();
  backgroundMaterial.roughness = 0.4;
  backgroundMaterial.metalness = 0.9;
  backgroundMaterial.flatShading = true;
  backgroundMaterial.colorNode = color(0x0);
  const backgroundMesh = new THREE.Mesh(backgroundGeom, backgroundMaterial);
  scene.add(backgroundMesh);

  // === Light ===
  const light = new THREE.PointLight(0xffffff, 3000);
  scene.add(light);
  pointsScene.light = light;

  // Store references
  pointsScene.scene = scene;
  pointsScene.backgroundMesh = backgroundMesh;

  // === Set Camera ===
  camera.position.set(-40, 0, 60);
  controls.target.set(0, 0, 0);
  controls.update();

  return scene;
}

/**
 * Update points scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {Object} audioData - Audio analysis data with bass, mid, high, overall
 */
export function updatePointsScene(delta, settings, renderer, audioData) {
  // Get smoothed audio values
  const smoothedAudio = pointsScene.audioTracker.update(audioData);
  const { bass, mid, high } = smoothedAudio;

  // === Calculate Audio-Reactive Values ===
  
  // Point Size - audio adds to base, doesn't scale it
  const sizeConfig = {
    intensity: settings.pointsSizeIntensity?.value ?? 50,
    bass: settings.pointsSizeBass?.value ?? 80,
    mid: settings.pointsSizeMid?.value ?? 40,
    high: settings.pointsSizeHigh?.value ?? 20
  };
  const sizeMagnitude = calculateAudioMagnitude(sizeConfig, smoothedAudio);
  // Size boost: 0 to 64 (magnitude 0-4 * 16)
  pointsScene.audioSizeBoost.value = sizeMagnitude * 16;
  
  // Size randomness - how varied the response is per point (0 = uniform, 1 = max random)
  pointsScene.sizeRandomness.value = 0.7;

  // Pulse Speed
  const pulseConfig = {
    intensity: settings.pointsPulseIntensity?.value ?? 30,
    bass: settings.pointsPulseBass?.value ?? 30,
    mid: settings.pointsPulseMid?.value ?? 20,
    high: settings.pointsPulseHigh?.value ?? 10
  };
  const pulseMagnitude = calculateAudioMagnitude(pulseConfig, smoothedAudio);
  pointsScene.pulseSpeed.value = 0.5 + (pulseMagnitude * 1.5);

  // Wave Speed - how fast the "snake" travels along the curve
  const waveConfig = {
    intensity: settings.pointsWaveSpeedIntensity?.value ?? 40,
    bass: settings.pointsWaveSpeedBass?.value ?? 70,
    mid: settings.pointsWaveSpeedMid?.value ?? 40,
    high: settings.pointsWaveSpeedHigh?.value ?? 20
  };
  const waveMagnitude = calculateAudioMagnitude(waveConfig, smoothedAudio);
  // Base 0.05, max 0.75 - travels 5% to 75% of curve per second
  // At 100% intensity with full audio, reaches maximum of 0.75
  pointsScene.waveSpeed.value = 0.05 + (waveMagnitude * 0.175);
  
  // Wave Length - how many points are in the chain
  pointsScene.waveLength.value = settings.pointsWaveLength?.value ?? 30;

  // Radial Displacement - intensity controls audio reactivity only
  // Base displacement is minimal (2), audio adds up to max based on intensity
  const displacementBase = 2; // Small default size when no audio
  const displacementIntensity = (settings.pointsDisplacementIntensity?.value ?? 30) / 100;
  const displacementBass = (settings.pointsDisplacementBass?.value ?? 100) / 100;
  const displacementMid = (settings.pointsDisplacementMid?.value ?? 50) / 100;
  const displacementHigh = (settings.pointsDisplacementHigh?.value ?? 20) / 100;
  
  // Audio contribution only (no intensity multiplier on base)
  const displacementAudioContribution = 
    (bass * displacementBass) + 
    (mid * displacementMid) + 
    (high * displacementHigh);
  
  // Total = base + (audio * intensity * maxBoost)
  const displacementMax = 20; // Maximum additional displacement
  pointsScene.displacementAmount.value = displacementBase + (displacementAudioContribution * displacementIntensity * displacementMax);

  // Rotation Speed
  const rotationConfig = {
    intensity: settings.pointsRotationIntensity?.value ?? 20,
    bass: settings.pointsRotationBass?.value ?? 40,
    mid: settings.pointsRotationMid?.value ?? 20,
    high: settings.pointsRotationHigh?.value ?? 10
  };
  const rotationMagnitude = calculateAudioMagnitude(rotationConfig, smoothedAudio);
  pointsScene.rotationSpeed.value = 0.1 + (rotationMagnitude * 0.3);

  // Curve Count - determines how many curves are visible
  const curveConfig = {
    intensity: settings.pointsCurveCountIntensity?.value ?? 30,
    bass: settings.pointsCurveCountBass?.value ?? 60,
    mid: settings.pointsCurveCountMid?.value ?? 30,
    high: settings.pointsCurveCountHigh?.value ?? 10
  };
  const curveMagnitude = calculateAudioMagnitude(curveConfig, smoothedAudio);
  const targetCount = Math.max(1, Math.min(5, Math.round(curveMagnitude * 2.5)));
  
  // Update curve visibility
  pointsScene.curveSystems.forEach((system, index) => {
    system.mesh.visible = index < targetCount;
  });

  // === Apply Rotation ===
  pointsScene.currentRotation += pointsScene.rotationSpeed.value * delta;
  if (pointsScene.scene) {
    pointsScene.scene.rotation.y = pointsScene.currentRotation;
  }

  // === Run Compute Shaders ===
  pointsScene.curveSystems.forEach(system => {
    if (system.mesh.visible) {
      renderer.compute(system.computeNodes);
    }
  });

  // === Green Screen Toggle ===
  if (pointsScene.backgroundMesh) {
    pointsScene.backgroundMesh.visible = !settings.greenScreen.value;
  }
  if (pointsScene.scene) {
    pointsScene.scene.background = settings.greenScreen.value
      ? new THREE.Color(0x007900)
      : null;
  }
}
