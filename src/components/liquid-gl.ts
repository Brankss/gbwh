// Mercurio nero in WebGL: metaball + tentacoli curvi che sgocciolano, normali dal campo,
// riflesso da "studio" con soft-box, alone freddo e reazione al puntatore.
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

const MAX_BALLS = 12; // gocce della scena + gocce che si staccano dalle punte + goccia del puntatore
const MAX_SEGS = 8; // ogni tentacolo = 2 segmenti curvi

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;      // pixel del canvas
uniform vec2 uScene;    // dimensioni scena
uniform float uTime;
uniform float uGain;    // luminosità: piena per il login, più bassa per lo sfondo dietro ai testi
uniform vec3 uBalls[${MAX_BALLS}];   // x, y, r
uniform vec4 uSegs[${MAX_SEGS}];     // ax, ay, bx, by
uniform vec2 uSegW[${MAX_SEGS}];     // spessore all'inizio, spessore alla fine (affusolato)
uniform int uNB;
uniform int uNS;
uniform vec3 uMouse;    // x, y (scena), intensità 0..1

// cover: come object-fit: cover
vec2 toScene(vec2 frag){
  float s = max(uRes.x / uScene.x, uRes.y / uScene.y);
  vec2 off = (uRes - uScene * s) * 0.5;
  return (vec2(frag.x, uRes.y - frag.y) - off) / s;
}

// Campo + gradiente in un solo passaggio (derivata analitica): 1 valutazione per pixel.
vec3 field(vec2 p){
  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX_BALLS}; i++){
    if (i >= uNB) break;
    vec3 b = uBalls[i];
    vec2 d = p - b.xy;
    // caduta 1/d^4: la goccia resta della sua misura e si fonde solo quando un'altra si avvicina.
    // Il termine 0.3 r^2 arrotonda il centro: niente "girandola" di riflessi nel mezzo della goccia.
    float q = dot(d, d) + 0.3 * b.z * b.z;
    float k = (b.z * b.z) / q;
    k *= k;
    f += k;
    g += -4.0 * k / q * d;
  }
  for (int i = 0; i < ${MAX_SEGS}; i++){
    if (i >= uNS) break;
    vec2 a = uSegs[i].xy, c = uSegs[i].zw;
    vec2 pa = p - a, ba = c - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float w = mix(uSegW[i].x, uSegW[i].y, h);   // tentacolo affusolato verso la punta
    vec2 d = pa - ba * h;
    float q = dot(d, d) + 0.6 * w * w;          // ammorbidito sull'asse: niente righe
    float k = (w * w) / q;
    k *= k;
    f += k;
    g += -4.0 * k / q * d;
  }
  return vec3(f, g);
}

// Ambiente "da studio" riflesso: grande soft-box in alto, due strisce di luce ai lati,
// orizzonte morbido e fasce lente. Si sposta pianissimo: il riflesso scorre come su metallo liquido.
float studio(vec3 r){
  float drift = sin(uTime * 0.07) * 0.18;
  float top = smoothstep(0.30, 0.78, r.y) * smoothstep(1.0, 0.35, abs(r.x + 0.2 + drift));
  float stripL = smoothstep(0.11, 0.0, abs(r.x + 0.70 - drift * 0.5)) * smoothstep(-0.7, 0.25, r.y);
  float stripR = smoothstep(0.06, 0.0, abs(r.x - 0.80 + drift)) * smoothstep(-0.5, 0.45, r.y) * 0.75;
  float horizon = exp(-pow((r.y + 0.08) * 6.5, 2.0)) * 0.32;
  float bands = pow(0.5 + 0.5 * sin((r.y * 2.4 + r.x * 1.1) * 3.2 + uTime * 0.09), 8.0) * 0.35;
  return top + stripL * 0.9 + stripR + horizon + bands;
}

