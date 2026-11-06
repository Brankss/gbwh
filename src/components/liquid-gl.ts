// Mercurio nero in WebGL: metaball + tentacoli, normali dal campo, riflesso cromato a fasce.
// Gira sulla GPU a risoluzione ridotta: leggero anche su telefono. Nessuna libreria.

export type Layout = "wide" | "tall" | "hero" | "heroTall";

type Ball = { x: number; y: number; r: number; ax: number; ay: number; sp: number; ph: number };
type Lash = { x: number; y: number; ang: number; len: number; w: number; swing: number; sp: number; ph: number };

/** Coordinate in "unità di scena" (come il viewBox SVG), riempite a copertura come object-fit: cover. */
const SCENES: Record<Layout, { w: number; h: number; balls: Ball[]; lashes: Lash[] }> = {
  wide: {
    w: 1000,
    h: 700,
    balls: [
      { x: 880, y: 90, r: 115, ax: 60, ay: 40, sp: 0.39, ph: 0 },
      { x: 960, y: 230, r: 70, ax: 80, ay: 30, sp: 0.3, ph: 1 },
      { x: 760, y: 200, r: 48, ax: 40, ay: 70, sp: 0.35, ph: 2 },
      { x: 120, y: 640, r: 80, ax: 60, ay: 30, sp: 0.33, ph: 3 },
      { x: 40, y: 540, r: 85, ax: 70, ay: 35, sp: 0.29, ph: 4 },
      { x: 250, y: 690, r: 50, ax: 40, ay: 60, sp: 0.36, ph: 5 },
    ],
    lashes: [
      { x: 860, y: 110, ang: 3.5, len: 240, w: 46, swing: 0.25, sp: 0.6, ph: 0 },
      { x: 60, y: 540, ang: -0.7, len: 230, w: 42, swing: 0.25, sp: 0.55, ph: 2 },
    ],
  },
  tall: {
    w: 400,
    h: 860,
    balls: [
      { x: 380, y: 40, r: 90, ax: 30, ay: 25, sp: 0.38, ph: 0 },
      { x: 330, y: 120, r: 55, ax: 45, ay: 20, sp: 0.31, ph: 1 },
      { x: 10, y: 800, r: 95, ax: 30, ay: 30, sp: 0.33, ph: 2 },
      { x: 90, y: 860, r: 70, ax: 50, ay: 20, sp: 0.29, ph: 3 },
    ],
    lashes: [
      { x: 360, y: 60, ang: 3.4, len: 190, w: 34, swing: 0.25, sp: 0.6, ph: 0 },
      { x: 30, y: 790, ang: -0.75, len: 210, w: 34, swing: 0.25, sp: 0.55, ph: 2 },
    ],
  },
  hero: {
    w: 1000,
    h: 700,
    balls: [
      { x: 500, y: 330, r: 150, ax: 50, ay: 35, sp: 0.37, ph: 0 },
      { x: 600, y: 400, r: 95, ax: 80, ay: 30, sp: 0.29, ph: 1 },
      { x: 380, y: 420, r: 80, ax: 40, ay: 60, sp: 0.34, ph: 2 },
      { x: 640, y: 230, r: 55, ax: 50, ay: 40, sp: 0.42, ph: 3 },
    ],
    lashes: [
      { x: 470, y: 320, ang: 3.75, len: 280, w: 55, swing: 0.22, sp: 0.6, ph: 0 },
      { x: 560, y: 370, ang: 0.62, len: 300, w: 50, swing: 0.22, sp: 0.5, ph: 1.5 },
      { x: 540, y: 300, ang: -0.9, len: 260, w: 42, swing: 0.25, sp: 0.55, ph: 3 },
    ],
  },
  heroTall: {
    w: 400,
    h: 860,
    balls: [
      { x: 210, y: 170, r: 95, ax: 30, ay: 25, sp: 0.37, ph: 0 },
      { x: 240, y: 235, r: 62, ax: 50, ay: 20, sp: 0.3, ph: 1 },
      { x: 110, y: 230, r: 52, ax: 30, ay: 35, sp: 0.34, ph: 2 },
      { x: 300, y: 110, r: 38, ax: 30, ay: 30, sp: 0.42, ph: 3 },
      { x: 330, y: 790, r: 70, ax: 30, ay: 25, sp: 0.31, ph: 4 },
      { x: 260, y: 840, r: 55, ax: 45, ay: 15, sp: 0.36, ph: 5 },
    ],
    lashes: [
      { x: 160, y: 220, ang: 2.2, len: 260, w: 31, swing: 0.2, sp: 0.55, ph: 0 },
      { x: 260, y: 230, ang: 0.95, len: 260, w: 31, swing: 0.2, sp: 0.5, ph: 1.7 },
      { x: 230, y: 140, ang: -1.0, len: 150, w: 28, swing: 0.25, sp: 0.6, ph: 3 },
    ],
  },
};

