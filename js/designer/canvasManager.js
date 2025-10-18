/**
 * canvasManager.js - Handles canvas interactions, component placement, and selection
 */

class CanvasManager {
  constructor(svgElement) {
    this.svg = svgElement;
    this.components = new Map(); // Map<id, {element, data}>
    this.selectedComponent = null;
    this.draggingComponent = null;
    this.dragOffset = { x: 0, y: 0 };
    
    // Canvas state
    this.zoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    
    // Grid settings
    this.gridSize = 20;
    this.snapToGrid = true;
    
    this._setupEventListeners();
    console.log('CanvasManager initialized');
  }

  /**
   * Setup event listeners for canvas interactions
   */
  _setupEventListeners() {
    // Component dragging
    this.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this._onMouseUp(e));
    
    // Zoom with mouse wheel
    this.svg.addEventListener('wheel', (e) => this._onWheel(e));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    
    // Prevent context menu
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Add a component to the canvas
   */
  addComponent(id, type, position, config = {}) {
    // Create SVG group for component
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `component-${id}`);
    group.setAttribute('class', `component component-${type}`);
    group.setAttribute('data-id', id);
    group.setAttribute('data-type', type);
    
    // Snap to grid if enabled
    const pos = this.snapToGrid ? this._snapToGrid(position) : position;
    group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    
    // Create visual representation based on type
    this._createComponentVisual(group, type, config);
    
    // Add to SVG
    this.svg.appendChild(group);
    
    // Store in map
    this.components.set(id, {
      element: group,
      data: {
        id,
        type,
        position: pos,
        config
      }
    });
    
