/**
 * 3D RAYMARCHED GRADIENT WAVES (WEBGL 2.0 / OGL)
 * -------------------------------------------------------------
 * Ultra-Luxury Ethereal Silk Topography with Continuous Camera
 * Scroll Translation, Damped Mouse Parallax, Velvet Fresnel Sheen,
 * and Procedural Anti-Banding Micro Film Grain.
 *
 * Color Palette:
 * - Horizon / Dark Base:       #120D1F (Midnight Plum)
 * - Wave Slope:                 #7657C8 (Royal Electric Purple)
 * - Wave Crest / Highlight:     #D8C8FF (Luminescent Lilac)
 * - Page Background:            #0B0812 (Deep Obsidian Amethyst)
 */

import { Renderer, Program, Mesh, Triangle } from './ogl.esm.js';

const VERTEX_SHADER = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uSpeed;
uniform float uWaveHeight;
uniform float uWaveFreq;
uniform float uGrainIntensity;

// Color Palette Uniforms
uniform vec3 uColorBase;     // #120D1F
uniform vec3 uColorSlope;    // #7657C8
uniform vec3 uColorCrest;    // #D8C8FF
uniform vec3 uColorBg;       // #0B0812

// 2D Rotation Helper
mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

// Organic Layered Sinusoidal Silk Waves (Topological Topography)
float waveHeight(vec2 p, float time) {
    float t = time * uSpeed;
    vec2 q = p * uWaveFreq;

    // Harmonic Layer 1: Broad oceanic silk swell
    float w1 = sin(q.x * 0.48 + q.y * 0.38 + t * 1.05) * 1.35;
    
    // Harmonic Layer 2: Angled fluid ribbon folds
    vec2 p2 = rot(0.68) * q * 1.12;
    float w2 = sin(p2.x * 0.82 - p2.y * 0.58 - t * 0.85) * 0.75;
    
    // Harmonic Layer 3: Secondary silky undulating ridges
    vec2 p3 = rot(-0.85) * q * 1.75;
    float w3 = sin(p3.x * 1.25 + p3.y * 1.05 + t * 0.65) * 0.42;
    
    // Harmonic Layer 4: Fine velvet micro-crests
    vec2 p4 = rot(1.20) * q * 3.2;
    float w4 = sin(p4.x * 2.0 - p4.y * 2.2 - t * 1.25) * 0.14;

    // Crest sharpening: makes wave ridges crisp like flowing silk
    float combined = (w1 + w2 + w3 + w4) * 0.45;
    float sharpened = sign(combined) * pow(abs(combined), 1.18);

    return sharpened * uWaveHeight;
}

// Analytic Finite-Difference Normal
vec3 calcNormal(vec3 p, float time) {
    vec2 e = vec2(0.008, 0.0);
    float h = waveHeight(p.xz, time);
    vec3 n = vec3(
        waveHeight(p.xz - e.xy, time) - waveHeight(p.xz + e.xy, time),
        2.0 * e.x,
        waveHeight(p.xz - e.yx, time) - waveHeight(p.xz + e.yx, time)
    );
    return normalize(n);
}

