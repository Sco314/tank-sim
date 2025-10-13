/**
 * componentLibrary.js - Available components for the designer
 */

const COMPONENT_LIBRARY = {
  // Boundary Components
  feed: {
    name: 'Feed',
    category: 'boundaries',
    icon: '⚡',
    description: 'Infinite supply source',
    color: '#10b981',
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
      { name: 'temperature', type: 'number', label: 'Temperature (°C)', default: 20, min: 0, max: 100 }
    ]
  },
  
  drain: {
    name: 'Drain',
    category: 'boundaries',
    icon: '⬇️',
    description: 'Infinite sink outlet',
    color: '#ef4444',
    defaultConfig: {
      type: 'drain',
      ambientPressure: 1.0,
      maxCapacity: Infinity
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Drain' },
      { name: 'ambientPressure', type: 'number', label: 'Ambient Pressure (bar)', default: 1.0, min: 0, max: 5, step: 0.1 },
      { name: 'maxCapacity', type: 'number', label: 'Max Capacity (m³/s)', default: 'Infinity' }
    ]
  },
  
  // Tanks
  tank: {
    name: 'Tank',
    category: 'storage',
    icon: '🗄️',
    description: 'Storage tank',
    color: '#3b82f6',
    defaultConfig: {
      type: 'tank',
      area: 2.5,
      maxHeight: 1.2,
      initialVolume: 0
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Tank' },
      { name: 'area', type: 'number', label: 'Area (m²)', default: 2.5, min: 0.1, max: 10, step: 0.1 },
      { name: 'maxHeight', type: 'number', label: 'Max Height (m)', default: 1.2, min: 0.1, max: 5, step: 0.1 },
      { name: 'initialVolume', type: 'number', label: 'Initial Volume (m³)', default: 0, min: 0, step: 0.1 }
    ]
  },
  
  // Pumps
  fixedPump: {
    name: 'Fixed Speed Pump',
    category: 'pumps',
    icon: '🔄',
    description: 'ON/OFF pump',
    color: '#8b5cf6',
    defaultConfig: {
      type: 'pump',
      pumpType: 'fixed',
      capacity: 0.5,
      efficiency: 0.95
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Pump' },
      { name: 'capacity', type: 'number', label: 'Capacity (m³/s)', default: 0.5, min: 0.1, max: 5, step: 0.1 },
      { name: 'efficiency', type: 'number', label: 'Efficiency', default: 0.95, min: 0, max: 1, step: 0.01 }
    ]
  },
  
  variablePump: {
    name: 'Variable Speed Pump',
    category: 'pumps',
    icon: '⚙️',
    description: '0-100% control',
    color: '#8b5cf6',
    defaultConfig: {
      type: 'pump',
      pumpType: 'variable',
      capacity: 0.5,
      efficiency: 0.95,
      minSpeed: 0.1
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'VFD Pump' },
      { name: 'capacity', type: 'number', label: 'Capacity (m³/s)', default: 0.5, min: 0.1, max: 5, step: 0.1 },
      { name: 'efficiency', type: 'number', label: 'Efficiency', default: 0.95, min: 0, max: 1, step: 0.01 },
      { name: 'minSpeed', type: 'number', label: 'Min Speed', default: 0.1, min: 0, max: 0.5, step: 0.05 }
    ]
  },
  
  // Valves
  valve: {
    name: 'Control Valve',
    category: 'valves',
    icon: '🔧',
    description: 'Flow control valve',
    color: '#f59e0b',
    defaultConfig: {
      type: 'valve',
      maxFlow: 0.5,
      initialPosition: 0,
      responseTime: 0.1
    },
    properties: [
      { name: 'name', type: 'text', label: 'Name', default: 'Valve' },
      { name: 'maxFlow', type: 'number', label: 'Max Flow (m³/s)', default: 0.5, min: 0.1, max: 5, step: 0.1 },
      { name: 'initialPosition', type: 'number', label: 'Initial Position', default: 0, min: 0, max: 1, step: 0.1 },
      { name: 'responseTime', type: 'number', label: 'Response Time (s)', default: 0.1, min: 0.01, max: 1, step: 0.01 }
    ]
  },
  
  // Sensors
  pressureSensor: {
    name: 'Pressure Sensor',
    category: 'sensors',
    icon: '📊',
    description: 'Pressure measurement',
    color: '#06b6d4',
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

// Category definitions
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

// Export for use in designer
window.COMPONENT_LIBRARY = COMPONENT_LIBRARY;
window.CATEGORIES = CATEGORIES;
