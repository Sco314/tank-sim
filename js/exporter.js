/**
 * exporter.js v3.2.3 — Fixed to match actual GitHub repo structure
 * - Split into REQUIRED and OPTIONAL files
 * - Only fails export if REQUIRED files are missing
 * - Warns about optional files but continues export
 */

const EXPORTER_VERSION = '3.2.3';
const ENGINE_VERSION   = '1.0.0';

// Root GitHub Pages base (no subfolder)
const GITHUB_BASE_URL = 'https://sco314.github.io/tank-sim/';

// Files to fetch
const CSS_FILE        = 'css/designer-style.css';
const VALVE_HTML_FILE = 'valve.html';

// ✅ REQUIRED FILES - These MUST exist or export fails
const ENGINE_FILES_REQUIRED = [
  // Core (verified working)
  'js/core/Component.js',
  'js/core/FlowNetwork.js',
  'js/core/ComponentManager.js',

  // Boundary components (verified working)
  'js/components/sources/Feed.js',
  'js/components/sinks/Drain.js',

  // Pumps (verified working - consolidated into Pump.js)
  'js/components/pumps/Pump.js',

  // Valves (verified working)
  'js/components/valves/Valve.js',

  // Pipes (verified working)
  'js/components/pipes/Pipe.js'
];

