/**
 * MicroSlats — Interactive Flowy Wave Background (Vanilla JS + OGL)
 * Ported from React Bits <MicroSlats /> component.
 *
 * Simulates Navier-Stokes fluid velocity + sinusoidal swell waves
 * projected across a grid of organic rounded micro slats with glint highlights.
 */

import { Renderer, Program, Mesh, Triangle, RenderTarget, Texture } from './ogl.esm.js';

const SWELL_PRESETS = {
  swell: {
    scale: 1.5,
    speed: 0.6,
    direction: 250,
    chop: 0.55,
    stretch: 0,
    glint: 0.7,
    contrast: 1.25,
    perspective: 0.55,
    fog: 0.55
  },
  tide: {
    scale: 1.3,
    speed: 0.5,
    direction: 262,
    chop: 0.2,
    stretch: 0.12,
    glint: 0.45,
    contrast: 1.1,
    perspective: 0.5,
    fog: 0.4
  },
  storm: {
    scale: 0.55,
    speed: 1.6,
    direction: 236,
    chop: 1,
    stretch: 0.3,
    glint: 1.3,
    contrast: 1.8,
    perspective: 0.8,
    fog: 0.35
  },
  signal: {
    scale: 0.85,
    speed: 1.2,
    direction: 180,
    chop: 0.6,
    stretch: 0.85,
    glint: 0.25,
    contrast: 1.2,
    perspective: 0,
    fog: 0
  }
};

const FLUID_SIZE = 96;
const PRESSURE_STEPS = 16;
const SPLAT_FORCE = 6900;
const SPLASH_JETS = 3;
const PIXEL_BUDGET = 4.5e6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseColor = (value, fallback) => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    const resolved = ctx.fillStyle;
    if (resolved.startsWith('#')) {
      const n = parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255, parts[3] ? Number(parts[3]) : 1];
  } catch {
    return fallback;
  }
};

const passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidVertex = `#version 300 es
in vec2 position;
uniform vec2 uTexel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = position * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidHead = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

const splatFragment = `${fluidHead}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 offset = vUv - uPoint;
  offset.x *= uAspect;
  float falloff = exp(-dot(offset, offset) / uRadius);
  fragColor = vec4(texture(uTarget, vUv).xyz + uValue * falloff, 1.0);
}
`;

const curlFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  float left = texture(uVelocity, vL).y;
  float right = texture(uVelocity, vR).y;
  float top = texture(uVelocity, vT).x;
  float bottom = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}
`;

const vorticityFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uSwirl;
uniform float uDt;
void main() {
  float left = texture(uCurl, vL).x;
  float right = texture(uCurl, vR).x;
  float top = texture(uCurl, vT).x;
  float bottom = texture(uCurl, vB).x;
  float middle = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force = force / (length(force) + 0.0001) * uSwirl * middle;
  force.y = -force.y;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

const divergenceFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  vec2 middle = texture(uVelocity, vUv).xy;
  float left = vL.x < 0.0 ? -middle.x : texture(uVelocity, vL).x;
  float right = vR.x > 1.0 ? -middle.x : texture(uVelocity, vR).x;
  float top = vT.y > 1.0 ? -middle.y : texture(uVelocity, vT).y;
  float bottom = vB.y < 0.0 ? -middle.y : texture(uVelocity, vB).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

const pressureFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const projectFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(right - left, top - bottom);
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

const advectFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uFade;
void main() {
  vec2 from = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  fragColor = texture(uSource, from) / (1.0 + uFade * uDt);
}
`;

const scaleFragment = `${fluidHead}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  fragColor = texture(uSource, vUv) * uValue;
}
`;

const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uTime;
uniform float uScale;
uniform float uDirection;
uniform float uChop;
uniform float uStretch;
uniform float uGlint;
uniform float uContrast;
uniform float uPerspective;
uniform float uFog;
uniform float uIntro;
uniform sampler2D tVelocity;
uniform sampler2D tInk;
uniform vec2 uFluidTexel;
uniform float uFluid;
uniform float uInk;
uniform float uLean;
out vec4 fragColor;

const float TURN[4] = float[4](0.0, -0.95, 0.78, 1.62);
const float LENGTH[4] = float[4](2.6, 1.7, 1.12, 0.76);
const float HEIGHT[4] = float[4](1.0, 0.75, 0.5, 0.3);
const float SHIFT[4] = float[4](0.0, 2.3, 4.1, 1.1);

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float row = uGrid.y - 1.0 - cell.y;
  vec2 center = uOrigin + vec2(cell.x, row) * uGrid.zw + uSlat * 0.5;
  float v = clamp(center.y / uSize.y, 0.0, 1.0);

  vec2 flow = vec2(0.0);
  float ink = 0.0;
  if (uFluid > 0.5) {
    vec2 fluidUv = clamp(vec2(center.x / uSize.x, 1.0 - center.y / uSize.y), 0.0, 1.0);
    flow = texture(tVelocity, fluidUv).xy * uFluidTexel * uSize;
    ink = texture(tInk, fluidUv).x;
  }

  float horizon = mix(8.0, 0.5, uPerspective);
  float depth = (1.0 + horizon) / (v + horizon);
  vec2 world = vec2((center.x - uSize.x * 0.5) / uSize.y * depth, (depth - 1.0) * horizon * 2.2);
  world -= flow * 0.00018 * depth;
  world /= max(uScale, 0.05);

  float meander = 0.55 * sin(dot(world, vec2(0.23, 0.41)) * 0.9 + uTime * 0.13)
    + 0.3 * sin(dot(world, vec2(-0.37, 0.19)) * 1.4 - uTime * 0.09);

  float steep = uChop * 0.45;
  float height = 0.0;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float angle = uDirection + TURN[i];
    vec2 heading = vec2(cos(angle), sin(angle));
    float k = 6.2831853 / LENGTH[i];
    float omega = sqrt(9.81 * k) * 0.35;
    float theta = k * dot(world, heading) - omega * uTime + SHIFT[i] + meander * (0.6 + 0.3 * float(i));
    height += HEIGHT[i] * (cos(theta) + steep * cos(2.0 * theta));
    total += HEIGHT[i] * (1.0 + steep);
  }
  float level = clamp(0.5 + 0.5 * height / (total * 0.85), 0.0, 1.0);
  float crest = smoothstep(0.6, 1.0, level);
  float glint = crest * crest * uGlint;

  float haze = mix(1.0, 1.0 - uFog, pow(1.0 - v, 1.4));
  float light = (pow(level, uContrast) + glint * 0.8) * haze;
  float glow = 1.0 - exp(-max(ink, 0.0) * uInk * 1.6);
  light = 1.0 - (1.0 - clamp(light, 0.0, 1.0)) * (1.0 - glow);

  float front = uIntro * 1.35;
  float reveal = 1.0 - smoothstep(front - 0.35, front, v);
  float sweep = exp(-pow((v - front + 0.22) / 0.07, 2.0)) * (1.0 - uIntro);
  light = (light + sweep * 0.8) * reveal;
  light = max(light, 0.045 * reveal);
  float span = mix(1.0 - uStretch, 1.0, level) + glow * 0.3;
  span = clamp(span, 0.08, 1.0) * mix(0.1, 1.0, reveal);
  float tint = clamp(max(glint * 1.4, glow * 0.9) + sweep, 0.0, 1.0);
  float lean = clamp(flow.x / 1400.0, -1.0, 1.0) * uLean * reveal;

  fragColor = vec4(clamp(light, 0.0, 1.0), span, tint, 0.5 + 0.5 * lean);
}
`;

