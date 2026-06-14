import * as THREE from 'three';

const DEFAULT_TRAIL_LENGTH = 30;

export class ParticleSystem {
  constructor(count, params, shaders, trailShaders) {
    this.count = count;
    this.params = params;
    this.shaders = shaders;
    this.trailShaders = trailShaders;
    this.positions = null;
    this.velocities = null;
    this.masses = null;
    this.colors = null;
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.centerBodies = [];

    this.trailLength = DEFAULT_TRAIL_LENGTH;
    this.trailPositions = null;
    this.trailHead = 0;
    this.trailFilled = false;
    this.trailFrameCount = 0;
    this.trailGeometry = null;
    this.trailMaterial = null;
    this.trailPoints = null;
    this.trailPositionAttr = null;
    this.trailAgeAttr = null;
    this.trailMassAttr = null;
    this.trailSpeedAttr = null;
    this.trailVelocityAttr = null;
    this.trailIndexAttr = null;

    this.trailRecordAccumulator = 0;
    this.trailRecordInterval = 1 / 30;

    this.init();
  }

  init() {
    this.createCenterBodies();
    this.createParticleData();
    this.createGeometry();
    this.createMaterial();
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.createTrailSystem();
  }

  createCenterBodies() {
    const centerCount = this.params.centerBodyCount || 3;
    this.centerBodies = [];

    for (let i = 0; i < centerCount; i++) {
      const angle = (i / centerCount) * Math.PI * 2;
      const radius = this.params.galaxyRadius * 0.15;
      this.centerBodies.push({
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * radius * 0.3,
          Math.sin(angle) * radius
        ),
        velocity: new THREE.Vector3(
          -Math.sin(angle) * 0.5,
          0,
          Math.cos(angle) * 0.5
        ),
        mass: 500 + Math.random() * 1000
      });
    }
  }

  createParticleData() {
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.masses = new Float32Array(this.count);

    const galaxyRadius = this.params.galaxyRadius;
    const armCount = this.params.armCount || 4;
    const armSpin = this.params.armSpin || 1.5;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      const arm = i % armCount;
      const armAngle = (arm / armCount) * Math.PI * 2;

      const r = Math.pow(Math.random(), 0.5) * galaxyRadius;
      const spinAngle = armAngle + (r / galaxyRadius) * armSpin * Math.PI * 2;
      const spread = (1 - r / galaxyRadius) * 0.5 + 0.1;

      const x = Math.cos(spinAngle) * r + (Math.random() - 0.5) * r * spread;
      const z = Math.sin(spinAngle) * r + (Math.random() - 0.5) * r * spread;
      const y = (Math.random() - 0.5) * galaxyRadius * 0.05 * (1 - r / galaxyRadius * 0.7);

      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;

      const dist = Math.sqrt(x * x + y * y + z * z) || 1;
      const orbitalSpeed = Math.sqrt(this.params.gravityStrength * 200 / dist) * 0.15;

      const tangentX = -z / dist;
      const tangentZ = x / dist;

      const speedVariation = 0.8 + Math.random() * 0.4;

      this.velocities[i3] = tangentX * orbitalSpeed * speedVariation + (Math.random() - 0.5) * 0.2;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
      this.velocities[i3 + 2] = tangentZ * orbitalSpeed * speedVariation + (Math.random() - 0.5) * 0.2;

      this.masses[i] = 0.3 + Math.random() * Math.random() * 2.5;
    }
  }

  createGeometry() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
    this.geometry.setAttribute('aMass', new THREE.BufferAttribute(this.masses, 1));
    this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(new Float32Array(this.count), 1));
  }

  createMaterial() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSizeAttenuation: { value: 1.0 },
        uMinSize: { value: this.params.minParticleSize },
        uMaxSize: { value: this.params.maxParticleSize },
        uCameraDistance: { value: 500 },
        uSizeMode: { value: this.params.sizeMode },
        uColorMode: { value: this.params.colorMode },
        uColorA: { value: new THREE.Color(this.params.colorA) },
        uColorB: { value: new THREE.Color(this.params.colorB) },
        uColorC: { value: new THREE.Color(this.params.colorC) },
        uColorIntensity: { value: this.params.colorIntensity },
        uGalaxyRadius: { value: this.params.galaxyRadius }
      },
      vertexShader: this.shaders.vertex,
      fragmentShader: this.shaders.fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  createTrailSystem() {
    this.trailLength = this.params.trailLength || DEFAULT_TRAIL_LENGTH;
    this.trailPositions = new Float32Array(this.trailLength * this.count * 3);
    this.trailVelocities = new Float32Array(this.trailLength * this.count * 3);
    this.trailHead = 0;
    this.trailFilled = false;
    this.trailFrameCount = 0;
    this.trailRecordAccumulator = 0;
    this.trailRecordInterval = 1 / (this.params.trailFramerate || 30);

    for (let f = 0; f < this.trailLength; f++) {
      const frameOffset = f * this.count * 3;
      this.trailPositions.set(this.positions, frameOffset);
      this.trailVelocities.set(this.velocities, frameOffset);
    }

    const totalTrailPoints = this.count * this.trailLength;
    const trailPosArr = new Float32Array(totalTrailPoints * 3);
    const trailAgeArr = new Float32Array(totalTrailPoints);
    const trailMassArr = new Float32Array(totalTrailPoints);
    const trailSpeedArr = new Float32Array(totalTrailPoints);
    const trailVelocityArr = new Float32Array(totalTrailPoints * 3);
    const trailIndexArr = new Float32Array(totalTrailPoints);

    for (let i = 0; i < this.count; i++) {
      const mass = this.masses[i];
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];
      const vx = this.velocities[i * 3];
      const vy = this.velocities[i * 3 + 1];
      const vz = this.velocities[i * 3 + 2];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

      for (let j = 0; j < this.trailLength; j++) {
        const idx = i * this.trailLength + j;
        trailPosArr[idx * 3] = px;
        trailPosArr[idx * 3 + 1] = py;
        trailPosArr[idx * 3 + 2] = pz;
        trailAgeArr[idx] = j / (this.trailLength - 1);
        trailMassArr[idx] = mass;
        trailSpeedArr[idx] = speed;
        trailVelocityArr[idx * 3] = vx;
        trailVelocityArr[idx * 3 + 1] = vy;
        trailVelocityArr[idx * 3 + 2] = vz;
        trailIndexArr[idx] = j;
      }
    }

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailPositionAttr = new THREE.BufferAttribute(trailPosArr, 3);
    this.trailAgeAttr = new THREE.BufferAttribute(trailAgeArr, 1);
    this.trailMassAttr = new THREE.BufferAttribute(trailMassArr, 1);
    this.trailSpeedAttr = new THREE.BufferAttribute(trailSpeedArr, 1);
    this.trailVelocityAttr = new THREE.BufferAttribute(trailVelocityArr, 3);
    this.trailIndexAttr = new THREE.BufferAttribute(trailIndexArr, 1);

    this.trailGeometry.setAttribute('position', this.trailPositionAttr);
    this.trailGeometry.setAttribute('aTrailAge', this.trailAgeAttr);
    this.trailGeometry.setAttribute('aMass', this.trailMassAttr);
    this.trailGeometry.setAttribute('aSpeed', this.trailSpeedAttr);
    this.trailGeometry.setAttribute('aVelocity', this.trailVelocityAttr);
    this.trailGeometry.setAttribute('aTrailIndex', this.trailIndexAttr);

    this.trailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSizeAttenuation: { value: 1.0 },
        uMinSize: { value: this.params.minParticleSize },
        uMaxSize: { value: this.params.maxParticleSize },
        uCameraDistance: { value: 500 },
        uSizeMode: { value: this.params.sizeMode },
        uColorMode: { value: this.params.colorMode },
        uColorA: { value: new THREE.Color(this.params.colorA) },
        uColorB: { value: new THREE.Color(this.params.colorB) },
        uColorC: { value: new THREE.Color(this.params.colorC) },
        uColorIntensity: { value: this.params.colorIntensity },
        uGalaxyRadius: { value: this.params.galaxyRadius },
        uTrailOpacity: { value: this.params.trailOpacity ?? 0.6 },
        uTrailSizeFactor: { value: this.params.trailSizeFactor ?? 0.5 },
        uTrailLength: { value: this.trailLength },
        uTrailDecay: { value: this.params.trailDecay ?? 2.0 },
        uSpeedInfluence: { value: this.params.speedInfluence ?? 1.0 }
      },
      vertexShader: this.trailShaders.vertex,
      fragmentShader: this.trailShaders.fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.trailPoints = new THREE.Points(this.trailGeometry, this.trailMaterial);
    this.trailPoints.frustumCulled = false;
    this.trailPoints.visible = this.params.showTrails ?? true;
  }

  recordTrailFrame() {
    const frameOffset = this.trailHead * this.count * 3;
    this.trailPositions.set(this.positions, frameOffset);
    this.trailVelocities.set(this.velocities, frameOffset);
    this.trailHead = (this.trailHead + 1) % this.trailLength;
    this.trailFrameCount++;
    if (this.trailFrameCount >= this.trailLength) {
      this.trailFilled = true;
    }
  }

  updateTrailGeometry() {
    const activeLength = this.trailFilled ? this.trailLength : Math.min(this.trailFrameCount, this.trailLength);
    if (activeLength <= 0) return;

    const posArr = this.trailPositionAttr.array;
    const ageArr = this.trailAgeAttr.array;
    const massArr = this.trailMassAttr.array;
    const speedArr = this.trailSpeedAttr.array;
    const velocityArr = this.trailVelocityAttr.array;
    const indexArr = this.trailIndexAttr.array;
    const baseSpeedArr = this.geometry.attributes.aSpeed.array;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const mass = this.masses[i];
      const currentSpeed = baseSpeedArr[i];

      for (let j = 0; j < activeLength; j++) {
        const frameIdx = ((this.trailHead - 1 - j + this.trailLength) % this.trailLength);
        const srcOffset = frameIdx * this.count * 3 + i3;
        const dstIdx = i * this.trailLength + j;
        const dst3 = dstIdx * 3;

        posArr[dst3] = this.trailPositions[srcOffset];
        posArr[dst3 + 1] = this.trailPositions[srcOffset + 1];
        posArr[dst3 + 2] = this.trailPositions[srcOffset + 2];

        velocityArr[dst3] = this.trailVelocities[srcOffset];
        velocityArr[dst3 + 1] = this.trailVelocities[srcOffset + 1];
        velocityArr[dst3 + 2] = this.trailVelocities[srcOffset + 2];

        ageArr[dstIdx] = j / (this.trailLength - 1);
        massArr[dstIdx] = mass;
        speedArr[dstIdx] = currentSpeed;
        indexArr[dstIdx] = j;
      }

      if (activeLength < this.trailLength) {
        const lastAge = (activeLength - 1) / (this.trailLength - 1);
        const firstFrameIdx = (this.trailHead - 1 + this.trailLength) % this.trailLength;
        const firstOffset = firstFrameIdx * this.count * 3 + i3;
        const firstX = this.trailPositions[firstOffset];
        const firstY = this.trailPositions[firstOffset + 1];
        const firstZ = this.trailPositions[firstOffset + 2];
        const firstVx = this.trailVelocities[firstOffset];
        const firstVy = this.trailVelocities[firstOffset + 1];
        const firstVz = this.trailVelocities[firstOffset + 2];

        for (let j = activeLength; j < this.trailLength; j++) {
          const dstIdx = i * this.trailLength + j;
          const dst3 = dstIdx * 3;
          posArr[dst3] = firstX;
          posArr[dst3 + 1] = firstY;
          posArr[dst3 + 2] = firstZ;
          velocityArr[dst3] = firstVx;
          velocityArr[dst3 + 1] = firstVy;
          velocityArr[dst3 + 2] = firstVz;
          ageArr[dstIdx] = lastAge;
          massArr[dstIdx] = mass;
          speedArr[dstIdx] = currentSpeed;
          indexArr[dstIdx] = j;
        }
      }
    }

    this.trailPositionAttr.needsUpdate = true;
    this.trailAgeAttr.needsUpdate = true;
    this.trailMassAttr.needsUpdate = true;
    this.trailSpeedAttr.needsUpdate = true;
    this.trailVelocityAttr.needsUpdate = true;
    this.trailIndexAttr.needsUpdate = true;
  }

  updatePhysics(deltaTime, params) {
    const dt = Math.min(deltaTime, 0.033) * params.timeScale;
    const gravity = params.gravityStrength;
    const softening = params.softening;
    const repulsion = params.repulsionStrength;
    const damping = params.damping;

    for (let i = 0; i < this.centerBodies.length; i++) {
      const body = this.centerBodies[i];
      for (let j = i + 1; j < this.centerBodies.length; j++) {
        const other = this.centerBodies[j];
        const dx = other.position.x - body.position.x;
        const dy = other.position.y - body.position.y;
        const dz = other.position.z - body.position.z;
        const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
        const dist = Math.sqrt(distSq);
        const force = gravity * body.mass * other.mass / distSq;
        const fx = force * dx / dist;
        const fy = force * dy / dist;
        const fz = force * dz / dist;

        body.velocity.x += fx / body.mass * dt;
        body.velocity.y += fy / body.mass * dt;
        body.velocity.z += fz / body.mass * dt;
        other.velocity.x -= fx / other.mass * dt;
        other.velocity.y -= fy / other.mass * dt;
        other.velocity.z -= fz / other.mass * dt;
      }
    }

    for (const body of this.centerBodies) {
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;
    }

    const particleInteractionRange = params.particleInteractionRange;
    const particleInteractionStrength = params.particleInteractionStrength;
    const gridSize = 8;
    const cellSize = particleInteractionRange;
    const grid = new Map();

    if (particleInteractionStrength > 0) {
      for (let i = 0; i < this.count; i++) {
        const i3 = i * 3;
        const gx = Math.floor(this.positions[i3] / cellSize);
        const gy = Math.floor(this.positions[i3 + 1] / cellSize);
        const gz = Math.floor(this.positions[i3 + 2] / cellSize);
        const key = `${gx},${gy},${gz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
    }

    const positions = this.positions;
    const velocities = this.velocities;
    const masses = this.masses;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      let ax = 0, ay = 0, az = 0;

      for (const body of this.centerBodies) {
        const dx = body.position.x - positions[i3];
        const dy = body.position.y - positions[i3 + 1];
        const dz = body.position.z - positions[i3 + 2];
        const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
        const dist = Math.sqrt(distSq);
        const force = gravity * body.mass / distSq;
        ax += force * dx / dist;
        ay += force * dy / dist;
        az += force * dz / dist;

        if (dist < 2.0) {
          const repelForce = repulsion * (2.0 - dist) / dist;
          ax -= dx * repelForce;
          ay -= dy * repelForce;
          az -= dz * repelForce;
        }
      }

      if (particleInteractionStrength > 0) {
        const gx = Math.floor(positions[i3] / cellSize);
        const gy = Math.floor(positions[i3 + 1] / cellSize);
        const gz = Math.floor(positions[i3 + 2] / cellSize);

        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let oz = -1; oz <= 1; oz++) {
              const key = `${gx + ox},${gy + oy},${gz + oz}`;
              const cell = grid.get(key);
              if (!cell) continue;

              for (const j of cell) {
                if (j === i) continue;
                const j3 = j * 3;
                const dx = positions[j3] - positions[i3];
                const dy = positions[j3 + 1] - positions[i3 + 1];
                const dz = positions[j3 + 2] - positions[i3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < particleInteractionRange * particleInteractionRange) {
                  const dist = Math.sqrt(distSq) + 0.1;
                  const force = particleInteractionStrength * masses[j] / (distSq + 0.5);
                  ax += force * dx / dist * 0.01;
                  ay += force * dy / dist * 0.01;
                  az += force * dz / dist * 0.01;
                }
              }
            }
          }
        }
      }

      velocities[i3] += ax * dt;
      velocities[i3 + 1] += ay * dt;
      velocities[i3 + 2] += az * dt;

      velocities[i3] *= (1 - damping * dt);
      velocities[i3 + 1] *= (1 - damping * dt);
      velocities[i3 + 2] *= (1 - damping * dt);

      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      const distFromCenter = Math.sqrt(
        positions[i3] * positions[i3] +
        positions[i3 + 1] * positions[i3 + 1] +
        positions[i3 + 2] * positions[i3 + 2]
      );

      const maxDist = params.galaxyRadius * 2.5;
      if (distFromCenter > maxDist) {
        const scale = maxDist / distFromCenter;
        positions[i3] *= scale;
        positions[i3 + 1] *= scale;
        positions[i3 + 2] *= scale;

        const dot = (velocities[i3] * positions[i3] +
                     velocities[i3 + 1] * positions[i3 + 1] +
                     velocities[i3 + 2] * positions[i3 + 2]) / (maxDist * maxDist);
        velocities[i3] -= 2 * dot * positions[i3] * 0.8;
        velocities[i3 + 1] -= 2 * dot * positions[i3 + 1] * 0.8;
        velocities[i3 + 2] -= 2 * dot * positions[i3 + 2] * 0.8;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aVelocity.needsUpdate = true;

    const speedAttr = this.geometry.attributes.aSpeed;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      speedAttr.array[i] = Math.sqrt(
        velocities[i3] * velocities[i3] +
        velocities[i3 + 1] * velocities[i3 + 1] +
        velocities[i3 + 2] * velocities[i3 + 2]
      );
    }
    speedAttr.needsUpdate = true;

    if (params.showTrails !== false) {
      this.trailRecordAccumulator += dt;
      const recordInterval = 1 / (params.trailFramerate || 30);
      while (this.trailRecordAccumulator >= recordInterval) {
        this.trailRecordAccumulator -= recordInterval;
        this.recordTrailFrame();
      }
      this.updateTrailGeometry();
    }
  }

  updateUniforms(time, cameraDistance, params) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraDistance.value = cameraDistance;
    this.material.uniforms.uSizeMode.value = params.sizeMode;
    this.material.uniforms.uColorMode.value = params.colorMode;
    this.material.uniforms.uColorIntensity.value = params.colorIntensity;
    this.material.uniforms.uMinSize.value = params.minParticleSize;
    this.material.uniforms.uMaxSize.value = params.maxParticleSize;
    this.material.uniforms.uGalaxyRadius.value = params.galaxyRadius;
    this.material.uniforms.uSizeAttenuation.value = params.sizeAttenuation ? 1.0 : 0.0;
    this.material.uniforms.uColorA.value.set(params.colorA);
    this.material.uniforms.uColorB.value.set(params.colorB);
    this.material.uniforms.uColorC.value.set(params.colorC);

    if (this.trailMaterial) {
      this.trailMaterial.uniforms.uTime.value = time;
      this.trailMaterial.uniforms.uCameraDistance.value = cameraDistance;
      this.trailMaterial.uniforms.uSizeMode.value = params.sizeMode;
      this.trailMaterial.uniforms.uColorMode.value = params.colorMode;
      this.trailMaterial.uniforms.uColorIntensity.value = params.colorIntensity;
      this.trailMaterial.uniforms.uMinSize.value = params.minParticleSize;
      this.trailMaterial.uniforms.uMaxSize.value = params.maxParticleSize;
      this.trailMaterial.uniforms.uGalaxyRadius.value = params.galaxyRadius;
      this.trailMaterial.uniforms.uSizeAttenuation.value = params.sizeAttenuation ? 1.0 : 0.0;
      this.trailMaterial.uniforms.uColorA.value.set(params.colorA);
      this.trailMaterial.uniforms.uColorB.value.set(params.colorB);
      this.trailMaterial.uniforms.uColorC.value.set(params.colorC);
      this.trailMaterial.uniforms.uTrailOpacity.value = params.trailOpacity ?? 0.6;
      this.trailMaterial.uniforms.uTrailSizeFactor.value = params.trailSizeFactor ?? 0.5;
      this.trailMaterial.uniforms.uTrailLength.value = this.trailLength;
      this.trailMaterial.uniforms.uTrailDecay.value = params.trailDecay ?? 2.0;
      this.trailMaterial.uniforms.uSpeedInfluence.value = params.speedInfluence ?? 1.0;
    }

    if (this.trailPoints) {
      this.trailPoints.visible = params.showTrails !== false;
    }
  }

  reset(count, params, shaders, trailShaders) {
    this.count = count;
    this.params = params;
    if (shaders) this.shaders = shaders;
    if (trailShaders) this.trailShaders = trailShaders;
    this.points.geometry.dispose();
    this.points.material.dispose();

    if (this.trailPoints) {
      this.trailPoints.geometry.dispose();
      this.trailPoints.material.dispose();
    }

    this.createCenterBodies();
    this.createParticleData();
    this.createGeometry();
    this.createMaterial();
    this.points.geometry = this.geometry;
    this.points.material = this.material;
    this.createTrailSystem();
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.trailGeometry) this.trailGeometry.dispose();
    if (this.trailMaterial) this.trailMaterial.dispose();
  }
}
