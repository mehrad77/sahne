// The WebGL2 side of the paper backend: one program, one dynamic vertex buffer, one draw call.
// The stage fills the buffer back to front each frame; nothing is drawn while nothing changes.

import { lookAt, mat4Mul, perspective, type Vec3 } from "../../core/math.ts";
import type { RGB } from "../../core/color.ts";
import { Atlas, FaceAtlas, type AtlasRect } from "./atlas.ts";
import { FRAG, VERT } from "./shaders.ts";
import { NEAR, FAR, type CamState } from "./camera.ts";
import type { LightState } from "./light.ts";

const FLOATS = 16; // pos3 uvl3 color4 params4 local2

export const MODE = { piece: 0, strip: 1, shadow: 2, flat: 3, blob: 4, glow: 5, face: 6, particle: 7 } as const;

export interface PointLight { pos: Vec3; color: RGB; intensity: number; radius: number }

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("sahne shader: " + gl.getShaderInfoLog(s));
  return s;
}

export interface RendererOptions {
  /** A canvas with an alpha channel, so a clear stage lets the page show through (see `transparent`). */
  alpha?: boolean;
}

export class PaperRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly alpha: boolean;
  atlas: Atlas;
  faces: FaceAtlas;
  /** Draw nothing behind the actors and clear to transparent (needs `alpha`). */
  transparent = false;
  /** The context is lost: nothing can be drawn until `onRestore` runs. */
  lost = false;
  /** The context was lost / came back. After a restore the atlases are empty: the stage fills them again. */
  onLost: (() => void) | null = null;
  onRestore: (() => void) | null = null;
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private buf!: WebGLBuffer;
  private data = new Float32Array(FLOATS * 6 * 2048);
  private n = 0;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private gone = false;

  /** Throws when WebGL2 or the shaders are not available: the stage catches it and runs without a renderer. */
  constructor(canvas: HTMLCanvasElement, o: RendererOptions = {}) {
    this.canvas = canvas; this.alpha = !!o.alpha;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: this.alpha, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) throw new Error("sahne: WebGL2 is not available");
    this.gl = gl;
    this.init();
    this.atlas = new Atlas(gl);
    this.faces = new FaceAtlas(gl, 1);
    canvas.addEventListener("webglcontextlost", this.onLoss);
    canvas.addEventListener("webglcontextrestored", this.onBack);
  }

  /** The program and buffers: made again after a lost context comes back. */
  private init() {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("sahne program: " + gl.getProgramInfoLog(p));
    this.prog = p;
    for (const name of ["uVP", "uAtlas", "uFaces", "uCam", "uAmb", "uKey", "uLightPos", "uLightCol", "uHaze", "uFocus", "uGrain", "uGlow", "uDim"]) this.u[name] = gl.getUniformLocation(p, name);
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const stride = FLOATS * 4;
    const attr = (loc: number, size: number, off: number) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4); };
    attr(0, 3, 0); attr(1, 3, 3); attr(2, 4, 6); attr(3, 4, 10); attr(4, 2, 14);
    gl.bindVertexArray(null);
  }

  // the browser may bring a lost context back only if the loss event is cancelled
  private onLoss = (e: Event) => { e.preventDefault(); this.lost = true; this.onLost?.(); };
  private onBack = () => {
    if (this.gone) return;
    this.lost = false;
    try { this.init(); } catch (err) { console.warn("sahne: could not restore the renderer", err); this.lost = true; return; }
    this.atlas = new Atlas(this.gl, this.atlas.size);
    this.faces = new FaceAtlas(this.gl, this.faces.count);
    this.onRestore?.();
  };

  /** Draw from `a` (packed and painted) from now on: the old atlas is freed first, then `a` is sent to the GPU, so the two are never there at once. */
  use(a: Atlas) { this.atlas.dispose(); this.atlas = a; a.send(); }

  /** Face slots for `count` actors, kept if there are enough already. */
  newFaces(count: number) {
    if (count === this.faces.count) return this.faces;
    this.faces.dispose(); this.faces = new FaceAtlas(this.gl, count);
    return this.faces;
  }

  /** GPU memory of the atlas and the faces, in bytes (an estimate: layers × size² × 4, a third more for mips). */
  get textureBytes() { return this.atlas.bytes + this.faces.bytes; }

  begin() { this.n = 0; }

  private grow() {
    const d = new Float32Array(this.data.length * 2); d.set(this.data); this.data = d;
  }

  vert(p: Vec3, uvl: Vec3, c: [number, number, number, number], params: [number, number, number, number], local: [number, number]) {
    if ((this.n + 1) * FLOATS > this.data.length) this.grow();
    const d = this.data, o = this.n * FLOATS;
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2];
    d[o + 3] = uvl[0]; d[o + 4] = uvl[1]; d[o + 5] = uvl[2];
    d[o + 6] = c[0]; d[o + 7] = c[1]; d[o + 8] = c[2]; d[o + 9] = c[3];
    d[o + 10] = params[0]; d[o + 11] = params[1]; d[o + 12] = params[2]; d[o + 13] = params[3];
    d[o + 14] = local[0]; d[o + 15] = local[1];
    this.n++;
  }

  /** A textured quad: corners in world space in the order (x0,y0) (x1,y0) (x1,y1) (x0,y1) of the rect. */
  quad(c: [Vec3, Vec3, Vec3, Vec3], r: AtlasRect | { layer: number; u0: number; v0: number; u1: number; v1: number }, mode: number, lit: number, dof: number, tint: [number, number, number, number] = [1, 1, 1, 1]) {
    const uv: Vec3[] = [[r.u0, r.v0, r.layer], [r.u1, r.v0, r.layer], [r.u1, r.v1, r.layer], [r.u0, r.v1, r.layer]];
    const P: [number, number, number, number] = [mode, lit, dof, 0];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(c[i], uv[i], tint, P, [0, 0]);
  }

  /** A flat-coloured quad with per-corner colours (the sky) or a blob (mode 4, local -1..1). */
  colorQuad(c: [Vec3, Vec3, Vec3, Vec3], cols: [number, number, number, number][], mode: number, lit = 0) {
    const loc: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(c[i], [0, 0, 0], cols[i] ?? cols[0], [mode, lit, 0, 0], loc[i]);
  }

  /** A particle (particles.ts): a quad in the plane facing the camera's axis, `right` and `up` its half-extents in world metres. */
  sprite(at: Vec3, right: Vec3, up: Vec3, color: [number, number, number, number], shape: 0 | 1, additive: boolean, lit: number, slant = 0) {
    const c = (sx: number, sy: number): Vec3 => [at[0] + right[0] * sx + up[0] * sy + (sy > 0 ? slant / 2 : -slant / 2), at[1] + right[1] * sx + up[1] * sy, at[2] + right[2] * sx + up[2] * sy];
    const q: Vec3[] = [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)], loc: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const P: [number, number, number, number] = [MODE.particle, lit, additive ? 1 : 0, shape];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(q[i], [0, 0, 0], color, P, loc[i]);
  }

  draw(cam: CamState, light: LightState, lights: PointLight[], dim = 1) {
    const gl = this.gl, cv = this.canvas;
    gl.viewport(0, 0, cv.width, cv.height);
    if (this.alpha && this.transparent) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(light.skyBottom[0] * dim, light.skyBottom[1] * dim, light.skyBottom[2] * dim, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    const aspect = cv.width / Math.max(1, cv.height);
    const vp = mat4Mul(perspective(cam.fov, aspect, NEAR, FAR), lookAt(cam.eye, cam.target));
    gl.uniformMatrix4fv(this.u.uVP, false, vp);
    gl.uniform3fv(this.u.uCam, cam.eye);
    gl.uniform3fv(this.u.uAmb, light.amb);
    gl.uniform3fv(this.u.uKey, light.key);
    const lp = new Float32Array(16), lc = new Float32Array(16);
    lights.slice(0, 4).forEach((l, i) => { lp.set([...l.pos, l.radius], i * 4); lc.set([...l.color, l.intensity], i * 4); });
    gl.uniform4fv(this.u.uLightPos, lp);
    gl.uniform4fv(this.u.uLightCol, lc);
    gl.uniform4f(this.u.uHaze, light.haze[0], light.haze[1], light.haze[2], light.hazeDensity);
    const focus = Math.hypot(cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]);
    gl.uniform2f(this.u.uFocus, focus, 0.55);
    gl.uniform1f(this.u.uGrain, light.grain);
    gl.uniform1f(this.u.uGlow, light.glow);
    gl.uniform1f(this.u.uDim, dim);
    this.atlas.settle();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas.texture);
    gl.uniform1i(this.u.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.faces.texture);
    gl.uniform1i(this.u.uFaces, 1);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * FLOATS), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    gl.bindVertexArray(null);
    return { vertices: this.n, viewProj: vp };
  }

  /** Free every GPU resource and give the context back to the browser (a page keeps only a few). */
  dispose() {
    if (this.gone) return;
    this.gone = true;
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLoss);
    this.canvas.removeEventListener("webglcontextrestored", this.onBack);
    this.atlas.dispose(); this.faces.dispose();
    gl.deleteBuffer(this.buf); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
