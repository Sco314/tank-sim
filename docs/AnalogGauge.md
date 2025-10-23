# Analog Gauge Component

## Overview

The **AnalogGauge** component is a visual sensor that displays data using a dynamic analog gauge with a rotating pointer. The gauge accepts numeric input (0-100% by default) and animates the pointer to indicate the current value.

## Features

- **Dynamic Pointer Rotation**: The pointer smoothly rotates based on input value
- **Customizable Range**: Configure min/max values and units
- **Smooth Animation**: Optional interpolation for smooth pointer movement
- **Color Zones**: Visual feedback with configurable warning (yellow) and critical (red) thresholds
- **Flexible Configuration**: Adjust rotation angles, smoothing factor, and more

## Component Structure

### Files
- `js/components/sensors/AnalogGauge.js` - Component class
- `assets/guageAnalog.svg` - SVG gauge graphic with pointer
- `analog-gauge-demo.html` - Demo page with interactive controls

### SVG Structure
The gauge uses `assets/guageAnalog.svg` which includes:
- **Pointer group** (`id="pointer"`): The rotating needle element
- **Markers**: Visual indicators for 0%, 10%, 20%, ..., 100%
- **Pivot point**: Centered at coordinates (400, 400)
- **Rotation range**: -135° (bottom-left) to +135° (bottom-right) = 270° total

## Usage

### Basic Initialization

```javascript
// Create gauge instance
const gauge = new AnalogGauge({
  id: 'gauge_1',
  name: 'Pressure Gauge',
  type: 'sensor',
  value: 0,                  // Initial value (0-100)
  minValue: 0,               // Minimum value
  maxValue: 100,             // Maximum value
  units: '%',                // Display units
  svgElement: '#gauge-svg',  // SVG element selector
  smoothing: true,           // Enable smooth transitions
  smoothingFactor: 0.15      // Interpolation speed (0-1)
});
```

### Setting Values

```javascript
// Set gauge value
gauge.setValue(75);  // Set to 75%

// Get current value
const currentValue = gauge.getValue();  // Returns 75

// Get as percentage
const percentage = gauge.getPercentage();  // Returns 75.0
```

### Animation Loop

```javascript
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000; // Delta time in seconds
  lastTime = now;

  // Update gauge (interpolate to target value)
  gauge.update(dt);

  // Render (apply rotation to pointer)
  gauge.render();

  requestAnimationFrame(animate);
}

animate();
```

### Configuration Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | number | 0 | Initial gauge value |
| `minValue` | number | 0 | Minimum value on scale |
| `maxValue` | number | 100 | Maximum value on scale |
| `units` | string | '%' | Units of measurement |
| `minAngle` | number | -135 | Starting angle in degrees |
| `maxAngle` | number | 135 | Ending angle in degrees |
| `smoothing` | boolean | true | Enable smooth transitions |
| `smoothingFactor` | number | 0.2 | Interpolation speed (0-1, higher = faster) |
| `yellowThreshold` | number | 75 | Warning zone starts at this % |
| `redThreshold` | number | 90 | Critical zone starts at this % |
| `svgElement` | string/element | null | SVG container element |

### Color Zones

The gauge automatically determines color zones based on the current value:

```javascript
// Get current color zone
const zone = gauge.getColorZone();  // Returns: 'green', 'yellow', or 'red'

// Get status
const status = gauge.getStatus();  // Returns: 'NORMAL', 'WARNING', or 'CRITICAL'
```

- **Green (NORMAL)**: 0% - 74% (below `yellowThreshold`)
- **Yellow (WARNING)**: 75% - 89% (between `yellowThreshold` and `redThreshold`)
- **Red (CRITICAL)**: 90% - 100% (above `redThreshold`)

### Methods

#### `setValue(value)`
Set the gauge to a specific value.

```javascript
gauge.setValue(50);
```

#### `getValue()`
Get the current gauge value.

```javascript
const value = gauge.getValue();
```

#### `getNormalizedValue()`
Get value normalized to 0-1 range.

```javascript
const normalized = gauge.getNormalizedValue();  // 0.0 to 1.0
```

#### `getPercentage()`
Get value as percentage (0-100).

```javascript
const percent = gauge.getPercentage();  // 0.0 to 100.0
```

#### `update(dt)`
Update gauge state with smooth interpolation. Call this in your animation loop.

```javascript
gauge.update(deltaTime);
```

#### `render()`
Apply the rotation transform to the pointer. Call this after `update()`.

```javascript
gauge.render();
```

#### `getInfo()`
Get detailed gauge information for debugging.

```javascript
const info = gauge.getInfo();
console.log(info);
// {
//   id: 'gauge_1',
//   type: 'sensor',
//   value: 75,
//   percentage: '75.0%',
//   angle: '67.5°',
//   status: 'WARNING',
//   zone: 'yellow',
//   range: '0-100 %'
// }
```

#### `reset()`
Reset gauge to initial state.

```javascript
gauge.reset();
```

## Integration with Tank Simulator

### Adding to Component Library

The analog gauge is registered in `js/componentLibrary.js` under the **Sensors** category:

```javascript
analogGauge: {
  name: 'Analog Gauge',
  category: 'Sensors',
  type: 'analogGauge',
  icon: '🎚️',
  svgPath: 'assets/guageAnalog.svg',
  // ... configuration
}
```

### Using in Simulator

1. **Drag and drop** the Analog Gauge from the Sensors panel in the designer
2. **Configure** properties in the properties panel
3. **Connect** to data sources (tanks, pumps, sensors)
4. **Link** gauge value to simulation data:

```javascript
// Example: Link gauge to tank level
function updateGauges(dt) {
  const tankLevel = tank.getLevel() * 100;  // Get level as percentage
  analogGauge.setValue(tankLevel);
  analogGauge.update(dt);
  analogGauge.render();
}
```

## Demo

Open `analog-gauge-demo.html` in a browser to see an interactive demonstration with:
- **Slider control** to manually adjust the gauge value
- **Random value** button for testing
- **Animate** button to sweep from 0-100%
- **Real-time info** display showing angle, status, and zone

## Technical Details

### Rotation Calculation

The pointer rotation is calculated using linear interpolation:

```javascript
const normalized = (value - minValue) / (maxValue - minValue);
const angleRange = maxAngle - minAngle;  // 270° for default settings
const targetAngle = minAngle + (normalized * angleRange);
```

For default settings (0-100%, -135° to +135°):
- **0%** → -135° (bottom-left)
- **50%** → 0° (top)
- **100%** → +135° (bottom-right)

### Smooth Interpolation

When `smoothing` is enabled, the pointer gradually moves to the target angle:

```javascript
const angleDiff = targetAngle - currentAngle;
currentAngle += angleDiff * smoothingFactor;
```

Higher `smoothingFactor` values (closer to 1.0) result in faster transitions.

### CSS Transform

The rotation is applied using CSS transforms with the pivot point at the gauge center:

```javascript
pointerElement.style.transformOrigin = '400px 400px';
pointerElement.style.transform = `rotate(${currentAngle}deg)`;
```

## Browser Compatibility

- Modern browsers with SVG and CSS transform support
- Chrome, Firefox, Safari, Edge (latest versions)
- Requires ES6+ JavaScript features

## Future Enhancements

Potential improvements:
- Multiple pointers for comparison
- Non-linear scales (logarithmic, exponential)
- Animated ticks/markers
- Numeric display overlay
- Customizable colors and themes
- Touch/drag interaction to set values

## License

Part of the Tank Simulator project.
