/**
 * componentLibrary.js - Component definitions for designer
 * FIXED: Separate pump types with correct icons
 */

const COMPONENT_LIBRARY = {
  // === SOURCES ===
  feed: {
    name: 'Feed (Water Supply)',
    category: 'Boundary',
    type: 'feed',
    icon: '💧',
    color: '#3b82f6',
    description: 'Infinite water supply',
    config: {
      type: 'feed',
      supplyPressure: 3,
      maxFlow: null,
      temperature: 20
    },
    connectionPoints: [
      { name: 'outlet', type: 'output', x: 20, y: 0 }
    ]
  },
  
  // === SINKS ===
  drain: {
    name: 'Drain (Discharge)',
    category: 'Boundary',
    type: 'drain',
    icon: '🚰',
    color: '#6366f1',
    description: 'Infinite discharge capacity',
    config: {
      type: 'drain',
      ambientPressure: 1,
      maxCapacity: null
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -20, y: 0 }
    ]
  },
  
  // === TANKS ===
  tank: {
    name: 'Tank',
    category: 'Storage',
    type: 'tank',
    icon: '🛢️',
    color: '#8b5cf6',
    description: 'Liquid storage tank',
    image: 'https://sco314.github.io/tank-sim/Tank-Icon-Transparent-bg.png',
    imageSize: { w: 160, h: 180, x: -80, y: -90 },
    config: {
      type: 'tank',
      capacity: 10,
      initialLevel: 2,
      maxLevel: 9.5
    },
    connectionPoints: [
      { name: 'top', type: 'input', x: 0, y: -90 },
      { name: 'bottom', type: 'output', x: 0, y: 90 },
      { name: 'left', type: 'both', x: -80, y: 0 },
      { name: 'right', type: 'both', x: 80, y: 0 }
    ]
  },
  
  // === PUMPS - FIXED: Separate entries with correct icons ===
  fixedPump: {
    name: 'Fixed Speed Pump',
    category: 'Pumps',
    type: 'pumpFixed',
    icon: '⚙️',
    color: '#ec4899',
    description: 'ON/OFF pump (100% when running)',
    image: 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    config: {
      type: 'pumpFixed',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -60, y: 0 },
      { name: 'outlet', type: 'output', x: 60, y: 0 }
    ]
  },
  
  variablePump: {
    name: 'Variable Speed Pump',
    category: 'Pumps',
    type: 'pumpVariable',
    icon: '🔄',
    color: '#ec4899',
    description: 'VFD pump (0-100% speed control)',
    image: 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    config: {
      type: 'pumpVariable',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1,
      minSpeed: 0.2
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -60, y: 0 },
      { name: 'outlet', type: 'output', x: 60, y: 0 }
    ]
  },
  
  threeSpeedPump: {
    name: '3-Speed Pump',
    category: 'Pumps',
    type: 'pump3Speed',
    icon: '⚡',
    color: '#ec4899',
    description: 'Multi-speed pump (Low/Med/High)',
    image: 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    config: {
      type: 'pump3Speed',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1,
      speeds: [0.3, 0.6, 1.0]
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -60, y: 0 },
      { name: 'outlet', type: 'output', x: 60, y: 0 }
    ]
  },
  
  // === VALVES ===
  valve: {
    name: 'Control Valve',
    category: 'Valves',
    type: 'valve',
    icon: '🔧',
    color: '#10b981',
    description: 'Proportional control valve (0-100%)',
    image: 'https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png',
    imageSize: { w: 76, h: 76, x: -38, y: -38 },
    config: {
      type: 'valve',
      open: 82,
      kv: 1
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -38, y: 0 },
      { name: 'outlet', type: 'output', x: 38, y: 0 }
    ]
  },
  
  // === SENSORS ===
  pressureSensor: {
    name: 'Pressure Sensor',
    category: 'Sensors',
    type: 'pressureSensor',
    icon: '📊',
    color: '#f59e0b',
    description: 'Pressure measurement',
    config: {
      type: 'pressureSensor',
      range: [0, 10],
      units: 'bar'
    },
    connectionPoints: [
      { name: 'tap', type: 'input', x: 0, y: 0 }
    ]
  },
  
  flowSensor: {
    name: 'Flow Sensor',
    category: 'Sensors',
    type: 'flowSensor',
    icon: '🌊',
    color: '#f59e0b',
    description: 'Flow rate measurement',
    config: {
      type: 'flowSensor',
      range: [0, 5],
      units: 'm³/s'
    },
    connectionPoints: [
      { name: 'inlet', type: 'input', x: -20, y: 0 },
      { name: 'outlet', type: 'output', x: 20, y: 0 }
    ]
  },
  
  levelSensor: {
    name: 'Level Sensor',
    category: 'Sensors',
    type: 'levelSensor',
    icon: '📏',
    color: '#f59e0b',
    description: 'Tank level measurement',
    config: {
      type: 'levelSensor',
      range: [0, 100],
      units: '%'
    },
    connectionPoints: [
      { name: 'probe', type: 'input', x: 0, y: 0 }
    ]
  }
};

// Category organization for library UI
const CATEGORIES = {
  'Boundary': ['feed', 'drain'],
  'Storage': ['tank'],
  'Pumps': ['fixedPump', 'variablePump', 'threeSpeedPump'],
  'Valves': ['valve'],
  'Sensors': ['pressureSensor', 'flowSensor', 'levelSensor']
};

// Export
window.COMPONENT_LIBRARY = COMPONENT_LIBRARY;
window.CATEGORIES = CATEGORIES;

console.log('✅ Component Library loaded:', Object.keys(COMPONENT_LIBRARY).length, 'components');
