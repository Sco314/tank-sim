/**
 * designer.js - Process Designer v2.0
 * 
 * Features:
 * - UI health validation
 * - Pre-export validation
 * - Import/load functionality  
 * - Preview mode
 * - Disconnected component warnings
 * - Export versioning
 */

const DESIGNER_VERSION = '2.0.0';

// === Shared component sprites ===
const SPRITES = {
  tank:  { href: "https://sco314.github.io/tank-sim/Tank-Icon-Transparent-bg.png",   w: 160, h: 180, x: -80, y: -90,  labelDy: -100 },
  pump:  { href: "https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png",    w: 120, h: 120, x: -60, y: -60,  labelDy: -70  },
  valve: { href: "https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png",  w: 76,  h: 76,  x: -38, y: -38,  labelDy: -50  },
  default: { href: "https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png", w: 76, h: 76, x: -38, y: -38, labelDy: -50 }
};

// Preload sprites
Object.values(SPRITES).forEach(sprite => {
  if (!sprite || !sprite.href) return;
  const img = new Image();
  img.src = sprite.href;
});

class ProcessDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.componentsLayer = document.getElementById('componentsLayer');
    this.connectionsLayer = document.getElementById('connectionsLayer');
    this.gridRect = document.getElementById('gridRect');

    this.components = new Map();
    this.connections = [];
    this.selectedComponent = null;
    this.nextId = 1;
    this.nextConnectionId = 1;

    this.gridSize = 20;
    this.snapToGrid = true;

    this.currentTool = 'select';
    this.connectionStart = null;
    this.tempConnectionLine = null;

    // Metadata
    this.designMetadata = {
      version: DESIGNER_VERSION,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      name: 'Untitled Design'
    };

    this._initializeLibrary();
    this._setupSearch();
    this._validateUI();  // ← NEW: UI health check
    this._setupEventListeners();
    this._updateStats();

    console.log(`Process Designer v${DESIGNER_VERSION} initialized`);
  }

  /**
   * Validate UI elements exist (NEW)
   */
  _validateUI() {
    const critical = ['canvas', 'componentsLayer', 'connectionsLayer', 'gridRect'];
    const missing = critical.filter(id => !document.getElementById(id));
    
    // Check for at least one export button
    const hasExportBtn = ['exportBtn', 'exportSimBtn', 'exportSim']
      .some(id => document.getElementById(id));
    
    if (!hasExportBtn) {
      missing.push('exportBtn (or exportSimBtn/exportSim)');
    }
    
    if (missing.length) {
      console.warn('⚠️ Designer UI missing elements:', missing.join(', '));
      console.warn('   This may cause degraded functionality. Check designer.html.');
    }
    
    return missing.length === 0;
  }

  /**
   * Validate design before export (NEW)
   */
  _validateDesign() {
    const issues = [];
    const warnings = [];
    
    // Check for components
    if (this.components.size === 0) {
      issues.push('No components in design');
      return { valid: false, issues, warnings };
    }
    
    // Check for disconnected components
    const disconnected = this._findDisconnectedComponents();
    if (disconnected.length > 0) {
      warnings.push(`${disconnected.length} disconnected component(s): ${disconnected.map(c => c.name).join(', ')}`);
    }
    
    // Check for feeds and drains
    const hasFeed = Array.from(this.components.values()).some(c => c.type === 'feed');
    const hasDrain = Array.from(this.components.values()).some(c => c.type === 'drain');
    
    if (!hasFeed) {
      warnings.push('No feed (source) component - fluid has no source');
    }
    if (!hasDrain) {
      warnings.push('No drain (sink) component - fluid has no outlet');
    }
    
    // Validate component properties
    for (const comp of this.components.values()) {
      const propIssues = this._validateComponentProperties(comp);
      issues.push(...propIssues);
    }
    
    // Check for circular dependencies (simple check)
    const circular = this._detectCircularDependencies();
    if (circular.length > 0) {
      warnings.push(`Possible circular dependencies detected: ${circular.join(' → ')}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Find disconnected components (NEW)
   */
  _findDisconnectedComponents() {
    const disconnected = [];
    
    for (const comp of this.components.values()) {
      const hasInput = comp.config.inputs && comp.config.inputs.length > 0;
      const hasOutput = comp.config.outputs && comp.config.outputs.length > 0;
      
      // Feed must have output, drain must have input
      if (comp.type === 'feed' && !hasOutput) {
        disconnected.push(comp);
      } else if (comp.type === 'drain' && !hasInput) {
        disconnected.push(comp);
      } else if (comp.type !== 'feed' && comp.type !== 'drain' && !hasInput && !hasOutput) {
        disconnected.push(comp);
      }
    }
    
    return disconnected;
  }

  /**
   * Validate component properties (NEW)
   */
  _validateComponentProperties(comp) {
    const issues = [];
    const config = comp.config;
    
    // Check for negative values where they shouldn't be
    if (config.capacity !== undefined && config.capacity < 0) {
      issues.push(`${comp.name}: capacity cannot be negative (${config.capacity})`);
    }
    if (config.efficiency !== undefined && (config.efficiency < 0 || config.efficiency > 1)) {
      issues.push(`${comp.name}: efficiency must be 0-1 (got ${config.efficiency})`);
    }
    if (config.volume !== undefined && config.volume < 0) {
      issues.push(`${comp.name}: volume cannot be negative (${config.volume})`);
    }
    if (config.maxFlow !== undefined && config.maxFlow < 0) {
      issues.push(`${comp.name}: maxFlow cannot be negative (${config.maxFlow})`);
    }
    
    // Check for null/undefined required properties
    const template = COMPONENT_LIBRARY[comp.key];
    if (template && template.properties) {
      template.properties.forEach(prop => {
        if (prop.required && (config[prop.name] === null || config[prop.name] === undefined)) {
          issues.push(`${comp.name}: missing required property '${prop.label}'`);
        }
      });
    }
    
    return issues;
  }

  /**
   * Detect circular dependencies (NEW)
   */
  _detectCircularDependencies() {
    // Simple cycle detection - could be more sophisticated
    const visited = new Set();
    const path = [];
    const cycles = [];
    
    const dfs = (compId) => {
      if (path.includes(compId)) {
        const cycleStart = path.indexOf(compId);
        const cycle = path.slice(cycleStart).concat(compId);
        cycles.push(cycle.map(id => this.components.get(id)?.name || id));
        return;
      }
      
      if (visited.has(compId)) return;
      
      visited.add(compId);
      path.push(compId);
      
      const comp = this.components.get(compId);
      if (comp && comp.config.outputs) {
        comp.config.outputs.forEach(outputId => dfs(outputId));
      }
      
      path.pop();
    };
    
    for (const compId of this.components.keys()) {
      dfs(compId);
    }
    
    return cycles;
  }

  /**
   * Show validation report modal (NEW)
   */
  _showValidationReport(validation) {
    const modal = document.createElement('div');
    modal.className = 'validation-modal';
    modal.innerHTML = `
      <div class="validation-modal-content">
        <h2>🔍 Design Validation Report</h2>
        
        ${validation.valid 
          ? '<div class="validation-success">✅ No critical issues found</div>'
          : '<div class="validation-error">❌ Critical issues found - fix before export</div>'
        }
        
        ${validation.issues.length > 0 ? `
          <div class="validation-section">
            <h3>❌ Issues (Must Fix)</h3>
            <ul>
              ${validation.issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${validation.warnings.length > 0 ? `
          <div class="validation-section">
            <h3>⚠️ Warnings (Should Review)</h3>
            <ul>
              ${validation.warnings.map(warn => `<li>${warn}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="validation-actions">
          <button class="btn" id="validationClose">Close</button>
          ${validation.valid ? '<button class="btn btn-primary" id="validationProceed">Proceed to Export</button>' : ''}
        </div>
      </div>
    `;
    
    // Style
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = modal.querySelector('.validation-modal-content');
    content.style.cssText = `
      background: #0b1330;
      border: 2px solid #4f46e5;
      border-radius: 16px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: #e9f0ff;
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#validationClose').addEventListener('click', () => modal.remove());
    
    const proceedBtn = modal.querySelector('#validationProceed');
    if (proceedBtn) {
      proceedBtn.addEventListener('click', () => {
        modal.remove();
        this._proceedWithExport();
      });
    }
  }

  /**
   * Proceed with export after validation (NEW)
   */
  _proceedWithExport() {
    const exportModal = document.getElementById('exportModal');
    const simNameInput = document.getElementById('simNameInput');
    
    if (exportModal) {
      exportModal.style.display = 'flex';
      requestAnimationFrame(() => exportModal.classList.add('open'));
      setTimeout(() => {
        simNameInput?.select();
        simNameInput?.focus();
      }, 100);
    } else {
      // Direct export
      const name = prompt('Enter simulator name:', 'My Simulator');
      if (name) {
        this._ensureExporter(() => {
          const exporter = new SimulatorExporter(this);
          exporter.exportSimulator(name);
        });
      }
    }
  }

  /**
   * Import design from JSON (NEW)
   */
  importConfig(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // Validate format
      if (!data.components || !data.connections) {
        throw new Error('Invalid design file format');
      }
      
      // Clear existing design
      this.clearCanvas(false); // Don't confirm
      
      // Import metadata
      if (data.metadata) {
        this.designMetadata = data.metadata;
        this.designMetadata.modified = new Date().toISOString();
      }
      
      // Import components
      for (const compData of data.components) {
        this.components.set(compData.id, compData);
        this._renderComponent(compData);
      }
      
      // Import connections
      this.connections = data.connections;
      this.connections.forEach(conn => this._renderConnection(conn));
      
      // Restore next IDs
      this.nextId = data.nextId || this.components.size + 1;
      this.nextConnectionId = data.nextConnectionId || this.connections.length + 1;
      
      this._updateStats();
      console.log('✅ Design imported successfully');
      alert(`✅ Imported: ${this.designMetadata.name}\n\nComponents: ${this.components.size}\nConnections: ${this.connections.length}`);
      
    } catch (err) {
      console.error('Import failed:', err);
      alert('❌ Import failed: ' + err.message);
    }
  }

  /**
   * Export design as JSON for re-import (NEW)
   */
  exportDesignJSON() {
    const design = {
      metadata: {
        ...this.designMetadata,
        exported: new Date().toISOString()
      },
      components: Array.from(this.components.values()),
      connections: this.connections,
      nextId: this.nextId,
      nextConnectionId: this.nextConnectionId,
      gridSize: this.gridSize,
      viewBox: {
        width: this.canvas.viewBox.baseVal.width,
        height: this.canvas.viewBox.baseVal.height
      }
    };
    
    return JSON.stringify(design, null, 2);
  }

  /**
   * Show preview of design (NEW)
   */
  _showPreview() {
    // Generate preview HTML
    const validation = this._validateDesign();
    
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <div class="preview-modal-content">
        <button class="preview-close" id="previewClose">×</button>
        <h2>📋 Design Preview</h2>
        
        <div class="preview-info">
          <div class="preview-stat">
            <strong>Components:</strong> ${this.components.size}
          </div>
          <div class="preview-stat">
            <strong>Connections:</strong> ${this.connections.length}
          </div>
          <div class="preview-stat">
            <strong>Status:</strong> ${validation.valid ? '✅ Valid' : '❌ Has Issues'}
          </div>
        </div>
        
        <div class="preview-canvas-container">
          ${this.canvas.outerHTML}
        </div>
        
        <div class="preview-actions">
          <button class="btn" id="previewValidate">Run Validation</button>
          <button class="btn btn-primary" id="previewExport">Export This Design</button>
        </div>
      </div>
    `;
    
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;
    
    const content = modal.querySelector('.preview-modal-content');
    content.style.cssText = `
      background: #0b1330;
      border: 2px solid #4f46e5;
      border-radius: 16px;
      padding: 24px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      color: #e9f0ff;
      position: relative;
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#previewClose').addEventListener('click', () => modal.remove());
    modal.querySelector('#previewValidate').addEventListener('click', () => {
      modal.remove();
      this._showValidationReport(this._validateDesign());
    });
    modal.querySelector('#previewExport').addEventListener('click', () => {
      modal.remove();
      this._showValidationReport(this._validateDesign());
    });
  }

  /**
   * Initialize component library
   */
  _initializeLibrary() {
    const libraryContent = document.getElementById('libraryContent');

    if (!window.COMPONENT_LIBRARY || !window.CATEGORIES) {
      console.error('❌ Component library not loaded!');
      libraryContent.innerHTML = '<p style="color: red; padding: 16px;">Error: Component library failed to load.</p>';
      return;
    }

    console.log('✅ Component library loaded:', Object.keys(COMPONENT_LIBRARY).length, 'components');

    const categorized = {};
    for (const [key, component] of Object.entries(COMPONENT_LIBRARY)) {
      const category = component.category;
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push({ key, ...component });
    }

    for (const [categoryKey, categoryInfo] of Object.entries(CATEGORIES)) {
      if (!categorized[categoryKey]) continue;

      const categoryEl = document.createElement('div');
      categoryEl.className = 'component-category';
      categoryEl.innerHTML = `
        <div class="category-header" data-category="${categoryKey}">
          <span class="category-icon">${categoryInfo.icon}</span>
          <span class="category-name">${categoryInfo.name}</span>
          <span class="category-toggle">▼</span>
        </div>
        <div class="category-items" data-category="${categoryKey}">
          ${categorized[categoryKey].map(comp => `
            <div class="component-item" draggable="true" data-component="${comp.key}">
              <div class="component-icon">${comp.icon}</div>
              <div class="component-info">
                <span class="component-name">${comp.name}</span>
                <span class="component-desc">${comp.description}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      libraryContent.appendChild(categoryEl);
    }

    libraryContent.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const category = header.dataset.category;
        const items = libraryContent.querySelector(`.category-items[data-category="${category}"]`);
        items.classList.toggle('collapsed');
        header.querySelector('.category-toggle').textContent = items.classList.contains('collapsed') ? '▶' : '▼';
      });
    });

    libraryContent.querySelectorAll('.component-item').forEach(item => {
      item.addEventListener('dragstart', (e) => this._onDragStart(e));
    });

    // Replace text icons with images
    libraryContent.querySelectorAll('.component-item').forEach(item => {
      const key = item.dataset.component;
      const template = window.COMPONENT_LIBRARY && window.COMPONENT_LIBRARY[key];
      if (!template) return;
      
      const type = template.defaultConfig && template.defaultConfig.type;
      const sprite = (SPRITES && SPRITES[type]) || SPRITES.default;
      const iconDiv = item.querySelector('.component-icon');
      
      if (iconDiv && sprite && sprite.href) {
        iconDiv.innerHTML = '';
        const img = document.createElement('img');
        img.src = sprite.href;
        img.alt = template.name;
        img.width = 24;
        img.height = 24;
        iconDiv.appendChild(img);
      }
    });

    console.log('✅ Component library UI initialized');
  }

  /**
   * Setup search
   */
  _setupSearch() {
    const searchInput = document.getElementById('searchComponents');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      if (!query) {
        document.querySelectorAll('.component-item').forEach(item => {
          item.style.display = 'flex';
        });
        document.querySelectorAll('.component-category').forEach(cat => {
          cat.style.display = 'block';
        });
        return;
      }

      document.querySelectorAll('.component-item').forEach(item => {
        const name = item.querySelector('.component-name').textContent.toLowerCase();
        const desc = item.querySelector('.component-desc').textContent.toLowerCase();
        const matches = name.includes(query) || desc.includes(query);
        item.style.display = matches ? 'flex' : 'none';
      });

      document.querySelectorAll('.component-category').forEach(category => {
        const hasVisibleItems = Array.from(category.querySelectorAll('.component-item'))
          .some(item => item.style.display !== 'none');
        category.style.display = hasVisibleItems ? 'block' : 'none';
      });
    });
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    const byId = (id) => document.getElementById(id);
    
    // Canvas
    this.canvas.addEventListener('dragover', (e) => e.preventDefault());
    this.canvas.addEventListener('drop', (e) => this._onDrop(e));
    
    this.canvas.addEventListener('mousemove', (e) => {
      this._updateMousePos(e);
      if (this.currentTool === 'connect' && this.connectionStart) {
        this._updateTempConnection(e);
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.currentTool === 'connect') {
        this._handleConnectionClick(e);
      }
    });

    // UI controls
    byId('gridToggle')?.addEventListener('change', (e) => {
      this.gridRect.classList.toggle('hidden', !e.target.checked);
    });

    byId('snapToggle')?.addEventListener('change', (e) => {
      this.snapToGrid = e.target.checked;
    });

    byId('selectTool')?.addEventListener('click', () => this.setTool('select'));
    byId('connectTool')?.addEventListener('click', () => this.setTool('connect'));
    byId('clearBtn')?.addEventListener('click', () => this.clearCanvas());

    // NEW: Preview button
    byId('previewBtn')?.addEventListener('click', () => this._showPreview());

    // NEW: Import button
    byId('importBtn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => this.importConfig(evt.target.result);
          reader.readAsText(file);
        }
      };
      input.click();
    });

    // NEW: Save Design button
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

    // Export with validation
    const exportBtn = byId('exportBtn') || byId('exportSimBtn') || byId('exportSim');
    const exportModal = byId('exportModal');
    const exportModalClose = byId('exportModalClose');
    const exportCancelBtn = byId('exportCancelBtn');
    const exportConfirmBtn = byId('exportConfirmBtn');
    const simNameInput = byId('simNameInput');

    const closeExportModal = () => {
      if (!exportModal) return;
      exportModal.classList.remove('open');
      setTimeout(() => { exportModal.style.display = 'none'; }, 300);
    };

    const doDirectExport = async () => {
      const name = (simNameInput?.value?.trim()) || 
                   prompt('Enter simulator name:', 'My Simulator');
      
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

    exportBtn?.addEventListener('click', () => {
      // Warn if falling back
      if (!exportModal) {
        console.warn('⚠️ Export modal not found - using prompt() fallback. Check #exportModal in HTML.');
      }
      
      // Run validation first
      const validation = this._validateDesign();
      
      // Update counts
      const compCount = byId('exportCompCount');
      const connCount = byId('exportConnCount');
      if (compCount) compCount.textContent = this.components.size;
      if (connCount) connCount.textContent = this.connections.length;

      // Show validation report
      this._showValidationReport(validation);
    });

    exportModalClose?.addEventListener('click', closeExportModal);
    exportCancelBtn?.addEventListener('click', closeExportModal);
    exportModal?.addEventListener('click', (e) => { 
      if (e.target === exportModal) closeExportModal(); 
    });
    exportConfirmBtn?.addEventListener('click', () => { 
      doDirectExport(); 
      closeExportModal(); 
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && exportModal?.classList.contains('open')) {
        closeExportModal();
      }
    });

    console.log('✅ Event listeners set up');
  }

  /**
   * Ensure exporter loaded
   */
  _ensureExporter(cb) {
    if (window.SimulatorExporter) return cb();
    
    console.log('Loading exporter.js...');
    const script = document.createElement('script');
    script.src = './exporter.js';
    script.onload = () => {
      console.log('✅ exporter.js loaded');
      cb();
    };
    script.onerror = () => {
      alert('❌ Could not load exporter.js');
      console.error('Failed to load exporter.js');
    };
    document.head.appendChild(script);
  }

  /**
   * Set active tool
   */
  setTool(tool) {
    this.currentTool = tool;

    if (tool !== 'connect' && this.connectionStart) {
      this._cancelConnection();
    }

    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const toolBtn = document.getElementById(`${tool}Tool`);
    toolBtn?.classList.add('active');

    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';

    console.log(`Tool changed to: ${tool}`);
  }

  /**
   * Handle connection clicks
   */
  _handleConnectionClick(e) {
    const target = e.target.closest('.canvas-component');
    if (!target) {
      this._cancelConnection();
      return;
    }

    const componentId = target.dataset.id;
    const component = this.components.get(componentId);

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
    this.tempConnectionLine.setAttribute('opacity', '0.6');
    this.connectionsLayer.appendChild(this.tempConnectionLine);

    const component = this.components.get(componentId);
    console.log(`Connection started from ${component.name}`);
  }

  _updateTempConnection(e) {
    if (!this.tempConnectionLine || !this.connectionStart) return;

    const startComp = this.components.get(this.connectionStart);
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.height;

    const path = this._createConnectionPath(startComp.x, startComp.y, mouseX, mouseY);
    this.tempConnectionLine.setAttribute('d', path);
  }

  _completeConnection(toComponentId) {
    const fromComp = this.components.get(this.connectionStart);
    const toComp = this.components.get(toComponentId);

    const exists = this.connections.some(conn =>
      conn.from === this.connectionStart && conn.to === toComponentId
    );

    if (exists) {
      alert('Connection already exists');
      this._cancelConnection();
      return;
    }

    if (!fromComp.config.outputs) fromComp.config.outputs = [];
    if (!toComp.config.inputs) toComp.config.inputs = [];

    fromComp.config.outputs.push(toComponentId);
    toComp.config.inputs.push(this.connectionStart);

    const connection = {
      id: `conn_${this.nextConnectionId++}`,
      from: this.connectionStart,
      to: toComponentId
    };

    this.connections.push(connection);
    this._renderConnection(connection);

    if (this.selectedComponent === this.connectionStart || this.selectedComponent === toComponentId) {
      this._showProperties(this.selectedComponent);
    }

    console.log(`Connected ${fromComp.name} → ${toComp.name}`);

    this._cancelConnection();
    this._updateStats();
  }

  _cancelConnection() {
    this.connectionStart = null;
    if (this.tempConnectionLine) {
      this.tempConnectionLine.remove();
      this.tempConnectionLine = null;
    }
  }

  _renderConnection(connection) {
    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);
    const template = COMPONENT_LIBRARY[fromComp.key];

    let defs = this.canvas.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.canvas.insertBefore(defs, this.canvas.firstChild);
    }
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

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection-line');
    path.setAttribute('data-connection-id', connection.id);
    path.setAttribute('stroke', template.color || '#4f46e5');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');

    const pathData = this._createConnectionPath(fromComp.x, fromComp.y, toComp.x, toComp.y);
    path.setAttribute('d', pathData);

    this.connectionsLayer.appendChild(path);

    path.addEventListener('click', (e) => {
      if (this.currentTool === 'select') {
        e.stopPropagation();
        if (confirm('Delete this connection?')) {
          this.deleteConnection(connection.id);
        }
      }
    });
  }

  _updateConnectionPath(connection) {
    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);
    const pathEl = this.canvas.querySelector(`[data-connection-id="${connection.id}"]`);

    if (!pathEl) return;

    const pathData = this._createConnectionPath(fromComp.x, fromComp.y, toComp.x, toComp.y);
    pathEl.setAttribute('d', pathData);
  }

  _createConnectionPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curve = Math.min(dist * 0.3, 100);

    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
  }

  deleteConnection(connectionId) {
    const connection = this.connections.find(c => c.id === connectionId);
    if (!connection) return;

    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);

    if (fromComp.config.outputs) {
      fromComp.config.outputs = fromComp.config.outputs.filter(id => id !== connection.to);
    }
    if (toComp.config.inputs) {
      toComp.config.inputs = toComp.config.inputs.filter(id => id !== connection.from);
    }

    this.connections = this.connections.filter(c => c.id !== connectionId);

    const pathEl = this.canvas.querySelector(`[data-connection-id="${connectionId}"]`);
    pathEl?.remove();

    if (this.selectedComponent === connection.from || this.selectedComponent === connection.to) {
      this._showProperties(this.selectedComponent);
    }

    this._updateStats();
  }

  _canInput(component) {
    return component.type !== 'feed';
  }

  _canOutput(component) {
    return component.type !== 'drain';
  }

  _onDragStart(e) {
    const componentKey = e.target.closest('.component-item').dataset.component;
    e.dataTransfer.setData('componentKey', componentKey);
    e.dataTransfer.effectAllowed = 'copy';
  }

  _onDrop(e) {
    e.preventDefault();

    const componentKey = e.dataTransfer.getData('componentKey');
    if (!componentKey) return;

    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
    const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;

    const finalX = this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x;
    const finalY = this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y;

    this.addComponent(componentKey, finalX, finalY);
  }

  addComponent(componentKey, x, y) {
    const template = COMPONENT_LIBRARY[componentKey];
    if (!template) return;

    const id = `comp_${this.nextId++}`;

    const component = {
      id,
      key: componentKey,
      type: template.defaultConfig.type,
      name: template.name + ' ' + this.nextId,
      x,
      y,
      config: {
        ...template.defaultConfig,
        inputs: [],
        outputs: []
      }
    };

    this.components.set(id, component);
    this._renderComponent(component);
    this._updateStats();

    console.log(`Added ${template.name} at (${x}, ${y})`);
  }

  _renderComponent(component) {
    const template = COMPONENT_LIBRARY[component.key];

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('canvas-component');
    group.setAttribute('data-id', component.id);
    group.setAttribute('transform', `translate(${component.x}, ${component.y})`);

    const sprite = (SPRITES && SPRITES[component.type]) || SPRITES.default;

    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', component.name);
    group.style.cursor = 'pointer';
    group.style.pointerEvents = 'bounding-box';

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('x', sprite.x - 8);
    hit.setAttribute('y', sprite.y - 8);
    hit.setAttribute('width', sprite.w + 16);
    hit.setAttribute('height', sprite.h + 16);
    hit.setAttribute('fill', 'transparent');
    hit.style.pointerEvents = 'visibleFill';
    group.appendChild(hit);

    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', sprite.href);
    img.setAttribute('x', sprite.x);
    img.setAttribute('y', sprite.y);
    img.setAttribute('width', sprite.w);
    img.setAttribute('height', sprite.h);
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    img.style.imageRendering = 'optimizeQuality';
    group.appendChild(img);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('component-label');
    label.setAttribute('x', 0);
    const labelY = sprite.labelDy !== undefined ? sprite.labelDy : (sprite.y - 10);
    label.setAttribute('y', labelY);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#9bb0ff');
    label.textContent = component.name;
    group.appendChild(label);

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ring.setAttribute('x', sprite.x - 4);
    ring.setAttribute('y', sprite.y - 4);
    ring.setAttribute('width', sprite.w + 8);
    ring.setAttribute('height', sprite.h + 8);
    ring.setAttribute('rx', '10');
    ring.setAttribute('ry', '10');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#7cc8ff');
    ring.setAttribute('stroke-width', '2');
    ring.setAttribute('stroke-dasharray', '6 4');
    ring.setAttribute('opacity', '0');
    ring.classList.add('selection-ring');
    group.appendChild(ring);

    group.addEventListener('click', (e) => {
      if (this.currentTool === 'select') {
        e.stopPropagation();
        this.selectComponent(component.id);
      }
    });

    let isDragging = false;
    let startX, startY;

    group.addEventListener('mousedown', (e) => {
      if (this.currentTool !== 'select' || e.button !== 0) return;
      isDragging = true;
      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      startX = ((e.clientX - rect.left) / rect.width) * viewBox.width - component.x;
      startY = ((e.clientY - rect.top) / rect.height) * viewBox.height - component.y;
      e.stopPropagation();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const viewBox = this.canvas.viewBox.baseVal;
      let newX = ((e.clientX - rect.left) / rect.width) * viewBox.width - startX;
      let newY = ((e.clientY - rect.top) / rect.height) * viewBox.height - startY;

      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      component.x = newX;
      component.y = newY;
      group.setAttribute('transform', `translate(${newX}, ${newY})`);

      this.connections.forEach(conn => {
        if (conn.from === component.id || conn.to === component.id) {
          this._updateConnectionPath(conn);
        }
      });
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.componentsLayer.appendChild(group);
  }

  selectComponent(id) {
    if (this.selectedComponent) {
      const prevEl = this.canvas.querySelector(`[data-id="${this.selectedComponent}"]`);
      prevEl?.classList.remove('selected');
    }

    this.selectedComponent = id;
    const el = this.canvas.querySelector(`[data-id="${id}"]`);
    el?.classList.add('selected');

    this._showProperties(id);
  }

  _showProperties(id) {
    const component = this.components.get(id);
    if (!component) return;

    const template = COMPONENT_LIBRARY[component.key];
    const propertiesContent = document.getElementById('propertiesContent');

    const canInput = this._canInput(component);
    const canOutput = this._canOutput(component);

    propertiesContent.innerHTML = `
      <div class="property-group">
        <h3>${component.name}</h3>
        ${template.properties.map(prop => `
          <div class="property-field">
            <label class="property-label">${prop.label}</label>
            <input 
              type="${prop.type === 'text' ? 'text' : 'number'}" 
              class="property-input" 
              data-property="${prop.name}"
              value="${component.config[prop.name] || prop.default}"
              ${prop.min !== undefined ? `min="${prop.min}"` : ''}
              ${prop.max !== undefined ? `max="${prop.max}"` : ''}
              ${prop.step !== undefined ? `step="${prop.step}"` : ''}
            >
          </div>
        `).join('')}
      </div>

      ${canInput ? `
        <div class="property-group">
          <h3>⬇️ Inputs</h3>
          <div class="connections-list">
            ${component.config.inputs && component.config.inputs.length > 0 
              ? component.config.inputs.map(inputId => {
                  const inputComp = this.components.get(inputId);
                  return `
                    <div class="connection-item">
                      <span>${inputComp ? inputComp.name : 'Unknown'}</span>
                      <button class="btn-remove" data-remove-input="${inputId}">✕</button>
                    </div>
                  `;
                }).join('')
              : '<p class="empty-text">No inputs connected</p>'
            }
          </div>
        </div>
      ` : ''}

      ${canOutput ? `
        <div class="property-group">
          <h3>⬆️ Outputs</h3>
          <div class="connections-list">
            ${component.config.outputs && component.config.outputs.length > 0 
              ? component.config.outputs.map(outputId => {
                  const outputComp = this.components.get(outputId);
                  return `
                    <div class="connection-item">
                      <span>${outputComp ? outputComp.name : 'Unknown'}</span>
                      <button class="btn-remove" data-remove-output="${outputId}">✕</button>
                    </div>
                  `;
                }).join('')
              : '<p class="empty-text">No outputs connected</p>'
            }
          </div>
        </div>
      ` : ''}

      <div class="property-group">
        <button class="btn btn-danger" id="deleteComponent">🗑️ Delete Component</button>
      </div>
    `;

    propertiesContent.querySelectorAll('.property-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const propName = e.target.dataset.property;
        const value = input.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        component.config[propName] = value;

        if (propName === 'name') {
          component.name = value;
          const el = this.canvas.querySelector(`[data-id="${id}"] .component-label`);
          if (el) el.textContent = value;
        }
      });
    });

    propertiesContent.querySelectorAll('[data-remove-input]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.removeInput;
        const conn = this.connections.find(c => c.from === inputId && c.to === id);
        if (conn) this.deleteConnection(conn.id);
      });
    });

    propertiesContent.querySelectorAll('[data-remove-output]').forEach(btn => {
      btn.addEventListener('click', () => {
        const outputId = btn.dataset.removeOutput;
        const conn = this.connections.find(c => c.from === id && c.to === outputId);
        if (conn) this.deleteConnection(conn.id);
      });
    });

    const deleteBtn = propertiesContent.querySelector('#deleteComponent');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete ${component.name}?`)) {
          this.deleteComponent(id);
        }
      });
    }
  }

  deleteComponent(id) {
    const relatedConnections = this.connections.filter(conn =>
      conn.from === id || conn.to === id
    );
    relatedConnections.forEach(conn => this.deleteConnection(conn.id));

    this.components.delete(id);

    const el = this.canvas.querySelector(`[data-id="${id}"]`);
    el?.remove();

    if (this.selectedComponent === id) {
      this.selectedComponent = null;
      document.getElementById('propertiesContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Select a component to edit its properties</p>
        </div>
      `;
    }

    this._updateStats();
  }

  _updateMousePos(e) {
    const mousePosEl = document.getElementById('mousePos');
    if (!mousePosEl) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * viewBox.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * viewBox.height);
    mousePosEl.textContent = `X: ${x}, Y: ${y}`;
  }

  _updateStats() {
    const compCountEl = document.getElementById('componentCount');
    const connCountEl = document.getElementById('connectionCount');
    
    if (compCountEl) compCountEl.textContent = `Components: ${this.components.size}`;
    if (connCountEl) connCountEl.textContent = `Connections: ${this.connections.length}`;
  }

  clearCanvas(confirm = true) {
    if (confirm && !window.confirm('Clear all components? This cannot be undone.')) return;

    this.components.clear();
    this.connections = [];
    this.componentsLayer.innerHTML = '';
    this.connectionsLayer.innerHTML = '';
    this.selectedComponent = null;
    
    const propertiesContent = document.getElementById('propertiesContent');
    if (propertiesContent) {
      propertiesContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Select a component to edit its properties</p>
        </div>
      `;
    }
    
    this._updateStats();
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  window.designer = new ProcessDesigner();
  console.log(`✅ Designer v${DESIGNER_VERSION} ready!`);
});
