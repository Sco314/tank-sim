/**
 * systemConfig.js - System configuration with realistic flow rates
 */
// Component template make expansion easier 
const COMPONENT_TEMPLATES = {
  pump: {
    fixed: { pumpType: 'fixed', capacity: 1.0, efficiency: 0.95 },
    variable: { pumpType: 'variable', capacity: 1.0, minSpeed: 0.1 },
    threeSpeed: { pumpType: '3-speed', speeds: [0.3, 0.6, 1.0] }
  },
  valve: {
    standard: { maxFlow: 0.5, responseTime: 0.1 }
  },
  tank: {
    small: { area: 1.0, maxHeight: 1.0 },
    large: { area: 2.0, maxHeight: 1.5 }
  }
};

const SYSTEM_CONFIG = {
  
  // ============================================================================
  // TANKS (Phase 4)
  // ============================================================================
  tanks: {
    mainTank: {
      id: 'tank1',
      name: 'Main Storage Tank',
      type: 'tank',
      
      // INCREASED: Larger tank for longer fill/drain times
      area: 2.0,              // Cross-sectional area (m²) - was 1.2
      maxHeight: 1.5,         // Maximum height (m) - was 1.0
      // maxVolume = 2.0 × 1.5 = 3.0 m³ (was 1.2 m³)
      
      initialVolume: 0,
      
      lowThreshold: 0.15,
      highThreshold: 0.85,
      
      svgElement: '#tank',
      levelRectHeight: 360,
      levelRectY: 360,
      position: [340, 120],
      
      inputs: ['pipe2'],
      outputs: ['pipe3']
    }
  },
  
  // ============================================================================
  // PUMPS (Phase 2)
  // ============================================================================
  pumps: {
    mainPump: {
      id: 'pump1',
      name: 'Main Centrifugal Pump',
      type: 'pump',
      pumpType: 'fixed',
      
      // REDUCED: Smaller pump capacity for longer drain times
      capacity: 0.5,          // Max flow rate (m³/s) - was 1.2
      efficiency: 0.95,
      power: 5.5,
      
      initialSpeed: 0,
      requiresMinLevel: 0.05,
      
      cavitation: {
        enabled: false,
        triggerTime: 60,
        duration: 5,
        flowReduction: 0.3
      },
      
      svgElement: '#pump',
      position: [790, 460],
      
      inputs: ['inletValve'],
      outputs: ['pump1'],
      
      modalTitle: 'Main Pump Control'
    }
  },
  
  // ============================================================================
  // VALVES (Phase 3)
  // ============================================================================
  valves: {
    inlet: {
      id: 'inletValve',
      name: 'Inlet Valve',
      type: 'valve',
      
      // REDUCED: Smaller inlet flow for longer fill times
      maxFlow: 0.3,           // Max flow rate (m³/s) - was 0.8
      initialPosition: 0,
      responseTime: 0.1,
      
      svgElement: '#valve',
      position: [230, 53],
      
      inputs: [''],             // No source component (valve generates flow) source from outside source
      outputs: ['tank1'],
      
      modalTitle: 'Inlet Valve Control',
      iframeUrl: 'valve.html'
    },
    
    outlet: {
      id: 'outletValve',
      name: 'Outlet Valve',
      type: 'valve',
      
      // REDUCED: Match pump capacity
      maxFlow: 0.6,           // Max flow rate (m³/s) - was 1.2
      initialPosition: 1.0,
      responseTime: 0.1,
      
      svgElement: '#outletValve',
      position: [890, 278],
      
      inputs: ['pump1'],
      outputs: ['drain'],
      
      modalTitle: 'Outlet Valve Control',
      iframeUrl: 'valve.html'
    }
  },
  
  // ============================================================================
  // PRESSURE SENSORS (Phase 5)
  // ============================================================================
  pressureSensors: {
    tankBottom: {
      id: 'p1',
      name: 'Tank Bottom Pressure',
      type: 'sensor',
      
      range: [0, 2],
      units: 'bar',
      accuracy: 0.01,
      
      measurementPoint: 'tank_bottom',
      heightOffset: 0,
      
      lowAlarm: null,
      highAlarm: 1.5,
      
      inputs: ['tank1'],
      outputs: [],
      
      svgElement: null,
      position: [340, 480]
    },
    
    pumpInlet: {
      id: 'p2',
      name: 'Pump Suction Pressure',
      type: 'sensor',
      
      range: [0, 2],
      units: 'bar',
      accuracy: 0.01,
      
      measurementPoint: 'pump_inlet',
      heightOffset: 0.5,
      
      lowAlarm: 0.5,
      highAlarm: null,
      
      inputs: ['tank1'],
      outputs: ['pump1'],
      
      svgElement: null,
      position: [660, 460]
    },
    
    pumpOutlet: {
      id: 'p3',
      name: 'Pump Discharge Pressure',
      type: 'sensor',
      
      range: [0, 15],
      units: 'bar',
      accuracy: 0.01,
      
      measurementPoint: 'pump_outlet',
      heightOffset: 0.5,
      
      lowAlarm: null,
      highAlarm: 12,
      
      inputs: ['pump1'],
      outputs: ['outletValve'],
      
      svgElement: null,
      position: [815, 460]
    },
    
    systemOutlet: {
      id: 'p4',
      name: 'System Outlet Pressure',
      type: 'sensor',
      
      range: [0, 10],
      units: 'bar',
      accuracy: 0.01,
      
      measurementPoint: 'static',
      heightOffset: -0.3,
      
      lowAlarm: 1,
      highAlarm: 8,
      
      inputs: ['outletValve'],
      outputs: ['drain'],
      
      svgElement: null,
      position: [960, 295]
    }
  },
  
  // ============================================================================
  // PIPES (Phase 6)
  // ============================================================================
  pipes: {
  sourceToInlet: {
    id: 'pipe1',
    name: 'Source to Inlet Valve',
    type: 'pipe',
    diameter: 0.05,
    length: 0.5,
    svgElement: '#pipe1Flow',
    inputs: ['source'],
    outputs: ['inletValve']
  },
  
  inletToTank: {
    id: 'pipe2',
    name: 'Inlet Valve to Tank',
    type: 'pipe',
    diameter: 0.05,
    length: 1.0,
    svgElement: '#pipe2Flow',
    inputs: ['inletValve'],
    outputs: ['tank1']
  },
  
  tankToPump: {
    id: 'pipe3',
    name: 'Tank to Pump',
    type: 'pipe',
    diameter: 0.05,
    length: 0.5,
    svgElement: '#pipe3Flow',
    inputs: ['tank1'],
    outputs: ['pump1']
  },
  
  pumpToOutlet: {
    id: 'pipe4',
    name: 'Pump to Outlet Valve',
    type: 'pipe',
    diameter: 0.05,
    length: 1.5,
    svgElement: '#pipe4Flow',
    inputs: ['pump1'],
    outputs: ['outletValve']
  },
  
  outletToDrain: {
    id: 'pipe5',
    name: 'Outlet Valve to Drain',
    type: 'pipe',
    diameter: 0.05,
    length: 0.5,
    svgElement: '#pipe5Flow',
    inputs: ['outletValve'],
    outputs: ['drain']
  }
},
  
  // ============================================================================
  // GLOBAL SETTINGS
  // ============================================================================
  settings: {
    timeStep: 0.016,
    maxTimeStep: 0.1,
    
    gravity: 9.81,
    fluidDensity: 1000,
    
    updateInterval: 16,
    
    debugMode: true,
    logFlows: false
  }
};

