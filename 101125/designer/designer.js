/**
 * designer.js - Core designer logic with connections and I/O management
 */

class ProcessDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.componentsLayer = document.getElementById('componentsLayer');
    this.connectionsLayer = document.getElementById('connectionsLayer');
    this.gridRect = document.getElementById('gridRect');
    
    this.components = new Map(); // id -> component data
    this.connections = []; // array of {from, to, fromPort, toPort}
    this.selectedComponent = null;
    this.nextId = 1;
    this.nextConnectionId = 1;
    
    this.gridSize = 20;
    this.snapToGrid = true;
    
    // Tool states
    this.currentTool = 'select';
    this.connectionStart = null;
    this.tempConnectionLine = null;
    
    this._initializeLibrary();
    this._setupEventListeners();
    this._updateStats();
    
    console.log('Process Designer initialized');
  }

  /**
   * Initialize component library UI
   */
  _initializeLibrary() {
    const libraryContent = document.getElementById('libraryContent');
    
    // Group components by category
    const categorized = {};
    for (const [key, component] of Object.entries(COMPONENT_LIBRARY)) {
      const category = component.category;
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push({ key, ...component });
    }
    
    // Build category UI
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
    
    // Category toggle handlers
    libraryContent.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const category = header.dataset.category;
        const items = libraryContent.querySelector(`.category-items[data-category="${category}"]`);
        items.classList.toggle('collapsed');
        header.querySelector('.category-toggle').textContent = items.classList.contains('collapsed') ? '▶' : '▼';
      });
    });
    
    // Drag start handlers
    libraryContent.querySelectorAll('.component-item').forEach(item => {
      item.addEventListener('dragstart', (e) => this._onDragStart(e));
    });
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Canvas drop
    this.canvas.addEventListener('dragover', (e) => e.preventDefault());
    this.canvas.addEventListener('drop', (e) => this._onDrop(e));
    
    // Canvas mouse tracking
    this.canvas.addEventListener('mousemove', (e) => {
      this._updateMousePos(e);
      if (this.currentTool === 'connect' && this.connectionStart) {
        this._updateTempConnection(e);
      }
    });
    
    // Canvas click for connection tool
    this.canvas.addEventListener('click', (e) => {
      if (this.currentTool === 'connect') {
        this._handleConnectionClick(e);
      }
    });
    
    // Grid toggle
    document.getElementById('gridToggle').addEventListener('change', (e) => {
      this.gridRect.classList.toggle('hidden', !e.target.checked);
    });
    
    // Snap toggle
    document.getElementById('snapToggle').addEventListener('change', (e) => {
      this.snapToGrid = e.target.checked;
    });
    
    // Tool buttons
    document.getElementById('selectTool').addEventListener('click', () => this.setTool('select'));
    document.getElementById('connectTool').addEventListener('click', () => this.setTool('connect'));
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => this.exportConfig());

// Export modal handlers
const exportModal = document.getElementById('exportModal');
const exportModalClose = document.getElementById('exportModalClose');
const exportCancelBtn = document.getElementById('exportCancelBtn');
const exportConfirmBtn = document.getElementById('exportConfirmBtn');

const closeExportModal = () => {
  exportModal.classList.remove('open');
};

exportModalClose.addEventListener('click', closeExportModal);
exportCancelBtn.addEventListener('click', closeExportModal);
exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) closeExportModal();
});

exportConfirmBtn.addEventListener('click', () => {
  const simName = document.getElementById('simNameInput').value || 'My Simulator';
  const exporter = new SimulatorExporter(this);
  exporter.exportSimulator(simName);
  closeExportModal();
});

