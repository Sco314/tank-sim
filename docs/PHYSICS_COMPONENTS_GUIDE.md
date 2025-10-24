# Tank Simulator - Physics Components Guide

## Overview
This document catalogs every component that reads, monitors, controls, or manipulates the process physics of the tank simulator. The physics implementation is based on mass balance, flow constraints, and simplified hydraulic principles.

---

## Core Physics Engine

### **FlowNetwork.js** (`/js/core/FlowNetwork.js`)
**Role:** Central flow calculation engine and network topology manager

**Physics Functions:**
- **Mass Flow Routing:** Manages flow connections between components using a directed graph
- **Flow Conservation:** Calculates flow distribution through the network topology
- **Boundary Condition Handling:** Implements feed (infinite source) and drain (infinite sink) boundary conditions
- **Network Validation:** Verifies flow continuity from sources to sinks

**Key Physics Methods:**
- `calculateFlows(dt)` - Computes all flows in network based on component states
- `setFlow(fromId, toId, flowRate)` - Records flow rates between components (m³/s)
- `getInputFlow(componentId)` - Returns total inflow to a component
- `getOutputFlow(componentId)` - Returns total outflow from a component
- `_applyBoundaryConditions()` - Ensures boundary conditions are satisfied

**Data Read:**
- Component states (enabled, position, speed)
- Network topology (inputs/outputs connections)
- Component constraints (capacity, position, availability)

**Data Written:**
- Flow rates in `this.flows` Map (`'from->to'` → flowRate)
- Pressure data in `this.pressures` Map (optional, future use)

**Physics Processing Order:**
1. Feed (boundary sources)
2. Valve (flow controllers)
3. Pump (active movers)
4. Drain (boundary sinks)
5. Sensor (monitors only)

**Note:** Tanks are passive accumulators and pipes are visual-only in the topology.

---

## Accumulation Components

### **Tank.js** (`/js/components/tanks/Tank.js`)
**Role:** Mass accumulation and storage with level tracking

**Physics Implementation:**
- **Mass Balance Equation:** `dV/dt = Qin - Qout`
- **Volume Integration:** `volume(t) = volume(t-1) + (Qin - Qout) * dt`
- **Level Calculation:** `level = volume / maxVolume`
- **Saturation Constraints:** Volume clamped to `[0, maxVolume]`

**Key Physics Properties:**
- `area` - Cross-sectional area (m²)
- `maxHeight` - Maximum height (m)
- `maxVolume` - Maximum volume = area × maxHeight (m³)
- `volume` - Current volume (m³)
- `level` - Fill level as fraction [0, 1]

**Key Physics Methods:**
- `update(dt)` - Integrates mass balance over timestep
  - Reads: `Qin` from `flowNetwork.getInputFlow(this.id)`
  - Reads: `Qout` from `flowNetwork.getOutputFlow(this.id)`
  - Calculates: `dV = (Qin - Qout) * dt`
  - Updates: `volume`, `level`
- `getOutputFlow()` - Returns 0 (tanks are passive)

**Physical Constraints:**
- Volume bounded: `0 ≤ volume ≤ maxVolume`
- Level bounded: `0 ≤ level ≤ 1`

**Status Detection:**
- `isEmpty()` - volume < 0.001 m³
- `isFull()` - volume ≥ maxVolume - 0.001 m³
- `isLow()` - level < lowThreshold (default 0.1)
- `isHigh()` - level > highThreshold (default 0.9)

---

## Flow Generation Components

### **Pump.js** (`/js/components/pumps/Pump.js`)
**Role:** Active flow generation with constraint-based physics

**Physics Implementation:**
- **Flow Generation:** Pump creates flow based on capacity and speed
- **Multi-Constraint Logic:** Actual flow is minimum of all constraints
- **Cavitation Modeling:** Temporary flow reduction when tank level low
- **Tank Depletion:** Creates explicit tank→pump flow to drain source

**Key Physics Properties:**
- `capacity` - Maximum flow rate at full speed (m³/s)
- `efficiency` - Mechanical efficiency (typical 0.95)
- `speed` - Operating speed [0, 1]
- `requiresMinLevel` - Minimum tank level required to operate
- `running` - Boolean operational state

**Cavitation Physics:**
- `cavitation.triggerTime` - Time until cavitation starts (s)
- `cavitation.duration` - Duration of cavitation event (s)
- `cavitation.flowReduction` - Flow multiplier during cavitation (e.g., 0.3)
- `cavitation.active` - Current cavitation state

