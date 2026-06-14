import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import { ParticleSystem } from './ParticleSystem.js';

let CCapture = null;

const vertexShaderPromise = fetch('/src/shaders/vertex.glsl').then(r => r.text());
const fragmentShaderPromise = fetch('/src/shaders/fragment.glsl').then(r => r.text());

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

  isRecording: false,
  recordDuration: 5,
  exportGIF: () => startGIFRecording(),
  regenerate: () => regenerateGalaxy()
};

let shaders = null;
let scene, camera, renderer, controls;
let particleSystem, backgroundStars;
let clock, elapsedTime = 0;
let animating = true;
let capturer = null;
let recordStartTime = 0;
let gui;

async function loadCCapture() {
  if (CCapture) return CCapture;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/ccapture.js@1.1.0/build/CCapture.all.min.js';
    script.onload = () => {
      CCapture = window.CCapture;
      resolve(CCapture);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

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
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 50;
  controls.maxDistance = 1500;
  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = params.autoRotateSpeed;

  const [vertexShader, fragmentShader] = await Promise.all([
    vertexShaderPromise,
    fragmentShaderPromise
  ]);
  shaders = { vertex: vertexShader, fragment: fragmentShader };

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
    scene.remove(particleSystem.points);
    particleSystem.dispose();
  }

  particleSystem = new ParticleSystem(params.particleCount, params, shaders);
  scene.add(particleSystem.points);
}

function regenerateGalaxy() {
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
  exportFolder.add(params, 'exportGIF').name('🎬 导出 GIF');

  gui.add({ toggleAnimation: () => {
    animating = !animating;
  }}, 'toggleAnimation').name('⏯️ 暂停/继续');
}

async function startGIFRecording() {
  if (params.isRecording) return;

  try {
    await loadCCapture();
  } catch (e) {
    alert('GIF录制组件加载失败，请检查网络连接');
    return;
  }

  params.isRecording = true;
  recordStartTime = elapsedTime;
  showRecordingIndicator(true);

  capturer = new CCapture({
    format: 'gif',
    framerate: 30,
    verbose: false,
    quality: 100,
    name: `galaxy-${Date.now()}`
  });

  capturer.start();
}

function stopGIFRecording() {
  if (!capturer || !params.isRecording) return;

  capturer.stop();
  capturer.save();
  capturer = null;
  params.isRecording = false;
  showRecordingIndicator(false);
}

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  if (animating) {
    elapsedTime += deltaTime;
    if (particleSystem) {
      particleSystem.updatePhysics(deltaTime, params);
    }

    if (params.isRecording) {
      if (elapsedTime - recordStartTime >= params.recordDuration) {
        stopGIFRecording();
      }
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

  renderer.render(scene, camera);

  if (params.isRecording && capturer) {
    capturer.capture(renderer.domElement);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function showRecordingIndicator(show) {
  const el = document.getElementById('recording-indicator');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

init();
