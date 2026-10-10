// Carte stylisée « Paris la nuit » dessinée sur un <canvas> (reprise de la
// maquette). Elle n'affiche pas de vraies rues : c'est un décor qui place le
// départ et l'arrivée (coordonnées Google) et anime le trajet entre les deux.
// Si un point sort de l'Île-de-France, le cadrage s'élargit pour l'inclure.

export type MapPoint = { lat: number; lng: number };

export const LANDMARKS = [
  { short: "Opéra", lat: 48.8719, lng: 2.3316 },
  { short: "Tour Eiffel", lat: 48.8584, lng: 2.2945 },
  { short: "Marais", lat: 48.859, lng: 2.362 },
  { short: "Gare de Lyon", lat: 48.8443, lng: 2.3744 },
  { short: "Gare du Nord", lat: 48.8809, lng: 2.3553 },
  { short: "CDG", lat: 49.0097, lng: 2.5479 },
  { short: "Orly", lat: 48.7262, lng: 2.3652 },
  { short: "La Défense", lat: 48.8919, lng: 2.2381 },
  { short: "Versailles", lat: 48.8049, lng: 2.1204 },
  { short: "Disneyland", lat: 48.8722, lng: 2.7758 },
];

type Bounds = { lonMin: number; lonMax: number; latMin: number; latMax: number };
const IDF: Bounds = { lonMin: 2.06, lonMax: 2.84, latMin: 48.69, latMax: 49.04 };
const SEINE = [
  [2.46, 48.79],
  [2.43, 48.81],
  [2.4, 48.825],
  [2.375, 48.838],
  [2.355, 48.85],
  [2.34, 48.857],
  [2.32, 48.861],
  [2.3, 48.861],
  [2.285, 48.853],
  [2.27, 48.843],
  [2.245, 48.838],
  [2.228, 48.85],
  [2.226, 48.872],
  [2.24, 48.89],
  [2.265, 48.905],
  [2.295, 48.922],
  [2.315, 48.935],
  [2.3, 48.952],
  [2.265, 48.955],
  [2.22, 48.94],
  [2.18, 48.925],
  [2.14, 48.91],
  [2.1, 48.92],
  [2.07, 48.94],
];

function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boundsFor(points: MapPoint[]): Bounds {
  const inside = points.every(
    (p) => p.lng >= IDF.lonMin && p.lng <= IDF.lonMax && p.lat >= IDF.latMin && p.lat <= IDF.latMax,
  );
  if (inside) return IDF;
  const lons = [IDF.lonMin, IDF.lonMax, ...points.map((p) => p.lng)];
  const lats = [IDF.latMin, IDF.latMax, ...points.map((p) => p.lat)];
  const lonMin = Math.min(...lons),
    lonMax = Math.max(...lons);
  const latMin = Math.min(...lats),
    latMax = Math.max(...lats);
  const padLon = (lonMax - lonMin) * 0.08,
    padLat = (latMax - latMin) * 0.08;
  return {
    lonMin: lonMin - padLon,
    lonMax: lonMax + padLon,
    latMin: latMin - padLat,
    latMax: latMax + padLat,
  };
}

