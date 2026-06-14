import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import GIF from 'gif.js';
import { ParticleSystem } from './ParticleSystem.js';

const vertexShaderPromise = fetch('/src/shaders/vertex.glsl').then(r => r.text());
const fragmentShaderPromise = fetch('/src/shaders/fragment.glsl').then(r => r.text());
const trailVertexShaderPromise = fetch('/src/shaders/trail_vertex.glsl').then(r => r.text());
const trailFragmentShaderPromise = fetch('/src/shaders/trail_fragment.glsl').then(r => r.text());

const params = {
  particleCount: 5000,
  gravityStrength: 15.0,
  repulsionStrength: 5.0,
  softening: 2.0,
  damping: 0.0,
  timeScale: 1.0,
  particleInteractionRange: 15.0,
  particleInteractionStrength: 0.0,

  galaxyRadius: 300,
  armCount: 4,
  armSpin: 1.5,
  centerBodyCount: 3,

  sizeMode: 0,
  minParticleSize: 1.0,
  maxParticleSize: 8.0,
  sizeAttenuation: true,

  colorMode: 3,
  colorA: '#4466ff',
  colorB: '#ff66cc',
  colorC: '#ffcc44',
  colorIntensity: 1.5,

  autoRotate: true,
  autoRotateSpeed: 0.15,

  background: '#000010',
  showBackgroundStars: true,

  showTrails: true,
  trailOpacity: 0.6,
  trailSizeFactor: 0.5,
  trailLength: 30,
  trailDecay: 2.0,
  trailFramerate: 30,
  speedInfluence: 1.0,

  isRecording: false,
  recordDuration: 5,
  recordFPS: 30,
  recordQuality: 10,
  exportGIF: () => startGIFRecording(),
  regenerate: () => regenerateGalaxy()
};

let shaders = null;
let trailShaders = null;
let scene, camera, renderer, controls;
let particleSystem, backgroundStars;
let clock, elapsedTime = 0;
let animating = true;
let gif = null;
let recordStartTime = 0;
let framesRecorded = 0;
let totalFramesNeeded = 0;
let recordingPaused = false;
let gui;
let cancelRecordingCtrl = null;
let recordProgressInterval = null;

async function init() {
  showLoading(true);

  const canvas = document.getElementById('galaxy-canvas');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.background);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );
  camera.position.set(0, 180, 450);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const gl = renderer.getContext();
  if (gl) {
    const canvasEl = gl.canvas;
    canvasEl.getContext('2d', { willReadFrequently: true });
  }

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 50;
  controls.maxDistance = 1500;
  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  const [vertexShader, fragmentShader, trailVertexShader, trailFragmentShader] = await Promise.all([
    vertexShaderPromise,
    fragmentShaderPromise,
    trailVertexShaderPromise,
    trailFragmentShaderPromise
  ]);
  shaders = { vertex: vertexShader, fragment: fragmentShader };
  trailShaders = { vertex: trailVertexShader, fragment: trailFragmentShader };

  createBackgroundStars();
  createGalaxy();
  createGUI();

  window.addEventListener('resize', onResize);

  clock = new THREE.Clock();
  animate();

  showLoading(false);
}