void main(){
  vec2 p = toScene(gl_FragCoord.xy);
  float px = 1.0 / max(uRes.x / uScene.x, uRes.y / uScene.y); // un pixel, in unità scena
  vec3 F = field(p);
  float f = F.x;
  vec2 g = F.yz;

  // Alone freddo appena fuori dalla forma (luce che "sbava" sul nero): usa lo stesso campo, costo zero.
  float halo = pow(smoothstep(0.22, 1.0, f), 3.0) * 0.10;
  if (f < 0.22) { gl_FragColor = vec4(0.0); return; }

  // Bordo netto: distanza dalla soglia misurata in pixel (antialias di 1 pixel)
  float edge = clamp((f - 1.0) / max(length(g) * px, 1e-4) + 0.5, 0.0, 1.0);

  // Normali: la goccia è una cupola, ripida ai bordi e piatta all'interno. La pendenza scala con 1/f^2,
  // così dove due gocce si incontrano (campo alto) le normali non "saturano" in una stella di riflessi.
  float dome = 1.0 / (0.15 + 0.85 * f * f);
  vec3 n = normalize(vec3(-g * 34.0 * dome, 1.0));

  // Increspatura vicino al puntatore/tocco
  vec2 dm = p - uMouse.xy;
  float md = length(dm);
  n.xy += (dm / max(md, 1.0)) * sin(md * 0.11 - uTime * 4.5) * exp(-md / 85.0) * 0.22 * uMouse.z;
  n = normalize(n);

  // Riflesso con una leggerissima aberrazione fredda, solo verso il bordo (come nelle lenti vere)
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float fr = pow(1.0 - n.z, 3.0);
  float ab = 0.03 * fr;
  vec3 env = vec3(studio(r + vec3(ab, 0.0, 0.0)), studio(r), studio(r - vec3(ab * 1.2, 0.0, 0.0)));
  vec3 base = vec3(0.012, 0.012, 0.014);
  vec3 silver = vec3(0.88, 0.89, 0.91);
  vec3 col = base + silver * env * 0.82;

  // Luce principale (argento) e controluce fredda
  vec3 l1 = normalize(vec3(-0.6, 0.7, 0.9));
  vec3 l2 = normalize(vec3(0.7, -0.5, 0.4));
  float s1 = pow(max(dot(r, l1), 0.0), 60.0);
  float s2 = pow(max(dot(r, l2), 0.0), 14.0) * 0.22;
  col += vec3(1.0) * s1 * 1.25 + vec3(0.6, 0.67, 0.76) * s2;

  // Fresnel: filo chiaro sul bordo, con un velo iridescente freddo appena accennato
  vec3 iri = vec3(0.55, 0.62, 0.78) + 0.12 * vec3(sin(uTime * 0.3 + n.x * 7.0), sin(uTime * 0.3 + n.y * 7.0 + 2.0), sin(uTime * 0.3 + 4.0));
  col += iri * fr * 0.42;

  col *= uGain;
  vec3 glow = vec3(0.55, 0.6, 0.68) * halo * uGain;
  float a = max(edge, halo * 0.6);
  gl_FragColor = vec4(col * edge + glow * (1.0 - edge), a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

/** Avvia il mercurio su un canvas. Restituisce la funzione per fermarlo, o null se WebGL non c'è. */
export function startLiquid(
  canvas: HTMLCanvasElement,
  layout: Layout,
  opts: { scale: number; animate: boolean; gain: number; follow?: boolean },
) {
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
  const uTime = u("uTime");
  const uBalls = u("uBalls");
  const uSegs = u("uSegs");
  const uSegW = u("uSegW");
  const uNB = u("uNB");
  const uMouse = u("uMouse");
  const scene = SCENES[layout];
  gl.uniform2f(u("uScene"), scene.w, scene.h);
  gl.uniform1f(u("uGain"), opts.gain);
  gl.uniform1i(u("uNS"), Math.min(scene.lashes.length * 2, MAX_SEGS));

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

  /* Puntatore / tocco: posizione in coordinate di scena, ammorbidita; l'intensità si spegne da sola. */
  const pointer = { x: scene.w / 2, y: scene.h / 2, tx: scene.w / 2, ty: scene.h / 2, s: 0, last: -1e9 };
  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const k = Math.max(rect.width / scene.w, rect.height / scene.h);
    pointer.tx = (e.clientX - rect.left - (rect.width - scene.w * k) / 2) / k;
    pointer.ty = (e.clientY - rect.top - (rect.height - scene.h * k) / 2) / k;
    if (pointer.s < 0.01) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    }
    pointer.last = performance.now();
  };
  if (opts.animate) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
  }

  const balls = new Float32Array(MAX_BALLS * 3);
  const segs = new Float32Array(MAX_SEGS * 4);
  const segW = new Float32Array(MAX_SEGS * 2);
  /** Quanto le gocce si sporgono verso il puntatore (discreto sullo sfondo, deciso nel login). */
  const pull = opts.follow ? 70 : 28;

  const draw = (t: number, now: number) => {
    resize();

    // intensità del puntatore: sale quando si muove, si spegne in ~2s di quiete
    const active = now - pointer.last < 2200 ? 1 : 0;
    pointer.s += (active - pointer.s) * 0.06;
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;

    let nb = 0;
    const pushBall = (x: number, y: number, r: number) => {
      if (nb >= MAX_BALLS) return;
      balls[nb * 3] = x;
      balls[nb * 3 + 1] = y;
      balls[nb * 3 + 2] = r * 1.2; // compensa il centro arrotondato (stesso contorno di prima)
      nb++;
    };

    for (const b of scene.balls) {
      // due frequenze per un moto meno meccanico
      let x = b.x + Math.sin(t * b.sp + b.ph) * b.ax + Math.sin(t * b.sp * 2.3 + b.ph * 1.7) * b.ax * 0.18;
      let y = b.y + Math.cos(t * b.sp * 0.8 + b.ph) * b.ay + Math.cos(t * b.sp * 1.9 + b.ph * 0.6) * b.ay * 0.2;
      // attrazione morbida verso il puntatore
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      const lean = pointer.s * pull * Math.exp(-dist / 320);
      x += (dx / dist) * Math.min(lean, dist * 0.5);
      y += (dy / dist) * Math.min(lean, dist * 0.5);
      pushBall(x, y, b.r * (1 + 0.08 * Math.sin(t * b.sp * 1.3 + b.ph)));
    }

    // Tentacoli: due segmenti con un'onda che corre dalla base alla punta (frusta), più una goccia
    // che si stacca dalla punta, si allontana rimpicciolendo e ricomincia.
    let ns = 0;
    scene.lashes.forEach((l, i) => {
      if (ns + 2 > MAX_SEGS) return;
      const a = l.ang + Math.sin(t * l.sp + l.ph) * l.swing;
      const len = l.len * (0.78 + 0.26 * Math.sin(t * l.sp * 0.7 + l.ph));
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const wave = Math.sin(t * l.sp * 1.4 + l.ph) * len * 0.16;
      const mx = l.x + cx * len * 0.55 - cy * wave;
      const my = l.y + cy * len * 0.55 + cx * wave;
      const bend = a + Math.sin(t * l.sp * 1.4 + l.ph - 1.1) * 0.55;
      const tx = mx + Math.cos(bend) * len * 0.45;
      const ty = my + Math.sin(bend) * len * 0.45;
      segs.set([l.x, l.y, mx, my], ns * 4);
      segW.set([l.w, l.w * 0.6], ns * 2);
      ns++;
      segs.set([mx, my, tx, ty], ns * 4);
      segW.set([l.w * 0.6, l.w * 0.13], ns * 2);
      ns++;
      // goccia che sgocciola dalla punta
      const ph = (t * 0.11 + i * 0.37) % 1;
      const go = ph * ph * 140;
      pushBall(tx + Math.cos(bend) * go, ty + Math.sin(bend) * go, l.w * 0.42 * Math.pow(1 - ph, 0.8));
    });

    // Nel login una gocciolina d'argento segue il cursore e si fonde con il resto quando ci passa vicino.
    if (opts.follow && pointer.s > 0.02) pushBall(pointer.x, pointer.y, 30 * pointer.s);

    gl.uniform1i(uNB, nb);
    gl.uniform3fv(uBalls, balls);
    gl.uniform4fv(uSegs, segs);
    gl.uniform2fv(uSegW, segW);
    gl.uniform3f(uMouse, pointer.x, pointer.y, pointer.s);
    gl.uniform1f(uTime, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  let raf = 0;
  const t0 = performance.now();
  if (opts.animate) {
    const loop = (now: number) => {
      draw((now - t0) / 1000, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  } else {
    draw(4, -1e9);
  }
  const onResize = () => !opts.animate && draw(4, -1e9);
  window.addEventListener("resize", onResize);

  // Stop: libera programma e buffer ma NON spegne il contesto, così lo stesso canvas può ripartire
  // (cambio layout, rotazione del telefono, doppio effetto di React in sviluppo).
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointerdown", onPointer);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
}
