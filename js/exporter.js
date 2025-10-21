/*
 * Tank Sim — Exporter v3.2.4-hybrid (asset+ports edition)
 * -------------------------------------------------------
 * What’s new vs v3.2.3:
 *  - SVG sprite pipeline fetches your GitHub Pages SVGs and embeds them once as <symbol>s.
 *  - Orientation-aware asset selection using your real files in /assets/.
 *  - Port-aware pipes: reads connection-point markers from the SVGs (id="cp_*" or data-port="*")
 *    to align pipe endpoints even when design JSON didn’t carry ports.
 *  - Minimal boot that instantiates managers so valve/pump UI works out of the box.
 *
 * Usage:
 *   const exporter = new SimulatorExporter(designer, {
 *     baseUrl: 'https://sco314.github.io/tank-sim/',
 *   });
 *   const html = await exporter.exportSimulator(progress);
 */

(function(global){
  'use strict';

  const DEFAULT_BASE_URL = (global?.SYSTEM_CONFIG?.BASE_URL) || 'https://sco314.github.io/tank-sim/';

  // Progress helper
  function mkProgress(progress){
    const noop = ()=>{};
    return { update: progress?.update || noop, setDetail: progress?.setDetail || noop };
  }

  // Simple HTML escaper
  const esc = (s)=>String(s).replace(/[&<>]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));

  // Orientation constants (used only for generic rotation fallbacks)
  const ORIENT = { R:0, U:90, L:180, D:270 };

  class SimulatorExporter {
    constructor(designer, opts={}){
      this.designer = designer;
      this.options = Object.assign({
        baseUrl: DEFAULT_BASE_URL,
        title: 'Process Simulator',
      }, opts);

      this._symbolRegistry = new Map(); // type -> symbolId
      this._spriteString = '';
      this._portIndex = new Map();      // type -> { portName: {x,y} } in 0..100 local space
    }

    /** MAIN ENTRY **/
    async exportSimulator(progress){
      const p = mkProgress(progress);

      // 1) Collect design
      p.update('📦 Packaging design…', 20);
      const design = this._collectDesign();

      // 2) Build SVG sprite by fetching used assets
      p.update('⏳ Building SVG sprite…', 40);
      await this._buildSpriteFromAssets(p, design);

      // 3) Fetch engine files (REQUIRED/OPTIONAL)
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
    _collectDesign() {
  const components = [];
  const pipes = [];
  
  // ... existing component collection code ...
  
  // Collect components from designer
  if (this.designer?.components) {
    for (const [id, comp] of this.designer.components) {
      components.push({
        id: comp.id,
        type: comp.type,
        name: comp.name,
        x: comp.x,
        y: comp.y,
        orientation: comp.orientation || 'R',
        ports: comp.ports || {},
        config: comp.config || {}
      });
    }
  }
  
  // 🔧 FIX #2: Convert designer connections to pipes format
  // Check for connections array (designer's format)
  if (this.designer?.connections && Array.isArray(this.designer.connections)) {
    for (const conn of this.designer.connections) {
      // Prefer full "componentId.port" form when present
      const fromRef = conn.pipeFrom || 
                     (conn.from && conn.fromPoint ? `${conn.from}.${conn.fromPoint}` : conn.from);
      const toRef   = conn.pipeTo || 
                     (conn.to && conn.toPoint ? `${conn.to}.${conn.toPoint}` : conn.to);
      
      if (fromRef && toRef) {
        pipes.push({ 
          id: conn.id || `${fromRef}->${toRef}`, 
          from: fromRef, 
          to: toRef 
        });
      }
    }
  }
  
  // Also check for pipes array (legacy format, if present)
  if (this.designer?.pipes && Array.isArray(this.designer.pipes)) {
    for (const pipe of this.designer.pipes) {
      if (pipe.from && pipe.to) {
        pipes.push({
          id: pipe.id || `${pipe.from}->${pipe.to}`,
          from: pipe.from,
          to: pipe.to
        });
      }
    }
  }
  
  return { components, pipes };
}

// ============================================================================
// ALTERNATIVE: If _collectDesign doesn't exist yet, here's a complete version
// ============================================================================

_collectDesign() {
  const components = [];
  const pipes = [];
  
  // Collect components from designer
  if (this.designer?.components) {
    // Handle both Map and Object formats
    const compIterator = this.designer.components instanceof Map 
      ? this.designer.components 
      : Object.entries(this.designer.components || {});
      
    for (const [id, comp] of compIterator) {
      components.push({
        id: comp.id || id,
        type: comp.type || 'Unknown',
        name: comp.name || comp.type || 'Component',
        x: comp.x || 0,
        y: comp.y || 0,
        orientation: comp.orientation || 'R',
        ports: comp.ports || {},
        config: comp.config || {}
      });
    }
  }
  
  // 🔧 Convert designer connections to pipes format
  if (this.designer?.connections && Array.isArray(this.designer.connections)) {
    for (const conn of this.designer.connections) {
      // Build full reference strings
      const fromRef = conn.pipeFrom || 
                     (conn.from && conn.fromPoint ? `${conn.from}.${conn.fromPoint}` : conn.from);
      const toRef   = conn.pipeTo || 
                     (conn.to && conn.toPoint ? `${conn.to}.${conn.toPoint}` : conn.to);
      
      if (fromRef && toRef) {
        pipes.push({ 
          id: conn.id || `conn_${pipes.length}`, 
          from: fromRef, 
          to: toRef 
        });
      }
    }
  }
  
  // Also check for legacy pipes array
  if (this.designer?.pipes && Array.isArray(this.designer.pipes)) {
    for (const pipe of this.designer.pipes) {
      if (pipe.from && pipe.to) {
        pipes.push({
          id: pipe.id || `pipe_${pipes.length}`,
          from: pipe.from,
          to: pipe.to
        });
      }
    }
  }
  
  console.log(`✅ Collected ${components.length} components, ${pipes.length} pipes`);
  
  return { components, pipes };
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
      ];

      const OPTIONAL = [
        'js/config/systemConfig.js',
        'css/designer.css',
        'css/designer-style.css',
      ];

      const results = { required: [], optional: [] };
      let i = 0;

      for (const rel of REQUIRED){
        const url = base + rel; p.setDetail(`REQUIRED ${++i}/${REQUIRED.length}: ${rel}`);
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
      try { const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' }); return res.ok; }
      catch{ return false; }
    }

    _ensureTrailingSlash(u){ return /\/$/.test(u) ? u : u + '/'; }

    /* ----------------------------------------------
     * SPRITE PIPELINE
     * ------------------------------------------- */
    async _buildSpriteFromAssets(progress, design){
      this._symbolRegistry = new Map();
      this._portIndex = new Map();

      const needed = new Map(); // assetPath -> { symbolId, type }
      const lib = this._getLibrary();

      for (const comp of (design.components||[])){
        const type = comp.type || comp.key || 'component';
        const template = lib[type] || {};
        const assetPath = this._resolveSvgAssetPath(type, comp, template);
        if (!assetPath) continue;

        const symbolId = this._symbolIdFor(type, comp, template);
        if (!needed.has(assetPath)) needed.set(assetPath, { symbolId, type });
        if (!this._symbolRegistry.has(type)) this._symbolRegistry.set(type, symbolId);
      }

      if (needed.size === 0){ this._spriteString = ''; return; }

      const symbols = [];
      let fetched = 0;

      for (const [assetPath, meta] of needed.entries()){
        const url = this._ensureAbsoluteAssetUrl(assetPath);
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const svgText = await res.text();

          const viewBox = (svgText.match(/viewBox=\"([^\"]+)\"/)||[])[1] || '0 0 100 100';
          const inner = this._extractSvgInner(svgText);
          const prefixed = this._prefixSvgIds(inner, meta.symbolId);
          symbols.push(`<symbol id="${meta.symbolId}" viewBox="${viewBox}">${prefixed}</symbol>`);

          // Extract ports from original SVG and normalize to 0..100 local
          const ports = this._extractPortsFromSvg(svgText, viewBox);
          if (ports && Object.keys(ports).length){ this._portIndex.set(meta.type, ports); }

          fetched++; progress?.setDetail?.(`${fetched}/${needed.size} • ${assetPath}`);
        } catch(e){ console.warn('⚠️ SVG fetch failed, falling back', { assetPath, url, error: e?.message }); }
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

    // Map component type + orientation to YOUR real GitHub assets
    _resolveSvgAssetPath(type, comp, template){
      if (template?.svgPath) return template.svgPath;
      if (template?.svg?.path) return template.svg.path;

      const t = String(type).toLowerCase();
      const o = String(comp?.orientation || 'R').toUpperCase();
      const base = 'assets/';

      if (t.includes('tank')) return base + 'Tankstoragevessel-01.svg';

      if (t.includes('valve')){
        if (o === 'L') return base + 'Valve-Icon-handle-left-01.svg';
        if (o === 'R') return base + 'Valve-Icon-handle-right-01.svg';
        if (o === 'U') return base + 'Valve-Icon-handle-up-01.svg';
        // Down not provided — reuse UP and rotate instance 180° in render
        return base + 'Valve-Icon-handle-up-01.svg';
      }

      if (t.includes('pump')){
        // Choose art by inlet side; assume orientation L = inlet-left
        if (o === 'L') return base + 'cent-pump-inlet-left-01.svg';
        return base + 'cent-pump-inlet-right-01.svg';
      }

      // Add others when uploaded
      if (t.includes('pressure')) return null;
      if (t.includes('feed') || t.includes('source')) return null;
      if (t.includes('drain') || t.includes('sink'))  return null;

      return null;
    }

    _ensureAbsoluteAssetUrl(path){
      if (/^https?:\/\//i.test(path)) return path;
      const base = this._ensureTrailingSlash(this.options.baseUrl);
      return base + path.replace(/^\//,'');
    }

    _extractSvgInner(svgText){
      const open = svgText.indexOf('>');
      const close = svgText.lastIndexOf('</svg>');
      if (open === -1 || close === -1 || close <= open) return svgText;
      return svgText.slice(open + 1, close).trim();
    }

    _prefixSvgIds(content, prefix){
      // id="foo" -> id="prefix-foo" (skip cp_* and sym- to preserve ports and nested symbols)
      content = content.replace(/\bid=\"([^\"]+)\"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `id="${prefix}-${id}"`;
      });
      // url(#foo) -> url(#prefix-foo)
      content = content.replace(/url\(#([^)]+)\)/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `url(#${prefix}-${id})`;
      });
      // href="#foo" -> href="#prefix-foo"
      content = content.replace(/href=\"#([^\"]+)\"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `href="#${prefix}-${id}"`;
      });
      return content;
    }

    /**
     * Extract ports from SVG markup by looking for data-port or id patterns.
     * Returns { NAME: {x,y} } normalized to 0..100 local space using the viewBox.
     */
    _extractPortsFromSvg(svgText, viewBox){
      try{
        const vb = (viewBox||'0 0 100 100').split(/\s+/).map(Number);
        const [vx, vy, vw, vh] = vb.length===4 ? vb : [0,0,100,100];
        const ports = {};

        const items = [];
        // data-port="NAME"
        const re1 = /(<[^>]+data-port=\"([^\"]+)\"[^>]*>)/g; let m;
        while ((m = re1.exec(svgText))){ items.push(m[1]); }
        // id="cp_NAME" or id="P_IN" etc.
        const re2 = /(<[^>]+id=\"((?:cp_|P_|PORT_)[^\"]+)\"[^>]*>)/g;
        while ((m = re2.exec(svgText))){ items.push(m[1]); }

        for (const tag of items){
          let name = (tag.match(/data-port=\"([^\"]+)\"/)||[])[1]
                  || (tag.match(/id=\"cp_([^\"]+)\"/)||[])[1]
                  || (tag.match(/id=\"P_([^\"]+)\"/)||[])[1]
                  || (tag.match(/id=\"PORT_([^\"]+)\"/)||[])[1];
          if (!name) continue; name = name.trim();

          let cx = tag.match(/\bcx=\"([^\"]+)\"/);
          let cy = tag.match(/\bcy=\"([^\"]+)\"/);
          let x  = tag.match(/\bx=\"([^\"]+)\"/);
          let y  = tag.match(/\by=\"([^\"]+)\"/);
          let px = null, py = null;
          if (cx && cy){ px = parseFloat(cx[1]); py = parseFloat(cy[1]); }
          else if (x && y){ px = parseFloat(x[1]); py = parseFloat(y[1]); }
          if (px==null || py==null) continue;

          const nx = ((px - vx) / vw) * 100;
          const ny = ((py - vy) / vh) * 100;
          ports[name] = { x: nx, y: ny };
        }
        return ports;
      }catch{ return null; }
    }

    /* ----------------------------------------------
     * HTML GENERATION
     * ------------------------------------------- */
    _generateStandaloneHTML({ design, engineFiles }){
      const title = this.options.title || 'Process Simulator';

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
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0 H0 V20" fill="none" stroke="#e5e7eb" stroke-width="1"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="1200" height="800" fill="url(#grid)" />

    <g id="pipes">${this._generateAllConnectionsSVG(components, pipes)}</g>
    <g id="components">${components.map(c=>this._generateComponentSVG(c)).join('\n')}</g>
  </svg>`;

      const dataScript = `<script id="design-data" type="application/json">${esc(JSON.stringify(design))}</script>`;
      const boot = this._generateBootScript();

      const engineScriptTags = [...engineFiles.required, ...engineFiles.optional]
        .filter(Boolean).map(src=>`<script src="${src}"></script>`).join('\n');

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

    const flowNetwork  = new (window.FlowNetwork||function(){})();
    const compManager  = new (window.ComponentManager||function(){}) (flowNetwork);
    const pipeManager  = new (window.PipeManager||function(){}) (flowNetwork);
    const valveManager = new (window.ValveManager||function(){}) (flowNetwork, compManager);
    const pumpManager  = new (window.PumpManager||function(){})  (flowNetwork, compManager);
    const tankManager  = new (window.TankManager||function(){})  (flowNetwork, compManager);
    const pressureMgr  = new (window.PressureManager||function(){}) (flowNetwork, compManager);

    compManager.loadFromDesign?.(design);
    pipeManager.loadFromDesign?.(design);

    flowNetwork.solve?.();
    valveManager.initUI?.();
    pumpManager.initUI?.();
    tankManager.initUI?.();

    let last = performance.now();
    function tick(now){
      const dt = (now - last)/1000; last = now;
      tankManager.step?.(dt);
      flowNetwork.solve?.();
      pressureMgr.updateUI?.();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    (function check(){
      const defs = document.getElementById('component-sprite');
      const missing = [...document.querySelectorAll('.component.Missing')].length;
      if (!defs || missing) console.warn('⚠️ Export integrity', { hasDefs: !!defs, missing });
      else console.log('✅ Export integrity ok');
    })();
  }catch(e){ console.error('💥 Boot failed', e); }
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
      let rot = 0; // we choose orientation-specific art; only rotate for Valve Down
      if (/valve/i.test(type) && orient === 'D') rot = 180;

      const label = esc(comp.name || cleanId);

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
        if (!A || !B) continue;
        const a = this._portWorld(A, fromPort);
        const b = this._portWorld(B, toPort);
        segs.push(`<path d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#93c5fd" stroke-width="3" fill="none"/>`);
      }
      return segs.join('\n');
    }

    _splitRef(ref){
      if (!ref) return [null, null];
      const i = String(ref).indexOf('.');
      if (i === -1) return [String(ref), null];
      return [ref.slice(0,i), ref.slice(i+1)];
    }

    _portWorld(comp, portName){
      const cx = (comp.x|0), cy = (comp.y|0);
      const type = comp.type || comp.key || 'Component';
      const orient = String(comp.orientation||'R').toUpperCase();
      const rotDeg = (/valve/i.test(type) && orient==='D') ? 180 : 0; // only special-case we rotate
      const rot = rotDeg * Math.PI/180;

      // Prefer ports from design; else use parsed ports from SVG assets
      const pm = comp.ports || this._portIndex?.get(type) || {};
      const p = (portName && pm[portName]) || null;
      if (p){
        const lx = (p.x ?? 50) - 50; // local -50..+50
        const ly = (p.y ?? 50) - 50;
        const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
        const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
        return { x: cx + rx, y: cy + ry };
      }
      return { x: cx, y: cy };
    }

    _sanitizeId(id){ return String(id).replace(/[^a-zA-Z0-9_\-:.]/g, '_'); }
  }

  // Attach to global
  global.SimulatorExporter = SimulatorExporter;

})(typeof window !== 'undefined' ? window : globalThis);
