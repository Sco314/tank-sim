/**
 * designer.js V3.0 - Process Simulator Designer
 * - Uses sprite system with <use> instances
 * - Parses and stores ports from SVGs
 * - Centers components properly for port alignment
 * - Prevents SVG style bleed with class scoping
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
        const prefixed = this._prefixSvgIds(inner, meta.symbolId);
        const scoped = this._scopeSvgClasses(prefixed, meta.symbolId);

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
   * Resolve SVG asset path (matches exporter logic)
   */
  _resolveSvgAssetPath(type, comp, template) {
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
   * Scope SVG classes to prevent bleed
   */
  _scopeSvgClasses(content, ns) {
    content = content.replace(/class="([^"]+)"/g, (_, classes) => {
      const mapped = classes.split(/\s+/).map(c =>
        /^cls-\d+$/i.test(c) ? `${ns}-${c}` : c
      ).join(' ');
      return `class="${mapped}"`;
    });

    content = content.replace(
      /<style[^>]*>([\s\S]*?)<\/style>/g,
      (_, css) => `<style>${css.replace(/\.cls-(\d+)/g, `.${ns}-cls-$1`)}</style>`
    );

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
      html += `<div class="category">
        <div class="category-header">${catData.icon} ${catData.name}</div>
        <div class="category-items">`;

      for (const compKey of catData.components || []) {
        const comp = lib[compKey];
        if (!comp) continue;

        const symbolId = this._symbolRegistry.get(comp.type || compKey);
        const icon = symbolId 
          ? `<svg viewBox="0 0 100 100" width="48" height="48"><use href="#${symbolId}"/></svg>`
          : `<span style="font-size:32px">${comp.icon || '🔧'}</span>`;

        html += `<div class="palette-item" data-type="${comp.type || compKey}" draggable="true">
          ${icon}
          <span>${comp.name}</span>
        </div>`;
      }

      html += `</div></div>`;
    }

    palette.innerHTML = html;

    // Add drag handlers
    palette.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('dragstart', (e) => this._onPaletteDragStart(e));
    });
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('drop', (e) => this._onCanvasDrop(e));
    this.canvas.addEventListener('dragover', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => this._onCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onCanvasMouseUp(e));

    // Tool buttons
    const selectTool = document.getElementById('selectTool');
    const connectTool = document.getElementById('connectTool');
    if (selectTool) selectTool.addEventListener('click', () => this.setTool('select'));
    if (connectTool) connectTool.addEventListener('click', () => this.setTool('connect'));

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearCanvas());
  }

  /**
   * Palette drag start
   */
  _onPaletteDragStart(e) {
    const type = e.currentTarget.dataset.type;
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }

  /**
   * Canvas drop - add component
   */
  _onCanvasDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('component-type');
    if (!type) return;

    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX + viewBox.x;
    const y = (e.clientY - rect.top) * scaleY + viewBox.y;

    this.addComponent(type, x, y);
  }

  /**
   * Add component to canvas
   */
  addComponent(type, x, y, config = {}) {
    const id = config.id || `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const lib = window.COMPONENT_LIBRARY || {};
    const template = lib[type] || {};
    const symbolId = this._symbolRegistry.get(type);

    // Get cached ports for this type
    const ports = this._portCache.get(type) || {};

    // Create component data
    const component = {
      id,
      type,
      key: type,
      x: Math.round(x),
      y: Math.round(y),
      name: config.name || template.name || type,
      orientation: config.orientation || 'R',
      config: { ...template.defaultConfig, ...config },
      ports: { ...ports } // Store ports on component
    };

    this.components.set(id, component);

    // Render component
    this._renderComponent(component);

    // Update stats
    this._updateStats();

    console.log('✅ Added component:', component);
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

    const orient = String(comp.orientation || 'R').toUpperCase();
    let rot = 0;
    if (/valve/i.test(comp.type) && orient === 'D') rot = 180;

    // Center the symbol: translate(-50,-50) aligns (50,50) in symbol space to (x,y)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', comp.id);
    g.setAttribute('class', `component ${comp.type}`);
    g.setAttribute('data-type', comp.type);
    
    g.innerHTML = `<use href="#${symbolId}" 
                        transform="translate(${comp.x}, ${comp.y}) rotate(${rot}) translate(-50,-50)" 
                        class="comp-skin" 
                        style="cursor:move"/>`;

    this.componentsLayer.appendChild(g);

    // Add event listeners
    g.addEventListener('click', () => this._onComponentClick(comp));
  }

  /**
   * Component click handler
   */
  _onComponentClick(comp) {
    if (this.selectedTool === 'connect') {
      this._handleConnectionClick(comp);
    } else {
      this.selectComponent(comp);
    }
  }

  /**
   * Select component
   */
  selectComponent(comp) {
    // Remove previous selection
    this.canvas.querySelectorAll('.component.selected').forEach(el => {
      el.classList.remove('selected');
    });

    if (comp) {
      const el = document.getElementById(comp.id);
      if (el) el.classList.add('selected');
      this.selectedComponent = comp;
      this._showProperties(comp);
    } else {
      this.selectedComponent = null;
      this._clearProperties();
    }
  }

  /**
   * Handle connection mode click
   */
  _handleConnectionClick(comp) {
    if (!this.connectionState) {
      // Start connection
      this.connectionState = { from: comp };
      console.log('Connection started from:', comp.id);
    } else {
      // Complete connection
      if (this.connectionState.from.id !== comp.id) {
        this.addConnection(this.connectionState.from, comp);
      }
      this.connectionState = null;
    }
  }

  /**
   * Add connection between components
   */
  addConnection(fromComp, toComp, config = {}) {
    const id = config.id || `conn_${Date.now()}`;
    
    // Find appropriate ports (simplified - just use first available ports)
    const fromPorts = Object.keys(fromComp.ports || {});
    const toPorts = Object.keys(toComp.ports || {});
    
    const fromPort = config.fromPort || fromPorts[fromPorts.length - 1] || 'outlet';
    const toPort = config.toPort || toPorts[0] || 'inlet';

    const connection = {
      id,
      from: `${fromComp.id}.${fromPort}`,
      to: `${toComp.id}.${toPort}`
    };

    this.connections.set(id, connection);
    this._renderConnection(connection);
    this._updateStats();

    console.log('✅ Added connection:', connection);
    return connection;
  }

  /**
   * Render connection line
   */
  _renderConnection(conn) {
    const [fromCompId, fromPort] = conn.from.split('.');
    const [toCompId, toPort] = conn.to.split('.');

    const fromComp = this.components.get(fromCompId);
    const toComp = this.components.get(toCompId);

    if (!fromComp || !toComp) return;

    const p1 = this._getPortPosition(fromComp, fromPort);
    const p2 = this._getPortPosition(toComp, toPort);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', conn.id);
    line.setAttribute('class', 'connection pipe');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('stroke', '#2563eb');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-linecap', 'round');

    this.connectionsLayer.appendChild(line);
  }

  /**
   * Get port world position
   */
  _getPortPosition(comp, portName) {
    const cx = comp.x, cy = comp.y;
    const orient = String(comp.orientation || 'R').toUpperCase();
    
    const rotDeg = (/valve/i.test(comp.type) && orient === 'D') ? 180 : 0;
    const rot = rotDeg * Math.PI / 180;

    const port = comp.ports?.[portName];
    if (port) {
      const lx = (port.x ?? 50) - 50;
      const ly = (port.y ?? 50) - 50;
      const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
      const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
      return { x: cx + rx, y: cy + ry };
    }

    return { x: cx, y: cy };
  }

  /**
   * Show component properties
   */
  _showProperties(comp) {
    const panel = document.getElementById('propertiesContent');
    if (!panel) return;

    const lib = window.COMPONENT_LIBRARY || {};
    const template = lib[comp.type] || {};
    const props = template.properties || [];

    let html = `<div class="properties-form">
      <h3>${comp.name}</h3>
      <div class="form-group">
        <label>ID</label>
        <input type="text" value="${comp.id}" disabled>
      </div>
      <div class="form-group">
        <label>Type</label>
        <input type="text" value="${comp.type}" disabled>
      </div>`;

    for (const prop of props) {
      const value = comp.config[prop.name] ?? prop.default;
      html += `<div class="form-group">
        <label>${prop.label}</label>
        <input type="${prop.type}" 
               value="${value}" 
               data-prop="${prop.name}"
               min="${prop.min || ''}"
               max="${prop.max || ''}"
               step="${prop.step || ''}">
      </div>`;
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
    this.selectedTool = tool;
    this.connectionState = null;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`${tool}Tool`);
    if (btn) btn.classList.add('active');

    // Update cursor
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';
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
   * Canvas mouse handlers for dragging
   */
  _onCanvasMouseDown(e) {
    if (this.selectedTool !== 'select') return;
    
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

  _onCanvasMouseMove(e) {
    if (!this.dragState) return;

    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    const dx = (e.clientX - this.dragState.startX) * scaleX;
    const dy = (e.clientY - this.dragState.startY) * scaleY;

    this.dragState.component.x = Math.round(this.dragState.compX + dx);
    this.dragState.component.y = Math.round(this.dragState.compY + dy);

    this._updateComponentPosition(this.dragState.component);
  }

  _onCanvasMouseUp(e) {
    this.dragState = null;
  }

  /**
   * Update component position after drag
   */
  _updateComponentPosition(comp) {
    const el = document.getElementById(comp.id);
    if (!el) return;

    const use = el.querySelector('use');
    if (use) {
      const orient = String(comp.orientation || 'R').toUpperCase();
      let rot = 0;
      if (/valve/i.test(comp.type) && orient === 'D') rot = 180;
      
      use.setAttribute('transform', 
        `translate(${comp.x}, ${comp.y}) rotate(${rot}) translate(-50,-50)`);
    }

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

  /**
   * Mouse position tracking
   */
  _onCanvasMouseMove(e) {
    // Update drag if active
    if (this.dragState) {
      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const dx = (e.clientX - this.dragState.startX) * scaleX;
      const dy = (e.clientY - this.dragState.startY) * scaleY;

      this.dragState.component.x = Math.round(this.dragState.compX + dx);
      this.dragState.component.y = Math.round(this.dragState.compY + dy);

      this._updateComponentPosition(this.dragState.component);
    }

    // Update mouse position display
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX + viewBox.x);
    const y = Math.round((e.clientY - rect.top) * scaleY + viewBox.y);

    const mousePos = document.getElementById('mousePos');
    if (mousePos) mousePos.textContent = `X: ${x}, Y: ${y}`;
  }
}

// Initialize designer when DOM is ready
let designer;
window.addEventListener('DOMContentLoaded', () => {
  designer = new ProcessDesigner('canvas', {
    baseUrl: 'https://sco314.github.io/tank-sim/'
  });
  window.designer = designer; // Make globally accessible
  console.log('✅ Designer ready');
});
