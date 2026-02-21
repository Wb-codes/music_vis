import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { 
    atan, cos, float, max, min, mix, PI, PI2, sin, vec2, vec3, vec4, color, 
    Fn, hash, hue, If, instanceIndex, Loop, mx_fractal_noise_float, 
    mx_fractal_noise_vec3, pass, pcurve, storage, deltaTime, time, uv, 
    uniform, step 
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";

let camera, scene, renderer, postProcessing, controls, light;
let updateParticles, spawnParticles;
let linksVerticesSBA, linksColorsSBA;
let bloomPass;
let clock = new THREE.Clock();
let elapsedTime = 0;

const nbParticles = Math.pow(2, 13);

// Base parameters
const timeScale = uniform(1.0);
const particleLifetime = uniform(0.5);
const particleSize = uniform(1.0);
const linksWidth = uniform(0.005);
const colorOffset = uniform(0.0);
const colorVariance = uniform(2.0);
const colorRotationSpeed = uniform(1.0);
const spawnIndex = uniform(0);
const nbToSpawn = uniform(5);
const spawnPosition = uniform(vec3(0.0));
const previousSpawnPosition = uniform(vec3(0.0));
const turbFrequency = uniform(0.5);
const turbAmplitude = uniform(0.5);
const turbOctaves = uniform(2);
const turbLacunarity = uniform(2.0);
const turbGain = uniform(0.5);
const turbFriction = uniform(0.01);

// Audio data
const audioBass = uniform(0.0);
const audioMid = uniform(0.0);
const audioHigh = uniform(0.0);
const audioOverall = uniform(0.0);

// Audio sensitivity settings (multipliers for how much each frequency affects parameters)
const settings = {
    // Bass controls
    bassSpawnRate: { value: 50, min: 0, max: 200, label: "Bass -> Spawn Rate" },
    bassRadius: { value: 3, min: 0, max: 10, label: "Bass -> Orbit Radius" },
    bassPush: { value: 0.02, min: 0, max: 0.1, label: "Bass -> Push Force" },
    
    // Mid controls  
    midTurbulence: { value: 2, min: 0, max: 5, label: "Mid -> Turbulence" },
    midFrequency: { value: 0.5, min: 0, max: 2, label: "Mid -> Turb Frequency" },
    midSpeed: { value: 0.5, min: 0, max: 2, label: "Mid -> Orbit Speed" },
    
    // High controls
    highSize: { value: 2, min: 0, max: 5, label: "High -> Particle Size" },
    highColorSpeed: { value: 3, min: 0, max: 10, label: "High -> Color Speed" },
    
    // Overall controls
    overallLifetime: { value: 0.5, min: 0, max: 1, label: "Overall -> Lifetime" },
    
    // Audio sensitivity
    bassSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Bass Sensitivity" },
    midSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Mid Sensitivity" },
    highSensitivity: { value: 1.5, min: 0.1, max: 5, label: "High Sensitivity" },
    
    // Base values
    baseSpawnRate: { value: 5, min: 1, max: 50, label: "Base Spawn Rate" },
    baseTurbulence: { value: 0.5, min: 0, max: 2, label: "Base Turbulence" },
    baseSize: { value: 1, min: 0.1, max: 3, label: "Base Size" },
    baseRadius: { value: 2, min: 0.5, max: 5, label: "Base Orbit Radius" },
    
    // Bloom
    bloomStrength: { value: 0.75, min: 0, max: 3, label: "Bloom Strength" },
    bloomThreshold: { value: 0.1, min: 0, max: 2, label: "Bloom Threshold" },
    bloomRadius: { value: 0.5, min: 0, max: 1, label: "Bloom Radius" },
    
    // Controls
    autoRotate: { value: true, label: "Auto Rotate" },
    autoRotateSpeed: { value: 2, min: -10, max: 10, label: "Rotate Speed" }
};

let audioContext, analyser, dataArray;

async function initAudio() {
    try {
        const statusEl = document.getElementById('audio-status');
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        stream.getVideoTracks().forEach(t => t.stop());
        
        if (!audioTrack) {
            statusEl.textContent = 'Audio: No track';
            statusEl.className = 'error';
            return false;
        }

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        statusEl.textContent = 'Audio: Active';
        statusEl.className = 'active';
        return true;
    } catch (err) {
        console.error('Audio error:', err);
        document.getElementById('audio-status').textContent = 'Audio: ' + err.message;
        document.getElementById('audio-status').className = 'error';
        return false;
    }
}

function updateAudioData() {
    if (!analyser || !dataArray) return;
    analyser.getByteFrequencyData(dataArray);
    const len = dataArray.length;
    const bassEnd = Math.floor(len * 0.08);
    const midEnd = Math.floor(len * 0.4);
    
    let bassSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < len; i++) {
        const val = dataArray[i] / 255;
        if (i < bassEnd) bassSum += val;
        else if (i < midEnd) midSum += val;
        else highSum += val;
    }
    
    const bassNorm = (bassSum / bassEnd);
    const midNorm = (midSum / (midEnd - bassEnd));
    const highNorm = (highSum / (len - midEnd));
    
    audioBass.value = Math.min(bassNorm * settings.bassSensitivity.value, 1);
    audioMid.value = Math.min(midNorm * settings.midSensitivity.value, 1);
    audioHigh.value = Math.min(highNorm * settings.highSensitivity.value, 1);
    audioOverall.value = (audioBass.value + audioMid.value + audioHigh.value) / 3;
}

