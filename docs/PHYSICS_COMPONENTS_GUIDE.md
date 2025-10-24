# Tank Simulator - Physics Components Guide

## Overview
This document catalogs every component that reads, monitors, controls, or manipulates the process physics of the tank simulator. The physics implementation is based on mass balance, flow constraints, and simplified hydraulic principles.

---

## Core Physics Engine

### **FlowNetwork.js** (`/js/core/FlowNetwork.js`)
**Role:** Central flow calculation engine and network topology manager{Start new edit 10-24-25 19:31} with pressure propagation{end new edit 10-24-25 19:31}

**Physics Functions:**
- **Mass Flow Routing:** Manages flow connections between components using a directed graph
- **Flow Conservation:** Calculates flow distribution through the network topology
- **Boundary Condition Handling:** Implements feed (infinite source) and drain (infinite sink) boundary conditions
- **Network Validation:** Verifies flow continuity from sources to sinks
{Start new edit 10-24-25 19:31}
- **Pressure Propagation:** Calculates pressure at all nodes using hydrostatic, pump head, and valve drop equations
{end new edit 10-24-25 19:31}

**Key Physics Methods:**
- `calculateFlows(dt)` - Computes all flows in network based on component states
- `setFlow(fromId, toId, flowRate)` - Records flow rates between components (m³/s)
- `getInputFlow(componentId)` - Returns total inflow to a component
- `getOutputFlow(componentId)` - Returns total outflow from a component
- `_applyBoundaryConditions()` - Ensures boundary conditions are satisfied
{Start new edit 10-24-25 19:31}
- `_calculatePressures()` - Calculates pressure at all components:
  - Feed: Uses `supplyPressure` boundary condition
  - Tank: Hydrostatic pressure `P = P_atm + ρgh`
  - Pump: Adds pump head `ΔP = ρg × (capacity × 10m)`
  - Valve: Pressure drop `ΔP = K × ½ρv²` where K = f(position)
  - Drain: Uses `ambientPressure` boundary condition
- `getPressure(componentId)` - Returns pressure at component (bar)
- `_getInletPressure(componentId)` - Gets pressure from upstream component
{end new edit 10-24-25 19:31}

**Data Read:**
- Component states (enabled, position, speed)
- Network topology (inputs/outputs connections)
- Component constraints (capacity, position, availability)

**Data Written:**
- Flow rates in `this.flows` Map (`'from->to'` → flowRate)
- ~~Pressure data in `this.pressures` Map (optional, future use)~~ {10-24-25 19:31}
{Start new edit 10-24-25 19:31}
- Pressure data in `this.pressures` Map (bar, calculated each timestep)
{end new edit 10-24-25 19:31}

**Physics Processing Order:**
1. Feed (boundary sources)
2. Valve (flow controllers)
3. Pump (active movers)
{Start new edit 10-24-25 19:31}
4. Heat exchanger (temperature modifiers, passive to flow)
{end new edit 10-24-25 19:31}
~~4.~~ 5. Drain (boundary sinks) {10-24-25 19:31}
~~5.~~ 6. Sensor (monitors only) {10-24-25 19:31}

**Note:** Tanks are passive accumulators and pipes are visual-only in the topology.

---

## Accumulation Components

### **Tank.js** (`/js/components/tanks/Tank.js`)
**Role:** Mass accumulation and storage with level tracking{Start new edit 10-24-25 19:31} and thermal energy balance{end new edit 10-24-25 19:31}

**Physics Implementation:**
- **Mass Balance Equation:** `dV/dt = Qin - Qout`
- **Volume Integration:** `volume(t) = volume(t-1) + (Qin - Qout) * dt`
- **Level Calculation:** `level = volume / maxVolume`
- **Saturation Constraints:** Volume clamped to `[0, maxVolume]`
{Start new edit 10-24-25 19:31}
- **Energy Balance Equation:** `dH/dt = Hin - Hout + Qheat`
- **Enthalpy Calculation:** `H = m × Cp × T` (reference at 0°C)
- **Temperature Integration:** `T = H / (m × Cp)`
- **Heat Transfer with Environment:** `Q = h × A × (Tambient - T)`
{end new edit 10-24-25 19:31}