const MAX_BALLS = 8;
const MAX_LASHES = 4;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;      // pixel del canvas
uniform vec2 uScene;    // dimensioni scena
uniform float uTime;
uniform float uGain;    // luminosità: piena per il login, più bassa per lo sfondo dietro ai testi
uniform vec3 uBalls[${MAX_BALLS}];   // x, y, r
uniform vec4 uLashA[${MAX_LASHES}];  // ax, ay, bx, by
uniform vec2 uLashW[${MAX_LASHES}];  // spessore base, (non usato)
uniform int uNB;
uniform int uNL;

// cover: come object-fit: cover
vec2 toScene(vec2 frag){
  float s = max(uRes.x / uScene.x, uRes.y / uScene.y);
  vec2 off = (uRes - uScene * s) * 0.5;
  vec2 q = (vec2(frag.x, uRes.y - frag.y) - off) / s;
  return q;
}

// Campo + gradiente in un solo passaggio (derivata analitica): 1 valutazione per pixel invece di 5.
vec3 field(vec2 p){
  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX_BALLS}; i++){
    if (i >= uNB) break;
    vec3 b = uBalls[i];
    vec2 d = p - b.xy;
    // caduta 1/d^4: la goccia resta della sua misura e si fonde solo quando un'altra si avvicina
    float q = dot(d, d) + 1.0;
    float k = (b.z * b.z) / q;
    k *= k;
    f += k;
    g += -4.0 * k / q * d;
  }
  for (int i = 0; i < ${MAX_LASHES}; i++){
    if (i >= uNL) break;
    vec2 a = uLashA[i].xy, c = uLashA[i].zw;
    vec2 pa = p - a, ba = c - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float w = uLashW[i].x * (1.0 - h * 0.85);   // tentacolo affusolato
    vec2 d = pa - ba * h;
    float q = dot(d, d) + 0.6 * w * w;   // ammorbidito sull'asse: niente righe
    float k = (w * w) / q;
    k *= k;
    f += k;
    g += -4.0 * k / q * d;
  }
  return vec3(f, g);
}

