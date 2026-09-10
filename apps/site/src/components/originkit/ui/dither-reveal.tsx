"use client";

import { type CSSProperties, useEffect, useRef } from "react";

const DEFAULT_IMAGE =
  "https://plus.unsplash.com/premium_photo-1726099913477-291d8ca697f8?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8YWVzdGhldGljJTIwY29sb3JmdWwlMjBwb3J0cmFpdCUyMGZ1dHVyaXN0aWN8ZW58MHx8MHx8fDA%3D";

const DITHER_INDEX: Record<string, number> = {
  bayer8: 0,
  lines: 1,
  noise: 2,
};

const DEFAULTS = {
  image: { src: DEFAULT_IMAGE },
  fit: "cover" as "cover" | "contain",
  focusY: 50,
  ditherStyle: "bayer8" as "bayer8" | "lines" | "noise",
  dotSize: 5,
  revealRadius: 100,
  revealSoftness: 50,
  wave: true,
  waveSpeed: 82,
  waveDensity: 25,
};

interface DitherRevealProps {
  image?: { src?: string; url?: string; alt?: string } | string;
  fit?: "cover" | "contain";
  focusY?: number;
  ditherStyle?: "bayer8" | "lines" | "noise";
  dotSize?: number;
  revealRadius?: number;
  revealSoftness?: number;
  wave?: boolean;
  waveSpeed?: number;
  waveDensity?: number;
  style?: CSSProperties;
}