**Key Physics Properties:**
- `area` - Cross-sectional area (m²)
- `maxHeight` - Maximum height (m)
- `maxVolume` - Maximum volume = area × maxHeight (m³)
- `volume` - Current volume (m³)
- `level` - Fill level as fraction [0, 1]
{Start new edit 10-24-25 19:31}
- `temperature` - Fluid temperature (°C)
- `enthalpy` - Total thermal energy (J)
- `fluidDensity` - Density (kg/m³, default 1000 for water)
- `specificHeat` - Specific heat capacity (J/(kg·K), default 4186 for water)
- `ambientTemperature` - Surrounding temperature (°C)
- `heatTransferCoeff` - Heat transfer coefficient (W/(m²·K), 0 = insulated)
{end new edit 10-24-25 19:31}

**Key Physics Methods:**
- `update(dt)` - Integrates mass balance over timestep
  - Reads: `Qin` from `flowNetwork.getInputFlow(this.id)`
  - Reads: `Qout` from `flowNetwork.getOutputFlow(this.id)`
  - Calculates: `dV = (Qin - Qout) * dt`
  - Updates: `volume`, `level`
{Start new edit 10-24-25 19:31}
  - Calls: `_updateEnergyBalance(Qin, Qout, dt)` to update temperature and enthalpy
- `_updateEnergyBalance(Qin, Qout, dt)` - Integrates energy balance
  - Reads: Inlet temperature from upstream components
  - Calculates: Enthalpy flows (Hin, Hout)
  - Calculates: Heat transfer with environment
  - Updates: `enthalpy`, `temperature`
- `setTemperature(temp)` - Sets temperature and updates enthalpy
- `_getInletTemperature()` - Retrieves temperature from upstream components or feeds
{end new edit 10-24-25 19:31}
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

{Start new edit 10-24-25 19:31}

## Heat Transfer Components

### **HeatExchanger.js** (`/js/components/heat/HeatExchanger.js`)
**Role:** Thermal energy transfer between two fluid streams

**Physics Implementation:**
- **Effectiveness-NTU Method:** `Q = ε × Cmin × (Th,in - Tc,in)`
- **Heat Transfer Rate:** `Q = U × A × LMTD` (alternative formulation)
- **Energy Balance:** Hot side cools, cold side heats
- **Flow Configurations:** Counterflow, parallel flow, crossflow supported

**Key Physics Properties:**
- `heatTransferCoeff` - U: Overall heat transfer coefficient (W/(m²·K))
- `area` - A: Heat transfer surface area (m²)
- `effectiveness` - ε: Thermal effectiveness (0-1)
- `flowConfiguration` - Flow arrangement ('counterflow', 'parallel', 'crossflow')
- `hotFluidDensity` - Hot side fluid density (kg/m³)
- `hotFluidSpecificHeat` - Hot side Cp (J/(kg·K))
- `coldFluidDensity` - Cold side fluid density (kg/m³)
- `coldFluidSpecificHeat` - Cold side Cp (J/(kg·K))
- `foulingFactor` - Thermal resistance from fouling (m²·K/W)

**Key Physics Methods:**
- `_calculateHeatTransfer()` - Calculates Q using effectiveness-NTU method:
  ```
  Chot = mdot_hot × Cp_hot  (W/K)
  Ccold = mdot_cold × Cp_cold  (W/K)
  Cmin = min(Chot, Ccold)
  Cr = Cmin / Cmax
  NTU = (U × A) / Cmin
  ε = f(NTU, Cr, configuration)  (effectiveness correlations)
  Qmax = Cmin × (Th,in - Tc,in)
  Q = ε × Qmax
  ```
- `_calculateOutletTemperatures()` - Determines outlet temperatures:
  ```
  Th,out = Th,in - Q / Chot
  Tc,out = Tc,in + Q / Ccold
  ```
