/**
 * Component.js - Base class for all system components
 * 
 * All components (tanks, pumps, valves, pipes) inherit from this.
 */

class Component {
  constructor(config) {
    this.id = config.id;
    this.type = config.type; // 'tank', 'pump', 'valve', 'pipe', 'sensor'
    this.name = config.name || this.id;
    
    // Flow connections
    this.inputs = config.inputs || []; // Array of component IDs
    this.outputs = config.outputs || []; // Array of component IDs
    
    // Visual
    this.svgElement = config.svgElement || null;
    this.position = config.position || [0, 0]; // [x, y]
    
    // State
    this.enabled = config.enabled !== false; // Default enabled
    this.state = {}; // Component-specific state
    
    // Callbacks
    this.onChange = null; // Called when component changes
    
    console.log(`Component created: ${this.type} - ${this.id}`);
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
  }
}

// Export
window.Component = Component;
