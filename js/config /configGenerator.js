/**
 * configGenerator.js - Converts design JSON to SYSTEM_CONFIG format
 */

class SystemConfigGenerator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main generation method
   */
  generate(designJSON) {
    console.log('Generating SYSTEM_CONFIG from design JSON...');
    
    this.errors = [];
    this.warnings = [];
    
    // Validate input
    if (!this._validate(designJSON)) {
      console.error('Validation failed:', this.errors);
      return null;
    }
    
    // Build config structure
    const config = {
      feeds: {},
      drains: {},
      tanks: {},
      pumps: {},
      valves: {},
      pipes: {},
      pressureSensors: {},
      settings: this._generateSettings(designJSON.settings)
    };
    
    // Process components
    Object.entries(designJSON.components || {}).forEach(([key, comp]) => {
      this._processComponent(key, comp, config);
    });
    
    // Process connections → pipes
    (designJSON.connections || []).forEach((conn, index) => {
      this._processConnection(conn, index, config, designJSON.components);
    });
    
    // Build inputs/outputs for each component
    this._buildConnectionGraph(config, designJSON.connections);
    
    console.log('✓ Config generated successfully');
    if (this.warnings.length > 0) {
      console.warn('Warnings:', this.warnings);
    }
    
    return config;
  }

  /**
   * Validate design JSON
   */
  _validate(designJSON) {
    if (!designJSON || typeof designJSON !== 'object') {
      this.errors.push('Invalid JSON structure');
      return false;
    }
    
    if (!designJSON.components || Object.keys(designJSON.components).length === 0) {
      this.errors.push('No components defined');
      return false;
    }
    
    // Check for duplicate IDs
    const ids = new Set();
    Object.keys(designJSON.components).forEach(id => {
      if (ids.has(id)) {
        this.errors.push(`Duplicate component ID: ${id}`);
      }
      ids.add(id);
    });
    
    return this.errors.length === 0;
  }

  /**
   * Process a single component
   */
  _processComponent(key, comp, config) {
    const type = comp.type;
    
    switch (type) {
      case 'feed':
        config.feeds[key] = this._generateFeed(key, comp);
        break;
      case 'drain':
        config.drains[key] = this._generateDrain(key, comp);
        break;
      case 'tank':
        config.tanks[key] = this._generateTank(key, comp);
        break;
      case 'pump':
        config.pumps[key] = this._generatePump(key, comp);
        break;
      case 'valve':
        config.valves[key] = this._generateValve(key, comp);
        break;
      case 'sensor':
        config.pressureSensors[key] = this._generateSensor(key, comp);
        break;
      default:
        this.warnings.push(`Unknown component type: ${type} (${key})`);
    }
  }

  /**
   * Generate feed component config
   */
  _generateFeed(key, comp) {
    return {
      id: key,
      name: comp.name || `Feed ${key}`,
      type: 'feed',
      flowRate: comp.flowRate || 1.0,
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: []
    };
  }

  /**
   * Generate drain component config
   */
  _generateDrain(key, comp) {
    return {
      id: key,
      name: comp.name || `Drain ${key}`,
      type: 'drain',
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: []
    };
  }

  /**
   * Generate tank component config
   */
  _generateTank(key, comp) {
    return {
      id: key,
      name: comp.name || `Tank ${key}`,
      type: 'tank',
      area: comp.area || 1.0,
      maxHeight: comp.maxHeight || 1.0,
      initialLevel: comp.initialLevel || 0.0,
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: []
    };
  }

  /**
   * Generate pump component config
   */
  _generatePump(key, comp) {
    return {
      id: key,
      name: comp.name || `Pump ${key}`,
      type: 'pump',
      pumpType: comp.pumpType || 'fixed',
      capacity: comp.capacity || 1.0,
      efficiency: comp.efficiency || 0.95,
      power: comp.power || null,
      initialSpeed: comp.initialSpeed || 0,
      cavitation: comp.cavitation || {
        enabled: false,
        triggerTime: null,
        duration: 5,
        flowReduction: 0.3
      },
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: [],
      modalTitle: comp.name ? `${comp.name} Control` : 'Pump Control'
    };
  }

  /**
   * Generate valve component config
   */
  _generateValve(key, comp) {
    return {
      id: key,
      name: comp.name || `Valve ${key}`,
      type: 'valve',
      maxFlow: comp.maxFlow || 1.0,
      initialPosition: comp.initialPosition || 0,
      responseTime: comp.responseTime || 0.1,
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: [],
      modalTitle: comp.name ? `${comp.name} Control` : 'Valve Control',
      iframeUrl: 'valve.html'
    };
  }

  /**
   * Generate sensor component config
   */
  _generateSensor(key, comp) {
    return {
      id: key,
      name: comp.name || `Sensor ${key}`,
      type: 'sensor',
      sensorType: comp.sensorType || 'pressure',
      range: comp.range || [0, 10],
      units: comp.units || 'bar',
      svgElement: comp.svgSelector || null,
      position: comp.position || [0, 0],
      inputs: [],
      outputs: []
    };
  }

  /**
   * Process connection into pipe config
   */
  _processConnection(conn, index, config, components) {
    const pipeId = conn.pipe || `pipe${index}`;
    
    // Calculate pipe length from positions
    const fromComp = components[conn.from];
    const toComp = components[conn.to];
    
    let length = 1.0;
    if (fromComp && toComp && fromComp.position && toComp.position) {
      const dx = toComp.position[0] - fromComp.position[0];
      const dy = toComp.position[1] - fromComp.position[1];
      length = Math.sqrt(dx * dx + dy * dy) / 100; // Convert pixels to meters (approx)
    }
    
    config.pipes[pipeId] = {
      id: pipeId,
      name: conn.name || `Pipe ${pipeId}`,
      type: 'pipe',
      from: conn.from,
      to: conn.to,
      length: parseFloat(length.toFixed(2)),
      diameter: conn.diameter || 0.05, // 50mm default
      svgElement: conn.svgSelector || null
    };
  }

  /**
   * Build inputs/outputs arrays for each component
   */
  _buildConnectionGraph(config, connections) {
    if (!connections) return;
    
    const allComponents = {
      ...config.feeds,
      ...config.drains,
      ...config.tanks,
      ...config.pumps,
      ...config.valves,
      ...config.pressureSensors
    };
    
    connections.forEach(conn => {
      const fromComp = allComponents[conn.from];
      const toComp = allComponents[conn.to];
      
      if (fromComp && !fromComp.outputs.includes(conn.to)) {
        fromComp.outputs.push(conn.to);
      }
      
      if (toComp && !toComp.inputs.includes(conn.from)) {
        toComp.inputs.push(conn.from);
      }
    });
  }

  /**
   * Generate settings section
   */
  _generateSettings(customSettings = {}) {
    return {
      timeStep: customSettings.timeStep || 0.016,
      maxTimeStep: customSettings.maxTimeStep || 0.1,
      gravity: customSettings.gravity || 9.81,
      fluidDensity: customSettings.fluidDensity || 1000,
      updateInterval: customSettings.updateInterval || 16,
      debugMode: customSettings.debugMode !== undefined ? customSettings.debugMode : true,
      logFlows: customSettings.logFlows || false
    };
  }

  /**
   * Export config to JavaScript file format
   */
  exportToFile(config) {
    const timestamp = new Date().toISOString();
    
    return `/**
 * systemConfig.js - Auto-generated system configuration
 * Generated: ${timestamp}
 */

const SYSTEM_CONFIG = ${JSON.stringify(config, null, 2)};

// Validation
if (typeof validateConfig === 'function') {
  validateConfig(SYSTEM_CONFIG);
}

// Export
window.SYSTEM_CONFIG = SYSTEM_CONFIG;
`;
  }

  /**
   * Get generation report
   */
  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0
    };
  }
}

// Export
window.SystemConfigGenerator = SystemConfigGenerator;

// CLI usage (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SystemConfigGenerator;
  
  // Command line usage
  if (require.main === module) {
    const fs = require('fs');
    const path = require('path');
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log('Usage: node configGenerator.js <design.json>');
      process.exit(1);
    }
    
    const inputFile = args[0];
    const designJSON = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    const generator = new SystemConfigGenerator();
    const config = generator.generate(designJSON);
    
    if (config) {
      console.log(generator.exportToFile(config));
    } else {
      console.error('Generation failed');
      process.exit(1);
    }
  }
}