**Key Physics Methods:**
- `getOutputFlow()` - **Complex constraint-based calculation:**
  ```
  1. Base flow = capacity × speed × efficiency
  2. If cavitation active: multiply by flowReduction
  3. Check tank constraint: availableFromTank = tank.volume × 0.5
  4. Check valve constraint: valveLimit = valve.maxFlow × valve.position
  5. Actual flow = min(baseFlow, tankConstraint, valveConstraint)
  6. Create tank→pump flow to deplete source
  ```

- `update(dt)` - Updates cavitation state and runtime tracking

**Constraint Resolution:**
- **Tank Availability:** Cannot pump more than 50% of tank volume per second
- **Minimum Level:** Returns 0 if `tank.level < requiresMinLevel`
- **Valve Throttling:** Respects downstream valve position
- **Cavitation:** Reduces flow by `flowReduction` factor when active

**Pump Variants:**
- `FixedSpeedPump.js` - Single speed (on/off only)
- `VariableSpeedPump.js` - Continuous speed control 0-100%
- `ThreeSpeedPump.js` - Three discrete speeds (Low/Med/High)

---

## Flow Control Components

### **Valve.js** (`/js/components/valves/Valve.js`)
**Role:** Flow throttling and proportional control

**Physics Implementation:**
- **Linear Throttling:** `Q = maxFlow × position`
- **Smooth Position Transitions:** First-order lag response
- **Binary States:** Closed (<5%), Partial (5-95%), Open (>95%)

**Key Physics Properties:**
- `maxFlow` - Maximum flow when fully open (m³/s)
- `position` - Current valve position [0, 1]
- `targetPosition` - Desired position (for smooth transitions)
- `responseTime` - Time constant for position changes (s)

**Key Physics Methods:**
- `getOutputFlow()` - Returns `maxFlow × position`
- `update(dt)` - Smooth position transition:
  ```
  delta = targetPosition - position
  step = (delta / responseTime) × dt
  position += step
  ```

**Control Methods:**
- `setPosition(pos)` - Set target position [0, 1]
- `open()` - Fully open (position = 1.0)
- `close()` - Fully close (position = 0.0)

**Physical Behavior:**
- Proportional flow control
- Smooth mechanical response (avoids instantaneous changes)
- Can be used as flow limiter or on/off control

---

## Boundary Condition Components

### **Feed.js** (`/js/components/sources/Feed.js`)
**Role:** Infinite supply source (boundary condition)

**Physics Implementation:**
- **Infinite Source:** Provides unlimited flow up to `maxFlow`
- **Pressure Boundary:** Specifies supply pressure (future use)
- **Demand-Driven:** Supplies whatever downstream components need

**Key Physics Properties:**
- `supplyPressure` - Supply pressure (bar), typical 3.0 for water main
- `maxFlow` - Maximum supply rate (m³/s), default Infinity
- `temperature` - Supply temperature (°C), for future thermal modeling
- `available` - Can be shut off to simulate supply failure

**Key Physics Methods:**
- `getOutputFlow()` - Returns `maxFlow` (or 0 if unavailable)
- `update(dt)` - Tracks actual flow consumed by downstream

**Boundary Physics:**
- No mass accumulation (infinite reservoir)
- No inputs (source node)
- Provides baseline pressure for system

**Usage:**
- Water supply mains
- Process feed lines
- Infinite reservoirs

---

### **Drain.js** (`/js/components/sinks/Drain.js`)
**Role:** Infinite discharge capacity (boundary condition)

**Physics Implementation:**
- **Infinite Sink:** Accepts any flow rate up to `maxCapacity`
- **Pressure Boundary:** Specifies ambient/discharge pressure
- **Accumulation Tracking:** Records total discharge volume

**Key Physics Properties:**
- `ambientPressure` - Discharge pressure (bar), typical 1.0 (atmospheric)
- `maxCapacity` - Maximum acceptance rate (m³/s), default Infinity
- `backpressure` - Resistance to flow (bar), future use
- `open` - Can be closed to simulate blocked outlet

**Key Physics Methods:**
- `getOutputFlow()` - Returns 0 (sinks have no outputs)
- `update(dt)` - Tracks discharge:
  ```
  flowRate = flowNetwork.getInputFlow(this.id)
  totalDischarge += flowRate × dt
  ```

**Boundary Physics:**
- No mass accumulation (infinite capacity)
- No outputs (sink node)
- Sets downstream pressure boundary condition

**Usage:**
- Sewer discharge
- Process outlets
- Atmospheric vents
- Product streams

---

## Monitoring Components

### **PressureSensor.js** (`/js/components/sensors/PressureSensor.js`)
**Role:** Pressure measurement at various system locations