// ⚠️ OPTIONAL FILES - Nice to have but won't block export
const ENGINE_FILES_OPTIONAL = [
  // Config (doesn't exist yet)
  'js/config/systemConfig.js',

  // Tanks (if you add it later)
  'js/components/tanks/Tank.js',

  // Specialized pumps (if you split them out from Pump.js)
  'js/components/pumps/FixedSpeedPump.js',
  'js/components/pumps/VariableSpeedPump.js',
  'js/components/pumps/ThreeSpeedPump.js',

  // Sensors (if you add them)
  'js/components/sensors/PressureSensor.js',

  // Managers (if you add them)
  'js/managers/TankManager.js',
  'js/managers/PumpManager.js',
  'js/managers/ValveManager.js',
  'js/managers/PipeManager.js',
  'js/managers/PressureManager.js'
];

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = Date.now();
  }

  // ========= Public API =========
  async exportSimulator(defaultName = 'My Simulator') {
    const simName = (prompt('Enter simulator name:', defaultName) || defaultName).trim();
    if (!simName) {
      alert('Export cancelled — no name provided.');
      return;
    }

    // Validate the current design
    const validation = this._validateDesign();
    if (!validation.valid) {
      const proceed = confirm(`⚠️ Issues found:\n\n${validation.errors.join('\n')}\n\nExport anyway?`);
      if (!proceed) return;
    }

    const progress = this._createProgressUI();

    try {
      // Fetch CSS
      progress.update('⏳ Fetching CSS...', 5);
      const css = await this._fetchCSS();

      // Fetch engine files
      progress.update('⏳ Fetching engine files...', 10);
      const engineCode = await this._fetchAllEngineFiles(progress);

      // Fetch valve.html
      progress.update('⏳ Fetching valve control...', 80);
      const valveHTML = await this._fetchValveHTML();

      // Generate HTML
      progress.update('⏳ Generating HTML...', 90);
      const cleanName = this._sanitizeName(simName);
      const html = this._generateStandaloneHTML(simName, cleanName, css, engineCode, valveHTML);

      // Download
      progress.update('📦 Downloading...', 98);
      this._downloadFile(`${cleanName}.html`, html);

      progress.close();
      const fileSize = (html.length / 1024).toFixed(1);
      console.log(`✅ Export complete: ${cleanName}.html (${fileSize} KB)`);
      alert(`✅ Export complete!\n\nFile: ${cleanName}.html\nSize: ${fileSize} KB\n\n✓ 100% standalone\n✓ Latest engine code from GitHub\n✓ SVG symbols (reused with <use>)`);
    } catch (err) {
      progress.close();
      this._showDetailedError(err);
    }
  }

  // ========= UI helpers =========
  _createProgressUI() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#172144;color:#e9f0ff;padding:30px 50px;border-radius:12px;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,.5);min-width:400px;';
    overlay.innerHTML = `
      <div id="progressText" style="font-size:20px;font-weight:600;margin-bottom:12px;">⏳ Starting export...</div>
      <div style="background:#0e1734;height:8px;border-radius:4px;overflow:hidden;">
        <div id="progressBar" style="background:#7cc8ff;height:100%;width:0%;transition:width .25s;"></div>
      </div>
      <div id="progressDetail" style="font-size:13px;margin-top:8px;color:#9bb0ff;">Initializing...</div>
    `;
    document.body.appendChild(overlay);

    return {
      update: (text, percent) => {
        overlay.querySelector('#progressText').textContent = text;
        overlay.querySelector('#progressBar').style.width = `${percent}%`;
      },
      setDetail: (detail) => overlay.querySelector('#progressDetail').textContent = detail,
      close: () => document.body.removeChild(overlay)
    };
  }

  // ========= Network fetchers =========
  async _fetchCSS() {
    const url = GITHUB_BASE_URL + CSS_FILE;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CSS HTTP ${res.status}: ${res.statusText}`);
      const css = await res.text();
      console.log(`✓ CSS: ${CSS_FILE} (${(css.length / 1024).toFixed(1)} KB)`);
      return css;
    } catch (e) {
      console.warn('⚠ CSS fetch failed, using minimal fallback', e);
      return `
        body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif; }
        #canvas { width: 100%; height: 100%; background: #0e1734; }
      `;
    }
  }

  async _fetchAllEngineFiles(progressUI) {
    const codeBlocks = [];
    const failed = [];
    let done = 0;

    // Combine required and optional files
    const allFiles = ENGINE_FILES_REQUIRED.concat(ENGINE_FILES_OPTIONAL);
    const totalFiles = allFiles.length;

    for (const path of allFiles) {
      const url = GITHUB_BASE_URL + path;
      const isOptional = ENGINE_FILES_OPTIONAL.includes(path);
      
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const code = await res.text();
        codeBlocks.push(`\n/* ============================================================================\n * ${path}\n * Source: ${url}\n * ============================================================================ */\n\n${code}\n`);
        done++;
        const pct = 10 + Math.floor((done / totalFiles) * 65); // 10 → 75
        progressUI.update('⏳ Fetching engine files...', pct);
        progressUI.setDetail(`✓ ${path} (${done}/${totalFiles})`);
        console.log(`✓ ${path}`);
      } catch (e) {
        failed.push({ path, url, error: e.message, optional: isOptional });
        
        if (isOptional) {
          console.warn(`⚠ ${path} (optional - skipped)`, e.message);
        } else {
          console.error(`✗ ${path} (REQUIRED)`, e);
        }
      }
    }

    // Only throw if REQUIRED files failed
    const hardFails = failed.filter(f => !f.optional);
    
    if (hardFails.length) {
      throw new Error(JSON.stringify({
        failedFiles: hardFails,
        totalFiles: ENGINE_FILES_REQUIRED.length,
        successCount: ENGINE_FILES_REQUIRED.length - hardFails.length,
        failCount: hardFails.length
      }));
    }

    // Log optional failures as warnings
    const optionalFails = failed.filter(f => f.optional);
    if (optionalFails.length) {
      console.warn(`⚠ ${optionalFails.length} optional file(s) not found (continuing anyway):`, 
        optionalFails.map(f => f.path));
    }

    const total = codeBlocks.join('\n');
    console.log(`✅ Engine fetched (${(total.length / 1024).toFixed(1)} KB)`);
    console.log(`📊 Stats: ${done} loaded, ${optionalFails.length} optional skipped, ${hardFails.length} required failed`);
    return total;
  }

  async _fetchValveHTML() {
    const url = GITHUB_BASE_URL + VALVE_HTML_FILE;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const html = await res.text();
      return html;
    } catch (e) {
      throw new Error(JSON.stringify({
        failedFiles: [{ path: VALVE_HTML_FILE, url, error: e.message }],
        totalFiles: 1, successCount: 0, failCount: 1
      }));
    }
  }

  // ========= Errors =========
  _showDetailedError(error) {
    let details;
    try {
      details = JSON.parse(error.message);
    } catch {
      alert(`❌ Export failed\n\n${error.message}\n\nCheck console for details.`);
      console.error(error);
      return;
    }

    const lines = (details.failedFiles || []).map(f =>
      `• ${f.path}\n  URL: ${f.url}\n  Error: ${f.error}`
    ).join('\n\n');

    alert(
`❌ Export Failed: Could Not Fetch Required Files from GitHub

Failed Files (${details.failCount}/${details.totalFiles}):

${lines}

Possible Causes:
• No internet connection
• GitHub Pages is down
• Files moved/deleted
• CORS/network firewall blocking requests