function clamp(n: any, min: number, max: number, fallback: number) {
  const v = typeof n === "number" ? n : parseFloat(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function imageURL(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.src || value.url || "";
}

function settings(p: DitherRevealProps) {
  const waveOn = p?.wave ?? DEFAULTS.wave;
  const speed = waveOn
    ? clamp(p?.waveSpeed, 1, 100, DEFAULTS.waveSpeed) / 100
    : 0;
  return {
    fit: (p?.fit ?? DEFAULTS.fit) === "contain" ? 1 : 0,
    focusY: clamp(p?.focusY, 0, 100, DEFAULTS.focusY) / 100,
    ditherStyle: p?.ditherStyle ?? DEFAULTS.ditherStyle,
    pixelSize: clamp(p?.dotSize, 1, 20, DEFAULTS.dotSize) / 2,
    revealRadius: clamp(p?.revealRadius, 20, 600, DEFAULTS.revealRadius),
    revealSoftness:
      clamp(p?.revealSoftness, 0, 100, DEFAULTS.revealSoftness) / 100,
    waveSpeed: speed,
    waveFrequency: clamp(p?.waveDensity, 5, 100, DEFAULTS.waveDensity) / 10,
    waveAmplitude: speed * 0.4,
    waveMargin: speed * 0.4 * 0.15,
  };
}

export default function DitherReveal(props: DitherRevealProps) {
  const {
    image = DEFAULTS.image,
    fit = DEFAULTS.fit,
    focusY = DEFAULTS.focusY,
    ditherStyle = DEFAULTS.ditherStyle,
    dotSize = DEFAULTS.dotSize,
    revealRadius = DEFAULTS.revealRadius,
    revealSoftness = DEFAULTS.revealSoftness,
    wave = DEFAULTS.wave,
    waveSpeed = DEFAULTS.waveSpeed,
    waveDensity = DEFAULTS.waveDensity,
    style,
  } = props;

  const S = settings({
    fit,
    focusY,
    ditherStyle,
    dotSize,
    revealRadius,
    revealSoftness,
    wave,
    waveSpeed,
    waveDensity,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const liveRef = useRef(S);
  liveRef.current = S;
  const inViewRef = useRef(true);

  const imgUrl = imageURL(image) || DEFAULT_IMAGE;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    function compile(type: number, source: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, source);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.warn("DitherReveal shader:", gl!.getShaderInfoLog(sh));
      }
      return sh;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("DitherReveal link:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uTime = u("uTime");
    const uMouse = u("uMouse");
    const uMouseActive = u("uMouseActive");
    const uRevealRadius = u("uRevealRadius");
    const uRevealSoftness = u("uRevealSoftness");
    const uPixelSize = u("uPixelSize");
    const uDitherStyle = u("uDitherStyle");
    const uWaveSpeed = u("uWaveSpeed");
    const uWaveFrequency = u("uWaveFrequency");
    const uWaveAmplitude = u("uWaveAmplitude");
    const uWaveMargin = u("uWaveMargin");
    const uCanvasAspect = u("uCanvasAspect");
    const uImageAspect = u("uImageAspect");
    const uResolution = u("uResolution");
    const uFit = u("uFit");
    const uFocusY = u("uFocusY");

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([20, 20, 20, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let imgAspect = 1.5;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (img.naturalHeight > 0)
        imgAspect = img.naturalWidth / img.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img,
        );
      } catch {
        // A host without CORS headers taints the upload — keep the
        // placeholder rather than tearing the effect down.
      }
    };
    img.onerror = () =>
      console.warn("DitherReveal: image failed to load:", imgUrl);
    img.src = imgUrl;

    const mouse = { x: 0.5, y: 0.5, active: 0, target: 0, entered: false };

    function onMove(e: PointerEvent) {
      const r = container!.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
      mouse.entered = true;
      mouse.target = 1;
    }
    const onEnter = () => (mouse.target = 1);
    const onLeave = () => (mouse.target = 0);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointerleave", onLeave);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas!.width = Math.max(1, Math.floor(container!.clientWidth * dpr));
      canvas!.height = Math.max(1, Math.floor(container!.clientHeight * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const io = new IntersectionObserver(
      ([entry]) => (inViewRef.current = entry.isIntersecting),
      { threshold: 0.01 },
    );
    io.observe(container);

    const start = performance.now();
    let raf = 0;
    function render() {
      raf = requestAnimationFrame(render);
      const L = liveRef.current;
      if (!inViewRef.current) return;

      const now = performance.now();
      mouse.active += (mouse.target - mouse.active) * 0.08;

      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.uniform2f(uMouse, mouse.x, mouse.y);
      gl!.uniform1f(uMouseActive, mouse.entered ? mouse.active : 0);
      gl!.uniform1f(uRevealRadius, L.revealRadius);
      gl!.uniform1f(uRevealSoftness, L.revealSoftness);
      gl!.uniform1f(uPixelSize, L.pixelSize);
      gl!.uniform1f(uDitherStyle, DITHER_INDEX[L.ditherStyle] ?? 0);
      gl!.uniform1f(uWaveSpeed, L.waveSpeed);
      gl!.uniform1f(uWaveFrequency, L.waveFrequency);
      gl!.uniform1f(uWaveAmplitude, L.waveAmplitude);
      gl!.uniform1f(uWaveMargin, L.waveMargin);
      gl!.uniform1f(uCanvasAspect, canvas!.width / canvas!.height);
      gl!.uniform1f(uImageAspect, imgAspect);
      gl!.uniform2f(
        uResolution,
        container!.clientWidth || 1,
        container!.clientHeight || 1,
      );
      gl!.uniform1f(uFit, L.fit);
      gl!.uniform1f(uFocusY, L.focusY);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      img.onload = null;
      img.onerror = null;
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
    };
  }, [imgUrl]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uRevealRadius;
uniform float uRevealSoftness;
uniform float uPixelSize;
uniform float uDitherStyle;

uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform float uWaveMargin;

uniform float uCanvasAspect;
uniform float uImageAspect;
uniform vec2 uResolution;
uniform float uFit;
uniform float uFocusY;

varying vec2 vUv;

float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
float Bayer4(vec2 a) { return Bayer2(a * 0.5) * 0.25 + Bayer2(a); }
float Bayer8(vec2 a) { return Bayer4(a * 0.5) * 0.25 + Bayer2(a); }

float ign(vec2 p) {
    return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

float ordered3(float gray, float thr) {
    float adj = gray + (thr - 0.5) * 0.5;
    return adj < 0.33 ? 0.0 : (adj < 0.66 ? 0.5 : 1.0);
}

float ditherTone(float gray, float ps) {
    vec2 fc = gl_FragCoord.xy / ps;
    if (uDitherStyle < 0.5) {
        return ordered3(gray, Bayer8(fc));
    } else if (uDitherStyle < 1.5) {
        float period = ps * 4.0;
        float v = fract((gl_FragCoord.x + gl_FragCoord.y) / period);
        return 1.0 - step(v, 1.0 - gray);
    }
    return step(ign(fc), gray);
}

vec2 fitUv(vec2 uv) {
    vec2 cover = uCanvasAspect < uImageAspect
        ? vec2(uCanvasAspect / uImageAspect, 1.0)
        : vec2(1.0, uImageAspect / uCanvasAspect);
    vec2 s = uFit > 0.5 ? 1.0 / cover : cover / (1.0 + 2.0 * uWaveMargin);
    vec2 out_ = (uv - 0.5) * s + 0.5;
    out_.y += (1.0 - s.y) * (0.5 - uFocusY) * step(s.y, 1.0);
    return out_;
}

void main() {
    vec2 uv = vUv;
    float time = uTime;
    float waveStrength = uWaveAmplitude * 0.1;
    float revealNorm = uRevealRadius / max(min(uResolution.x, uResolution.y), 1.0);

    float wave1 = sin(uv.y * uWaveFrequency + time * uWaveSpeed) * waveStrength;
    float wave2 = sin(uv.x * uWaveFrequency * 0.7 + time * uWaveSpeed * 0.8) * waveStrength * 0.5;

    vec2 distortedUv = uv;
    distortedUv.x += wave1;
    distortedUv.y += wave2;

    if (uMouseActive > 0.01) {
        float dist = distance(uv, uMouse);
        float mouseInfluence = smoothstep(revealNorm, 0.0, dist);
        float ripple = sin(dist * uWaveFrequency * 5.0 - time * uWaveSpeed)
            * uWaveAmplitude * 0.05 * mouseInfluence * uMouseActive;
        distortedUv.x += ripple;
        distortedUv.y += ripple;
    }

    vec2 sampleUv = fitUv(distortedUv);
    vec4 color = texture2D(uTexture, sampleUv);
    vec2 inside = step(vec2(0.0), sampleUv) * step(sampleUv, vec2(1.0));
    color *= inside.x * inside.y;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float ps = max(uPixelSize, 0.25);
    float tone = ditherTone(gray, ps);
    vec3 ditherColor = vec3(tone);

    float revealDist = distance(uv * uResolution, uMouse * uResolution);
    float innerRadius = max(0.0, uRevealRadius * (1.0 - uRevealSoftness));
    float outerRadius = uRevealRadius * (1.0 + uRevealSoftness) + 0.001;
    float revealAmount = (1.0 - smoothstep(innerRadius, outerRadius, revealDist)) * uMouseActive;

    gl_FragColor = vec4(mix(ditherColor, color.rgb, revealAmount), color.a);
}
`;