export function makeRouteMap(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(canvas);
  const C = {
    surface: css.getPropertyValue("--surface").trim() || "#141920",
    fg: css.getPropertyValue("--fg").trim() || "#ECE6DA",
    amber: css.getPropertyValue("--amber").trim() || "#E9A23B",
    seine: css.getPropertyValue("--seine").trim() || "rgba(110,145,190,.45)",
    mono: css.getPropertyValue("--mono").trim() || "monospace",
  };
  const cosL = Math.cos((48.86 * Math.PI) / 180);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let B = IDF;
  let W = 0,
    H = 0,
    s = 1,
    ox = 0,
    oy = 0,
    dpr = 1;
  let base: HTMLCanvasElement | null = null;
  let A: MapPoint | null = null,
    Bp: MapPoint | null = null;
  let start = 0,
    raf = 0;

  const proj = (lon: number, lat: number): [number, number] => [
    ox + (lon - B.lonMin) * cosL * s,
    oy + (B.latMax - lat) * s,
  ];

  // Rues générées de façon déterministe
  const R = rng(11);
  const center = [2.347, 48.858];
  const arterials: number[][][] = [],
    streets: number[][][] = [];
  for (let i = 0; i < 16; i++) {
    const pts: number[][] = [];
    let r = 0.01,
      a = (i / 16) * Math.PI * 2 + R() * 0.2;
    while (r < 0.5) {
      a += (R() - 0.5) * 0.12;
      pts.push([center[0] + (Math.cos(a) * r) / cosL, center[1] + Math.sin(a) * r]);
      r += 0.02 + R() * 0.02;
    }
    arterials.push(pts);
  }
  for (let i = 0; i < 420; i++) {
    const rr = Math.pow(R(), 1.7) * 0.32,
      a = R() * Math.PI * 2;
    const x = center[0] + (Math.cos(a) * rr) / cosL,
      y = center[1] + Math.sin(a) * rr;
    const dir = R() * Math.PI,
      len = 0.004 + R() * 0.018;
    streets.push([
      [x, y],
      [x + (Math.cos(dir) * len) / cosL, y + Math.sin(dir) * len],
    ]);
  }

  function smoothPathOn(c2: CanvasRenderingContext2D, pts: number[][]) {
    const p = pts.map((q) => proj(q[0], q[1]));
    c2.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      c2.quadraticCurveTo(
        p[i][0],
        p[i][1],
        (p[i][0] + p[i + 1][0]) / 2,
        (p[i][1] + p[i + 1][1]) / 2,
      );
    }
    const last = p[p.length - 1];
    c2.lineTo(last[0], last[1]);
  }

  function drawBase() {
    base = document.createElement("canvas");
    base.width = W * dpr;
    base.height = H * dpr;
    const b = base.getContext("2d")!;
    b.scale(dpr, dpr);
    b.fillStyle = C.surface;
    b.fillRect(0, 0, W, H);
    b.lineCap = "round";
    b.strokeStyle = "rgba(236,230,218,0.055)";
    b.lineWidth = 1;
    streets.forEach((st) => {
      const p1 = proj(st[0][0], st[0][1]),
        p2 = proj(st[1][0], st[1][1]);
      b.beginPath();
      b.moveTo(p1[0], p1[1]);
      b.lineTo(p2[0], p2[1]);
      b.stroke();
    });
    b.strokeStyle = "rgba(236,230,218,0.09)";
    b.lineWidth = 1.2;
    arterials.forEach((pts) => {
      b.beginPath();
      pts.forEach((q, i) => {
        const p = proj(q[0], q[1]);
        if (i) b.lineTo(p[0], p[1]);
        else b.moveTo(p[0], p[1]);
      });
      b.stroke();
    });
    // Périphérique
    const c = proj(2.347, 48.857);
    b.strokeStyle = "rgba(236,230,218,0.2)";
    b.lineWidth = 1.6;
    b.setLineDash([2, 4]);
    b.beginPath();
    b.ellipse(c[0], c[1], 0.088 * cosL * s, 0.042 * s, -0.12, 0, Math.PI * 2);
    b.stroke();
    b.setLineDash([]);
    // Seine
    b.strokeStyle = C.seine;
    b.lineWidth = Math.max(2, s * 0.0016);
    b.lineJoin = "round";
    b.beginPath();
    smoothPathOn(b, SEINE);
    b.stroke();
    b.font = "10px " + C.mono;
    b.fillStyle = "rgba(110,145,190,0.75)";
    const sl = proj(2.268, 48.905);
    b.fillText("Seine", sl[0] + 6, sl[1]);
    b.fillStyle = "rgba(236,230,218,0.32)";
    const pl = proj(2.347, 48.857 - 0.046);
    b.textAlign = "center";
    b.fillText("BD PÉRIPHÉRIQUE", pl[0], pl[1] + 12);
    b.textAlign = "start";
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const pad = 22;
    const mw = (B.lonMax - B.lonMin) * cosL,
      mh = B.latMax - B.latMin;
    s = Math.min((W - pad * 2) / mw, (H - pad * 2) / mh);
    ox = (W - mw * s) / 2;
    oy = (H - mh * s) / 2;
    drawBase();
    frame(performance.now());
  }

  const ctrl = (a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    return [(a[0] + b[0]) / 2 - dy * 0.22, (a[1] + b[1]) / 2 + dx * 0.22];
  };
  const qpt = (a: number[], c: number[], b: number[], t: number) => {
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ];
  };
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  function frame(now: number) {
    if (!base) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Repères
    LANDMARKS.forEach((p) => {
      const q = proj(p.lng, p.lat);
      if (q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H) return;
      ctx.fillStyle = "rgba(236,230,218,0.45)";
      ctx.beginPath();
      ctx.arc(q[0], q[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "10px " + C.mono;
      ctx.fillStyle = "rgba(149,156,168,0.85)";
      const right = q[0] < W - 90;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(p.short.toUpperCase(), q[0] + (right ? 9 : -9), q[1] + 4);
    });
    ctx.textAlign = "start";

    if (A && Bp) {
      const a = proj(A.lng, A.lat),
        b = proj(Bp.lng, Bp.lat),
        c = ctrl(a, b);
      const prog = ease(reduce ? 1 : Math.min(1, (now - start) / 1300));
      const N = 80;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(233,162,59,0.18)";
      ctx.lineWidth = 9;
      ctx.beginPath();
      for (let i = 0; i <= N * prog; i++) {
        const p = qpt(a, c, b, i / N);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // départ
      ctx.strokeStyle = C.fg;
      ctx.lineWidth = 2;
      ctx.fillStyle = C.surface;
      ctx.beginPath();
      ctx.arc(a[0], a[1], 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // arrivée
      if (prog >= 1) {
        const pulse = reduce ? 0 : ((now - start) % 1800) / 1800;
        ctx.strokeStyle = "rgba(233,162,59," + 0.6 * (1 - pulse) + ")";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b[0], b[1], 7 + pulse * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.arc(b[0], b[1], 6.5 * Math.min(1, prog * 1.2), 0, Math.PI * 2);
      ctx.fill();

      // voiture
      const u = prog < 1 ? prog : reduce ? 0.55 : ((now - start - 1300) % 5200) / 5200;
      const p = qpt(a, c, b, ease(u));
      ctx.fillStyle = C.fg;
      ctx.shadowColor = "rgba(233,162,59,0.9)";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const only = A ?? Bp;
      if (only) {
        const a = proj(only.lng, only.lat);
        ctx.strokeStyle = C.fg;
        ctx.lineWidth = 2;
        ctx.fillStyle = C.surface;
        ctx.beginPath();
        ctx.arc(a[0], a[1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function loop(now: number) {
    frame(now);
    raf = requestAnimationFrame(loop);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const same = (p: MapPoint | null, q: MapPoint | null) =>
    p === q || (!!p && !!q && p.lat === q.lat && p.lng === q.lng);

  return {
    setRoute(a: MapPoint | null, b: MapPoint | null) {
      if (same(a, A) && same(b, Bp)) return;
      A = a;
      Bp = b;
      start = performance.now();
      const nextBounds = boundsFor([a, b].filter((p): p is MapPoint => !!p));
      if (nextBounds !== B || !base) {
        B = nextBounds;
        resize();
      }
      if (reduce) {
        frame(performance.now());
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    },
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(raf);
    },
  };
}