// Escape key closes modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && exportModal.classList.contains('open')) {
    closeExportModal();
  }
});
    
  }

  /**
   * Set active tool
   */
  setTool(tool) {
    this.currentTool = tool;
    
    // Cancel ongoing connection
    if (tool !== 'connect' && this.connectionStart) {
      this._cancelConnection();
    }
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tool}Tool`).classList.add('active');
    
    // Update cursor
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';
    
    console.log(`Tool changed to: ${tool}`);
  }

  /**
   * Handle connection tool clicks
   */
  _handleConnectionClick(e) {
    // Check if clicked on a component
    const target = e.target.closest('.canvas-component');
    if (!target) {
      this._cancelConnection();
      return;
    }
    
    const componentId = target.dataset.id;
    const component = this.components.get(componentId);
    
    if (!this.connectionStart) {
      // Start connection - check if component can output
      if (!this._canOutput(component)) {
        alert(`${component.name} cannot have outputs (it's a ${component.type})`);
        return;
      }
      this._startConnection(componentId);
    } else {
      // Complete connection - check if component can input
      if (!this._canInput(component)) {
        alert(`${component.name} cannot have inputs (it's a ${component.type})`);
        this._cancelConnection();
        return;
      }
      
      // Validate connection
      if (componentId === this.connectionStart) {
        alert('Cannot connect component to itself');
        this._cancelConnection();
        return;
      }
      
      this._completeConnection(componentId);
    }
  }

  /**
   * Start drawing a connection
   */
  _startConnection(componentId) {
    this.connectionStart = componentId;
    const component = this.components.get(componentId);
    
    // Create temporary line
    this.tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempConnectionLine.setAttribute('stroke', '#4f46e5');
    this.tempConnectionLine.setAttribute('stroke-width', '3');
    this.tempConnectionLine.setAttribute('fill', 'none');
    this.tempConnectionLine.setAttribute('stroke-dasharray', '5,5');
    this.tempConnectionLine.setAttribute('opacity', '0.6');
    this.connectionsLayer.appendChild(this.tempConnectionLine);
    
    console.log(`Connection started from ${component.name}`);
  }

  /**
   * Update temporary connection line
   */
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

  /**
   * Complete a connection
   */
  _completeConnection(toComponentId) {
    const fromComp = this.components.get(this.connectionStart);
    const toComp = this.components.get(toComponentId);
    
    // Check if connection already exists
    const exists = this.connections.some(conn => 
      conn.from === this.connectionStart && conn.to === toComponentId
    );
    
    if (exists) {
      alert('Connection already exists');
      this._cancelConnection();
      return;
    }
    
    // Add to outputs/inputs
    if (!fromComp.config.outputs) fromComp.config.outputs = [];
    if (!toComp.config.inputs) toComp.config.inputs = [];
    
    fromComp.config.outputs.push(toComponentId);
    toComp.config.inputs.push(this.connectionStart);
    
    // Create connection
    const connection = {
      id: `conn_${this.nextConnectionId++}`,
      from: this.connectionStart,
      to: toComponentId
    };
    
    this.connections.push(connection);
    this._renderConnection(connection);
    
    // Update properties if either component is selected
    if (this.selectedComponent === this.connectionStart || this.selectedComponent === toComponentId) {
      this._showProperties(this.selectedComponent);
    }
    
    console.log(`Connected ${fromComp.name} → ${toComp.name}`);
    
    this._cancelConnection();
    this._updateStats();
  }

  /**
   * Cancel ongoing connection
   */
  _cancelConnection() {
    this.connectionStart = null;
    if (this.tempConnectionLine) {
      this.tempConnectionLine.remove();
      this.tempConnectionLine = null;
    }
  }

  /**
   * Render a connection on canvas
   */
  _renderConnection(connection) {
    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);
    
    const template = COMPONENT_LIBRARY[fromComp.key];
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection-line');
    path.setAttribute('data-connection-id', connection.id);
    path.setAttribute('stroke', template.color || '#4f46e5');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    
    // Create arrowhead marker if not exists
    if (!document.getElementById('arrowhead')) {
      const defs = this.canvas.querySelector('defs');
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
    
    this._updateConnectionPath(connection);
    this.connectionsLayer.appendChild(path);
    
    // Click to delete
    path.addEventListener('click', (e) => {
      if (this.currentTool === 'select') {
        e.stopPropagation();
        if (confirm('Delete this connection?')) {
          this.deleteConnection(connection.id);
        }
      }
    });
  }

  /**
   * Update connection path (called when components move)
   */
  _updateConnectionPath(connection) {
    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);
    const pathEl = this.canvas.querySelector(`[data-connection-id="${connection.id}"]`);
    
    if (!pathEl) return;
    
    const pathData = this._createConnectionPath(fromComp.x, fromComp.y, toComp.x, toComp.y);
    pathEl.setAttribute('d', pathData);
  }

  /**
   * Create SVG path for connection (curved)
   */
  _createConnectionPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curve = Math.min(dist * 0.3, 100);
    
    // Cubic bezier curve
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
  }

  /**
   * Delete a connection
   */
  deleteConnection(connectionId) {
    const connection = this.connections.find(c => c.id === connectionId);
    if (!connection) return;
    
    // Remove from component configs
    const fromComp = this.components.get(connection.from);
    const toComp = this.components.get(connection.to);
    
    if (fromComp.config.outputs) {
      fromComp.config.outputs = fromComp.config.outputs.filter(id => id !== connection.to);
    }
    if (toComp.config.inputs) {
      toComp.config.inputs = toComp.config.inputs.filter(id => id !== connection.from);
    }
    
    // Remove from connections array
    this.connections = this.connections.filter(c => c.id !== connectionId);
    
    // Remove visual element
    const pathEl = this.canvas.querySelector(`[data-connection-id="${connectionId}"]`);
    pathEl?.remove();
    
    // Update properties if relevant component is selected
    if (this.selectedComponent === connection.from || this.selectedComponent === connection.to) {
      this._showProperties(this.selectedComponent);
    }
    
    this._updateStats();
  }

  /**
   * Check if component type can have inputs
   */
  _canInput(component) {
    return component.type !== 'feed';
  }

  /**
   * Check if component type can have outputs
   */
  _canOutput(component) {
    return component.type !== 'drain';
  }

  /**
   * Drag start handler
   */
  _onDragStart(e) {
    const componentKey = e.target.closest('.component-item').dataset.component;
    e.dataTransfer.setData('componentKey', componentKey);
    e.dataTransfer.effectAllowed = 'copy';
  }

  /**
   * Drop handler - create component on canvas
   */
  _onDrop(e) {
    e.preventDefault();
    
    const componentKey = e.dataTransfer.getData('componentKey');
    if (!componentKey) return;
    
    // Get canvas coordinates
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
    const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;
    
    // Snap to grid
    const finalX = this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x;
    const finalY = this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y;
    
    // Create component
    this.addComponent(componentKey, finalX, finalY);
  }

  /**
   * Add component to canvas
   */
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

  /**
   * Render component on canvas
   */
  _renderComponent(component) {
    const template = COMPONENT_LIBRARY[component.key];
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('canvas-component');
    group.setAttribute('data-id', component.id);
    group.setAttribute('transform', `translate(${component.x}, ${component.y})`);
    
    // Component body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    body.classList.add('component-body');
    body.setAttribute('x', -40);
    body.setAttribute('y', -30);
    body.setAttribute('width', 80);
    body.setAttribute('height', 60);
    body.setAttribute('rx', 8);
    body.style.fill = template.color + '20';
    body.style.stroke = template.color;
    
    // Component icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    icon.classList.add('component-icon-text');
    icon.setAttribute('x', 0);
    icon.setAttribute('y', 10);
    icon.textContent = template.icon;
    
    // Component label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('component-label');
    label.setAttribute('x', 0);
    label.setAttribute('y', -40);
    label.textContent = component.name;
    
    group.appendChild(body);
    group.appendChild(icon);
    group.appendChild(label);
    
    // Click handler
    group.addEventListener('click', (e) => {
      if (this.currentTool === 'select') {
        e.stopPropagation();
        this.selectComponent(component.id);
      }
    });
    
    // Drag handler
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
      
      // Update connected paths
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

  /**
   * Select component and show properties
   */
  selectComponent(id) {
    // Deselect previous
    if (this.selectedComponent) {
      const prevEl = this.canvas.querySelector(`[data-id="${this.selectedComponent}"]`);
      prevEl?.classList.remove('selected');
    }
    
    // Select new
    this.selectedComponent = id;
    const el = this.canvas.querySelector(`[data-id="${id}"]`);
    el?.classList.add('selected');
    
    // Show properties
    this._showProperties(id);
  }

  /**
   * Show component properties panel
   */
  _showProperties(id) {
    const component = this.components.get(id);
    if (!component) return;
    
    const template = COMPONENT_LIBRARY[component.key];
    const propertiesContent = document.getElementById('propertiesContent');
    
    // Get available components for dropdowns
    const availableComponents = Array.from(this.components.values())
      .filter(c => c.id !== id);
    
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
    
    // Update handlers
    propertiesContent.querySelectorAll('.property-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const propName = e.target.dataset.property;
        const value = input.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        component.config[propName] = value;
        
        // Update label if name changed
        if (propName === 'name') {
          component.name = value;
          const el = this.canvas.querySelector(`[data-id="${id}"] .component-label`);
          if (el) el.textContent = value;
        }
      });
    });
    
    // Remove input connections
    propertiesContent.querySelectorAll('[data-remove-input]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.removeInput;
        const conn = this.connections.find(c => c.from === inputId && c.to === id);
        if (conn) this.deleteConnection(conn.id);
      });
    });
    
    // Remove output connections
    propertiesContent.querySelectorAll('[data-remove-output]').forEach(btn => {
      btn.addEventListener('click', () => {
        const outputId = btn.dataset.removeOutput;
        const conn = this.connections.find(c => c.from === id && c.to === outputId);
        if (conn) this.deleteConnection(conn.id);
      });
    });
    
    // Delete component button
    const deleteBtn = propertiesContent.querySelector('#deleteComponent');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete ${component.name}?`)) {
          this.deleteComponent(id);
        }
      });
    }
  }

  /**
   * Delete a component
   */
  deleteComponent(id) {
    // Delete all connected connections
    const relatedConnections = this.connections.filter(conn => 
      conn.from === id || conn.to === id
    );
    relatedConnections.forEach(conn => this.deleteConnection(conn.id));
    
    // Remove from map
    this.components.delete(id);
    
    // Remove visual element
    const el = this.canvas.querySelector(`[data-id="${id}"]`);
    el?.remove();
    
    // Clear selection
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

  /**
   * Update mouse position display
   */
  _updateMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const viewBox = this.canvas.viewBox.baseVal;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * viewBox.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * viewBox.height);
    document.getElementById('mousePos').textContent = `X: ${x}, Y: ${y}`;
  }

  /**
   * Update statistics display
   */
  _updateStats() {
    document.getElementById('componentCount').textContent = `Components: ${this.components.size}`;
    document.getElementById('connectionCount').textContent = `Connections: ${this.connections.length}`;
  }

  /**
   * Clear canvas
   */
  clearCanvas() {
    if (!confirm('Clear all components? This cannot be undone.')) return;
    
    this.components.clear();
    this.connections = [];
    this.componentsLayer.innerHTML = '';
    this.connectionsLayer.innerHTML = '';
    this.selectedComponent = null;
    document.getElementById('propertiesContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Select a component to edit its properties</p>
      </div>
    `;
    this._updateStats();
  }

  /**
   * Export configuration
   */
exportConfig() {
  // Update stats
  document.getElementById('exportCompCount').textContent = this.components.size;
  document.getElementById('exportConnCount').textContent = this.connections.length;
  
  // Show modal
  const modal = document.getElementById('exportModal');
  modal.classList.add('open');
  
  // Focus sim name input
  setTimeout(() => {
    document.getElementById('simNameInput').select();
  }, 100);
}

// Initialize designer when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.designer = new ProcessDesigner();
  console.log('✅ Designer ready!');
});
