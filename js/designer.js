/**
 * designer.js - CRITICAL UPDATES for Exporter v3.2+ Compatibility
 * 
 * Key changes:
 * 1. Components now include `orientation` field (R/L/U/D)
 * 2. Components include normalized `ports` object with connection points
 * 3. Pipe connections use "componentId.portName" format
 * 4. Type capitalization matches manager expectations (Tank, Valve, Pump)
 */

// ADD THIS to _addFromPalette method:
_addFromPalette(item, pos) {
  const id = String(this.nextId++);
  
  // Get component definition from library
  const type = (item.type || item.key || '').toLowerCase();
  const lib = (this.componentLibrary?.components || {});
  const def = lib[type] || {};
  
  // ✅ NEW: Determine default orientation based on type
  let orientation = 'R'; // default right-facing
  if (type === 'tank') {
    orientation = 'U'; // upright
  } else if (type === 'drain') {
    orientation = 'L'; // left-facing inlet
  } else if (type === 'feed') {
    orientation = 'R'; // right-facing outlet
  } else if (type === 'pump') {
    orientation = 'L'; // inlet on left by default
  }
  
  // ✅ NEW: Get normalized connection ports from library or compute defaults
  let ports = {};
  if (def.connectionPoints && def.connectionPoints.length > 0) {
    // Use library-defined ports (already normalized 0-100)
    def.connectionPoints.forEach(cp => {
      const portName = (cp.name || cp.id || 'port').toUpperCase();
      ports[portName] = {
        x: cp.x || 0,
        y: cp.y || 0
      };
    });
  } else {
    // Compute default ports based on type
    if (type === 'tank') {
      ports = {
        IN:  { x: 50, y: 10 },  // top inlet
        OUT: { x: 50, y: 90 }   // bottom outlet
      };
    } else if (type === 'feed') {
      ports = {
        OUT: { x: 95, y: 50 }   // right outlet only
      };
    } else if (type === 'drain') {
      ports = {
        IN: { x: 5, y: 50 }     // left inlet only
      };
    } else if (['pump', 'valve', 'pipe'].includes(type)) {
      ports = {
        IN:  { x: 5,  y: 50 },  // left inlet
        OUT: { x: 95, y: 50 }   // right outlet
      };
    } else {
      // Generic 4-port layout
      ports = {
        LEFT:   { x: 5,  y: 50 },
        RIGHT:  { x: 95, y: 50 },
        TOP:    { x: 50, y: 5  },
        BOTTOM: { x: 50, y: 95 }
      };
    }
  }
  
  const comp = {
    id,
    key: item.key,
    type: this._capitalizeType(item.type), // ✅ NEW: Capitalize for managers
    name: item.label || item.type,
    x: pos.x,
    y: pos.y,
    orientation, // ✅ NEW: Include orientation
    ports,       // ✅ NEW: Include normalized ports
    config: {}
  };
  
  this.components.set(id, comp);
  this._renderComponent(comp);
  
  console.log(`Added ${comp.name} at (${pos.x}, ${pos.y}) with orientation ${orientation}`);
}

// ✅ NEW: Helper to capitalize type names for manager compatibility
_capitalizeType(type) {
  if (!type) return type;
  const normalized = type.toLowerCase();
  // Map to manager-expected names
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

// UPDATE _completeConnection method to use port-based format:
_completeConnection(targetComponentId) {
  const fromId = this.connectionStart;
  const toId = targetComponentId;
  const fromComp = this.components.get(fromId);
  const toComp   = this.components.get(toId);

  // Choose nearest CP on the "from" component
  const fromCenter = this._getComponentCenter(fromComp);
  const fromCP = this._getNearestConnectionPoint(fromComp, fromCenter.x, fromCenter.y);

  // Choose nearest CP on the "to" component relative to the "from" CP
  const toCP = this._getNearestConnectionPoint(toComp, fromCP.x, fromCP.y);

  const id = `conn${this.nextConnectionId++}`;
  
  // ✅ NEW: Store connection with port-based references
  const connection = {
    id,
    from: fromId,
    to: toId,
    fromPoint: fromCP.id || fromCP.name || 'OUT', // ✅ Store port name
    toPoint:   toCP.id   || toCP.name   || 'IN'   // ✅ Store port name
  };
  
  this.connections.push(connection);
  this._renderConnection(connection);

  this._cancelConnection();
  console.log(`Connected ${fromComp.name}.${connection.fromPoint} → ${toComp.name}.${connection.toPoint}`);
}

// UPDATE exportDesignJSON to include all new fields:
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
      type: c.type,           // ✅ Capitalized type
      name: c.name,
      x: c.x,
      y: c.y,
      orientation: c.orientation, // ✅ NEW
      ports: c.ports,            // ✅ NEW
      config: c.config || {}
    })),
    connections: this.connections.map(conn => ({
      id: conn.id,
      from: conn.from,
      to: conn.to,
      fromPoint: conn.fromPoint, // ✅ Port name
      toPoint: conn.toPoint      // ✅ Port name
    })),
    nextId: this.nextId,
    nextConnectionId: this.nextConnectionId,
    gridSize: this.gridSize
  };
  return JSON.stringify(config, null, 2);
}

// ADD helper method for orientation rotation:
_getOrientationRotation(orientation) {
  const rotations = {
    'R': 0,    // right-facing (default)
    'D': 90,   // down-facing
    'L': 180,  // left-facing
    'U': 270   // up-facing
  };
  return rotations[orientation] || 0;
}

// UPDATE _renderComponent to apply orientation rotation:
_renderComponent(comp) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('canvas-component');
  g.dataset.id = comp.id;
  
  // ✅ NEW: Apply orientation rotation
  const rotation = this._getOrientationRotation(comp.orientation);
  g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${rotation})`);

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
    
    // ✅ NEW: Choose image based on orientation for pumps
    let imageUrl = def.image;
    if (type === 'pump' && comp.orientation) {
      if (comp.orientation === 'L') {
        imageUrl = 'assets/cent-pump-inlet-left-01.svg';
      } else if (comp.orientation === 'R') {
        imageUrl = 'assets/cent-pump-inlet-right-01.svg';
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
  label.
