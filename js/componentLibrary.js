/**
 * componentLibrary.js - Component definitions for designer
 * FIXED v3.3:
 * - Feed/Product components now work with dropdown visual variants in sidebar
 * - Tank 2x larger (320x360)
 * - Valve 1/3 smaller (25x25)
 * - Consistent SVG paths between designer and exporter
 * - Improved style isolation
 * - Added svgPath to all components for consistent asset loading
 * - Added svgPath and imageSize to pressure, flow, and level sensors
 * - Added orientation and scale to sensor defaultConfig for transform support
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
    imageSize: { w: 80, h: 80, x: -40, y: -40 }, // 2x larger (was 40x40)
    defaultConfig: {
      type: 'feed',
      supplyPressure: 3,
      maxFlow: null,
      flowRate: 0,
      temperature: 20,
      visual: 'chemistry'
    },
    properties: [
      { name: 'visual', label: 'Visual Style', type: 'select', default: 'chemistry',
        options: [
          { value: 'chemistry', label: 'Chemistry' },
          { value: 'pumpjack', label: 'Pumpjack' },
          { value: 'refinery', label: 'Refinery' }
        ]
      },
      { name: 'supplyPressure', label: 'Supply Pressure (bar)', type: 'number', default: 3, min: 0, step: 0.1 },
      { name: 'flowRate', label: 'Flow Rate (gpm)', type: 'number', default: 0, min: 0, step: 1 },
      { name: 'temperature', label: 'Temperature (°C)', type: 'number', default: 20, min: -10, max: 100 }
    ],
    connectionPoints: [
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 20, y: 0 }
    ],
    visualVariants: {
      chemistry: {
        svgPath: 'assets/sourceChemistry.svg',
        connectionPoints: [
          { id: 'cp_right', name: 'outlet', type: 'output', x: 71, y: 35.5 }
        ]
      },
      pumpjack: {
        svgPath: 'assets/sourcePumpjack.svg',
        connectionPoints: [
          { id: 'cp_right', name: 'outlet', type: 'output', x: 71, y: 35.5 }
        ]
      },
      refinery: {
        svgPath: 'assets/sourceRefinery.svg',
        connectionPoints: [
          { id: 'cp_right', name: 'outlet', type: 'output', x: 71, y: 35.5 }
        ]
      }
    }
  },

  // === SINKS ===
  drain: {
    name: 'Product (infinite drain)',
    category: 'Boundary',
    type: 'drain',
    icon: '🚰',
    color: '#6366f1',
    description: 'Infinite discharge capacity',
    imageSize: { w: 40, h: 40, x: -20, y: -20 },
    defaultConfig: {
      type: 'drain',
      ambientPressure: 1,
      maxCapacity: null,
      visual: 'chemistry'
    },
    properties: [
      { name: 'visual', label: 'Visual Style', type: 'select', default: 'chemistry',
        options: [
          { value: 'chemistry', label: 'Chemistry' },
          { value: 'pumpjack', label: 'Pumpjack' },
          { value: 'refinery', label: 'Refinery' }
        ]
      },
      { name: 'ambientPressure', label: 'Ambient Pressure (bar)', type: 'number', default: 1, min: 0, step: 0.1 }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -20, y: 0 }
    ],
    visualVariants: {
      chemistry: {
        svgPath: 'assets/sourceChemistry.svg',
        connectionPoints: [
          { id: 'cp_left', name: 'inlet', type: 'input', x: 6.3, y: 35.5 }
        ]
      },
      pumpjack: {
        svgPath: 'assets/sourcePumpjack.svg',
        connectionPoints: [
          { id: 'cp_left', name: 'inlet', type: 'input', x: 6.3, y: 35.5 }
        ]
      },
      refinery: {
        svgPath: 'assets/sourceRefinery.svg',
        connectionPoints: [
          { id: 'cp_left', name: 'inlet', type: 'input', x: 6.3, y: 35.5 }
        ]
      }
    }
  },
  
  // === TANKS === (2x LARGER)
  tank: {
    name: 'Tank',
    category: 'Storage',
    type: 'tank',
    icon: '🛢️',
    color: '#8b5cf6',
    description: 'Liquid storage tank with dynamic level display',
    image: 'https://sco314.github.io/tank-sim/assets/Tank-Icon-Transparent-bg.png',
    svg: 'Tankstoragevessel-dynamic.svg',
    svgPath: 'assets/Tankstoragevessel-dynamic.svg',
    imageSize: { w: 320, h: 360, x: -160, y: -180 }, // 2x larger
    defaultConfig: {
      type: 'tank',
      capacity: 10,
      initialLevel: 2,
      maxLevel: 9.5,
      levelPercent: 75,  // Visual fill level (0-100%)
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      { name: 'capacity', label: 'Capacity (m³)', type: 'number', default: 10, min: 0.1, step: 0.1 },
      { name: 'initialLevel', label: 'Initial Level (m³)', type: 'number', default: 2, min: 0, step: 0.1 },
      { name: 'maxLevel', label: 'Max Level (m³)', type: 'number', default: 9.5, min: 0, step: 0.1 },
      { name: 'levelPercent', label: 'Fill Level (%)', type: 'number', default: 75, min: 0, max: 100, step: 1 }
    ],
    connectionPoints: [
      { id: 'cp_top', name: 'top', type: 'input', x: 0, y: -180 },
      { id: 'cp_bottom', name: 'bottom', type: 'output', x: 0, y: 180 },
      { id: 'cp_left', name: 'left', type: 'both', x: -160, y: 0 },
      { id: 'cp_right', name: 'right', type: 'both', x: 160, y: 0 }
    ]
  },
  
  // === PUMPS ===
  fixedPump: {
    name: 'Fixed Speed Pump',
    category: 'Pumps',
    type: 'pumpFixed',
    icon: '⚙️',
    color: '#ec4899',
    description: 'ON/OFF pump (100% when running)',
    image: 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
    svg: 'cent-pump-inlet-left-01.svg',
    svgPath: 'assets/cent-pump-inlet-left-01.svg',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    defaultConfig: {
      type: 'pumpFixed',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1,
      orientation: 'L',
      scale: 1.0
    },
    properties: [
      { name: 'head', label: 'Head (m)', type: 'number', default: 10, min: 0, step: 0.5 },
      { name: 'efficiency', label: 'Efficiency', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 },
      { name: 'maxFlow', label: 'Max Flow (m³/s)', type: 'number', default: 1, min: 0, step: 0.1 }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -60, y: 0 },
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 60, y: 0 }
    ],
    variants: {
      left: {
        svg: 'cent-pump-inlet-left-01.svg',
        svgPath: 'assets/cent-pump-inlet-left-01.svg',
        connectionPoints: [
          { id: 'cp_inlet', name: 'inlet', type: 'input', x: -60, y: 0 },
          { id: 'cp_outlet', name: 'outlet', type: 'output', x: 60, y: 0 }
        ]
      },
      right: {
        svg: 'cent-pump-inlet-right-01.svg',
        svgPath: 'assets/cent-pump-inlet-right-01.svg',
        connectionPoints: [
          { id: 'cp_inlet', name: 'inlet', type: 'input', x: 60, y: 0 },
          { id: 'cp_outlet', name: 'outlet', type: 'output', x: -60, y: 0 }
        ]
      }
    }
  },

  variablePump: {
    name: 'Variable Speed Pump',
    category: 'Pumps',
    type: 'pumpVariable',
    icon: '🔄',
    color: '#ec4899',
    description: 'VFD pump (0-100% speed control)',
    image: 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
    svgPath: 'assets/pumpVariable.svg',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    defaultConfig: {
      type: 'pumpVariable',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1,
      minSpeed: 0.2,
      orientation: 'L',
      scale: 1.0
    },
    properties: [
      { name: 'head', label: 'Head (m)', type: 'number', default: 10, min: 0, step: 0.5 },
      { name: 'efficiency', label: 'Efficiency', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 },
      { name: 'maxFlow', label: 'Max Flow (m³/s)', type: 'number', default: 1, min: 0, step: 0.1 },
      { name: 'minSpeed', label: 'Min Speed', type: 'number', default: 0.2, min: 0, max: 1, step: 0.05 }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -60, y: 0 },
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 60, y: 0 }
    ],
    portsR: [
      { name: 'inlet', x: -60, y: 0 },
      { name: 'outlet', x: 60, y: 0 }
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
    svgPath: 'assets/pump3speed.svg',
    imageSize: { w: 120, h: 120, x: -60, y: -60 },
    defaultConfig: {
      type: 'pump3Speed',
      head: 10,
      efficiency: 0.7,
      maxFlow: 1,
      speeds: [0.3, 0.6, 1.0],
      orientation: 'L',
      scale: 1.0
    },
    properties: [
      { name: 'head', label: 'Head (m)', type: 'number', default: 10, min: 0, step: 0.5 },
      { name: 'efficiency', label: 'Efficiency', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 },
      { name: 'maxFlow', label: 'Max Flow (m³/s)', type: 'number', default: 1, min: 0, step: 0.1 }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -60, y: 0 },
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 60, y: 0 }
    ],
    portsR: [
      { name: 'inlet', x: -60, y: 0 },
      { name: 'outlet', x: 60, y: 0 }
    ]
  },
  
  // === VALVES === (1/3 SMALLER)
  valve: {
    name: 'Control Valve',
    category: 'Valves',
    type: 'valve',
    icon: '🔧',
    color: '#10b981',
    description: 'Proportional control valve (0-100%)',
    image: 'https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png',
    svg: 'Valve-Icon-handle-up-01.svg',
    svgPath: 'assets/Valve-Icon-handle-up-01.svg',
    imageSize: { w: 50, h: 50, x: -25, y: -25 }, // 2x larger (was 25x25)
    defaultConfig: {
      type: 'valve',
      open: 82,
      kv: 1,
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      { name: 'open', label: 'Opening (%)', type: 'number', default: 82, min: 0, max: 100, step: 1 },
      { name: 'kv', label: 'Kv Coefficient', type: 'number', default: 1, min: 0.1, step: 0.1 }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -25, y: 0 },
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 25, y: 0 }
    ],
    variants: {
      right: {
        svg: 'Valve-Icon-handle-right-01.svg',
        svgPath: 'assets/Valve-Icon-handle-right-01.svg',
        connectionPoints: [
          { id: 'cp_inlet', name: 'inlet', type: 'input', x: -25, y: 0 },
          { id: 'cp_outlet', name: 'outlet', type: 'output', x: 25, y: 0 }
        ]
      },
      left: {
        svg: 'Valve-Icon-handle-left-01.svg',
        svgPath: 'assets/Valve-Icon-handle-left-01.svg',
        connectionPoints: [
          { id: 'cp_inlet', name: 'inlet', type: 'input', x: -25, y: 0 },
          { id: 'cp_outlet', name: 'outlet', type: 'output', x: 25, y: 0 }
        ]
      },
      up: {
        svg: 'Valve-Icon-handle-up-01.svg',
        svgPath: 'assets/Valve-Icon-handle-up-01.svg',
        connectionPoints: [
          { id: 'cp_inlet', name: 'inlet', type: 'input', x: -25, y: 0 },
          { id: 'cp_outlet', name: 'outlet', type: 'output', x: 25, y: 0 }
        ]
      }
    }
  },
  
  // === SENSORS ===
  analogGauge: {
    name: 'Analog Gauge',
    category: 'Sensors',
    type: 'analogGauge',
    icon: '🎚️',
    color: '#f59e0b',
    description: 'Analog gauge display for pressure, flow, temperature, or level',
    svgPath: 'assets/gaugeAnalog.svg',
    imageSize: { w: 100, h: 100, x: -50, y: -50 },
    defaultConfig: {
      type: 'analogGauge',
      measurementType: 'pressure',
      minRange: 0,
      maxRange: 10,
      units: 'bar',
      decimals: 1,
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      {
        name: 'measurementType',
        label: 'Measurement Type',
        type: 'select',
        default: 'pressure',
        options: [
          { value: 'pressure', label: 'Pressure' },
          { value: 'flow', label: 'Flow Rate' },
          { value: 'temperature', label: 'Temperature' },
          { value: 'level', label: 'Level' }
        ]
      },
      { name: 'minRange', label: 'Min Range', type: 'number', default: 0, step: 0.1 },
      { name: 'maxRange', label: 'Max Range', type: 'number', default: 10, min: 0.1, step: 0.1 },
      {
        name: 'units',
        label: 'Units',
        type: 'select',
        default: 'bar',
        options: [
          { value: 'bar', label: 'bar (Pressure)' },
          { value: 'psi', label: 'psi (Pressure)' },
          { value: 'kPa', label: 'kPa (Pressure)' },
          { value: 'm³/s', label: 'm³/s (Flow)' },
          { value: 'L/min', label: 'L/min (Flow)' },
          { value: 'gpm', label: 'gpm (Flow)' },
          { value: '°C', label: '°C (Temperature)' },
          { value: '°F', label: '°F (Temperature)' },
          { value: 'K', label: 'K (Temperature)' },
          { value: '%', label: '% (Level)' },
          { value: 'm', label: 'm (Level)' }
        ]
      },
      { name: 'decimals', label: 'Decimal Places', type: 'number', default: 1, min: 0, max: 3, step: 1 }
    ],
    connectionPoints: [
      { id: 'cp_probe', name: 'probe', type: 'input', x: 0, y: 48 }
    ]
  },

  pressureSensor: {
    name: 'Pressure Sensor',
    category: 'Sensors',
    type: 'pressureSensor',
    icon: '📊',
    color: '#f59e0b',
    description: 'Pressure measurement',
    svgPath: 'assets/gaugeAnalog.svg',
    imageSize: { w: 80, h: 80, x: -40, y: -40 },
    defaultConfig: {
      type: 'pressureSensor',
      range: [0, 10],
      units: 'bar',
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      { name: 'range', label: 'Range (bar)', type: 'text', default: '0-10' }
    ],
    connectionPoints: [
      { id: 'cp_tap', name: 'tap', type: 'input', x: 0, y: 40 }
    ]
  },
  
  flowSensor: {
    name: 'Flow Sensor',
    category: 'Sensors',
    type: 'flowSensor',
    icon: '🌊',
    color: '#f59e0b',
    description: 'Flow rate measurement',
    svgPath: 'assets/gaugeAnalog.svg',
    imageSize: { w: 80, h: 80, x: -40, y: -40 },
    defaultConfig: {
      type: 'flowSensor',
      range: [0, 5],
      units: 'm³/s',
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      { name: 'range', label: 'Range (m³/s)', type: 'text', default: '0-5' }
    ],
    connectionPoints: [
      { id: 'cp_inlet', name: 'inlet', type: 'input', x: -40, y: 0 },
      { id: 'cp_outlet', name: 'outlet', type: 'output', x: 40, y: 0 }
    ]
  },
  
  levelSensor: {
    name: 'Level Sensor',
    category: 'Sensors',
    type: 'levelSensor',
    icon: '📏',
    color: '#f59e0b',
    description: 'Tank level measurement',
    svgPath: 'assets/gaugeAnalog.svg',
    imageSize: { w: 80, h: 80, x: -40, y: -40 },
    defaultConfig: {
      type: 'levelSensor',
      range: [0, 100],
      units: '%',
      orientation: 'R',
      scale: 1.0
    },
    properties: [
      { name: 'range', label: 'Range (%)', type: 'text', default: '0-100' }
    ],
    connectionPoints: [
      { id: 'cp_probe', name: 'probe', type: 'input', x: 0, y: 40 }
    ]
  }
};

// Get component list for sidebar (auto-generated)
window.getComponentList = function() {
  const lib = window.COMPONENT_LIBRARY;
  const iconMap = {
    feed: '💧',
    drain: '🚰',
    tank: '🪣',
    fixedPump: '⚙️',
    variablePump: '🔧',
    threeSpeedPump: '⚡',
    valve: '🔩',
    pipe: '🔗',
    pressureSensor: '📊',
    flowSensor: '🌊',
    levelSensor: '📏',
    sensor: '📊'
  };
  
  return Object.entries(lib).map(([key, def]) => ({
    key: key,
    label: def.name || def.label || key,
    type: def.type || key,
    icon: iconMap[key] || def.icon || '🔧',
    image: def.image
  }));
};

// Category organization with icon and name for UI
const CATEGORIES = {
  'Boundary': {
    name: 'Boundary',
    icon: '🌊',
    components: ['feed', 'drain']
  },
  'Storage': {
    name: 'Storage',
    icon: '🛢️',
    components: ['tank']
  },
  'Pumps': {
    name: 'Pumps',
    icon: '⚙️',
    components: ['fixedPump', 'variablePump', 'threeSpeedPump']
  },
  'Valves': {
    name: 'Valves',
    icon: '🔧',
    components: ['valve']
  },
  'Sensors': {
    name: 'Sensors',
    icon: '📊',
    components: ['analogGauge', 'pressureSensor', 'flowSensor', 'levelSensor']
  }
};

/**
 * Helper: Get the correct SVG file for a component based on its orientation/visual
 */
