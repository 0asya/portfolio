/**
 * 3D RAYMARCHED GRADIENT WAVES (WEBGL 2.0 / OGL) - UMD / Script-tag Bundle
 * Compatible with direct <script src="..."> inclusion.
 */
(function(global) {
    const VERTEX_SHADER = `#version 300 es
    in vec2 position;
    in vec2 uv;
    out vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
    }`;

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

    uniform vec3 uColorBase;
    uniform vec3 uColorSlope;
    uniform vec3 uColorCrest;
    uniform vec3 uColorBg;

    mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
    }

    float waveHeight(vec2 p, float time) {
        float t = time * uSpeed;
        vec2 q = p * uWaveFreq;

        float w1 = sin(q.x * 0.48 + q.y * 0.38 + t * 1.05) * 1.35;
        vec2 p2 = rot(0.68) * q * 1.12;
        float w2 = sin(p2.x * 0.82 - p2.y * 0.58 - t * 0.85) * 0.75;
        vec2 p3 = rot(-0.85) * q * 1.75;
        float w3 = sin(p3.x * 1.25 + p3.y * 1.05 + t * 0.65) * 0.42;
        vec2 p4 = rot(1.20) * q * 3.2;
        float w4 = sin(p4.x * 2.0 - p4.y * 2.2 - t * 1.25) * 0.14;

        float combined = (w1 + w2 + w3 + w4) * 0.45;
        return (sign(combined) * pow(abs(combined), 1.18)) * uWaveHeight;
    }

    vec3 calcNormal(vec3 p, float time) {
        vec2 e = vec2(0.008, 0.0);
        return normalize(vec3(
            waveHeight(p.xz - e.xy, time) - waveHeight(p.xz + e.xy, time),
            2.0 * e.x,
            waveHeight(p.xz - e.yx, time) - waveHeight(p.xz + e.yx, time)
        ));
    }

    float filmGrain(vec2 coord, float seed) {
        return fract(sin(dot(coord + fract(seed * 0.0137), vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);

        float pitch = -0.48 + uMouse.y * 0.22;
        float yaw = uMouse.x * 0.35;

        vec3 ro = vec3(
            sin(uScroll * 1.2) * 0.5,
            1.85 + sin(uScroll * 1.8) * 0.2,
            -3.4 + uScroll * 9.5
        );

        mat2 rotX = rot(pitch);
        mat2 rotY = rot(yaw);

        vec3 rd = normalize(vec3(uv, 1.28));
        rd.yz = rotX * rd.yz;
        rd.xz = rotY * rd.xz;

        vec3 lightDir = normalize(vec3(0.45, 0.75, -0.65));

        float t = 0.4;
        float tMax = 36.0;
        float hit = 0.0;
        vec3 p;

        for (int i = 0; i < 82; i++) {
            p = ro + rd * t;
            float h = p.y - waveHeight(p.xz, uTime);

            float tol = 0.0035 * t;
            if (abs(h) < tol) {
                hit = 1.0;
                break;
            }
            if (t > tMax) break;
            t += max(h * 0.58, 0.024);
        }

        vec3 finalColor = uColorBg;

        if (hit > 0.5) {
            vec3 n = calcNormal(p, uTime);
            vec3 v = normalize(ro - p);

            float slope = clamp(1.0 - n.y, 0.0, 1.0);
            float elevation = smoothstep(-0.6, 1.4, p.y);
            float crestFactor = pow(clamp(n.y * elevation, 0.0, 1.0), 1.5);

            vec3 surfaceColor = mix(uColorBase, uColorSlope, smoothstep(0.04, 0.60, slope));
            surfaceColor = mix(surfaceColor, uColorCrest, crestFactor * 0.85);

            float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.5);
            surfaceColor += uColorCrest * fresnel * 1.25;

            vec3 hVector = normalize(lightDir + v);
            float spec = pow(max(dot(n, hVector), 0.0), 28.0);
            surfaceColor += uColorCrest * spec * 0.8;

            surfaceColor += uColorSlope * 0.16;

            float ao = clamp(0.45 + 0.55 * n.y, 0.0, 1.0);
            surfaceColor *= ao;

            float fog = smoothstep(14.0, 35.0, t);
            finalColor = mix(surfaceColor, uColorBg, fog);
        } else {
            float horizonGrad = smoothstep(-0.25, 0.45, rd.y);
            finalColor = mix(uColorBase * 0.9, uColorBg, horizonGrad);
            float aurora = pow(max(0.0, 1.0 - abs(rd.y - 0.02) * 2.8), 3.0);
            finalColor += uColorSlope * aurora * 0.45 + uColorCrest * aurora * 0.15;
        }

        float grain = filmGrain(gl_FragCoord.xy, uTime * 60.0);
        finalColor += (grain - 0.5) * uGrainIntensity;

        fragColor = vec4(finalColor, 1.0);
    }`;

    class RaymarchedSilkWaves {
        constructor(options = {}) {
            const OGL = global.OGL;
            if (!OGL) {
                console.error("OGL library not found on window. Ensure ogl.umd.js is included before raymarch-waves.umd.js");
                return;
            }

            this.container = options.container || document.body;
            this.canvas = options.canvas || null;

            this.config = {
                speed: options.speed !== undefined ? options.speed : 0.25,
                waveHeight: options.waveHeight !== undefined ? options.waveHeight : 1.25,
                waveFreq: options.waveFreq !== undefined ? options.waveFreq : 0.62,
                grainIntensity: options.grainIntensity !== undefined ? options.grainIntensity : 0.045,
                colorBase: options.colorBase || [18 / 255, 13 / 255, 31 / 255],
                colorSlope: options.colorSlope || [118 / 255, 87 / 255, 200 / 255],
                colorCrest: options.colorCrest || [216 / 255, 200 / 255, 255 / 255],
                colorBg: options.colorBg || [11 / 255, 8 / 255, 18 / 255],
                scrollFactor: options.scrollFactor !== undefined ? options.scrollFactor : 1.0
            };

            this.time = 0;
            this.lastTime = performance.now();
            this.mouse = { x: 0, y: 0 };
            this.targetMouse = { x: 0, y: 0 };
            this.scroll = 0;
            this.targetScroll = 0;
            this.isDestroyed = false;

            this.init(OGL);
        }

        init(OGL) {
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

            this.renderer = new OGL.Renderer({
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
            this.geometry = new OGL.Triangle(this.gl);

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

            this.program = new OGL.Program(this.gl, {
                vertex: VERTEX_SHADER,
                fragment: FRAGMENT_SHADER,
                uniforms: this.uniforms,
                depthTest: false,
                depthWrite: false
            });

            this.mesh = new OGL.Mesh(this.gl, {
                geometry: this.geometry,
                program: this.program
            });

            this.bindEvents();
            this.onResize();
            this.onScroll();

            this.rafId = requestAnimationFrame(this.render.bind(this));
        }

        bindEvents() {
            this.handleResize = this.onResize.bind(this);
            this.handleMouseMove = this.onMouseMove.bind(this);
            this.handleScroll = this.onScroll.bind(this);

            window.addEventListener('resize', this.handleResize, { passive: true });
            window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            window.addEventListener('scroll', this.handleScroll, { passive: true });

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
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.uniforms.uResolution.value = [this.gl.drawingBufferWidth, this.gl.drawingBufferHeight];
        }

        onMouseMove(e) {
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        }

        onScroll() {
            const docHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            const maxScroll = Math.max(1, docHeight - window.innerHeight);
            const currentScroll = window.scrollY || window.pageYOffset || 0;
            this.targetScroll = (currentScroll / maxScroll) * this.config.scrollFactor;
        }

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

            this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.055;
            this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.055;
            this.scroll += (this.targetScroll - this.scroll) * 0.065;

            this.uniforms.uTime.value = this.time;
            this.uniforms.uMouse.value = [this.mouse.x, this.mouse.y];
            this.uniforms.uScroll.value = this.scroll;

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

    global.RaymarchedSilkWaves = RaymarchedSilkWaves;
})(typeof window !== 'undefined' ? window : this);
