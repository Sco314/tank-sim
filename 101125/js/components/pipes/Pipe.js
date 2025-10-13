/**
 * Pipe.js - Visual-only pipe component
 * 
 * Pipes READ flows from the network (they don't create flows)
 * They animate based on actual component-to-component flows
 */

class Pipe extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'pipe';
    
    // Physical properties
    this.diameter = config.diameter || 0.05; // meters (50mm default)
    this.length = config.length || 1.0; // meters
    this.roughness = config.roughness || 0.000045; // meters (steel pipe)
    
    // Flow state (read from network, not calculated here)
    this.flowRate = 0; // m³/s
    this.velocity = 0; // m/s
    this.reynoldsNumber = 0;
    this.regime = 'Laminar'; // 'Laminar', 'Transitional', 'Turbulent'
    
    // Animation state
    this.animating = false;
    
    // Visual element
    this.flowPath = null;
    
    this._initializeVisuals();
    
    console.log(`Pipe created: ${this.name} (${this.diameter * 1000}mm × ${this.length}m)`);
  }

  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      this.flowPath = element;
    } else if (this.svgElement) {
      this.flowPath = document.querySelector(this.svgElement);
    }
    
    if (!this.flowPath) {
      console.warn(`Flow path not found for pipe ${this.name}`);
    }
  }

  /**
   * CRITICAL: Pipes DON'T create flow - they only visualize it
   */
  getOutputFlow() {
    return 0; // Pipes never processed in calculateFlows
  }

  /**
   * Update pipe state - READ flow from network
   */
  update(dt) {
    if (!this.flowNetwork) return;
    
    // READ the actual flow between the components this pipe connects
    // Example: pipe2 connects inletValve → tank1
    // So we read the flow from inletValve to tank1
    
    if (this.inputs.length > 0 && this.outputs.length > 0) {
      const fromId = this.inputs[0];
      const toId = this.outputs[0];
      
      // Read flow from network
      this.flowRate = this.flowNetwork.getFlow(fromId, toId);
    } else {
      this.flowRate = 0;
    }
    
    // Calculate derived properties
    this._calculateFlowProperties();
    
    // Update animation state
    this._updateAnimation();
  }

  /**
   * Calculate flow properties (velocity, Reynolds number, regime)
   */
  _calculateFlowProperties() {
    // Cross-sectional area
    const area = Math.PI * Math.pow(this.diameter / 2, 2);
    
    // Velocity: v = Q / A
    this.velocity = area > 0 ? this.flowRate / area : 0;
    
    // Reynolds number: Re = ρ * v * D / μ
    // For water at 20°C: ρ = 1000 kg/m³, μ = 0.001 Pa·s
    const density = 1000; // kg/m³
    const viscosity = 0.001; // Pa·s
    
    this.reynoldsNumber = (density * this.velocity * this.diameter) / viscosity;
    
    // Flow regime
    if (this.reynoldsNumber < 2300) {
      this.regime = 'Laminar';
    } else if (this.reynoldsNumber < 4000) {
      this.regime = 'Transitional';
    } else {
      this.regime = 'Turbulent';
    }
  }

  /**
   * Update animation based on flow rate
   */
  _updateAnimation() {
    if (!this.flowPath) return;
    
    const hasFlow = this.flowRate > 0.001; // Threshold to avoid noise
    
    if (hasFlow) {
      // Start animation
      if (!this.animating) {
        this.flowPath.classList.add('on');
        this.animating = true;
      }
      
      // Adjust animation speed based on flow rate
      // Higher flow = faster animation
      // Speed range: 200ms (fast) to 2000ms (slow)
      const maxFlow = 1.0; // m³/s (assumed max for scaling)
      const normalizedFlow = Math.min(1, this.flowRate / maxFlow);
      const duration = 2000 - (1800 * normalizedFlow); // 2000ms to 200ms
      
      this.flowPath.style.setProperty('--duration', `${duration}ms`);
    } else {
      // Stop animation
      if (this.animating) {
        this.flowPath.classList.remove('on');
        this.animating = false;
      }
    }
  }

  /**
   * Render pipe visual state
   */
  render() {
    // Animation is handled by CSS and update()
    // Could add color coding based on flow rate or regime here
    
    if (!this.flowPath) return;
    
    // Optional: Change color based on regime
    if (this.flowRate > 0) {
      if (this.regime === 'Turbulent') {
        // Could add a class for turbulent flow visualization
      }
    }
  }

  /**
   * Get flow velocity
   */
  getVelocity() {
    return this.velocity;
  }

  /**
   * Get Reynolds number
   */
  getReynoldsNumber() {
    return this.reynoldsNumber;
  }

  /**
   * Get flow regime
   */
  getFlowRegime() {
    return this.regime;
  }

  /**
   * Check if pipe is flowing
   */
  isFlowing() {
    return this.flowRate > 0.001;
  }

  /**
   * Calculate pressure drop (for future use)
   */
  getPressureDrop() {
    // Darcy-Weisbach equation: ΔP = f * (L/D) * (ρv²/2)
    // Simplified for now
    
    if (this.velocity === 0) return 0;
    
    // Friction factor (simplified - use Moody chart for accuracy)
    let frictionFactor;
    if (this.reynoldsNumber < 2300) {
      // Laminar: f = 64/Re
      frictionFactor = 64 / this.reynoldsNumber;
    } else {
      // Turbulent: Colebrook-White (simplified)
      frictionFactor = 0.02; // Approximation
    }
    
    const density = 1000; // kg/m³
    const pressureDrop = frictionFactor * 
                        (this.length / this.diameter) * 
                        (density * Math.pow(this.velocity, 2) / 2);
    
    return pressureDrop / 100000; // Convert Pa to bar
  }

  /**
   * Reset pipe
   */
  reset() {
    super.reset();
    this.flowRate = 0;
    this.velocity = 0;
    this.reynoldsNumber = 0;
    this.regime = 'Laminar';
    this.animating = false;
    
    if (this.flowPath) {
      this.flowPath.classList.remove('on');
    }
  }

  /**
   * Get pipe info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      flowRate: this.flowRate.toFixed(3) + ' m³/s',
      velocity: this.velocity.toFixed(2) + ' m/s',
      reynolds: Math.round(this.reynoldsNumber),
      regime: this.regime,
      diameter: (this.diameter * 1000).toFixed(0) + ' mm',
      length: this.length.toFixed(1) + ' m',
      pressureDrop: this.getPressureDrop().toFixed(3) + ' bar',
      animating: this.animating
    };
  }
}

// Export
window.Pipe = Pipe;
