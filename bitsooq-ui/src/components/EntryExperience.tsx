import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DURATION = 3400;

function makeProgram(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function startParticleField(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return undefined;

  const vertex = makeProgram(gl, gl.VERTEX_SHADER, `
    attribute vec3 a_position;
    attribute float a_seed;
    attribute float a_size;
    uniform float u_time;
    uniform float u_assembly;
    uniform float u_zoom;
    uniform float u_aspect;
    varying float v_alpha;
    varying vec3 v_color;
    void main() {
      float theta = u_time * 0.075 + a_seed * 6.28318;
      float cs = cos(theta);
      float sn = sin(theta);
      vec2 spun = mat2(cs, -sn, sn, cs) * a_position.xy;
      float depthDrift = sin(u_time * 0.24 + a_seed * 46.0) * 0.035;
      vec3 space = vec3(spun + vec2(0.0, depthDrift), a_position.z + u_zoom * 10.0);
      float ringAngle = a_seed * 628.318 + u_time * 0.02;
      float ringRadius = 0.25 + fract(a_seed * 83.71) * 0.68;
      vec2 formed = vec2(cos(ringAngle) * ringRadius, sin(ringAngle) * ringRadius * 0.42);
      vec2 point = mix(space.xy, formed, u_assembly);
      float z = mix(space.z, 0.0, u_assembly);
      float perspective = 1.0 / max(0.44, 1.0 + z * 0.027);
      gl_Position = vec4(point.x * perspective / u_aspect, point.y * perspective, 0.0, 1.0);
      gl_PointSize = clamp(a_size * (0.75 + u_zoom * 1.15) * perspective, 1.0, 5.5);
      float travel = smoothstep(-22.0, -3.0, space.z);
      v_alpha = mix(0.0, 0.83, u_assembly) + (1.0 - u_assembly) * travel * 0.55;
      float hue = 0.5 + 0.5 * sin(a_seed * 31.0 + u_time * 0.16);
      v_color = mix(vec3(0.02, 0.72, 0.83), vec3(0.31, 0.88, 0.95), hue);
    }
  `);
  const fragment = makeProgram(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying float v_alpha;
    varying vec3 v_color;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p);
      float core = 1.0 - smoothstep(0.12, 0.5, d);
      float glow = 1.0 - smoothstep(0.12, 0.72, d);
      gl_FragColor = vec4(v_color, (core * 0.9 + glow * 0.22) * v_alpha);
    }
  `);
  if (!vertex || !fragment) return undefined;

  const program = gl.createProgram();
  if (!program) return undefined;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;

  const count = 1450;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  let state = 43117;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    positions[index] = Math.cos(angle) * radius * 1.5;
    positions[index + 1] = Math.sin(angle) * radius * 1.0;
    positions[index + 2] = -2 - random() * 26;
    seeds[i] = random();
    sizes[i] = 1.0 + random() * 2.2;
  }

  const bindAttribute = (name: string, data: Float32Array, size: number) => {
    const buffer = gl.createBuffer();
    if (!buffer) return -1;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return location;
  };

  gl.useProgram(program);
  bindAttribute('a_position', positions, 3);
  bindAttribute('a_seed', seeds, 1);
  bindAttribute('a_size', sizes, 1);
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const assemblyLocation = gl.getUniformLocation(program, 'u_assembly');
  const zoomLocation = gl.getUniformLocation(program, 'u_zoom');
  const aspectLocation = gl.getUniformLocation(program, 'u_aspect');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0.018, 0.027, 0.047, 0);

  let frame = 0;
  let disposed = false;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);
  const startedAt = performance.now();
  const render = (now: number) => {
    if (disposed) return;
    const elapsed = (now - startedAt) / 1000;
    const zoom = Math.min(1, elapsed / 1.5);
    const assemble = Math.max(0, Math.min(1, (elapsed - 0.72) / 1.62));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLocation, elapsed);
    gl.uniform1f(assemblyLocation, assemble * assemble * (3 - 2 * assemble));
    gl.uniform1f(zoomLocation, zoom);
    gl.uniform1f(aspectLocation, Math.max(0.65, canvas.width / Math.max(canvas.height, 1)));
    gl.drawArrays(gl.POINTS, 0, count);
    frame = window.requestAnimationFrame(render);
  };
  frame = window.requestAnimationFrame(render);
  return () => {
    disposed = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

export default function EntryExperience() {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('entry') === 'replay' || localStorage.getItem('bitsooq.visited') !== 'true';
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completed = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!visible) return;
    const cleanup = canvasRef.current ? startParticleField(canvasRef.current) : undefined;
    setWebgl(Boolean(cleanup));
    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      try { localStorage.setItem('bitsooq.visited', 'true'); } catch { /* The experience can still finish without storage. */ }
      setExiting(true);
      window.setTimeout(() => setVisible(false), 450);
    };
    finishRef.current = finish;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    const timer = window.setTimeout(finish, DURATION);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      finishRef.current = () => undefined;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      cleanup?.();
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className={`entry-experience ${exiting ? 'entry-exiting' : ''}`} role="presentation">
      <canvas ref={canvasRef} className={`entry-particles ${webgl ? '' : 'entry-particles-hidden'}`} aria-hidden="true" />
      {!webgl && <div className="entry-css-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>}
      <div className="entry-vignette" aria-hidden="true" />
      <div className="entry-center" aria-label="BitSooq بيت سوق">
        <span className="entry-orbit entry-orbit-a" aria-hidden="true" /><span className="entry-orbit entry-orbit-b" aria-hidden="true" />
        <div className="entry-emblem"><span>B</span><i>S</i></div>
        <strong className="entry-wordmark">Bit<span>Sooq</span></strong>
        <span className="entry-arabic" lang="ar" dir="rtl">بيت سوق</span>
        <span className="entry-caption">A marketplace, opening up</span>
      </div>
      <div className="entry-bottom"><span className="entry-progress"><i /></span><span>BITSOOQ · PAKISTAN</span></div>
      <button type="button" className="entry-skip" onClick={() => { if (!exiting) finishRef.current(); }}>{i18n.language === 'ar' ? 'تخطي' : 'Skip'} <kbd>SPACE</kbd></button>
    </div>
  );
}