function getComponentSVG(component) {
  const def = COMPONENT_LIBRARY[component.key];
  if (!def) return null;

  // Check for visual variant (feed/drain)
  if (component.config?.visual && def.visualVariants) {
    const visualVariant = def.visualVariants[component.config.visual];
    if (visualVariant?.svgPath) return visualVariant.svgPath;
  }

  // Check if component has orientation and variants
  if (component.config?.orientation && def.variants) {
    const variant = def.variants[component.config.orientation];
    return variant?.svgPath || variant?.svg || def.svgPath || def.svg;
  }

  // Return default SVG
  return def.svgPath || def.svg || null;
}

/**
 * Helper: Get connection points for a component based on its orientation/visual
 */
function getComponentConnectionPoints(component) {
  const def = COMPONENT_LIBRARY[component.key];
  if (!def) return [];

  // Check for visual variant (feed/drain)
  if (component.config?.visual && def.visualVariants) {
    const visualVariant = def.visualVariants[component.config.visual];
    if (visualVariant?.connectionPoints) {
      return visualVariant.connectionPoints;
    }
  }

  // Check if component has orientation and variants
  if (component.config?.orientation && def.variants) {
    const variant = def.variants[component.config.orientation];
    return variant?.connectionPoints || def.connectionPoints || [];
  }

  // Return default connection points
  return def.connectionPoints || [];
}

// ✅ Export FIRST (before any console.log that uses them)
window.COMPONENT_LIBRARY = COMPONENT_LIBRARY;
window.CATEGORIES = CATEGORIES;
window.getComponentSVG = getComponentSVG;
window.getComponentConnectionPoints = getComponentConnectionPoints;

// ✅ Then log (after window.COMPONENT_LIBRARY exists)
console.log('✅ Component Library v3.3 loaded:', Object.keys(COMPONENT_LIBRARY).length, 'components');
console.log('✅ Scale adjustments: Tank 2x larger, Valve 1/3 smaller');
console.log('✅ SVG paths unified for designer and exporter');
console.log('✅ Sensors now have SVG paths and render correctly');
console.log('📌 Connection points: Enabled for designer hover markers');
console.log('🎨 SVG variants: Valve (3), Pump (2), Feed/Product (3 each)');