const slatFragment = `#version 300 es
precision highp float;
uniform sampler2D tField;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uRound;
uniform float uTilt;
uniform vec3 uColor;
uniform vec3 uGlintColor;
uniform vec4 uBackground;
out vec4 fragColor;

float pill(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 local = p - uOrigin;
  vec2 cell = floor(local / uGrid.zw);
  vec4 background = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  vec4 slat = vec4(0.0);
  int reach = uTilt > 0.0 ? 1 : 0;
  for (int dx = -1; dx <= 1; dx++) {
    if (abs(dx) > reach) continue;
    vec2 neighbour = cell + vec2(float(dx), 0.0);
    if (neighbour.x < 0.0 || neighbour.y < 0.0 || neighbour.x >= uGrid.x || neighbour.y >= uGrid.y) continue;
    vec4 field = texelFetch(tField, ivec2(int(neighbour.x), int(uGrid.y - 1.0 - neighbour.y)), 0);
    vec2 offset = local - neighbour * uGrid.zw - uSlat * 0.5;
    float angle = (field.a - 0.5) * 2.0 * uTilt;
    float c = cos(angle);
    float s = sin(angle);
    vec2 turned = vec2(c * offset.x + s * offset.y, c * offset.y - s * offset.x);
    vec2 halfSize = vec2(uSlat.x * 0.5, uSlat.y * 0.5 * field.g);
    float radius = uRound * min(halfSize.x, halfSize.y);
    float alpha = clamp(0.5 - pill(turned, halfSize, radius) * uDpr, 0.0, 1.0) * field.r;
    if (alpha > slat.a) slat = vec4(mix(uColor, uGlintColor, field.b) * alpha, alpha);
  }
  fragColor = slat + background * (1.0 - slat.a);
}
`;