void main(){
  vec2 p = toScene(gl_FragCoord.xy);
  float px = 1.0 / max(uRes.x / uScene.x, uRes.y / uScene.y); // un pixel, in unità scena
  vec3 F = field(p);
  float f = F.x;
  if (f < 0.7) { gl_FragColor = vec4(0.0); return; }
  vec2 g = F.yz;

  // Bordo netto: distanza dalla soglia misurata in pixel (antialias di 1 pixel)
  float edge = clamp((f - 1.0) / max(length(g) * px, 1e-4) + 0.5, 0.0, 1.0);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // Normali: la goccia è una cupola, ripida ai bordi e piatta al centro
  float dome = 1.0 / (0.4 + f * 0.9);
  vec3 n = normalize(vec3(-g * 30.0 * dome, 1.0));

  // Riflesso: fasce d'argento di un "ambiente" che scorre piano
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float band = r.y * 2.4 + r.x * 1.1 + uTime * 0.03;
  float env = pow(0.5 + 0.5 * sin(band * 3.2), 6.0) * 0.9 + pow(0.5 + 0.5 * sin(band * 1.3 + 1.7), 10.0) * 0.6;
  vec3 base = vec3(0.02);
  vec3 silver = vec3(0.86, 0.87, 0.89);
  vec3 col = mix(base, silver, env * 0.75);

  // Luce principale (argento) e controluce fredda
  vec3 l1 = normalize(vec3(-0.6, 0.7, 0.9));
  vec3 l2 = normalize(vec3(0.7, -0.5, 0.4));
  float s1 = pow(max(dot(r, l1), 0.0), 42.0);
  float s2 = pow(max(dot(r, l2), 0.0), 12.0) * 0.25;
  col += vec3(1.0) * s1 * 1.1 + vec3(0.6, 0.66, 0.74) * s2;

  // Fresnel: filo chiaro sul bordo
  float fr = pow(1.0 - n.z, 3.0);
  col += vec3(0.8) * fr * 0.4;

  col *= uGain;
  gl_FragColor = vec4(col * edge, edge);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

/** Avvia il mercurio su un canvas. Restituisce la funzione per fermarlo, o null se WebGL non c'è. */
export function startLiquid(canvas: HTMLCanvasElement, layout: Layout, opts: { scale: number; animate: boolean; gain: number }) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl || gl.isContextLost()) return null;

  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  } catch (e) {
    console.warn("[liquid] WebGL non utilizzabile, uso la versione ferma:", e);
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes");
  const uScene = u("uScene");
  const uTime = u("uTime");
  const uBalls = u("uBalls");
  const uLashA = u("uLashA");
  const uLashW = u("uLashW");
  const scene = SCENES[layout];
  gl.uniform2f(uScene, scene.w, scene.h);
  gl.uniform1f(u("uGain"), opts.gain);
  gl.uniform1i(u("uNB"), scene.balls.length);
  gl.uniform1i(u("uNL"), scene.lashes.length);

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * opts.scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * opts.scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };

  const balls = new Float32Array(MAX_BALLS * 3);
  const lashA = new Float32Array(MAX_LASHES * 4);
  const lashW = new Float32Array(MAX_LASHES * 2);

  const draw = (t: number) => {
    resize();
    scene.balls.forEach((b, i) => {
      balls[i * 3] = b.x + Math.sin(t * b.sp + b.ph) * b.ax;
      balls[i * 3 + 1] = b.y + Math.cos(t * b.sp * 0.8 + b.ph) * b.ay;
      balls[i * 3 + 2] = b.r * (1 + 0.08 * Math.sin(t * b.sp * 1.3 + b.ph));
    });
    scene.lashes.forEach((l, i) => {
      const a = l.ang + Math.sin(t * l.sp + l.ph) * l.swing;
      const len = l.len * (0.8 + 0.25 * Math.sin(t * l.sp * 0.7 + l.ph));
      lashA[i * 4] = l.x;
      lashA[i * 4 + 1] = l.y;
      lashA[i * 4 + 2] = l.x + Math.cos(a) * len;
      lashA[i * 4 + 3] = l.y + Math.sin(a) * len;
      lashW[i * 2] = l.w;
    });
    gl.uniform3fv(uBalls, balls);
    gl.uniform4fv(uLashA, lashA);
    gl.uniform2fv(uLashW, lashW);
    gl.uniform1f(uTime, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  let raf = 0;
  const t0 = performance.now();
  if (opts.animate) {
    const loop = (now: number) => {
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  } else {
    draw(4);
  }
  const onResize = () => !opts.animate && draw(4);
  window.addEventListener("resize", onResize);

  // Stop: libera programma e buffer ma NON spegne il contesto, così lo stesso canvas può ripartire
  // (cambio layout, rotazione del telefono, doppio effetto di React in sviluppo).
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
}
