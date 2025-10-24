/**
 * tank-controller.js - Dynamic Tank Level Controller
 *
 * Provides real-time tank level visualization and animation.
 * Works with Tankstoragevessel-dynamic.svg which has:
 *   - #liquidRect: The liquid fill rectangle
 *   - #liquidTop: The ellipse showing liquid surface
 *   - #percentageText: The percentage display
 *
 * Usage:
 *   updateTankLevel(tankId, percentage)      // Instant update
 *   animateTankLevel(tankId, targetPercent, duration)  // Animated update
 *
 * Data sources (optional):
 *   TankDataSource.pollAPI(url, interval, callback)
 *   TankDataSource.connectWebSocket(url, callback)
 *   TankDataSource.connectSSE(url, callback)
 */

// Tank dimensions from Tankstoragevessel-dynamic.svg
const TANK_CONFIG = {
  totalHeight: 396.825,      // Total liquid area height
  bottomY: 484.952,          // Fixed bottom Y coordinate
  topY: 88.127,              // Top Y at 100%
  liquidX: 10.14,            // Liquid rectangle X
  liquidWidth: 342.685,      // Liquid rectangle width
  ellipseCx: 181.4825,       // Ellipse center X
  ellipseRx: 171.3425,       // Ellipse radius X
  ellipseRy: 15,             // Ellipse radius Y
  textX: 181.4825,           // Text X position
  textOffsetY: 22            // Text offset above liquid surface
};

/**
 * Update tank level instantly (no animation)
 * @param {string} tankId - The ID of the tank component (e.g., "tank_123")
 * @param {number} percentage - Fill level 0-100
 */
function updateTankLevel(tankId, percentage) {
  // Clamp percentage to 0-100
  const percent = Math.max(0, Math.min(100, percentage));

  // Find the tank element
  const tankEl = document.getElementById(tankId);
  if (!tankEl) {
    console.warn(`Tank ${tankId} not found`);
    return;
  }

  // Find the liquid elements - they may be prefixed with the component ID
  // Try both prefixed (inline SVG) and unprefixed (direct SVG) versions
  let liquidRect = document.getElementById(`${tankId}-liquidRect`) ||
                   tankEl.querySelector('#liquidRect') ||
                   tankEl.querySelector('[id$="liquidRect"]');
  let liquidTop = document.getElementById(`${tankId}-liquidTop`) ||
                  tankEl.querySelector('#liquidTop') ||
                  tankEl.querySelector('[id$="liquidTop"]');
  let percentageText = document.getElementById(`${tankId}-percentageText`) ||
                       tankEl.querySelector('#percentageText') ||
                       tankEl.querySelector('[id$="percentageText"]');

  if (!liquidRect || !liquidTop || !percentageText) {
    console.warn(`Tank ${tankId}: Could not find liquid elements`, {
      liquidRect: !!liquidRect,
      liquidTop: !!liquidTop,
      percentageText: !!percentageText
    });
    return;
  }

  // Calculate liquid dimensions
  const liquidHeight = (percent / 100) * TANK_CONFIG.totalHeight;
  const liquidTopY = TANK_CONFIG.bottomY - liquidHeight;

  // Update liquid rectangle (grows from bottom)
  liquidRect.setAttribute('y', liquidTopY);
  liquidRect.setAttribute('height', liquidHeight);

  // Update liquid top ellipse position
  liquidTop.setAttribute('cy', liquidTopY);

  // Update percentage text
  percentageText.textContent = Math.round(percent);
  percentageText.setAttribute('y', liquidTopY - TANK_CONFIG.textOffsetY);

  // Store current level as data attribute
  tankEl.dataset.level = percent;
}

/**
 * Animate tank level change smoothly
 * @param {string} tankId - The ID of the tank component
 * @param {number} targetPercent - Target fill level 0-100
 * @param {number} duration - Animation duration in milliseconds (default: 1000)
 */
function animateTankLevel(tankId, targetPercent, duration = 1000) {
  const tankEl = document.getElementById(tankId);
  if (!tankEl) {
    console.warn(`Tank ${tankId} not found`);
    return;
  }

  // Get current level or default to 0
  const startPercent = parseFloat(tankEl.dataset.level || 0);
  const targetClamped = Math.max(0, Math.min(100, targetPercent));

  // Animation variables
  const startTime = performance.now();
  const deltaPercent = targetClamped - startPercent;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out cubic easing
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const currentPercent = startPercent + deltaPercent * eased;
    updateTankLevel(tankId, currentPercent);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Data source utilities for real-time tank updates
 */
const TankDataSource = {
  /**
   * Poll an API endpoint for tank level data
   * @param {string} url - API endpoint URL
   * @param {number} interval - Polling interval in milliseconds
   * @param {function} callback - Callback function(data) that should call updateTankLevel
   * @returns {object} Control object with stop() method
   */
  pollAPI(url, interval, callback) {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        callback(data);
      } catch (error) {
        console.error('Tank API poll error:', error);
      }
    }, interval);

    return {
      stop: () => clearInterval(intervalId)
    };
  },

  /**
   * Connect to WebSocket for real-time tank updates
   * @param {string} url - WebSocket URL
   * @param {function} callback - Callback function(data) that should call updateTankLevel
   * @returns {WebSocket} WebSocket instance
   */
  connectWebSocket(url, callback) {
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Tank WebSocket parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Tank WebSocket error:', error);
    };

    return ws;
  },

  /**
   * Connect to Server-Sent Events for tank updates
   * @param {string} url - SSE endpoint URL
   * @param {function} callback - Callback function(data) that should call updateTankLevel
   * @returns {EventSource} EventSource instance
   */
  connectSSE(url, callback) {
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Tank SSE parse error:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Tank SSE error:', error);
    };

    return eventSource;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateTankLevel,
    animateTankLevel,
    TankDataSource,
    TANK_CONFIG
  };
}

// Also attach to window for direct browser usage
if (typeof window !== 'undefined') {
  window.updateTankLevel = updateTankLevel;
  window.animateTankLevel = animateTankLevel;
  window.TankDataSource = TankDataSource;
  window.TANK_CONFIG = TANK_CONFIG;

  console.log('✅ Tank Controller loaded - updateTankLevel() and animateTankLevel() ready');
}
