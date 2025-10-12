/**
 * systemConfig.js - System configuration for Phase 2 testing
 * 
 * Minimal config to test fixed speed pump
 */

const SYSTEM_CONFIG = {
  
  // ============================================================================
  // PUMPS (Phase 2 Testing)
  // ============================================================================
  pumps: {
    mainPump: {
      id: 'pump1',
      name: 'Main Centrifugal Pump',
      type: 'pump',
      pumpType: 'fixed',     // Testing fixed speed pump
      
      // Physical properties
      capacity: 1.2,         // Max flow rate (m³/s)
      efficiency: 0.95,      // 0-1
      power: 5.5,            // kW
      
      // Operating parameters
      initialSpeed: 0,       // Start OFF
      
      // Cavitation feature (disabled for basic testing)
      cavitation: {
        enabled: false,      // Set to true to test cavitation
        triggerTime: 60,     // Cavitate after 60 seconds
        duration: 5,         // Lasts 5 seconds
        flowReduction: 0.3   // Flow reduced to 30%
      },
      
      // Visual properties
      svgElement: '#pump',
      position: [790, 460],
      
      // Connections
      inputs: ['tank1'],
      outputs: ['drain'],
      
      // UI
      modalTitle: 'Main Pump Control'
    }
  },
  
  // ============================================================================
  // TANKS (Placeholder - not implemented yet)
  // ============================================================================
  tanks: {},
  
  // ============================================================================
  // VALVES (Phase 3)
  // ============================================================================
  valves: {
    inlet: {
      id: 'inletValve',
      name: 'Inlet Valve',
      type: 'valve',
      
      // Physical properties
      maxFlow: 0.8,           // Max flow rate when fully open (m³/s)
      
      // Operating parameters
      initialPosition: 0,     // 0 = closed, 1 = fully open
      responseTime: 0.1,      // Time to change position (seconds)
      
      // Visual properties
      svgElement: '#valve',
      position: [230, 53],
      
      // Connections
      inputs: ['source'],     // Special: 'source' = infinite supply
      outputs: ['tank1'],
      
      // UI
      modalTitle: 'Inlet Valve Control',
      iframeUrl: 'valve.html'
    },
    
    outlet: {
      id: 'outletValve',
      name: 'Outlet Valve',
      type: 'valve',
      
      maxFlow: 1.2,
      initialPosition: 1.0,   // Starts fully open
      responseTime: 0.1,
      
      svgElement: '#outletValve',
      position: [890, 278],
      
      inputs: ['pump1'],
      outputs: ['drain'],     // Special: 'drain' = infinite sink
      
      modalTitle: 'Outlet Valve Control',
      iframeUrl: 'valve.html'
    }
  },
  
  // ============================================================================
  // PIPES (Placeholder - not implemented yet)
  // ============================================================================
  pipes: {},
  
  // ============================================================================
  // PRESSURE SENSORS (Placeholder - not implemented yet)
  // ============================================================================
  pressureSensors: {},
  
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
    pumps: Object.keys(SYSTEM_CONFIG.pumps).length,
    tanks: Object.keys(SYSTEM_CONFIG.tanks).length,
    valves: Object.keys(SYSTEM_CONFIG.valves).length
  });
}