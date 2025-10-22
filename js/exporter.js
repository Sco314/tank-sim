/**
 * exporter.js V3.4 - Tank Simulator Exporter with SVG fixes & Port Aliases
 * - Fixed: SVG style bleed via class scoping
 * - Fixed: Port extraction from SVG markers
 * - Fixed: Coordinate normalization for any viewBox
 * - Fixed: Rotation only for Valve Down case
 * - NEW: Port-name alias normalization (in/inlet/suction → P_IN, out/outlet/discharge → P_OUT)
 */

class SimulatorExporter {
  constructor(designer, options = {}) {
    this.designer = designer;
    this.baseUrl = options.baseUrl || 'https://sco314.github.io/tank-sim/';
    this._symbolRegistry = new Map();
    this._portIndex = new Map(); // NEW: stores parsed ports per component type
    this._spriteString = '';
  }

  /**
   * Main export function with progress tracking
   */
  async exportSimulator(progress) {
    const p = this._mkProgress(progress);
    
    try {
      p.update('⏳ Preparing export...');
      
      // Get design data
      const design = this.designer.getDesignData();
      if (!design.components || design.components.length === 0) {
        throw new Error('No components to export');
      }

      p.update('⏳ Building SVG sprite...');
      await this._buildSpriteFromAssets(progress, design);

      p.update('⏳ Generating HTML...');
      const html = this._generateHTML(design);

      p.update('✅ Export complete');
      return html;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  /**
   * NEW: Namespace per-file classnames to prevent style bleed
   * Example: .cls-1 -> .sym-<symbolId>-cls-1 (in class="" and in <style> rules)
   */
  _scopeSvgClasses(content, ns) {
    // 1) class="a b cls-1" -> class="a b ns-cls-1"
    content = content.replace(/class="([^"]+)"/g, (_, classes) => {
      const mapped = classes.split(/\s+/).map(c =>
        /^cls-\d+$/i.test(c) ? `${ns}-${c}` : c
      ).join(' ');
      return `class="${mapped}"`;
    });

    // 2) In <style> blocks, ".cls-1, .cls-2" -> ".ns-cls-1, .ns-cls-2"
    content = content.replace(
      /<style[^>]*>([\s\S]*?)<\/style>/g,
      (_, css) => `<style>${css.replace(/\.cls-(\d+)/g, `.${ns}-cls-$1`)}</style>`
    );

