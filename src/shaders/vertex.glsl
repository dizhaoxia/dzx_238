attribute float aMass;
attribute float aSpeed;
attribute vec3 aVelocity;

uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeAttenuation;
uniform float uMinSize;
uniform float uMaxSize;
uniform float uCameraDistance;
uniform int uSizeMode;

varying float vMass;
varying float vSpeed;
varying vec3 vPosition;
varying float vDistance;

void main() {
  vMass = aMass;
  vSpeed = length(aVelocity);
  vPosition = position;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDistance = -mvPosition.z;

  float particleSize = aMass * 2.0 + 1.0;

  if (uSizeMode == 0) {
    particleSize = aMass * 3.0 + uMinSize;
  } else if (uSizeMode == 1) {
    float speedFactor = clamp(vSpeed * 0.5, 0.0, 1.0);
    particleSize = mix(uMinSize, uMaxSize, speedFactor);
  } else if (uSizeMode == 2) {
    float distFactor = 1.0 - clamp(vDistance / uCameraDistance, 0.0, 1.0);
    particleSize = mix(uMinSize * 0.5, uMaxSize, distFactor);
  }

  if (uSizeAttenuation > 0.5) {
    gl_PointSize = particleSize * uPixelRatio * (300.0 / vDistance);
  } else {
    gl_PointSize = particleSize * uPixelRatio;
  }

  gl_Position = projectionMatrix * mvPosition;
}
