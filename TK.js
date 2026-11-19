/* ==========================================================================
   Tirth Koli – Portfolio
   1. Shared helpers and state
   2. Colour palettes (automatic cycling)
   3. WebGL background (aurora and snow)
   4. Particle shapes (change while scrolling)
   5. Project search
   6. Project card effects (tilt and text scramble)
   7. Contact section reveal
   8. Welcome greeting in different languages
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Shared helpers and state
     ------------------------------------------------------------------------ */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasMouse = matchMedia("(hover: hover)").matches;
  const TAU = Math.PI * 2;

  /** Smoothed pointer position in pixels, shared by the background and shapes. */
  const pointer = { x: -9999, y: -9999 };

  /** The colour label in the bottom-right corner. */
  const label = {
    el: document.getElementById("shape"),
    shapeName: "",
    timer: 0,

    /** Show the name of the current particle shape. */
    showShape(name) {
      this.shapeName = name;
      this.el.textContent = "\u2728 " + name;
    },

    /** Briefly show a message, then go back to the shape name. */
    toast(text, ms = 1800) {
      this.el.textContent = text;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.showShape(this.shapeName), ms);
    },
  };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  }

  /* ------------------------------------------------------------------------
     2. Colour palettes
     Each palette has five colours, from darkest to lightest. They are used by
     the background shader, the particle shapes and the CSS accent variables.
     ------------------------------------------------------------------------ */
  const PALETTES = [
    { name: "Icy Teal & Cyan",        colors: ["#12a3a0", "#00c9a7", "#00b4d8", "#3dbeff", "#25c55e"] },
    { name: "Deep Indigo & Midnight", colors: ["#1b1464", "#3b2fa8", "#2a5bd7", "#5a8dff", "#7c4dff"] },
    { name: "Sunset Coral",           colors: ["#c2185b", "#ff4d6d", "#ff7a3d", "#ffb347", "#ffd166"] },
    { name: "Aurora Purple",          colors: ["#4c1d95", "#7c3aed", "#c026d3", "#22d3ee", "#34d399"] },
    { name: "Forest Emerald",         colors: ["#064e3b", "#059669", "#10b981", "#6ee7b7", "#a3e635"] },
    { name: "Ocean Blue",             colors: ["#0b3d91", "#1565c0", "#0288d1", "#4fc3f7", "#26c6da"] },
    { name: "Rose Gold",              colors: ["#9d174d", "#db2777", "#f472b6", "#fbbf24", "#fb923c"] },
    { name: "Lavender Dream",         colors: ["#5b21b6", "#8b5cf6", "#a78bfa", "#f0abfc", "#93c5fd"] },
    { name: "Slate Graphite",         colors: ["#1f2937", "#334155", "#475569", "#64748b", "#38bdf8"] },
    { name: "Lime Neon",              colors: ["#166534", "#16a34a", "#84cc16", "#bef264", "#22d3ee"] },
  ];

  const PALETTE_INTERVAL_MS = 7000; // time between colour changes
  const PALETTE_FADE_MS = 2200;     // length of each cross-fade

  /** The colours currently on screen (updated every frame during a fade). */
  const palette = { hex: PALETTES[0].colors.slice() };

  /** Set by the background module so the palette can reach the shader. */
  let setShaderColors = null;

  function applyPalette(rgbColors) {
    palette.hex = rgbColors.map(rgbToHex);

    if (setShaderColors) setShaderColors(palette.hex);

    const style = document.documentElement.style;
    ["--sea", "--teal", "--cyan", "--sky", "--green"].forEach((name, i) => {
      style.setProperty(name, palette.hex[i]);
    });
  }

  function initPalette() {
    let index = 0;
    let current = hexToRgb2D(PALETTES[0].colors);
    let fadeFrame = 0;

    function hexToRgb2D(colors) {
      return colors.map(hexToRgb);
    }

    /** Fade from the current colours to the colours of PALETTES[index]. */
    function fadeToCurrentPalette() {
      const from = current.map((c) => c.slice());
      const to = hexToRgb2D(PALETTES[index].colors);
      const duration = reduceMotion ? 1 : PALETTE_FADE_MS;
      const start = performance.now();

      cancelAnimationFrame(fadeFrame);

      (function step(now) {
        let k = Math.min(1, (now - start) / duration);
        k = k * k * (3 - 2 * k); // smoothstep easing
        current = from.map((c, i) => c.map((v, j) => v + (to[i][j] - v) * k));
        applyPalette(current);
        if (k < 1) fadeFrame = requestAnimationFrame(step);
      })(start);

      label.toast("\uD83C\uDFA8 " + PALETTES[index].name);
    }

    applyPalette(current);

    // Reduced motion: keep the first palette and do not cycle.
    if (reduceMotion) return;

    setInterval(() => {
      if (document.hidden) return; // pause while the tab is in the background
      index = (index + 1) % PALETTES.length;
      fadeToCurrentPalette();
    }, PALETTE_INTERVAL_MS);
  }

  /* ------------------------------------------------------------------------
     3. WebGL background (aurora and snow)
     ------------------------------------------------------------------------ */
  const VERTEX_SHADER = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2  uResolution;
    uniform float uTime;
    uniform vec2  uPointer;
    uniform vec3  uC0, uC1, uC2, uC3, uC4; // the five palette colours

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    float fbm(vec2 p) {
      float amp = 0.5;
      float sum = 0.0;
      for (int i = 0; i < 4; i++) {
        sum += amp * valueNoise(p);
        p = p * 2.0 + 7.0;
        amp *= 0.5;
      }
      return sum / 0.9375;
    }

    float snow(vec2 uv, float scale, float speed) {
      uv *= scale;
      uv.y += uTime * speed;
      uv.x += sin(uv.y * 0.6 + uTime * 0.3) * 0.4;

      vec2 cell = floor(uv);
      vec2 local = fract(uv) - 0.5;
      float rnd = hash(cell);
      vec2 offset = vec2(rnd - 0.5, fract(rnd * 7.0) - 0.5) * 0.6;

      float flake = smoothstep(0.11, 0.0, length(local - offset));
      float hasFlake = step(0.45, fract(rnd * 13.0));
      float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + rnd * 40.0);
      return flake * hasFlake * twinkle;
    }

    void main() {
      vec2 p  = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
      vec2 uv = gl_FragCoord.xy / max(uResolution.y, 1.0);

      // Glow that follows the pointer
      float glow = exp(-dot(p - uPointer, p - uPointer) * 7.0);

      // Moving aurora noise
      vec2 q = vec2(fbm(p * 2.0 + uTime * 0.08),
                    fbm(p * 2.0 + vec2(5.2, 1.3) - uTime * 0.1));
      float f = fbm(p * 2.2 + q * 2.4 + glow * 0.7 + uTime * 0.04);

      // Blend the five palette colours
      vec3 col = mix(uC0, uC1, smoothstep(0.12, 0.4, f));
      col = mix(col, uC2, smoothstep(0.35, 0.6, f));
      col = mix(col, uC3, smoothstep(0.55, 0.82, f));
      col = mix(col, uC4, smoothstep(0.5, 0.9, q.y) * 0.55);

      col += glow * vec3(0.18);
      col *= 1.0 - 0.3 * dot(p, p); // vignette

      // Dark tint (this site is dark mode only)
      col = col * 0.22 + vec3(0.01, 0.04, 0.07);

      // Snow and film grain
      col += vec3(0.85, 0.95, 1.0) * (snow(uv, 14.0, 0.35) * 0.9 + snow(uv + 3.1, 26.0, 0.55) * 0.7);
      col += (hash(uv * 120.0 + fract(uTime * 0.05)) - 0.5) * 0.038;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createProgram(gl) {
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);

    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  function initBackground() {
    const canvas = document.getElementById("background");
    const options = { antialias: false, alpha: false };
    const gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
    const program = gl && createProgram(gl);

    // No WebGL: the CSS gradient fallback takes over.
    if (!program) {
      document.body.classList.add("no-webgl");
      return;
    }

    gl.useProgram(program);

    // One big triangle that covers the whole screen
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const uColors = [0, 1, 2, 3, 4].map((i) => gl.getUniformLocation(program, "uC" + i));

    // Lets the palette code change the shader colours
    setShaderColors = (hexColors) => {
      hexColors.forEach((hex, i) => {
        const [r, g, b] = hexToRgb(hex);
        gl.uniform3f(uColors[i], r / 255, g / 255, b / 255);
      });
    };
    setShaderColors(palette.hex);

    function resize() {
      // Lower resolution on phones to keep the animation smooth
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? 0.7 : 1);
      canvas.width = Math.max(1, Math.floor(innerWidth * scale));
      canvas.height = Math.max(1, Math.floor(innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    addEventListener("resize", resize);
    addEventListener("orientationchange", resize);

    // Pointer position in shader units, eased towards the real pointer
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    addEventListener("pointermove", (e) => {
      const size = Math.min(innerWidth, innerHeight);
      targetX = (e.clientX - innerWidth / 2) / size;
      targetY = (innerHeight / 2 - e.clientY) / size;
    });

    const startTime = performance.now();

    function draw(now) {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduceMotion ? 5 : (now - startTime) / 1000);
      gl.uniform2f(uPointer, currentX, currentY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduceMotion) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------------------------
     4. Particle shapes
     Each shape is a function that returns one point (x, y) in the range
     -1 … 1. Particles fly to their point in the current shape.
     ------------------------------------------------------------------------ */
  const textPointCache = {};

  /** Draw text on a hidden canvas and collect the pixels it covers. */
  function getTextPoints(text, font, baselineY) {
    const key = text + font;
    if (textPointCache[key]) return textPointCache[key];

    const off = document.createElement("canvas");
    off.width = 400;
    off.height = 200;
    const c = off.getContext("2d");
    c.fillStyle = "#fff";
    c.font = font;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 200, baselineY);

    const data = c.getImageData(0, 0, 400, 200).data;
    const points = [];
    for (let y = 0; y < 200; y += 2) {
      for (let x = 0; x < 400; x += 2) {
        if (data[(y * 400 + x) * 4 + 3] > 128) points.push(x, y);
      }
    }
    return (textPointCache[key] = points);
  }

  /** Shape generator that scatters points over the letters of a text. */
  function textShape(text, font, baselineY) {
    return function () {
      const points = getTextPoints(text, font, baselineY);

      if (!points.length) {
        // Font not ready: fall back to a circle
        const a = Math.random() * TAU;
        return [Math.cos(a), Math.sin(a)];
      }

      const j = Math.floor((Math.random() * points.length) / 2) * 2;
      return [
        (points[j] - 200) / 200 + (Math.random() - 0.5) * 0.01,
        (points[j + 1] - 100) / 200 + (Math.random() - 0.5) * 0.01,
      ];
    };
  }

  /** One random point on a flying dragon (body, head, horns, wings, spikes). */
  function dragonPoint() {
    const jitter = () => (Math.random() - 0.5) * 0.012;

    // Centre line of the body and its direction at position t (0 = tail, 1 = head)
    const spine = (t) => {
      const angle = t * 7.85 + 0.3;
      return [-1 + 2 * t, -0.28 * Math.sin(angle), 2, -0.28 * Math.cos(angle) * 7.85];
    };
    const bodyWidth = (t) => 0.015 + 0.085 * Math.pow(t, 0.8);
    const normalOf = (c) => {
      const len = Math.hypot(c[2], c[3]);
      return [c[3] / len, -c[2] / len];
    };

    const head = spine(1);
    const roll = Math.random();
    let p;

    if (roll < 0.55) {
      // Body
      const t = Math.random();
      const c = spine(t);
      const [nx, ny] = normalOf(c);
      const w = bodyWidth(t) * (Math.random() * 2 - 1);
      p = [c[0] + nx * w, c[1] + ny * w];
    } else if (roll < 0.67) {
      // Head
      const a = Math.random() * TAU;
      const r = Math.sqrt(Math.random());
      p = [head[0] + 0.08 + Math.cos(a) * 0.13 * r, head[1] - 0.02 + Math.sin(a) * 0.075 * r];
    } else if (roll < 0.73) {
      // Horns
      const s = Math.random();
      const left = Math.random() < 0.5;
      const endX = left ? head[0] - 0.14 : head[0] - 0.02;
      const endY = left ? head[1] - 0.24 : head[1] - 0.26;
      p = [
        head[0] + 0.04 + s * (endX - head[0] - 0.04) + jitter(),
        head[1] - 0.06 + s * (endY - head[1] + 0.06) + jitter(),
      ];
    } else if (roll < 0.78) {
      // Front legs
      const s = Math.random();
      const up = Math.random() < 0.5;
      const endX = up ? head[0] + 0.36 : head[0] + 0.32;
      const endY = up ? head[1] - 0.14 : head[1] + 0.16;
      p = [
        head[0] + 0.2 + s * (endX - head[0] - 0.2) + jitter(),
        head[1] + 0.02 + s * (endY - head[1] - 0.02) + jitter(),
      ];
    } else if (roll < 0.88) {
      // Back spikes
      const t = 0.1 + (Math.floor(Math.random() * 14) / 14) * 0.85;
      const c = spine(t);
      const [nx, ny] = normalOf(c);
      const offset = bodyWidth(t) + Math.random() * 0.07;
      p = [c[0] + nx * offset + jitter(), c[1] + ny * offset];
    } else {
      // Belly ridges
      const t = [0.3, 0.45, 0.62, 0.78][Math.floor(Math.random() * 4)];
      const c = spine(t);
      const [nx, ny] = normalOf(c);
      const w = bodyWidth(t);
      const s = Math.random();
      if (s < 0.8) {
        const offset = -(w + (s / 0.8) * 0.17);
        p = [c[0] + nx * offset, c[1] + ny * offset];
      } else {
        const offset = -(w + 0.17);
        p = [c[0] + nx * offset + Math.random() * 0.06, c[1] + ny * offset];
      }
    }

    return [p[0] * 0.72, p[1] * 0.72];
  }

  const SHAPES = [
    { name: "TK Letters", point: textShape("TK", "800 180px Poppins, system-ui, sans-serif", 108) },

    { name: "Infinity Loop", point() {
      const a = Math.random() * TAU;
      return [
        Math.sin(a) * 0.95 + (Math.random() - 0.5) * 0.08,
        Math.sin(2 * a) * 0.48 + (Math.random() - 0.5) * 0.08,
      ];
    } },

    { name: "Code Brackets", point: textShape("</>", '800 150px "Courier New", monospace', 100) },

    { name: "Dot Grid", point(i, total) {
      const side = Math.ceil(Math.sqrt(total));
      return [
        ((i % side) / (side - 1) * 2 - 1) * 0.85,
        (Math.floor(i / side) / (side - 1) * 2 - 1) * 0.85,
      ];
    } },

    { name: "Wave", point() {
      const x = Math.random() * 2 - 1;
      return [x * 1.05, Math.sin(x * TAU) * 0.3 + (Math.random() - 0.5) * 0.22];
    } },

    { name: "DNA Helix", point() {
      const t = Math.random() * 2 - 1;
      const rung = Math.round(t * 12) / 12;
      if (Math.random() < 0.15) {
        // Rungs between the two strands
        return [rung * 0.95, (Math.random() * 2 - 1) * 0.5 * Math.sin(rung * 9.42)];
      }
      return [t * 0.95, 0.5 * Math.sin(t * 9.42 + (Math.random() < 0.5 ? 0 : Math.PI))];
    } },

    { name: "Globe", point() {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * TAU;
      const r = Math.sqrt(1 - u * u);
      return [r * Math.cos(a) * 0.8, u * 0.8];
    } },

    { name: "Galaxy", point() {
      if (Math.random() < 0.15) {
        // Bright core
        const a = Math.random() * TAU;
        const r = Math.random() * 0.15;
        return [Math.cos(a) * r, Math.sin(a) * r * 0.6];
      }
      const r = Math.pow(Math.random(), 0.7);
      const arm = Math.random() < 0.5 ? 0 : Math.PI;
      const theta = r * 6 + arm + (Math.random() - 0.5) * 0.5 * (1 - r * 0.5);
      return [Math.cos(theta) * r, Math.sin(theta) * r * 0.6];
    } },

    { name: "Saturn", point() {
      const a = Math.random() * TAU;
      let x, y;
      if (Math.random() < 0.5) {
        // Planet
        const r = 0.5 * Math.sqrt(Math.random());
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
      } else {
        // Ring
        const r = 0.85 + Math.random() * 0.25;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.3;
      }
      const tilt = -0.35;
      return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
    } },

    { name: "Dragon", point: dragonPoint },
  ];

  /** Which shape to show for each part of the page. */
  const SECTION_IDS = ["home", "about", "skills", "projects", "contact"];

  function initShapes() {
    const canvas = document.getElementById("scene");
    const ctx = canvas.getContext("2d");

    const COUNT = innerWidth < 700 ? 900 : 1700; // number of particles
    const x = new Float32Array(COUNT);           // current positions
    const y = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);          // velocities
    const vy = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);       // random wobble offsets
    const targets = [];                          // targets[shape] = [x0, y0, x1, y1, ...]

    let width = 0, height = 0, current = 0, time = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = innerWidth;
      height = innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Give every particle a random kick when the shape changes. */
    function burst() {
      if (reduceMotion) return;
      for (let i = 0; i < COUNT; i++) {
        vx[i] += (Math.random() - 0.5) * 16;
        vy[i] += (Math.random() - 0.5) * 16;
      }
    }

    function frame() {
      time += 0.016;

      const wide = width > 800;
      const centerX = wide ? width * 0.7 : width * 0.5;
      const centerY = height * 0.5;
      const scale = wide ? Math.min(width * 0.3, height * 0.42) : Math.min(width * 0.42, height * 0.3);

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter"; // glowing particles on dark
      ctx.globalAlpha = wide ? 0.9 : 0.6;

      const target = targets[current];
      const spring = reduceMotion ? 1 : 0.012;
      const friction = reduceMotion ? 0 : 0.86;

      // Draw in four batches, one per colour
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = palette.hex[(c + current) % 5];

        for (let i = c; i < COUNT; i += 4) {
          const wobbleX = reduceMotion ? 0 : Math.cos(time * 0.7 + phase[i]) * 7;
          const wobbleY = reduceMotion ? 0 : Math.sin(time * 0.9 + phase[i]) * 7;
          const goalX = centerX + target[2 * i] * scale + wobbleX;
          const goalY = centerY + target[2 * i + 1] * scale + wobbleY;

          if (reduceMotion) {
            x[i] = goalX;
            y[i] = goalY;
          } else {
            // Spring towards the goal
            vx[i] += (goalX - x[i]) * spring;
            vy[i] += (goalY - y[i]) * spring;

            // Swirl away from the pointer
            const dx = x[i] - pointer.x;
            const dy = y[i] - pointer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 14000) {
              const force = (1 - distSq / 14000) * 2.4;
              const dist = Math.sqrt(distSq) + 0.01;
              vx[i] += (dx / dist) * force + (-dy / dist) * force * 0.6;
              vy[i] += (dy / dist) * force + (dx / dist) * force * 0.6;
            }

            vx[i] *= friction;
            vy[i] *= friction;
            x[i] += vx[i];
            y[i] += vy[i];
          }

          ctx.fillRect(x[i], y[i], 2.2, 2.2);
        }
      }

      ctx.globalAlpha = 1;
      if (!reduceMotion || time < 0.1) requestAnimationFrame(frame);
    }

    /** Pick the shape for the section in the middle of the screen. */
    function updateShape() {
      const middle = innerHeight / 2;
      let found = -1;
      let bestDistance = Infinity;

      SECTION_IDS.forEach((id, i) => {
        if (found !== -1 && bestDistance === 0) return;
        const r = document.getElementById(id).getBoundingClientRect();
        if (r.top <= middle && r.bottom >= middle) {
          found = i;
          bestDistance = 0;
        } else {
          const d = Math.min(Math.abs(r.top - middle), Math.abs(r.bottom - middle));
          if (d < bestDistance) {
            bestDistance = d;
            found = i;
          }
        }
      });

      let next = 0;
      if (found === 1) next = 1;
      else if (found === 2) next = 2;
      else if (found === 3) {
        // Projects: five shapes spread over the section
        const r = document.getElementById("projects").getBoundingClientRect();
        const progress = (middle - r.top) / r.height;
        next = 3 + Math.max(0, Math.min(4, Math.floor(progress * 5)));
      } else if (found === 4) {
        // Contact: Saturn, then the dragon at the very bottom
        const scrolled = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
        next = scrolled > 0.96 ? 9 : 8;
      }

      if (next !== current) {
        current = next;
        label.showShape(SHAPES[current].name);
        burst();
        if (reduceMotion) requestAnimationFrame(frame);
      }
    }

    function start() {
      resize();

      // Pre-compute every particle's target in every shape
      SHAPES.forEach((shape) => {
        const t = new Float32Array(2 * COUNT);
        for (let i = 0; i < COUNT; i++) {
          const p = shape.point(i, COUNT);
          t[2 * i] = p[0];
          t[2 * i + 1] = p[1];
        }
        targets.push(t);
      });

      for (let i = 0; i < COUNT; i++) {
        x[i] = Math.random() * width;
        y[i] = Math.random() * height;
        phase[i] = Math.random() * TAU;
      }

      label.showShape(SHAPES[0].name);
      updateShape();

      addEventListener("resize", resize);
      addEventListener("scroll", updateShape, { passive: true });
      addEventListener("pointermove", (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => {
        pointer.x = pointer.y = -9999;
      });

      requestAnimationFrame(frame);
    }

    // Wait for the Poppins font (needed for the "TK" shape), but not for long
    const fontReady = document.fonts && document.fonts.load
      ? document.fonts.load("800 180px Poppins").catch(() => {})
      : Promise.resolve();
    Promise.race([fontReady, new Promise((resolve) => setTimeout(resolve, 1500))]).then(start);
  }

  /* ------------------------------------------------------------------------
     5. Project search (press "/" to focus, Esc to clear)
     ------------------------------------------------------------------------ */
  function initSearch() {
    const input = document.getElementById("search");
    const noResults = document.getElementById("no-results");
    const cards = document.querySelectorAll(".unit-card");

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      let matches = 0;

      cards.forEach((card) => {
        const text = (card.textContent + " " + (card.dataset.keywords || "")).toLowerCase();
        const show = !query || text.includes(query);
        card.hidden = !show;
        if (show) matches++;
      });

      noResults.hidden = matches > 0;
    });

    addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === "Escape" && document.activeElement === input) {
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.blur();
      }
    });
  }

  /* ------------------------------------------------------------------------
     6. Project card effects: light follows the pointer, 3D tilt, and the
        title letters scramble when you hover
     ------------------------------------------------------------------------ */
  const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}";
  const SCRAMBLE_SPEED_MS = 28;

  function initCards() {
    document.querySelectorAll(".unit-link").forEach((card) => {
      const title = card.querySelector(".unit-title");
      const originalText = title.textContent;
      let scrambleTimer = 0;

      card.addEventListener("pointermove", (e) => {
        const box = card.getBoundingClientRect();
        const px = e.clientX - box.left;
        const py = e.clientY - box.top;

        card.style.setProperty("--mx", px + "px");
        card.style.setProperty("--my", py + "px");

        if (hasMouse && !reduceMotion) {
          const tiltX = (py / box.height - 0.5) * -7;
          const tiltY = (px / box.width - 0.5) * 7;
          card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-3px)`;
        }
      });

      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });

      card.addEventListener("pointerenter", () => {
        if (reduceMotion) return;

        let revealed = 0;
        clearInterval(scrambleTimer);

        scrambleTimer = setInterval(() => {
          title.textContent = originalText
            .split("")
            .map((char, i) => {
              if (char === " " || i < revealed) return char;
              return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            })
            .join("");

          if (++revealed > originalText.length) {
            clearInterval(scrambleTimer);
            title.textContent = originalText;
          }
        }, SCRAMBLE_SPEED_MS);
      });
    });
  }

  /* ------------------------------------------------------------------------
     7. Contact section: fade the text in when the section scrolls into view
     ------------------------------------------------------------------------ */
  function initContactReveal() {
    const items = document.querySelectorAll("#contact .reveal");
    const showAll = () => items.forEach((el) => el.classList.add("in"));

    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        showAll();
        observer.disconnect();
      }
    }, { threshold: 0.3 });

    observer.observe(document.getElementById("contact"));
  }

  /* ------------------------------------------------------------------------
     8. Welcome greeting: "Welcome" in a new language every few seconds
     ------------------------------------------------------------------------ */
  const WELCOMES = [
    { text: "Welcome",           lang: "en" },
    { text: "સ્વાગત છે",          lang: "gu" },
    { text: "स्वागत है",          lang: "hi" },
    { text: "Bienvenido",        lang: "es" },
    { text: "Bienvenue",         lang: "fr" },
    { text: "Willkommen",        lang: "de" },
    { text: "ようこそ",            lang: "ja" },
    { text: "환영합니다",          lang: "ko" },
    { text: "欢迎",               lang: "zh" },
    { text: "Benvenuto",         lang: "it" },
    { text: "Bem-vindo",         lang: "pt" },
    { text: "Добро пожаловать",  lang: "ru" },
    { text: "مرحباً",             lang: "ar" },
  ];

  const WELCOME_SHOW_MS = 2200; // how long each word stays
  const WELCOME_FADE_MS = 450;  // fade out before the next word

  function initWelcome() {
    const el = document.getElementById("welcome-text");
    if (!el) return;

    let index = 0;

    function showNext() {
      if (document.hidden) return; // pause while the tab is in the background

      el.classList.add("out"); // fade the current word out
      setTimeout(() => {
        index = (index + 1) % WELCOMES.length;
        el.textContent = WELCOMES[index].text;
        el.lang = WELCOMES[index].lang;
        el.classList.remove("out"); // fade the new word in
      }, reduceMotion ? 0 : WELCOME_FADE_MS);
    }

    setInterval(showNext, WELCOME_SHOW_MS + (reduceMotion ? 0 : WELCOME_FADE_MS));
  }

  /* ------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------ */
  initBackground();
  initPalette();
  initShapes();
  initSearch();
  initCards();
  initContactReveal();
  initWelcome();
})();