function createGUI() {
    const container = document.getElementById('controls');
    const toggleBtn = document.getElementById('toggle-controls');
    
    toggleBtn.classList.add('visible');
    toggleBtn.onclick = () => {
        container.classList.toggle('visible');
        toggleBtn.textContent = container.classList.contains('visible') ? 'Hide' : 'Settings';
    };
    
    function createFolder(name) {
        const folder = document.createElement('div');
        folder.className = 'folder open';
        
        const h3 = document.createElement('h3');
        h3.textContent = name + ' ▼';
        h3.onclick = () => {
            folder.classList.toggle('open');
            h3.textContent = name + (folder.classList.contains('open') ? ' ▼' : ' ▶');
        };
        
        const content = document.createElement('div');
        content.className = 'folder-content';
        
        folder.appendChild(h3);
        folder.appendChild(content);
        return { folder, content };
    }
    
    function addSlider(container, key, isBoolean = false) {
        const s = settings[key];
        const row = document.createElement('div');
        row.className = 'control-row';
        
        const label = document.createElement('label');
        label.textContent = s.label;
        
        if (isBoolean) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = s.value;
            checkbox.onchange = () => { s.value = checkbox.checked; };
            row.appendChild(label);
            row.appendChild(checkbox);
        } else {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = s.min;
            input.max = s.max;
            input.step = (s.max - s.min) / 100;
            input.value = s.value;
            
            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'value';
            valueDisplay.textContent = s.value.toFixed(2);
            
            input.oninput = () => {
                s.value = parseFloat(input.value);
                valueDisplay.textContent = s.value.toFixed(2);
            };
            
            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(valueDisplay);
        }
        
        container.appendChild(row);
    }
    
    // Bass folder
    const bassFolder = createFolder('Bass Response');
    addSlider(bassFolder.content, 'bassSensitivity');
    addSlider(bassFolder.content, 'bassSpawnRate');
    addSlider(bassFolder.content, 'bassRadius');
    addSlider(bassFolder.content, 'bassPush');
    container.appendChild(bassFolder.folder);
    
    // Mid folder
    const midFolder = createFolder('Mid Response');
    addSlider(midFolder.content, 'midSensitivity');
    addSlider(midFolder.content, 'midTurbulence');
    addSlider(midFolder.content, 'midFrequency');
    addSlider(midFolder.content, 'midSpeed');
    container.appendChild(midFolder.folder);
    
    // High folder
    const highFolder = createFolder('High Response');
    addSlider(highFolder.content, 'highSensitivity');
    addSlider(highFolder.content, 'highSize');
    addSlider(highFolder.content, 'highColorSpeed');
    container.appendChild(highFolder.folder);
    
    // Overall folder
    const overallFolder = createFolder('Overall');
    addSlider(overallFolder.content, 'overallLifetime');
    container.appendChild(overallFolder.folder);
    
    // Base Values folder
    const baseFolder = createFolder('Base Values');
    addSlider(baseFolder.content, 'baseSpawnRate');
    addSlider(baseFolder.content, 'baseTurbulence');
    addSlider(baseFolder.content, 'baseSize');
    addSlider(baseFolder.content, 'baseRadius');
    container.appendChild(baseFolder.folder);
    
    // Bloom folder
    const bloomFolder = createFolder('Bloom');
    addSlider(bloomFolder.content, 'bloomStrength');
    addSlider(bloomFolder.content, 'bloomThreshold');
    addSlider(bloomFolder.content, 'bloomRadius');
    container.appendChild(bloomFolder.folder);
    
    // Controls folder
    const ctrlFolder = createFolder('Camera');
    addSlider(ctrlFolder.content, 'autoRotate', true);
    addSlider(ctrlFolder.content, 'autoRotateSpeed');
    container.appendChild(ctrlFolder.folder);
    
    container.classList.add('visible');
    toggleBtn.textContent = 'Hide';
}

