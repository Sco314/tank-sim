/**
 * systemConfig.js - System configuration with component-only topology
 * 
 * Flow path: feed1 → inletValve → tank1 → pump1 → outletValve → drain
 * Pipes are visual only and read flows from the network
 */

const SYSTEM_CONFIG = {
  
  // ============================================================================
  // BOUNDARY CONDITIONS (New!)
  // ============================================================================
  feeds: {
    mainFeed: {
      id: 'feed1',
      name: 'Main Water Supply',
      type: 'feed',
      
      // Boundary properties
      supplyPressure: 3.0,    // bar (typical municipal water)
      maxFlow: Infinity,      // Unlimited supply
      temperature: 20,        // °C
      available: true,        // Supply available
      
      // Connections (no inputs, outputs to first valve)
      inputs: [],
      outputs: ['inletValve']
    }
  },
  
  drains: {
    mainDrain: {
      id: 'drain',
      name: 'System Discharge',
      type: 'drain',
      
      // Boundary properties
      ambientPressure: 1.0,   // bar (atmospheric)
      maxCapacity: Infinity,  // Unlimited discharge
      backpressure: 0,        // No resistance
      open: true,             // Drain open
      
      // Connections (inputs from last valve, no outputs)
      inputs: ['outletValve'],
      outputs: []
    }
  },
  
  // ============================================================================
  // VALVES
  // ============================================================================
  valves: {
    inlet: {
      id: 'inletValve',
      name: 'Inlet Valve',
      type: 'valve',
      
      // Physical properties
      maxFlow: 0.3,
      
      // Operating parameters
      initialPosition: 0,
      responseTime: 0.1,
      
      // Visual properties
      svgElement: '#valve',
      position: [230, 53],
      
      // Connections (component to component)
      inputs: ['feed1'],      // ← From feed
      outputs: ['tank1'],     // ← To tank
      
      // UI
      modalTitle: 'Inlet Valve Control',
      iframeUrl: 'valve.html'
    },
    
    outlet: {
      id: 'outletValve',
      name: 'Outlet Valve',
      type: 'valve',
      
      maxFlow: 0.6,
      initialPosition: 1.0,
      responseTime: 0.1,
      
      svgElement: '#outletValve',
      position: [890, 278],
      
      // Connections (component to component)
      inputs: ['pump1'],      // ← From pump
      outputs: ['drain'],     // ← To drain
      
      modalTitle: 'Outlet Valve Control',
      iframeUrl: 'valve.html'
    }
  },
  
  // ============================================================================
  // TANKS
  // ============================================================================
  tanks: {
    mainTank: {
      id: 'tank1',
      name: 'Main Storage Tank',
      type: 'tank',
      
      // Physical properties
      area: 2.5,              // m² (cross-sectional area)
      maxHeight: 1.2,         // m (height)
      // maxVolume = 2.5 × 1.2 = 3.0 m³
      
      // Initial conditions
      initialVolume: 0,       // Start empty
      
      // Visual properties
      svgElement: '#tank',
      position: [340, 120],
      levelRectHeight: 360,   // px
      levelRectY: 360,        // px
      
      // Thresholds
      lowThreshold: 0.1,      // 10% = low alarm
      highThreshold: 0.9,     // 90% = high alarm
      
      // Connections (component to component)
      inputs: ['inletValve'], // ← From inlet valve
      outputs: ['pump1']      // ← To pump
    }
  },
  
  // ============================================================================
  // PUMPS
  // ============================================================================
  pumps: {
    mainPump: {
      id: 'pump1',
      name: 'Main Centrifugal Pump',
      type: 'pump',
      pumpType: 'fixed',
      
      // Physical properties
      capacity: 0.5,          // m³/s (max flow rate)
      efficiency: 0.95,       // 95% efficient
      power: 5.5,             // kW
      
      // Operating parameters
      initialSpeed: 0,        // Start OFF
      requiresMinLevel: 0,    // No minimum level required
      
      // Cavitation (disabled for now)
      cavitation: {
        enabled: false,
        triggerTime: 60,
        duration: 5,
        flowReduction: 0.3
      },
      
      // Visual properties
      svgElement: '#pump',
      position: [790, 460],
      
      // Connections (component to component)
      inputs: ['tank1'],      // ← From tank
      outputs: ['outletValve'], // ← To outlet valve
      
      // UI
      modalTitle: 'Main Pump Control'
    }
  },
  
  // ============================================================================
  // PIPES (Visual Only - No Flow Routing)
  // ============================================================================
  pipes: {
    sourceToInlet: {
      id: 'pipe1',
      name: 'Source to Inlet Valve',
      type: 'pipe',
      
      diameter: 0.05,         // 50mm
      length: 0.5,            // 0.5m
      
      svgElement: '#pipe1Flow',
      
      // Visual connections (reads flow from feed1→inletValve)
      inputs: ['feed1'],
      outputs: ['inletValve']
    },
    
    inletToTank: {
      id: 'pipe2',
      name: 'Inlet Valve to Tank',
      type: 'pipe',
      
      diameter: 0.05,
      length: 1.0,
      
      svgElement: '#pipe2Flow',
      
      // Visual connections (reads flow from inletValve→tank1)
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
      
      // Visual connections (reads flow from tank1→pump1)
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
      
      // Visual connections (reads flow from pump1→outletValve)
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
      
      // Visual connections (reads flow from outletValve→drain)
      inputs: ['outletValve'],
      outputs: ['drain']
    }
  },
  
  // ============================================================================
  // PRESSURE SENSORS
  // ============================================================================
  pressureSensors: {
    tankBottom: {
      id: 'p1',
      name: 'Tank Bottom Pressure',
      type: 'sensor',
      
      measurementPoint: 'tank_bottom',
      range: [0, 2],          // 0-2 bar
      alarmLow: 0.5,          // Low pressure alarm
      alarmHigh: 1.8,         // High pressure alarm
      
      svgElement: null,       // Non-visual for now
      
      inputs: ['tank1'],
      outputs: []
    },
    
    pumpInlet: {
      id: 'p2',
      name: 'Pump Suction Pressure',
      type: 'sensor',
      
      measurementPoint: 'pump_inlet',
      range: [0, 2],
      alarmLow: 0.3,          // Cavitation risk
      alarmHigh: 1.8,
      
      svgElement: null,
      
      inputs: ['tank1'],
      outputs: ['pump1']
    },
    
    pumpOutlet: {
      id: 'p3',
      name: 'Pump Discharge Pressure',
      type: 'sensor',
      
      measurementPoint: 'pump_outlet',
      range: [0, 15],         // Higher range for discharge
      alarmLow: 0.5,
      alarmHigh: 12,          // Overpressure protection
      
      svgElement: null,
      
      inputs: ['pump1'],
      outputs: ['outletValve']
    },
    
    systemOutlet: {
      id: 'p4',
      name: 'System Outlet Pressure',
      type: 'sensor',
      
      measurementPoint: 'static',
      range: [0, 10],
      alarmLow: 0.8,
      alarmHigh: 8,
      
      svgElement: null,
      
      inputs: ['outletValve'],
      outputs: ['drain']
    }
  },
  
  // ============================================================================
  // COMPONENT TEMPLATES (for easy expansion)
  // ============================================================================
  templates: {
    pump: {
      fixed: { 
        pumpType: 'fixed', 
        capacity: 1.0, 
        efficiency: 0.95 
      },
      variable: { 
        pumpType: 'variable', 
        capacity: 1.0, 
        minSpeed: 0.1 
      },
      threeSpeed: { 
        pumpType: '3-speed', 
        speeds: [0.3, 0.6, 1.0] 
      }
    },
    valve: {
      standard: { 
        maxFlow: 0.5, 
        responseTime: 0.1 
      },
      slowActing: { 
        maxFlow: 0.5, 
        responseTime: 0.5 
      },
      quickActing: { 
        maxFlow: 0.5, 
        responseTime: 0.05 
      }
    },
    tank: {
      small: { 
        area: 1.0, 
        maxHeight: 1.0 
      },
      medium: { 
        area: 2.0, 
        maxHeight: 1.5 
      },
      large: { 
        area: 3.0, 
        maxHeight: 2.0 
      }
    },
    feed: {
      lowPressure: { 
        supplyPressure: 2.0, 
        maxFlow: Infinity 
      },
      highPressure: { 
        supplyPressure: 5.0, 
        maxFlow: Infinity 
      },
      limited: { 
        supplyPressure: 3.0, 
        maxFlow: 1.0 
      }
    },
    drain: {
      atmospheric: { 
        ambientPressure: 1.0, 
        maxCapacity: Infinity 
      },
      pressurized: { 
        ambientPressure: 2.0, 
        backpressure: 0.5 
      }
    }
  },
  
  // ============================================================================
  // GLOBAL SETTINGS
  // ============================================================================
  settings: {
    // Simulation
    timeStep: 0.016,          // Target dt (60 FPS)
    maxTimeStep: 0.1,         // Cap dt to prevent instability
    
    // Physics
    gravity: 9.81,            // m/s²
    fluidDensity: 1000,       // kg/m³ (water)
    
    // UI
    updateInterval: 16,       // Update UI every 16ms (60 FPS)
    
    // Debug
    debugMode: true,          // Show debug info in console
    logFlows: false           // Log flow rates to console
  }
};

