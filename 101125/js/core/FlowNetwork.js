/**
 * FlowNetwork.js - Manages flow calculations between components
 * 
 * Builds a directed graph of components and calculates flows.
 */

class FlowNetwork {
  constructor() {
    this.components = new Map(); // Map<id, Component>
    this.flows = new Map(); // Map<'from->to', flowRate>
    this.pressures = new Map(); // Map<id, pressure> (optional)
  }

  /**
   * Register a component in the network
   */
  addComponent(component) {
    if (!component.id) {
      console.error('Component must have an ID');
      return;
    }
    
    this.components.set(component.id, component);
    console.log(`Added ${component.type} to flow network: ${component.id}`);
  }

  /**
   * Remove a component from the network
   */
  removeComponent(componentId) {
    this.components.delete(componentId);
    
    // Clear flows involving this component
    for (const [key, value] of this.flows.entries()) {
      if (key.includes(componentId)) {
        this.flows.delete(key);
      }
    }
  }

  /**
   * Get a component by ID
   */
  getComponent(id) {
    return this.components.get(id);
  }

  /**
   * Get all components of a specific type
   */
  getComponentsByType(type) {
    const result = [];
    for (const component of this.components.values()) {
      if (component.type === type) {
        result.push(component);
      }
    }
    return result;
  }

  /**
   * Set flow rate between two components
   */
  setFlow(fromId, toId, flowRate) {
    const key = `${fromId}->${toId}`;
    this.flows.set(key, flowRate);
  }

  /**
   * Get flow rate between two components
   */
  getFlow(fromId, toId) {
    const key = `${fromId}->${toId}`;
    return this.flows.get(key) || 0;
  }

  /**
   * Get total input flow to a component
   */
  getInputFlow(componentId) {
    let total = 0;
    for (const [key, flow] of this.flows.entries()) {
      if (key.endsWith(`->${componentId}`)) {
        total += flow;
      }
    }
    return total;
  }

  /**
   * Get total output flow from a component
   */
  getOutputFlow(componentId) {
    let total = 0;
    for (const [key, flow] of this.flows.entries()) {
      if (key.startsWith(`${componentId}->`)) {
        total += flow;
      }
    }
    return total;
  }

  /**
   * Calculate all flows in the network
   */
  calculateFlows(dt) {
    // Clear existing flows
    this.flows.clear();

    // Process in order: sources -> valves -> pumps -> tanks -> drains
    const order = ['source', 'valve', 'pump', 'tank', 'drain', 'sensor'];
    
    for (const type of order) {
      const components = this.getComponentsByType(type);
      
      for (const component of components) {
        if (!component.enabled) continue;
        
        // Calculate output flow for this component
        const outputFlow = component.getOutputFlow();
        
        // Distribute flow to all outputs
        if (component.outputs && component.outputs.length > 0) {
          const flowPerOutput = outputFlow / component.outputs.length;
          
          for (const outputId of component.outputs) {
            this.setFlow(component.id, outputId, flowPerOutput);
          }
        }
      }
    }
  }

  /**
   * Update all components in the network
   */
  updateComponents(dt) {
    for (const component of this.components.values()) {
      if (component.enabled) {
        component.update(dt);
      }
    }
  }

  /**
   * Render all components
   */
  renderComponents() {
    for (const component of this.components.values()) {
      component.render();
    }
  }

  /**
   * Build network from config
   */
  buildFromConfig(config) {
    console.log('Building flow network from config...');
    
    // Components are added by their respective managers
    // This method validates connections
    
    let validConnections = 0;
    let invalidConnections = 0;
    
    for (const component of this.components.values()) {
      // Check if all inputs exist
      for (const inputId of component.inputs) {
        if (this.components.has(inputId)) {
          validConnections++;
        } else {
          console.warn(`Component ${component.id} has invalid input: ${inputId}`);
          invalidConnections++;
        }
      }
      
      // Check if all outputs exist
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

  /**
   * Get network info for debugging
   */
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

  /**
   * Reset entire network
   */
  reset() {
    this.flows.clear();
    this.pressures.clear();
    
    for (const component of this.components.values()) {
      component.reset();
    }
    
    console.log('Flow network reset');
  }

  /**
   * Clear network
   */
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

// Export
window.FlowNetwork = FlowNetwork;