    console.log(`Added component: ${type} (${id}) at`, pos);
    return group;
  }

  /**
   * Create visual representation for component
   */
  _createComponentVisual(group, type, config) {
    const visuals = {
      tank: () => {
        const rect = this._createSVGElement('rect', {
          x: -40, y: -60, width: 80, height: 120,
          fill: '#0e1734', stroke: '#2a3d78', 'stroke-width': 2, rx: 8
        });
        const text = this._createSVGElement('text', {
          x: 0, y: 5, 'text-anchor': 'middle', fill: '#9bb0ff', 'font-size': 12
        });
        text.textContent = config.name || 'Tank';
        group.appendChild(rect);
        group.appendChild(text);
      },
      
      pump: () => {
        const circle = this._createSVGElement('circle', {
          cx: 0, cy: 0, r: 30,
          fill: '#1a2840', stroke: '#3d5a80', 'stroke-width': 2
        });
        const text = this._createSVGElement('text', {
          x: 0, y: 5, 'text-anchor': 'middle', fill: '#9bb0ff', 'font-size': 12
        });
        text.textContent = 'P';
        group.appendChild(circle);
        group.appendChild(text);
      },
      
      valve: () => {
        const diamond = this._createSVGElement('polygon', {
          points: '0,-25 25,0 0,25 -25,0',
          fill: '#1a2840', stroke: '#3d5a80', 'stroke-width': 2
        });
        const text = this._createSVGElement('text', {
          x: 0, y: 5, 'text-anchor': 'middle', fill: '#9bb0ff', 'font-size': 12
        });
        text.textContent = 'V';
        group.appendChild(diamond);
        group.appendChild(text);
      },
      
      feed: () => {
        const circle = this._createSVGElement('circle', {
          cx: 0, cy: 0, r: 20,
          fill: '#1a4d2e', stroke: '#3ddc97', 'stroke-width': 2
        });
        const text = this._createSVGElement('text', {
          x: 0, y: 5, 'text-anchor': 'middle', fill: '#3ddc97', 'font-size': 12
        });
        text.textContent = 'F';
        group.appendChild(circle);
        group.appendChild(text);
      },
      
      drain: () => {
        const circle = this._createSVGElement('circle', {
          cx: 0, cy: 0, r: 20,
          fill: '#4d1a1a', stroke: '#ff6b6b', 'stroke-width': 2
        });
        const text = this._createSVGElement('text', {
          x: 0, y: 5, 'text-anchor': 'middle', fill: '#ff6b6b', 'font-size': 12
        });
        text.textContent = 'D';
        group.appendChild(circle);
        group.appendChild(text);
      }
    };
    
    const createVisual = visuals[type] || visuals.tank;
    createVisual();
  }

  /**
   * Helper to create SVG elements
   */
  _createSVGElement(type, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /**
   * Remove component from canvas
   */
  removeComponent(id) {
    const component = this.components.get(id);
    if (!component) return false;
    
    component.element.remove();
    this.components.delete(id);
    
    if (this.selectedComponent === id) {
      this.selectedComponent = null;
    }
    
    console.log(`Removed component: ${id}`);
    return true;
  }

  /**
   * Get component position
   */
  getComponentPosition(id) {
    const component = this.components.get(id);
    return component ? component.data.position : null;
  }

  /**
   * Set component position
   */
  setComponentPosition(id, position) {
    const component = this.components.get(id);
    if (!component) return false;
    
    const pos = this.snapToGrid ? this._snapToGrid(position) : position;
    component.element.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    component.data.position = pos;
    
    return true;
  }

  /**
   * Select component
   */
  selectComponent(id) {
    // Deselect previous
    if (this.selectedComponent) {
      const prev = this.components.get(this.selectedComponent);
      if (prev) {
        prev.element.classList.remove('selected');
      }
    }
    
    // Select new
    this.selectedComponent = id;
    const component = this.components.get(id);
    if (component) {
      component.element.classList.add('selected');
      return component.data;
    }
    
    return null;
  }

  /**
   * Mouse down handler
   */
  _onMouseDown(e) {
    const target = e.target.closest('.component');
    if (!target) {
      this.selectedComponent = null;
      return;
    }
    
    const id = target.getAttribute('data-id');
    this.selectComponent(id);
    
    // Start dragging
    this.draggingComponent = id;
    const component = this.components.get(id);
    const svgPoint = this._getSVGPoint(e.clientX, e.clientY);
    
    this.dragOffset = {
      x: svgPoint.x - component.data.position.x,
      y: svgPoint.y - component.data.position.y
    };
    
    e.preventDefault();
  }

  /**
   * Mouse move handler
   */
  _onMouseMove(e) {
    if (!this.draggingComponent) return;
    
    const svgPoint = this._getSVGPoint(e.clientX, e.clientY);
    const newPos = {
      x: svgPoint.x - this.dragOffset.x,
      y: svgPoint.y - this.dragOffset.y
    };
    
    this.setComponentPosition(this.draggingComponent, newPos);
    
    // Notify connection manager to update pipes
    this._dispatchEvent('componentMoved', {
      id: this.draggingComponent,
      position: newPos
    });
  }

  /**
   * Mouse up handler
   */
  _onMouseUp(e) {
    this.draggingComponent = null;
  }

  /**
   * Wheel handler (zoom)
   */
  _onWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom * delta));
    
    // Apply zoom (simplified - center zoom)
    const viewBox = this.svg.getAttribute('viewBox').split(' ').map(Number);
    const centerX = viewBox[2] / 2;
    const centerY = viewBox[3] / 2;
    
    console.log(`Zoom: ${(this.zoom * 100).toFixed(0)}%`);
  }

  /**
   * Keyboard handler
   */
  _onKeyDown(e) {
    // Delete selected component
    if (e.key === 'Delete' && this.selectedComponent) {
      this.removeComponent(this.selectedComponent);
      this._dispatchEvent('componentDeleted', { id: this.selectedComponent });
    }
    
    // Toggle grid snap
    if (e.key === 'g' && e.ctrlKey) {
      this.snapToGrid = !this.snapToGrid;
      console.log(`Grid snap: ${this.snapToGrid ? 'ON' : 'OFF'}`);
    }
  }

  /**
   * Convert screen coordinates to SVG coordinates
   */
  _getSVGPoint(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  /**
   * Snap position to grid
   */
  _snapToGrid(pos) {
    return {
      x: Math.round(pos.x / this.gridSize) * this.gridSize,
      y: Math.round(pos.y / this.gridSize) * this.gridSize
    };
  }

  /**
   * Dispatch custom event
   */
  _dispatchEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    this.svg.dispatchEvent(event);
  }

  /**
   * Get all components as array
   */
  getAllComponents() {
    return Array.from(this.components.values()).map(c => c.data);
  }

  /**
   * Clear all components
   */
  clear() {
    this.components.forEach((component) => {
      component.element.remove();
    });
    this.components.clear();
    this.selectedComponent = null;
    console.log('Canvas cleared');
  }

  /**
   * Export canvas state
   */
  exportState() {
    return {
      components: this.getAllComponents(),
      zoom: this.zoom,
      pan: this.panOffset
    };
  }

  /**
   * Import canvas state
   */
  importState(state) {
    this.clear();
    
    state.components.forEach(comp => {
      this.addComponent(comp.id, comp.type, comp.position, comp.config);
    });
    
    this.zoom = state.zoom || 1.0;
    this.panOffset = state.pan || { x: 0, y: 0 };
  }
}

// Export
window.CanvasManager = CanvasManager;