- `getLMTD()` - Calculates Log Mean Temperature Difference:
  ```
  LMTD = (ΔT1 - ΔT2) / ln(ΔT1 / ΔT2)
  where ΔT1 = Th,in - Tc,out
        ΔT2 = Th,out - Tc,in
  ```
- `update(dt)` - Updates heat transfer and outlet temperatures

**Operating States:**
- `heatTransferRate` - Current Q (W, positive = hot to cold)
- `hotSideInletTemp`, `hotSideOutletTemp` - Hot side temperatures (°C)
- `coldSideInletTemp`, `coldSideOutletTemp` - Cold side temperatures (°C)
- `hotSideFlowRate`, `coldSideFlowRate` - Flow rates (m³/s)

**Physical Constraints:**
- Hot outlet temperature ≥ cold inlet temperature (2nd law of thermodynamics)
- Cold outlet temperature ≤ hot inlet temperature
- Heat transfer only occurs when Th,in > Tc,in

**Effectiveness Correlations:**
- **Counterflow:** Most efficient, ε = (1 - exp(-NTU(1-Cr))) / (1 - Cr×exp(-NTU(1-Cr)))
- **Parallel flow:** ε = (1 - exp(-NTU(1+Cr))) / (1 + Cr)
- **Crossflow:** Intermediate efficiency, approximate correlation

---

{end new edit 10-24-25 19:31}

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

{Start new edit 10-24-25 19:31}

### **FlowSensor.js** (`/js/components/sensors/FlowSensor.js`)
**Role:** Flow rate measurement at any system location

**Physics Implementation:**
- **Volumetric Flow:** Measures m³/s directly from flow network
- **Mass Flow:** Converts to kg/s using fluid density
- **Time-Averaging:** Smooths readings over configurable time window
- **Totalizer:** Accumulates total volume passed through sensor

**Key Physics Properties:**
- `range` - Measurement range [min, max] in m³/s or gpm
- `units` - Display units ('m³/s', 'gpm', 'lps', 'kg/s')
- `accuracy` - Reading precision (m³/s)
- `measurementType` - 'volumetric' or 'mass'
- `fluidDensity` - ρ for mass flow conversion (kg/m³)
- `averagingTime` - Time window for averaging (s)

**Key Physics Methods:**
- `measureFlow()` - Reads flow from network: `flowNetwork.getInputFlow(this.id)`
- `update(dt)` - Updates reading, average, totalizer, and checks alarms
- `resetTotalizer()` - Resets cumulative volume counter

**Measurements:**
- `flowRate` - Instantaneous flow rate
- `averageFlow` - Time-averaged flow rate
- `totalVolume` - Cumulative volume (totalizer)
- `trend` - Rate of change (flow acceleration)

**Alarm Logic:**
- `lowAlarm` - Low flow alarm threshold
- `highAlarm` - High flow alarm threshold
- Supports no-flow detection

---

### **TemperatureSensor.js** (`/js/components/sensors/TemperatureSensor.js`)
**Role:** Temperature measurement at any system location

**Physics Implementation:**
- **Fluid Temperature:** Reads temperature from connected components (tanks, feeds, heat exchangers)
- **Multiple Measurement Points:** 'fluid', 'tank', 'inlet', 'outlet', 'ambient'
- **Unit Conversion:** Supports both Celsius and Fahrenheit display
- **Time-Averaging:** Smooths readings for stability

**Key Physics Properties:**
- `range` - Measurement range [min, max] in °C
- `units` - Display units ('°C' or '°F')
- `accuracy` - Reading precision (°C)
- `measurementPoint` - Location type for measurement
- `averagingTime` - Time window for averaging (s)

**Measurement Point Types:**
1. **`ambient`** - Constant ambient temperature (20°C)
2. **`tank`** - Temperature of fluid in connected tank
3. **`inlet`** - Temperature of incoming flow
4. **`outlet`** - Temperature of outgoing flow
5. **`fluid`** - General fluid temperature from any connected component

