/**
 * Feed.js - Source/inlet boundary condition component
 * 
 * Represents an infinite supply (e.g., water main, process feed)
 * Has no inputs, provides flow to downstream components
 */

class Feed extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'feed';
    
    // Boundary condition properties
    this.supplyPressure = config.supplyPressure || 3.0; // bar (typical water main)
    this.maxFlow = config.maxFlow || Infinity; // m³/s (unlimited by default)
    this.temperature = config.temperature || 20; // °C (for future use)
    
    // Supply characteristics
    this.available = config.available !== false; // Can be shut off
    this.flowRate = 0; // Current flow rate (determined by downstream demand)
    
    console.log(`Feed created: ${this.name} (${this.supplyPressure} bar, max ${this.maxFlow === Infinity ? 'unlimited' : this.maxFlow + ' m³/s'})`);
  }

  /**
   * Feed supplies flow based on downstream demand
   * Infinite source, but can be limited by maxFlow
   */
  getOutputFlow() {
    if (!this.available) return 0;
    
    // Feed provides whatever downstream needs, up to maxFlow
    // (Downstream components like valves will limit actual flow)
    return this.maxFlow;
  }

  /**
   * Get supply pressure (for future pressure-based calculations)
   */
  getSupplyPressure() {
    return this.available ? this.supplyPressure : 0;
  }

  /**
   * Enable/disable feed
   */
  setAvailable(available) {
    this.available = !!available;
    this.notifyChange();
    console.log(`${this.name} ${this.available ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update feed state
   */
  update(dt) {
    // Track actual flow rate (read from network)
    if (this.flowNetwork) {
      this.flowRate = this.flowNetwork.getOutputFlow(this.id);
    }
  }

  /**
   * Render (feeds are typically non-visual)
   */
  render() {
    // Feed has no visual representation in this version
    // Could add a supply indicator icon in future
  }

  /**
   * Reset feed
   */
  reset() {
    super.reset();
    this.available = true;
    this.flowRate = 0;
  }

  /**
   * Check if feed is a boundary node
   */
  isBoundary() {
    return true;
  }

  /**
   * Get feed info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      available: this.available,
      supplyPressure: this.supplyPressure + ' bar',
      maxFlow: this.maxFlow === Infinity ? 'unlimited' : this.maxFlow + ' m³/s',
      currentFlow: this.flowRate.toFixed(3) + ' m³/s',
      temperature: this.temperature + ' °C'
    };
  }
}

// Export
window.Feed = Feed;
