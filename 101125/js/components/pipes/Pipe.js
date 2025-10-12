/**
 * Pipe.js - Pipe component with flow animation
 * 
 * Visual representation of flow between components
 */

class Pipe extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'pipe';
    
    // Physical properties
    this.diameter = config.diameter || 0.05; // meters (50mm default)
    this.length = config.length || 1.0; // meters
    this.roughness = config.roughness || 0.0015; // mm (steel pipe)
    
    // Flow state
    this.flowRate = 0; // Current flow rate (m³/s)
    this.velocity = 0; // Flow velocity (m/s)
    this.direction = config.direction || 'forward'; // 'forward' or 'reverse'
    
    // Animation properties
    this.animationSpeed = 1.0; // Multiplier for animation speed
    this.minSpeed = 0.2; // Minimum animation speed
    this.maxSpeed = 2.0; // Maximum animation speed
    
    // Visual elements
    this.flowPath = null; // SVG path element for flow animation
    this.staticPath = null; // SVG path element for static pipe
    
    this._initializeVisuals();
    
    console.log(`Pipe created: ${this.name} (${this.diameter * 1000}mm × ${this.length}m)`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    // Get the SVG element (should be a path)
    const element = this.getElement();
    if (!element) return;
    
    // Find flow path (animated layer)
    this.flowPath = element.querySelector('.flow') || element;
    
    // Find static path (background)
    if (this.svgElement && typeof this.svgElement === 'string') {
      const parentId = this.svgElement.replace('#', '').replace('Flow', '');
      this.staticPath = document.getElementById(parentId);
    }
  }

  /**
   * Calculate flow rate through pipe
   */
  getOutputFlow() {
    // Pipe doesn't generate flow, it just conducts it
    // Flow is determined by connected components
    if (!this.flowNetwork) return 0;
    
    return this.flowNetwork.getInputFlow(this.id);
  }

  /**
   * Update pipe state
   */
  update(dt) {
    // Get flow from network
    if (this.flowNetwork) {
      this.flowRate = this.flowNetwork.getInputFlow(this.id);
    }
    
    // Calculate velocity: v = Q / A (where A = π r²)
    const area = Math.PI * Math.pow(this.diameter / 2, 2);
    this.velocity = area > 0 ? this.flowRate / area : 0;
    
    // Calculate animation speed based on flow rate
    // Faster flow = faster animation
    if (this.flowRate > 0) {
      // Map flow rate to animation speed (0.2 to 2.0)
      const normalizedFlow = Math.min(1, this.flowRate / 1.0); // Normalize to 0-1
      this.animationSpeed = this.minSpeed + (normalizedFlow * (this.maxSpeed - this.minSpeed));
    } else {
      this.animationSpeed = 0;
    }
  }

  /**
   * Render flow animation
   */
  render() {
    if (!this.flowPath) return;
    
    // Toggle flow animation based on flow rate
    if (this.flowRate > 0.001) {
      // Enable animation
      this.flowPath.classList.add('on');
      
      // Set animation speed
      const duration = Math.max(200, 1200 / this.animationSpeed); // ms
      this.flowPath.style.setProperty('--duration', `${duration}ms`);
      
      // Set opacity based on flow rate (more flow = more visible)
      const opacity = Math.min(1.0, 0.3 + (this.flowRate * 0.7));
      this.flowPath.style.opacity = opacity.toString();
    } else {
      // Disable animation
      this.flowPath.classList.remove('on');
      this.flowPath.style.opacity = '0.15';
    }
  }

  /**
   * Get flow velocity in m/s
   */
  getVelocity() {
    return this.velocity;
  }

  /**
   * Get Reynolds number (flow regime indicator)
   */
  getReynoldsNumber() {
    const viscosity = 0.001; // Pa·s (water at 20°C)
    const density = 1000; // kg/m³
    
    return (density * this.velocity * this.diameter) / viscosity;
  }

  /**
   * Check if flow is turbulent (Re > 4000)
   */
  isTurbulent() {
    return this.getReynoldsNumber() > 4000;
  }

  /**
   * Check if flow is laminar (Re < 2300)
   */
  isLaminar() {
    return this.getReynoldsNumber() < 2300;
  }

  /**
   * Get flow regime
   */
  getFlowRegime() {
    const re = this.getReynoldsNumber();
    if (re < 2300) return 'Laminar';
    if (re > 4000) return 'Turbulent';
    return 'Transitional';
  }

  /**
   * Reset pipe
   */
  reset() {
    super.reset();
    this.flowRate = 0;
    this.velocity = 0;
    this.animationSpeed = 0;
    
    if (this.flowPath) {
      this.flowPath.classList.remove('on');
      this.flowPath.style.opacity = '0.15';
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
      reynolds: this.getReynoldsNumber().toFixed(0),
      regime: this.getFlowRegime(),
      diameter: (this.diameter * 1000).toFixed(0) + ' mm',
      length: this.length.toFixed(1) + ' m',
      animating: this.flowRate > 0.001
    };
  }
}

// Export
window.Pipe = Pipe;
