import { useEffect, useRef } from 'react';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

/** Suyuq «aurora» shader: domen buzilishi (domain warping) + sichqoncha tolqinlari, brend ranglarida. */
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uStrength;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uBase; uniform float uDark;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.02 + 11.7; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5*uRes.xy) / min(uRes.x, uRes.y);
  vec2 m = (uMouse - 0.5*uRes.xy) / min(uRes.x, uRes.y);
  float t = uTime * 0.07;
  float md = length(p - m);
  vec2 ripple = (p - m) / (md + 0.08) * exp(-md*3.2) * uStrength * 0.35;
  vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p*1.6 + 3.0*q + vec2(1.7, 9.2) + 0.9*t + ripple), fbm(p*1.6 + 3.0*q + vec2(8.3, 2.8) - 0.8*t - ripple));
  float f = fbm(p*1.4 + 3.2*r);
  vec3 col = mix(uBase, uA, smoothstep(0.15, 0.85, f));
  col = mix(col, uB, smoothstep(0.55, 1.0, r.x) * 0.55);
  float glow = exp(-md*2.4) * (0.10 + 0.22*uStrength);
  col += uB * glow;
  float vig = 1.0 - smoothstep(0.2, 1.25, length(uv - 0.5));
  col = mix(uBase, col, mix(0.55, 1.0, vig));
  float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * (uDark > 0.5 ? 0.035 : 0.02);
  gl_FragColor = vec4(col + grain, 1.0);
}`;

function parse(color: string, fallback: [number, number, number]): [number, number, number] {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return fallback;
  probe.fillStyle = '#000';
  probe.fillStyle = color || '#000';
  const hex = probe.fillStyle;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Butun hero orqasini egallaydigan WebGL fon. WebGL bo‘lmasa yoki harakat kamaytirilgan bo‘lsa — hech narsa chizilmaydi (CSS gradient qoladi).
 * `variant="brand"` to‘q ko‘k brend paneli uchun (har doim qorong‘i palitra).
 */
export function ShaderBackground({ variant = 'page' }: { variant?: 'page' | 'brand' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Shader xatosi:', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Shader link xatosi:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uStrength = u('uStrength'), uA = u('uA'), uB = u('uB'), uBase = u('uBase'), uDark = u('uDark');

    let dark = variant === 'brand';
    const applyPalette = () => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      dark = variant === 'brand' || root.getAttribute('data-theme') === 'dark';
      // Brend panelida rang temaga bog‘liq bo‘lmasin (qorong‘i temada --qs-color-primary yorqin bo‘lib ketadi): panel bo‘yicha qat’iy rang.
      const panelColor: Record<string, string> = { MASTER: '#087f61', ADMIN: '#1e3a8a' };
      const brandColor = panelColor[root.getAttribute('data-panel') ?? ''] ?? '#1456ff';
      const primary = variant === 'brand' ? parse(brandColor, [0.08, 0.34, 1]) : parse(styles.getPropertyValue('--qs-color-primary').trim(), [0.1, 0.3, 1]);
      const accent = parse(styles.getPropertyValue('--qs-color-accent').trim(), [1, 0.69, 0.12]);
      if (dark) {
        gl.uniform3f(uBase, primary[0] * 0.06 + 0.01, primary[1] * 0.06 + 0.02, primary[2] * 0.12 + 0.04);
        gl.uniform3f(uA, primary[0] * 0.6 + 0.01, primary[1] * 0.6 + 0.02, primary[2] * 0.7 + 0.05);
        gl.uniform3f(uB, accent[0], accent[1] * 0.85, accent[2] * 0.6);
      } else {
        gl.uniform3f(uBase, 0.972, 0.98, 1.0);
        gl.uniform3f(uA, 0.972 + (primary[0] - 0.972) * 0.3, 0.98 + (primary[1] - 0.98) * 0.3, 1.0 + (primary[2] - 1.0) * 0.3);
        gl.uniform3f(uB, 0.972 + (accent[0] - 0.972) * 0.55, 0.98 + (accent[1] - 0.98) * 0.55, 1.0 + (accent[2] - 1.0) * 0.55);
      }
      gl.uniform1f(uDark, dark ? 1 : 0);
    };
    applyPalette();
    const themeObserver = new MutationObserver(applyPalette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5; // shader og‘ir emas: pastroq piksel zichligi yetarli va tez
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();

    // WebGL konteksti yo‘qolsa (zaif GPU) — kanvas yashiriladi, CSS gradient fon qoladi (buzilgan rasm belgisi chiqmasin).
    const onLost = (event: Event) => {
      event.preventDefault();
      canvas.style.display = 'none';
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, strength: 0, target: 0 };
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (event.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (event.clientY - rect.top) / rect.height;
      mouse.target = 1;
    };
    const onLeave = () => {
      mouse.target = 0;
    };
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    observer.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', resize);

    let frame = 0;
    const start = performance.now();
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      mouse.strength += (mouse.target - mouse.strength) * 0.04;
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uMouse, mouse.x * canvas.width, mouse.y * canvas.height);
      gl.uniform1f(uStrength, mouse.strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      // Kontekst qasddan yo‘qotilmaydi: React (StrictMode) effektni qayta ishga tushirsa, o‘sha kanvas yana ishlatiladi.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [variant]);

  return <canvas ref={ref} className={`gm-shader-bg gm-shader-bg--${variant}`} aria-hidden="true" />;
}
