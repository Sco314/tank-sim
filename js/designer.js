/**
 * designer.js V3.1 - Process Simulator Designer
 * FIXES:
 * - ✅ Improved style preservation (fixes grey valve body appearing white)
 * - ✅ Better SVG class scoping to prevent style bleed
 * - ✅ Consistent SVG path resolution with exporter
 * - ✅ Uses sprite system with <use> instances
 * - ✅ Parses and stores ports from SVGs
 * - ✅ Centers components properly for port alignment
 */

class ProcessDesigner {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Canvas element #${canvasId} not found`);

    this.baseUrl = options.baseUrl || 'https://sco314.github.io/tank-sim/';
    this.components = new Map();
    this.connections = new Map();
    this.selectedComponent = null;
    this.selectedTool = 'select'; // 'select' or 'connect'
    this.dragState = null;
    this.connectionState = null;
    
    this._symbolRegistry = new Map();
    this._portCache = new Map(); // Cache parsed ports per component type

    this._init();
  }

  async _init() {
    this._setupLayers();
    this._setupEventListeners();
    await this._buildSprite();
    this._populateComponentPalette();
    console.log('✅ Designer initialized');
  }

  _setupLayers() {
    this.connectionsLayer = this.canvas.querySelector('#connectionsLayer');
    this.componentsLayer = this.canvas.querySelector('#componentsLayer');
    if (!this.connectionsLayer || !this.componentsLayer) {
      console.error('Required SVG layers not found');
    }
  }

  /**
   * Build sprite from component library
   */
  async _buildSprite() {
    const lib = window.COMPONENT_LIBRARY || {};
    const defsEl = document.getElementById('component-sprite');
    if (!defsEl) {
      console.warn('No component-sprite defs element found');
      return;
    }

    const needed = new Map();
    const symbols = [];

    // Collect all component types from library
    for (const [key, def] of Object.entries(lib)) {
      const type = def.type || key;
      const assetPath = this._resolveSvgAssetPath(type, { orientation: 'R' }, def);
      if (!assetPath) continue;

      const symbolId = `sym-${type.replace(/\s+/g, '_')}`;
      if (!needed.has(assetPath)) {
        needed.set(assetPath, { symbolId, type, def });
      }
    }

    // Fetch and process each SVG
    for (const [assetPath, meta] of needed.entries()) {
      const url = this._ensureAbsoluteUrl(assetPath);
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;

        const svgText = await res.text();
        const viewBox = (svgText.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
        const inner = this._extractSvgInner(svgText);
        
        // IMPORTANT: Preserve original styles, then scope IDs and classes
        const prefixed = this._prefixSvgIds(inner, meta.symbolId);
        const scoped = this._scopeSvgStylesPreserving(prefixed, meta.symbolId);

        symbols.push(`<symbol id="${meta.symbolId}" viewBox="${viewBox}">${scoped}</symbol>`);

        // Parse and cache ports
        const ports = this._extractPortsFromSvg(svgText, viewBox);
        if (Object.keys(ports).length > 0) {
          this._portCache.set(meta.type, ports);
          console.log(`✅ Cached ${Object.keys(ports).length} ports for ${meta.type}:`, ports);
        }

        this._symbolRegistry.set(meta.type, meta.symbolId);
      } catch (e) {
        console.warn(`Failed to load SVG: ${assetPath}`, e);
      }
    }

    defsEl.innerHTML = symbols.join('\n');
    console.log(`✅ Built sprite with ${symbols.length} symbols`);
  }

  /**
   * Resolve SVG asset path (matches exporter logic EXACTLY)
   */
  _resolveSvgAssetPath(type, comp, template) {
    // Priority 1: explicit svgPath (most specific)
    if (template?.svgPath) return template.svgPath;
    
    // Priority 2: svg.path (legacy support)
    if (template?.svg?.path) return template.svg.path;
    
    // Priority 3: svg as string (legacy support)
    if (typeof template?.svg === 'string') {
      // Check if it's already a full path
      if (template.svg.startsWith('assets/')) return template.svg;
      // Otherwise prepend assets/
      return 'assets/' + template.svg;
    }

    // Priority 4: Auto-detect based on type and orientation
    const t = String(type).toLowerCase();
    const o = String(comp?.orientation || 'R').toUpperCase();
    const base = 'assets/';

    if (t.includes('tank')) return base + 'Tankstoragevessel-01.svg';

    if (t.includes('valve')) {
      if (o === 'L') return base + 'Valve-Icon-handle-left-01.svg';
      if (o === 'R') return base + 'Valve-Icon-handle-right-01.svg';
      if (o === 'U') return base + 'Valve-Icon-handle-up-01.svg';
      return base + 'Valve-Icon-handle-up-01.svg'; // Down = reuse up + rotate
    }

    if (t.includes('pump')) {
      if (o === 'L') return base + 'cent-pump-inlet-left-01.svg';
      return base + 'cent-pump-inlet-right-01.svg';
    }

    return null;
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
   * Scope SVG styles while PRESERVING original inline styles and attributes
   * FIXED: This now preserves fill, stroke, and other style attributes
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

    // IMPORTANT: Do NOT strip inline fill, stroke, or style attributes
    // The original code preserved these, and that's correct!
    
    return content;
  }

  /**
   * Extract ports from SVG
   */
  _extractPortsFromSvg(svgText, viewBox) {
    try {
      const vb = (viewBox || '0 0 100 100').split(/\s+/).map(Number);
      const [vx, vy, vw, vh] = vb.length === 4 ? vb : [0, 0, 100, 100];
      const ports = {};
      const items = [];
      const numericPorts = [];

      const re1 = /(<[^>]+data-port="([^"]+)"[^>]*>)/g;
      let m;
      while ((m = re1.exec(svgText))) { items.push(m[1]); }

      const re2 = /(<[^>]+id="((?:cp_|P_|PORT_)[^"]+)"[^>]*>)/g;
      while ((m = re2.exec(svgText))) { items.push(m[1]); }

      const re3 = /(<[^>]+id="cp(\d+)"[^>]*>)/g;
      while ((m = re3.exec(svgText))) { items.push(m[1]); }

      for (const tag of items) {
        let name = (tag.match(/data-port="([^"]+)"/) || [])[1]
                 || (tag.match(/id="cp_([^"]+)"/) || [])[1]
                 || (tag.match(/id="P_([^"]+)"/) || [])[1]
                 || (tag.match(/id="PORT_([^"]+)"/) || [])[1]
                 || (tag.match(/id="cp(\d+)"/) || [])[1];

        if (!name) continue;

        let cx = tag.match(/\bcx="([^"]+)"/);
        let cy = tag.match(/\bcy="([^"]+)"/);
        let x = tag.match(/\bx="([^"]+)"/);
        let y = tag.match(/\by="([^"]+)"/);
        let px = null, py = null;

        if (cx && cy) { px = parseFloat(cx[1]); py = parseFloat(cy[1]); }
        else if (x && y) { px = parseFloat(x[1]); py = parseFloat(y[1]); }

        if (px == null || py == null) continue;

        const nx = ((px - vx) / vw) * 100;
        const ny = ((py - vy) / vh) * 100;

        if (/^\d+$/.test(name)) {
          numericPorts.push({ num: name, x: nx, y: ny, rawX: px });
        } else {
          ports[name.trim().toUpperCase()] = { x: nx, y: ny };
        }
      }

      if (numericPorts.length === 2) {
        numericPorts.sort((a, b) => a.rawX - b.rawX);
        ports.P_IN = { x: numericPorts[0].x, y: numericPorts[0].y };
        ports.P_OUT = { x: numericPorts[1].x, y: numericPorts[1].y };
      } else if (numericPorts.length > 0) {
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
   * Ensure absolute URL
   */
  _ensureAbsoluteUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return (this.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
  }

  /**
   * Populate component palette
   */
  _populateComponentPalette() {
    const palette = document.getElementById('componentPalette');
    if (!palette) return;

    const lib = window.COMPONENT_LIBRARY || {};
    const categories = window.CATEGORIES || {};

    let html = '';
    for (const [catName, catData] of Object.entries(categories)) {
      html += `<div class="component-category">
        <div class="category-header">
          <span class="category-icon">${catData.icon}</span>
          <span class="category-name">${catData.name}</span>
        </div>
        <div class="category-items">`;

      for (const compKey of catData.components) {
        const def = lib[compKey];
        if (!def) continue;

        html += `<div 
          class="component-item" 
          draggable="true"
          data-component-type="${def.type}"
          data-component-key="${compKey}"
        >
          <span class="component-icon">${def.icon}</span>
          <span class="component-label">${def.name}</span>
        </div>`;
      }

      html += `</div></div>`;
    }

    palette.innerHTML = html;

    // Add drag event listeners
    palette.querySelectorAll('.component-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('componentType', e.target.dataset.componentType);
        e.dataTransfer.setData('componentKey', e.target.dataset.componentKey);
      });
    });
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Tool buttons
    const selectTool = document.getElementById('selectTool');
    const connectTool = document.getElementById('connectTool');
    if (selectTool) selectTool.addEventListener('click', () => this.setTool('select'));
    if (connectTool) connectTool.addEventListener('click', () => this.setTool('connect'));

    // Canvas drop
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData('componentType');
      const componentKey = e.dataTransfer.getData('componentKey');
      if (!componentType) return;

      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      
      const x = Math.round((e.clientX - rect.left) * scaleX + viewBox.x);
      const y = Math.round((e.clientY - rect.top) * scaleY + viewBox.y);

      this.addComponent(componentType, x, y, { key: componentKey });
    });

    // Canvas mouse events
    this.canvas.addEventListener('mousedown', (e) => this._onCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onCanvasMouseUp(e));

    // Canvas click (for selection in select mode only)
    this.canvas.addEventListener('click', (e) => {
      // Only handle selection in select mode
      if (this.selectedTool === 'select') {
        const target = e.target.closest('.component');
        if (target) {
          this.selectComponent(target.id);
        } else {
          this.selectComponent(null);
        }
      }
    });

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearCanvas());

    // Grid toggle
    const gridToggle = document.getElementById('gridToggle');
    const gridRect = document.getElementById('gridRect');
    if (gridToggle && gridRect) {
      gridToggle.addEventListener('change', (e) => {
        gridRect.style.display = e.target.checked ? 'block' : 'none';
      });
    }
  }

  /**
   * Add component to canvas
   */
  addComponent(type, x, y, options = {}) {
    const id = options.id || `${type}_${Date.now()}`;
    const lib = window.COMPONENT_LIBRARY || {};
    const compKey = options.key || type;
    const def = lib[compKey] || {};

    const component = {
      id,
      type,
      key: compKey,
      name: def.name || type,
      x,
      y,
      orientation: options.orientation || def.defaultConfig?.orientation || 'R',
      ports: def.connectionPoints || [],
      config: { ...def.defaultConfig, ...options.config }
    };

    this.components.set(id, component);
    this._renderComponent(component);
    this._updateStats();

    return component;
  }

  /**
   * Render component on canvas
   */
  _renderComponent(comp) {
    const symbolId = this._symbolRegistry.get(comp.type);
    if (!symbolId) {
      console.warn(`No symbol found for type: ${comp.type}`);
      return;
    }

    const lib = window.COMPONENT_LIBRARY || {};
    const def = lib[comp.key] || {};
    const size = def.imageSize || { w: 100, h: 100, x: -50, y: -50 };

    const orient = String(comp.orientation || 'R').toUpperCase();
    let rot = 0;
    if (/valve/i.test(comp.type) && orient === 'D') rot = 180;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = comp.id;
    g.classList.add('component');
    g.setAttribute('data-type', comp.type);
    g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${rot})`);

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${symbolId}`);
    use.setAttribute('width', size.w);
    use.setAttribute('height', size.h);
    use.setAttribute('x', size.x);
    use.setAttribute('y', size.y);
    use.classList.add('comp-skin');

    g.appendChild(use);
    this.componentsLayer.appendChild(g);
  }

  /**
   * Get port position for a component
   */
  _getPortPosition(comp, portName) {
    const ports = this._portCache.get(comp.type) || {};
    const port = ports[portName?.toUpperCase()];

    const lib = window.COMPONENT_LIBRARY || {};
    const def = lib[comp.key] || {};
    const size = def.imageSize || { w: 100, h: 100, x: -50, y: -50 };

    if (port) {
      // Convert from 0-100 space to actual position
      const lx = (port.x - 50) * (size.w / 100);
      const ly = (port.y - 50) * (size.h / 100);

      // Apply rotation if needed
      const orient = String(comp.orientation || 'R').toUpperCase();
      const rotDeg = (/valve/i.test(comp.type) && orient === 'D') ? 180 : 0;
      const rot = (rotDeg * Math.PI) / 180;

      const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
      const ry = lx * Math.sin(rot) + ly * Math.cos(rot);

      return { x: comp.x + rx, y: comp.y + ry };
    }

    // Fallback to component center
    return { x: comp.x, y: comp.y };
  }

  /**
   * Add connection between components
   */
  addConnection(fromComp, toComp, options = {}) {
    const id = options.id || `conn_${Date.now()}`;
    const fromPort = options.fromPort || 'outlet';
    const toPort = options.toPort || 'inlet';

    const connection = {
      id,
      from: `${fromComp.id}.${fromPort}`,
      to: `${toComp.id}.${toPort}`,
      ...options
    };

    this.connections.set(id, connection);
    this._renderConnection(connection);
    this._updateStats();

    return connection;
  }

  /**
   * Render connection line
   */
  _renderConnection(conn) {
    const [fromId, fromPort] = conn.from.split('.');
    const [toId, toPort] = conn.to.split('.');
    
    const fromComp = this.components.get(fromId);
    const toComp = this.components.get(toId);
    
    if (!fromComp || !toComp) return;

    const p1 = this._getPortPosition(fromComp, fromPort);
    const p2 = this._getPortPosition(toComp, toPort);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.id = conn.id;
    line.classList.add('connection');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('stroke', '#93c5fd');
    line.setAttribute('stroke-width', '3');

    this.connectionsLayer.appendChild(line);
  }

  /**
   * Select component
   */
  selectComponent(id) {
    // Deselect previous
    if (this.selectedComponent) {
      const prev = document.getElementById(this.selectedComponent);
      if (prev) prev.classList.remove('selected');
    }

    this.selectedComponent = id;

    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('selected');
      
      const comp = this.components.get(id);
      if (comp) this._showProperties(comp);
    } else {
      this._clearProperties();
    }
  }

  /**
   * Show properties panel for component
   */
  _showProperties(comp) {
    const panel = document.getElementById('propertiesContent');
    if (!panel) return;

    const lib = window.COMPONENT_LIBRARY || {};
    const def = lib[comp.key] || {};

    let html = `<div class="properties-form">
      <h3>${comp.name}</h3>
      <div class="form-field">
        <label>ID:</label>
        <input type="text" value="${comp.id}" readonly>
      </div>
      <div class="form-field">
        <label>Type:</label>
        <input type="text" value="${comp.type}" readonly>
      </div>
      <div class="form-field">
        <label>Position:</label>
        <input type="text" value="(${comp.x}, ${comp.y})" readonly>
      </div>`;

    // Add editable properties
    if (def.properties) {
      for (const prop of def.properties) {
        html += `<div class="form-field">
          <label>${prop.label}:</label>
          <input 
            type="${prop.type}" 
            value="${comp.config[prop.name] || prop.default}" 
            data-prop="${prop.name}"
            min="${prop.min || ''}"
            max="${prop.max || ''}"
            step="${prop.step || ''}">
        </div>`;
      }
    }

    html += `<button class="btn btn-danger" onclick="designer.deleteComponent('${comp.id}')">Delete</button>
    </div>`;

    panel.innerHTML = html;

    // Add property change listeners
    panel.querySelectorAll('input[data-prop]').forEach(input => {
      input.addEventListener('change', (e) => {
        const propName = e.target.dataset.prop;
        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        comp.config[propName] = value;
        console.log(`Updated ${comp.id}.${propName} = ${value}`);
      });
    });
  }

  /**
   * Clear properties panel
   */
  _clearProperties() {
    const panel = document.getElementById('propertiesContent');
    if (!panel) return;

    panel.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>Select a component to edit its properties</p>
    </div>`;
  }

  /**
   * Delete component
   */
  deleteComponent(id) {
    // Remove component
    this.components.delete(id);
    const el = document.getElementById(id);
    if (el) el.remove();

    // Remove associated connections
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.from.startsWith(id) || conn.to.startsWith(id)) {
        this.connections.delete(connId);
        const connEl = document.getElementById(connId);
        if (connEl) connEl.remove();
      }
    }

    this.selectComponent(null);
    this._updateStats();
  }

  /**
   * Set active tool
   */
  setTool(tool) {
    // Cancel any connection in progress
    this._cancelConnection();

    this.selectedTool = tool;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`${tool}Tool`);
    if (btn) btn.classList.add('active');

    // Update cursor
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';

    console.log(`Tool switched to: ${tool}`);
  }

  /**
   * Clear canvas
   */
  clearCanvas() {
    if (!confirm('Clear all components and connections?')) return;

    this.components.clear();
    this.connections.clear();
    this.componentsLayer.innerHTML = '';
    this.connectionsLayer.innerHTML = '';
    this.selectComponent(null);
    this._updateStats();
  }

  /**
   * Update stats display
   */
  _updateStats() {
    const compCount = document.getElementById('componentCount');
    const connCount = document.getElementById('connectionCount');
    
    if (compCount) compCount.textContent = `Components: ${this.components.size}`;
    if (connCount) connCount.textContent = `Connections: ${this.connections.size}`;
  }

  /**
   * Canvas mouse handlers for dragging and connecting
   */
  _onCanvasMouseDown(e) {
    // Handle select tool - dragging
    if (this.selectedTool === 'select') {
      const target = e.target.closest('.component');
      if (!target) return;

      const id = target.id;
      const comp = this.components.get(id);
      if (!comp) return;

      this.dragState = {
        component: comp,
        startX: e.clientX,
        startY: e.clientY,
        compX: comp.x,
        compY: comp.y
      };
    }

    // Handle connect tool - start connection
    if (this.selectedTool === 'connect') {
      const target = e.target.closest('.component');
      if (!target) {
        // Clicked on empty space - cancel connection
        this._cancelConnection();
        return;
      }

      const id = target.id;
      const comp = this.components.get(id);
      if (!comp) return;

      if (!this.connectionState) {
        // Start new connection
        this.connectionState = {
          fromComponent: comp,
          fromPort: this._detectDefaultPort(comp, 'outlet')
        };

        // Visual feedback - highlight source component
        target.classList.add('connection-source');
        console.log(`Connection started from ${comp.name} (${comp.id})`);
      } else {
        // Complete connection
        const toPort = this._detectDefaultPort(comp, 'inlet');

        // Don't allow self-connections
        if (this.connectionState.fromComponent.id === comp.id) {
          alert('Cannot connect a component to itself');
          this._cancelConnection();
          return;
        }

        // Create the connection
        this.addConnection(
          this.connectionState.fromComponent,
          comp,
          {
            fromPort: this.connectionState.fromPort,
            toPort: toPort
          }
        );

        console.log(`Connection created: ${this.connectionState.fromComponent.name} → ${comp.name}`);
        this._cancelConnection();
      }
    }
  }

  _onCanvasMouseMove(e) {
    // Update mouse position display
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX + viewBox.x);
    const y = Math.round((e.clientY - rect.top) * scaleY + viewBox.y);

    const mousePos = document.getElementById('mousePos');
    if (mousePos) mousePos.textContent = `X: ${x}, Y: ${y}`;

    // Handle dragging in select mode
    if (this.dragState) {
      const dx = (e.clientX - this.dragState.startX) * scaleX;
      const dy = (e.clientY - this.dragState.startY) * scaleY;

      this.dragState.component.x = Math.round(this.dragState.compX + dx);
      this.dragState.component.y = Math.round(this.dragState.compY + dy);

      this._updateComponentPosition(this.dragState.component);
      return;
    }

    // Show connection preview in connect mode
    if (this.selectedTool === 'connect' && this.connectionState) {
      this._updateConnectionPreview(x, y);
    }
  }

  _onCanvasMouseUp(e) {
    this.dragState = null;
  }

  /**
   * Detect default port for a component based on type
   */
  _detectDefaultPort(comp, preferredType) {
    // Check if component has port definitions
    const lib = window.COMPONENT_LIBRARY || {};
    const def = lib[comp.key] || {};

    if (def.connectionPoints && def.connectionPoints.length > 0) {
      // Try to find a port matching the preferred type
      const port = def.connectionPoints.find(p =>
        p.name === preferredType || p.type === preferredType
      );
      if (port) return port.name;

      // Otherwise return first available port
      return def.connectionPoints[0].name;
    }

    // Fallback to standard port names based on type
    const type = comp.type.toLowerCase();
    if (preferredType === 'outlet') {
      if (type.includes('feed')) return 'outlet';
      if (type.includes('tank')) return 'bottom';
      if (type.includes('pump')) return 'outlet';
      if (type.includes('valve')) return 'outlet';
      return 'outlet';
    } else {
      if (type.includes('drain')) return 'inlet';
      if (type.includes('tank')) return 'top';
      if (type.includes('pump')) return 'inlet';
      if (type.includes('valve')) return 'inlet';
      return 'inlet';
    }
  }

  /**
   * Update connection preview line
   */
  _updateConnectionPreview(mouseX, mouseY) {
    if (!this.connectionState) return;

    // Remove old preview line
    const oldPreview = document.getElementById('connection-preview');
    if (oldPreview) oldPreview.remove();

    // Get source port position
    const fromPos = this._getPortPosition(
      this.connectionState.fromComponent,
      this.connectionState.fromPort
    );

    // Create preview line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.id = 'connection-preview';
    line.setAttribute('x1', fromPos.x);
    line.setAttribute('y1', fromPos.y);
    line.setAttribute('x2', mouseX);
    line.setAttribute('y2', mouseY);
    line.setAttribute('stroke', '#fbbf24');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    line.setAttribute('opacity', '0.8');
    line.style.pointerEvents = 'none';

    this.connectionsLayer.appendChild(line);
  }

  /**
   * Cancel connection in progress
   */
  _cancelConnection() {
    // Remove preview line
    const preview = document.getElementById('connection-preview');
    if (preview) preview.remove();

    // Remove source highlight
    if (this.connectionState?.fromComponent) {
      const sourceEl = document.getElementById(this.connectionState.fromComponent.id);
      if (sourceEl) sourceEl.classList.remove('connection-source');
    }

    this.connectionState = null;
  }

  /**
   * Update component position after drag
   */
  _updateComponentPosition(comp) {
    const el = document.getElementById(comp.id);
    if (!el) return;

    const orient = String(comp.orientation || 'R').toUpperCase();
    let rot = 0;
    if (/valve/i.test(comp.type) && orient === 'D') rot = 180;
    
    el.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${rot})`);

    // Update connected pipes
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.from.startsWith(comp.id) || conn.to.startsWith(comp.id)) {
        const line = document.getElementById(connId);
        if (line) {
          const [fromCompId, fromPort] = conn.from.split('.');
          const [toCompId, toPort] = conn.to.split('.');
          const fromComp = this.components.get(fromCompId);
          const toComp = this.components.get(toCompId);
          
          if (fromComp && toComp) {
            const p1 = this._getPortPosition(fromComp, fromPort);
            const p2 = this._getPortPosition(toComp, toPort);
            line.setAttribute('x1', p1.x);
            line.setAttribute('y1', p1.y);
            line.setAttribute('x2', p2.x);
            line.setAttribute('y2', p2.y);
          }
        }
      }
    }
  }

  /**
   * Get design data for export
   */
  getDesignData() {
    return {
      name: 'My Process Design',
      components: Array.from(this.components.values()),
      connections: Array.from(this.connections.values())
    };
  }

  /**
   * Load design data
   */
  loadDesign(data) {
    this.clearCanvas();

    // Load components
    for (const comp of data.components || []) {
      this.addComponent(comp.type, comp.x, comp.y, comp);
    }

    // Load connections
    for (const conn of data.connections || []) {
      const [fromId] = conn.from.split('.');
      const [toId] = conn.to.split('.');
      const fromComp = this.components.get(fromId);
      const toComp = this.components.get(toId);
      if (fromComp && toComp) {
        this.addConnection(fromComp, toComp, conn);
      }
    }

    console.log('✅ Design loaded:', data);
  }
}

// Initialize designer when DOM is ready
let designer;
window.addEventListener('DOMContentLoaded', () => {
  designer = new ProcessDesigner('canvas', {
    baseUrl: 'https://sco314.github.io/tank-sim/'
  });
  window.designer = designer; // Make globally accessible
  console.log('✅ Designer v3.1 ready - Style preservation improved');
});