**Key Physics Methods:**
- `measureTemperature()` - Reads temperature from connected components
- `getTemperatureFahrenheit()` - Converts reading to Fahrenheit
- `update(dt)` - Updates reading, trend, and checks alarms

**Alarm Logic:**
- `lowAlarm` - Low temperature alarm (°C)
- `highAlarm` - High temperature alarm (°C)

---

### **LevelSensor.js** (`/js/components/sensors/LevelSensor.js`)
**Role:** Liquid level measurement in tanks

**Physics Implementation:**
- **Level Reading:** Reads level fraction (0-1) from connected tank
- **Multiple Units:** Supports %, meters, feet, volume (m³, gallons)
- **Four-Level Alarming:** Low-low, low, high, high-high thresholds
- **Trend Detection:** Monitors rate of level change

**Key Physics Properties:**
- `range` - Measurement range [min, max]
- `units` - Display units ('%', 'm', 'ft', 'm³', 'gal')
- `accuracy` - Reading precision (%)
- `measurementType` - 'percent', 'height', or 'volume'

**Measurements:**
- `level` - Level as fraction (0-1)
- `levelPercent` - Level as percentage (0-100%)
- `height` - Liquid height in meters
- `volume` - Liquid volume in m³

**Key Physics Methods:**
- `measureLevel()` - Reads level from connected tank
- `update(dt)` - Updates reading, trend, and checks alarms
- `getLevelString()` - Formats reading with appropriate units

**Alarm Logic:**
- `lowLowAlarm` - Critical low level alarm
- `lowAlarm` - Low level warning
- `highAlarm` - High level warning
- `highHighAlarm` - Critical high level alarm
- Color-coded visual indication (green/orange/red)

---

{end new edit 10-24-25 19:31}

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

{Start new edit 10-24-25 19:31}

### **Energy Balance Model**
Tanks implement thermal energy conservation with environment heat transfer:

```
For each tank:
  dH/dt = Hin - Hout + Qheat
  H = m × Cp × T  (enthalpy, reference at 0°C)
  Hin = mdot_in × Cp × T_in
  Hout = mdot_out × Cp × T_out
  Qheat = h × A × (T_ambient - T)  (heat transfer with environment)
  T = H / (m × Cp)  (temperature from enthalpy)
```

Heat exchangers use effectiveness-NTU method for energy transfer between streams:

```
Q = ε × Cmin × (Th,in - Tc,in)
where ε = effectiveness (0-1)
      C = mdot × Cp (heat capacity rate)
      Cmin = min(Chot, Ccold)
```

{end new edit 10-24-25 19:31}

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
~~Current implementation uses simplified hydrostatic and pump head equations:~~ {10-24-25 19:31}
{Start new edit 10-24-25 19:31}
The simulator calculates pressure at all network nodes using simplified hydrostatic and pump head equations:
{end new edit 10-24-25 19:31}

```
P_static = P_atm + ρ × g × h
P_pump = P_inlet + ρ × g × h_pump
h_pump ≈ 10m per m³/s capacity (simplified)
{Start new edit 10-24-25 19:31}
P_valve = P_inlet - K × (½ρv²)  (pressure drop through valve)
{end new edit 10-24-25 19:31}
```

~~**Note:** The pressure system is partially implemented and marked for future enhancement with full Bernoulli equation and friction losses.~~ {10-24-25 19:31}
{Start new edit 10-24-25 19:31}
**Note:** Pressure is calculated each timestep and available via `flowNetwork.getPressure(componentId)`. Future enhancements may include full Bernoulli equation and detailed friction losses.
{end new edit 10-24-25 19:31}

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
1. `/js/core/FlowNetwork.js` - Flow calculation and routing{Start new edit 10-24-25 19:31}, pressure propagation{end new edit 10-24-25 19:31}
2. `/js/core/ComponentManager.js` - Time integration and orchestration
3. `/js/core/Component.js` - Base physics interface

