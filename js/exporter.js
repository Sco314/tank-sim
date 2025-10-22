/**
 * exporter.js v5.3 - Scale Fix + Style Preservation
 * 
 * CHANGELOG v5.3:
 * - ✅ FIXED: Uses correct imageSize from componentLibrary (Tank 2x, Valve 1/3)
 * - ✅ FIXED: Preserves SVG fill/stroke attributes (grey valve body)
 * - ✅ FIXED: Consistent SVG path resolution with designer
 * - ✅ Improved style scoping to prevent bleed
 * 
 * PREVIOUS (v5.2):
 * - ✅ Removed hardcoded /101125/ legacy path
 * - ✅ Fetches from /js/ directly
 * - ✅ Better error reporting
 */

(function(global) {
  'use strict';

  const EXPORTER_VERSION = '5.3.0';
  const GITHUB_BASE_URL = 'https://sco314.github.io/tank-sim/';

  // SVG assets mapping (matches designer.js EXACTLY)
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

  // Component size mapping (from componentLibrary.js)
  const COMPONENT_SIZES = {
    tank: { w: 320, h: 360, x: -160, y: -180 },  // 2x larger
    valve: { w: 25, h: 25, x: -12.5, y: -12.5 },  // 1/3 smaller
    pump: { w: 120, h: 120, x: -60, y: -60 },
    pumpFixed: { w: 120, h: 120, x: -60, y: -60 },
    pumpVariable: { w: 120, h: 120, x: -60, y: -60 },
    pump3Speed: { w: 120, h: 120, x: -60, y: -60 },
    feed: { w: 40, h: 40, x: -20, y: -20 },
    drain: { w: 40, h: 40, x: -20, y: -20 },
    default: { w: 100, h: 100, x: -50, y: -50 }
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
     * Main export method with progress callback support
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
        const simName = this._getSimulatorName();
        const html = this._generateHTML(design, engineCode, simName);
        
        update('Export complete!');
        return html;
        
      } catch (error) {
        console.error('❌ Export failed:', error);
        throw error;
      }
    }

    /**
     * Get simulator name from designer
     */
    _getSimulatorName() {
      if (typeof this.designer.getSimulatorName === 'function') {
        return this.designer.getSimulatorName();
      }
      if (this.designer.designMetadata?.name) {
        return this.designer.designMetadata.name;
      }
      return 'My Simulator';
    }

    /**
     * Collect design data from designer
     */
    _collectDesign() {
      const components = [];
      const pipes = [];

      // Try getConfiguration() first (preferred API)
      let designData = null;
      if (typeof this.designer.getConfiguration === 'function') {
        try {
          designData = this.designer.getConfiguration();
          console.log('✅ Got design via getConfiguration()');
        } catch (e) {
          console.warn('⚠️ getConfiguration() failed:', e.message);
        }
      }

      // Collect components
      const compSource = designData?.components || this.designer.components;
      if (compSource) {
        const compIterator = compSource instanceof Map 
          ? compSource 
          : Array.isArray(compSource)
            ? compSource.map((c, i) => [c.id || i, c])
            : Object.entries(compSource || {});
          
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
      const connSource = designData?.connections || this.designer.connections;
      if (connSource && Array.isArray(connSource)) {
        for (const conn of connSource) {
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

      if (components.length === 0) {
        throw new Error('No components found in design. Make sure you have added components to the canvas.');
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
      }
    }

    /**
     * Build symbol registry from fetched SVGs
     * FIXED: Preserves fill/stroke attributes for proper styling
     */
    _buildSymbolRegistry() {
      for (const [assetPath, svgText] of this.fetchedSVGs) {
        const symbolId = this._assetPathToSymbolId(assetPath);
        
        // Extract viewBox from SVG
        const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
        
        // Extract inner content (between <svg> and </svg>)
        const inner = this._extractSvgInner(svgText);
        
        // Prefix IDs to avoid collisions
        const prefixed = this._prefixSvgIds(inner, symbolId);
        
        // Scope classes BUT PRESERVE inline styles (fill, stroke, etc.)
        const scoped = this._scopeSvgStylesPreserving(prefixed, symbolId);
        
        this.symbolRegistry.set(assetPath, {
          symbolId,
          viewBox,
          content: scoped,
          type: this._assetPathToType(assetPath)
        });
        
        console.log(`✅ Registered symbol: ${symbolId}`);
      }
    }

    /**
     * Extract SVG inner content
     */
    _extractSvgInner(svgText) {
      const open = svgText.indexOf('>');
      const close = svgText.lastIndexOf('</svg>');
      if (open === -1 || close === -1 || close <= open) return svgText;
      return svgText.slice(open + 1, close).trim();
    }

    /**
     * Prefix SVG IDs to avoid collisions
     */
    _prefixSvgIds(content, prefix) {
      content = content.replace(/\bid="([^"]+)"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `id="${prefix}-${id}"`;
      });
      content = content.replace(/url\(#([^)]+)\)/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `url(#${prefix}-${id})`;
      });
      content = content.replace(/href="#([^"]+)"/g, (m, id) => {
        if (id.startsWith(prefix) || id.startsWith('cp_') || id.startsWith('sym-')) return m;
        return `href="#${prefix}-${id}"`;
      });
      return content;
    }

    /**
     * Scope SVG styles while PRESERVING original inline styles
     * CRITICAL: This prevents the valve body from appearing white
     */
    _scopeSvgStylesPreserving(content, ns) {
      // Scope class names (but don't touch inline styles)
      content = content.replace(/class="([^"]+)"/g, (_, classes) => {
        const mapped = classes.split(/\s+/).map(c =>
          /^cls-\d+$/i.test(c) ? `${ns}-${c}` : c
        ).join(' ');
        return `class="${mapped}"`;
      });

      // Scope CSS selectors in <style> tags
      content = content.replace(
        /<style[^>]*>([\s\S]*?)<\/style>/g,
        (match, css) => {
          // Scope class selectors
          let scopedCss = css.replace(/\.cls-(\d+)/g, `.${ns}-cls-$1`);
          return `<style>${scopedCss}</style>`;
        }
      );

      // IMPORTANT: Do NOT strip inline fill, stroke, or style attributes!
      // These are what make the valve body grey instead of white.
      
      return content;
    }

    /**
     * Extract port coordinates from SVG
     */
    _extractPortCoordinates() {
      for (const [assetPath, data] of this.symbolRegistry) {
        const svgText = this.fetchedSVGs.get(assetPath);
        if (!svgText) continue;

        const viewBox = data.viewBox;
        const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
        const ports = {};

        // Find port markers (circles or elements with data-port, id starting with cp_, etc.)
        const portRegex = /<(circle|rect)[^>]+(data-port="([^"]+)"|id="(cp_[^"]+|P_[^"]+|PORT_[^"]+)")/g;
        let match;
        while ((match = portRegex.exec(svgText))) {
          const tag = match[0];
          const portName = match[3] || match[4];
          
          if (!portName) continue;

          // Extract cx/cy or x/y
          const cxMatch = tag.match(/cx="([^"]+)"/);
          const cyMatch = tag.match(/cy="([^"]+)"/);
          const xMatch = tag.match(/\bx="([^"]+)"/);
          const yMatch = tag.match(/\by="([^"]+)"/);

          let px, py;
          if (cxMatch && cyMatch) {
            px = parseFloat(cxMatch[1]);
            py = parseFloat(cyMatch[1]);
          } else if (xMatch && yMatch) {
            px = parseFloat(xMatch[1]);
            py = parseFloat(yMatch[1]);
          }

          if (px != null && py != null) {
            // Normalize to 0-100 range
            const nx = ((px - vx) / vw) * 100;
            const ny = ((py - vy) / vh) * 100;
            
            const cleanName = portName.replace(/^(cp_|P_|PORT_)/, '').toUpperCase();
            ports[cleanName] = { x: nx, y: ny };
          }
        }

        if (Object.keys(ports).length > 0) {
          this.portIndex.set(data.type, ports);
          console.log(`✅ Extracted ${Object.keys(ports).length} ports from ${data.type}:`, ports);
        }
      }
    }

    /**
     * Fetch engine files from GitHub
     */
    async _fetchEngineFiles(setDetail) {
      const files = [
        'js/core/Component.js',
        'js/core/FlowNetwork.js',
        'js/core/ComponentManager.js',
        'js/managers/PipeManager.js',
        'js/managers/ValveManager.js',
        'js/managers/PumpManager.js',
        'js/managers/TankManager.js',
        'js/managers/PressureManager.js'
      ];

      const code = [];
      for (const file of files) {
        const url = this.options.baseUrl + file;
        setDetail && setDetail(file);
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch ${file}: HTTP ${response.status}`);
            continue;
          }
          
          const text = await response.text();
          code.push(`\n// === ${file} ===\n${text}`);
          console.log(`✅ Fetched ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${file}:`, error.message);
        }
      }

      return code.join('\n');
    }

    /**
     * Generate complete HTML
     */
    _generateHTML(design, engineCode, simName) {
      const title = this._escapeHtml(simName);
      const defs = this._generateSymbolDefs();
      const components = design.components.map(c => this._generateComponentSVG(c)).join('\n');
      const pipes = this._generatePipesSVG(design.components, design.pipes);
      const designJSON = this._generateDesignJSON(design, simName);
      const bootScript = this._generateBootScript();

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%);
      color: #f1f5f9;
      height: 100vh;
      overflow: hidden;
    }
    
    #canvas {
      width: 100%;
      height: 100%;
      background: #0f172a;
    }
    
    .component {
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .component:hover {
      opacity: 0.8;
    }
    
    .label {
      fill: #94a3b8;
      font-size: 12px;
      pointer-events: none;
    }
    
    /* Preserve SVG inline styles */
    .comp-skin {
      /* Let SVG attributes handle fill/stroke */
    }
  </style>
</head>
<body>

<svg id="canvas" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
${defs}
  </defs>
  
  <g id="pipes">
${pipes}
  </g>
  
  <g id="components">
${components}
  </g>
</svg>

<script id="design-data" type="application/json">
${designJSON}
</script>

<script>
${engineCode}
</script>

${bootScript}

</body>
</html>`;
    }

    /**
     * Generate symbol definitions
     */
    _generateSymbolDefs() {
      const defs = [];
      for (const [path, data] of this.symbolRegistry.entries()) {
        defs.push(`    <symbol id="${data.symbolId}" viewBox="${data.viewBox}">
${data.content}
    </symbol>`);
      }
      return defs.join('\n');
    }

    /**
     * Generate SVG for a single component
     * FIXED: Uses correct imageSize from COMPONENT_SIZES
     */
    _generateComponentSVG(comp) {
      const cleanId = this._sanitizeId(comp.id);
      const type = comp.type || 'Component';
      const orient = comp.orientation || 'R';
      const label = this._escapeHtml(comp.name || cleanId);

      // Get correct size for this component type
      const typeKey = type.toLowerCase();
      const size = COMPONENT_SIZES[typeKey] || COMPONENT_SIZES.default;

      // Rotation (only for valve facing down)
      let rot = 0;
      if (/valve/i.test(type) && orient === 'D') rot = 180;

      // Try symbol first
      const symbolData = this._getSymbolForComponent(type, orient);
      if (symbolData) {
        return `<g id="${cleanId}" class="component ${this._escapeHtml(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <use href="#${symbolData.symbolId}" class="comp-skin" width="${size.w}" height="${size.h}" x="${size.x}" y="${size.y}" />
  <text class="label" x="0" y="${size.y + size.h + 20}" text-anchor="middle" font-size="12">${label}</text>
</g>`;
      }

      // Try PNG fallback
      const pngUrl = this._getPNGForComponent(type);
      if (pngUrl) {
        return `<g id="${cleanId}" class="component ${this._escapeHtml(type)}" transform="translate(${comp.x|0}, ${comp.y|0}) rotate(${rot})" tabindex="0" role="button">
  <image href="${pngUrl}" x="${size.x}" y="${size.y}" width="${size.w}" height="${size.h}" />
  <text class="label" x="0" y="${size.y - 10}" text-anchor="middle" font-size="12">${label}</text>
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

        paths.push(`      <path d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#93c5fd" stroke-width="3" fill="none"/>`);
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

      // Get correct size for this component type
      const typeKey = type.toLowerCase();
      const size = COMPONENT_SIZES[typeKey] || COMPONENT_SIZES.default;

      // Rotation (only for valve facing down)
      const rotDeg = (/valve/i.test(type) && orient === 'D') ? 180 : 0;
      const rot = (rotDeg * Math.PI) / 180;

      // Get port coordinates (prefer design, fallback to extracted)
      const ports = comp.ports || this.portIndex.get(type) || {};
      const port = portName && ports[portName];

      if (port) {
        // Convert from 0-100 space to component's local space
        const lx = ((port.x - 50) / 100) * size.w;
        const ly = ((port.y - 50) / 100) * size.h;

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

    console.log('✅ Simulator v${EXPORTER_VERSION} running');
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
  console.log('✅ Component scales: Tank 2x, Valve 1/3');
  console.log('✅ Style preservation: Enabled');

})(typeof window !== 'undefined' ? window : globalThis);