// ============================================================================
// HELPER: Validate configuration
// ============================================================================
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  
  // Build list of all component IDs
  const allComponentIds = new Set();
  
  for (const [category, items] of Object.entries(config)) {
    if (category === 'settings' || category === 'templates') continue;
    
    for (const [key, item] of Object.entries(items)) {
      if (!item.id) {
        errors.push(`${category}.${key} missing ID`);
        continue;
      }
      
      // Check for duplicate IDs
      if (allComponentIds.has(item.id)) {
        errors.push(`Duplicate ID found: ${item.id}`);
      }
      allComponentIds.add(item.id);
    }
  }
  
  // Validate connections
  for (const [category, items] of Object.entries(config)) {
    if (category === 'settings' || category === 'templates') continue;
    
    for (const [key, item] of Object.entries(items)) {
      // Check inputs
      if (item.inputs) {
        for (const inputId of item.inputs) {
          if (!allComponentIds.has(inputId)) {
            errors.push(`${item.id}.inputs references missing component: ${inputId}`);
          }
        }
      }
      
      // Check outputs
      if (item.outputs) {
        for (const outputId of item.outputs) {
          if (!allComponentIds.has(outputId)) {
            errors.push(`${item.id}.outputs references missing component: ${outputId}`);
          }
        }
      }
      
      // Check boundary components
      if (item.type === 'feed' && item.inputs && item.inputs.length > 0) {
        warnings.push(`${item.id} is a feed but has inputs (should be empty)`);
      }
      if (item.type === 'drain' && item.outputs && item.outputs.length > 0) {
        warnings.push(`${item.id} is a drain but has outputs (should be empty)`);
      }
    }
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('❌ Configuration validation errors:', errors);
    return false;
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:', warnings);
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
    feeds: Object.keys(SYSTEM_CONFIG.feeds || {}).length,
    tanks: Object.keys(SYSTEM_CONFIG.tanks || {}).length,
    pumps: Object.keys(SYSTEM_CONFIG.pumps || {}).length,
    valves: Object.keys(SYSTEM_CONFIG.valves || {}).length,
    drains: Object.keys(SYSTEM_CONFIG.drains || {}).length,
    pressureSensors: Object.keys(SYSTEM_CONFIG.pressureSensors || {}).length
  });
}
