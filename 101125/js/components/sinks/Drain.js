/**
 * Drain.js - Sink/outlet boundary condition component
 * 
 * Represents infinite discharge capacity (e.g., sewer, process outlet)
 * Has inputs, no outputs, accepts any flow
 */

class Drain extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'drain';
    
    // Boundary condition properties
    this.ambientPressure = config.ambientPressure || 1.0; // bar (atmospheric)
    this.maxCapacity = config.maxCapacity || Infinity; // m³/s (unlimited by default)
    this.backpressure = config.backpressure || 0; // bar (resistance, for future use)
    
    // Discharge characteristics
    this.open = config.open !== false; // Can be closed
    this.flowRate = 0; // Current flow rate
    this.totalDischarge = 0; // Cumulative volume discharged (m³)
    
    console.log(`Drain created: ${this.name} (${this.ambientPressure} bar, capacity ${this.maxCapacity === Infinity ? 'unlimited' : this.maxCapacity + ' m³/s'})`);
  }

  /**
   * Drain accepts infinite flow (is a sink)
   */
  getOutputFlow() {
    return 0; // Sinks don't output
  }

  /**
   * Get ambient pressure at drain (for future pressure-based calculations)
   */
  getAmbientPressure() {
    return this.open ? this.ambientPressure : Infinity; // Infinite resistance if closed
  }

  /**
   * Get backpressure (resistance to flow)
   */
  getBackpressure() {
    return this.open ? this.backpressure : Infinity;
  }

  /**
   * Open/close drain
   */
  setOpen(open) {
    this.open = !!open;
    this.notifyChange();
    console.log(`${this.name} ${this.open ? 'opened' : 'closed'}`);
  }

  /**
   * Update drain state
   */
  update(dt) {
    // Track actual flow rate (read from network)
    if (this.flowNetwork) {
      this.flowRate = this.flowNetwork.getInputFlow(this.id);
      
      // Accumulate total discharge
      this.totalDischarge += this.flowRate * dt;
    }
  }

  /**
   * Render (drains are typically non-visual)
   */
  render() {
    // Drain has no visual representation in this version
    // Could add a discharge indicator icon in future
  }

  /**
   * Reset drain
   */
  reset() {
    super.reset();
    this.open = true;
    this.flowRate = 0;
    this.totalDischarge = 0;
  }

  /**
   * Check if drain is a boundary node
   */
  isBoundary() {
    return true;
  }

  /**
   * Get drain info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      open: this.open,
      ambientPressure: this.ambientPressure + ' bar',
      maxCapacity: this.maxCapacity === Infinity ? 'unlimited' : this.maxCapacity + ' m³/s',
      currentFlow: this.flowRate.toFixed(3) + ' m³/s',
      totalDischarge: this.totalDischarge.toFixed(3) + ' m³',
      backpressure: this.backpressure + ' bar'
    };
  }
}

// Export
window.Drain = Drain;
