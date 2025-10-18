/**
 * FlowNetwork.js - Manages flow calculations between components
 * 
 * Component-only topology: no pipes in flow routing
 * Supports boundary conditions (feeds and drains)
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
    
    // Store reference to this network in the component
    component.flowNetwork = this;
    
    this.components.set(component.id, component);
    console.log(`Added ${component.type} to flow network: ${component.id}`);
  }

  /**
   * Remove a component from the network
   */
  removeComponent(componentId) {
    const component = this.components.get(componentId);
    if (component) {
      component.flowNetwork = null;
    }
    
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
   * Component-only topology with boundary handling
   */
  calculateFlows(dt) {
    // Clear existing flows
    this.flows.clear();

    // CRITICAL: Processing order for component-only topology
    // - 'feed': Boundary sources (infinite supply)
    // - 'valve': Flow controllers
    // - 'pump': Active movers (creates tank->pump flow)
    // - 'drain': Boundary sinks (infinite capacity)
    // - 'sensor': Monitors only
    // 
    // NOTE: 'tank' is NOT in the list - tanks are passive
    // NOTE: 'pipe' is NOT in the list - pipes are visual only
    const order = ['feed', 'valve', 'pump', 'drain', 'sensor'];
    
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
    
    // BOUNDARY HANDLING: Ensure boundary conditions are satisfied
    this._applyBoundaryConditions();
  }

  /**
   * Apply boundary conditions (feeds and drains)
   */
  _applyBoundaryConditions() {
    // Feeds inject flow at their outputs
    const feeds = this.getComponentsByType('feed');
    for (const feed of feeds) {
      if (!feed.enabled) continue;
      
      // Feed provides flow based on downstream demand
      // This is already handled in calculateFlows, but we could
      // add pressure-based calculations here in the future
    }
    
    // Drains accept all incoming flow
    const drains = this.getComponentsByType('drain');
    for (const drain of drains) {
      if (!drain.enabled) continue;
      
      // Drain accepts whatever flows into it
      // No action needed - just verify flow is recorded
      const inflow = this.getInputFlow(drain.id);
      if (inflow > 0) {
        // Flow successfully reaches drain
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
   * Build network from config and validate
   * Component-only topology with clear error messages
   */
  buildFromConfig(config) {
    console.log('Building flow network from config...');
    
    // Components are added by their respective managers
    // This method validates connections
    
    let validConnections = 0;
    let invalidConnections = 0;
    const errors = [];
    
    for (const component of this.components.values()) {
      // Check if all inputs exist and are valid
      for (const inputId of component.inputs) {
        const inputComponent = this.components.get(inputId);
        
        if (inputComponent) {
          validConnections++;
        } else {
          // CLEAR ERROR MESSAGE
          const errorMsg = `Component "${component.id}" (${component.type}) has invalid input: "${inputId}" - component does not exist`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          invalidConnections++;
        }
      }
      
      // Check if all outputs exist and are valid
      for (const outputId of component.outputs) {
        const outputComponent = this.components.get(outputId);
        
        if (outputComponent) {
          validConnections++;
        } else {
          // CLEAR ERROR MESSAGE
          const errorMsg = `Component "${component.id}" (${component.type}) has invalid output: "${outputId}" - component does not exist`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          invalidConnections++;
        }
      }
      
      // Validate boundary components
      if (component.isBoundary && component.isBoundary()) {
        if (component.type === 'feed' && component.inputs.length > 0) {
          console.warn(`⚠️ Feed "${component.id}" has inputs - feeds should have no inputs (boundary condition)`);
        }
        if (component.type === 'drain' && component.outputs.length > 0) {
          console.warn(`⚠️ Drain "${component.id}" has outputs - drains should have no outputs (boundary condition)`);
        }
      }
    }
    
    // Report results
    const summary = `Network built: ${this.components.size} components, ${validConnections} valid connections, ${invalidConnections} invalid`;
    
    if (invalidConnections > 0) {
      console.error(`❌ ${summary}`);
      console.error('❌ Invalid connections found:', errors);
    } else {
      console.log(`✅ ${summary}`);
    }
    
    // Log topology for debugging
    if (invalidConnections === 0) {
      this._logTopology();
    }
  }

  /**
   * Log network topology for debugging
   */
  _logTopology() {
    console.log('📊 Network Topology:');
    
    // Find the flow path from feed to drain
    const feeds = this.getComponentsByType('feed');
    const drains = this.getComponentsByType('drain');
    
    if (feeds.length > 0 && drains.length > 0) {
      const path = this._findPath(feeds[0].id, drains[0].id);
      if (path) {
        console.log('Flow path:', path.join(' → '));
      }
    }
    
    // List all components by type
    const types = ['feed', 'valve', 'tank', 'pump', 'drain', 'sensor', 'pipe'];
    for (const type of types) {
      const components = this.getComponentsByType(type);
      if (components.length > 0) {
        console.log(`  ${type}s (${components.length}):`, components.map(c => c.id).join(', '));
      }
    }
  }

  /**
   * Find path between two components (for debugging)
   */
  _findPath(startId, endId, visited = new Set()) {
    if (startId === endId) return [endId];
    if (visited.has(startId)) return null;
    
    visited.add(startId);
    const component = this.getComponent(startId);
    if (!component) return null;
    
    for (const outputId of component.outputs) {
      const path = this._findPath(outputId, endId, visited);
      if (path) {
        return [startId, ...path];
      }
    }
    
    return null;
  }

  /**
   * Get network info for debugging
   */
  getNetworkInfo() {
    const info = {
      componentCount: this.components.size,
      components: [],
      flows: [],
      boundaries: {
        feeds: [],
        drains: []
      }
    };
    
    for (const component of this.components.values()) {
      const componentInfo = component.getInfo();
      info.components.push(componentInfo);
      
      // Track boundary components
      if (component.type === 'feed') {
        info.boundaries.feeds.push(component.id);
      } else if (component.type === 'drain') {
        info.boundaries.drains.push(component.id);
      }
    }
    
    for (const [key, flow] of this.flows.entries()) {
      info.flows.push({ connection: key, flow });
    }
    
    return info;
  }

  /**
   * Verify network integrity (diagnostic tool)
   */
  verifyIntegrity() {
    console.log('🔍 Verifying network integrity...');
    
    const issues = [];
    
    // Check for orphaned components
    for (const component of this.components.values()) {
      if (component.type === 'feed' || component.type === 'drain') continue;
      
      if (component.inputs.length === 0 && component.outputs.length === 0) {
        issues.push(`Component "${component.id}" is orphaned (no connections)`);
      }
    }
    
    // Check for flow continuity
    const feeds = this.getComponentsByType('feed');
    const drains = this.getComponentsByType('drain');
    
    if (feeds.length === 0) {
      issues.push('No feed (source) components found - system has no inlet');
    }
    
    if (drains.length === 0) {
      issues.push('No drain (sink) components found - system has no outlet');
    }
    
    // Check for path from feed to drain
    if (feeds.length > 0 && drains.length > 0) {
      const path = this._findPath(feeds[0].id, drains[0].id);
      if (!path) {
        issues.push('No valid flow path from feed to drain');
      }
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Network integrity issues:', issues);
      return false;
    } else {
      console.log('✅ Network integrity verified');
      return true;
    }
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