    return content;
  }

  /**
   * NEW: Extract ports from SVG markup by looking for data-port="NAME"
   * or id="cp_NAME"/"P_NAME"/"PORT_NAME" or id="cp1"/"cp2" (numeric).
   * Returns { NAME: {x,y} } normalized to 0..100 local space using the viewBox.
   */
  _extractPortsFromSvg(svgText, viewBox) {
    try {
      const vb = (viewBox || '0 0 100 100').split(/\s+/).map(Number);
      const [vx, vy, vw, vh] = vb.length === 4 ? vb : [0, 0, 100, 100];
      const ports = {};
      const items = [];
      const numericPorts = []; // for cp1, cp2 auto-mapping

      // Collect candidate elements
      const re1 = /(<[^>]+data-port="([^"]+)"[^>]*>)/g; // data-port
      let m;
      while ((m = re1.exec(svgText))) { items.push(m[1]); }

      const re2 = /(<[^>]+id="((?:cp_|P_|PORT_)[^"]+)"[^>]*>)/g; // cp_*, P_*, PORT_*
      while ((m = re2.exec(svgText))) { items.push(m[1]); }

      const re3 = /(<[^>]+id="cp(\d+)"[^>]*>)/g; // cp1, cp2, ... (numeric)
      while ((m = re3.exec(svgText))) { items.push(m[1]); }

      for (const tag of items) {
        let name = (tag.match(/data-port="([^"]+)"/)||[])[1]
                 || (tag.match(/id="cp_([^"]+)"/)||[])[1]
                 || (tag.match(/id="P_([^"]+)"/)||[])[1]
                 || (tag.match(/id="PORT_([^"]+)"/)||[])[1]
                 || (tag.match(/id="cp(\d+)"/)||[])[1]; // numeric

        if (!name) continue;

        // Parse coordinates (cx/cy for circles, x/y for rects)
        let cx = tag.match(/\bcx="([^"]+)"/);
        let cy = tag.match(/\bcy="([^"]+)"/);
        let x = tag.match(/\bx="([^"]+)"/);
        let y = tag.match(/\by="([^"]+)"/);
        let px = null, py = null;

        if (cx && cy) { px = parseFloat(cx[1]); py = parseFloat(cy[1]); }
        else if (x && y) { px = parseFloat(x[1]); py = parseFloat(y[1]); }

        if (px == null || py == null) continue;

        // Normalize to 0..100
        const nx = ((px - vx) / vw) * 100;
        const ny = ((py - vy) / vh) * 100;

        // Check if numeric (cp1, cp2)
        if (/^\d+$/.test(name)) {
          numericPorts.push({ num: name, x: nx, y: ny, rawX: px });
        } else {
          ports[name.trim().toUpperCase()] = { x: nx, y: ny };
        }
      }

      // Auto-map numeric ports: left -> P_IN, right -> P_OUT
      if (numericPorts.length === 2) {
        numericPorts.sort((a, b) => a.rawX - b.rawX);
        ports.P_IN = { x: numericPorts[0].x, y: numericPorts[0].y };
        ports.P_OUT = { x: numericPorts[1].x, y: numericPorts[1].y };
      } else if (numericPorts.length > 0) {
        // Keep as CP1, CP2, etc.
        numericPorts.forEach(n => {
          ports[`CP${n.num}`] = { x: n.x, y: n.y };
        });
      }

      return ports;
    } catch (e) {
      console.warn('Port extraction failed:', e);
      return {};
    }
  }

  /**
   * Build SVG sprite from assets with class scoping and port extraction
   */
  async _buildSpriteFromAssets(progress, design) {
    const p = this._mkProgress(progress);
    this._symbolRegistry = new Map();
    this._portIndex = new Map(); // NEW: cache ports per type

    const needed = new Map();
    const lib = this._getLibrary();

    for (const comp of (design.components || [])) {
      const type = comp.type || comp.key || 'component';
      const template = lib[type] || {};
      const assetPath = this._resolveSvgAssetPath(type, comp, template);
      if (!assetPath) continue;

      const symbolId = this._symbolIdFor(type, comp, template);
      if (!needed.has(assetPath)) needed.set(assetPath, { symbolId, type });
      if (!this._symbolRegistry.has(type)) this._symbolRegistry.set(type, symbolId);
    }

    if (needed.size === 0) {
      this._spriteString = '';
      return;
    }

    const symbols = [];
    let fetched = 0;

    for (const [assetPath, meta] of needed.entries()) {
      const url = this._ensureAbsoluteAssetUrl(assetPath);
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const svgText = await res.text();
        const viewBox = (svgText.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
        const inner = this._extractSvgInner(svgText);
        const prefixed = this._prefixSvgIds(inner, meta.symbolId);
        
        // NEW: stop style bleed by namespacing classes per symbol
        const scoped = this._scopeSvgClasses(prefixed, meta.symbolId);

        // Build <symbol>
        symbols.push(`<symbol id="${meta.symbolId}" viewBox="${viewBox}">${scoped}</symbol>`);

        // NEW: read ports from ORIGINAL svg and cache for this type
        const ports = this._extractPortsFromSvg(svgText, viewBox);
        if (ports && Object.keys(ports).length) {
          this._portIndex.set(meta.type, ports);
        }

        fetched++;
        progress?.setDetail?.(`${fetched}/${needed.size} • ${assetPath}`);
      } catch (e) {
        console.warn('⚠️ SVG fetch failed, falling back', { assetPath, url, error: e?.message });
      }
    }

    this._spriteString = symbols.join('\n');

    // Optional QA check
    if (/\.(?:cls-\d+)/.test(this._spriteString)) {
      console.warn('🔎 Unscoped classes may remain in sprite; check _scopeSvgClasses.');
    }
  }

  /**
   * Resolve SVG asset path based on type and orientation
   */
  _resolveSvgAssetPath(type, comp, template) {
    // Library override still wins
    if (template?.svgPath) return template.svgPath;
    if (template?.svg?.path) return template.svg.path;

    const t = String(type).toLowerCase();
    const o = String(comp?.orientation || 'R').toUpperCase();
    const base = 'assets/';

    if (t.includes('tank')) return base + 'Tankstoragevessel-01.svg';

    if (t.includes('valve')) {
      if (o === 'L') return base + 'Valve-Icon-handle-left-01.svg';
      if (o === 'R') return base + 'Valve-Icon-handle-right-01.svg';
      if (o === 'U') return base + 'Valve-Icon-handle-up-01.svg';
      // "Down" art not provided — reuse UP and rotate instance 180°
      return base + 'Valve-Icon-handle-up-01.svg';
    }

    if (t.includes('pump')) {
      // Choose art by inlet side; assume orientation L = inlet-left, others inlet-right
      if (o === 'L') return base + 'cent-pump-inlet-left-01.svg';
      return base + 'cent-pump-inlet-right-01.svg';
    }

    // Add others when you upload them
    return null;
  }

  /**
   * Generate component SVG with proper centering and minimal rotation
   */
  _generateComponentSVG(comp, lib) {
    const type = comp.type || comp.key || 'Component';
    const orient = String(comp.orientation || 'R').toUpperCase();
    
    // We pick orientation-specific art; only rotate when reusing UP art for Valve Down
    let rot = 0;
    if (/valve/i.test(type) && orient === 'D') rot = 180;

    const symbolId = this._symbolRegistry.get(type);
    if (symbolId) {
      // Center the symbol: translate(-50,-50) makes (50,50) in symbol space land at (x,y)
      return `
        <g id="${comp.id}" class="component ${type}" data-type="${type}">
          <use href="#${symbolId}" 
               transform="translate(${comp.x | 0}, ${comp.y | 0}) rotate(${rot}) translate(-50,-50)" 
               class="comp-skin"/>
        </g>`;
    }

    // Fallback to library image
    const template = lib[type] || {};
    const img = template.image || template.svg?.path;
    if (img) {
      const w = template.imageSize?.w || 60;
      const h = template.imageSize?.h || 60;
      return `
        <g id="${comp.id}" class="component ${type}" data-type="${type}">
          <image href="${this._ensureAbsoluteAssetUrl(img)}"
                 x="${(comp.x | 0) - w / 2}" y="${(comp.y | 0) - h / 2}"
                 width="${w}" height="${h}"
                 transform="rotate(${rot}, ${comp.x | 0}, ${comp.y | 0})"/>
        </g>`;
    }

    // Ultimate fallback
    return `
      <g id="${comp.id}" class="component ${type}" data-type="${type}">
        <rect x="${(comp.x | 0) - 30}" y="${(comp.y | 0) - 30}" 
              width="60" height="60" 
              fill="#ddd" stroke="#333" stroke-width="2"/>
        <text x="${comp.x | 0}" y="${comp.y | 0}" 
              text-anchor="middle" dominant-baseline="middle" 
              font-size="10">${type}</text>
      </g>`;
  }

  /**
   * Compute port world coordinates with proper centering and rotation
   */
  _portWorld(comp, portName) {
    const cx = (comp.x | 0), cy = (comp.y | 0);
    const type = comp.type || comp.key || 'Component';
    const orient = String(comp.orientation || 'R').toUpperCase();

    // Only rotate if we faked "Down" by reusing the UP valve art
    const rotDeg = (/valve/i.test(type) && orient === 'D') ? 180 : 0;
    const rot = rotDeg * Math.PI / 180;

    // Prefer ports from design; else use parsed ports from SVG assets
    const pm = comp.ports || this._portIndex?.get(type) || {};
    const key = this._normalizePortName(portName);
    const p = (key && pm[key]) || null;

    if (p) {
      const lx = (p.x ?? 50) - 50; // local -50..+50
      const ly = (p.y ?? 50) - 50;
      const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
      const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
      return { x: cx + rx, y: cy + ry };
    }

    return { x: cx, y: cy };
  }

  /**
   * Extract SVG inner content (between <svg> tags)
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
   * Generate symbol ID for a component
   */
  _symbolIdFor(type, comp, template) {
    const orient = comp?.orientation || 'R';
    return `sym-${String(type).replace(/\s+/g, '_')}-${orient}`.toLowerCase();
  }

  /**
   * Map common port name aliases to canonical names
   */
  _normalizePortName(name) {
    if (!name) return name;
    const n = String(name).toLowerCase();
    if (['in', 'inlet', 'suction', 'p_in', 'pin'].includes(n)) return 'P_IN';
    if (['out', 'outlet', 'discharge', 'p_out', 'pout'].includes(n)) return 'P_OUT';
    return name.toUpperCase(); // keep other names uppercase
  }

  /**
   * Ensure absolute URL for assets
   */
  _ensureAbsoluteAssetUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return (this.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
  }

  /**
   * Get component library
   */
  _getLibrary() {
    return window.COMPONENT_LIBRARY || {};
  }

  /**
   * Progress helper
   */
  _mkProgress(progress) {
    return {
      update: (msg) => {
        if (progress?.update) progress.update(msg);
        console.log('📊', msg);
      },
      setDetail: (msg) => {
        if (progress?.setDetail) progress.setDetail(msg);
        console.log('  └─', msg);
      }
    };
  }

  /**
   * Generate complete HTML output
   */
  _generateHTML(design) {
    const lib = this._getLibrary();
    const simName = design.name || 'Tank Simulator';

    // Generate component SVGs
    const componentsSvg = (design.components || [])
      .map(c => this._generateComponentSVG(c, lib))
      .join('\n');

    // Generate connection lines
    const connectionsSvg = (design.connections || [])
      .map(conn => {
        const fromComp = design.components.find(c => c.id === conn.from.split('.')[0]);
        const toComp = design.components.find(c => c.id === conn.to.split('.')[0]);
        if (!fromComp || !toComp) return '';

        const fromPort = conn.from.split('.')[1];
        const toPort = conn.to.split('.')[1];
        const p1 = this._portWorld(fromComp, fromPort);
        const p2 = this._portWorld(toComp, toPort);

        return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" 
                      class="pipe" stroke="#2563eb" stroke-width="3"/>`;
      })
      .join('\n');

    // Complete HTML template
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${simName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .simulator-container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
    }
    .header h1 { font-size: 28px; font-weight: 600; }
    .canvas-area {
      background: #f8fafc;
      padding: 20px;
    }
    svg.sim-canvas {
      width: 100%;
      height: 600px;
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
    }
    .comp-skin { transition: opacity 0.2s; }
    .comp-skin:hover { opacity: 0.8; }
    .pipe { stroke-linecap: round; }
  </style>
</head>
<body>
  <div class="simulator-container">
    <div class="header">
      <h1>${simName}</h1>
      <p>Tank Simulation System</p>
    </div>
    
    <div class="canvas-area">
      <svg class="sim-canvas" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          ${this._spriteString}
        </defs>
        
        <g id="connections-layer">
          ${connectionsSvg}
        </g>
        
        <g id="components-layer">
          ${componentsSvg}
        </g>
      </svg>
    </div>
  </div>

  <script>
    // Simulator engine would go here
    console.log('✅ Simulator loaded:', ${JSON.stringify({ name: simName, components: design.components?.length, connections: design.connections?.length })});
  </script>
</body>
</html>`;
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.SimulatorExporter = SimulatorExporter;
}
