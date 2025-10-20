/*
 * Tank Sim — Exporter v3.2.4-hybrid
 * ----------------------------------
 * Goals:
 *  - Keep v3.2.3 resiliency and port-aware connections.
 *  - Add SVG sprite pipeline that fetches component SVGs from GitHub (or provided base) and embeds as <symbol>s in <defs>.
 *  - Prefer <use> based instances; fall back to library symbol/image/diagnostic.
 *  - Inject a minimal boot that initializes managers so valve/pump modals function in the exported sim.
 *
 * Usage:
 *   const exporter = new SimulatorExporter(designer, {
 *     baseUrl: 'https://sco314.github.io/tank-sim/',
 *     assetsBase: 'assets/svg/components/',   // relative to baseUrl unless absolute
 *   });
 *   const html = await exporter.exportSimulator(progress);
 *
 * NOTE: This file does not depend on bundlers. It assumes `fetch` is available.
 */

(function(global){
  'use strict';

  const DEFAULT_BASE_URL = (global?.SYSTEM_CONFIG?.BASE_URL) || 'https://sco314.github.io/tank-sim/';

  /**
   * Optional progress helper interface used by the Designer UI.
   * If not supplied, calls are no-ops.
   */
  function mkProgress(progress){
    const noop = ()=>{};
    return {
      update: progress?.update || noop,
      setDetail: progress?.setDetail || noop,
    };
  }

  /**
   * Simple HTML escaper
   */
  const esc = (s)=>String(s).replace(/[&<>]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));

  /** Orientation helpers **/
  const ORIENT = { R:0, U:90, L:180, D:270 };

  /**
   * Simulator Exporter (hybrid)
   */
  class SimulatorExporter {
    constructor(designer, opts={}){
      this.designer = designer;
      this.options = Object.assign({
        baseUrl: DEFAULT_BASE_URL,
        assetsBase: 'assets/svg/components/',
        title: 'Process Simulator',
      }, opts);

      // Sprite registry built during export
      this._symbolRegistry = new Map(); // type -> symbolId
      this._spriteString = '';
    }

    /** MAIN ENTRY **/
    async exportSimulator(progress){
      const p = mkProgress(progress);

      // 1) Collect design data from designer
      p.update('📦 Packaging design…', 20);
      const design = this._collectDesign();

      // 2) Build SVG sprite by fetching used assets
      p.update('⏳ Building SVG sprite…', 40);
      await this._buildSpriteFromAssets(p, design);

      // 3) Fetch engine files (REQUIRED & OPTIONAL)
      p.update('⏳ Fetching engine files…', 55);
      const engineFiles = await this._fetchEngineFiles(p);

      // 4) Generate standalone HTML
      p.update('🧱 Generating HTML…', 90);
      const html = this._generateStandaloneHTML({ design, engineFiles });

      p.update('✅ Export complete', 100);
      return html;
    }

    /* ----------------------------------------------
     * DESIGN CAPTURE
     * ------------------------------------------- */
    _collectDesign(){
      // Best effort: prefer designer-provided JSON; otherwise read from in-memory structures
      const meta = {
        exportedAt: new Date().toISOString(),
        exporter: 'v3.2.4-hybrid',
        baseUrl: this.options.baseUrl,
      };

      // If the live designer has a method for this, use it.
      if (this.designer?.toJSON) {
        const d = this.designer.toJSON();
        d.metadata = Object.assign({}, d.metadata||{}, meta);
        return d;
      }

      // Fallback: reconstruct a minimal design from visible components
      const components = [];
      const pipes = [];

      if (this.designer?.components) {
        for (const [id, comp] of this.designer.components) {
          components.push({
            id: comp.id || id,
            name: comp.name || comp.label || comp.type || 'Component',
            type: comp.type || comp.key || 'Component',
            x: comp.x|0, y: comp.y|0,
            orientation: comp.orientation || 'R',
            variant: comp.variant || 'std',
            ports: comp.ports || null, // normalized { P_IN:{x:10,y:50}, ... } in 0..100 space if available
          });
        }
      }

      if (this.designer?.pipes) {
        for (const [pid, pipe] of this.designer.pipes) {
          pipes.push({ id: pipe.id || pid, from: pipe.from, to: pipe.to });
        }
      }

      return { metadata: meta, components, pipes };
    }

    /* ----------------------------------------------
     * ENGINE FILES
     * ------------------------------------------- */
    async _fetchEngineFiles(progress){
      const p = mkProgress(progress);
      const base = this._ensureTrailingSlash(this.options.baseUrl);

      const REQUIRED = [
        'js/core/Component.js',
        'js/core/ComponentManager.js',
        'js/core/FlowNetwork.js',
        'js/managers/PipeManager.js',
        'js/managers/PressureManager.js',
        'js/managers/PumpManager.js',
        'js/managers/TankManager.js',
        'js/managers/ValveManager.js',
        // Config optional but nice to have
      ];

      const OPTIONAL = [
        'js/config/systemConfig.js',
        'css/designer.css',
        'css/designer-style.css',
      ];

      const results = { required: [], optional: [] };
      let i = 0;

      for (const rel of REQUIRED){
        const url = base + rel;
        p.setDetail(`REQUIRED ${++i}/${REQUIRED.length}: ${rel}`);
        const ok = await this._ping(url);
        if (!ok) throw new Error(`Missing required engine file: ${url}`);
        results.required.push(url);
      }

      for (const rel of OPTIONAL){
        const url = base + rel;
        const ok = await this._ping(url);
        if (ok) results.optional.push(url);
      }

      return results;
    }

    async _ping(url){
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        return res.ok;
      } catch(_e){
        return false;
      }
    }

    _ensureTrailingSlash(u){
      return /\/$/.test(u) ? u : u + '/';
    }

    /* ----------------------------------------------
     * SPRITE PIPELINE
     * ------------------------------------------- */

    async _buildSpriteFromAssets(progress, design){
      const p = mkProgress(progress);
      this._symbolRegistry = new Map();

      const needed = new Map(); // assetPath -> { symbolId, type }
      const lib = this._getLibrary();

      for (const comp of (design.components||[])) {
        const type = comp.type || comp.key || 'component';
        const template = lib[type] || {};
        const assetPath = this._resolveSvgAssetPath(type, comp, template);
        if (!assetPath) continue;

        const symbolId = this._symbolIdFor(type, comp, template);
        if (!needed.has(assetPath)) needed.set(assetPath, { symbolId, type });
        // Register mapping for instance rendering
        if (!this._symbolRegistry.has(type)) this._symbolRegistry.set(type, symbolId);
      }

      if (needed.size === 0){
        this._spriteString = '';
        return;
      }

      const symbols = [];
      let fetched = 0;

      for (const [assetPath, meta] of needed.entries()){
        const url = this._ensureAbsoluteAssetUrl(assetPath);
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          let svgText = await res.text();

          const viewBox = (svgText.match(/viewBox="([^"]+)"/)||[])[1] || '0 0 100 100';
          const inner = this._extractSvgInner(svgText);
          const prefixed = this._prefixSvgIds(inner, meta.symbolId);
          symbols.push(`<symbol id="${meta.symbolId}" viewBox="${viewBox}">${prefixed}</symbol>`);

          fetched++;
          progress?.setDetail?.(`${fetched}/${needed.size} • ${assetPath}`);
        } catch(e){
          console.warn('⚠️ SVG fetch failed, falling back', { assetPath, url, error: e?.message });
        }
      }

      this._spriteString = symbols.join('\n');
    }

    _getLibrary(){
      return this.designer?.componentLibrary?.components
          || global.componentLibrary?.components
          || global.COMPONENT_LIBRARY?.components
          || {};
    }

    _symbolIdFor(type, comp, template){
      const variant = comp?.variant ? `-${String(comp.variant).replace(/\s+/g,'-')}` : '';
      return `sym-${String(type).replace(/\s+/g,'_')}${variant}`;
    }

    _resolveSvgAssetPath(type, comp, template){
      // 1) Explicit from the library
      if (template?.svgPath) return template.svgPath;
      if (template?.svg?.path) return template.svg.path;

      // 2) Derive by type
      const t = String(type).toLowerCase();
      const root = this._ensureTrailingSlash(this.options.assetsBase);

      if (t.includes('pump'))           return root + 'pumps/centrifugal.svg';
      if (t.includes('valve'))          return root + 'valves/valve.svg';
      if (t.includes('tank'))           return root + 'tanks/tank_vertical.svg';
      if (t.includes('pressure'))       return root + 'sensors/pressure_sensor.svg';
      if (t.includes('feed') || t.includes('source')) return root + 'sources/feed.svg';
      if (t.includes('drain') || t.includes('sink'))  return root + 'sinks/drain.svg';

      return null;
    }

    _ensureAbsoluteAssetUrl(path){
      if (/^https?:\/\//i.test(path)) return path;
      const base = this._ensureTrailingSlash(this.options.baseUrl);
      return base + path.replace(/^\//,'');
    }

    _extractSvgInner(svgText){
      // Keep content inside the outermost <svg>…</svg>
      const open = svgText.indexOf('>');
      const close = svgText.lastIndexOf('</svg>');
      if (open === -1 || close === -1 || close <= open) return svgText;
      return svgText.slice(open + 1, close).trim();
    }

    _prefixSvgIds(content, prefix){
      // id="foo" -> id="prefix-foo"
      content = content.replace(/\bid="([^"]+)"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `id="${prefix}-${id}"`;
      });
      // url(#foo) -> url(#prefix-foo)
      content = content.replace(/url\(#([^)]+)\)/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `url(#${prefix}-${id})`;
      });
      // href="#foo" -> href="#prefix-foo"
      content = content.replace(/href="#([^"]+)"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `href="#${prefix}-${id}"`;
      });
      return content;
    }

    /* ----------------------------------------------
     * HTML GENERATION
     * ------------------------------------------- */

    _generateStandaloneHTML({ design, engineFiles }){
      const title = this.options.title || 'Process Simulator';

      // Compose <defs> with sprite and a default gradient for tanks
      const defs = `
<svg width="0" height="0" style="position:absolute">
  <defs id="component-sprite">
    ${this._spriteString || ''}
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#41d1ff"/>
      <stop offset="100%" stop-color="#0077ff"/>
    </linearGradient>
  </defs>
</svg>`;

      const { components=[], pipes=[] } = design;

      const svgContent = `
  <svg id="canvas" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <!-- Background grid (optional) -->
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0 H0 V20" fill="none" stroke="#e5e7eb" stroke-width="1"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="1200" height="800" fill="url(#grid)" />

    <!-- Pipes -->
    <g id="pipes">${this._generateAllConnectionsSVG(components, pipes)}</g>

    <!-- Components -->
    <g id="components">${components.map(c=>this._generateComponentSVG(c)).join('\n')}</g>
  </svg>`;

      const dataScript = `<script id="design-data" type="application/json">${esc(JSON.stringify(design))}</script>`;

      const boot = this._generateBootScript();

      // Script and CSS tags
      const engineScriptTags = [
        ...engineFiles.required, ...engineFiles.optional,
      ].filter(Boolean).map(src=>`<script src="${src}"></script>`).join('\n');

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    body{margin:0;background:#0b1020;color:#dbe4ff;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;}
    header{padding:10px 14px;background:#111827;border-bottom:1px solid #1f2937;display:flex;justify-content:space-between;align-items:center}
    h1{font-size:16px;margin:0;color:#c7d2fe}
    #container{display:grid;grid-template-rows:auto 1fr;min-height:100vh}
    #stage{position:relative}
    #canvas{display:block;width:100%;height:calc(100vh - 56px)}
    .component .comp-skin{color:var(--comp-color,#4f46e5)}
    .component.Valve .comp-skin{--comp-color:#0ea5e9}
    .component.Pump  .comp-skin{--comp-color:#4f46e5}
    .component.Tank  .comp-skin{--comp-color:#16a34a}
    .component text.label{fill:#9bb0ff}
    .component.Missing rect{fill:#fee;stroke:#c00}
  </style>
  ${defs}
</head>
<body>
  <div id="container">
    <header>
      <h1>${esc(title)}</h1>
      <div id="status">Exported with Exporter v3.2.4-hybrid</div>
    </header>
    <main id="stage">
      ${svgContent}
    </main>
  </div>

  ${dataScript}
  ${engineScriptTags}
  ${boot}
</body>
</html>`;

      return html;
    }

    _generateBootScript(){
      return `<script>(function(){
  try{
    const dataEl = document.getElementById('design-data');
    const design = JSON.parse(dataEl.textContent);
    console.log('🎯 Loaded design:', design.metadata);

    // Managers
    const flowNetwork  = new (window.FlowNetwork||function(){})();
    const compManager  = new (window.ComponentManager||function(){}) (flowNetwork);
    const pipeManager  = new (window.PipeManager||function(){}) (flowNetwork);
    const valveManager = new (window.ValveManager||function(){}) (flowNetwork, compManager);
    const pumpManager  = new (window.PumpManager||function(){})  (flowNetwork, compManager);
    const tankManager  = new (window.TankManager||function(){})  (flowNetwork, compManager);
    const pressureMgr  = new (window.PressureManager||function(){}) (flowNetwork, compManager);

    // Rehydrate
    compManager.loadFromDesign?.(design);
    pipeManager.loadFromDesign?.(design);

    // Initial solve + UI wires
    flowNetwork.solve?.();
    valveManager.initUI?.();
    pumpManager.initUI?.();
    tankManager.initUI?.();

    // Simple tick loop (level dynamics + solve + pressure UI)
    let last = performance.now();
    function tick(now){
      const dt = (now - last)/1000; last = now;
      tankManager.step?.(dt);
      flowNetwork.solve?.();
      pressureMgr.updateUI?.();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Integrity check
    (function check(){
      const defs = document.getElementById('component-sprite');
      const missing = [...document.querySelectorAll('.component.Missing')].length;
      if (!defs || missing) console.warn('⚠️ Export integrity', { hasDefs: !!defs, missing });
      else console.log('✅ Export integrity ok');
    })();
  }catch(e){
    console.error('💥 Boot failed', e);
  }
})();</script>`;
    }

    /* ----------------------------------------------
     * SVG DOM: Components & Pipes
     * ------------------------------------------- */

    _generateComponentSVG(comp){
      const cleanId = this._sanitizeId(comp.id || comp.name || 'component');
      const type = comp.type || comp.key || 'Component';
      const symbolIdFromSprite = this._symbolRegistry?.get(type);

      const orient = String(comp.orientation||'R').toUpperCase();
      const rot = ORIENT[orient] ?? 0;

      const label = esc(comp.name || cleanId);

      // Symbol via sprite
      if (symbolIdFromSprite){
        return `<g id="${cleanId}" class="component ${esc(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <use href="#${symbolIdFromSprite}" class="comp-skin" />
  <text class="label" x="50" y="96" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Library-defined symbol fallback
      const lib = this._getLibrary();
      const template = lib[type] || {};
      const symbol = template.symbol || template.symbolId;
      if (symbol){
        const symId = this._sanitizeId(typeof symbol === 'string' ? symbol : `symbol-${type}`);
        return `<g id="${cleanId}" class="component ${esc(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <use href="#${symId}" class="comp-skin" />
  <text class="label" x="50" y="96" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Image fallback
      if (template.image){
        const sz = template.imageSize || { w: 76, h: 76, x: -38, y: -38 };
        return `<g id="${cleanId}" class="component ${esc(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <image href="${esc(template.image)}" x="${sz.x}" y="${sz.y}" width="${sz.w}" height="${sz.h}" preserveAspectRatio="xMidYMid meet"></image>
  <text class="label" x="0" y="-50" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Diagnostic fallback
      return `<g id="${cleanId}" class="component Missing" transform="translate(${comp.x|0}, ${comp.y|0})">
  <rect x="-20" y="-20" width="40" height="40"></rect>
  <text class="label" x="0" y="-30" text-anchor="middle" font-size="12">${label}</text>
</g>`;
    }

    _generateAllConnectionsSVG(components, pipes){
      if (!pipes || pipes.length === 0) return '';
      const byId = new Map((components||[]).map(c=>[c.id, c]));
      const segs = [];

      for (const pipe of pipes){
        const [fromId, fromPort] = this._splitRef(pipe.from);
        const [toId, toPort]     = this._splitRef(pipe.to);
        const A = byId.get(fromId);
        const B = byId.get(toId);
        if (!A || !B){
          // Skip broken references
          continue;
        }
        const a = this._portWorld(A, fromPort);
        const b = this._portWorld(B, toPort);
        segs.push(`<path d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#93c5fd" stroke-width="3" fill="none"/>`);
      }
      return segs.join('\n');
    }

    _splitRef(ref){
      // ref can be "compId.portId" or just "compId"
      if (!ref) return [null, null];
      const i = String(ref).indexOf('.');
      if (i === -1) return [String(ref), null];
      return [ref.slice(0,i), ref.slice(i+1)];
    }

    _portWorld(comp, portName){
      // If component has normalized ports (0..100), rotate by orientation and translate by (x,y)
      const cx = (comp.x|0), cy = (comp.y|0);
      const rot = ORIENT[String(comp.orientation||'R').toUpperCase()] ?? 0;

      let px = 0, py = 0;
      const pm = comp.ports || {};
      const p = (portName && pm[portName]) || null;
      if (p){
        // Convert 0..100 space centered around 50,50 to -50..+50 local
        const lx = (p.x ?? 50) - 50;
        const ly = (p.y ?? 50) - 50;
        const rad = rot * Math.PI/180;
        const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
        const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
        px = cx + rx;
        py = cy + ry;
      } else {
        // Fallback: center of component
        px = cx; py = cy;
      }
      return { x:px, y:py };
    }

    _sanitizeId(id){
      return String(id).replace(/[^a-zA-Z0-9_\-:.]/g, '_');
    }
  }

  // Attach to global
  global.SimulatorExporter = SimulatorExporter;

})(typeof window !== 'undefined' ? window : globalThis);
