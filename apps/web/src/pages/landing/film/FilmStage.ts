import * as THREE from 'three';

/**
 * Quyosh «filmi» (TZ U6.9): bitta Three.js sahna, hammasi skroll progressi (0..1) bilan boshqariladi.
 * 8 bob: 01 Tong · 02 Panel to‘ri · 03 Energiya · 04 Tejash · 05 Xarita · 06 Takliflar · 07 Montaj · 08 Quyosh.uz
 * Fotosurat/video yo‘q — hammasi kod bilan chiziladi. Quyosh holati foydalanuvchi vaqtidan (klientda, bezak uchun) olinadi.
 */
export interface FilmStage {
  setProgress(progress: number): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

/** Bob chegaralari (8 ta bob → 9 nuqta). */
export const SCENES = [0, 0.12, 0.25, 0.38, 0.5, 0.63, 0.76, 0.88, 1] as const;

export interface FilmLabels {
  saving: string;
  savingNote: string;
  quotes: Array<{ shop: string; price: string }>;
  steps: string[];
    /** Hozirgi vaqt bo‘yicha quyosh yoyi (0 — chiqish, 1 — botish). */
  sunArc: number;
  /** Tun: quyosh ufq ostida, yulduzlar ko‘rinadi (U1.3). */
  night: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const window4 = (a: number, b: number, c: number, d: number, x: number) => smooth(a, b, x) * (1 - smooth(c, d, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function textureFrom(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = "800 64px Onest, Inter, sans-serif";

export function createFilmStage(mount: HTMLElement, labels: FilmLabels, options: { lowPower: boolean }): FilmStage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !options.lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'gm-film__canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => (disposables.push(item), item);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sunLight = new THREE.DirectionalLight(0xffe2a3, 1.4);
  sunLight.position.set(-4, 6, 5);
  scene.add(sunLight);

  const SUN = 0xffb21a;
  const sunMat = track(new THREE.MeshBasicMaterial({ color: SUN, transparent: true }));
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(0.55, 32, 32)), sunMat);
  const haloTex = textureFrom(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,201,74,0.85)');
    g.addColorStop(0.4, 'rgba(255,154,47,0.25)');
    g.addColorStop(1, 'rgba(255,154,47,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  track(haloTex);
  const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false })));
  halo.scale.set(4.2, 4.2, 1);
  sun.add(halo);
  scene.add(sun);

  // Yoy izi (o‘tilgan yo‘l) va ufq chizig‘i.
  const ARC_R = 5.2;
  const arcPoint = (u: number) => new THREE.Vector3(-Math.cos(u * Math.PI) * ARC_R, Math.sin(u * Math.PI) * ARC_R * 0.62 - 0.4, -2.5);
  const arcGeo = track(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, (_, i) => arcPoint(i / 60))));
  const arcLine = new THREE.Line(arcGeo, track(new THREE.LineDashedMaterial({ color: 0xffc94a, dashSize: 0.12, gapSize: 0.14, transparent: true, opacity: 0.55 })));
  arcLine.computeLineDistances();
  scene.add(arcLine);
  const horizon = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 0.02)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));
  horizon.position.set(0, -0.4, -2.5);
  scene.add(horizon);

  // Yulduzlar.
  const starCount = options.lowPower ? 60 : 140;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    starPos[i * 3] = (Math.random() - 0.5) * 30;
    starPos[i * 3 + 1] = Math.random() * 10;
    starPos[i * 3 + 2] = -6 - Math.random() * 6;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, track(new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8 })));
  scene.add(stars);

  // Uy + tom + panellar (izometrik).
  const house = new THREE.Group();
  house.position.set(0.4, -0.4, 0);
  const wallMat = track(new THREE.MeshLambertMaterial({ color: 0x1b2a5e }));
  const roofMat = track(new THREE.MeshLambertMaterial({ color: 0x2a3b7a }));
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(3.6, 1.5, 2.4)), wallMat);
  body.position.y = 0.75;
  house.add(body);
  const roof = new THREE.Mesh(track(new THREE.BoxGeometry(3.9, 0.12, 2.8)), roofMat);
  roof.position.y = 1.58;
  roof.rotation.z = -0.22;
  house.add(roof);
  const cols = 6;
  const rows = 3;
  const panelMat = track(new THREE.MeshLambertMaterial({ color: 0x1d4f9e, emissive: 0x0b2a66, emissiveIntensity: 0.6 }));
  const panelGeo = track(new THREE.BoxGeometry(0.52, 0.04, 0.78));
  const panels: THREE.Mesh[] = [];
  const panelGroup = new THREE.Group();
  panelGroup.position.y = 1.66;
  panelGroup.rotation.z = -0.22;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const mesh = new THREE.Mesh(panelGeo, panelMat);
      mesh.position.set((c - (cols - 1) / 2) * 0.58, 0.04, (r - (rows - 1) / 2) * 0.86);
      mesh.scale.setScalar(0.001);
      panelGroup.add(mesh);
      panels.push(mesh);
    }
  }
  house.add(panelGroup);
  scene.add(house);

  // Energiya oqimi: quyosh → panel → uy; kWh ga mutanosib qalinlikdagi zarrachalar.
  const flowCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 3.2, 0.5), new THREE.Vector3(-1.2, 2.4, 0.8), new THREE.Vector3(0.4, 1.9, 0.6), new THREE.Vector3(1.8, 0.9, 1.4)]);
  const FLOW = options.lowPower ? 18 : 36;
  const flowPos = new Float32Array(FLOW * 3);
  const flowGeo = track(new THREE.BufferGeometry());
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = track(new THREE.PointsMaterial({ color: 0xffc94a, size: 0.13, transparent: true, opacity: 0, depthWrite: false }));
  const flow = new THREE.Points(flowGeo, flowMat);
  scene.add(flow);

  // Tejash kartasi (4-bob).
  const savingTex = track(textureFrom(1024, 420, (ctx) => {
    ctx.fillStyle = 'rgba(8,16,48,0.82)';
    roundRect(ctx, 8, 8, 1008, 404, 44);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffc94a';
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.fillText(labels.saving, 56, 150);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = "500 34px Inter, sans-serif";
    ctx.fillText(labels.savingNote, 56, 210);
    // Diapazon chizig‘i: past — standart — yuqori.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, 56, 290, 912, 22, 11);
    ctx.fill();
    const g = ctx.createLinearGradient(260, 0, 780, 0);
    g.addColorStop(0, '#ffe2a3');
    g.addColorStop(1, '#ffb21a');
    ctx.fillStyle = g;
    roundRect(ctx, 260, 290, 520, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(516, 280, 8, 42);
  }));
  const savingCard = new THREE.Mesh(track(new THREE.PlaneGeometry(4.6, 1.89)), track(new THREE.MeshBasicMaterial({ map: savingTex, transparent: true, opacity: 0, depthWrite: false })));
  savingCard.position.set(0.2, 2.75, 2.4);
  scene.add(savingCard);

  // Xarita (5-bob): to‘r + do‘kon nuqtalari.
  const mapGroup = new THREE.Group();
  mapGroup.position.set(0.3, -1.6, 0);
  const grid = new THREE.GridHelper(14, 28, 0x3a5bd9, 0x22336f);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0;
  mapGroup.add(grid);
  const nodeMat = track(new THREE.MeshBasicMaterial({ color: 0x45d7a3, transparent: true, opacity: 0 }));
  const nodeGeo = track(new THREE.SphereGeometry(0.22, 16, 16));
  const nodes: THREE.Mesh[] = [];
  const NODES: Array<[number, number]> = [[-3, -1.5], [-1.2, 2], [0.5, -2.5], [2.2, 1], [3.8, -1], [1.4, 3.2], [-4.2, 1.6]];
  NODES.forEach(([x, z]) => {
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.set(x, 0.2, z);
    mapGroup.add(node);
    nodes.push(node);
  });
  scene.add(mapGroup);

  // Takliflar (6-bob): uchta karta, o‘rtadagisi tanlanadi.
  const quoteGroup = new THREE.Group();
  const quoteMats: THREE.MeshBasicMaterial[] = [];
  labels.quotes.slice(0, 3).forEach((quote, i) => {
    const selected = i === 1;
    const tex = track(textureFrom(512, 640, (ctx) => {
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.84)';
      roundRect(ctx, 8, 8, 496, 624, 40);
      ctx.fill();
      ctx.fillStyle = '#0c1730';
      ctx.font = "800 48px Onest, Inter, sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(quote.shop, 44, 110);
      ctx.fillStyle = selected ? '#b86f00' : '#58647e';
      ctx.font = "800 62px Onest, Inter, sans-serif";
      ctx.fillText(quote.price, 44, 250);
      ctx.fillStyle = selected ? '#059669' : '#c3cde0';
      roundRect(ctx, 44, 520, 424, 64, 32);
      ctx.fill();
    }));
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    quoteMats.push(mat);
    const card = new THREE.Mesh(track(new THREE.PlaneGeometry(1.55, 1.94)), mat);
    card.position.set((i - 1) * 1.8, selected ? 0.1 : 0, selected ? 0.3 : 0);
    quoteGroup.add(card);
  });
  quoteGroup.position.set(-0.4, 1.6, 1);
  scene.add(quoteGroup);

  // Montaj (7-bob): bosqichlar chizig‘i va yashil halqa.
  const stepGroup = new THREE.Group();
  const stepMats: THREE.MeshBasicMaterial[] = [];
  const STEPS = Math.max(2, labels.steps.length);
  for (let i = 0; i < STEPS; i += 1) {
    const mat = track(new THREE.MeshBasicMaterial({ color: 0x45d7a3, transparent: true, opacity: 0 }));
    stepMats.push(mat);
    const dot = new THREE.Mesh(track(new THREE.CircleGeometry(0.2, 32)), mat);
    dot.position.set((i - (STEPS - 1) / 2) * 1.1, 0, 0);
    stepGroup.add(dot);
  }
  const ringMat = track(new THREE.MeshBasicMaterial({ color: 0x45d7a3, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(0.62, 0.7, 64)), ringMat);
  ring.position.set(0, 0, 0);
  stepGroup.add(ring);
  stepGroup.position.set(-0.9, 1.4, 2.2);
  scene.add(stepGroup);

  // 8-bob: quyosh atrofida to‘liq aylana chiziladi.
  const ringPts = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * 2.4, Math.sin((i / 128) * Math.PI * 2) * 2.4, 0));
  const finalRing = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(ringPts)), track(new THREE.LineBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0 })));
  finalRing.position.set(-1.3, 1.9, -5);
  scene.add(finalRing);

  // Kamera pozitsiyalari (bob boshiga).
  const CAM: Array<{ pos: [number, number, number]; look: [number, number, number] }> = [
    { pos: [0.4, 1.2, 12], look: [0, 0.8, 0] },
    { pos: [-2.2, 4.2, 8.4], look: [0.4, 1.4, 0] },
    { pos: [-0.5, 3.4, 9], look: [0.3, 1.8, 0] },
    { pos: [0.2, 3.2, 10.5], look: [0.2, 2.3, 0] },
    { pos: [0.3, 6.5, 7.5], look: [0.3, -1.2, -1] },
    { pos: [0.2, 2, 8.2], look: [0.2, 1.6, 0] },
    { pos: [0.3, 1.6, 8], look: [0.3, 1.3, 0] },
    { pos: [0.2, 0.9, 9.5], look: [0.2, 0.4, 0] },
  ];

  const state = { target: 0, value: 0, active: true, px: 0, py: 0, tpx: 0, tpy: 0 };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let frame = 0;
  let t0 = performance.now();

  function chapter(p: number): { i: number; k: number } {
    for (let i = 0; i < SCENES.length - 1; i += 1) if (p < SCENES[i + 1]!) return { i, k: (p - SCENES[i]!) / (SCENES[i + 1]! - SCENES[i]!) };
    return { i: SCENES.length - 2, k: 1 };
  }

  function render() {
    frame = requestAnimationFrame(render);
    if (!state.active) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    state.value += (state.target - state.value) * 0.12; // SCRUB_SMOOTHING
    state.px += (state.tpx - state.px) * 0.05;
    state.py += (state.tpy - state.py) * 0.05;
    const p = state.value;
    const { i, k } = chapter(p);
    const e = smooth(0, 1, k);

    // Kamera: bobdan bobga silliq o‘tish.
    const a = CAM[i]!;
    const b = CAM[Math.min(CAM.length - 1, i + 1)]!;
    tmpA.set(...a.pos).lerp(tmpB.set(...b.pos), e);
    camPos.copy(tmpA);
    tmpA.set(...a.look).lerp(tmpB.set(...b.look), e);
    camLook.copy(tmpA);
    camera.position.copy(camPos).add(new THREE.Vector3(state.px * 0.35, -state.py * 0.25, 0));
    camera.lookAt(camLook);

    // 01: quyosh haqiqiy vaqt nuqtasiga ko‘tariladi; keyin sekin yuqoriga suriladi.
    const rise = smooth(0, 0.1, p);
    const u = lerp(0.02, clamp01(labels.sunArc), rise);
    const pos = arcPoint(Math.min(0.98, u));
    if (labels.night && p < SCENES[1]!) pos.set(ARC_R * 0.85, -1.4, -2.5); // tunda: o‘ng uchda, ufq ostida — faqat shu’la
    sun.position.copy(pos);
    const sunFade = (labels.night && p < SCENES[1]! ? 0.45 : 1) * (1 - smooth(0.3, 0.5, p) * 0.7);
    sunMat.opacity = sunFade;
    halo.material.opacity = sunFade;
    (arcLine.material as THREE.LineDashedMaterial).opacity = 0.55 * (1 - smooth(0.12, 0.3, p));
    horizon.visible = p < 0.5;
    (stars.material as THREE.PointsMaterial).opacity = labels.night ? 0.85 * (1 - smooth(0.1, 0.3, p)) : 0.25;

    // 02: panellar qatorma-qator «teriladi» (ufqdan uzoq tomondan).
    const build = smooth(SCENES[1]!, SCENES[2]!, p);
    panels.forEach((mesh, idx) => {
      const order = (idx % cols) / cols * 0.5 + Math.floor(idx / cols) / rows * 0.5;
      const s = smooth(order * 0.7, order * 0.7 + 0.35, build);
      mesh.scale.setScalar(Math.max(0.001, s));
    });

    // 03: energiya oqimi zarrachalari.
    const flowOn = window4(SCENES[2]!, SCENES[2]! + 0.04, SCENES[4]! - 0.05, SCENES[4]!, p);
    flowMat.opacity = 0.95 * flowOn;
    for (let n = 0; n < FLOW; n += 1) {
      const f = ((now / 1600 + n / FLOW) % 1);
      flowCurve.getPoint(f, tmpA);
      flowPos[n * 3] = tmpA.x;
      flowPos[n * 3 + 1] = tmpA.y;
      flowPos[n * 3 + 2] = tmpA.z;
    }
    flowGeo.attributes.position!.needsUpdate = true;

    // 04: tejash kartasi.
    (savingCard.material as THREE.MeshBasicMaterial).opacity = window4(SCENES[3]!, SCENES[3]! + 0.04, SCENES[4]! - 0.04, SCENES[4]!, p);
    // 05: xarita.
    const mapOn = window4(SCENES[4]!, SCENES[4]! + 0.05, SCENES[5]!, SCENES[5]! + 0.03, p);
    (grid.material as THREE.Material).opacity = 0.6 * mapOn;
    nodeMat.opacity = mapOn;
    nodes.forEach((node, idx) => node.scale.setScalar(1 + 0.25 * Math.sin(now / 500 + idx)));
    house.visible = p < SCENES[4]! + 0.04;
    // 06: takliflar.
    const quoteOn = window4(SCENES[5]!, SCENES[5]! + 0.04, SCENES[6]! - 0.03, SCENES[6]!, p);
    quoteMats.forEach((mat, idx) => (mat.opacity = quoteOn * (idx === 1 ? 1 : 0.7)));
    // 07: montaj.
    const stepOn = window4(SCENES[6]!, SCENES[6]! + 0.04, SCENES[7]! - 0.03, SCENES[7]!, p);
    const stepK = smooth(SCENES[6]! + 0.02, SCENES[7]! - 0.04, p) * (STEPS - 1);
    stepMats.forEach((mat, idx) => (mat.opacity = stepOn * (idx <= stepK + 0.01 ? 1 : 0.35)));
    ring.position.x = (stepK - (STEPS - 1) / 2) * 1.1;
    ringMat.opacity = stepOn;
    // 08: katta quyosh HTML so‘z belgisi ortida (z < 0), yoy to‘liq aylana bo‘lib chiziladi.
    const fin = smooth(SCENES[7]!, SCENES[7]! + 0.06, p);
    if (fin > 0) {
      sun.position.lerp(tmpA.set(-1.3, 1.9, -5), fin);
      sun.scale.setScalar(1 + fin * 1.4);
      sunMat.opacity = 0.35 + 0.25 * fin;
      halo.material.opacity = 0.35 + 0.45 * fin;
    } else sun.scale.setScalar(1);
    finalRing.material.opacity = 0.6 * fin;
    finalRing.rotation.z = -Math.PI / 2;
    finalRing.geometry.setDrawRange(0, Math.floor(fin * 129));
    void dt;
    renderer.render(scene, camera);
  }
  render();

  const onPointer = (event: PointerEvent) => {
    state.tpx = (event.clientX / window.innerWidth) * 2 - 1;
    state.tpy = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Tor (vertikal) ekranda sahnani uzoqlashtirib, hammasi sig‘ishini ta’minlaymiz.
    camera.fov = w / h < 0.75 ? 52 : w / h < 1.1 ? 42 : 34;
    // Keng ekranda sahna biroz o‘ngga suriladi: chapda matn uchun joy qoladi.
    if (w / h > 1.15) camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    setProgress(progress) {
      state.target = clamp01(progress);
    },
    setActive(active) {
      state.active = active;
    },
    resize,
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