// ============================================================================
// HELPER: Validate configuration
// ============================================================================
function validateConfig(config) {
  const errors = [];
  
  const allIds = new Set();
  
  for (const [category, items] of Object.entries(config)) {
    if (category === 'settings') continue;
    
    for (const [key, item] of Object.entries(items)) {
      if (allIds.has(item.id)) {
        errors.push(`Duplicate ID found: ${item.id}`);
      }
      allIds.add(item.id);
    }
  }
  
  if (errors.length > 0) {
    console.error('Configuration validation errors:', errors);
    return false;
  }
  
  console.log('✓ Configuration validated successfully');
  return true;
}

// ============================================================================
// EXPORT
// ============================================================================
window.SYSTEM_CONFIG = SYSTEM_CONFIG;
window.validateConfig = validateConfig;

// Auto-validate on load
if (validateConfig(SYSTEM_CONFIG)) {
  console.log('✅ System configuration loaded and validated');
  console.log('📋 Components:', {
    tanks: Object.keys(SYSTEM_CONFIG.tanks).length,
    pumps: Object.keys(SYSTEM_CONFIG.pumps).length,
    valves: Object.keys(SYSTEM_CONFIG.valves).length,
    pressureSensors: Object.keys(SYSTEM_CONFIG.pressureSensors).length
  });
}
