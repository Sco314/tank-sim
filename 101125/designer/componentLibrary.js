/** 
 * componentLibrary.js 
 * 
 * Adds per-component connectionPoints and exports helpers:
 *   - getConnectionPoint(component, pointId)
 *   - findNearestConnectionPoints(fromComp, toComp)
 */

const COMPONENT_LIBRARY = {
  // Boundary Components
  feed: {
    name: 'Feed',
    category: 'boundaries',
    icon: '⚡',
    description: 'Infinite supply source',
    color: '#10b981',
    connectionPoints: [
      { id: 'outlet', x: 40, y: 0, type: 'output' }
    ],
    defaultConfig: {
      type: 'feed',
      supplyPressure: 3.0,
      maxFlow: Infinity,
      temperature: 20
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Feed' },
      { name: 'supplyPressure', type: 'number', label: 'Supply Pressure (bar)', default: 3.0, min: 0, max: 10, step: 0.1 },
      { name: 'maxFlow', type: 'number', label: 'Max Flow (m³/s)', default: 'Infinity' },
      { name: 'temperature', type: 'number', label: 'Temperature (°C)', default: 20, min: -50, max: 150, step: 1 }
    ]
  },

  drain: {
    name: 'Drain',
    category: 'boundaries',
    icon: '⬇️',
    description: 'Infinite sink outlet',
    color: '#ef4444',
    connectionPoints: [
      { id: 'inlet', x: -40, y: 0, type: 'input' }
    ],
    defaultConfig: {
      type: 'drain',
      ambientPressure: 1.0,
      maxCapacity: Infinity
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Drain' },
      { name: 'ambientPressure', type: 'number', label: 'Ambient Pressure (bar)', default: 1.0, min: 0, max: 10, step: 0.1 },
      { name: 'maxCapacity', type: 'number', label: 'Max Capacity (m³/s)', default: 'Infinity' }
    ]
  },

  // Storage
  tank: {
    name: 'Tank',
    category: 'storage',
    icon: '🛢️',
    description: 'Vertical storage tank',
    color: '#3b82f6',
    // Tank sprite footprint: 160x180 centered at (-80,-90)
    connectionPoints: [
      { id: 'left',   x: -80, y: 0,   type: 'both' },
      { id: 'right',  x:  80, y: 0,   type: 'both' },
      { id: 'top',    x:   0, y: -90, type: 'both' },
      { id: 'bottom', x:   0, y:  90, type: 'both' }
    ],
    defaultConfig: {
      type: 'tank',
      capacity: 10.0,
      initialLevel: 2.0,
      maxLevel: 9.5
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Tank' },
      { name: 'capacity', type: 'number', label: 'Capacity (m³)', default: 10.0, min: 0, max: 1000, step: 0.1 },
      { name: 'initialLevel', type: 'number', label: 'Initial Level (m)', default: 2.0, min: 0, max: 20, step: 0.1 },
      { name: 'maxLevel', type: 'number', label: 'Max Safe Level (m)', default: 9.5, min: 0, max: 20, step: 0.1 }
    ]
  },

  // Pumps
  fixedPump: {
    name: 'Fixed Speed Pump',
    category: 'pumps',
    icon: '⚙️',
    description: 'Constant-speed pump',
    color: '#10b981',
    // Pump sprite footprint: ~120x120 centered at (-60,-60)
    connectionPoints: [
      { id: 'inlet',  x: -60, y: 0, type: 'input' },
      { id: 'outlet', x:  60, y: 0, type: 'output' }
    ],
    defaultConfig: {
      type: 'pumpFixed',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1.0
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Fixed Pump' },
      { name: 'head', type: 'number', label: 'Head (m)', default: 10, min: 0, max: 200, step: 0.5 },
      { name: 'efficiency', type: 'number', label: 'Efficiency (0-1)', default: 0.7, min: 0, max: 1, step: 0.01 },
      { name: 'maxFlow', type: 'number', label: 'Max Flow (m³/s)', default: 1.0, min: 0, max: 10, step: 0.1 }
    ]
  },

  variablePump: {
    name: 'Variable Speed Pump',
    category: 'pumps',
    icon: '⚙️',
    description: 'Adjustable-speed pump',
    color: '#059669',
    // Pump sprite footprint: ~120x120 centered at (-60,-60)
    connectionPoints: [
      { id: 'inlet',  x: -60, y: 0, type: 'input' },
      { id: 'outlet', x:  60, y: 0, type: 'output' }
    ],
    defaultConfig: {
      type: 'pumpVariable',
      headCurve: [ [0, 20], [0.5, 15], [1.0, 10] ],
      minSpeed: 0.3,
      maxSpeed: 1.0
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Variable Pump' },
      { name: 'minSpeed', type: 'number', label: 'Min Speed (0-1)', default: 0.3, min: 0, max: 1, step: 0.01 },
      { name: 'maxSpeed', type: 'number', label: 'Max Speed (0-1)', default: 1.0, min: 0, max: 1, step: 0.01 }
    ]
  },

  // Valves
  valve: {
    name: 'Valve',
    category: 'valves',
    icon: '🔧',
    description: 'Manual valve with open/close',
    color: '#f59e0b',
    // Valve sprite footprint: 76x76 centered at (-38,-38)
    connectionPoints: [
      { id: 'inlet',  x: -38, y: 0, type: 'input' },
      { id: 'outlet', x:  38, y: 0, type: 'output' }
    ],
    defaultConfig: {
      type: 'valve',
      open: true,
      kv: 1.0
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Valve' },
      { name: 'open', type: 'number', label: 'Open (0-1)', default: 1.0, min: 0, max: 1, step: 0.01 },
      { name: 'kv', type: 'number', label: 'Kv (m³/h·bar^0.5)', default: 1.0, min: 0, max: 100, step: 0.1 }
    ]
  },

  // Sensors
  pressureSensor: {
    name: 'Pressure Sensor',
    category: 'sensors',
    icon: '📊',
    description: 'Pressure measurement',
    color: '#06b6d4',
    // Sensor attach point at center, optional tees left/right
    connectionPoints: [
      { id: 'probe', x: 0, y: 0, type: 'both' },
      { id: 'left',  x: -20, y: 0, type: 'both' },
      { id: 'right', x:  20, y: 0, type: 'both' }
    ],
    defaultConfig: {
      type: 'sensor',
      measurementPoint: 'static',
      range: [0, 10],
      alarmLow: 0.5,
      alarmHigh: 8
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Pressure Sensor' },
      { name: 'rangeMin', type: 'number', label: 'Range Min (bar)', default: 0, min: 0, max: 100 },
      { name: 'rangeMax', type: 'number', label: 'Range Max (bar)', default: 10, min: 0, max: 100 },
      { name: 'alarmLow', type: 'number', label: 'Low Alarm (bar)', default: 0.5, min: 0, max: 100, step: 0.1 },
      { name: 'alarmHigh', type: 'number', label: 'High Alarm (bar)', default: 8, min: 0, max: 100, step: 0.1 }
    ]
  }
};