function createBackgroundStars() {
  if (backgroundStars) {
    scene.remove(backgroundStars);
    backgroundStars.geometry.dispose();
    backgroundStars.material.dispose();
  }

  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const r = 1500 + Math.random() * 1500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const brightness = 0.3 + Math.random() * 0.7;
    colors[i3] = brightness;
    colors[i3 + 1] = brightness;
    colors[i3 + 2] = brightness * (0.9 + Math.random() * 0.1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  backgroundStars = new THREE.Points(geometry, material);
  if (params.showBackgroundStars) {
    scene.add(backgroundStars);
  }
}

function createGalaxy() {
  if (particleSystem) {
    if (particleSystem.trailPoints) {
      scene.remove(particleSystem.trailPoints);
    }
    scene.remove(particleSystem.points);
    particleSystem.dispose();
  }

  particleSystem = new ParticleSystem(params.particleCount, params, shaders, trailShaders);
  scene.add(particleSystem.points);
  if (particleSystem.trailPoints) {
    scene.add(particleSystem.trailPoints);
  }
}

function regenerateGalaxy() {
  if (params.isRecording) {
    stopGIFRecording(true);
  }
  showLoading(true);
  setTimeout(() => {
    createGalaxy();
    showLoading(false);
  }, 50);
}

function createGUI() {
  gui = new GUI({ title: '🌌 星系控制面板', width: 320 });

  const physicsFolder = gui.addFolder('⚛️ 物理参数');
  physicsFolder.add(params, 'gravityStrength', 0.1, 100, 0.1).name('引力强度');
  physicsFolder.add(params, 'repulsionStrength', 0, 50, 0.1).name('排斥系数');
  physicsFolder.add(params, 'softening', 0.1, 20, 0.1).name('软化因子');
  physicsFolder.add(params, 'damping', 0, 0.5, 0.001).name('阻尼系数');
  physicsFolder.add(params, 'timeScale', 0, 3, 0.01).name('时间缩放');
  physicsFolder.add(params, 'particleInteractionRange', 0, 50, 0.5).name('粒子作用范围');
  physicsFolder.add(params, 'particleInteractionStrength', 0, 10, 0.1).name('粒子作用强度');

  const galaxyFolder = gui.addFolder('🌀 星系结构');
  galaxyFolder.add(params, 'particleCount', 500, 30000, 500).name('粒子数量').onFinishChange(regenerateGalaxy);
  galaxyFolder.add(params, 'galaxyRadius', 50, 800, 10).name('星系半径').onFinishChange(regenerateGalaxy);
  galaxyFolder.add(params, 'armCount', 1, 8, 1).name('旋臂数量').onFinishChange(regenerateGalaxy);
  galaxyFolder.add(params, 'armSpin', 0, 5, 0.1).name('旋臂缠绕').onFinishChange(regenerateGalaxy);
  galaxyFolder.add(params, 'centerBodyCount', 0, 8, 1).name('核心体数量').onFinishChange(regenerateGalaxy);
  galaxyFolder.add(params, 'regenerate').name('🔄 重新生成');

  const visualFolder = gui.addFolder('🎨 视觉效果');

  visualFolder.add(params, 'sizeMode', {
    '按质量': 0,
    '按速度': 1,
    '按距离': 2
  }).name('大小模式');
  visualFolder.add(params, 'minParticleSize', 0.1, 10, 0.1).name('最小尺寸');
  visualFolder.add(params, 'maxParticleSize', 1, 30, 0.5).name('最大尺寸');
  visualFolder.add(params, 'sizeAttenuation').name('距离衰减');

  visualFolder.add(params, 'colorMode', {
    '按速度渐变': 0,
    '按质量渐变': 1,
    '彩虹漩涡': 2,
    '星系分层': 3
  }).name('颜色模式');
  visualFolder.addColor(params, 'colorA').name('颜色 A(外)');
  visualFolder.addColor(params, 'colorB').name('颜色 B(中)');
  visualFolder.addColor(params, 'colorC').name('颜色 C(核)');
  visualFolder.add(params, 'colorIntensity', 0.1, 5, 0.1).name('颜色强度');

  visualFolder.add(params, 'showTrails').name('粒子拖尾');
  visualFolder.add(params, 'trailLength', 5, 60, 1).name('拖尾长度').onFinishChange(regenerateGalaxy);
  visualFolder.add(params, 'trailOpacity', 0.0, 1.0, 0.05).name('拖尾透明度');
  visualFolder.add(params, 'trailSizeFactor', 0.1, 1.5, 0.05).name('拖尾大小');
  visualFolder.add(params, 'trailDecay', 0.5, 5.0, 0.1).name('拖尾衰减');
  visualFolder.add(params, 'trailFramerate', 10, 60, 1).name('拖尾帧率');
  visualFolder.add(params, 'speedInfluence', 0.0, 3.0, 0.1).name('速度影响');

  const sceneFolder = gui.addFolder('🌆 场景设置');
  sceneFolder.addColor(params, 'background').name('背景颜色').onChange(v => {
    scene.background = new THREE.Color(v);
  });
  sceneFolder.add(params, 'showBackgroundStars').name('背景星空').onChange(v => {
    backgroundStars.visible = v;
  });

  const cameraFolder = gui.addFolder('📷 相机控制');
  cameraFolder.add(params, 'autoRotate').name('自动旋转').onChange(v => {
    controls.autoRotate = v;
  });
  cameraFolder.add(params, 'autoRotateSpeed', -2, 2, 0.01).name('旋转速度').onChange(v => {
    controls.autoRotateSpeed = v;
  });

  const exportFolder = gui.addFolder('📤 导出');
  exportFolder.add(params, 'recordDuration', 1, 30, 1).name('录制时长(秒)');
  exportFolder.add(params, 'recordFPS', 10, 60, 1).name('帧率(FPS)');
  exportFolder.add(params, 'recordQuality', 1, 20, 1).name('质量(1=最佳)');
  exportFolder.add(params, 'exportGIF').name('🎬 导出 GIF');

  gui.add({ toggleAnimation: () => {
    if (params.isRecording) {
      recordingPaused = !recordingPaused;
      updateRecordingIndicator();
    } else {
      animating = !animating;
    }
  }}, 'toggleAnimation').name('⏯️ 暂停/继续');

  cancelRecordingCtrl = gui.add({ cancelRecording: () => {
    if (params.isRecording) {
      stopGIFRecording(true);
    }
  }}, 'cancelRecording').name('❌ 取消录制');
  cancelRecordingCtrl.domElement.parentElement.style.display = 'none';
}

function updateRecordingIndicator() {
  const indicator = document.getElementById('recording-indicator');
  if (!indicator) return;

  if (params.isRecording) {
    indicator.classList.remove('hidden');
    const progress = Math.min(100, (framesRecorded / totalFramesNeeded) * 100);
    const statusText = recordingPaused ? '已暂停' : '录制中';
    indicator.innerHTML = `
      <span class="rec-dot" style="animation: ${recordingPaused ? 'none' : 'pulse 1s ease-in-out infinite'}"></span>
      <span>${statusText} ${progress.toFixed(0)}%</span>
    `;
  } else {
    indicator.classList.add('hidden');
  }
}

async function startGIFRecording() {
  if (params.isRecording) return;

  try {
    const canvas = renderer.domElement;
    const width = canvas.width;
    const height = canvas.height;

    totalFramesNeeded = params.recordDuration * params.recordFPS;
    framesRecorded = 0;
    recordingPaused = false;

    gif = new GIF({
      workers: 4,
      quality: params.recordQuality,
      width: width,
      height: height,
      workerScript: 'https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js'
    });

    gif.on('start', () => {
      params.isRecording = true;
      recordStartTime = elapsedTime;
      updateRecordingIndicator();

      if (cancelRecordingCtrl) {
        cancelRecordingCtrl.domElement.parentElement.style.display = '';
      }
    });

    gif.on('progress', (p) => {
      const indicator = document.getElementById('recording-indicator');
      if (indicator) {
        indicator.innerHTML = `
          <span class="rec-dot"></span>
          <span>编码中 ${(p * 100).toFixed(0)}%</span>
        `;
      }
    });

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `galaxy-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      stopGIFRecording(false);
    });

    gif.on('error', (error) => {
      console.error('GIF录制错误:', error);
      alert('GIF录制失败: ' + error.message);
      stopGIFRecording(true);
    });

    gif.render();

    if (recordProgressInterval) clearInterval(recordProgressInterval);
    recordProgressInterval = setInterval(updateRecordingIndicator, 200);

  } catch (error) {
    console.error('启动GIF录制失败:', error);
    alert('启动GIF录制失败: ' + error.message);
    stopGIFRecording(true);
  }
}

function stopGIFRecording(cancelled = false) {
  if (recordProgressInterval) {
    clearInterval(recordProgressInterval);
    recordProgressInterval = null;
  }

  if (gif && !cancelled && framesRecorded > 0) {
    try {
      gif.render();
    } catch (e) {
      console.error('GIF渲染失败:', e);
    }
  } else if (gif && cancelled) {
    try {
      gif.abort();
    } catch (e) {}
  }

  gif = null;
  params.isRecording = false;
  recordingPaused = false;
  framesRecorded = 0;
  totalFramesNeeded = 0;

  if (cancelRecordingCtrl) {
    cancelRecordingCtrl.domElement.parentElement.style.display = 'none';
  }

  updateRecordingIndicator();
}

let frameAccumulator = 0;
const recordInterval = 1 / params.recordFPS;

function addFrameToGIF() {
  if (!gif || !params.isRecording || recordingPaused) return;

  frameAccumulator += clock.getDelta();

  if (frameAccumulator >= recordInterval) {
    frameAccumulator = 0;

    try {
      const canvas = renderer.domElement;
      gif.addFrame(canvas, { copy: true, delay: recordInterval * 1000 });
      framesRecorded++;
      updateRecordingIndicator();

      if (framesRecorded >= totalFramesNeeded) {
        stopGIFRecording(false);
      }
    } catch (error) {
      console.error('添加帧失败:', error);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (!clock) return;

  const deltaTime = clock.getDelta();

  if (animating && !recordingPaused) {
    elapsedTime += deltaTime;
    if (particleSystem) {
      particleSystem.updatePhysics(deltaTime, params);
    }
  }

  controls.update();

  if (particleSystem) {
    const cameraDistance = camera.position.length();
    particleSystem.updateUniforms(elapsedTime, cameraDistance, params);
  }

  if (backgroundStars && params.showBackgroundStars) {
    backgroundStars.rotation.y += deltaTime * 0.01;
  }

  try {
    renderer.render(scene, camera);
  } catch (e) {
    console.error('渲染错误:', e);
  }

  if (params.isRecording) {
    addFrameToGIF();
  }
}

function onResize() {
  if (params.isRecording) {
    stopGIFRecording(true);
  }
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

init();
