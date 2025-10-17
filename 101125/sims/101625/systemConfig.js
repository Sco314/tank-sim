/**
 * systemConfig.js - Untitled Design
 * Generated: 10/16/2025, 7:34:39 PM
 */

const SYSTEM_CONFIG = {
  "_metadata": {
    "name": "Simulator",
    "version": "1.0.0",
    "exportVersion": "3.0.0",
    "exported": "2025-10-17T00:34:39.728Z",
    "componentCount": 4,
    "connectionCount": 3
  },
  "feeds": {
    "comp_2": {
      "id": "comp_2",
      "name": "Feed 3",
      "type": "feed",
      "supplyPressure": 3,
      "maxFlow": null,
      "temperature": 20,
      "inputs": [],
      "outputs": [
        "comp_1"
      ],
      "position": [
        140,
        100
      ]
    }
  },
  "drains": {
    "comp_4": {
      "id": "comp_4",
      "name": "Drain 5",
      "type": "drain",
      "ambientPressure": 1,
      "maxCapacity": null,
      "inputs": [
        "comp_3"
      ],
      "outputs": [],
      "position": [
        900,
        200
      ]
    }
  },
  "tanks": {
    "comp_1": {
      "id": "comp_1",
      "name": "Tank 2",
      "type": "tank",
      "area": 2.5,
      "maxHeight": 1.2,
      "initialVolume": 0,
      "inputs": [
        "comp_2"
      ],
      "outputs": [
        "comp_3"
      ],
      "svgElement": "#comp_1",
      "position": [
        440,
        160
      ]
    }
  },
  "pumps": {
    "comp_3": {
      "id": "comp_3",
      "name": "Fixed Speed Pump 4",
      "type": "pump",
      "pumpType": "fixed",
      "capacity": 0.5,
      "efficiency": 0.95,
      "inputs": [
        "comp_1"
      ],
      "outputs": [
        "comp_4"
      ],
      "svgElement": "#comp_3",
      "position": [
        720,
        200
      ],
      "modalTitle": "Fixed Speed Pump 4 Control"
    }
  },
  "valves": {},
  "pipes": {
    "pipe1": {
      "id": "pipe1",
      "name": "Feed 3 to Tank 2",
      "type": "pipe",
      "diameter": 0.05,
      "length": 0.3,
      "svgElement": "#pipe1Flow",
      "inputs": [
        "comp_2"
      ],
      "outputs": [
        "comp_1"
      ]
    },
    "pipe2": {
      "id": "pipe2",
      "name": "Tank 2 to Fixed Speed Pump 4",
      "type": "pipe",
      "diameter": 0.05,
      "length": 0.3,
      "svgElement": "#pipe2Flow",
      "inputs": [
        "comp_1"
      ],
      "outputs": [
        "comp_3"
      ]
    },
    "pipe3": {
      "id": "pipe3",
      "name": "Fixed Speed Pump 4 to Drain 5",
      "type": "pipe",
      "diameter": 0.05,
      "length": 0.2,
      "svgElement": "#pipe3Flow",
      "inputs": [
        "comp_3"
      ],
      "outputs": [
        "comp_4"
      ]
    }
  },
  "pressureSensors": {},
  "settings": {
    "timeStep": 0.016,
    "maxTimeStep": 0.1,
    "gravity": 9.81,
    "fluidDensity": 1000,
    "updateInterval": 16,
    "debugMode": true,
    "logFlows": false
  }
};

window.SYSTEM_CONFIG = SYSTEM_CONFIG;
