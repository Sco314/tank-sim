/**
 * exporter.js v5.0 - Complete Implementation
 * 
 * FIXES:
 * 1. ✅ Fetches SVGs from GitHub and builds symbol registry
 * 2. ✅ Extracts port coordinates from SVG markers
 * 3. ✅ Converts designer connections to pipes
 * 4. ✅ Accesses component library properly
 * 5. ✅ Generates working boot script with manager initialization
 */

(function(global) {
  'use strict';

  const EXPORTER_VERSION = '5.0.0';
  const GITHUB_BASE_URL = 'https://sco314.github.io/tank-sim/';

  // SVG assets mapping
  const SVG_ASSETS = {
    Valve: {
      R: 'assets/Valve-Icon-handle-right-01.svg',
      L: 'assets/Valve-Icon-handle-left-01.svg',
      U: 'assets/Valve-Icon-handle-up-01.svg',
      D: 'assets/Valve-Icon-handle-right-01.svg' // Will rotate 180°
    },
    Tank: 'assets/Tankstoragevessel-01.svg',
    Pump: {
      L: 'assets/cent-pump-inlet-left-01.svg',
      R: 'assets/cent-pump-inlet-right-01.svg'
    },
    PumpFixed: {
      L: 'assets/cent-pump-inlet-left-01.svg',
      R: 'assets/cent-pump-inlet-right-01.svg'
    }
  };

  // PNG fallbacks
  const PNG_FALLBACKS = {
    Valve: 'assets/Valve-Icon-Transparent-bg.png',
    Tank: 'assets/Tank-Icon-Transparent-bg.png',
    Pump: 'assets/cent-pump-9-inlet-left.png',
    PumpFixed: 'assets/cent-pump-9-inlet-left.png'
  };

  class SimulatorExporter {
    constructor(designer, options = {}) {
      this.designer = designer;
      this.options = {
        baseUrl: options.baseUrl || GITHUB_BASE_URL,
        fetchTimeout: options.fetchTimeout || 10000
      };

      this.symbolRegistry = new Map();
      this.portIndex = new Map();
      this.fetchedSVGs = new Map();
    }

    /**
     * Main export method
     */
    async exportSimulator(progress = {}) {
      const update = progress.update || (() => {});
      const setDetail = progress.setDetail || (() => {});

      try {
        update('Collecting design data...');
        const design = this._collectDesign();
        
        update('Fetching SVG assets...');
        await this._fetchAllSVGs(design.components, setDetail);
        
        update('Building symbol registry...');
        this._buildSymbolRegistry();
        
        update('Extracting port coordinates...');
        this._extractPortCoordinates();
        
        update('Fetching engine files...');
        const engineCode = await this._fetchEngineFiles(setDetail);
        
        update('Generating HTML...');
        const html = this._generateHTML(design, engineCode);
        
        update('Export complete!');
        return html;
        
      } catch (error) {
        console.error('Export failed:', error);
        throw new Error(`Export failed: ${error.message}`);
      }
    }

    /**
     * Collect design data from designer
     */
    _collectDesign() {
      const components = [];
      const pipes = [];

      // Collect components
      if (this.designer.components) {
        const compIterator = this.designer.components instanceof Map 
          ? this.designer.components 
          : Object.entries(this.designer.components || {});
          
        for (const [id, comp] of compIterator) {
          components.push({
            id: comp.id || id,
            type: comp.type || 'Component',
            name: comp.name || comp.type || 'Component',
            x: comp.x || 0,
            y: comp.y || 0,
            orientation: comp.orientation || this._getDefaultOrientation(comp.type),
            ports: comp.ports || {},
            config: comp.config || {}
          });
        }
      }

      // Convert connections to pipes
      if (this.designer.connections && Array.isArray(this.designer.connections)) {
        for (const conn of this.designer.connections) {
          const fromRef = conn.pipeFrom || 
                         (conn.from && conn.fromPoint ? `${conn.from}.${conn.fromPoint}` : conn.from);
          const toRef = conn.pipeTo || 
                       (conn.to && conn.toPoint ? `${conn.to}.${conn.toPoint}` : conn.to);
          
          if (fromRef && toRef) {
            pipes.push({ 
              id: conn.id || `pipe_${pipes.length}`, 
              from: fromRef, 
              to: toRef 
            });
          }
        }
      }

      console.log(`✅ Collected ${components.length} components, ${pipes.length} pipes`);
      return { components, pipes };
    }

    /**
     * Fetch all SVG assets needed for this design
     */
    async _fetchAllSVGs(components, setDetail) {
      const neededAssets = new Set();
      
      for (const comp of components) {
        const type = comp.type;
        const orient = comp.orientation || 'R';
        const asset = SVG_ASSETS[type];
        
        if (typeof asset === 'string') {
          neededAssets.add(asset);
        } else if (asset && asset[orient]) {
          neededAssets.add(asset[orient]);
        }
      }

      const fetches = [];
      for (const assetPath of neededAssets) {
        fetches.push(this._fetchSVG(assetPath, setDetail));
      }

      await Promise.all(fetches);
      console.log(`✅ Fetched ${this.fetchedSVGs.size} SVG assets`);
    }

    /**
     * Fetch a single SVG asset
     */
    async _fetchSVG(assetPath, setDetail) {
      if (this.fetchedSVGs.has(assetPath)) return;
      
      const url = this.options.baseUrl + assetPath;
      setDetail && setDetail(assetPath);
      
      try {
        const response = await fetch(url, { 
          method: 'GET',
          cache: 'default'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const svgText = await response.text();
        this.fetchedSVGs.set(assetPath, svgText);
        console.log(`✅ Fetched ${assetPath}`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${assetPath}:`, error.message);
        // Don't fail the whole export, just log warning
      }
    }

    /**
     * Build symbol registry from fetched SVGs
     */
    _buildSymbolRegistry() {
      for (const [assetPath, svgText] of this.fetchedSVGs) {
        const symbolId = this._assetPathToSymbolId(assetPath);
        
        // Extract viewBox from SVG
        const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
        
        // Extract content (everything between <svg> tags)
        const contentMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
        const content = contentMatch ? contentMatch[1] : svgText;
        
        this.symbolRegistry.set(assetPath, { symbolId, viewBox, content });
        console.log(`✅ Registered symbol ${symbolId}`);
      }
    }

    /**
     * Extract port coordinates from SVG markers
     */
    _extractPortCoordinates() {
      for (const [assetPath, svgText] of this.fetchedSVGs) {
        const ports = {};
        
        // Look for circles with id="cp_*" or data-port="*"
        const circleMatches = svgText.matchAll(/<circle[^>]*id="cp_([^"]+)"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*\/>/gi);
        
        for (const match of circleMatches) {
          const portName = match[1].toUpperCase();
          const cx = parseFloat(match[2]);
          const cy = parseFloat(match[3]);
          
          // Get viewBox to normalize coordinates
          const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
          const viewBox = viewBoxMatch ? viewBoxMatch[1].split(/\s+/).map(Number) : [0, 0, 100, 100];
          const [vx, vy, vw, vh] = viewBox;
          
          // Normalize to 0-100 space
          ports[portName] = {
            x: ((cx - vx) / vw) * 100,
            y: ((cy - vy) / vh) * 100
          };
        }
        
        if (Object.keys(ports).length > 0) {
          // Determine type from asset path
          const type = this._assetPathToType(assetPath);
          this.portIndex.set(type, ports);
          console.log(`✅ Extracted ports for ${type}:`, ports);
        }
      }
    }

    /**
     * Fetch engine JavaScript files
     */
    async _fetchEngineFiles(setDetail) {
      const engineFiles = [
        'js/core/Component.js',
        'js/core/FlowNetwork.js',
        'js/core/ComponentManager.js',
        'js/managers/TankManager.js',
        'js/managers/PumpManager.js',
        'js/managers/ValveManager.js',
        'js/managers/PipeManager.js',
        'js/managers/PressureManager.js'
      ];

      const code = [];
      for (const file of engineFiles) {
        setDetail && setDetail(file);
        try {
          const url = this.options.baseUrl + file;
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            code.push(`/* ===== ${file} ===== */\n${text}\n`);
            console.log(`✅ Fetched ${file}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${file}:`, error.message);
        }
      }

      return code.join('\n');
    }

    /**
     * Generate complete HTML
     */
    _generateHTML(design, engineCode) {
      const simName = this.designer.getSimulatorName ? 
        this.designer.getSimulatorName() : 
        'Process Simulator';

      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${this._escapeHtml(simName)}</title>
  <style>
    body{margin:0;background:#0b1020;color:#dbe4ff;font-family:ui-sans-serif,system-ui,sans-serif;}
    header{padding:10px 14px;background:#111827;border-bottom:1px solid #1f2937;display:flex;justify-content:space-between;align-items:center}
    h1{font-size:16px;margin:0;color:#c7d2fe}
    #container{display:grid;grid-template-rows:auto 1fr;min-height:100vh}
    #stage{position:relative}
    #canvas{display:block;width:100%;height:calc(100vh - 56px)}
    .component .comp-skin{color:var(--comp-color,#4f46e5)}
    .component.Valve .comp-skin{--comp-color:#0ea5e9}
    .component.Pump .comp-skin{--comp-color:#4f46e5}
    .component.PumpFixed .comp-skin{--comp-color:#4f46e5}
    .component.Tank .comp-skin{--comp-color:#16a34a}
    .component text.label{fill:#9bb0ff}
    .component.Missing rect{fill:#fee;stroke:#c00}
    .component{cursor:pointer}
  </style>
  ${this._generateSymbolDefs()}
</head>
<body>
  <div id="container">
    <header>
      <h1>${this._escapeHtml(simName)}</h1>
      <div id="status">Exported with Exporter v${EXPORTER_VERSION}</div>
    </header>
    <main id="stage">
      ${this._generateSVGCanvas(design)}
    </main>
  </div>

  <script id="design-data" type="application/json">${this._generateDesignJSON(design, simName)}</script>
  <script>${engineCode}</script>
  ${this._generateBootScript()}
</body>
</html>`;
    }

    /**
     * Generate SVG symbol definitions
     */
    _generateSymbolDefs() {
      if (this.symbolRegistry.size === 0) return '';

      const symbols = [];
      for (const [assetPath, data] of this.symbolRegistry) {
        symbols.push(`<symbol id="${data.symbolId}" viewBox="${data.viewBox}">${data.content}</symbol>`);
      }

      return `<svg width="0" height="0" style="position:absolute">
  <defs id="component-sprite">
    ${symbols.join('\n    ')}
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#41d1ff"/>
      <stop offset="100%" stop-color="#0077ff"/>
    </linearGradient>
  </defs>
</svg>`;
    }

    /**
     * Generate SVG canvas with components and connections
     */
    _generateSVGCanvas(design) {
      return `<svg id="canvas" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0 H0 V20" fill="none" stroke="#e5e7eb" stroke-width="1"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="1200" height="800" fill="url(#grid)" />

    <g id="pipes">${this._generatePipesSVG(design.components, design.pipes)}</g>
    <g id="components">${this._generateComponentsSVG(design.components)}</g>
  </svg>`;
    }

    /**
     * Generate SVG for all components
     */
    _generateComponentsSVG(components) {
      return components.map(comp => this._generateComponentSVG(comp)).join('');
    }

    /**
     * Generate SVG for a single component
     */
    _generateComponentSVG(comp) {
      const cleanId = this._sanitizeId(comp.id);
      const type = comp.type || 'Component';
      const orient = comp.orientation || 'R';
      const label = this._escapeHtml(comp.name || cleanId);

      // Rotation (only for valve facing down)
      let rot = 0;
      if (/valve/i.test(type) && orient === 'D') rot = 180;

      // Try symbol first
      const symbolData = this._getSymbolForComponent(type, orient);
      if (symbolData) {
        return `<g id="${cleanId}" class="component ${this._escapeHtml(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <use href="#${symbolData.symbolId}" class="comp-skin" width="100" height="100" x="-50" y="-50" />
  <text class="label" x="0" y="70" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Try PNG fallback
      const pngUrl = this._getPNGForComponent(type);
      if (pngUrl) {
        return `<g id="${cleanId}" class="component ${this._escapeHtml(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <image href="${pngUrl}" x="-38" y="-38" width="76" height="76" />
  <text class="label" x="0" y="-50" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Fallback to diagnostic box
      return `<g id="${cleanId}" class="component Missing" transform="translate(${comp.x|0}, ${comp.y|0})">
  <rect x="-20" y="-20" width="40" height="40" fill="#fee" stroke="#c00" stroke-width="2"/>
  <text class="label" x="0" y="-30" text-anchor="middle" font-size="12">${label}</text>
</g>`;
    }

    /**
     * Generate SVG for all pipes
     */
    _generatePipesSVG(components, pipes) {
      if (!pipes || pipes.length === 0) return '';
      
      const byId = new Map(components.map(c => [c.id, c]));
      const paths = [];

      for (const pipe of pipes) {
        const [fromId, fromPort] = this._splitRef(pipe.from);
        const [toId, toPort] = this._splitRef(pipe.to);
        const compA = byId.get(fromId);
        const compB = byId.get(toId);

        if (!compA || !compB) continue;

        const a = this._getPortWorldCoords(compA, fromPort);
        const b = this._getPortWorldCoords(compB, toPort);

        paths.push(`<path d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#93c5fd" stroke-width="3" fill="none"/>`);
      }

      return paths.join('\n');
    }

    /**
     * Get world coordinates for a component port
     */
    _getPortWorldCoords(comp, portName) {
      const cx = comp.x | 0;
      const cy = comp.y | 0;
      const type = comp.type;
      const orient = comp.orientation || 'R';

      // Rotation (only for valve facing down)
      const rotDeg = (/valve/i.test(type) && orient === 'D') ? 180 : 0;
      const rot = (rotDeg * Math.PI) / 180;

      // Get port coordinates (prefer design, fallback to extracted)
      const ports = comp.ports || this.portIndex.get(type) || {};
      const port = portName && ports[portName];

      if (port) {
        // Convert from 0-100 space to -50 to +50 local space
        const lx = (port.x ?? 50) - 50;
        const ly = (port.y ?? 50) - 50;

        // Apply rotation
        const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
        const ry = lx * Math.sin(rot) + ly * Math.cos(rot);

        return { x: cx + rx, y: cy + ry };
      }

      // Fallback to component center
      return { x: cx, y: cy };
    }

    /**
     * Generate design JSON
     */
    _generateDesignJSON(design, simName) {
      const config = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exporter: `v${EXPORTER_VERSION}`,
          baseUrl: this.options.baseUrl,
          name: simName
        },
        components: design.components.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          x: c.x,
          y: c.y,
          orientation: c.orientation,
          variant: 'std',
          ports: c.ports
        })),
        pipes: design.pipes
      };

      return JSON.stringify(config, null, 2);
    }

    /**
     * Generate boot script that initializes the simulation
     */
    _generateBootScript() {
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

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    _getDefaultOrientation(type) {
      const t = (type || '').toLowerCase();
      if (t === 'tank') return 'U';
      if (t === 'drain') return 'L';
      if (t === 'pump' || t === 'pumpfixed') return 'L';
      return 'R';
    }

    _getSymbolForComponent(type, orient) {
      const asset = SVG_ASSETS[type];
      let assetPath = null;

      if (typeof asset === 'string') {
        assetPath = asset;
      } else if (asset && asset[orient]) {
        assetPath = asset[orient];
      }

      if (assetPath && this.symbolRegistry.has(assetPath)) {
        return this.symbolRegistry.get(assetPath);
      }

      return null;
    }

    _getPNGForComponent(type) {
      const png = PNG_FALLBACKS[type];
      return png ? this.options.baseUrl + png : null;
    }

    _assetPathToSymbolId(assetPath) {
      return 'sym-' + assetPath
        .replace(/^assets\//, '')
        .replace(/\.(svg|png)$/, '')
        .replace(/[^a-zA-Z0-9]/g, '-');
    }

    _assetPathToType(assetPath) {
      if (assetPath.includes('Valve')) return 'Valve';
      if (assetPath.includes('Tank')) return 'Tank';
      if (assetPath.includes('pump')) return 'PumpFixed';
      return 'Component';
    }

    _splitRef(ref) {
      if (!ref) return [null, null];
      const i = String(ref).indexOf('.');
      if (i === -1) return [String(ref), null];
      return [ref.slice(0, i), ref.slice(i + 1)];
    }

    _sanitizeId(id) {
      return String(id).replace(/[^a-zA-Z0-9_\-:.]/g, '_');
    }

    _escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  // Export to global
  global.SimulatorExporter = SimulatorExporter;
  console.log(`✅ Exporter v${EXPORTER_VERSION} loaded`);

})(typeof window !== 'undefined' ? window : globalThis);