What To Do:
1) Check connection
2) Verify Pages: ${GITHUB_BASE_URL}
3) Try again
4) See console for details`
    );

    console.error('📋 Detailed error report', details);
  }

  // ========= HTML generation =========
  _generateStandaloneHTML(simName, cleanName, css, engineCode, valveHTML) {
    const svg = document.getElementById('canvas');
    const viewBox = svg ? (svg.getAttribute('viewBox') || '0 0 1000 600') : '0 0 1000 600';

    // Collect <symbol>s once
    const svgSymbols = this._extractSVGSymbols();

    // Instances and connections
    const componentsSVG  = this._generateAllComponentsSVG();
    const connectionsSVG = this._generateAllConnectionsSVG();

    // Design JSON
    const designJSON = this._generateDesignJSON(simName);

    // Valve iframe srcdoc
    const valveSrcdoc = this._prepareValveForIframe(valveHTML);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${simName}</title>
  <meta name="generator" content="Tank Simulator Exporter v${EXPORTER_VERSION}">
  <meta name="export-date" content="${new Date().toISOString()}">
  <meta name="engine-version" content="${ENGINE_VERSION}">
  <meta name="source" content="${GITHUB_BASE_URL}">
  <style>
${css}

/* Minimal extras */
.flow       { stroke-dasharray: 20 10; }
.flow.on    { animation: flow 2s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -30; } }

#valveFrame {
  display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
  width:400px; height:300px; border:2px solid #7cc8ff; border-radius:8px; background:#fff; z-index:1000;
  box-shadow:0 10px 40px rgba(0,0,0,.3);
}
  </style>
</head>
<body>
  <div id="simulator-container">
    <svg id="canvas" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      <!-- ========== Component Symbols (one-time) ========== -->
      <defs>
        <!-- Liquid gradient for tanks (patch) -->
        <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  style="stop-color:#4fc3f7;stop-opacity:0.9"/>
          <stop offset="100%" style="stop-color:#0288d1;stop-opacity:1"/>
        </linearGradient>

${svgSymbols}
      </defs>

      <!-- Optional grid -->
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 L0 0 0 20" fill="none" stroke="#22305f" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" opacity="0.35"/>

      <!-- ========== Connections ========== -->
      <g id="connectionsLayer">
${connectionsSVG}
      </g>

      <!-- ========== Components ========== -->
      <g id="componentsLayer">
${componentsSVG}
      </g>
    </svg>

    <iframe id="valveFrame" title="Valve Control"></iframe>
  </div>

  <!-- ========== Embedded Design JSON ========== -->
  <script id="design-data" type="application/json">
${designJSON}
  </script>

  <!-- ========== Embedded Engine Code ========== -->
  <script>
/* ============================================================================
 * Tank Simulator Engine v${ENGINE_VERSION}
 * Exported: ${new Date().toISOString()}
 * Source: ${GITHUB_BASE_URL}
 * ============================================================================ */
${engineCode}

/* ============================================================================
 * Boot
 * ============================================================================ */
(function(){
  const dataEl = document.getElementById('design-data');
  const design = JSON.parse(dataEl.textContent);
  console.log('🎯 Loaded design:', design.metadata);

  // Valve iframe
  const valveFrame = document.getElementById('valveFrame');
  valveFrame.srcdoc = ${JSON.stringify(valveSrcdoc)};

  // TODO: Initialize your engine/managers here with 'design'
  console.log('✅ Engine code embedded. Components:', design.components.length, 'Connections:', design.connections.length);
})();
  </script>
</body>
</html>`;
  }

  /**
   * Extract <symbol> defs exactly once.
   */
  _extractSVGSymbols() {
    const out = [];
    const seen = new Set();
    this._exportedSymbolTypes = new Set();

    const lib =
      this.designer?.componentLibrary?.components ||
      window.componentLibrary?.components ||
      window.COMPONENT_LIBRARY?.components ||
      {};

    const canvas = document.getElementById('canvas');
    const domDefs = canvas ? Array.from(canvas.querySelectorAll('symbol')) : [];

    for (const [, comp] of this.designer.components) {
      const type = comp.type || comp.key || 'component';
      const symbolIdOut = `symbol-${type}`;
      if (seen.has(symbolIdOut)) continue;

      const libDef = lib[type];
      if (libDef && typeof libDef.symbol === 'string' && libDef.symbol.trim()) {
        const vb = (libDef.symbolViewBox || '0 0 60 60');
        out.push(`        <symbol id="${symbolIdOut}" viewBox="${vb}">
${libDef.symbol}
        </symbol>`);
        seen.add(symbolIdOut);
        this._exportedSymbolTypes.add(type);
        continue;
      }

      if (libDef && libDef.symbolId) {
        const live = domDefs.find(s => s.id === libDef.symbolId);
        if (live) {
          out.push(`        <symbol id="${symbolIdOut}" viewBox="${live.getAttribute('viewBox') || '0 0 60 60'}">${live.innerHTML}</symbol>`);
          seen.add(symbolIdOut);
          this._exportedSymbolTypes.add(type);
          continue;
        }
      }
    }

    return out.join('\n');
  }

  // ========= Components & connections =========

  _generateAllComponentsSVG() {
    let svg = '';
    for (const [, comp] of this.designer.components) {
      svg += '        ' + this._generateComponentSVG(comp) + '\n';
    }
    return svg;
  }

  _generateComponentSVG(comp) {
    const cleanId = this._sanitizeId(comp.id);
    const type = comp.type || comp.key || 'component';

    const hasSymbol = this._exportedSymbolTypes?.has(type);

    if (type === 'tank') {
      return `<g id="${cleanId}" class="tank" transform="translate(${comp.x}, ${comp.y})">
  <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
  <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)"></rect>
  <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
</g>`;
    }

    if (hasSymbol) {
      return `<g id="${cleanId}" class="${type}" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
  <use href="#symbol-${type}" width="60" height="60"></use>
  <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
</g>`;
    }

    const lib =
      this.designer?.componentLibrary?.components ||
      window.componentLibrary?.components ||
      window.COMPONENT_LIBRARY?.components ||
      {};
    const template = lib[type] || {};
    const image = template.image;
    const imageSize = template.imageSize || { w: 76, h: 76, x: -38, y: -38 };

    if (image) {
      return `<g id="${cleanId}" class="${type}" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
  <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" preserveAspectRatio="xMidYMid meet"></image>
  <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
</g>`;
    }

    return `<g id="${cleanId}" class="${type}" transform="translate(${comp.x}, ${comp.y})">
  <circle r="20" fill="#4f46e520" stroke="#4f46e5" stroke-width="2"></circle>
  <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
</g>`;
  }

  _buildSymbolPortIndex() {
    const index = {};
    const lib =
      this.designer?.componentLibrary?.components ||
      window.componentLibrary?.components ||
      window.COMPONENT_LIBRARY?.components ||
      {};
    const parser = new DOMParser();

    for (const [type, def] of Object.entries(lib)) {
      const sym = def?.symbol;
      if (!sym || typeof sym !== 'string') continue;

      const doc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${sym}</svg>`,
        'image/svg+xml'
      );

      const cps = Array.from(doc.querySelectorAll('.cp'));
      if (!cps.length) continue;

      index[type] = cps.map(el => ({
        name: el.getAttribute('data-port') || el.getAttribute('id') || '',
        role: el.getAttribute('data-type') || '',
        cx: parseFloat(el.getAttribute('cx') || '0'),
        cy: parseFloat(el.getAttribute('cy') || '0'),
        r:  parseFloat(el.getAttribute('r')  || '0'),
      }));
    }

    return index;
  }

  _applyTransform(comp, lx, ly) {
    const rotDeg = (comp.rotation ?? comp.r ?? 0);
    const rot = rotDeg * Math.PI / 180;

    const sx = (comp.scaleX ?? comp.scale ?? 1);
    const sy = (comp.scaleY ?? comp.scale ?? 1);

    let x = lx * sx;
    let y = ly * sy;

    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);

    return { x: (comp.x ?? 0) + xr, y: (comp.y ?? 0) + yr };
  }

  _getPortWorldPos(comp, portName) {
    const type = comp.type || comp.key || 'component';

    const ports = (this._portIndex?.[type] || []);
    let p = null;
    if (ports.length) {
      p = ports.find(pt => pt.name === portName);
      if (!p && portName) {
        const wantOut = /out|discharge|right/i.test(portName);
        const wantIn  = /in|suction|left/i.test(portName);
        if (wantOut) p = ports.find(pt => /out/i.test(pt.role) || /out/i.test(pt.name));
        if (!p && wantIn) p = ports.find(pt => /in/i.test(pt.role)  || /in/i.test(pt.name));
      }
      if (!p) p = ports[0];
      if (p) return this._applyTransform(comp, p.cx, p.cy);
    }

    const lib =
      this.designer?.componentLibrary?.components ||
      window.componentLibrary?.components ||
      window.COMPONENT_LIBRARY?.components ||
      {};
    const offPts = lib[type]?.connectionPoints || [];
    if (offPts.length) {
      const ofp = offPts.find(o => o.name === portName || o.id === portName) || offPts[0];
      if (ofp) return { x: (comp.x ?? 0) + (ofp.x || 0), y: (comp.y ?? 0) + (ofp.y || 0) };
    }

    return { x: comp.x ?? 0, y: comp.y ?? 0 };
  }

  _pickDefaultPortName(type, wantRole) {
    const ports = (this._portIndex?.[type] || []);
    if (!ports.length) return null;
    const byRole = ports.find(p => (wantRole === 'output' ? /out/i : /in/i).test(p.role || p.name || ''));
    return byRole?.name || ports[0].name || null;
  }

  _generateAllConnectionsSVG() {
    if (!this._portIndex) this._portIndex = this._buildSymbolPortIndex();

    let svg = '';

    this.designer.connections.forEach((conn, idx) => {
      const fromComp = this.designer.components.get(conn.from);
      const toComp   = this.designer.components.get(conn.to);
      if (!fromComp || !toComp) return;

      const fromType = fromComp.type || fromComp.key || 'component';
      const toType   = toComp.type   || toComp.key   || 'component';

      const fromName = conn.fromPoint || this._pickDefaultPortName(fromType, 'output') || 'outlet';
      const toName   = conn.toPoint   || this._pickDefaultPortName(toType,   'input')  || 'inlet';

      const P1 = this._getPortWorldPos(fromComp, fromName);
      const P2 = this._getPortWorldPos(toComp,   toName);

      const d = `M ${P1.x} ${P1.y} L ${P2.x} ${P2.y}`;
      const pipeId = `pipe${idx + 1}`;

      svg += `        <g id="${this._sanitizeId(pipeId)}" data-from="${this._sanitizeId(fromComp.id)}" data-to="${this._sanitizeId(toComp.id)}" data-fp="${fromName}" data-tp="${toName}">
  <path d="${d}" fill="none" stroke="#9bb0ff" stroke-width="20" stroke-linecap="round"></path>
  <path id="${this._sanitizeId(pipeId)}Flow" d="${d}" fill="none" stroke="#7cc8ff" stroke-width="8" stroke-linecap="round" class="flow"></path>
</g>\n`;
    });

    return svg;
  }

  _generateDesignJSON(simName) {
    const config = {
      metadata: {
        version: EXPORTER_VERSION,
        created: new Date(this.designer?.metadata?.created || this.exportTimestamp).toISOString(),
        modified: new Date().toISOString(),
        name: simName,
        exported: new Date().toISOString(),
        source: GITHUB_BASE_URL
      },
      components: [],
      connections: [],
      nextId: this.designer.nextId,
      nextConnectionId: this.designer.nextConnectionId,
      gridSize: this.designer.gridSize,
      viewBox: { width: 1000, height: 600 }
    };

    for (const [, comp] of this.designer.components) {
      config.components.push({
        id: comp.id,
        key: comp.key,
        type: comp.type,
        name: comp.name,
        x: comp.x,
        y: comp.y,
        config: comp.config || {}
      });
    }

    for (const conn of this.designer.connections) {
      config.connections.push({
        id: conn.id,
        from: conn.from,
        to: conn.to,
        fromPoint: conn.fromPoint || 'outlet',
        toPoint: conn.toPoint || 'inlet'
      });
    }

    return JSON.stringify(config, null, 2);
  }

  _prepareValveForIframe(valveHTML) {
    const styleMatch = valveHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch  = valveHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    const styles = styleMatch ? styleMatch[1] : '';
    const body   = bodyMatch  ? bodyMatch[1]  : valveHTML;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Valve Control</title><style>${styles}</style></head>
<body>
${body}
</body>
</html>`;
  }

  _validateDesign() {
    const errors = [];

    if (!this.designer || !this.designer.components || this.designer.components.size === 0) {
      errors.push('No components in design');
    }

    if (this.designer?.connections?.length) {
      const connected = new Set();
      for (const c of this.designer.connections) {
        connected.add(c.from); connected.add(c.to);
      }
      const disconnected = [];
      for (const [id, comp] of this.designer.components) {
        if (!connected.has(id)) disconnected.push(comp.name || id);
      }
      if (disconnected.length) {
        errors.push(`Disconnected components: ${disconnected.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  _sanitizeName(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  _sanitizeId(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  _downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export class
window.SimulatorExporter = SimulatorExporter;
console.log('✅ Exporter v3.2.3 loaded');
console.log('🌐 Base URL:', GITHUB_BASE_URL);
console.log('📦 Required files:', ENGINE_FILES_REQUIRED.length);
console.log('⚠️  Optional files:', ENGINE_FILES_OPTIONAL.length);
