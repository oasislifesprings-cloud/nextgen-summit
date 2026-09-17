/* The Liquid.
   The flyer's melted "next", rendered live: a blurred wordmark mask, warped by slow
   noise, printed through slightly misregistered cyan, magenta, yellow and black
   plates with a halftone screen and paper grain. One WebGL pass, no dependencies. */
(function () {
  'use strict';

  var VERT = 'attribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uMask;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uSep;',
    'uniform float uCell;',
    'uniform float uGrain;',
    'uniform float uScreen;',
    'uniform float uMelt;',
    'uniform vec3 uPaper;',
    'uniform vec4 uFrame;',

    'vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }',
    'float snoise(vec2 v){',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod(i, 289.0);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'float ink(vec2 px, vec2 warp){',
    '  vec2 uv = px / uRes + warp;',
    '  return texture2D(uMask, mix(uFrame.xy, uFrame.zw, uv)).r;',
    '}',

    // one halftone plate at its own screen angle; empty paper stays clean
    'float screen(vec2 px, float ang, float v){',
    '  float s = sin(ang), c = cos(ang);',
    '  vec2 p = mat2(c, -s, s, c) * px / uCell;',
    '  float d = length(fract(p) - 0.5);',
    '  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.74;',
    '  float aa = 0.9 / uCell;',
    '  float dotc = (1.0 - smoothstep(r - aa, r + aa, d)) * smoothstep(0.0, 0.06, v);',
    '  return mix(v, dotc, uScreen);',
    '}',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',

    'void main(){',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  vec2 uv = px / uRes;',
    '  float asp = uRes.x / uRes.y;',
    '  float t = uTime;',
    '  vec2 n = vec2(uv.x * asp, uv.y) * 1.1;',
    '  vec2 warp = vec2(snoise(n + vec2(0.0, t * 0.04)), snoise(n * 1.3 + vec2(7.1, -t * 0.03))) * 0.045 * uMelt;',
    // drips: the lower edge of each shape is pulled down by an amount that varies along x
    '  float drip = snoise(vec2(uv.x * 2.6 * asp, t * 0.02 + 3.0)) * 0.5 + 0.5;',
    '  warp.y -= drip * drip * 0.11 * uv.y * uMelt;',
    '  float sep = uSep;',
    '  float fc = ink(px + vec2(-1.0, 0.35) * sep, warp);',
    '  float fm = ink(px + vec2(0.85, 0.60) * sep, warp);',
    '  float fy = ink(px + vec2(0.15, -1.0) * sep, warp);',
    '  float fk = ink(px, warp);',
    // ink thins out before the bottom edge, so nothing ever reads as cut off
    '  float edge = 1.0 - smoothstep(0.84, 1.0, uv.y);',
    '  float c = screen(px, 0.2618, smoothstep(0.24, 0.58, fc) * edge);',
    '  float m = screen(px, 1.3090, smoothstep(0.24, 0.58, fm) * edge);',
    '  float y = screen(px, 0.0000, smoothstep(0.24, 0.58, fy) * edge);',
    '  float k = screen(px, 0.7854, smoothstep(0.56, 0.82, fk * edge));',
    '  vec3 col = uPaper;',
    '  col *= mix(vec3(1.0), vec3(0.00, 0.64, 0.94), c);',
    '  col *= mix(vec3(1.0), vec3(0.93, 0.02, 0.58), m);',
    '  col *= mix(vec3(1.0), vec3(1.00, 0.92, 0.02), y);',
    '  col *= mix(vec3(1.0), vec3(0.03, 0.03, 0.07), k);',
    '  col += (hash(floor(px) + floor(t * 12.0)) - 0.5) * uGrain;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function buildMask(word, family, drops) {
    var W = 1600, H = 800;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    var size = 600;
    x.font = '900 ' + size + 'px ' + family;
    size = size * (W * 1.04) / x.measureText(word).width;
    x.font = '900 ' + size + 'px ' + family;
    var tw = x.measureText(word).width;
    // Draw the glyphs far off-canvas so only their blurred shadow lands in view.
    // shadowBlur works in every browser, unlike ctx.filter.
    var off = W * 3;
    x.shadowOffsetX = off;
    x.shadowColor = '#fff';
    x.shadowBlur = size * 0.09;
    x.fillStyle = '#fff';
    x.textBaseline = 'alphabetic';
    x.fillText(word, (W - tw) / 2 - off, H * 0.5);
    (drops || []).forEach(function (d) {
      x.beginPath();
      x.arc(d[0] * W - off, d[1] * H, d[2] * W, 0, Math.PI * 2);
      x.fill();
    });
    return cv;
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function mount(canvas, opts) {
    var o = Object.assign({
      word: 'next',
      family: 'Fraunces, Georgia, serif',
      drops: [[0.18, 0.6, 0.017], [0.58, 0.62, 0.022], [0.86, 0.57, 0.019]],
      frameY: [0.0, 1.0],
      anchor: [0.5, 0.46],
      sep: 7,
      cell: 3.2,
      grain: 0.028,
      screen: 0.85,
      melt: 1,
      speed: 1,
      time: 0,
      paper: [0.980, 0.980, 0.973]
    }, opts || {});

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: !!o.preserve });
    if (!gl) return null;

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uMask', 'uRes', 'uTime', 'uSep', 'uCell', 'uGrain', 'uScreen', 'uMelt', 'uPaper', 'uFrame'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, buildMask(o.word, o.family, o.drops));
    gl.uniform1i(U.uMask, 0);
    gl.uniform3fv(U.uPaper, o.paper);
    gl.uniform1f(U.uGrain, o.grain);
    gl.uniform1f(U.uScreen, o.screen);
    gl.uniform1f(U.uMelt, o.melt);

    var dpr = 1, sep = o.sep, sepTarget = o.sep, frozenT = o.time, t0 = 0;
    var running = false, visible = false, raf = null, last = 0;

    function now() { return running ? (performance.now() - t0) / 1000 * o.speed : frozenT; }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      // crop the 2:1 mask to the canvas aspect so letters never stretch;
      // the letters' baseline holds the same place on every screen, drips below it
      var asp = w / h, fw = Math.min(1, asp / 2), fh = Math.min(1, 2 / asp);
      var span = (o.frameY[1] - o.frameY[0]) * fh;
      var y0 = Math.max(o.frameY[0], o.anchor[0] - o.anchor[1] * span), y1 = y0 + span;
      gl.uniform4f(U.uFrame, 0.5 - fw / 2, y0, 0.5 + fw / 2, y1);
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uCell, o.cell * dpr);
    }

    function draw() {
      gl.uniform1f(U.uTime, now());
      gl.uniform1f(U.uSep, sep * dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function tick(ts) {
      raf = null;
      if (!visible || document.hidden) { last = 0; return; }
      var settling = Math.abs(sepTarget - sep) > 0.02;
      if (!last || ts - last >= 32) {            // about 30fps is plenty for a slow drift
        var dt = last ? Math.min(100, ts - last) : 16.667;
        last = ts;
        sep += (sepTarget - sep) * (1 - Math.pow(1 - 0.06, dt / 16.667));
        if (!settling) sep = sepTarget;
        draw();
      }
      if (running || settling) raf = requestAnimationFrame(tick);
      else last = 0;
    }

    function wake() { if (raf === null && visible && !document.hidden) raf = requestAnimationFrame(tick); }

    var ro = new ResizeObserver(function () { resize(); draw(); });
    ro.observe(canvas);
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; wake(); }, { rootMargin: '120px' });
    io.observe(canvas);
    document.addEventListener('visibilitychange', wake);

    resize();
    draw();

    return {
      canvas: canvas,
      play: function () { if (running) return; t0 = performance.now() - frozenT * 1000 / o.speed; running = true; wake(); },
      pause: function () { if (!running) return; frozenT = now(); running = false; },
      setSep: function (v, instant) { sepTarget = v; if (instant) { sep = v; draw(); } wake(); },
      redraw: function () { resize(); draw(); }
    };
  }

  window.NGLiquid = { mount: mount };
})();
