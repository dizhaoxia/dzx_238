uniform float uTime;
uniform int uColorMode;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uColorIntensity;
uniform float uGalaxyRadius;

varying float vMass;
varying float vSpeed;
varying vec3 vPosition;
varying float vDistance;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);

  if (dist > 0.5) discard;

  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha = pow(alpha, 1.5);

  vec3 color;

  if (uColorMode == 0) {
    float t = clamp(vSpeed * 0.3, 0.0, 1.0);
    if (t < 0.5) {
      color = mix(uColorA, uColorB, t * 2.0);
    } else {
      color = mix(uColorB, uColorC, (t - 0.5) * 2.0);
    }
  } else if (uColorMode == 1) {
    float t = clamp(vMass / 5.0, 0.0, 1.0);
    color = mix(uColorA, uColorC, t);
  } else if (uColorMode == 2) {
    float r = length(vPosition) / uGalaxyRadius;
    float theta = atan(vPosition.y, vPosition.x);
    float hue = fract(theta / 6.28318 + r * 0.5 + uTime * 0.05);
    color = hsv2rgb(vec3(hue, 0.8, 1.0));
  } else if (uColorMode == 3) {
    float r = length(vPosition) / uGalaxyRadius;
    float t = clamp(r, 0.0, 1.0);
    if (t < 0.33) {
      color = mix(uColorC, uColorB, t * 3.0);
    } else if (t < 0.66) {
      color = mix(uColorB, uColorA, (t - 0.33) * 3.0);
    } else {
      color = mix(uColorA, vec3(0.2, 0.3, 1.0), (t - 0.66) * 3.0);
    }
  }

  color *= uColorIntensity;

  float glow = exp(-dist * 4.0) * 0.5;
  color += glow * color;

  gl_FragColor = vec4(color, alpha);
}