**Accumulation:**
4. `/js/components/tanks/Tank.js` - Mass accumulation and level{Start new edit 10-24-25 19:31}, temperature and energy balance{end new edit 10-24-25 19:31}

**Flow Generation:**
5. `/js/components/pumps/Pump.js` - Base pump physics
6. `/js/components/pumps/FixedSpeedPump.js` - Single-speed pump
7. `/js/components/pumps/VariableSpeedPump.js` - Variable-speed pump
8. `/js/components/pumps/ThreeSpeedPump.js` - Three-speed pump

**Flow Control:**
9. `/js/components/valves/Valve.js` - Throttling and flow control

{Start new edit 10-24-25 19:31}
**Heat Transfer:**
10. `/js/components/heat/HeatExchanger.js` - Energy transfer between fluid streams
{end new edit 10-24-25 19:31}

**Boundary Conditions:**
~~10.~~ 11. `/js/components/sources/Feed.js` - Infinite source {10-24-25 19:31}
~~11.~~ 12. `/js/components/sinks/Drain.js` - Infinite sink {10-24-25 19:31}

**Monitoring:**
~~12.~~ 13. `/js/components/sensors/PressureSensor.js` - Pressure measurement {10-24-25 19:31}
{Start new edit 10-24-25 19:31}
14. `/js/components/sensors/FlowSensor.js` - Flow rate measurement (volumetric and mass)
15. `/js/components/sensors/TemperatureSensor.js` - Temperature measurement
16. `/js/components/sensors/LevelSensor.js` - Tank level measurement
{end new edit 10-24-25 19:31}

{Start new edit 10-24-25 19:31}
**Utilities:**
17. `/js/utils/units.js` - Unit conversion and formatting (Temperature, Pressure, Flow, Level, Volume)
{end new edit 10-24-25 19:31}

**Non-Physics (Visual Only):**
- `/js/components/pipes/Pipe.js` - Visual connections (no flow physics)

~~**Stub Files (Unused):**~~ {10-24-25 19:31}
~~- `/js/utils/math.js` - Empty stub~~ {10-24-25 19:31}
~~- `/js/utils/validation.js` - Empty stub~~ {10-24-25 19:31}

---

{Start new edit 10-24-25 19:31}

## Unit Conversion and Formatting

### **units.js** (`/js/utils/units.js`)
**Role:** Comprehensive unit conversion and formatting utility for all process variables

**Purpose:**
Supports both SI (metric) and US customary units to meet requirements for:
- **Primary Units (User-Facing):** Temperature in °F, Pressure in psi, Flow in gpm, Level in %
- **Internal Units (Calculations):** Temperature in °C, Pressure in bar, Flow in m³/s, Level in fraction

**Conversion Functions:**

**Temperature:**
- `celsiusToFahrenheit(celsius)` / `fahrenheitToCelsius(fahrenheit)`
- `celsiusToKelvin(celsius)` / `kelvinToCelsius(kelvin)`

**Pressure:**
- `barToPsi(bar)` / `psiToBar(psi)` — 1 bar = 14.5038 psi
- `barToPa(bar)` / `paToBar(pa)` — 1 bar = 100,000 Pa

**Flow:**
- `m3sToGpm(m3s)` / `gpmToM3s(gpm)` — 1 m³/s = 15,850.3 gpm
- `m3sToLps(m3s)` / `lpsToM3s(lps)` — 1 m³/s = 1,000 L/s

**Volume:**
- `m3ToGal(m3)` / `galToM3(gal)` — 1 m³ = 264.172 gal
- `m3ToL(m3)` / `lToM3(l)` — 1 m³ = 1,000 L

**Length:**
- `mToFt(m)` / `ftToM(ft)` — 1 m = 3.28084 ft

**Level:**
- `fractionToPercent(fraction)` / `percentToFraction(percent)`