export class MicroSlatsBackground {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) {
      console.warn('[MicroSlats] Container element not found.');
      return;
    }

    const presetName = options.preset || 'swell';
    const base = SWELL_PRESETS[presetName] || SWELL_PRESETS.swell;
    const pick = (value, key) => (value === undefined || value === null ? base[key] : value);

    // Merge settings
    this.settings = {
      color: parseColor(options.color || '#7657C8', [0.46, 0.34, 0.78, 1]),
      glintColor: parseColor(options.glintColor || '#ffffff', [1, 1, 1, 1]),
      backgroundColor: parseColor(options.backgroundColor || '#120f17', [0.07, 0.06, 0.09, 1]),
      slatWidth: options.slatWidth !== undefined ? options.slatWidth : 10,
      slatHeight: options.slatHeight !== undefined ? options.slatHeight : 25,
      gap: options.gap !== undefined ? options.gap : 3,
      roundness: options.roundness !== undefined ? options.roundness : 0.75,
      scale: pick(options.scale, 'scale'),
      speed: pick(options.speed, 'speed'),
      direction: pick(options.direction, 'direction'),
      chop: pick(options.chop, 'chop'),
      stretch: pick(options.stretch, 'stretch'),
      glint: pick(options.glint, 'glint'),
      contrast: pick(options.contrast, 'contrast'),
      perspective: pick(options.perspective, 'perspective'),
      fog: pick(options.fog, 'fog'),
      interactive: options.interactive !== undefined ? options.interactive : true,
      cursorStrength: options.cursorStrength !== undefined ? options.cursorStrength : 1,
      cursorSize: options.cursorSize !== undefined ? options.cursorSize : 40,
      swirl: options.swirl !== undefined ? options.swirl : 0,
      trail: options.trail !== undefined ? options.trail : 1.4,
      lean: options.lean !== undefined ? options.lean : 0,
      intro: options.intro !== undefined ? options.intro : true,
      introDuration: options.introDuration || 1.5,
      paused: false
    };

    this.init();
  }

  init() {
    const container = this.container;
    this.renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      webgl: 2
    });

    const gl = this.renderer.gl;
    if (!this.renderer.isWebgl2) {
      console.warn('[MicroSlats] WebGL2 not supported.');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    this.canvas = gl.canvas;
    this.canvas.className = 'microslats-canvas';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '-1',
      pointerEvents: 'none',
      display: 'block'
    });
    this.canvas.setAttribute('aria-hidden', 'true');
    container.prepend(this.canvas);

    this.geometry = new Triangle(gl);
    this.blank = new Texture(gl);
    this.floatTargets = !!(
      gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
    );

    this.fieldTarget = new RenderTarget(gl, {
      width: 1,
      height: 1,
      depth: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });

    this.fieldUniforms = {
      uSize: { value: [1, 1] },
      uGrid: { value: [1, 1, 1, 1] },
      uOrigin: { value: [0, 0] },
      uSlat: { value: [1, 1] },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uDirection: { value: 0 },
      uChop: { value: 0.5 },
      uStretch: { value: 0.3 },
      uGlint: { value: 1 },
      uContrast: { value: 1 },
      uPerspective: { value: 0.7 },
      uFog: { value: 0.5 },
      uIntro: { value: 0 },
      tVelocity: { value: this.blank },
      tInk: { value: this.blank },
      uFluidTexel: { value: [1, 1] },
      uFluid: { value: 0 },
      uInk: { value: 1 },
      uLean: { value: 0.5 }
    };

    this.fieldMesh = new Mesh(gl, {
      geometry: this.geometry,
      program: new Program(gl, {
        vertex: passVertex,
        fragment: fieldFragment,
        uniforms: this.fieldUniforms,
        depthTest: false,
        depthWrite: false
      })
    });

    this.slatUniforms = {
      tField: { value: this.fieldTarget.texture },
      uSize: { value: [1, 1] },
      uDpr: { value: 1 },
      uGrid: { value: [1, 1, 1, 1] },
      uOrigin: { value: [0, 0] },
      uSlat: { value: [1, 1] },
      uRound: { value: 1 },
      uTilt: { value: 0 },
      uColor: { value: [1, 1, 1] },
      uGlintColor: { value: [1, 1, 1] },
      uBackground: { value: [0, 0, 0, 1] }
    };

    this.slatMesh = new Mesh(gl, {
      geometry: this.geometry,
      program: new Program(gl, {
        vertex: passVertex,
        fragment: slatFragment,
        uniforms: this.slatUniforms,
        depthTest: false,
        depthWrite: false
      })
    });

    this.fluidTexel = { value: [1, 1] };
    const fluidPass = (fragment, uniforms) =>
      new Mesh(gl, {
        geometry: this.geometry,
        program: new Program(gl, {
          vertex: fluidVertex,
          fragment,
          uniforms: { uTexel: this.fluidTexel, ...uniforms },
          depthTest: false,
          depthWrite: false
        })
      });

    this.splatPass = fluidPass(splatFragment, {
      uTarget: { value: this.blank },
      uAspect: { value: 1 },
      uPoint: { value: [0, 0] },
      uValue: { value: [0, 0, 0] },
      uRadius: { value: 0.01 }
    });
    this.curlPass = fluidPass(curlFragment, { uVelocity: { value: this.blank } });
    this.vorticityPass = fluidPass(vorticityFragment, {
      uVelocity: { value: this.blank },
      uCurl: { value: this.blank },
      uSwirl: { value: 20 },
      uDt: { value: 0.016 }
    });
    this.divergencePass = fluidPass(divergenceFragment, { uVelocity: { value: this.blank } });
    this.pressurePass = fluidPass(pressureFragment, { uPressure: { value: this.blank }, uDivergence: { value: this.blank } });
    this.projectPass = fluidPass(projectFragment, { uPressure: { value: this.blank }, uVelocity: { value: this.blank } });
    this.advectPass = fluidPass(advectFragment, {
      uVelocity: { value: this.blank },
      uSource: { value: this.blank },
      uDt: { value: 0.016 },
      uFade: { value: 1 }
    });
    this.scalePass = fluidPass(scaleFragment, { uSource: { value: this.blank }, uValue: { value: 0 } });

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.raf = 0;
    this.last = performance.now();
    this.time = 0;
    this.introClock = 0;
    this.visible = true;
    this.alive = true;
    this.fluid = null;
    this.fluidUntil = 0;
    this.fluidDirty = false;
    this.splashTurn = 0;
    this.splats = [];
    this.pointer = { x: 0, y: 0, tracked: false };

    this.bindEvents();
    this.resize();
    this.start();
  }

  disposeTarget(target) {
    if (!target) return;
    const gl = this.renderer.gl;
    if (target.buffer) gl.deleteFramebuffer(target.buffer);
    if (target.texture && target.texture.texture) gl.deleteTexture(target.texture.texture);
  }

  floatTarget(w, h) {
    const gl = this.renderer.gl;
    return new RenderTarget(gl, {
      width: w,
      height: h,
      depth: false,
      type: gl.HALF_FLOAT,
      format: gl.RGBA,
      internalFormat: gl.RGBA16F,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR
    });
  }

  swapPair(w, h) {
    return {
      read: this.floatTarget(w, h),
      write: this.floatTarget(w, h),
      swap() {
        const next = this.read;
        this.read = this.write;
        this.write = next;
      }
    };
  }

  disposeFluid() {
    if (!this.fluid) return;
    [this.fluid.velocity, this.fluid.ink, this.fluid.pressure].forEach(pair => {
      this.disposeTarget(pair.read);
      this.disposeTarget(pair.write);
    });
    this.disposeTarget(this.fluid.divergence);
    this.disposeTarget(this.fluid.curl);
    this.fluid = null;
  }

  buildFluid() {
    if (!this.floatTargets) return;
    const aspect = this.width / this.height;
    const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
    const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
    if (this.fluid && this.fluid.width === w && this.fluid.height === h) return;
    this.disposeFluid();
    this.fluid = {
      width: w,
      height: h,
      velocity: this.swapPair(w, h),
      ink: this.swapPair(w, h),
      pressure: this.swapPair(w, h),
      divergence: this.floatTarget(w, h),
      curl: this.floatTarget(w, h)
    };
    this.fluidTexel.value = [1 / w, 1 / h];
  }

  resize() {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (this.width * this.height)));
    this.renderer.setSize(this.width, this.height);
    this.buildFluid();
    this.start();
  }

  layout(s) {
    const slatW = clamp(s.slatWidth, 1, 64);
    const slatH = clamp(s.slatHeight, 2, 240);
    const gapSize = clamp(s.gap, 0, 64);
    const pitchX = slatW + gapSize;
    const pitchY = slatH + gapSize;
    const cols = Math.min(2048, Math.ceil((this.width + gapSize) / pitchX) + 1);
    const rows = Math.min(2048, Math.ceil((this.height + gapSize) / pitchY) + 1);
    const originX = (this.width - (cols * pitchX - gapSize)) / 2;
    const originY = (this.height - (rows * pitchY - gapSize)) / 2;
    const gl = this.renderer.gl;

    if (this.fieldTarget.width !== cols || this.fieldTarget.height !== rows) {
      this.disposeTarget(this.fieldTarget);
      this.fieldTarget = new RenderTarget(gl, {
        width: cols,
        height: rows,
        depth: false,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST
      });
      this.slatUniforms.tField.value = this.fieldTarget.texture;
    }
    const tilt = Math.min(0.42, Math.asin(clamp((pitchX * 1.5 - slatW * 0.5) / (slatH * 0.5), 0, 1)));
    return { slatW, slatH, tilt, grid: [cols, rows, pitchX, pitchY], origin: [originX, originY] };
  }

  run(mesh, target) {
    this.renderer.render({ scene: mesh, target, clear: false });
  }

  splat(pair, point, value, radius) {
    const u = this.splatPass.program.uniforms;
    u.uTarget.value = pair.read.texture;
    u.uAspect.value = this.width / this.height;
    u.uPoint.value = point;
    u.uValue.value = value;
    u.uRadius.value = radius;
    this.run(this.splatPass, pair.write);
    pair.swap();
  }

  stepFluid(f, dt, s) {
    if (s.swirl > 0) {
      this.curlPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
      this.run(this.curlPass, f.curl);

      const vorticity = this.vorticityPass.program.uniforms;
      vorticity.uVelocity.value = f.velocity.read.texture;
      vorticity.uCurl.value = f.curl.texture;
      vorticity.uSwirl.value = clamp(s.swirl, 0, 2) * 40;
      vorticity.uDt.value = dt;
      this.run(this.vorticityPass, f.velocity.write);
      f.velocity.swap();
    }

    this.divergencePass.program.uniforms.uVelocity.value = f.velocity.read.texture;
    this.run(this.divergencePass, f.divergence);

    this.scalePass.program.uniforms.uSource.value = f.pressure.read.texture;
    this.scalePass.program.uniforms.uValue.value = 0.8;
    this.run(this.scalePass, f.pressure.write);
    f.pressure.swap();

    this.pressurePass.program.uniforms.uDivergence.value = f.divergence.texture;
    for (let i = 0; i < PRESSURE_STEPS; i++) {
      this.pressurePass.program.uniforms.uPressure.value = f.pressure.read.texture;
      this.run(this.pressurePass, f.pressure.write);
      f.pressure.swap();
    }

    this.projectPass.program.uniforms.uPressure.value = f.pressure.read.texture;
    this.projectPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
    this.run(this.projectPass, f.velocity.write);
    f.velocity.swap();

    const fade = 1 / clamp(s.trail, 0.1, 10);
    const advect = this.advectPass.program.uniforms;
    advect.uDt.value = dt;
    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.velocity.read.texture;
    advect.uFade.value = fade * 1.4;
    this.run(this.advectPass, f.velocity.write);
    f.velocity.swap();

    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.ink.read.texture;
    advect.uFade.value = fade;
    this.run(this.advectPass, f.ink.write);
    f.ink.swap();
  }

  clearFluid(f) {
    this.scalePass.program.uniforms.uValue.value = 0;
    [f.velocity, f.ink, f.pressure].forEach(pair => {
      this.scalePass.program.uniforms.uSource.value = pair.read.texture;
      this.run(this.scalePass, pair.write);
      pair.swap();
    });
  }

  frame(now) {
    this.raf = 0;
    if (!this.alive) return;
    const s = this.settings;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!s) return;

    if (!s.paused && !this.reducedMotion) this.time += dt * s.speed;
    this.introClock = s.intro && !this.reducedMotion ? this.introClock + dt / Math.max(0.2, s.introDuration) : 1;
    const introLinear = Math.min(this.introClock, 1);
    const introEase =
      introLinear < 0.5 ? 4 * introLinear * introLinear * introLinear : 1 - Math.pow(-2 * introLinear + 2, 3) / 2;

    if (this.fluid && this.splats.length) {
      const radius = Math.pow(clamp(s.cursorSize, 4, 600) / this.height, 2) * 0.35;
      const aspect = this.width / this.height;
      for (const [u, v, du, dv, turn] of this.splats) {
        if (turn === null) {
          this.splat(this.fluid.velocity, [u, v], [du * SPLAT_FORCE, dv * SPLAT_FORCE, 0], radius);
          this.splat(this.fluid.ink, [u, v], [0.13, 0, 0], radius);
          continue;
        }
        const jet = radius * 0.55;
        const reach = Math.sqrt(jet * 0.5) * 1.9;
        const push = SPLAT_FORCE * 0.08;
        for (let i = 0; i < SPLASH_JETS; i++) {
          const angle = turn + (i / SPLASH_JETS) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const point = [u + (dx * reach) / aspect, v + dy * reach];
          const spin = [(dx - dy) * Math.SQRT1_2 * push, (dy + dx) * Math.SQRT1_2 * push, 0];
          this.splat(this.fluid.velocity, point, spin, jet);
          this.splat(this.fluid.ink, point, [0.75, 0, 0], jet);
        }
        this.splat(this.fluid.ink, [u, v], [0.45, 0, 0], radius);
      }
      this.splats.length = 0;
      this.fluidDirty = true;
    }

    const fluidActive = this.fluid !== null && now < this.fluidUntil;
    if (this.fluid) {
      if (fluidActive) this.stepFluid(this.fluid, Math.min(Math.max(dt, 1 / 240), 1 / 30), s);
      else if (this.fluidDirty) {
        this.clearFluid(this.fluid);
        this.fluidDirty = false;
      }
    }

    const grid = this.layout(s);

    this.fieldUniforms.uSize.value = [this.width, this.height];
    this.fieldUniforms.uGrid.value = grid.grid;
    this.fieldUniforms.uOrigin.value = grid.origin;
    this.fieldUniforms.uSlat.value = [grid.slatW, grid.slatH];
    this.fieldUniforms.uTime.value = this.time;
    this.fieldUniforms.uScale.value = s.scale;
    this.fieldUniforms.uDirection.value = (s.direction * Math.PI) / 180;
    this.fieldUniforms.uChop.value = clamp(s.chop, 0, 1.5);
    this.fieldUniforms.uStretch.value = clamp(s.stretch, 0, 0.95);
    this.fieldUniforms.uGlint.value = Math.max(0, s.glint);
    this.fieldUniforms.uContrast.value = clamp(s.contrast, 0.2, 4);
    this.fieldUniforms.uPerspective.value = clamp(s.perspective, 0, 1);
    this.fieldUniforms.uFog.value = clamp(s.fog, 0, 1);
    this.fieldUniforms.uIntro.value = introEase;
    this.fieldUniforms.uFluid.value = fluidActive ? 1 : 0;
    this.fieldUniforms.tVelocity.value = this.fluid ? this.fluid.velocity.read.texture : this.blank;
    this.fieldUniforms.tInk.value = this.fluid ? this.fluid.ink.read.texture : this.blank;
    this.fieldUniforms.uFluidTexel.value = this.fluidTexel.value;
    this.fieldUniforms.uInk.value = clamp(s.cursorStrength, 0, 3);
    this.fieldUniforms.uLean.value = clamp(s.lean, 0, 1);
    this.renderer.render({ scene: this.fieldMesh, target: this.fieldTarget });

    this.slatUniforms.uSize.value = [this.width, this.height];
    this.slatUniforms.uDpr.value = this.renderer.dpr;
    this.slatUniforms.uGrid.value = grid.grid;
    this.slatUniforms.uOrigin.value = grid.origin;
    this.slatUniforms.uSlat.value = [grid.slatW, grid.slatH];
    this.slatUniforms.uRound.value = clamp(s.roundness, 0, 1);
    this.slatUniforms.uTilt.value = fluidActive && s.lean > 0 ? grid.tilt : 0;
    this.slatUniforms.uColor.value = s.color.slice(0, 3);
    this.slatUniforms.uGlintColor.value = s.glintColor.slice(0, 3);
    this.slatUniforms.uBackground.value = s.backgroundColor;
    this.renderer.render({ scene: this.slatMesh });

    const moving = (!s.paused && !this.reducedMotion && s.speed !== 0) || this.introClock < 1;
    if (this.visible && (moving || fluidActive || this.fluidDirty)) {
      this.raf = requestAnimationFrame(this.frame.bind(this));
    }
  }

  start() {
    if (this.raf || !this.visible || !this.alive) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame.bind(this));
  }

  queueSplat(u, v, du, dv, turn) {
    if (this.splats.length > 32) this.splats.shift();
    this.splats.push([u, v, du, dv, turn]);
    const s = this.settings;
    this.fluidUntil = performance.now() + Math.max(1.5, (s ? s.trail : 1.4) * 5) * 1000;
    this.start();
  }

  bindEvents() {
    this._onPointerMove = e => {
      const s = this.settings;
      if (!this.fluid || !s || !s.interactive || this.reducedMotion) return;
      const x = e.clientX;
      const y = e.clientY;
      const w = this.width;
      const h = this.height;
      const u = x / w;
      const v = 1 - y / h;

      if (this.pointer.tracked && (x !== this.pointer.x || y !== this.pointer.y)) {
        this.queueSplat(u, v, (x - this.pointer.x) / h, (this.pointer.y - y) / h, null);
      }
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.tracked = true;
    };

    this._onPointerDown = e => {
      const s = this.settings;
      if (!this.fluid || !s || !s.interactive || this.reducedMotion) return;
      const u = e.clientX / this.width;
      const v = 1 - e.clientY / this.height;
      this.splashTurn += 2.39996;
      this.queueSplat(u, v, 0, 0, this.splashTurn);
    };

    this._onPointerLeave = () => {
      this.pointer.tracked = false;
    };

    this._onVisibility = () => {
      if (!document.hidden) this.start();
    };

    this._onResize = () => {
      this.resize();
    };

    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    window.addEventListener('blur', this._onPointerLeave);
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  destroy() {
    this.alive = false;
    this.visible = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('blur', this._onPointerLeave);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);

    this.disposeFluid();
    this.disposeTarget(this.fieldTarget);
    const gl = this.renderer.gl;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
