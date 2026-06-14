attribute float aTrailAge;
attribute float aMass;
attribute float aSpeed;
attribute vec3 aVelocity;
attribute float aTrailIndex;

uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeAttenuation;
uniform float uMinSize;
uniform float uMaxSize;
uniform float uCameraDistance;
uniform int uSizeMode;
uniform float uTrailSizeFactor;
uniform float uTrailLength;
uniform float uTrailDecay;
uniform float uSpeedInfluence;

varying float vMass;
varying float vSpeed;
varying vec3 vPosition;
varying float vDistance;
varying float vTrailAge;
varying float vTrailIndex;
varying vec3 vVelocity;

void main() {
  vMass = aMass;
  vSpeed = aSpeed;
  vPosition = position;
  vTrailAge = aTrailAge;
  vTrailIndex = aTrailIndex;
  vVelocity = aVelocity;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDistance = -mvPosition.z;

  float baseSize = aMass * 2.0 + 1.0;

  if (uSizeMode == 0) {
    baseSize = aMass * 3.0 + uMinSize;
  } else if (uSizeMode == 1) {
    float speedFactor = clamp(vSpeed * 0.5, 0.0, 1.0);
    baseSize = mix(uMinSize, uMaxSize, speedFactor);
  } else if (uSizeMode == 2) {
    float distFactor = 1.0 - clamp(vDistance / uCameraDistance, 0.0, 1.0);
    baseSize = mix(uMinSize * 0.5, uMaxSize, distFactor);
  }

  float ageFade = 1.0 - aTrailAge;
  ageFade = pow(ageFade, uTrailDecay);

  float speedFactor = clamp(aSpeed * 0.3 * uSpeedInfluence, 0.0, 1.0);
  float sizeBoost = 1.0 + speedFactor * 0.5;

  float particleSize = baseSize * ageFade * uTrailSizeFactor * sizeBoost;

  if (uSizeAttenuation > 0.5) {
    gl_PointSize = particleSize * uPixelRatio * (300.0 / vDistance);
  } else {
    gl_PointSize = particleSize * uPixelRatio;
  }

  gl_PointSize = max(gl_PointSize, 0.5);

  gl_Position = projectionMatrix * mvPosition;
}
