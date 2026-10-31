// One shader for the whole paper stage, so a frame is a single sorted draw call.
// Modes: 0 paper piece, 1 limb strip, 2 drop shadow, 3 sky / vertex colour, 4 floor blob shadow,
// 5 emissive (additive, through premultiplied alpha 0), 6 face texture, 7 particle (a soft disc or a streak:
// params.z 1 = additive, params.w 1 = streak; colour straight, not premultiplied).

export const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aUVL;      // texture: u, v, layer · strip: stripe colour
layout(location=2) in vec4 aColor;    // tint, or the strip / sky / shadow colour (premultiplied)
layout(location=3) in vec4 aParams;   // mode, lit, dof (strip: stripe duty), strip stripe period (cm)
layout(location=4) in vec2 aLocal;    // strip: along (cm), across (-1..1) · blob: -1..1
uniform mat4 uVP;
out vec3 vUVL; out vec4 vColor; out vec4 vParams; out vec2 vLocal; out vec3 vWorld;
void main() {
  vUVL = aUVL; vColor = aColor; vParams = aParams; vLocal = aLocal; vWorld = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vUVL; in vec4 vColor; in vec4 vParams; in vec2 vLocal; in vec3 vWorld;
uniform sampler2DArray uAtlas;
uniform sampler2DArray uFaces;
uniform vec3 uCam;
uniform vec3 uAmb;
uniform vec3 uKey;
uniform vec4 uLightPos[4];   // xyz, radius (0 = off)
uniform vec4 uLightCol[4];   // rgb, intensity
uniform vec4 uHaze;          // rgb, density per metre
uniform vec2 uFocus;         // focus distance (m), mip bias per metre away from it
uniform float uGrain;
uniform float uGlow;
uniform float uDim;
out vec4 frag;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 lightAt(vec3 albedo, float lit) {
  vec3 l = uAmb + uKey;
  for (int i = 0; i < 4; i++) {
    float r = uLightPos[i].w;
    if (r <= 0.0) continue;
    float d = distance(vWorld, uLightPos[i].xyz);
    float f = clamp(1.0 - d / r, 0.0, 1.0);
    l += uLightCol[i].rgb * uLightCol[i].a * f * f;
  }
  return albedo * mix(vec3(1.0), l, lit);
}

void main() {
  int mode = int(vParams.x + 0.5);
  float lit = vParams.y, dof = vParams.z;
  float depth = distance(vWorld, uCam);
  float bias = dof * clamp(abs(depth - uFocus.x) * uFocus.y, 0.0, 2.4);
  if (mode == 7) { // a particle: rain, steam, breath, a spark
    float a = vParams.w > 0.5
      ? (1.0 - smoothstep(0.3, 1.0, abs(vLocal.x))) * (1.0 - smoothstep(0.5, 1.0, abs(vLocal.y)))
      : 1.0 - smoothstep(0.15, 1.0, length(vLocal));
    a *= vColor.a;
    if (a <= 0.002) discard;
    if (vParams.z > 0.5) { frag = vec4(vColor.rgb * a * uDim, 0.0); return; }
    vec3 rgb = lightAt(vColor.rgb, lit);
    rgb = mix(rgb, uHaze.rgb, (1.0 - exp(-depth * uHaze.w)) * lit);
    frag = vec4(rgb * a * uDim, a); return;
  }
  if (mode == 2) { // a soft drop shadow: the piece's alpha from a small mip
    float a = texture(uAtlas, vUVL, 3.0 + bias).a * vColor.a;
    frag = vec4(vColor.rgb * a * uDim, a); return;
  }
  if (mode == 4) {
    float a = (1.0 - smoothstep(0.25, 1.0, length(vLocal))) * vColor.a;
    frag = vec4(vColor.rgb * a * uDim, a); return;
  }
  vec4 c; vec2 grainAt;
  if (mode == 0 || mode == 5) { c = texture(uAtlas, vUVL, bias) * vColor; grainAt = vUVL.xy * 1100.0; }
  else if (mode == 6) { c = texture(uFaces, vUVL, bias * 0.5) * vColor; grainAt = vUVL.xy * 260.0; }
  else if (mode == 1) {
    float t = abs(vLocal.y), aa = max(fwidth(vLocal.y) * 1.2, 0.003);
    float a = 1.0 - smoothstep(1.0 - aa, 1.0, t);
    vec3 col = vColor.rgb;
    if (vParams.w > 0.0) col = mix(col, vUVL, step(fract(vLocal.x / vParams.w), vParams.z));
    float rim = smoothstep(0.80 - aa, 0.80, t);
    col = mix(col, mix(col, vec3(1.0, 0.97, 0.92), 0.5), rim);
    col *= 1.0 - 0.07 * smoothstep(-0.2, 0.9, vLocal.y);   // the band turns from the light
    c = vec4(col * a, a); grainAt = vLocal * vec2(4.0, 30.0);
  }
  else { c = vColor; grainAt = gl_FragCoord.xy; }
  if (c.a <= 0.002) discard;
  if (mode == 5) { frag = vec4(c.rgb * uGlow * uDim, 0.0); return; }
  vec3 rgb = lightAt(c.rgb / c.a, lit);
  rgb = mix(rgb, uHaze.rgb, (1.0 - exp(-depth * uHaze.w)) * lit);
  rgb *= 1.0 + (hash(floor(grainAt)) - 0.5) * uGrain;
  frag = vec4(rgb * c.a * uDim, c.a);
}`;
