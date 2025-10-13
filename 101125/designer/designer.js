/**
 * designer.js - Core designer logic with drag-drop
 */

class ProcessDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.componentsLayer = document.getElementById('componentsLayer');
    this.gridRect = document.getElementById('gridRect');
    
    this.components = new Map(); // id -> component data
    this.connections = [];
    this.selectedComponent = null;
    this.nextId = 1;
    
    this.gridSize = 20;
    this.snapToGrid = true;
    
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
    this.canvas.addEventListener('mousemove', (e) => this._updateMousePos(e));
    
    // Grid toggle
    document.getElementById('gridToggle').addEventListener('change', (e) => {
      this.gridRect.classList.toggle('hidden', !e.target.checked);
    });
    
    // Snap toggle
    document.getElementById('snapToggle').addEventListener('change', (e) => {
      this.snapToGrid = e.target.checked;
    });
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => this.exportConfig());
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
      name: template.name,
      x,
      y,
      config: { ...template.defaultConfig }
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
    
    // Component body (rounded rectangle)
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
    group.addEventListener('click', () => this.selectComponent(component.id));
    
    // Drag handler
    let isDragging = false;
    let startX, startY;
    
    group.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
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
    
    propertiesContent.innerHTML = `
      <div class="property-group">
        <h3>${component.name} Properties</h3>
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
    const config = {
      components: Array.from(this.components.values()),
      connections: this.connections
    };
    
    console.log('Exported config:', config);
    alert('Export functionality coming in Phase 8.2!\n\nConfig logged to console.');
  }
}

// Initialize designer when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.designer = new ProcessDesigner();
  console.log('✅ Designer ready!');
});
