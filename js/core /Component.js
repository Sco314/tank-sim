/**
 * Component.js - Base class for all system components
 * 
 * All components (tanks, pumps, valves, pipes, feeds, drains) inherit from this.
 * Supports boundary components with no inputs (feeds) or no outputs (drains).
 */

class Component {
  constructor(config) {
    this.id = config.id;
    this.type = config.type; // 'tank', 'pump', 'valve', 'pipe', 'sensor', 'feed', 'drain'
    this.name = config.name || this.id;
    
    // CRITICAL: Store flowNetwork reference
    this.flowNetwork = config.flowNetwork || null;
    
    // Flow connections
    this.inputs = config.inputs || [];
    this.outputs = config.outputs || [];
    
    // Visual
    this.svgElement = config.svgElement || null;
    this.position = config.position || [0, 0]; // [x, y]
    
    // State
    this.enabled = config.enabled !== false; // Default enabled
    this.state = {}; // Component-specific state
    
    // Callbacks
    this.onChange = null; // Called when component changes
    
    // Validate configuration
    this._validateConfiguration();
    
    console.log(`Component created: ${this.type} - ${this.id}`);
  }

  /**
   * Validate component configuration
   * Relaxed for boundary components (feeds can have no inputs, drains can have no outputs)
   */
  _validateConfiguration() {
    // Check for required fields
    if (!this.id) {
      console.error('Component must have an ID');
      return;
    }
    
    if (!this.type) {
      console.error(`Component ${this.id} must have a type`);
      return;
    }
    
    // Boundary components have relaxed validation
    if (this.isBoundary()) {
      if (this.type === 'feed' || this.type === 'source') {
        // Feeds/sources should have NO inputs, but must have outputs
        if (this.inputs.length > 0) {
          console.warn(`${this.type} ${this.id} should not have inputs (boundary condition)`);
        }
        if (this.outputs.length === 0) {
          console.warn(`${this.type} ${this.id} has no outputs - will not supply flow to anything`);
        }
      } else if (this.type === 'drain' || this.type === 'sink') {
        // Drains/sinks should have NO outputs, but must have inputs
        if (this.outputs.length > 0) {
          console.warn(`${this.type} ${this.id} should not have outputs (boundary condition)`);
        }
        if (this.inputs.length === 0) {
          console.warn(`${this.type} ${this.id} has no inputs - will not receive flow from anything`);
        }
      }
    } else {
      // Non-boundary components should generally have both inputs and outputs
      // (though some exceptions like sensors might only have inputs)
      if (this.inputs.length === 0 && this.type !== 'sensor') {
        console.warn(`${this.type} ${this.id} has no inputs - may not receive flow`);
      }
      if (this.outputs.length === 0 && this.type !== 'sensor') {
        console.warn(`${this.type} ${this.id} has no outputs - may not supply flow`);
      }
    }
  }

  /**
   * Check if this component is a boundary node (source or sink)
   * Override in subclasses or check type
   */
  isBoundary() {
    return this.type === 'feed' || 
           this.type === 'source' || 
           this.type === 'drain' || 
           this.type === 'sink';
  }

  /**
   * Get DOM element
   */
  getElement() {
    if (!this.svgElement) return null;
    if (typeof this.svgElement === 'string') {
      return document.querySelector(this.svgElement);
    }
    return this.svgElement;
  }

  /**
   * Enable/disable component
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.notifyChange();
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Notify system of changes
   */
  notifyChange() {
    if (this.onChange) {
      this.onChange(this);
    }
  }

  /**
   * Get input flow (override in subclasses)
   */
  getInputFlow() {
    return 0;
  }

  /**
   * Get output flow (override in subclasses)
   */
  getOutputFlow() {
    return 0;
  }

  /**
   * Update component state (override in subclasses)
   */
  update(dt) {
    // Override in subclasses
  }

  /**
   * Render visual representation (override in subclasses)
   */
  render() {
    // Override in subclasses
  }

  /**
   * Get component info for debugging
   */
  getInfo() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: this.enabled,
      isBoundary: this.isBoundary(),
      inputs: this.inputs,
      outputs: this.outputs,
      state: this.state
    };
  }

  /**
   * Reset component to initial state (override in subclasses)
   */
  reset() {
    this.enabled = true;
    this.state = {};
  }

  /**
   * Destroy component (cleanup)
   */
  destroy() {
    this.onChange = null;
    this.svgElement = null;
    this.flowNetwork = null;
  }
}

// Export
window.Component = Component;
