/**
 * designer.js - Process Designer v2.1.0 (PORT NORMALIZED)
 *
 * - Connection points: nearest CP snap, hover markers, ports stored in connections
 * - Delegates all exporting to exporter.js (SimulatorExporter)
 * - Renders components via SVG <symbol> (preferred) or image fallback
 * - Drag to move components (updates connected pipes live)
 * - FIXED: All methods inside class, proper syntax, exporter compatibility
 * - NEW v2.1.0: Port name normalization matching exporter (P_IN/P_OUT aliases)
 */

const DESIGNER_VERSION = '2.1.0';

function byId(id) { return document.getElementById(id); }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

class ProcessDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.componentsLayer = document.getElementById('componentsLayer');
    this.connectionsLayer = document.getElementById('connectionsLayer');

    /** @type {Map<string, any>} */
    this.components = new Map();
    /** @type {{id:string, from:string, to:string, fromPoint?:string, toPoint?:string}[]} */
    this.connections = [];

    this.nextId = 1;
    this.nextConnectionId = 1;
    this.gridSize = 20;

    this.designMetadata = {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      name: 'My Simulator'
    };

    this.hoverMarkerLayer = this._ensureHoverMarkerLayer();

    this.tool = 'select';
    this.currentTool = 'select';
    this.connectionStart = null;
    this.tempConnectionLine = null;

    // dragging
    this.selectedComponent = null;
    this._dragState = null;

    // Component library (robust lookup)
    this.componentLibrary =
      window.componentLibrary ||
      window.COMPONENT_LIBRARY ||
      {};

    this._init();
  }

  _init() {
    this._setupSidebar();
    this._setupEventListeners();
    this._setupKeyboard();
    this._ensureDefs();
    console.log(`Process Designer v${DESIGNER_VERSION} initialized`);
  }

  _ensureDefs() {
    let defs = this.canvas.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.canvas.insertBefore(defs, this.canvas.firstChild);
    }

    // Arrow marker (once)
    if (!document.getElementById('arrowhead')) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.innerHTML = '<polygon points="0 0, 10 3, 0 6" fill="#4f46e5" />';
      defs.appendChild(marker);
    }

    // Load component SVG symbols into <defs>
    const lib = this.componentLibrary?.components || {};
    for (const [type, def] of Object.entries(lib)) {
      const symbolId = `symbol-${type}`;
      if (def.symbol && !document.getElementById(symbolId)) {
        const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
        symbol.setAttribute('id', symbolId);
        symbol.setAttribute('viewBox', def.symbolViewBox || '0 0 60 60');
        symbol.innerHTML = def.symbol;
        defs.appendChild(symbol);
      }
    }

    // ✅ QA: Check for unscoped .cls-* classes
    if (defs.innerHTML && /\bclass="[^"]*\bcls-\d+/.test(defs.innerHTML)) {
      console.warn('🔎 Unscoped .cls-* may remain in the sprite; check _scopeSvgClasses().');
    }
  }

  _ensureHoverMarkerLayer() {
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('id', 'hoverMarkers');
    layer.style.pointerEvents = 'none';
    this.canvas.appendChild(layer);
    return layer;
  }

  _setupSidebar() {
    try {
      console.log(`✅ Component library loaded: ${Object.keys(this.componentLibrary?.components || {}).length} components`);
      const palette = byId('componentPalette');
      if (!palette) return;

      const list = (window.getComponentList ? window.getComponentList() : [])
        .map(item => ({ key: item.key, label: item.label, type: item.type, icon: item.icon, image: item.image }))
        .filter(Boolean);

      const frag = document.createDocumentFragment();
      list.forEach(item => {
        const li = el('div', 'palette-item');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.dataset.key = item.key;
        li.dataset.type = item.type;
        li.innerHTML = `
          <div class="icon">${item.icon || '🔧'}</div>
          <div class="label">${item.label}</div>
        `;
        li.addEventListener('dragstart', e => this._onPaletteDragStart(e, item));
        li.addEventListener('click', () => this._addFromPalette(item, { x: 100, y: 100 }));
        li.draggable = true;
        frag.appendChild(li);
      });

      palette.appendChild(frag);
      console.log('✅ Component library UI initialized');
    } catch (e) {
      console.warn('Component library not available yet', e);
    }
  }

  _setupEventListeners() {
    // Drag & drop support
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      
      let item;
      try {
        item = JSON.parse(dataStr);
      } catch (err) {
        console.error('Failed to parse dropped data:', err);
        return;
      }
      
      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
      const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;
      
      const snapToggle = byId('snapToggle');
      const snapToGrid = snapToggle ? snapToggle.checked : false;
      
      const finalX = snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x;
      const finalY = snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y;
      
      this._addFromPalette(item, { x: finalX, y: finalY });
    });

    // Canvas interactions
    this.canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
    this.canvas.addEventListener('mousemove', (e) => this._handleCanvasMouseMove(e));

    // Toolbar buttons
    byId('selectTool')?.addEventListener('click', () => this._setTool('select'));
    byId('connectTool')?.addEventListener('click', () => this._setTool('connect'));

    // 🔧 FIXED Export buttons with proper async/await and download
    byId('exportBtn')?.addEventListener('click', (e) => {
      e?.preventDefault?.();
      
      const name = this.getSimulatorName() || 'simulator';
      const statusEl = byId('export-status');

      const progress = {
        update: msg => { 
          if (statusEl) statusEl.textContent = msg; 
          console.log('📊', msg); 
        },
        setDetail: d => { 
          if (statusEl) statusEl.textContent = (statusEl.textContent || '') + ' — ' + d; 
        }
      };

      this._ensureExporter(async () => {
        try {
          if (statusEl) { 
            statusEl.style.color = '#6b7280'; 
            statusEl.textContent = '⏳ Exporting simulator…'; 
          }

          const exporter = new SimulatorExporter(this, {
            baseUrl: 'https://sco314.github.io/tank-sim/'
          });

          const html = await exporter.exportSimulator(progress);

          const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html';
          const blob = new Blob([html], { type: 'text/html' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);

          if (statusEl) { 
            statusEl.textContent = '✅ Exported successfully!'; 
            statusEl.style.color = '#10b981'; 
          }
          
          setTimeout(() => { 
            if (statusEl) { 
              statusEl.textContent = ''; 
              statusEl.style.color = '#6b7280'; 
            } 
          }, 2500);
          
        } catch (err) {
          console.error('Export failed:', err);
          alert('Export failed: ' + err.message);
          if (statusEl) { 
            statusEl.textContent = '💥 Export failed: ' + err.message; 
            statusEl.style.color = '#ef4444'; 
          }
        }
      });
    });

    // 🔧 FIXED Single-File Export Button
    byId('exportSingleFile')?.addEventListener('click', () => {
      const name = this.getSimulatorName() || 'simulator';
      const statusEl = byId('export-status');

      const progress = {
        update: msg => { 
          if (statusEl) statusEl.textContent = msg; 
          console.log('📊', msg); 
        },
        setDetail: d => { 
          if (statusEl) statusEl.textContent = (statusEl.textContent || '') + ' — ' + d; 
        }
      };

      this._ensureExporter(async () => {
        try {
          if (statusEl) { 
            statusEl.style.color = '#6b7280'; 
            statusEl.textContent = '⏳ Exporting single-file…'; 
          }

          const exporter = new SimulatorExporter(this, {
            baseUrl: 'https://sco314.github.io/tank-sim/'
          });

          const html = await exporter.exportSimulator(progress);

          const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html';
          const blob = new Blob([html], { type: 'text/html' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);

          if (statusEl) { 
            statusEl.textContent = '✅ Exported successfully!'; 
            statusEl.style.color = '#10b981'; 
          }
          
          setTimeout(() => { 
            if (statusEl) { 
              statusEl.textContent = ''; 
              statusEl.style.color = '#6b7280'; 
            } 
          }, 2500);
          
        } catch (err) {
          console.error('Single-file export failed:', err);
          alert('Export failed: ' + err.message);
          if (statusEl) { 
            statusEl.textContent = '💥 Export failed: ' + err.message; 
            statusEl.style.color = '#ef4444'; 
          }
        }
      });
    });

    byId('exportZip')?.addEventListener('click', () => {
      const name = this.getSimulatorName();
      this._ensureExporter(() => {
        try {
          const exporter = new SimulatorExporter(this, {
            baseUrl: 'https://sco314.github.io/tank-sim/'
          });
          if (typeof exporter.exportAsZip === 'function') {
            exporter.exportAsZip(name);
          } else {
            alert('ZIP export requires exporter.js support.');
          }
        } catch (err) {
          console.error('ZIP export failed:', err);
          alert('Export failed: ' + err.message);
        }
      });
    });

    // Other UI controls
    byId('importBtn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.importConfig(evt.target.result);
        };
        reader.readAsText(file);
      };
      input.click();
    });

    byId('saveDesignBtn')?.addEventListener('click', () => {
      const json = this.exportDesignJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.designMetadata.name.replace(/[^a-z0-9]/gi, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    byId('clearBtn')?.addEventListener('click', () => {
      if (confirm('Clear all components? This cannot be undone.')) {
        this.clearCanvas(true);
      }
    });

    byId('previewBtn')?.addEventListener('click', () => {
      alert(`Design Preview:\n\nComponents: ${this.components.size}\nConnections: ${this.connections.length}`);
    });

    byId('gridToggle')?.addEventListener('change', (e) => {
      const gridRect = byId('gridRect');
      if (gridRect) {
        gridRect.style.opacity = e.target.checked ? '0.4' : '0';
      }
    });

    window.addEventListener('mouseup', () => { 
      this._dragState = null; 
    });

    console.log('✅ Event listeners set up');
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.selectedComponent) {
        this._deleteComponent(this.selectedComponent);
      }
    });
  }

  _ensureExporter(cb) {
    if (window.SimulatorExporter) return cb();
    console.log('Loading exporter.js...');
    const script = document.createElement('script');
    script.src = './js/exporter.js';
    script.onload = () => { console.log('✅ exporter.js loaded'); cb(); };
    script.onerror = () => alert('Failed to load exporter.js');
    document.head.appendChild(script);
  }

  // ============================================================================
  // COMPONENT MANAGEMENT
  // ============================================================================

  /**
   * ✅ FIXED: Helper to capitalize type names for manager compatibility
   */
  _capitalizeType(type) {
    if (!type) return type;
    const normalized = type.toLowerCase();
    const typeMap = {
      'tank': 'Tank',
      'pump': 'Pump',
      'valve': 'Valve',
      'pipe': 'Pipe',
      'feed': 'Feed',
      'drain': 'Drain',
      'sensor': 'Sensor',
      'pressuresensor': 'PressureSensor'
    };
    return typeMap[normalized] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * ✅ FIXED: Helper to get orientation rotation angle
   */
  _getOrientationRotation(orientation) {
    const rotations = {
      'R': 0,    // right-facing (default)
      'D': 90,   // down-facing
      'L': 180,  // left-facing
      'U': 270   // up-facing
    };
    return rotations[orientation] || 0;
  }

  /**
   * ✅ FIXED: Get default orientation for component type
   */
  _getDefaultOrientation(type) {
    const normalized = type.toLowerCase();
    if (normalized === 'tank') return 'U';
    if (normalized === 'drain') return 'L';
    if (normalized === 'feed') return 'R';
    if (normalized === 'pump') return 'L';
    if (normalized === 'valve') return 'R';
    return 'R'; // default
  }

  /**
   * ✅ FIXED: Get default ports for component type
   */
  _getDefaultPorts(type) {
    const normalized = type.toLowerCase();
    
    if (normalized === 'tank') {
      return { IN: { x: 50, y: 10 }, OUT: { x: 50, y: 90 } };
    } else if (normalized === 'feed') {
      return { OUT: { x: 95, y: 50 } };
    } else if (normalized === 'drain') {
      return { IN: { x: 5, y: 50 } };
    } else if (['pump', 'valve', 'pipe'].includes(normalized)) {
      return { IN: { x: 5, y: 50 }, OUT: { x: 95, y: 50 } };
    } else {
      // Generic 4-port layout
      return {
        LEFT: { x: 5, y: 50 },
        RIGHT: { x: 95, y: 50 },
        TOP: { x: 50, y: 5 },
        BOTTOM: { x: 50, y: 95 }
      };
    }
  }

  /**
   * ✅ FIXED: Add component from palette
   */
  _addFromPalette(item, pos) {
    const id = String(this.nextId++);
    const type = (item.type || item.key || '').toLowerCase();
    const lib = (this.componentLibrary?.components || {});
    const def = lib[type] || {};
    
    // Get orientation
    let orientation = this._getDefaultOrientation(type);
    
    // Get ports from library or compute defaults
    let ports = {};
    if (def.connectionPoints && def.connectionPoints.length > 0) {
      def.connectionPoints.forEach(cp => {
        const portName = (cp.name || cp.id || 'port').toUpperCase();
        ports[portName] = { x: cp.x || 0, y: cp.y || 0 };
      });
    } else {
      ports = this._getDefaultPorts(type);
    }
    
    const comp = {
      id,
      key: item.key,
      type: this._capitalizeType(item.type),
      name: item.label || item.type,
      x: pos.x,
      y: pos.y,
      orientation,
      ports,
      config: {}
    };
    
    this.components.set(id, comp);
    this._renderComponent(comp);
    this._updateStats();
    
    console.log(`Added ${comp.name} at (${pos.x}, ${pos.y}) with orientation ${orientation}`);
  }

  /**
   * ✅ FIXED: Render component on canvas
   */
  _renderComponent(comp) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('canvas-component');
    g.dataset.id = comp.id;
    
    // Apply orientation rotation
    const rotation = this._getOrientationRotation(comp.orientation);
    g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${rotation})`);

    const type = (comp.type || comp.key || '').toLowerCase();
    const symbolId = `symbol-${type}`;
    const symbolEl = document.getElementById(symbolId);

    if (symbolEl) {
      // Use symbol
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${symbolId}`);
      use.setAttribute('width', '60');
      use.setAttribute('height', '60');
      use.setAttribute('x', '-30');
      use.setAttribute('y', '-30');
      g.appendChild(use);
    } else {
      // PNG fallback
      const lib = this.componentLibrary?.components || {};
      const def = lib[type] || {};
      
      // Choose image based on orientation for pumps
      let imageUrl = def.image;
      if (type === 'pump' && comp.orientation) {
        if (comp.orientation === 'L' && def.images?.L) {
          imageUrl = def.images.L;
        } else if (comp.orientation === 'R' && def.images?.R) {
          imageUrl = def.images.R;
        }
      }
      
      if (imageUrl) {
        const size = def.imageSize || { w: 60, h: 60, x: -30, y: -30 };
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', imageUrl);
        img.setAttribute('x', size.x);
        img.setAttribute('y', size.y);
        img.setAttribute('width', size.w);
        img.setAttribute('height', size.h);
        g.appendChild(img);
      } else {
        // Generic circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '20');
        circle.setAttribute('fill', '#0e1734');
        circle.setAttribute('stroke', '#2a3d78');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);
      }
    }

    // Label (counter-rotate to keep horizontal)
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.textContent = comp.name || comp.type;
    label.setAttribute('x', '0');
    label.setAttribute('y', '-40');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#9bb0ff');
    label.setAttribute('transform', `rotate(${-rotation})`);
    g.appendChild(label);

    // Hover markers
    g.addEventListener('mouseenter', () => this._showHoverMarkers(comp));
    g.addEventListener('mouseleave', () => this._clearHoverMarkers());

    // Drag to move
    g.addEventListener('mousedown', (e) => {
      if (this.tool !== 'select') return;
      const pt = this._getMouseSVGPoint(e);
      this._dragState = { id: comp.id, dx: pt.x - comp.x, dy: pt.y - comp.y };
      this.selectedComponent = comp.id;
      e.stopPropagation();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this._dragState) return;
      const compId = this._dragState.id;
      const c = this.components.get(compId);
      if (!c) return;
      const pt = this._getMouseSVGPoint(e);
      c.x = pt.x - this._dragState.dx;
      c.y = pt.y - this._dragState.dy;
      const node = this.componentsLayer.querySelector(`[data-id="${compId}"]`);
      const rot = this._getOrientationRotation(c.orientation);
      node?.setAttribute('transform', `translate(${c.x}, ${c.y}) rotate(${rot})`);
      this._updateComponentConnections(compId);
    });

    this.componentsLayer.appendChild(g);
  }

  _updateComponentConnections(componentId) {
    this.connections.forEach(conn => {
      if (conn.from === componentId || conn.to === componentId) {
        const g = document.getElementById(conn.id);
        if (g) {
          const path = g.querySelector('path');
          if (path) this._updateConnectionPath(conn, path);
        }
      }
    });
  }

  _deleteComponent(componentId) {
    // Remove connections
    this.connections = this.connections.filter(conn => {
      if (conn.from === componentId || conn.to === componentId) {
        document.getElementById(conn.id)?.remove();
        return false;
      }
      return true;
    });

    // Remove component
    this.components.delete(componentId);
    this.componentsLayer.querySelector(`[data-id="${componentId}"]`)?.remove();
    this.selectedComponent = null;
    this._updateStats();
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  _handleCanvasClick(e) {
    const target = e.target.closest('.canvas-component');
    if (!target) { 
      this._cancelConnection(); 
      return; 
    }

    const componentId = target.dataset.id;
    const component = this.components.get(componentId);
    this.selectedComponent = componentId;

    if (this.tool === 'select') {
      this._updatePropertiesPanel(componentId);
      return;
    }

    if (!this.connectionStart) {
      if (!this._canOutput(component)) { 
        alert(`${component.name} cannot have outputs (it's a ${component.type})`); 
        return; 
      }
      this._startConnection(componentId);
    } else {
      if (!this._canInput(component)) { 
        alert(`${component.name} cannot have inputs (it's a ${component.type})`); 
        this._cancelConnection(); 
        return; 
      }
      if (componentId === this.connectionStart) { 
        alert('Cannot connect component to itself'); 
        this._cancelConnection(); 
        return; 
      }
      this._completeConnection(componentId);
    }
  }

  _startConnection(componentId) {
    this.connectionStart = componentId;
    this.tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempConnectionLine.setAttribute('stroke', '#4f46e5');
    this.tempConnectionLine.setAttribute('stroke-width', '3');
    this.tempConnectionLine.setAttribute('fill', 'none');
    this.tempConnectionLine.setAttribute('stroke-dasharray', '5,5');

    this.connectionsLayer.appendChild(this.tempConnectionLine);
    
    console.log(`Connection started from ${this.components.get(componentId).name}`);
  }

  _cancelConnection() {
    if (this.tempConnectionLine) {
      this.tempConnectionLine.remove();
      this.tempConnectionLine = null;
    }
    this.connectionStart = null;
  }

  /**
   * ✅ FIXED: Complete connection with proper port references and smart defaults
   */
  _completeConnection(targetComponentId) {
    const fromId = this.connectionStart;
    const toId = targetComponentId;
    const fromComp = this.components.get(fromId);
    const toComp = this.components.get(toId);

    // ✅ Helper: prefer canonical port names with fallbacks
    const preferPort = (wanted, comp, fallbackList = []) => {
      const ports = comp.ports || {};
      
      // Try wanted name first (normalized)
      const wantedKey = this._normalizePortName(wanted);
      if (ports[wantedKey]) return wantedKey;
      
      // Try fallbacks
      for (const fallback of fallbackList) {
        const fbKey = this._normalizePortName(fallback);
        if (ports[fbKey]) return fbKey;
      }
      
      // Final: first available key (stable order)
      const keys = Object.keys(ports);
      return keys.length > 0 ? keys[0] : null;
    };

    // Choose best output port from source
    const fromPortName = preferPort('P_OUT', fromComp, ['outlet', 'out', 'discharge', 'OUT']);
    
    // Choose best input port for target
    const toPortName = preferPort('P_IN', toComp, ['inlet', 'in', 'suction', 'IN']);

    if (!fromPortName || !toPortName) {
      console.warn('⚠️ No valid ports found; connection may anchor to centers.', { fromComp, toComp });
    }

    // Choose nearest CP on the "from" component
    const fromCenter = this._getComponentCenter(fromComp);
    const fromCP = this._getNearestConnectionPoint(fromComp, fromCenter.x, fromCenter.y);

    // Choose nearest CP on the "to" component
    const toCP = this._getNearestConnectionPoint(toComp, fromCP.x, fromCP.y);

    const id = `conn${this.nextConnectionId++}`;
    
    // ✅ Store normalized port names
    const connection = {
      id,
      from: fromId,
      to: toId,
      fromPoint: fromPortName || fromCP.id || fromCP.name || 'OUT',
      toPoint: toPortName || toCP.id || toCP.name || 'IN',
      // ✅ Full pipe reference for exporter
      pipeFrom: `${fromId}.${fromPortName || fromCP.id || fromCP.name || 'OUT'}`,
      pipeTo: `${toId}.${toPortName || toCP.id || toCP.name || 'IN'}`
    };
    
    this.connections.push(connection);
    this._renderConnection(connection);
    this._updateStats();

    this._cancelConnection();
    console.log(`✅ Connected ${fromComp.name}.${connection.fromPoint} → ${toComp.name}.${connection.toPoint}`);
  }

  _renderConnection(conn) {
    const fromComp = this.components.get(conn.from);
    const toComp = this.components.get(conn.to);

    const fromCP = this._resolveCP(fromComp, conn.fromPoint) || { x: fromComp.x, y: fromComp.y };
    const toCP = this._resolveCP(toComp, conn.toPoint) || { x: toComp.x, y: toComp.y };

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', conn.id);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${fromCP.x} ${fromCP.y} L ${toCP.x} ${toCP.y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#9bb0ff');
    path.setAttribute('stroke-width', '6');
    path.setAttribute('marker-end', 'url(#arrowhead)');

    g.appendChild(path);
    this.connectionsLayer.appendChild(g);
  }

  _updateConnectionPath(conn, pathEl) {
    const fromComp = this.components.get(conn.from);
    const toComp = this.components.get(conn.to);
    if (!fromComp || !toComp) return;
    const fromCP = this._resolveCP(fromComp, conn.fromPoint) || { x: fromComp.x, y: fromComp.y };
    const toCP = this._resolveCP(toComp, conn.toPoint) || { x: toComp.x, y: toComp.y };
    pathEl.setAttribute('d', `M ${fromCP.x} ${fromCP.y} L ${toCP.x} ${toCP.y}`);
  }

  /**
   * ✅ Map common aliases to canonical names (match exporter)
   */
  _normalizePortName(name) {
    if (!name) return name;
    const n = String(name).toLowerCase();
    if (['in', 'inlet', 'suction', 'p_in', 'pin'].includes(n)) return 'P_IN';
    if (['out', 'outlet', 'discharge', 'p_out', 'pout'].includes(n)) return 'P_OUT';
    return String(name).toUpperCase(); // keep other custom names uppercase
  }

  _resolveCP(comp, pointName) {
    // ✅ Normalize port name for consistent lookup
    const normalizedName = this._normalizePortName(pointName);
    
    const type = (comp.type || comp.key || '').toLowerCase();
    const lib = (this.componentLibrary?.components || {});
    const def = lib[type] || {};
    const offsets = def.connectionPoints || [];
    
    // Try to find by normalized name first, then original name
    const found = offsets.find(o => {
      const oName = this._normalizePortName(o.name || o.id);
      return oName === normalizedName || (o.name === pointName || o.id === pointName);
    });
    
    if (found) return { x: comp.x + (found.x || 0), y: comp.y + (found.y || 0) };
    return null;
  }

  _getMouseSVGPoint(evt) {
    const pt = this.canvas.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = this.canvas.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }

  _getComponentCenter(comp) {
    return { x: comp.x, y: comp.y };
  }

  _getNearestConnectionPoint(comp, tx, ty) {
    const type = (comp.type || comp.key || '').toLowerCase();
    const lib = (this.componentLibrary?.components || {});
    const def = lib[type] || {};
    let candidates = (def.connectionPoints || []).map(p => ({
      id: p.name || p.id,
      name: p.name || p.id,
      x: comp.x + (p.x || 0),
      y: comp.y + (p.y || 0)
    }));

    // Fallback if no library offsets
    if (!candidates.length) {
      const r = 30;
      if (['pump', 'valve', 'pipe'].includes(type)) {
        candidates = [
          { id: 'IN', name: 'IN', x: comp.x - r, y: comp.y },
          { id: 'OUT', name: 'OUT', x: comp.x + r, y: comp.y }
        ];
      } else if (type === 'tank') {
        candidates = [
          { id: 'IN', name: 'IN', x: comp.x, y: comp.y - r },
          { id: 'OUT', name: 'OUT', x: comp.x, y: comp.y + r }
        ];
      } else if (type === 'feed') {
        candidates = [{ id: 'OUT', name: 'OUT', x: comp.x + r, y: comp.y }];
      } else if (type === 'drain') {
        candidates = [{ id: 'IN', name: 'IN', x: comp.x - r, y: comp.y }];
      } else {
        candidates = [
          { id: 'LEFT', name: 'LEFT', x: comp.x - r, y: comp.y },
          { id: 'RIGHT', name: 'RIGHT', x: comp.x + r, y: comp.y },
          { id: 'TOP', name: 'TOP', x: comp.x, y: comp.y - r },
          { id: 'BOTTOM', name: 'BOTTOM', x: comp.x, y: comp.y + r }
        ];
      }
    }

    // Nearest by distance
    let best = candidates[0], bd = Infinity;
    for (const c of candidates) {
      const d = (c.x - tx) ** 2 + (c.y - ty) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _showHoverMarkers(comp) {
    this._clearHoverMarkers();
    const type = (comp.type || comp.key || '').toLowerCase();
    const lib = (this.componentLibrary?.components || {});
    const def = lib[type] || {};

    const offsets = def.connectionPoints || [];
    const candidates = offsets.length
      ? offsets.map(o => ({ x: comp.x + (o.x || 0), y: comp.y + (o.y || 0) }))
      : [
        { x: comp.x - 30, y: comp.y },
        { x: comp.x + 30, y: comp.y },
        { x: comp.x, y: comp.y - 30 },
        { x: comp.x, y: comp.y + 30 }
      ];

    candidates.forEach(p => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x);
      c.setAttribute('cy', p.y);
      c.setAttribute('r', '4');
      c.setAttribute('fill', '#7cc8ff');
      c.setAttribute('opacity', '0.8');
      this.hoverMarkerLayer.appendChild(c);
    });
  }

  _clearHoverMarkers() {
    while (this.hoverMarkerLayer.firstChild) this.hoverMarkerLayer.firstChild.remove();
  }

  _handleCanvasMouseMove(e) {
    if (!this.tempConnectionLine || !this.connectionStart) return;
    const pt = this._getMouseSVGPoint(e);
    const startComp = this.components.get(this.connectionStart);
    const startCp = this._getNearestConnectionPoint(startComp, pt.x, pt.y);
    this.tempConnectionLine.setAttribute('d', `M ${startCp.x} ${startCp.y} L ${pt.x} ${pt.y}`);
  }

  _setTool(tool) {
    this.tool = tool;
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tool}Tool`)?.classList.add('active');
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';
    console.log(`Tool changed to: ${tool}`);
  }

  _canOutput(comp) { return comp.type !== 'Drain'; }
  _canInput(comp) { return comp.type !== 'Feed'; }

  // ============================================================================
  // PROPERTIES PANEL
  // ============================================================================

  _updatePropertiesPanel(componentId) {
    const comp = this.components.get(componentId);
    if (!comp) return;
    
    const propertiesContent = document.getElementById('propertiesContent');
    if (!propertiesContent) return;
    
    propertiesContent.innerHTML = `
      <div class="properties-section">
        <h3>${comp.name}</h3>
        <div class="property-group">
          <label>Type:</label>
          <span>${comp.type}</span>
        </div>
        <div class="property-group">
          <label>ID:</label>
          <span>${comp.id}</span>
        </div>
        <div class="property-group">
          <label>Position:</label>
          <span>X: ${Math.round(comp.x)}, Y: ${Math.round(comp.y)}</span>
        </div>
        <div class="property-group">
          <label for="orientationSelect">Orientation:</label>
          <select id="orientationSelect" class="property-input">
            <option value="R" ${comp.orientation === 'R' ? 'selected' : ''}>Right (R)</option>
            <option value="D" ${comp.orientation === 'D' ? 'selected' : ''}>Down (D)</option>
            <option value="L" ${comp.orientation === 'L' ? 'selected' : ''}>Left (L)</option>
            <option value="U" ${comp.orientation === 'U' ? 'selected' : ''}>Up (U)</option>
          </select>
        </div>
        <div class="property-group">
          <label>Ports:</label>
          <ul style="font-size: 11px; color: #9bb0ff;">
            ${Object.entries(comp.ports || {}).map(([name, pos]) => 
              `<li>${name}: (${pos.x}, ${pos.y})</li>`
            ).join('')}
          </ul>
        </div>
        <div class="property-actions">
          <button id="deleteComponent" class="btn btn-danger" style="background:#ef4444;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;">Delete Component</button>
        </div>
      </div>
    `;
    
    // Wire up orientation change
    const orientationSelect = document.getElementById('orientationSelect');
    orientationSelect?.addEventListener('change', (e) => {
      this.changeComponentOrientation(componentId, e.target.value);
    });
    
    // Wire up delete
    document.getElementById('deleteComponent')?.addEventListener('click', () => {
      if (confirm(`Delete ${comp.name}?`)) {
        this._deleteComponent(componentId);
      }
    });
  }

  changeComponentOrientation(componentId, newOrientation) {
    const comp = this.components.get(componentId);
    if (!comp) return;
    
    const validOrientations = ['R', 'L', 'U', 'D'];
    if (!validOrientations.includes(newOrientation)) {
      console.warn(`Invalid orientation: ${newOrientation}`);
      return;
    }
    
    comp.orientation = newOrientation;
    
    // Re-render
    const node = this.componentsLayer.querySelector(`[data-id="${componentId}"]`);
    if (node) {
      const rotation = this._getOrientationRotation(newOrientation);
      node.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${rotation})`);
    }
    
    this._updateComponentConnections(componentId);
    console.log(`Changed ${comp.name} orientation to ${newOrientation}`);
  }

  // ============================================================================
  // IMPORT/EXPORT
  // ============================================================================

  importConfig(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.components || !data.connections) throw new Error('Invalid design file format');

      this.clearCanvas(false);

      if (data.metadata) {
        this.designMetadata = data.metadata;
        this.designMetadata.modified = new Date().toISOString();
      }

      for (const compData of data.components) {
        this.components.set(compData.id, compData);
        this._renderComponent(compData);
      }

      for (const conn of data.connections) {
        this.connections.push({ ...conn });
        this._renderConnection(conn);
      }

      this._updateStats();
      console.log('✅ Design imported');
    } catch (e) {
      alert('Failed to import design: ' + e.message);
    }
  }

  /**
   * ✅ FIXED: Export design JSON with all required fields
   */
  exportDesignJSON() {
    const config = {
      metadata: {
        version: DESIGNER_VERSION,
        created: this.designMetadata.created,
        modified: new Date().toISOString(),
        name: this.getSimulatorName()
      },
      components: Array.from(this.components.values()).map(c => ({
        id: c.id,
        key: c.key,
        type: c.type,
        name: c.name,
        x: c.x,
        y: c.y,
        orientation: c.orientation,
        ports: c.ports,
        config: c.config || {}
      })),
      connections: this.connections.map(conn => ({
        id: conn.id,
        from: conn.from,
        to: conn.to,
        fromPoint: conn.fromPoint,
        toPoint: conn.toPoint,
        // ✅ Include full pipe reference
        pipeFrom: conn.pipeFrom || `${conn.from}.${conn.fromPoint}`,
        pipeTo: conn.pipeTo || `${conn.to}.${conn.toPoint}`
      })),
      nextId: this.nextId,
      nextConnectionId: this.nextConnectionId,
      gridSize: this.gridSize
    };
    return JSON.stringify(config, null, 2);
  }

  _validateDesignSoft() {
    const warnings = [];

    if (this.components.size === 0) {
      warnings.push('No components in design');
    }
    const hasSource = Array.from(this.components.values()).some(c => c.type === 'Feed');
    const hasSink = Array.from(this.components.values()).some(c => c.type === 'Drain');
    if (!hasSource) warnings.push('No feed source in design');
    if (!hasSink) warnings.push('No drain sink in design');

    const disconnected = [];
    const connectedIds = new Set();
    for (const c of this.connections) { connectedIds.add(c.from); connectedIds.add(c.to); }
    for (const [id, comp] of this.components) {
      if (!connectedIds.has(id) && this.connections.length > 0) { disconnected.push(comp.name || id); }
    }
    if (disconnected.length) warnings.push('Disconnected: ' + disconnected.join(', '));

    return { warnings };
  }

  clearCanvas(resetCounters = false) {
    while (this.componentsLayer.firstChild) this.componentsLayer.firstChild.remove();
    while (this.connectionsLayer.firstChild) this.connectionsLayer.firstChild.remove();
    this._clearHoverMarkers();

    this.components.clear();
    this.connections = [];

    if (resetCounters) {
      this.nextId = 1;
      this.nextConnectionId = 1;
    }

    this._updateStats();
  }

  _updateStats() {
    const compCount = byId('componentCount');
    const connCount = byId('connectionCount');
    if (compCount) compCount.textContent = `Components: ${this.components.size}`;
    if (connCount) connCount.textContent = `Connections: ${this.connections.length}`;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getSimulatorName() { return (this.designMetadata?.name || 'My Simulator'); }
  
  setSimulatorName(name) {
    if (!name) return;
    this.designMetadata.name = name;
    this.designMetadata.modified = new Date().toISOString();
  }
  
  getConfiguration() { return JSON.parse(this.exportDesignJSON()); }
  
  loadConfiguration(cfg) { this.importConfig(cfg); }

  // Palette helpers
  _onPaletteDragStart(e, item) {
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.designer = new ProcessDesigner();
  window.DESIGNER = window.designer; // Alias for exporter
  console.log(`✅ Designer v${DESIGNER_VERSION} ready!`);
});
