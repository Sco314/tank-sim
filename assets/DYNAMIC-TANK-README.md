# Dynamic Tank Level Display

A fully dynamic SVG-based tank visualization that displays liquid levels with a curved surface and percentage indicator.

## Features

- ✅ **Dynamic liquid level** (0-100%)
- ✅ **Curved liquid surface** that moves with the level
- ✅ **Percentage display** as whole numbers (no decimals)
- ✅ **Bottom-anchored liquid** (grows upward from fixed bottom)
- ✅ **Smooth animations** with easing
- ✅ **Multiple data source integrations** (REST API, WebSocket, SSE)
- ✅ **Responsive and reusable**

## Files

- `dynamic-tank.html` - Complete demo page with interactive controls
- `tank-controller.js` - JavaScript module for controlling the tank
- `Tankstoragevessel-dynamic.svg` - Static SVG example at 75%
- `Tankstoragevessel-01.svg` - Original static SVG at 100%

## Quick Start

### 1. Open the Demo

Simply open `dynamic-tank.html` in a web browser to see the interactive demo.

### 2. Basic Usage in Your HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Tank Monitor</title>
</head>
<body>
    <!-- Include the SVG -->
    <svg id="tankSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 359.25 654.75" width="400">
        <!-- Copy SVG contents from dynamic-tank.html -->
    </svg>

    <!-- Include the controller -->
    <script src="tank-controller.js"></script>

    <script>
        // Update tank to 75%
        updateTankLevel(75);

        // Or animate to 75% over 1 second
        animateTankLevel(75, 1000);
    </script>
</body>
</html>
```

## API Reference

### Core Functions

#### `updateTankLevel(percentage)`

Instantly updates the tank to the specified level.

- **Parameters:**
  - `percentage` (number): Tank level from 0 to 100
- **Example:**
  ```javascript
  updateTankLevel(75); // Set tank to 75%
  ```

#### `animateTankLevel(targetPercentage, duration)`

Smoothly animates the tank to the target level.

- **Parameters:**
  - `targetPercentage` (number): Target level from 0 to 100
  - `duration` (number, optional): Animation duration in milliseconds (default: 1000)
- **Example:**
  ```javascript
  animateTankLevel(50, 2000); // Animate to 50% over 2 seconds
  ```

### Data Source Integrations

The `TankDataSource` object provides helpers for connecting to various data sources:

#### REST API Polling

Poll a REST API endpoint at regular intervals:

```javascript
// Poll every 5 seconds
const pollInterval = TankDataSource.pollAPI(
    'https://api.example.com/tank/status',
    5000,
    (data) => data.levelPercentage // Extract percentage from response
);

// Stop polling
clearInterval(pollInterval);
```

#### WebSocket

Connect to a WebSocket for real-time updates:

```javascript
const ws = TankDataSource.connectWebSocket(
    'wss://api.example.com/tank/live',
    (data) => data.level
);

// Close connection
ws.close();
```

#### Server-Sent Events (SSE)

Connect to an SSE endpoint:

```javascript
const eventSource = TankDataSource.connectSSE(
    'https://api.example.com/tank/events',
    (data) => data.tankLevel
);

// Close connection
eventSource.close();
```

## Integration Examples

### Example 1: MQTT via WebSocket Bridge

```javascript
// Using MQTT.js with WebSocket
const client = mqtt.connect('wss://mqtt.example.com');

client.on('connect', () => {
    client.subscribe('tank/level');
});

client.on('message', (topic, message) => {
    const data = JSON.parse(message.toString());
    updateTankLevel(data.percentage);
});
```

### Example 2: Custom REST API

```javascript
async function fetchTankLevel() {
    try {
        const response = await fetch('https://api.example.com/tank/1');
        const data = await response.json();

        // Assuming API returns: { id: 1, volume: 750, capacity: 1000 }
        const percentage = (data.volume / data.capacity) * 100;

        animateTankLevel(percentage, 500);
    } catch (error) {
        console.error('Failed to fetch tank level:', error);
    }
}

// Update every 10 seconds
setInterval(fetchTankLevel, 10000);
fetchTankLevel(); // Initial fetch
```

### Example 3: Simulated Sensor Data

```javascript
// Simulate sensor readings with random walk
let currentLevel = 75;

setInterval(() => {
    // Random walk: +/- 0-5%
    const change = (Math.random() - 0.5) * 10;
    currentLevel = Math.max(0, Math.min(100, currentLevel + change));

    animateTankLevel(currentLevel, 800);
}, 2000);
```

### Example 4: Form Input

```javascript
document.getElementById('tankForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const level = parseFloat(document.getElementById('levelInput').value);
    animateTankLevel(level, 1000);
});
```

## Tank Dimensions Reference

The tank SVG uses the following dimensions (useful for customization):

```javascript
const TANK_CONFIG = {
    totalHeight: 396.825,    // Total liquid area height
    bottomY: 484.952,        // Fixed bottom position
    topY: 88.127,            // Top position at 100%
    centerX: 181.4825,       // Horizontal center
    leftX: 10.14,            // Left edge
    width: 342.685,          // Tank width
    ellipseRx: 171.3425,     // Ellipse horizontal radius
    ellipseRy: 15,           // Ellipse vertical radius
    textOffset: 22           // Text position above liquid
};
```

## Customization

### Change Colors

Edit the CSS classes in the SVG:

```css
.cls-2 {
    fill: #15bac7; /* Liquid color - change to any color */
}

.cls-percentage {
    fill: #333333; /* Text color */
    font-size: 32px; /* Text size */
}
```

### Change Text Position

Modify `textOffset` in `tank-controller.js`:

```javascript
const TANK_CONFIG = {
    // ...
    textOffset: 30 // Increase for more space above liquid
};
```

### Add Multiple Tanks

Give each SVG a unique ID:

```html
<svg id="tank1" ...>...</svg>
<svg id="tank2" ...>...</svg>

<script>
function updateTank(tankId, percentage) {
    const svg = document.getElementById(tankId);
    const liquidRect = svg.querySelector('#liquidRect');
    // ... update logic
}

updateTank('tank1', 75);
updateTank('tank2', 50);
</script>
```

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Technical Notes

1. **Coordinate System**: SVG uses top-left origin, so liquid "grows upward" by decreasing the Y coordinate.

2. **Percentage Display**: Always shows whole numbers (no decimals) as requested.

3. **Text Visibility**: Text automatically hides when tank level is too low to avoid overlap with tank structure.

4. **Performance**: Uses `requestAnimationFrame` for smooth 60fps animations.

5. **Error Handling**: Functions include validation to clamp values between 0-100%.

## Troubleshooting

### Text not visible
- Check that percentage is > 15% (text hides at very low levels)
- Verify text color contrasts with background

### Liquid not updating
- Ensure SVG elements have correct IDs: `liquidRect`, `liquidTop`, `percentageText`
- Check browser console for errors
- Verify `tank-controller.js` is loaded

### Animation jerky
- Reduce update frequency if receiving data too rapidly
- Use `animateTankLevel()` instead of rapid `updateTankLevel()` calls

## License

This component is part of the tank-sim project.
