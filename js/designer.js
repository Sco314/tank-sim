/**
 * designer.js - Process Designer v2.0 (with connection points + exporter delegation)
 *
 * - Connection points: nearest CP snap, hover markers, ports stored in connections
 * - Delegates all exporting to exporter.js (SimulatorExporter)
 * - Renders components via SVG <symbol> (preferred) or image fallback
 * - Drag to move components (updates connected pipes live)
 */

const DESIGNER_VERSION = '2.0.2';

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
    this._ensureDefs(); // also loads SVG symbols into <defs>
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

    // 🔹 Load component SVG symbols into <defs> (once per type)
    const lib = this.componentLibrary?.components || {};
    for (const [type, def] of Object.entries(lib)) {
      const symbolId = `symbol-${type}`;
      if (def.symbol && !document.getElementById(symbolId)) {
        const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
        symbol.setAttribute('id', symbolId);
        symbol.setAttribute('viewBox', def.symbolViewBox || '0 0 60 60');
        symbol.innerHTML = def.symbol; // trusted library string
        defs.appendChild(symbol);
      }
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

  // =====================
  // MERGED LISTENERS (from setup_listeners_fixed.js)
  // =====================
  _setupEventListeners() {
    // ============================================================================
    // DRAG & DROP SUPPORT FOR CANVAS (CRITICAL)
    // ============================================================================
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      
      // Get the dragged item data
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) {
        console.warn('No data in drop event');
        return;
      }
      
      let item;
      try {
        item = JSON.parse(dataStr);
      } catch (err) {
        console.error('Failed to parse dropped data:', err);
        return;
      }
      
      // Convert mouse position to SVG coordinates
      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
      const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;
      
      // Apply grid snapping if enabled
      const snapToggle = byId('snapToggle');
      const snapToGrid = snapToggle ? snapToggle.checked : false;
      
      const finalX = snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x;
      const finalY = snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y;
      
      // Add the component at the drop position
      this._addFromPalette(item, { x: finalX, y: finalY });
      
      console.log(`✅ Dropped ${item.label} at (${finalX}, ${finalY})`);
    });

    // ============================================================================
    // CANVAS INTERACTIONS
    // ============================================================================
    this.canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
    this.canvas.addEventListener('mousemove', (e) => this._handleCanvasMouseMove(e));

    // ============================================================================
    // TOOLBAR BUTTONS
    // ============================================================================
    byId('selectTool')?.addEventListener('click', () => this._setTool('select'));
    byId('connectTool')?.addEventListener('click', () => this._setTool('connect'));

    // ============================================================================
    // EXPORT BUTTONS
    // ============================================================================
    
    // Primary export button(s)
    byId('exportBtn')?.addEventListener('click', (e) => this._onExportClicked(e));
    byId('exportBtn2')?.addEventListener('click', (e) => this._onExportClicked(e));

    // Export modal wiring
    const exportModal = byId('exportModal');
    const exportModalClose = byId('exportModalClose');
    const exportConfirmBtn = byId('exportConfirmBtn');
    const exportCancelBtn = byId('exportCancelBtn');
    const simNameInput = byId('simName');

    const closeExportModal = () => {
      if (exportModal) {
        exportModal.classList.remove('open');
        exportModal.style.display = 'none';
      }
    };

    const doDirectExport = () => {
      const name = (simNameInput?.value?.trim()) || prompt('Enter simulator name:', this.getSimulatorName());
      if (!name) return;
      this._ensureExporter(() => {
        try {
          const exporter = new SimulatorExporter(this);
          exporter.exportSimulator(name);
        } catch (err) {
          console.error('Export failed:', err);
          alert('Export failed: ' + err.message);
        }
      });
    };

    exportConfirmBtn?.addEventListener('click', () => { 
      doDirectExport(); 
      closeExportModal(); 
    });
    
    exportModal?.addEventListener('click', (e) => { 
      if (e.target === exportModal) closeExportModal(); 
    });
    
    exportModalClose?.addEventListener('click', closeExportModal);
    exportCancelBtn?.addEventListener('click', closeExportModal);

    // Single-file export
    byId('exportSingleFile')?.addEventListener('click', () => {
      const name = this.getSimulatorName();
      this._ensureExporter(() => {
        try {
          const exporter = new SimulatorExporter(this);
          exporter.exportSimulator(name);
        } catch (err) {
          console.error('Single-file export failed:', err);
          alert('Export failed: ' + err.message);
        }
      });
    });

    // ZIP export
    byId('exportZip')?.addEventListener('click', () => {
      const name = this.getSimulatorName();
      this._ensureExporter(() => {
        try {
          const exporter = new SimulatorExporter(this);
          if (typeof exporter.exportAsZip === 'function') {
            exporter.exportAsZip(name);
          } else {
            alert('ZIP export requires exporter.js support. Please update exporter.js.');
          }
        } catch (err) {
          console.error('ZIP export failed:', err);
          alert('Export failed: ' + err.message);
        }
      });
    });

    // ============================================================================
    // OTHER UI CONTROLS
    // ============================================================================
    
    // Import button
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

    // Save design button
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

    // Clear button
    byId('clearBtn')?.addEventListener('click', () => {
      if (confirm('Clear all components? This cannot be undone.')) {
        this.clearCanvas(true);
      }
    });

    // Preview button
    byId('previewBtn')?.addEventListener('click', () => {
      alert(`Design Preview:\n\nComponents: ${this.components.size}\nConnections: ${this.connections.length}`);
    });

    // Grid toggle
    byId('gridToggle')?.addEventListener('change', (e) => {
      const gridRect = byId('gridRect');
      if (gridRect) {
        gridRect.style.opacity = e.target.checked ? '0.4' : '0';
      }
    });

    // Snap toggle (already handled in drop handler)
    byId('snapToggle')?.addEventListener('change', (e) => {
      console.log('Grid snapping:', e.target.checked ? 'ON' : 'OFF');
    });

    // ============================================================================
    // GLOBAL CLEANUP
    // ============================================================================
    
    // Dragging end on window mouseup (cleanup)
    window.addEventListener('mouseup', () => { 
      this._dragState = null; 
    });

    console.log('✅ Event listeners set up (including drag & drop)');
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Delete selected component
      if (e.key === 'Delete' && this.selectedComponent) {
        this._deleteComponent(this.selectedComponent);
      }
    });
  }

  _ensureExporter(cb) {
    if (window.SimulatorExporter) return cb();
    console.log('Loading exporter.js...');
    const script = document.createElement('script');
    script.src = './exporter.js';
    script.onload = () => { console.log('✅ exporter.js loaded'); cb(); };
    script.onerror = () => alert('Failed to load exporter.js');
    document.head.appendChild(script);
  }

  _onExportClicked(e) {
    e?.preventDefault?.();

    const validation = this._validateDesignSoft();
    const modal = byId('exportModal');
    const simNameInput = byId('simName');
    const compCount = byId('compCount');
    const connCount = byId('connCount');

    if (!modal) {
      // Direct export path with warnings gate
      if (validation.warnings.length > 0) {
        const proceed = confirm(`⚠️ Warnings:\n\n${validation.warnings.join('\n')}\n\nProceed with export?`);
        if (!proceed) return;
      }

      if (e?.shiftKey) {
        const name = prompt('Enter simulator name:', this.getSimulatorName());
        if (!name) return;
        this._ensureExporter(() => {
          try {
            const exporter = new SimulatorExporter(this);
            exporter.exportSimulator(name);
          } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err.message);
          }
        });
        return;
      }

      this._proceedWithExport();
      return;
    }

    // Modal path
    if (simNameInput) simNameInput.value = this.getSimulatorName();
    if (compCount) compCount.textContent = this.components.size;
    if (connCount) connCount.textContent = this.connections.length;

    const warningsEl = byId('exportWarnings');
    if (warningsEl) warningsEl.textContent = validation.warnings.join('\n');

    modal.classList.add('open');
    if (simNameInput) {
      setTimeout(() => { simNameInput?.select(); simNameInput?.focus(); }, 100);
    } else {
      const name = prompt('Enter simulator name:', this.getSimulatorName());
      if (name) {
        this._ensureExporter(() => {
          const exporter = new SimulatorExporter(this);
          exporter.exportSimulator(name);
        });
      }
    }
  }

  _proceedWithExport() {
    const name = this.getSimulatorName();
    this._ensureExporter(() => {
      try {
        const exporter = new SimulatorExporter(this);
        exporter.exportSimulator(name);
      } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed: ' + err.message);
      }
    });
  }

  // -----------------------------
  // Import/Export design JSON
  // -----------------------------
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

      console.log('✅ Design imported');
    } catch (e) {
      alert('Failed to import design: ' + e.message);
    }
  }

  exportDesignJSON() {
    const config = {
      metadata: {
        version: DESIGNER_VERSION,
        created: this.designMetadata.created,
        modified: new Date().toISOString(),
        name: this.getSimulatorName()
      },
      components: Array.from(this.components.values()),
      connections: this.connections.map(c => ({ ...c })),
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
    const hasSource = Array.from(this.components.values()).some(c => c.type === 'feed');
    const hasSink   = Array.from(this.components.values()).some(c => c.type === 'drain');
    if (!hasSource) warnings.push('No feed source in design');
    if (!hasSink)   warnings.push('No drain sink in design');

    const disconnected = [];
    const connectedIds = new Set();
    for (const c of this.connections) { connectedIds.add(c.from); connectedIds.add(c.to); }
    for (const [id, comp] of this.components) {
      if (!connectedIds.has(id) && this.connections.length > 0) { disconnected.push(comp.name || id); }
    }
    if (disconnected.length) warnings.push('Disconnected: ' + disconnected.join(', '));

    return { warnings };
  }

  // ------------- Basic getters/setters -------------
  getSimulatorName() { return (this.designMetadata?.name || 'My Simulator'); }
  setSimulatorName(name) {
    if (!name) return;
    this.designMetadata.name = name;
    this.designMetadata.modified = new Date().toISOString();
  }
  getConfiguration() { return JSON.parse(this.exportDesignJSON()); }
  loadConfiguration(cfg) { this.importConfig(cfg); }

  // Deprecated: keep name for API compatibility; always delegates to exporter
  exportAsSingleFile() {
    const simName = this.getSimulatorName();
    this._ensureExporter(() => {
      try {
        const exporter = new SimulatorExporter(this);
        exporter.exportSimulator(simName);
      } catch (e) {
        console.error('Export failed:', e);
        alert('Export failed: ' + e.message);
      }
    });
  }

  // ---------- Canvas interactions ----------
  _handleCanvasClick(e) {
    const target = e.target.closest('.canvas-component');
    if (!target) { this._cancelConnection(); return; }

    const componentId = target.dataset.id;
    const component = this.components.get(componentId);
    this.selectedComponent = componentId;

    if (this.tool === 'select') return; // selection only

    if (!this.connectionStart) {
      if (!this._canOutput(component)) { alert(`${component.name} cannot have outputs (it's a ${component.type})`); return; }
      this._startConnection(componentId);
    } else {
      if (!this._canInput(component)) { alert(`${component.name} cannot have inputs (it's a ${component.type})`); this._cancelConnection(); return; }
      if (componentId === this.connectionStart) { alert('Cannot connect component to itself'); this._cancelConnection(); return; }
      this._completeConnection(componentId);
    }
  }

  // Deprecated (unused): kept as a no-op to avoid breakage
  _handleConnectionClick(e) {
    // Intentionally left empty — logic handled in _handleCanvasClick
  }

  _startConnection(componentId) {
    this.connectionStart = componentId;
    this.tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempConnectionLine.setAttribute('stroke', '#4f46e5');
    this.tempConnectionLine.setAttribute('stroke-width', '3');
    this.tempConnectionLine.setAttribute('fill', 'none');
    this.tempConnectionLine.setAttribute('stroke-dasharray', '5,5');

    this.connectionsLayer.appendChild(this.tempConnectionLine);
    this.canvas.addEventListener('mousemove', this._updateTempConnection = (e) => {
      const pt = this._getMouseSVGPoint(e);
      const startComp = this.components.get(this.connectionStart);
      const startCp = this._getNearestConnectionPoint(startComp, pt.x, pt.y);
      this.tempConnectionLine.setAttribute('d', `M ${startCp.x} ${startCp.y} L ${pt.x} ${pt.y}`);
    }, { passive: true });

    console.log(`Connection started from ${this.components.get(componentId).name}`);
  }

  _cancelConnection() {
    if (this.tempConnectionLine) {
      this.tempConnectionLine.remove();
      this.tempConnectionLine = null;
      this.canvas.removeEventListener('mousemove', this._updateTempConnection);
    }
    this.connectionStart = null;
  }

  _completeConnection(targetComponentId) {
    const fromId = this.connectionStart;
    const toId = targetComponentId;
    const fromComp = this.components.get(fromId);
    const toComp   = this.components.get(toId);

    // choose nearest CP on the "from" component
    const fromCenter = this._getComponentCenter(fromComp);
    const fromCP = this._getNearestConnectionPoint(fromComp, fromCenter.x, fromCenter.y);

    // choose nearest CP on the "to" component relative to the "from" CP
    const toCP = this._getNearestConnectionPoint(toComp, fromCP.x, fromCP.y);

    const id = `conn${this.nextConnectionId++}`;
    const connection = {
      id,
      from: fromId,
      to: toId,
      fromPoint: fromCP.id || fromCP.name || 'outlet',
      toPoint:   toCP.id   || toCP.name   || 'inlet'
    };
    this.connections.push(connection);
    this._renderConnection(connection);

    this._cancelConnection();
    console.log(`Connected ${fromComp.name} → ${toComp.name} `);
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
      x: comp.x + (p.x || 0),
      y: comp.y + (p.y || 0)
    }));

    // Typed fallback if library has no offsets
    if (!candidates.length) {
      const r = 30;
      if (['pump','valve','pipe'].includes(type)) {
        candidates = [
          { id: 'inlet',  x: comp.x - r, y: comp.y },
          { id: 'outlet', x: comp.x + r, y: comp.y }
        ];
      } else if (type === 'tank') {
        candidates = [
          { id: 'inlet',  x: comp.x, y: comp.y - r },
          { id: 'outlet', x: comp.x, y: comp.y + r }
        ];
      } else if (type === 'feed') {
        candidates = [{ id: 'outlet', x: comp.x + r, y: comp.y }];
      } else if (type === 'drain') {
        candidates = [{ id: 'inlet', x: comp.x - r, y: comp.y }];
      } else {
        candidates = [
          { id: 'left',   x: comp.x - r, y: comp.y },
          { id: 'right',  x: comp.x + r, y: comp.y },
          { id: 'top',    x: comp.x,     y: comp.y - r },
          { id: 'bottom', x: comp.x,     y: comp.y + r }
        ];
      }
    }

    // Nearest by squared distance
    let best = candidates[0], bd = Infinity;
    for (const c of candidates) {
      const d = (c.x - tx) ** 2 + (c.y - ty) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _renderComponent(comp) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('canvas-component');
    g.dataset.id = comp.id;
    g.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);

    const type = (comp.type || comp.key || '').toLowerCase();
    const symbolId = `symbol-${type}`;
    const symbolEl = document.getElementById(symbolId);

    if (symbolEl) {
      // Preferred: reuse symbol
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${symbolId}`);
      use.setAttribute('width', '60');
      use.setAttribute('height', '60');
      use.setAttribute('x', '-30');
      use.setAttribute('y', '-30');
      g.appendChild(use);
    } else {
      // PNG fallback from library (if available)
      const lib = this.componentLibrary?.components || {};
      const def = lib[type] || {};
      if (def.image) {
        const size = def.imageSize || { w: 60, h: 60, x: -30, y: -30 };
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', def.image);
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

    // Label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.textContent = comp.name || comp.type;
    label.setAttribute('x', '0');
    label.setAttribute('y', '-40');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#9bb0ff');
    g.appendChild(label);

    // Hover markers for CPs
    g.addEventListener('mouseenter', () => this._showHoverMarkers(comp));
    g.addEventListener('mouseleave', () => this._clearHoverMarkers());

    // Drag to move (in select tool)
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
      node?.setAttribute('transform', `translate(${c.x}, ${c.y})`);
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

  _renderConnection(conn) {
    const fromComp = this.components.get(conn.from);
    const toComp   = this.components.get(conn.to);

    const fromCP = this._resolveCP(fromComp, conn.fromPoint) || { x: fromComp.x, y: fromComp.y };
    const toCP   = this._resolveCP(toComp,   conn.toPoint)   || { x: toComp.x,   y: toComp.y };

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
    const toComp   = this.components.get(conn.to);
    if (!fromComp || !toComp) return;
    const fromCP = this._resolveCP(fromComp, conn.fromPoint) || { x: fromComp.x, y: fromComp.y };
    const toCP   = this._resolveCP(toComp,   conn.toPoint)   || { x: toComp.x,   y: toComp.y };
    pathEl.setAttribute('d', `M ${fromCP.x} ${fromCP.y} L ${toCP.x} ${toCP.y}`);
  }

  _resolveCP(comp, pointName) {
    const type = (comp.type || comp.key || '').toLowerCase();
    const lib = (this.componentLibrary?.components || {});
    const def = lib[type] || {};
    const offsets = def.connectionPoints || [];
    const found = offsets.find(o => (o.name === pointName || o.id === pointName));
    if (found) return { x: comp.x + (found.x || 0), y: comp.y + (found.y || 0) };
    return null;
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
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tool}Tool`)?.classList.add('active');
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';
    console.log(`Tool changed to: ${tool}`);
  }

  _canOutput(comp) { return comp.type !== 'drain'; }
  _canInput(comp)  { return comp.type !== 'feed'; }

  clearCanvas(resetCounters = false) {
    // remove components
    while (this.componentsLayer.firstChild) this.componentsLayer.firstChild.remove();
    // remove connections
    while (this.connectionsLayer.firstChild) this.connectionsLayer.firstChild.remove();
    // clear hover markers
    this._clearHoverMarkers();

    this.components.clear();
    this.connections = [];

    if (resetCounters) {
      this.nextId = 1;
      this.nextConnectionId = 1;
    }
  }

  // ------------- Palette & adding components -------------
  _onPaletteDragStart(e, item) {
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
  }

  _addFromPalette(item, pos) {
    const id = String(this.nextId++);
    const comp = {
      id,
      key: item.key,
      type: item.type,
      name: item.label || item.type,
      x: pos.x,
      y: pos.y,
      config: {}
    };
    this.components.set(id, comp);
    this._renderComponent(comp);

    console.log(`Added ${comp.name} at (${pos.x}, ${pos.y})`);
  }

  // -------- Legacy builder helpers (unused after delegation to exporter) --------
  buildHTMLTemplate() { /* unused; kept for reference */ }
  prepareValveInline(valveHtml) {
    const styleMatch = valveHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch  = valveHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const styles     = styleMatch ? styleMatch[1] : '';
    const body       = bodyMatch  ? bodyMatch[1]  : valveHtml;
    return `<style>${styles}<\/style>\n${body}`;
  }
  getAllJSPaths() { return []; }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.designer = new ProcessDesigner();  // ✅ Create global instance
  console.log(`✅ Designer v${DESIGNER_VERSION} ready!`);
});
