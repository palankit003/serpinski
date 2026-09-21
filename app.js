/**
 * ============================================================================
 * Sierpiński Fractal Studio & Analytical Dashboard
 * ============================================================================
 * Pure client-side simulation, interactive canvas with two-finger pinch zoom,
 * mouse pan/zoom, analytical combinatorial metrics, and high-res PNG/SVG export.
 * Optimized for mobile touchscreens with adaptive screen-space LOD & rAF coalescing.
 */

(() => {
  'use strict';

  // --- State Configuration ---
  const state = {
    type: 'triangle',          // 'triangle' | 'carpet'
    depth: 3,                  // 0 to 7
    mode: 'filled',            // 'filled' | 'wireframe' | 'cutouts'
    patternColor: '#6366f1',
    backgroundColor: '#0f172a',
    camera: {
      x: 0,
      y: 0,
      zoom: 1
    },
    isDragging: false,
    isInteracting: false,      // true during active touch pinch, pan, or mouse drag
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    animationTimer: null,
    isPlaying: false
  };

  // --- DOM Elements Cache ---
  const dom = {
    // Type buttons
    btnTypeTriangle: document.getElementById('btnTypeTriangle'),
    btnTypeCarpet: document.getElementById('btnTypeCarpet'),

    // View & Theme
    btnResetView: document.getElementById('btnResetView'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    hudFractalName: document.getElementById('hudFractalName'),
    hudRenderTime: document.getElementById('hudRenderTime'),
    hudZoomText: document.getElementById('hudZoomText'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnRecenter: document.getElementById('btnRecenter'),

    // Controls
    sliderDepth: document.getElementById('sliderDepth'),
    inputDepth: document.getElementById('inputDepth'),
    depthWarning: document.getElementById('depthWarning'),
    depthWarningText: document.getElementById('depthWarningText'),
    badgeComplexity: document.getElementById('badgeComplexity'),

    // Render Mode
    btnModeFilled: document.getElementById('btnModeFilled'),
    btnModeWireframe: document.getElementById('btnModeWireframe'),
    btnModeCutouts: document.getElementById('btnModeCutouts'),

    // Colors
    colorPattern: document.getElementById('colorPattern'),
    colorBackground: document.getElementById('colorBackground'),
    colorPatternHex: document.getElementById('colorPatternHex'),
    colorBackgroundHex: document.getElementById('colorBackgroundHex'),
    presetChips: document.querySelectorAll('.preset-chip'),

    // Animation
    btnPlayAnimation: document.getElementById('btnPlayAnimation'),
    iconPlay: document.getElementById('iconPlay'),
    iconPause: document.getElementById('iconPause'),
    labelPlay: document.getElementById('labelPlay'),
    btnStepPrev: document.getElementById('btnStepPrev'),
    btnStepNext: document.getElementById('btnStepNext'),

    // Export
    btnExportPNG: document.getElementById('btnExportPNG'),
    btnExportSVG: document.getElementById('btnExportSVG'),

    // Canvas
    canvasViewport: document.getElementById('canvasViewport'),
    canvas: document.getElementById('fractalCanvas'),

    // Analytics Dashboard
    lblCurrentN: document.getElementById('lblCurrentN'),
    pillDimensionFormula: document.getElementById('pillDimensionFormula'),
    valHausdorffSummary: document.getElementById('valHausdorffSummary'),
    metricDepth: document.getElementById('metricDepth'),
    metricDepthFormula: document.getElementById('metricDepthFormula'),
    metricScaleFactor: document.getElementById('metricScaleFactor'),

    badgeRemainingFormula: document.getElementById('badgeRemainingFormula'),
    metricRemainingCount: document.getElementById('metricRemainingCount'),
    metricRemainingSci: document.getElementById('metricRemainingSci'),
    metricRemainingDesc: document.getElementById('metricRemainingDesc'),
    progressRemaining: document.getElementById('progressRemaining'),

    badgeRemovedFormula: document.getElementById('badgeRemovedFormula'),
    metricRemovedCumulative: document.getElementById('metricRemovedCumulative'),
    metricRemovedSci: document.getElementById('metricRemovedSci'),
    metricRemovedFormula: document.getElementById('metricRemovedFormula'),
    metricRemovedStep: document.getElementById('metricRemovedStep'),

    badgeColoredAreaFormula: document.getElementById('badgeColoredAreaFormula'),
    metricColoredPct: document.getElementById('metricColoredPct'),
    metricColoredFraction: document.getElementById('metricColoredFraction'),
    progressColoredArea: document.getElementById('progressColoredArea'),

    badgeRemovedAreaFormula: document.getElementById('badgeRemovedAreaFormula'),
    metricRemovedPct: document.getElementById('metricRemovedPct'),
    metricRemovedFraction: document.getElementById('metricRemovedFraction'),
    progressRemovedArea: document.getElementById('progressRemovedArea'),

    metricDimension: document.getElementById('metricDimension'),
    metricDimensionFormula: document.getElementById('metricDimensionFormula'),
    metricDimensionDetail: document.getElementById('metricDimensionDetail'),
    explainerContent: document.getElementById('explainerContent')
  };

  const ctx = dom.canvas.getContext('2d');

  // Base Geometry Constants
  const BASE_SIZE = 560; // Initial side length in world units

  // --- BigInt Math Helper Functions ---
  const BigPow = (base, exp) => BigInt(base) ** BigInt(exp);

  function formatBigNumber(n) {
    const s = n.toString();
    if (s.length > 5) {
      const num = Number(n);
      const exp = Math.floor(Math.log10(num));
      const mantissa = (num / Math.pow(10, exp)).toFixed(3);
      return {
        formatted: n.toLocaleString('en-US'),
        sci: `${mantissa} × 10${toSuperscript(exp)}`
      };
    }
    return {
      formatted: n.toLocaleString('en-US'),
      sci: ''
    };
  }

  function toSuperscript(num) {
    const chars = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    return String(num).split('').map(c => chars[c] || c).join('');
  }

  // --- Real-Time Analytics Calculations ---
  // Only called when depth or fractal type changes (NOT on every pan/zoom frame)
  function updateAnalytics() {
    const n = state.depth;
    const isTriangle = state.type === 'triangle';

    dom.lblCurrentN.textContent = `n = ${n}`;
    dom.metricDepth.textContent = n;

    if (isTriangle) {
      // 1. Scale factor
      dom.metricScaleFactor.textContent = `(1/2)ⁿ = 1/${Math.pow(2, n)} (${(Math.pow(0.5, n) * 100).toFixed(2)}%)`;
      dom.metricDepthFormula.textContent = `Side length: s₀ / 2ⁿ`;

      // 2. Remaining Shapes Count N(n) = 3^n
      const remBig = BigPow(3, n);
      const remFormatted = formatBigNumber(remBig);
      dom.badgeRemainingFormula.textContent = `N(n) = 3ⁿ`;
      dom.metricRemainingCount.textContent = remFormatted.formatted;
      dom.metricRemainingSci.textContent = remFormatted.sci;
      dom.metricRemainingDesc.textContent = `Number of colored self-similar triangles`;
      dom.progressRemaining.style.width = `${Math.min(100, ((n + 1) / 8) * 100)}%`;

      // 3. Removed Shapes Count
      const stepRemoved = n === 0 ? 0n : BigPow(3, n - 1);
      const cumRemoved = (remBig - 1n) / 2n;
      const cumFormatted = formatBigNumber(cumRemoved);
      dom.badgeRemovedFormula.textContent = `(3ⁿ - 1) / 2`;
      dom.metricRemovedCumulative.textContent = cumFormatted.formatted;
      dom.metricRemovedSci.textContent = cumFormatted.sci;
      dom.metricRemovedFormula.textContent = `Formula: (3ⁿ - 1) / 2 inverted triangles`;
      dom.metricRemovedStep.textContent = stepRemoved.toLocaleString('en-US');

      // 4. Colored Area: (3/4)^n
      const areaRatio = Math.pow(0.75, n);
      const areaPct = (areaRatio * 100).toFixed(n > 4 ? 4 : 2);
      const numFraction = BigPow(3, n);
      const denFraction = BigPow(4, n);
      dom.badgeColoredAreaFormula.textContent = `(3/4)ⁿ`;
      dom.metricColoredPct.textContent = `${areaPct}%`;
      dom.metricColoredFraction.textContent = `Fraction: ${numFraction.toLocaleString('en-US')} / ${denFraction.toLocaleString('en-US')}`;
      dom.progressColoredArea.style.width = `${Math.max(0.5, areaRatio * 100)}%`;

      // 5. White / Removed Area: 1 - (3/4)^n
      const removedRatio = 1 - areaRatio;
      const removedPct = (removedRatio * 100).toFixed(n > 4 ? 4 : 2);
      const removedNum = denFraction - numFraction;
      dom.badgeRemovedAreaFormula.textContent = `1 - (3/4)ⁿ`;
      dom.metricRemovedPct.textContent = `${removedPct}%`;
      dom.metricRemovedFraction.textContent = `Fraction: ${removedNum.toLocaleString('en-US')} / ${denFraction.toLocaleString('en-US')}`;
      dom.progressRemovedArea.style.width = `${removedRatio * 100}%`;

      // 6. Hausdorff Dimension: log(3) / log(2) ≈ 1.5849625
      const dH = Math.log(3) / Math.log(2);
      dom.metricDimension.textContent = dH.toFixed(4);
      dom.metricDimensionFormula.textContent = `log(3) / log(2)`;
      dom.valHausdorffSummary.textContent = `D = log(3) / log(2) ≈ ${dH.toFixed(4)}`;
      dom.metricDimensionDetail.textContent = `Between 1D line and 2D surface. Box-counting: D = ln(3)/ln(2).`;

      // Explainer Content
      dom.explainerContent.innerHTML = `
        <p><strong>The Sierpiński Gasket (Triangle)</strong> is constructed recursively by removing the inverted central triangle at each stage.</p>
        <p><strong>Fractal Dimension Calculation:</strong> At each step, 1 triangle is replaced by <span class="code-inline">N = 3</span> sub-triangles scaled by factor <span class="code-inline">s = 1/2</span>. The Hausdorff dimension is:
          <br><span class="code-inline">D = log(N) / log(1/s) = log(3) / log(2) &approx; 1.58496</span>
        </p>
        <table class="explainer-table">
          <thead>
            <tr><th>Depth (n)</th><th>Remaining N(n)</th><th>Removed (Cumul.)</th><th>Remaining Area</th><th>Perimeter (P₀=3)</th></tr>
          </thead>
          <tbody>
            <tr><td>0</td><td>1</td><td>0</td><td>100.00%</td><td>3.00</td></tr>
            <tr><td>1</td><td>3</td><td>1</td><td>75.00%</td><td>4.50</td></tr>
            <tr><td>2</td><td>9</td><td>4</td><td>56.25%</td><td>6.75</td></tr>
            <tr><td>3</td><td>27</td><td>13</td><td>42.19%</td><td>10.13</td></tr>
            <tr><td>5</td><td>243</td><td>121</td><td>23.73%</td><td>22.78</td></tr>
            <tr><td>7</td><td>2,187</td><td>1,093</td><td>13.35%</td><td>51.26</td></tr>
          </tbody>
        </table>
        <p><strong>The Classic Paradox:</strong> As <span class="code-inline">n &rarr; &infin;</span>, the remaining colored area approaches <span class="code-inline">0</span>, yet the boundary perimeter grows infinitely: <span class="code-inline">P(n) = 3 &times; (3/2)ⁿ &rarr; &infin;</span>.</p>
      `;

    } else {
      // SIERPINSKI CARPET
      // 1. Scale factor
      dom.metricScaleFactor.textContent = `(1/3)ⁿ = 1/${Math.pow(3, n)} (${(Math.pow(1/3, n) * 100).toFixed(2)}%)`;
      dom.metricDepthFormula.textContent = `Side length: s₀ / 3ⁿ`;

      // 2. Remaining Shapes Count N(n) = 8^n
      const remBig = BigPow(8, n);
      const remFormatted = formatBigNumber(remBig);
      dom.badgeRemainingFormula.textContent = `N(n) = 8ⁿ`;
      dom.metricRemainingCount.textContent = remFormatted.formatted;
      dom.metricRemainingSci.textContent = remFormatted.sci;
      dom.metricRemainingDesc.textContent = `Number of colored self-similar squares`;
      dom.progressRemaining.style.width = `${Math.min(100, ((n + 1) / 8) * 100)}%`;

      // 3. Removed Shapes Count
      const stepRemoved = n === 0 ? 0n : BigPow(8, n - 1);
      const cumRemoved = (remBig - 1n) / 7n;
      const cumFormatted = formatBigNumber(cumRemoved);
      dom.badgeRemovedFormula.textContent = `(8ⁿ - 1) / 7`;
      dom.metricRemovedCumulative.textContent = cumFormatted.formatted;
      dom.metricRemovedSci.textContent = cumFormatted.sci;
      dom.metricRemovedFormula.textContent = `Formula: (8ⁿ - 1) / 7 central square voids`;
      dom.metricRemovedStep.textContent = stepRemoved.toLocaleString('en-US');

      // 4. Colored Area: (8/9)^n
      const areaRatio = Math.pow(8 / 9, n);
      const areaPct = (areaRatio * 100).toFixed(n > 4 ? 4 : 2);
      const numFraction = BigPow(8, n);
      const denFraction = BigPow(9, n);
      dom.badgeColoredAreaFormula.textContent = `(8/9)ⁿ`;
      dom.metricColoredPct.textContent = `${areaPct}%`;
      dom.metricColoredFraction.textContent = `Fraction: ${numFraction.toLocaleString('en-US')} / ${denFraction.toLocaleString('en-US')}`;
      dom.progressColoredArea.style.width = `${Math.max(0.5, areaRatio * 100)}%`;

      // 5. White / Removed Area: 1 - (8/9)^n
      const removedRatio = 1 - areaRatio;
      const removedPct = (removedRatio * 100).toFixed(n > 4 ? 4 : 2);
      const removedNum = denFraction - numFraction;
      dom.badgeRemovedAreaFormula.textContent = `1 - (8/9)ⁿ`;
      dom.metricRemovedPct.textContent = `${removedPct}%`;
      dom.metricRemovedFraction.textContent = `Fraction: ${removedNum.toLocaleString('en-US')} / ${denFraction.toLocaleString('en-US')}`;
      dom.progressRemovedArea.style.width = `${removedRatio * 100}%`;

      // 6. Hausdorff Dimension: log(8) / log(3) ≈ 1.892789
      const dH = Math.log(8) / Math.log(3);
      dom.metricDimension.textContent = dH.toFixed(4);
      dom.metricDimensionFormula.textContent = `log(8) / log(3)`;
      dom.valHausdorffSummary.textContent = `D = log(8) / log(3) ≈ ${dH.toFixed(4)}`;
      dom.metricDimensionDetail.textContent = `More dense than triangle. Box-counting: D = 3·ln(2)/ln(3).`;

      // Explainer Content
      dom.explainerContent.innerHTML = `
        <p><strong>The Sierpiński Carpet</strong> is a 2D plane fractal generalization of the Cantor Set, introduced by Wacław Sierpiński in 1916.</p>
        <p><strong>Fractal Dimension Calculation:</strong> Each square is subdivided into 9 equal squares, and the 1 center square is excised, leaving <span class="code-inline">N = 8</span> sub-squares of scale <span class="code-inline">s = 1/3</span>. The Hausdorff dimension is:
          <br><span class="code-inline">D = log(N) / log(1/s) = log(8) / log(3) &approx; 1.89279</span>
        </p>
        <table class="explainer-table">
          <thead>
            <tr><th>Depth (n)</th><th>Remaining N(n)</th><th>Removed (Cumul.)</th><th>Remaining Area</th><th>Perimeter (P₀=4)</th></tr>
          </thead>
          <tbody>
            <tr><td>0</td><td>1</td><td>0</td><td>100.00%</td><td>4.00</td></tr>
            <tr><td>1</td><td>8</td><td>1</td><td>88.89%</td><td>5.33</td></tr>
            <tr><td>2</td><td>64</td><td>9</td><td>79.01%</td><td>7.11</td></tr>
            <tr><td>3</td><td>512</td><td>73</td><td>70.23%</td><td>9.48</td></tr>
            <tr><td>5</td><td>32,768</td><td>4,681</td><td>55.49%</td><td>16.85</td></tr>
            <tr><td>7</td><td>2,097,152</td><td>299,593</td><td>43.85%</td><td>29.96</td></tr>
          </tbody>
        </table>
        <p><strong>Geometric Density:</strong> Unlike the Triangle where area decays by <span class="code-inline">0.75ⁿ</span>, the Carpet retains more material (<span class="code-inline">0.8889ⁿ</span>), yielding a higher fractal dimension of <span class="code-inline">1.8928</span>.</p>
      `;
    }

    // Complexity Warning indicator
    if (state.depth >= 6) {
      dom.depthWarning.classList.remove('hidden');
      if (state.type === 'carpet') {
        const count = state.depth === 7 ? '2,097,152' : '262,144';
        dom.depthWarningText.innerHTML = `<strong>Depth ${state.depth} Notice:</strong> Carpet generates ${count} sub-elements. Optimized cutouts and GPU LOD active.`;
      } else {
        const count = state.depth === 7 ? '2,187' : '729';
        dom.depthWarningText.innerHTML = `<strong>Depth ${state.depth} Active:</strong> Triangle creates ${count} sub-triangles. Canvas 2D running at peak efficiency.`;
      }
      dom.badgeComplexity.textContent = state.depth === 7 ? 'Level 7 Extreme' : 'Level 6 High';
      dom.badgeComplexity.className = 'badge warning';
    } else {
      dom.depthWarning.classList.add('hidden');
      dom.badgeComplexity.textContent = 'Active';
      dom.badgeComplexity.className = 'badge';
    }
  }

  // --- Canvas Coordinate Space Transformations ---
  // Cap devicePixelRatio to 2 to eliminate mobile 3x/4x GPU fill-rate exhaustion
  function getEffectiveDPR() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resizeCanvas() {
    const rect = dom.canvasViewport.getBoundingClientRect();
    const dpr = getEffectiveDPR();
    const w = Math.max(rect.width || 0, 400);
    const h = Math.max(rect.height || 0, 400);
    dom.canvas.width = Math.round(w * dpr);
    dom.canvas.height = Math.round(h * dpr);
    requestRender();
  }

  function worldToScreen(wx, wy) {
    const dpr = getEffectiveDPR();
    const w = dom.canvas.width / dpr;
    const h = dom.canvas.height / dpr;
    return {
      x: w / 2 + (wx - state.camera.x) * state.camera.zoom,
      y: h / 2 + (wy - state.camera.y) * state.camera.zoom
    };
  }

  function screenToWorld(sx, sy) {
    const dpr = getEffectiveDPR();
    const w = dom.canvas.width / dpr;
    const h = dom.canvas.height / dpr;
    return {
      x: state.camera.x + (sx - w / 2) / state.camera.zoom,
      y: state.camera.y + (sy - h / 2) / state.camera.zoom
    };
  }

  // --- Recursive Fractal Generators with Adaptive Screen-Space LOD ---

  /**
   * Sierpiński Triangle Generator
   */
  function renderSierpinskiTriangle(targetCtx, scale, dpr, offX, offY, viewWidth, viewHeight, isInteractive) {
    const n = state.depth;
    const s = BASE_SIZE;
    const h = s * (Math.sqrt(3) / 2);

    // Initial Equilateral Triangle centered at (0, 0)
    const p1 = { x: 0, y: -h * (2 / 3) };
    const p2 = { x: -s / 2, y: h / 3 };
    const p3 = { x: s / 2, y: h / 3 };

    const pixelScale = scale * dpr;
    const lodThreshold = isInteractive ? 1.6 : 0.75;

    if (state.mode === 'cutouts') {
      targetCtx.fillStyle = state.backgroundColor;
      targetCtx.beginPath();
      targetCtx.moveTo(p1.x, p1.y);
      targetCtx.lineTo(p2.x, p2.y);
      targetCtx.lineTo(p3.x, p3.y);
      targetCtx.closePath();
      targetCtx.fill();

      if (n > 0) {
        targetCtx.fillStyle = state.patternColor;
        targetCtx.beginPath();
        drawTriangleHoles(targetCtx, p1, p2, p3, n, pixelScale, lodThreshold);
        targetCtx.fill();
      }
      return;
    }

    // Filled or Wireframe mode
    targetCtx.beginPath();
    generateTriangles(targetCtx, p1, p2, p3, n, pixelScale, lodThreshold);

    if (state.mode === 'wireframe') {
      targetCtx.strokeStyle = state.patternColor;
      targetCtx.lineWidth = Math.max(1 / scale, 1.2);
      targetCtx.stroke();
    } else {
      // Filled mode
      targetCtx.fillStyle = state.patternColor;
      targetCtx.fill();
    }
  }

  function generateTriangles(tCtx, a, b, c, depth, pixelScale, lodThreshold) {
    if (depth === 0) {
      tCtx.moveTo(a.x, a.y);
      tCtx.lineTo(b.x, b.y);
      tCtx.lineTo(c.x, c.y);
      tCtx.closePath();
      return;
    }

    // Screen-space LOD: if the triangle edge is smaller than threshold device pixels, draw solid
    const side = Math.hypot(b.x - a.x, b.y - a.y) * pixelScale;
    if (side < lodThreshold) {
      tCtx.moveTo(a.x, a.y);
      tCtx.lineTo(b.x, b.y);
      tCtx.lineTo(c.x, c.y);
      tCtx.closePath();
      return;
    }

    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };

    generateTriangles(tCtx, a, ab, ca, depth - 1, pixelScale, lodThreshold);
    generateTriangles(tCtx, ab, b, bc, depth - 1, pixelScale, lodThreshold);
    generateTriangles(tCtx, ca, bc, c, depth - 1, pixelScale, lodThreshold);
  }

  function drawTriangleHoles(tCtx, a, b, c, depth, pixelScale, lodThreshold) {
    if (depth === 0) return;

    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };

    const side = Math.hypot(bc.x - ab.x, bc.y - ab.y) * pixelScale;
    if (side < lodThreshold) {
      return;
    }

    // Inverted center hole
    tCtx.moveTo(ab.x, ab.y);
    tCtx.lineTo(bc.x, bc.y);
    tCtx.lineTo(ca.x, ca.y);
    tCtx.closePath();

    drawTriangleHoles(tCtx, a, ab, ca, depth - 1, pixelScale, lodThreshold);
    drawTriangleHoles(tCtx, ab, b, bc, depth - 1, pixelScale, lodThreshold);
    drawTriangleHoles(tCtx, ca, bc, c, depth - 1, pixelScale, lodThreshold);
  }

  /**
   * Sierpiński Carpet Generator
   * Highly optimized:
   * - Filled mode draws solid base, then excises removed squares in batched fillRect
   * - Viewport Frustum Culling + Device-Pixel LOD avoids recursing invisible sub-pixels
   */
  function renderSierpinskiCarpet(targetCtx, scale, dpr, offX, offY, viewWidth, viewHeight, isInteractive) {
    const n = state.depth;
    const s = BASE_SIZE;
    const halfS = s / 2;

    // Viewport bounding box in world coordinates for frustum culling
    const minX = offX - (viewWidth / 2) / scale;
    const maxX = offX + (viewWidth / 2) / scale;
    const minY = offY - (viewHeight / 2) / scale;
    const maxY = offY + (viewHeight / 2) / scale;

    const pixelScale = scale * dpr;
    // During active gesture (drag / 2-finger pinch), use 1.6px for guaranteed 60 FPS
    // When resting / static, use 0.75px for crisp sub-pixel detail
    const lodThreshold = isInteractive ? 1.6 : 0.75;

    if (state.mode === 'cutouts') {
      targetCtx.fillStyle = state.backgroundColor;
      targetCtx.fillRect(-halfS, -halfS, s, s);

      if (n > 0) {
        targetCtx.fillStyle = state.patternColor;
        drawCarpetCutouts(targetCtx, -halfS, -halfS, s, n, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      }
      return;
    }

    if (state.mode === 'wireframe') {
      targetCtx.strokeStyle = state.patternColor;
      targetCtx.lineWidth = Math.max(1 / scale, 1.2);
      targetCtx.strokeRect(-halfS, -halfS, s, s);

      if (n > 0) {
        drawCarpetWireframe(targetCtx, -halfS, -halfS, s, n, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      }
      return;
    }

    // Filled mode:
    // 1. Draw solid outer base in pattern color
    targetCtx.fillStyle = state.patternColor;
    targetCtx.fillRect(-halfS, -halfS, s, s);

    if (n === 0) return;

    // 2. Punch out the removed center squares using background color
    targetCtx.fillStyle = state.backgroundColor;
    drawCarpetHoles(targetCtx, -halfS, -halfS, s, n, pixelScale, lodThreshold, minX, maxX, minY, maxY);
  }

  function drawCarpetHoles(tCtx, x, y, size, depth, pixelScale, lodThreshold, minX, maxX, minY, maxY) {
    // Frustum cull
    if (x > maxX || x + size < minX || y > maxY || y + size < minY) {
      return;
    }

    // Screen-space LOD threshold in physical device pixels
    if (size * pixelScale < lodThreshold) {
      return;
    }

    const sub = size / 3;

    // Center square is removed
    tCtx.fillRect(x + sub, y + sub, sub, sub);

    if (depth > 1) {
      const nextDepth = depth - 1;
      drawCarpetHoles(tCtx, x,           y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x + sub,     y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x + 2 * sub, y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x,           y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x + 2 * sub, y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x,           y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x + sub,     y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetHoles(tCtx, x + 2 * sub, y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
    }
  }

  function drawCarpetWireframe(tCtx, x, y, size, depth, pixelScale, lodThreshold, minX, maxX, minY, maxY) {
    if (x > maxX || x + size < minX || y > maxY || y + size < minY) return;
    if (size * pixelScale < lodThreshold * 1.5) return;

    const sub = size / 3;
    tCtx.strokeRect(x + sub, y + sub, sub, sub);

    if (depth > 1) {
      const nextDepth = depth - 1;
      drawCarpetWireframe(tCtx, x,           y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x + sub,     y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x + 2 * sub, y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x,           y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x + 2 * sub, y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x,           y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x + sub,     y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetWireframe(tCtx, x + 2 * sub, y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
    }
  }

  function drawCarpetCutouts(tCtx, x, y, size, depth, pixelScale, lodThreshold, minX, maxX, minY, maxY) {
    if (x > maxX || x + size < minX || y > maxY || y + size < minY) return;
    if (size * pixelScale < lodThreshold) return;

    const sub = size / 3;
    tCtx.fillRect(x + sub, y + sub, sub, sub);

    if (depth > 1) {
      const nextDepth = depth - 1;
      drawCarpetCutouts(tCtx, x,           y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x + sub,     y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x + 2 * sub, y,           sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x,           y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x + 2 * sub, y + sub,     sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x,           y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x + sub,     y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
      drawCarpetCutouts(tCtx, x + 2 * sub, y + 2 * sub, sub, nextDepth, pixelScale, lodThreshold, minX, maxX, minY, maxY);
    }
  }

  // --- requestAnimationFrame Coalescing Pipeline ---
  let renderPending = false;
  function requestRender() {
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        render();
        renderPending = false;
      });
    }
  }

  // --- Main Render Pipeline ---
  function render() {
    const tStart = performance.now();
    const dpr = getEffectiveDPR();
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const cssW = w / dpr;
    const cssH = h / dpr;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Canvas Background
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Apply Camera Transform with DPR scaling
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    const isInteractive = state.isInteracting;

    // Render active fractal
    if (state.type === 'triangle') {
      renderSierpinskiTriangle(ctx, state.camera.zoom, dpr, state.camera.x, state.camera.y, cssW, cssH, isInteractive);
    } else {
      renderSierpinskiCarpet(ctx, state.camera.zoom, dpr, state.camera.x, state.camera.y, cssW, cssH, isInteractive);
    }

    ctx.restore();

    // Benchmarking & HUD Updates
    const elapsed = performance.now() - tStart;
    dom.hudRenderTime.textContent = `Render: ${elapsed < 1 ? elapsed.toFixed(2) : elapsed.toFixed(1)}ms`;
    dom.hudZoomText.textContent = `${Math.round(state.camera.zoom * 100)}%`;
    dom.hudFractalName.textContent = state.type === 'triangle' ? 'Sierpiński Triangle' : 'Sierpiński Carpet';
  }

  // --- Viewport & Camera Interaction Handlers ---
  function resetCamera() {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.zoom = 1;
    requestRender();
  }

  function adjustZoom(factor, clientX, clientY) {
    const rect = dom.canvasViewport.getBoundingClientRect();
    const sx = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const sy = clientY !== undefined ? clientY - rect.top : rect.height / 2;

    const worldBefore = screenToWorld(sx, sy);
    const newZoom = Math.min(Math.max(state.camera.zoom * factor, 0.1), 500);

    state.camera.zoom = newZoom;
    const worldAfter = screenToWorld(sx, sy);

    state.camera.x += (worldBefore.x - worldAfter.x);
    state.camera.y += (worldBefore.y - worldAfter.y);

    requestRender();
  }

  // Mouse wheel zoom (desktop)
  dom.canvasViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    adjustZoom(zoomFactor, e.clientX, e.clientY);
  }, { passive: false });

  // --- Touch Multi-Gesture Engine (Phones & Tablets) ---
  const touchState = {
    prevDist: 0,
    prevMidX: 0,
    prevMidY: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    lastTapTime: 0
  };

  function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }

  function getTouchMidpoint(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
  }

  dom.canvasViewport.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.isInteracting = true;

    if (e.touches.length === 1) {
      // 1 Finger: start single-finger pan
      touchState.lastTouchX = e.touches[0].clientX;
      touchState.lastTouchY = e.touches[0].clientY;
      touchState.prevDist = 0;

      // Double-tap detection to reset camera
      const now = performance.now();
      if (now - touchState.lastTapTime < 300) {
        resetCamera();
        touchState.lastTapTime = 0;
        return;
      }
      touchState.lastTapTime = now;

    } else if (e.touches.length === 2) {
      // 2 Fingers: initialize pinch distance and midpoint
      touchState.prevDist = getTouchDistance(e.touches[0], e.touches[1]);
      const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
      touchState.prevMidX = mid.x;
      touchState.prevMidY = mid.y;
    }
  }, { passive: false });

  dom.canvasViewport.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!state.isInteracting) return;

    if (e.touches.length === 1) {
      // Single-finger drag / pan
      const tx = e.touches[0].clientX;
      const ty = e.touches[0].clientY;
      const dx = (tx - touchState.lastTouchX) / state.camera.zoom;
      const dy = (ty - touchState.lastTouchY) / state.camera.zoom;
      state.camera.x -= dx;
      state.camera.y -= dy;
      touchState.lastTouchX = tx;
      touchState.lastTouchY = ty;
      requestRender();

    } else if (e.touches.length === 2) {
      // Two-finger pinch-to-zoom & simultaneous pan
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const mid = getTouchMidpoint(e.touches[0], e.touches[1]);

      if (touchState.prevDist > 0 && dist > 0) {
        const zoomFactor = dist / touchState.prevDist;

        const rect = dom.canvasViewport.getBoundingClientRect();
        const sx = mid.x - rect.left;
        const sy = mid.y - rect.top;

        const worldBefore = screenToWorld(sx, sy);
        const newZoom = Math.min(Math.max(state.camera.zoom * zoomFactor, 0.1), 500);
        state.camera.zoom = newZoom;
        const worldAfter = screenToWorld(sx, sy);

        // Pan with midpoint translation
        const dMidX = (mid.x - touchState.prevMidX) / state.camera.zoom;
        const dMidY = (mid.y - touchState.prevMidY) / state.camera.zoom;

        state.camera.x += (worldBefore.x - worldAfter.x) - dMidX;
        state.camera.y += (worldBefore.y - worldAfter.y) - dMidY;

        requestRender();
      }

      touchState.prevDist = dist;
      touchState.prevMidX = mid.x;
      touchState.prevMidY = mid.y;
    }
  }, { passive: false });

  const handleTouchEnd = (e) => {
    if (e.touches.length === 1) {
      // Seamless transition from 2 fingers to 1 finger without jump
      touchState.lastTouchX = e.touches[0].clientX;
      touchState.lastTouchY = e.touches[0].clientY;
      touchState.prevDist = 0;
    } else if (e.touches.length === 0) {
      // All fingers lifted: return to full fidelity
      state.isInteracting = false;
      touchState.prevDist = 0;
      requestRender();
    }
  };

  dom.canvasViewport.addEventListener('touchend', handleTouchEnd, { passive: true });
  dom.canvasViewport.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  // --- Desktop Mouse Pointer Handlers ---
  dom.canvasViewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    state.isDragging = true;
    state.isInteracting = true;
    state.dragStart = { x: e.clientX, y: e.clientY };
    state.cameraStart = { x: state.camera.x, y: state.camera.y };
    dom.canvasViewport.setPointerCapture(e.pointerId);
  });

  dom.canvasViewport.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !state.isDragging) return;
    const dx = (e.clientX - state.dragStart.x) / state.camera.zoom;
    const dy = (e.clientY - state.dragStart.y) / state.camera.zoom;
    state.camera.x = state.cameraStart.x - dx;
    state.camera.y = state.cameraStart.y - dy;
    requestRender();
  });

  const endMouseDrag = (e) => {
    if (e.pointerType === 'mouse' && state.isDragging) {
      state.isDragging = false;
      state.isInteracting = false;
      try { dom.canvasViewport.releasePointerCapture(e.pointerId); } catch (_) {}
      requestRender();
    }
  };

  dom.canvasViewport.addEventListener('pointerup', endMouseDrag);
  dom.canvasViewport.addEventListener('pointercancel', endMouseDrag);
  dom.canvasViewport.addEventListener('dblclick', resetCamera);

  dom.btnZoomIn.addEventListener('click', () => adjustZoom(1.25));
  dom.btnZoomOut.addEventListener('click', () => adjustZoom(1 / 1.25));
  dom.btnRecenter.addEventListener('click', resetCamera);
  dom.btnResetView.addEventListener('click', resetCamera);

  // --- Depth Input & Slider Synchronization ---
  function setDepth(val) {
    const clamped = Math.max(0, Math.min(7, parseInt(val, 10) || 0));
    state.depth = clamped;
    dom.sliderDepth.value = clamped;
    dom.inputDepth.value = clamped;
    updateAnalytics();
    requestRender();
  }

  dom.sliderDepth.addEventListener('input', (e) => setDepth(e.target.value));
  dom.inputDepth.addEventListener('change', (e) => setDepth(e.target.value));

  // --- Fractal Type Selection ---
  function setFractalType(type) {
    if (state.type === type) return;
    state.type = type;

    dom.btnTypeTriangle.classList.toggle('active', type === 'triangle');
    dom.btnTypeTriangle.setAttribute('aria-checked', type === 'triangle');
    dom.btnTypeCarpet.classList.toggle('active', type === 'carpet');
    dom.btnTypeCarpet.setAttribute('aria-checked', type === 'carpet');

    updateAnalytics();
    resetCamera();
  }

  dom.btnTypeTriangle.addEventListener('click', () => setFractalType('triangle'));
  dom.btnTypeCarpet.addEventListener('click', () => setFractalType('carpet'));

  // --- Render Mode Selection ---
  function setRenderMode(mode) {
    state.mode = mode;
    [dom.btnModeFilled, dom.btnModeWireframe, dom.btnModeCutouts].forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active);
    });
    requestRender();
  }

  dom.btnModeFilled.addEventListener('click', () => setRenderMode('filled'));
  dom.btnModeWireframe.addEventListener('click', () => setRenderMode('wireframe'));
  dom.btnModeCutouts.addEventListener('click', () => setRenderMode('cutouts'));

  // --- Color Pickers & Presets ---
  function updateColors(pattern, bg) {
    state.patternColor = pattern;
    state.backgroundColor = bg;
    dom.colorPattern.value = pattern;
    dom.colorBackground.value = bg;
    dom.colorPatternHex.textContent = pattern.toUpperCase();
    dom.colorBackgroundHex.textContent = bg.toUpperCase();
    requestRender();
  }

  dom.colorPattern.addEventListener('input', (e) => {
    updateColors(e.target.value, state.backgroundColor);
  });

  dom.colorBackground.addEventListener('input', (e) => {
    updateColors(state.patternColor, e.target.value);
  });

  dom.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dom.presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateColors(chip.dataset.pattern, chip.dataset.bg);
    });
  });

  // --- Progressive Animation Playback ---
  function toggleAnimation() {
    if (state.isPlaying) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }

  function startAnimation() {
    state.isPlaying = true;
    dom.iconPlay.classList.add('hidden');
    dom.iconPause.classList.remove('hidden');
    dom.labelPlay.textContent = 'Pause';

    let current = 0;
    setDepth(0);

    state.animationTimer = setInterval(() => {
      current++;
      if (current > 7) {
        current = 0;
      }
      setDepth(current);
    }, 1100);
  }

  function stopAnimation() {
    state.isPlaying = false;
    clearInterval(state.animationTimer);
    state.animationTimer = null;
    dom.iconPlay.classList.remove('hidden');
    dom.iconPause.classList.add('hidden');
    dom.labelPlay.textContent = 'Play Evolution';
  }

  dom.btnPlayAnimation.addEventListener('click', toggleAnimation);
  dom.btnStepPrev.addEventListener('click', () => {
    stopAnimation();
    setDepth(state.depth - 1);
  });
  dom.btnStepNext.addEventListener('click', () => {
    stopAnimation();
    setDepth(state.depth + 1);
  });

  // --- High-Resolution PNG & Vector SVG Export ---
  function exportPNG() {
    const exportCanvas = document.createElement('canvas');
    const size = 2048; // Crisp 2K master export
    exportCanvas.width = size;
    exportCanvas.height = size;
    const expCtx = exportCanvas.getContext('2d');

    // Fill background
    expCtx.fillStyle = state.backgroundColor;
    expCtx.fillRect(0, 0, size, size);

    // Center fractal
    expCtx.save();
    expCtx.translate(size / 2, size / 2);
    const exportScale = (size / BASE_SIZE) * 0.82;
    expCtx.scale(exportScale, exportScale);

    if (state.type === 'triangle') {
      renderSierpinskiTriangle(expCtx, exportScale, 1, 0, 0, size, size, false);
    } else {
      renderSierpinskiCarpet(expCtx, exportScale, 1, 0, 0, size, size, false);
    }
    expCtx.restore();

    // Trigger download
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sierpinski-${state.type}-depth-${state.depth}-${state.mode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function exportSVG() {
    if (state.type === 'carpet' && state.depth >= 6) {
      const count = state.depth === 7 ? '299,593' : '37,449';
      const proceed = confirm(`At depth n = ${state.depth}, the Carpet SVG will generate ${count} vector elements, resulting in a large file. PNG export is recommended.\n\nDo you want to continue with SVG export?`);
      if (!proceed) return;
    }

    const size = 1200;
    const s = BASE_SIZE;
    const n = state.depth;
    const strokeColor = state.patternColor;
    const fillColor = state.mode === 'wireframe' ? 'none' : state.patternColor;
    const bgColor = state.backgroundColor;

    let svgElements = '';

    if (state.type === 'triangle') {
      const h = s * (Math.sqrt(3) / 2);
      const p1 = { x: size / 2, y: size / 2 - h * (2 / 3) };
      const p2 = { x: size / 2 - s / 2, y: size / 2 + h / 3 };
      const p3 = { x: size / 2 + s / 2, y: size / 2 + h / 3 };

      const polygons = [];
      collectTrianglePolygons(p1, p2, p3, n, polygons);

      svgElements = polygons.map(pts => 
        `<polygon points="${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} ${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)} ${pts[2].x.toFixed(2)},${pts[2].y.toFixed(2)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${state.mode === 'wireframe' ? 1.5 : 0.5}"/>`
      ).join('\n  ');

    } else {
      // Carpet SVG
      const startX = (size - s) / 2;
      const startY = (size - s) / 2;
      
      // Base square
      svgElements += `<rect x="${startX.toFixed(2)}" y="${startY.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${state.mode === 'wireframe' ? 1.5 : 0}"/>\n  `;

      if (n > 0) {
        const holes = [];
        collectCarpetHoles(startX, startY, s, n, holes);
        const holeFill = bgColor;
        svgElements += holes.map(r => 
          `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="${holeFill}" stroke="${state.mode === 'wireframe' ? strokeColor : 'none'}" stroke-width="1"/>`
        ).join('\n  ');
      }
    }

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  ${svgElements}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sierpinski-${state.type}-depth-${state.depth}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function collectTrianglePolygons(a, b, c, depth, out) {
    if (depth === 0) {
      out.push([a, b, c]);
      return;
    }
    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };

    collectTrianglePolygons(a, ab, ca, depth - 1, out);
    collectTrianglePolygons(ab, b, bc, depth - 1, out);
    collectTrianglePolygons(ca, bc, c, depth - 1, out);
  }

  function collectCarpetHoles(x, y, size, depth, out) {
    const sub = size / 3;
    out.push({ x: x + sub, y: y + sub, w: sub, h: sub });

    if (depth > 1) {
      const next = depth - 1;
      collectCarpetHoles(x,           y,           sub, next, out);
      collectCarpetHoles(x + sub,     y,           sub, next, out);
      collectCarpetHoles(x + 2 * sub, y,           sub, next, out);
      collectCarpetHoles(x,           y + sub,     sub, next, out);
      collectCarpetHoles(x + 2 * sub, y + sub,     sub, next, out);
      collectCarpetHoles(x,           y + 2 * sub, sub, next, out);
      collectCarpetHoles(x + sub,     y + 2 * sub, sub, next, out);
      collectCarpetHoles(x + 2 * sub, y + 2 * sub, sub, next, out);
    }
  }

  dom.btnExportPNG.addEventListener('click', exportPNG);
  dom.btnExportSVG.addEventListener('click', exportSVG);

  // --- Theme Toggle ---
  function initTheme() {
    const savedTheme = localStorage.getItem('sierpinski-theme') || 
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  dom.btnThemeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sierpinski-theme', next);
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      setDepth(state.depth + 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setDepth(state.depth - 1);
    } else if (e.key === '+' || e.key === '=') {
      adjustZoom(1.2);
    } else if (e.key === '-' || e.key === '_') {
      adjustZoom(1 / 1.2);
    } else if (e.key.toLowerCase() === 'r') {
      resetCamera();
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleAnimation();
    }
  });

  // --- Initialization ---
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateAnalytics();
    resizeCanvas();
  });

  // Immediate initial render pass
  initTheme();
  updateAnalytics();
  resizeCanvas();
})();
