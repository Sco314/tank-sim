/**
 * Dynamic Tank Level Controller
 *
 * This module provides functions to dynamically update the tank liquid level
 * and percentage display. It can receive input from any source.
 *
 * Tank Dimensions:
 * - Total liquid area height: 396.825 units
 * - Liquid bottom Y: 484.952 (fixed position)
 * - Liquid top Y at 100%: 88.127
 * - Tank width: 342.685 units
 * - Center X: 181.4825
 */

// Tank configuration constants
const TANK_CONFIG = {
    totalHeight: 396.825,
    bottomY: 484.952,
    topY: 88.127,
    centerX: 181.4825,
    leftX: 10.14,
    width: 342.685,
    ellipseRx: 171.3425,
    ellipseRy: 15,
    textOffset: 22 // Distance above liquid surface for text
};

/**
 * Calculate liquid dimensions based on percentage
 * @param {number} percentage - Tank level percentage (0-100)
 * @returns {object} Object containing liquidHeight, liquidTopY, textY
 */
function calculateLiquidDimensions(percentage) {
    // Clamp percentage between 0 and 100
    percentage = Math.max(0, Math.min(100, percentage));

    // Calculate liquid height
    const liquidHeight = (percentage / 100) * TANK_CONFIG.totalHeight;

    // Calculate top Y position (liquid grows from bottom)
    const liquidTopY = TANK_CONFIG.bottomY - liquidHeight;

    // Calculate text Y position (above the liquid surface)
    const textY = liquidTopY - TANK_CONFIG.textOffset;

    return {
        liquidHeight,
        liquidTopY,
        textY,
        percentage: Math.round(percentage) // Whole number, no decimals
    };
}

/**
 * Update the tank level display
 * @param {number} percentage - Tank level percentage (0-100)
 */
function updateTankLevel(percentage) {
    const dimensions = calculateLiquidDimensions(percentage);

    // Get SVG elements
    const liquidRect = document.getElementById('liquidRect');
    const liquidTop = document.getElementById('liquidTop');
    const percentageText = document.getElementById('percentageText');

    if (!liquidRect || !liquidTop || !percentageText) {
        console.error('Tank SVG elements not found');
        return;
    }

    // Update liquid rectangle
    liquidRect.setAttribute('y', dimensions.liquidTopY);
    liquidRect.setAttribute('height', dimensions.liquidHeight);

    // Update curved top ellipse
    liquidTop.setAttribute('cy', dimensions.liquidTopY);

    // Update percentage text
    percentageText.textContent = dimensions.percentage;
    percentageText.setAttribute('y', dimensions.textY);

    // Hide text if tank is too empty (text would overlap with top structure)
    if (dimensions.textY < 70) {
        percentageText.style.opacity = '0';
    } else {
        percentageText.style.opacity = '1';
    }

    // Optional: Hide ellipse and text if level is 0
    if (percentage === 0) {
        liquidTop.style.display = 'none';
        percentageText.style.display = 'none';
    } else {
        liquidTop.style.display = 'block';
        percentageText.style.display = 'block';
    }
}

/**
 * Animate tank level change over time
 * @param {number} targetPercentage - Target tank level (0-100)
 * @param {number} duration - Animation duration in milliseconds
 */
function animateTankLevel(targetPercentage, duration = 1000) {
    const liquidRect = document.getElementById('liquidRect');
    if (!liquidRect) return;

    // Get current percentage from current height
    const currentHeight = parseFloat(liquidRect.getAttribute('height'));
    const currentPercentage = (currentHeight / TANK_CONFIG.totalHeight) * 100;

    const startTime = performance.now();
    const startPercentage = currentPercentage;
    const deltaPercentage = targetPercentage - startPercentage;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out)
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentPercentage = startPercentage + (deltaPercentage * easeProgress);
        updateTankLevel(currentPercentage);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Set up tank to receive updates from various sources
 */
const TankDataSource = {
    /**
     * Poll a REST API endpoint for tank data
     * @param {string} url - API endpoint URL
     * @param {number} interval - Polling interval in milliseconds
     * @param {function} dataExtractor - Function to extract percentage from response
     */
    pollAPI: function(url, interval = 5000, dataExtractor = (data) => data.level) {
        const poll = async () => {
            try {
                const response = await fetch(url);
                const data = await response.json();
                const percentage = dataExtractor(data);
                updateTankLevel(percentage);
            } catch (error) {
                console.error('Error polling API:', error);
            }
        };

        poll(); // Initial poll
        return setInterval(poll, interval);
    },

    /**
     * Connect to WebSocket for real-time updates
     * @param {string} wsUrl - WebSocket URL
     * @param {function} dataExtractor - Function to extract percentage from message
     */
    connectWebSocket: function(wsUrl, dataExtractor = (data) => data.level) {
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const percentage = dataExtractor(data);
                updateTankLevel(percentage);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return ws;
    },

    /**
     * Set up Server-Sent Events (SSE) connection
     * @param {string} sseUrl - SSE endpoint URL
     * @param {function} dataExtractor - Function to extract percentage from event data
     */
    connectSSE: function(sseUrl, dataExtractor = (data) => data.level) {
        const eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const percentage = dataExtractor(data);
                updateTankLevel(percentage);
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
        };

        return eventSource;
    }
};

// Export functions for use in other modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateTankLevel,
        animateTankLevel,
        TankDataSource,
        TANK_CONFIG
    };
}