async function init() {
    if (!WebGPU.isAvailable()) {
        document.body.appendChild(WebGPU.getErrorMessage());
        throw new Error('No WebGPU support');
    }

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 10);
    scene = new THREE.Scene();

    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setClearColor(0x14171a);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);
    await renderer.init();

    // Buffers
    const particlePositionsBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particleVelocitiesBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particlePositions = storage(particlePositionsBuffer, 'vec4', nbParticles);
    const particleVelocities = storage(particleVelocitiesBuffer, 'vec4', nbParticles);

    const nbVertices = nbParticles * 8;
    linksVerticesSBA = new THREE.StorageBufferAttribute(nbVertices, 4);
    linksColorsSBA = new THREE.StorageBufferAttribute(nbVertices, 4);

    // Color function
    const getInstanceColor = Fn(([i]) => {
        return hue(color(0x0000ff), colorOffset.add(mx_fractal_noise_float(i.toFloat().mul(.1), 2, 2.0, 0.5, colorVariance)));
    });

    // Particle material
    const particleGeom = new THREE.PlaneGeometry(0.05, 0.05);
    const particleMaterial = new THREE.SpriteNodeMaterial();
    particleMaterial.blending = THREE.AdditiveBlending;
    particleMaterial.depthWrite = false;
    particleMaterial.positionNode = particlePositions.toAttribute();
    particleMaterial.scaleNode = vec2(particleSize);
    particleMaterial.rotationNode = atan(particleVelocities.toAttribute().y, particleVelocities.toAttribute().x);
    particleMaterial.colorNode = Fn(() => {
        const life = particlePositions.toAttribute().w;
        const modLife = pcurve(life.oneMinus(), 8.0, 1.0);
        const pulse = pcurve(sin(hash(instanceIndex).mul(PI2).add(time.mul(0.5).mul(PI2))).mul(0.5).add(0.5), 0.25, 0.25).mul(10.0).add(1.0);
        return getInstanceColor(instanceIndex).mul(pulse.mul(modLife));
    })();
    particleMaterial.opacityNode = Fn(() => {
        const circle = step(uv().xy.sub(0.5).length(), 0.5);
        const life = particlePositions.toAttribute().w;
        return circle.mul(life);
    })();

    const particleMesh = new THREE.InstancedMesh(particleGeom, particleMaterial, nbParticles);
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    // Links geometry
    const linksIndices = [];
    for (let i = 0; i < nbParticles; i++) {
        const baseIndex = i * 8;
        for (let j = 0; j < 2; j++) {
            const offset = baseIndex + j * 4;
            linksIndices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        }
    }
    const linksGeom = new THREE.BufferGeometry();
    linksGeom.setAttribute('position', linksVerticesSBA);
    linksGeom.setAttribute('color', linksColorsSBA);
    linksGeom.setIndex(linksIndices);

    const linksMaterial = new THREE.MeshBasicNodeMaterial();
    linksMaterial.vertexColors = true;
    linksMaterial.side = THREE.DoubleSide;
    linksMaterial.transparent = true;
    linksMaterial.depthWrite = false;
    linksMaterial.depthTest = false;
    linksMaterial.blending = THREE.AdditiveBlending;
    linksMaterial.opacityNode = storage(linksColorsSBA, 'vec4', nbVertices).toAttribute().w;

    const linksMesh = new THREE.Mesh(linksGeom, linksMaterial);
    linksMesh.frustumCulled = false;
    scene.add(linksMesh);

    // Compute shaders
    updateParticles = Fn(() => {
        const position = particlePositions.element(instanceIndex).xyz;
        const life = particlePositions.element(instanceIndex).w;
        const velocity = particleVelocities.element(instanceIndex).xyz;
        const dt = deltaTime.mul(0.1).mul(timeScale);

        If(life.greaterThan(0.0), () => {
            const localVel = mx_fractal_noise_vec3(position.mul(turbFrequency), turbOctaves, turbLacunarity, turbGain, turbAmplitude).mul(life.add(.01));
            velocity.addAssign(localVel);
            velocity.mulAssign(turbFriction.oneMinus());
            position.addAssign(velocity.mul(dt));
            life.subAssign(dt.mul(particleLifetime.reciprocal()));

            const closestDist1 = float(10000.0).toVar();
            const closestPos1 = vec3(0.0).toVar();
            const closestLife1 = float(0.0).toVar();
            const closestDist2 = float(10000.0).toVar();
            const closestPos2 = vec3(0.0).toVar();
            const closestLife2 = float(0.0).toVar();

            Loop(nbParticles, ({ i }) => {
                const otherPart = particlePositions.element(i);
                If(i.notEqual(instanceIndex).and(otherPart.w.greaterThan(0.0)), () => {
                    const otherPosition = otherPart.xyz;
                    const dist = position.sub(otherPosition).lengthSq();
                    const moreThanZero = dist.greaterThan(0.0);
                    If(dist.lessThan(closestDist1).and(moreThanZero), () => {
                        closestDist1.assign(dist);
                        closestPos1.assign(otherPosition.xyz);
                        closestLife1.assign(otherPart.w);
                    }).ElseIf(dist.lessThan(closestDist2).and(moreThanZero), () => {
                        closestDist2.assign(dist);
                        closestPos2.assign(otherPosition.xyz);
                        closestLife2.assign(otherPart.w);
                    });
                });
            });

            const linksPositions = storage(linksVerticesSBA, 'vec4', nbVertices);
            const linksColors = storage(linksColorsSBA, 'vec4', nbVertices);
            const firstLinkIndex = instanceIndex.mul(8);
            const secondLinkIndex = firstLinkIndex.add(4);

            linksPositions.element(firstLinkIndex).xyz.assign(position);
            linksPositions.element(firstLinkIndex).y.addAssign(linksWidth);
            linksPositions.element(firstLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(firstLinkIndex.add(1)).y.addAssign(linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(2)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(2)).y.addAssign(linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(3)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(3)).y.addAssign(linksWidth);

            linksPositions.element(secondLinkIndex).xyz.assign(position);
            linksPositions.element(secondLinkIndex).y.addAssign(linksWidth);
            linksPositions.element(secondLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(secondLinkIndex.add(1)).y.addAssign(linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(2)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(2)).y.addAssign(linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(3)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(3)).y.addAssign(linksWidth);

            const linkColor = getInstanceColor(instanceIndex);
            const l1 = max(0.0, min(closestLife1, life)).pow(0.8);
            const l2 = max(0.0, min(closestLife2, life)).pow(0.8);

            Loop(4, ({ i }) => {
                linksColors.element(firstLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(firstLinkIndex.add(i)).w.assign(l1);
                linksColors.element(secondLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(secondLinkIndex.add(i)).w.assign(l2);
            });
        });
    })().compute(nbParticles);

    spawnParticles = Fn(() => {
        const particleIndex = spawnIndex.add(instanceIndex).mod(nbParticles).toInt();
        const position = particlePositions.element(particleIndex).xyz;
        const life = particlePositions.element(particleIndex).w;
        const velocity = particleVelocities.element(particleIndex).xyz;

        life.assign(1.0);
        const rRange = float(0.01);
        const rTheta = hash(particleIndex).mul(PI2);
        const rPhi = hash(particleIndex.add(1)).mul(PI);
        const rx = sin(rTheta).mul(cos(rPhi));
        const ry = sin(rTheta).mul(sin(rPhi));
        const rz = cos(rTheta);
        const rDir = vec3(rx, ry, rz);
        const pos = mix(previousSpawnPosition, spawnPosition, instanceIndex.toFloat().div(nbToSpawn.sub(1).toFloat()).clamp());
        position.assign(pos.add(rDir.mul(rRange)));
        velocity.assign(rDir.mul(5.0));
    })().compute(nbToSpawn.value);

    // Init particles
    renderer.compute(Fn(() => {
        particlePositions.element(instanceIndex).xyz.assign(vec3(10000.0));
        particlePositions.element(instanceIndex).w.assign(float(-1.0));
    })().compute(nbParticles));

    // Background
    const backgroundGeom = new THREE.IcosahedronGeometry(100, 5).applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    const backgroundMaterial = new THREE.MeshStandardNodeMaterial();
    backgroundMaterial.roughness = 0.4;
    backgroundMaterial.metalness = 0.9;
    backgroundMaterial.flatShading = true;
    backgroundMaterial.colorNode = color(0x0);
    scene.add(new THREE.Mesh(backgroundGeom, backgroundMaterial));

    light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);

    // Post processing
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode('output');
    bloomPass = bloom(scenePassColor, settings.bloomStrength.value, settings.bloomThreshold.value, settings.bloomRadius.value);
    postProcessing = new THREE.PostProcessing(renderer, scenePassColor.add(bloomPass));

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = settings.autoRotate.value;
    controls.autoRotateSpeed = settings.autoRotateSpeed.value;
    controls.maxDistance = 75;

    window.addEventListener('resize', onWindowResize);
    
    createGUI();
    renderer.setAnimationLoop(animate);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const delta = clock.getDelta();
    elapsedTime += delta;

    updateAudioData();

    const bass = audioBass.value;
    const mid = audioMid.value;
    const high = audioHigh.value;
    const overall = audioOverall.value;

    // Apply audio-reactive parameters based on settings
    nbToSpawn.value = Math.floor(settings.baseSpawnRate.value + bass * settings.bassSpawnRate.value);
    turbAmplitude.value = settings.baseTurbulence.value + mid * settings.midTurbulence.value;
    turbFrequency.value = 0.5 + mid * settings.midFrequency.value;
    particleSize.value = settings.baseSize.value + high * settings.highSize.value;
    colorRotationSpeed.value = 1.0 + high * settings.highColorSpeed.value;
    particleLifetime.value = 0.5 + (1 - overall * settings.overallLifetime.value) * 0.5;

    // Update bloom settings
    bloomPass.strength.value = settings.bloomStrength.value;
    bloomPass.threshold.value = settings.bloomThreshold.value;
    bloomPass.radius.value = settings.bloomRadius.value;

    // Update controls
    controls.autoRotate = settings.autoRotate.value;
    controls.autoRotateSpeed = settings.autoRotateSpeed.value;

    renderer.compute(updateParticles);
    renderer.compute(spawnParticles);

    spawnIndex.value = (spawnIndex.value + nbToSpawn.value) % nbParticles;

    // Spawn position with audio-reactive orbit
    const radius = settings.baseRadius.value + bass * settings.bassRadius.value;
    const speed = 0.5 + mid * settings.midSpeed.value;
    const targetPos = new THREE.Vector3(
        Math.sin(elapsedTime * speed) * radius,
        Math.cos(elapsedTime * speed * 1.3) * radius * 0.5,
        Math.sin(elapsedTime * speed * 0.7) * radius
    );
    
    previousSpawnPosition.value.copy(spawnPosition.value);
    spawnPosition.value.lerp(targetPos, 0.1);

    colorOffset.value += delta * colorRotationSpeed.value * timeScale.value;

    light.position.set(
        Math.sin(elapsedTime * 0.5) * 30,
        Math.cos(elapsedTime * 0.3) * 30,
        Math.sin(elapsedTime * 0.2) * 30
    );

    controls.update();
    postProcessing.render();
}

document.getElementById('start-overlay').addEventListener('click', async () => {
    document.getElementById('start-overlay').style.display = 'none';
    await initAudio();
    await init();
});