// Categories (unchanged)
const CATEGORIES = {
  boundaries: {
    name: 'Boundary Conditions',
    icon: '🔌',
    description: 'Sources and sinks'
  },
  storage: {
    name: 'Storage',
    icon: '🗄️',
    description: 'Tanks and vessels'
  },
  pumps: {
    name: 'Pumps',
    icon: '⚙️',
    description: 'Flow movers'
  },
  valves: {
    name: 'Valves',
    icon: '🔧',
    description: 'Flow controllers'
  },
  sensors: {
    name: 'Sensors',
    icon: '📊',
    description: 'Measurement devices'
  }
};

// === Connection point helpers ===
function getConnectionPoint(component, pointId) {
  const def = COMPONENT_LIBRARY[component.key];
  const pts = def && def.connectionPoints;
  if (!pts || pts.length === 0) {
    return { x: component.x, y: component.y }; // fallback center
  }
  const found = pts.find(p => p.id === pointId) || pts[0];
  return { x: component.x + (found.x || 0), y: component.y + (found.y || 0) };
}

function findNearestConnectionPoints(fromComp, toComp) {
  const fromDef = COMPONENT_LIBRARY[fromComp.key] || {};
  const toDef = COMPONENT_LIBRARY[toComp.key] || {};
  const fromPts = (fromDef.connectionPoints && fromDef.connectionPoints.filter(p => p.type !== 'input')) || [{ id: 'center', x: 0, y: 0 }];
  const toPts   = (toDef.connectionPoints   && toDef.connectionPoints.filter(p => p.type !== 'output')) || [{ id: 'center', x: 0, y: 0 }];

  let bestFrom = fromPts[0], bestTo = toPts[0], minDist = Infinity;
  for (const f of fromPts) {
    const fx = fromComp.x + (f.x || 0), fy = fromComp.y + (f.y || 0);
    for (const t of toPts) {
      const tx = toComp.x + (t.x || 0), ty = toComp.y + (t.y || 0);
      const dx = tx - fx, dy = ty - fy;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) { minDist = d2; bestFrom = f; bestTo = t; }
    }
  }
  return {
    from: { x: fromComp.x + (bestFrom.x || 0), y: fromComp.y + (bestFrom.y || 0), id: bestFrom.id },
    to:   { x: toComp.x   + (bestTo.x   || 0), y: toComp.y   + (bestTo.y   || 0), id: bestTo.id }
  };
}

// Verify export
console.log('✅ componentLibrary_with_points.js loaded');
console.log('📦 Components available:', Object.keys(COMPONENT_LIBRARY));
console.log('📁 Categories:', Object.keys(CATEGORIES));

// Export for use in designer
window.COMPONENT_LIBRARY = COMPONENT_LIBRARY;
window.CATEGORIES = CATEGORIES;
window.getConnectionPoint = getConnectionPoint;
window.findNearestConnectionPoints = findNearestConnectionPoints;
