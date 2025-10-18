/**
 * connectionManager.js - Manages drawing connections/pipes between components
 */

class ConnectionManager {
  constructor(svgElement, canvasManager) {
    this.svg = svgElement;
    this.canvasManager = canvasManager;
    this.connections = new Map(); // Map<id, {from, to, element, data}>
    this.connectionsGroup = null;
    
    // Connection drawing state
    this.drawingConnection = false;
    this.tempConnection = null;
    this.connectionStart = null;
    
    this._initialize();
    console.log('ConnectionManager initialized');
  }

  /**
   * Initialize connection layer
   */
  _initialize() {
    // Create a group for all connections (render below components)
    this.connectionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.connectionsGroup.setAttribute('id', 'connections');
    this.connectionsGroup.setAttribute('class', 'connections-layer');
    
    // Insert at beginning so components render on top
    this.svg.insertBefore(this.connectionsGroup, this.svg.firstChild);
    
    this._setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Listen for component movements to update connections
    this.svg.addEventListener('componentMoved', (e) => {
      this._updateConnectionsForComponent(e.detail.id);
    });
    
    // Listen for component deletion to remove connections
    this.svg.addEventListener('componentDeleted', (e) => {
      this._removeConnectionsForComponent(e.detail.id);
    });
    
    // Connection mode toggle (Ctrl+Click to start connection)
    this.svg.addEventListener('click', (e) => {
      if (e.ctrlKey) {
        this._onConnectionModeClick(e);
      }
    });
    
    // Track mouse for temporary connection line
    this.svg.addEventListener('mousemove', (e) => {
      if (this.drawingConnection && this.tempConnection) {
        this._updateTempConnection(e);
      }
    });
    
    // Cancel connection on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawingConnection) {
        this._cancelConnection();
      }
    });
  }

  /**
   * Add a connection between two components
   */
  addConnection(id, fromId, toId, config = {}) {
    // Validate components exist
    const fromPos = this.canvasManager.getComponentPosition(fromId);
    const toPos = this.canvasManager.getComponentPosition(toId);
    
    if (!fromPos || !toPos) {
      console.error(`Cannot create connection: component not found`);
      return null;
    }
    
    // Create connection element
    const path = this._createConnectionPath(fromPos, toPos, config);
    path.setAttribute('id', `connection-${id}`);
    path.setAttribute('class', 'connection');
    path.setAttribute('data-id', id);
    path.setAttribute('data-from', fromId);
    path.setAttribute('data-to', toId);
    
    // Add to connections group
    this.connectionsGroup.appendChild(path);
    
    // Store in map
    this.connections.set(id, {
      from: fromId,
      to: toId,
      element: path,
      data: {
        id,
        fromId,
        toId,
        config
      }
    });
    
    console.log(`Added connection: ${fromId} → ${toId}`);
    return path;
  }

  /**
   * Create SVG path element for connection
   */
  _createConnectionPath(fromPos, toPos, config) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Calculate path (smart routing)
    const pathData = this._calculatePath(fromPos, toPos, config.routing || 'orthogonal');
    
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', config.color || '#7cc8ff');
    path.setAttribute('stroke-width', config.width || 3);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    // Add flow animation class if needed
    if (config.animated) {
      path.setAttribute('stroke-dasharray', '10 5');
      path.classList.add('flow-animated');
    }
    
    // Make clickable for selection/deletion
    path.style.cursor = 'pointer';
    path.addEventListener('click', (e) => {
      if (!e.ctrlKey) {
        this._selectConnection(path.getAttribute('data-id'));
        e.stopPropagation();
      }
    });
    
    return path;
  }

  /**
   * Calculate path between two points
   */
  _calculatePath(from, to, routing = 'orthogonal') {
    switch (routing) {
      case 'straight':
        return this._straightPath(from, to);
      case 'orthogonal':
        return this._orthogonalPath(from, to);
      case 'bezier':
        return this._bezierPath(from, to);
      default:
        return this._orthogonalPath(from, to);
    }
  }

  /**
   * Straight line path
   */
  _straightPath(from, to) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  /**
   * Orthogonal (right-angle) path
   */
  _orthogonalPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Simple L-shaped path (can be enhanced with multi-segment routing)
    const midX = from.x + dx / 2;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
    } else {
      // Vertical dominant
      const midY = from.y + dy / 2;
      return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
    }
  }

  /**
   * Bezier curve path
   */
  _bezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Control points for smooth curve
    const cp1x = from.x + dx * 0.5;
    const cp1y = from.y;
    const cp2x = from.x + dx * 0.5;
    const cp2y = to.y;
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  }

  /**
   * Remove connection
   */
  removeConnection(id) {
    const connection = this.connections.get(id);
    if (!connection) return false;
    
    connection.element.remove();
    this.connections.delete(id);
    
    console.log(`Removed connection: ${id}`);
    return true;
  }

  /**
   * Update all connections for a component (when it moves)
   */
  _updateConnectionsForComponent(componentId) {
    this.connections.forEach((conn, id) => {
      if (conn.from === componentId || conn.to === componentId) {
        this._updateConnection(id);
      }
    });
  }

  /**
   * Update single connection path
   */
  _updateConnection(id) {
    const conn = this.connections.get(id);
    if (!conn) return;
    
    const fromPos = this.canvasManager.getComponentPosition(conn.from);
    const toPos = this.canvasManager.getComponentPosition(conn.to);
    
    if (fromPos && toPos) {
      const pathData = this._calculatePath(fromPos, toPos, conn.data.config.routing);
      conn.element.setAttribute('d', pathData);
    }
  }

  /**
   * Remove all connections for a component (when deleted)
   */
  _removeConnectionsForComponent(componentId) {
    const toRemove = [];
    
    this.connections.forEach((conn, id) => {
      if (conn.from === componentId || conn.to === componentId) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.removeConnection(id));
  }

  /**
   * Start connection drawing mode
   */
  _onConnectionModeClick(e) {
    const target = e.target.closest('.component');
    
    if (!this.drawingConnection && target) {
      // Start new connection
      const componentId = target.getAttribute('data-id');
      this.connectionStart = {
        id: componentId,
        position: this.canvasManager.getComponentPosition(componentId)
      };
      this.drawingConnection = true;
      
      // Create temporary line
      this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.tempConnection.setAttribute('stroke', '#7cc8ff');
      this.tempConnection.setAttribute('stroke-width', '2');
      this.tempConnection.setAttribute('stroke-dasharray', '5 5');
      this.tempConnection.setAttribute('x1', this.connectionStart.position.x);
      this.tempConnection.setAttribute('y1', this.connectionStart.position.y);
      this.connectionsGroup.appendChild(this.tempConnection);
      
      console.log(`Starting connection from: ${componentId}`);
      
    } else if (this.drawingConnection && target) {
      // Complete connection
      const endComponentId = target.getAttribute('data-id');
      
      if (endComponentId !== this.connectionStart.id) {
        const connectionId = `conn-${Date.now()}`;
        this.addConnection(connectionId, this.connectionStart.id, endComponentId);
      }
      
      this._cancelConnection();
    }
  }

  /**
   * Update temporary connection line
   */
  _updateTempConnection(e) {
    if (!this.tempConnection) return;
    
    const svgPoint = this._getSVGPoint(e.clientX, e.clientY);
    this.tempConnection.setAttribute('x2', svgPoint.x);
    this.tempConnection.setAttribute('y2', svgPoint.y);
  }

  /**
   * Cancel connection drawing
   */
  _cancelConnection() {
    if (this.tempConnection) {
      this.tempConnection.remove();
      this.tempConnection = null;
    }
    this.drawingConnection = false;
    this.connectionStart = null;
  }

  /**
   * Select connection (for deletion or editing)
   */
  _selectConnection(id) {
    const conn = this.connections.get(id);
    if (!conn) return;
    
    // Toggle selection
    const isSelected = conn.element.classList.contains('selected');
    
    // Deselect all
    this.connections.forEach(c => c.element.classList.remove('selected'));
    
    if (!isSelected) {
      conn.element.classList.add('selected');
      conn.element.setAttribute('stroke-width', '5');
      console.log(`Selected connection: ${conn.from} → ${conn.to}`);
    } else {
      conn.element.setAttribute('stroke-width', '3');
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
   * Get all connections as array
   */
  getAllConnections() {
    return Array.from(this.connections.values()).map(c => c.data);
  }

  /**
   * Clear all connections
   */
  clear() {
    this.connections.forEach((conn) => {
      conn.element.remove();
    });
    this.connections.clear();
    this._cancelConnection();
    console.log('Connections cleared');
  }

  /**
   * Export connections state
   */
  exportState() {
    return this.getAllConnections();
  }

  /**
   * Import connections state
   */
  importState(connections) {
    this.clear();
    
    connections.forEach(conn => {
      this.addConnection(conn.id, conn.fromId, conn.toId, conn.config);
    });
  }
}

// Export
window.ConnectionManager = ConnectionManager;
