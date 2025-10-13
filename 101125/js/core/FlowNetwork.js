/**
 * FlowNetwork.js - Manages flow calculations between components
 */

class FlowNetwork {
  constructor() {
    this.components = new Map();
    this.flows = new Map();
    this.pressures = new Map();
  }

  addComponent(component) {
    if (!component.id) {
      console.error('Component must have an ID');
      return;
    }
    this.components.set(component.id, component);
    console.log(`Added ${component.type} to flow network: ${component.id}`);
  }

  removeComponent(componentId) {
    this.components.delete(componentId);
    for (const [key, value] of this.flows.entries()) {
      if (key.includes(componentId)) {
        this.flows.delete(key);
      }
    }
  }

  getComponent(id) {
    return this.components.get(id);
  }

  getComponentsByType(type) {
    const result = [];
    for (const component of this.components.values()) {
      if (component.type === type) {
        result.push(component);
      }
    }
    return result;
  }

  setFlow(fromId, toId, flowRate) {
    const key = `${fromId}->${toId}`;
    this.flows.set(key, flowRate);
  }

  getFlow(fromId, toId) {
    const key = `${fromId}->${toId}`;
    return this.flows.get(key) || 0;
  }

  getInputFlow(componentId) {
    let total = 0;
    for (const [key, flow] of this.flows.entries()) {
      if (key.endsWith(`->${componentId}`)) {
        total += flow;
      }
    }
    return total;
  }

  getOutputFlow(componentId) {
    let total = 0;
    for (const [key, flow] of this.flows.entries()) {
      if (key.startsWith(`${componentId}->`)) {
        total += flow;
      }
    }
    return total;
  }

  calculateFlows(dt) {
  this.flows.clear();
  
  // Add 'tank' back - tanks need to create output flows
  const order = ['source', 'valve', 'pipe', 'tank', 'pump', 'drain', 'sensor'];
  
  for (const type of order) {
    const components = this.getComponentsByType(type);
    for (const component of components) {
      if (!component.enabled) continue;
      const outputFlow = component.getOutputFlow();
      if (component.outputs && component.outputs.length > 0) {
        const flowPerOutput = outputFlow / component.outputs.length;
        for (const outputId of component.outputs) {
          this.setFlow(component.id, outputId, flowPerOutput);
        }
      }
    }
  }
}

  updateComponents(dt) {
    for (const component of this.components.values()) {
      if (component.enabled) {
        component.update(dt);
      }
    }
  }

  renderComponents() {
    for (const component of this.components.values()) {
      component.render();
    }
  }

  buildFromConfig(config) {
    console.log('Building flow network from config...');
    let validConnections = 0;
    let invalidConnections = 0;
    
    for (const component of this.components.values()) {
      for (const inputId of component.inputs) {
        if (this.components.has(inputId) || inputId === 'source') {
          validConnections++;
        } else {
          console.warn(`Component ${component.id} has invalid input: ${inputId}`);
          invalidConnections++;
        }
      }
      for (const outputId of component.outputs) {
        if (this.components.has(outputId) || outputId === 'drain' || outputId === 'source') {
          validConnections++;
        } else {
          console.warn(`Component ${component.id} has invalid output: ${outputId}`);
          invalidConnections++;
        }
      }
    }
    console.log(`Network built: ${this.components.size} components, ${validConnections} connections, ${invalidConnections} invalid`);
  }

  getNetworkInfo() {
    const info = {
      componentCount: this.components.size,
      components: [],
      flows: []
    };
    for (const component of this.components.values()) {
      info.components.push(component.getInfo());
    }
    for (const [key, flow] of this.flows.entries()) {
      info.flows.push({ connection: key, flow });
    }
    return info;
  }

  reset() {
    this.flows.clear();
    this.pressures.clear();
    for (const component of this.components.values()) {
      component.reset();
    }
    console.log('Flow network reset');
  }

  clear() {
    for (const component of this.components.values()) {
      component.destroy();
    }
    this.components.clear();
    this.flows.clear();
    this.pressures.clear();
    console.log('Flow network cleared');
  }
}

window.FlowNetwork = FlowNetwork;