// High-grade Interleaved Gradient / Hash Noise for Banding Prevention
float filmGrain(vec2 coord, float seed) {
    return fract(sin(dot(coord + fract(seed * 0.0137), vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    // Screen Normalized Coordinates centered [-1, 1]
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);

    // Smooth Interactive Camera Pivot & Scroll Navigation
    // Camera pitched down toward fluid waves to reveal dramatic 3D contour ridges
    float pitch = -0.48 + uMouse.y * 0.22;
    float yaw = uMouse.x * 0.35;

    // Ray origin positioned close to the silk topography
    vec3 ro = vec3(
        sin(uScroll * 1.2) * 0.5,
        1.85 + sin(uScroll * 1.8) * 0.2,
        -3.4 + uScroll * 9.5
    );

    // Camera Rotation Matrix
    mat2 rotX = rot(pitch);
    mat2 rotY = rot(yaw);

    vec3 rd = normalize(vec3(uv, 1.28));
    rd.yz = rotX * rd.yz;
    rd.xz = rotY * rd.xz;

    // Light source (cinematic neon rim from upper-back)
    vec3 lightDir = normalize(vec3(0.45, 0.75, -0.65));

    // Raymarch Variables
    float t = 0.4;
    float tMax = 36.0;
    float hit = 0.0;
    vec3 p;
    int stepCount = 0;

    // Adaptive Raymarch Loop
    for (int i = 0; i < 82; i++) {
        p = ro + rd * t;
        float h = p.y - waveHeight(p.xz, uTime);

        // Dynamic tolerance based on distance
        float tol = 0.0035 * t;
        if (abs(h) < tol) {
            hit = 1.0;
            stepCount = i;
            break;
        }

        if (t > tMax) break;

        // Step forward proportional to height delta
        t += max(h * 0.58, 0.024);
    }

    vec3 finalColor = uColorBg;

    if (hit > 0.5) {
        vec3 n = calcNormal(p, uTime);
        vec3 v = normalize(ro - p);

        // 1. Curvature & Slope Analysis
        float slope = clamp(1.0 - n.y, 0.0, 1.0);
        float elevation = smoothstep(-0.6, 1.4, p.y);
        float crestFactor = pow(clamp(n.y * elevation, 0.0, 1.0), 1.5);

        // 2. Base-to-Slope Midnight Plum (#120D1F) to Royal Purple (#7657C8)
        // Starts showing vivid electric purple on even modest slopes
        vec3 surfaceColor = mix(uColorBase, uColorSlope, smoothstep(0.04, 0.60, slope));

        // 3. Slope-to-Crest Glowing Lavender/Lilac (#D8C8FF)
        surfaceColor = mix(surfaceColor, uColorCrest, crestFactor * 0.85);

        // 4. Velvet & Ethereal Silk Fresnel Rim
        // Soft, glowing neon rim light along silk ridges
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        surfaceColor += uColorCrest * fresnel * 1.25;

        // 5. Anisotropic Specular Highlight
        vec3 hVector = normalize(lightDir + v);
        float spec = pow(max(dot(n, hVector), 0.0), 28.0);
        surfaceColor += uColorCrest * spec * 0.8;

        // 6. Ambient Purple Fill (ensures dark luxury richness instead of flat black)
        surfaceColor += uColorSlope * 0.16;

        // 7. Ambient Occlusion simulation in valleys
        float ao = clamp(0.45 + 0.55 * n.y, 0.0, 1.0);
        surfaceColor *= ao;

        // 8. Atmospheric Depth Mist (Fades into #0B0812 background)
        float fog = smoothstep(14.0, 35.0, t);
        finalColor = mix(surfaceColor, uColorBg, fog);

    } else {
        // Horizon / Sky: Dark obsidian amethyst gradient with purple aura near horizon
        float horizonGrad = smoothstep(-0.25, 0.45, rd.y);
        finalColor = mix(uColorBase * 0.9, uColorBg, horizonGrad);

        // Rich horizon aurora glow matching PTDI-STTD login
        float aurora = pow(max(0.0, 1.0 - abs(rd.y - 0.02) * 2.8), 3.0);
        finalColor += uColorSlope * aurora * 0.45 + uColorCrest * aurora * 0.15;
    }

    // 9. Procedural Film-Grain Noise to eliminate 8-bit gradient banding
    float grain = filmGrain(gl_FragCoord.xy, uTime * 60.0);
    finalColor += (grain - 0.5) * uGrainIntensity;

    // Output final cinematic color
    fragColor = vec4(finalColor, 1.0);
}
`;

export class RaymarchedSilkWaves {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.canvas = options.canvas || null;

        // Configuration
        this.config = {
            speed: options.speed !== undefined ? options.speed : 0.25,
            waveHeight: options.waveHeight !== undefined ? options.waveHeight : 1.85,
            waveFreq: options.waveFreq !== undefined ? options.waveFreq : 0.55,
            grainIntensity: options.grainIntensity !== undefined ? options.grainIntensity : 0.045,
            // Hex Palette:
            // Base:       #120D1F -> [18, 13, 31]
            // Slope:      #7657C8 -> [118, 87, 200]
            // Crest:      #D8C8FF -> [216, 200, 255]
            // Background: #0B0812 -> [11, 8, 18]
            colorBase: options.colorBase || [18 / 255, 13 / 255, 31 / 255],
            colorSlope: options.colorSlope || [118 / 255, 87 / 255, 200 / 255],
            colorCrest: options.colorCrest || [216 / 255, 200 / 255, 255 / 255],
            colorBg: options.colorBg || [11 / 255, 8 / 255, 18 / 255],
            scrollFactor: options.scrollFactor !== undefined ? options.scrollFactor : 1.0
        };

        // State & Interpolation
        this.time = 0;
        this.lastTime = performance.now();
        this.mouse = { x: 0, y: 0 };
        this.targetMouse = { x: 0, y: 0 };
        this.scroll = 0;
        this.targetScroll = 0;
        this.isDestroyed = false;

        this.init();
    }

    init() {
        // Create canvas if not provided
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'raymarch-waves-canvas';
            this.canvas.className = 'raymarch-waves-canvas';
            Object.assign(this.canvas.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '0',
                pointerEvents: 'none',
                display: 'block'
            });
            this.container.prepend(this.canvas);
        }

        // Initialize WebGL 2.0 OGL Renderer
        this.renderer = new Renderer({
            canvas: this.canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: Math.min(window.devicePixelRatio || 1, 2),
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
            webgl: 2
        });

        this.gl = this.renderer.gl;

        // Big Triangle Geometry (Full-screen quad with 0 overdraw)
        this.geometry = new Triangle(this.gl);

        // Uniforms definition
        this.uniforms = {
            uResolution: { value: [this.canvas.width, this.canvas.height] },
            uTime: { value: 0 },
            uMouse: { value: [0, 0] },
            uScroll: { value: 0 },
            uSpeed: { value: this.config.speed },
            uWaveHeight: { value: this.config.waveHeight },
            uWaveFreq: { value: this.config.waveFreq },
            uGrainIntensity: { value: this.config.grainIntensity },
            uColorBase: { value: this.config.colorBase },
            uColorSlope: { value: this.config.colorSlope },
            uColorCrest: { value: this.config.colorCrest },
            uColorBg: { value: this.config.colorBg }
        };

        // OGL Shader Program
        this.program = new Program(this.gl, {
            vertex: VERTEX_SHADER,
            fragment: FRAGMENT_SHADER,
            uniforms: this.uniforms,
            depthTest: false,
            depthWrite: false
        });

        // Mesh
        this.mesh = new Mesh(this.gl, {
            geometry: this.geometry,
            program: this.program
        });

        // Event listeners
        this.bindEvents();

        // Initial sizing & scroll position
        this.onResize();
        this.onScroll();

        // Start render loop
        this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    bindEvents() {
        this.handleResize = this.onResize.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleScroll = this.onScroll.bind(this);

        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        window.addEventListener('scroll', this.handleScroll, { passive: true });

        // Touch parallax support
        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                const t = e.touches[0];
                this.targetMouse.x = (t.clientX / window.innerWidth) * 2 - 1;
                this.targetMouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
            }
        }, { passive: true });
    }

    onResize() {
        if (!this.renderer) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.uniforms.uResolution.value = [this.gl.drawingBufferWidth, this.gl.drawingBufferHeight];
    }

    onMouseMove(e) {
        // Normalized device coordinate [-1, 1]
        this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    onScroll() {
        const docHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
        const winHeight = window.innerHeight;
        const maxScroll = Math.max(1, docHeight - winHeight);
        const currentScroll = window.scrollY || window.pageYOffset || 0;

        // Normalized scroll fraction [0 to ~1..N]
        this.targetScroll = (currentScroll / maxScroll) * this.config.scrollFactor;
    }

    // External hook for integration with Lenis or GSAP scroll triggers
    setScroll(normalizedVal) {
        this.targetScroll = normalizedVal * this.config.scrollFactor;
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        if (newConfig.speed !== undefined) this.uniforms.uSpeed.value = this.config.speed;
        if (newConfig.waveHeight !== undefined) this.uniforms.uWaveHeight.value = this.config.waveHeight;
        if (newConfig.waveFreq !== undefined) this.uniforms.uWaveFreq.value = this.config.waveFreq;
        if (newConfig.grainIntensity !== undefined) this.uniforms.uGrainIntensity.value = this.config.grainIntensity;
    }

    render(now) {
        if (this.isDestroyed) return;

        const delta = Math.min((now - this.lastTime) * 0.001, 0.1);
        this.lastTime = now;
        this.time += delta;

        // Smooth damping on mouse parallax
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.055;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.055;

        // Smooth damping on scroll glide (continuous scroll through new page/sections)
        this.scroll += (this.targetScroll - this.scroll) * 0.065;

        // Update uniforms
        this.uniforms.uTime.value = this.time;
        this.uniforms.uMouse.value = [this.mouse.x, this.mouse.y];
        this.uniforms.uScroll.value = this.scroll;

        // Render pass
        this.renderer.render({ scene: this.mesh });

        this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    destroy() {
        this.isDestroyed = true;
        cancelAnimationFrame(this.rafId);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('scroll', this.handleScroll);
        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }
}