**Physics Implementation:**
- **Hydrostatic Pressure:** `P = ρgh + P_atm` (Pascal's Law)
- **Dynamic Pressure:** Simplified velocity head losses
- **Pump Head:** `P_pump = ρg × (capacity × 10m)`
- **Location-Specific Models:** Different calculations for each point

**Key Physics Properties:**
- `fluidDensity` - ρ = 1000 kg/m³ (water)
- `gravity` - g = 9.81 m/s²
- `range` - Measurement range [min, max] in bar
- `accuracy` - Reading precision (bar)
- `heightOffset` - Elevation above datum (m)

**Measurement Point Types:**

1. **`atmospheric`** - Fixed at 1.01325 bar (1 atm)

2. **`tank_bottom`** - Static pressure from liquid column
   ```
   P = P_atm + ρ × g × h_liquid
   where h_liquid = tank.level × tank.maxHeight
   ```

3. **`pump_inlet`** - Suction pressure with elevation and dynamic losses
   ```
   P = P_atm + ρ × g × (h_liquid - h_elevation) - P_velocity_loss
   velocity_head = 0.5 × ρ × v²
   P_velocity_loss = velocity_head × 0.1  (10% loss factor)
   ```

4. **`pump_outlet`** - Discharge pressure with pump head added
   ```
   P = P_inlet + ρ × g × h_pump
   h_pump = pump.capacity × 10  (simplified: 10m head per m³/s)
   ```

5. **`static`** - Simple elevation-based pressure
   ```
   P = P_atm + ρ × g × h_elevation
   ```

**Key Physics Methods:**
- `calculatePressure()` - Returns pressure in bar based on measurement point
- `update(dt)` - Updates reading and calculates trend:
  ```
  pressure = calculatePressure()
  trend = (pressure - previousPressure) / dt
  ```

**Unit Conversion:**
- Internal: Pascals (Pa)
- Output: bar (1 bar = 100,000 Pa)

**Alarm Logic:**
- `lowAlarm` - Triggers when pressure < threshold
- `highAlarm` - Triggers when pressure > threshold
- Alarm states logged to console with ⚠️ indicators

---

## Orchestration Components

### **ComponentManager.js** (`/js/core/ComponentManager.js`)
**Role:** Simulation loop coordinator and time integration

**Physics Functions:**
- **Time Stepping:** Fixed timestep integration (dt = 1/60 s default)
- **Update Loop:** Calls physics update on all components
- **Render Loop:** Updates visual representations
- **Reset/Clear:** Reinitializes system state

**Key Physics Methods:**
- `_simulationLoop()` - Main physics integration loop:
  ```
  1. Calculate dt from performance.now()
  2. flowNetwork.calculateFlows(dt)     ← Flow routing
  3. flowNetwork.updateComponents(dt)   ← Mass balance integration
  4. flowNetwork.renderComponents()     ← Visual updates
  ```

**Timing:**
- Uses `requestAnimationFrame` for smooth 60 FPS
- Measures actual `dt` with `performance.now()`
- Handles variable timesteps for robust integration

**Manager Coordination:**
- Creates and destroys component managers
- Routes configuration to appropriate managers
- Provides centralized reset and clear operations

---

### **Component.js** (`/js/core/Component.js`)
**Role:** Base class for all physical components

**Physics Interface:**
- `getOutputFlow()` - Returns component's output flow (m³/s)
- `update(dt)` - Physics state integration over timestep
- `render()` - Updates visual representation
- `reset()` - Returns to initial physical state

**Common Properties:**
- `id` - Unique identifier
- `type` - Component type (tank, pump, valve, etc.)
- `inputs` - Array of input component IDs
- `outputs` - Array of output component IDs
- `enabled` - Boolean operational state
- `flowNetwork` - Reference to network for flow queries

**State Change Notification:**
- `onChange` - Callback fired when component state changes
- Used to trigger UI updates and flow recalculation

---

## Visual-Only Components (No Physics)

### **Pipe.js** (`/js/components/pipes/Pipe.js`)
**Role:** Visual connection indicator only

**Important:** Pipes do NOT participate in flow calculations in this simulator. They are purely visual elements that represent connections between components. The actual flow routing is handled by the component input/output topology in FlowNetwork.js.

**Properties:**
- `from` - Source component ID (visual only)
- `to` - Destination component ID (visual only)
- `svgPath` - SVG path element for rendering

**Methods:**
- `render()` - Updates visual appearance (adds/removes 'on' class)
- No physics calculations

---

## Physics Summary

### **Mass Balance Model**
The simulator uses a simple explicit Euler integration scheme for mass balance:

```
For each tank:
  dV/dt = Qin - Qout
  V(t+dt) = V(t) + (Qin - Qout) × dt
  level = V / V_max
```

### **Flow Constraints**
Flow is determined by the minimum of all constraints:

```
Q_actual = min(
  Q_pump_capacity,      // Pump mechanical limit
  Q_tank_available,     // Source depletion limit
  Q_valve_throttle,     // Valve position limit
  Q_system_demand       // Downstream acceptance
)
```

### **Pressure Model**
Current implementation uses simplified hydrostatic and pump head equations:

```
P_static = P_atm + ρ × g × h
P_pump = P_inlet + ρ × g × h_pump
h_pump ≈ 10m per m³/s capacity (simplified)
```

**Note:** The pressure system is partially implemented and marked for future enhancement with full Bernoulli equation and friction losses.

### **Boundary Conditions**
- **Dirichlet (Feed):** Infinite supply at specified pressure
- **Neumann (Drain):** Infinite capacity at specified pressure

### **Time Integration**
- **Method:** Explicit Euler
- **Timestep:** Variable (typically 1/60 s for 60 FPS)
- **Stability:** Maintained by constraint-based flow limiting

---

## Physics-Related Files Complete List

**Core Engine:**
1. `/js/core/FlowNetwork.js` - Flow calculation and routing
2. `/js/core/ComponentManager.js` - Time integration and orchestration
3. `/js/core/Component.js` - Base physics interface

**Accumulation:**
4. `/js/components/tanks/Tank.js` - Mass accumulation and level

**Flow Generation:**
5. `/js/components/pumps/Pump.js` - Base pump physics
6. `/js/components/pumps/FixedSpeedPump.js` - Single-speed pump
7. `/js/components/pumps/VariableSpeedPump.js` - Variable-speed pump
8. `/js/components/pumps/ThreeSpeedPump.js` - Three-speed pump

**Flow Control:**
9. `/js/components/valves/Valve.js` - Throttling and flow control

**Boundary Conditions:**
10. `/js/components/sources/Feed.js` - Infinite source
11. `/js/components/sinks/Drain.js` - Infinite sink

**Monitoring:**
12. `/js/components/sensors/PressureSensor.js` - Pressure measurement

**Non-Physics (Visual Only):**
- `/js/components/pipes/Pipe.js` - Visual connections (no flow physics)

**Stub Files (Unused):**
- `/js/utils/math.js` - Empty stub
- `/js/utils/validation.js` - Empty stub

---

## Future Physics Enhancements

Based on code comments and placeholder properties, planned enhancements include:

1. **Full Pressure Network:**
   - Complete Bernoulli equation implementation
   - Friction losses (Darcy-Weisbach)
   - Minor losses (fittings, valves)
   - Network pressure solver

2. **Thermal Modeling:**
   - Temperature tracking (property exists in Feed.js)
   - Heat exchangers
   - Thermal expansion effects

3. **Pump Curves:**
   - Head-flow characteristic curves
   - System resistance curves
   - Operating point determination

4. **Valve Characteristics:**
   - Non-linear Cv curves
   - Quick-opening, linear, equal-percentage
   - Pressure drop calculations

5. **Transient Analysis:**
   - Water hammer simulation
   - Pump start/stop transients
   - Valve closure rates

6. **Advanced Features:**
   - Multi-phase flow (gas/liquid)
   - Compressible flow
   - Viscosity effects
   - Reynolds number dependent losses

---

## Physics Constants Reference

**Fluid Properties (Water):**
- Density: ρ = 1000 kg/m³
- Gravity: g = 9.81 m/s²
- Atmospheric pressure: P_atm = 101,325 Pa (1.01325 bar)

**Unit Conversions:**
- 1 bar = 100,000 Pa
- 1 atm = 1.01325 bar = 101,325 Pa
- 1 m of head (water) = 9,810 Pa ≈ 0.0981 bar

**Typical Operating Values:**
- Water main pressure: 2-5 bar
- Pump discharge: 3-10 bar
- Tank static pressure: 0-1 bar per 10m height
- Flow velocity: 0.5-3 m/s typical

---

## Diagnostic Tools

**Console Logging:**
- ✅ Success messages (green checkmark)
- ❌ Error messages (red X)
- ⚠️ Warning messages (yellow warning)

**Network Verification:**
- `flowNetwork.verifyIntegrity()` - Checks topology
- `flowNetwork.getNetworkInfo()` - Returns component/flow data
- `flowNetwork._logTopology()` - Logs flow paths

**Component Info:**
- Each component has `getInfo()` method returning physical state
- Includes current flows, levels, pressures, states

---

## End of Physics Components Guide