**Thermodynamic Calculations:**
- `waterEnthalpy(tempCelsius)` - Calculates H = Cp × T (J/kg)
- `temperatureFromEnthalpy(enthalpy)` - Inverse calculation T = H / Cp
- `volumeToMass(volume_m3, density)` - Converts volume to mass: m = ρ × V
- `heightToPressure(height_m, density)` - Hydrostatic pressure: P = ρ × g × h

**Formatting Functions:**
- `formatTemperature(celsius, useFahrenheit, precision)` - Returns formatted string with units
- `formatPressure(bar, usePsi, precision)` - Returns formatted string with units
- `formatFlow(m3s, useGpm, precision)` - Returns formatted string with units
- `formatLevel(fraction, precision)` - Returns percentage with % symbol
- `formatVolume(m3, useGallons, precision)` - Returns formatted string with units

**Physical Constants:**
```javascript
WATER_DENSITY: 1000 kg/m³ (at 20°C)
WATER_SPECIFIC_HEAT: 4186 J/(kg·K) (at 20°C)
GRAVITY: 9.81 m/s²
BAR_TO_PSI: 14.5038
M3S_TO_GPM: 15850.3
```

**Usage Example:**
```javascript
// Convert and format
const tempF = Units.celsiusToFahrenheit(25);  // 77°F
const pressurePsi = Units.barToPsi(3.0);  // 43.51 psi
const flowGpm = Units.m3sToGpm(0.001);  // 15.85 gpm

// Formatted output
const tempStr = Units.formatTemperature(25, true);  // "77.0 °F"
const pressureStr = Units.formatPressure(3.0, true);  // "43.51 psi"
const flowStr = Units.formatFlow(0.001, true);  // "15.85 gpm"
```

**Integration:**
- All sensor components support unit conversion via `units` property
- Tank, Feed, and HeatExchanger use Units for display formatting
- Available globally as `window.Units` singleton

---

{end new edit 10-24-25 19:31}

## Future Physics Enhancements

Based on code comments and placeholder properties, planned enhancements include:

1. **Full Pressure Network:**
   - Complete Bernoulli equation implementation
   - Friction losses (Darcy-Weisbach)
   - Minor losses (fittings, valves)
   - ~~Network pressure solver~~ {10-24-25 19:31} {Start new edit 10-24-25 19:31}**IMPLEMENTED** - Basic pressure solver active{end new edit 10-24-25 19:31}

2. **Thermal Modeling:**
   - ~~Temperature tracking (property exists in Feed.js)~~ {10-24-25 19:31} {Start new edit 10-24-25 19:31}**IMPLEMENTED** - Tank temperature and energy balance complete{end new edit 10-24-25 19:31}
   - ~~Heat exchangers~~ {10-24-25 19:31} {Start new edit 10-24-25 19:31}**IMPLEMENTED** - HeatExchanger component with effectiveness-NTU method{end new edit 10-24-25 19:31}
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

{Start new edit 10-24-25 19:31}

7. **Chemical and Analytical Data (Future Expansion):**
   - **Framework Prepared:** Component architecture supports extensible state variables
   - **Concentration Tracking:** Add species concentration arrays to Tank, Feed components
   - **Chemical Reactions:** Reaction rate equations in tanks (A + B → C)
   - **pH and Conductivity:** Analytical property calculations
   - **Component Composition:** Multi-component mixtures with mole fractions
   - **Property Database:** Fluid property lookup (density, viscosity, Cp) as f(T, composition)
   - **Sensors:** ChemicalSensor, pHSensor, ConductivitySensor, CompositionAnalyzer
   - **Mixing Rules:** Volume-weighted or mass-weighted mixing at junctions
   - **Material Balance:** Species conservation: `dCi/dt = (Cin,i × Qin - Cout,i × Qout) / V + Ri`

**Implementation Notes:**
- Use `tank.composition = { species1: concentration1, species2: concentration2, ... }`
- Add `chemicalProperties` object to Component base class
- Extend `flowNetwork.flows` to include composition data: `{ flowRate, composition }`
- Create ChemicalManager to handle reactions and equilibrium

{end new edit 10-24-25 19:31}

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
