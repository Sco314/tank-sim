/**
 * systemConfig.js - System configuration for Phase 5 testing
 * 
 * Now includes Pressure Sensors
 */

const SYSTEM_CONFIG = {
  
  // ============================================================================
  // TANKS (Phase 4)
  // ============================================================================
  tanks: {
    mainTank: {
      id: 'tank1',
      name: 'Main Storage Tank',
      type: 'tank',
      
      // Physical properties
      area: 1.2,              // Cross-sectional area (m²)
      maxHeight: 1.0,         // Maximum height (m)
      // maxVolume calculated as area × maxHeight = 1.2 m³
      
      // Initial state
      initialVolume: 0,       // Start empty
      
      // Thresholds for warnings
      lowThreshold: 0.15,     // Warn when < 15%
      highThreshold: 0.85,    // Warn when > 85%
      
      // Visual properties (matches SVG)
      svgElement: '#tank',
      levelRectHeight: 360,   // Height of the level rect in pixels
      levelRectY: 360,        // Base Y position (top of empty tank)
      position: [340, 120],
      
      // Connections
      inputs: ['inletValve'],
      outputs: ['pump1']
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
      
      capacity: 1.2,
      efficiency: 0.95,
      power: 5.5,
      
      initialSpeed: 0,
      
      // Pump requires minimum tank level to operate
      requiresMinLevel: 0.05,  // Won't run if tank < 5%
      
      cavitation: {
        enabled: false,
        triggerTime: 60,
        duration: 5,
        flowReduction: 0.3
      },
      
      svgElement: '#pump',
      position: [790, 460],
      
      inputs: ['tank1'],
      outputs: ['outletValve'],
      
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
      
      maxFlow: 0.8,
      initialPosition: 0,
      responseTime: 0.1,
      
      svgElement: '#valve',
      position: [230, 53],
      
      inputs: [],
      outputs: ['tank1'],
      
      modalTitle: 'Inlet Valve Control',
      iframeUrl: 'valve.html'
    },
    
    outlet: {
      id: 'outletValve',
      name: 'Outlet Valve',
      type: 'valve',
      
      maxFlow: 1.2,
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
  // PRESSURE SENSORS (Phase 5 - NEW!)
  // ============================================================================
  pressureSensors: {
    tankBottom: {
      id: 'p1',
      name: 'Tank Bottom Pressure',
      type: 'sensor',
      
      // Measurement properties
      range: [0, 2],            // 0-2 bar range
      units: 'bar',
      accuracy: 0.01,           // ±0.01 bar
      
      // Location
      measurementPoint: 'tank_bottom',
      heightOffset: 0,          // At base level
      
      // Alarms
      lowAlarm: null,           // No low alarm
      highAlarm: 1.5,           // Warn if > 1.5 bar
      
      // Connections (reads from tank)
      inputs: ['tank1'],
      outputs: [],
      
      // Visual
      svgElement: null,         // No SVG element (status panel only)
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
      heightOffset: 0.5,        // Pump inlet is 0.5m above base
      
      lowAlarm: 0.5,            // Warn if suction < 0.5 bar (cavitation risk)
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
      
      range: [0, 15],           // Higher range for pump discharge
      units: 'bar',
      accuracy: 0.01,
      
      measurementPoint: 'pump_outlet',
      heightOffset: 0.5,
      
      lowAlarm: null,
      highAlarm: 12,            // Warn if discharge > 12 bar
      
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
      heightOffset: -0.3,       // Outlet is slightly below pump
      
      lowAlarm: 1,              // Warn if delivery < 1 bar
      highAlarm: 8,
      
      inputs: ['outletValve'],
      outputs: ['drain'],
      
      svgElement: null,
      position: [960, 295]
    }
  },
  
  // ============================================================================
  // PIPES (Placeholder - Phase 6)
  // ============================================================================
  pipes: {},
  
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
  
  // Check for duplicate IDs
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
