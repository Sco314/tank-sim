/**
 * exporter.js v3.1 - GitHub Only Exporter
 * 
 * Fetches ALL engine files from GitHub at export time
 * Creates 100% standalone HTML files
 * 
 * Hardcoded to: https://sco314.github.io/tank-sim/101125/
 */

const EXPORTER_VERSION = '3.1.0';
const ENGINE_VERSION = '1.0.0';

// Hardcoded GitHub base URL
const GITHUB_BASE_URL = 'https://sco314.github.io/tank-sim/101125/';

// All engine files to fetch
const ENGINE_FILES = [
  // Core
  'js/core/Component.js',
  'js/core/FlowNetwork.js',
  'js/core/ComponentManager.js',
  
  // Boundary components
  'js/components/sources/Feed.js',
  'js/components/sinks/Drain.js',
  
  // Tanks
  'js/components/tanks/Tank.js',
  
  // Pumps
  'js/components/pumps/Pump.js',
  'js/components/pumps/FixedSpeedPump.js',
  'js/components/pumps/VariableSpeedPump.js',
  'js/components/pumps/ThreeSpeedPump.js',
  
  // Valves
  'js/components/valves/Valve.js',
  
  // Pipes
  'js/components/pipes/Pipe.js',
  
  // Sensors
  'js/components/sensors/PressureSensor.js',
  
  // Managers
  'js/managers/TankManager.js',
  'js/managers/PumpManager.js',
  'js/managers/ValveManager.js',
  'js/managers/PipeManager.js',
  'js/managers/PressureManager.js'
];

// Valve HTML file
const VALVE_HTML_FILE = 'valve.html';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = Date.now();
  }

  /**
   * Main export method
   */
  async exportSimulator(defaultName = 'My Simulator') {
    // Step 1: Prompt for name
    const simName = prompt('Enter simulator name:', defaultName) || defaultName;
    
    if (!simName || simName.trim() === '') {
      alert('Export cancelled - no name provided');
      return;
    }
    
    console.log(`📦 Exporting simulator: ${simName}`);
    
    // Step 2: Validate design
    const validation = this._validateDesign();
    if (!validation.valid) {
      if (!confirm(`⚠️ Issues found:\n\n${validation.errors.join('\n')}\n\nExport anyway?`)) {
        return;
      }
    }
    
    // Step 3: Show progress UI
    const progressUI = this._createProgressUI();
    
    try {
      // Step 4: Fetch all engine files from GitHub
      progressUI.update('⏳ Fetching engine files from GitHub...', 0);
      const engineCode = await this._fetchAllEngineFiles(progressUI);
      
      // Step 5: Fetch valve.html
      progressUI.update('⏳ Fetching valve control...', 80);
      const valveHTML = await this._fetchValveHTML();
      
      // Step 6: Generate complete standalone HTML
      progressUI.update('⏳ Generating HTML...', 90);
      const cleanName = this._sanitizeName(simName);
      const html = this._generateStandaloneHTML(simName, cleanName, engineCode, valveHTML);
      
      // Step 7: Download
      progressUI.update('⏳ Downloading file...', 95);
      this._downloadFile(`${cleanName}.html`, html);
      
      // Step 8: Success!
      progressUI.close();
      
      const fileSize = (html.length / 1024).toFixed(1);
      console.log(`✅ Export complete! File size: ${fileSize} KB`);
      alert(`✅ Export complete!\n\nFile: ${cleanName}.html\nSize: ${fileSize} KB\n\n✓ 100% standalone\n✓ Works anywhere\n✓ Latest engine code from GitHub`);
      
    } catch (error) {
      progressUI.close();
      console.error('❌ Export failed:', error);
      
      // Show detailed error message
      this._showDetailedError(error);
    }
  }

  /**
   * Create progress UI overlay
   */
  _createProgressUI() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#172144;color:#e9f0ff;padding:30px 50px;border-radius:12px;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,0.5);min-width:400px;';
    
    overlay.innerHTML = `
      <div style="font-size:20px;font-weight:600;margin-bottom:12px;" id="progressText">⏳ Starting export...</div>
      <div style="background:#0e1734;height:8px;border-radius:4px;overflow:hidden;">
        <div id="progressBar" style="background:#7cc8ff;height:100%;width:0%;transition:width 0.3s;"></div>
      </div>
      <div style="font-size:13px;margin-top:8px;color:#9bb0ff;" id="progressDetail">Initializing...</div>
    `;
    
    document.body.appendChild(overlay);
    
    return {
      update: (text, percent) => {
        overlay.querySelector('#progressText').textContent = text;
        overlay.querySelector('#progressBar').style.width = percent + '%';
      },
      setDetail: (detail) => {
        overlay.querySelector('#progressDetail').textContent = detail;
      },
      close: () => {
        document.body.removeChild(overlay);
      }
    };
  }

  /**
   * Fetch all engine files from GitHub
   */
  async _fetchAllEngineFiles(progressUI) {
    console.log(`📂 Fetching ${ENGINE_FILES.length} engine files from GitHub...`);
    console.log(`🌐 Base URL: ${GITHUB_BASE_URL}`);
    
    const codeBlocks = [];
    const failedFiles = [];
    let fetchedCount = 0;
    
    for (const path of ENGINE_FILES) {
      const url = GITHUB_BASE_URL + path;
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const code = await response.text();
        const filename = path.split('/').pop();
        
        codeBlocks.push(`
// ============================================================================
// ${filename}
// Path: ${path}
// Source: ${url}
// ============================================================================
${code}`);
        
        fetchedCount++;
        const percent = Math.floor((fetchedCount / ENGINE_FILES.length) * 70); // 0-70%
        progressUI.update('⏳ Fetching engine files from GitHub...', percent);
        progressUI.setDetail(`✓ ${filename} (${fetchedCount}/${ENGINE_FILES.length})`);
        
        console.log(`  ✓ ${filename}`);
        
      } catch (error) {
        console.error(`  ✗ Failed to fetch ${path}:`, error);
        failedFiles.push({
          path: path,
          url: url,
          error: error.message
        });
      }
    }
    
    // If any files failed, throw error with details
    if (failedFiles.length > 0) {
      const errorDetails = {
        failedFiles: failedFiles,
        totalFiles: ENGINE_FILES.length,
        successCount: fetchedCount,
        failCount: failedFiles.length
      };
      throw new Error(JSON.stringify(errorDetails));
    }
    
    const totalCode = codeBlocks.join('\n\n');
    const sizeKB = (totalCode.length / 1024).toFixed(1);
    console.log(`✅ All engine files fetched (${sizeKB} KB)`);
    
    return totalCode;
  }

  /**
   * Fetch valve.html from GitHub
   */
  async _fetchValveHTML() {
    console.log('📂 Fetching valve.html from GitHub...');
    
    const url = GITHUB_BASE_URL + VALVE_HTML_FILE;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log(`  ✓ valve.html (${(html.length / 1024).toFixed(1)} KB)`);
      
      return html;
      
    } catch (error) {
      console.error('  ✗ Failed to fetch valve.html:', error);
      
      const errorDetails = {
        failedFiles: [{
          path: VALVE_HTML_FILE,
          url: url,
          error: error.message
        }],
        totalFiles: 1,
        successCount: 0,
        failCount: 1
      };
      throw new Error(JSON.stringify(errorDetails));
    }
  }

  /**
   * Show detailed error with failed files
   */
  _showDetailedError(error) {
    let errorDetails;
    
    try {
      errorDetails = JSON.parse(error.message);
    } catch (e) {
      // Not a structured error, show generic message
      alert(`❌ Export Failed\n\n${error.message}\n\nCheck console for details.`);
      return;
    }
    
    // Build detailed error message
    const failedList = errorDetails.failedFiles
      .map(f => `• ${f.path}\n  URL: ${f.url}\n  Error: ${f.error}`)
      .join('\n\n');
    
    const message = `❌ Export Failed: Could Not Fetch Files from GitHub

Failed Files (${errorDetails.failCount}/${errorDetails.totalFiles}):

${failedList}

Possible Causes:
• No internet connection
• GitHub Pages is down
• Files have been moved/deleted
• CORS/network firewall blocking requests

What To Do:
1. Check your internet connection
2. Verify GitHub Pages is accessible:
   ${GITHUB_BASE_URL}
3. Try again in a few moments
4. Check browser console for details

If problem persists, contact support.`;
    
    alert(message);
    
    // Also log to console for debugging
    console.error('📋 Detailed Error Report:');
    console.error('Failed files:', errorDetails.failedFiles);
    console.error(`Success: ${errorDetails.successCount}/${errorDetails.totalFiles}`);
  }

  /**
   * Generate complete standalone HTML
   */
  _generateStandaloneHTML(simName, cleanName, engineCode, valveHTML) {
    const svg = document.getElementById('canvas');
    const viewBox = svg ? svg.getAttribute('viewBox') : '0 0 1000 600';
    
    const componentsSVG = this._generateAllComponentsSVG();
    const connectionsSVG = this._generateAllConnectionsSVG();
    const configJSON = this._generateDesignJSON(simName);
    const valveContent = this._extractValveContent(valveHTML);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${simName}</title>
  <meta name="sim-name" content="${simName}">
  <meta name="engine-version" content="${ENGINE_VERSION}">
  <meta name="exporter-version" content="${EXPORTER_VERSION}">
  <meta name="exported" content="${new Date().toISOString()}">
  <meta name="source" content="${GITHUB_BASE_URL}">
  <style>
/* ============================================================================
   EMBEDDED STYLES
   ============================================================================ */
* { box-sizing: border-box; }
body { margin: 0; }

:root {
  --bg: #0b1020;
  --card: #121a33;
  --ink: #e9f0ff;
  --muted: #9bb0ff;
  --accent: #7cc8ff;
  --ok: #3ddc97;
  --danger: #ff6b6b;
}

body {
  margin: 0;
  font: 500 16px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif;
  color: var(--ink);
  background: radial-gradient(1200px 800px at 80% -10%, #1b2752 0%, var(--bg) 60%);
  display: grid;
  place-items: center;
  padding: 18px;
}

.app { width: min(1100px, 95vw); }

.card {
  background: var(--card);
  border: 1px solid #1f2a50;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}

h1 { font-size: 20px; margin: 0 0 8px; }
.sub { color: var(--muted); font-size: 13px; }

.btn {
  background: #172144;
  color: var(--ink);
  border: 1px solid #28366d;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
}
.btn:active { transform: translateY(1px); }

.kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 10px;
  font-variant-numeric: tabular-nums;
}
.kv div:nth-child(odd) { color: var(--muted); }

.stage { display: flex; align-items: center; justify-content: center; }
svg { width: 100%; height: auto; display: block; }

/* Flow animation */
.flow { stroke-dasharray: 10 12; }
.flow.on { animation: dash var(--duration, 600ms) linear infinite; }
@keyframes dash { to { stroke-dashoffset: -22; } }

/* Controls toggle */
.controls-toggle {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  background: #172144;
  color: #e9f0ff;
  border: 1px solid #28366d;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
}

/* Controls drawer */
.controls-drawer {
  position: fixed;
  inset: 0;
  z-index: 999;
  pointer-events: none;
}
.controls-drawer::before {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease;
}
.controls-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(420px, 92vw);
  background: var(--card);
  border-left: 1px solid #1f2a50;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.4);
  transform: translateX(100%);
  transition: transform 0.25s ease;
  overflow: auto;
  padding: 16px;
  color: var(--ink);
}
.controls-close {
  position: sticky;
  top: 0;
  float: right;
  margin: -6px -6px 8px 8px;
  background: transparent;
  color: var(--ink);
  border: 1px solid #28366d;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 20px;
}
.controls-drawer.open { pointer-events: auto; }
.controls-drawer.open::before { opacity: 1; }
.controls-drawer.open .controls-panel { transform: translateX(0); }

/* Valve modal */
.valve-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.valve-modal-overlay.open { display: flex; opacity: 1; }

.valve-modal-container {
  position: relative;
  width: min(600px, 90vw);
  height: min(600px, 90vh);
  background: #0b1330;
  border-radius: 16px;
  border: 2px solid #1fd4d6;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  transform: scale(0.9);
  transition: transform 0.3s ease;
}
.valve-modal-overlay.open .valve-modal-container { transform: scale(1); }

.valve-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  background: rgba(255, 107, 107, 0.9);
  border: 2px solid #ff8787;
  border-radius: 50%;
  color: white;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.valve-modal-close:hover {
  background: rgba(255, 107, 107, 1);
  transform: scale(1.1);
}

.valve-modal-title {
  padding: 16px 24px;
  background: rgba(31, 212, 214, 0.1);
  border-bottom: 1px solid #1fd4d6;
  color: #e9f0ff;
  font-size: 18px;
  font-weight: 600;
}

.valve-modal-content {
  width: 100%;
  height: calc(100% - 60px);
  overflow: hidden;
}

/* Pump/valve interaction */
.pump, .valve {
  cursor: pointer;
  outline: none;
}
.pump:focus-visible, .valve:focus-visible {
  outline: 2px solid rgba(31, 212, 214, 0.6);
  outline-offset: 4px;
}
.pump image, .valve image {
  pointer-events: all;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}
.pump:hover image {
  transform: scale(1.08);
  filter: brightness(1.2) drop-shadow(0 0 8px rgba(31, 212, 214, 0.4));
}
.valve:hover image {
  transform: scale(1.12);
  filter: brightness(1.25) drop-shadow(0 0 10px rgba(31, 212, 214, 0.5));
}

/* Tank level */
.levelRect {
  transition: height 120ms linear, y 120ms linear;
}
  </style>
</head>
<body>

<button id="controlsToggle" class="controls-toggle">Controls</button>

<div class="app">
  <div class="card stage">
    <svg viewBox="${viewBox}" id="mainSVG">
      <title>${simName}</title>
      
      <defs>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7cc8ff"></stop>
          <stop offset="100%" stop-color="#2d8bd6"></stop>
        </linearGradient>
      </defs>
      
      <!-- Connections -->
      <g id="connections">
${connectionsSVG}
      </g>
      
      <!-- Components -->
      <g id="components">
${componentsSVG}
      </g>
    </svg>
  </div>

  <!-- Controls Drawer -->
  <aside id="controlsDrawer" class="controls-drawer" aria-hidden="true">
    <div class="controls-panel card">
      <button id="controlsClose" class="controls-close">×</button>
      <h1>${simName}</h1>
      <div class="sub">Interactive Process Simulator</div>
      <div style="margin-top:16px;">
        <button id="pauseBtn" class="btn">Pause</button>
        <button id="resetBtn" class="btn" style="margin-left:8px;">Reset</button>
      </div>
      <hr style="border-color:#22305f;opacity:0.5;margin:14px 0;">
      <h1>System Status</h1>
      <div class="kv" id="systemStatus">
        <div>Components</div><div id="compCount">${this.designer.components.size}</div>
        <div>Connections</div><div id="connCount">${this.designer.connections.length}</div>
      </div>
    </div>
  </aside>
</div>

<!-- Embedded Design Config -->
<script id="system-config" type="application/json">
${configJSON}
</script>

<!-- Embedded Engine Code -->
<script>
/* ============================================================================
   EMBEDDED SIMULATOR ENGINE
   Version: ${ENGINE_VERSION}
   Exporter: ${EXPORTER_VERSION}
   Exported: ${new Date().toISOString()}
   Source: ${GITHUB_BASE_URL}
   Components: ${this.designer.components.size}
   Connections: ${this.designer.connections.length}
   ============================================================================ */

${engineCode}

/* ============================================================================
   ENGINE INITIALIZATION
   ============================================================================ */

// Parse embedded config
const designData = JSON.parse(document.getElementById('system-config').textContent);
console.log('📋 Loaded design:', designData.metadata.name);
console.log('  Components:', designData.components.length);
console.log('  Connections:', designData.connections.length);

// TODO: Convert design data to SYSTEM_CONFIG format
// TODO: Initialize ComponentManager with SYSTEM_CONFIG
// TODO: Start simulation

console.log('⚠️ Simulation initialization pending');
console.log('✅ Engine loaded successfully');

</script>

<!-- Embedded Valve Control HTML -->
<script id="valve-control-template" type="text/html">
${valveContent}
</script>

<!-- UI Controls -->
<script>
// Controls drawer
(function(){
  const drawer = document.getElementById('controlsDrawer');
  const toggle = document.getElementById('controlsToggle');
  const closeBtn = document.getElementById('controlsClose');
  
  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
  }
  
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  }
  
  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });
  
  // Pause/Reset buttons
  document.getElementById('pauseBtn')?.addEventListener('click', () => {
    console.log('Pause clicked');
    // TODO: Connect to ComponentManager
  });
  
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    console.log('Reset clicked');
    // TODO: Connect to ComponentManager
  });
})();
</script>

</body>
</html>`;
  }

  /**
   * Extract valve content (remove html/body tags, keep styles and content)
   */
  _extractValveContent(valveHTML) {
    const styleMatch = valveHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch = valveHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    
    const styles = styleMatch ? styleMatch[1] : '';
    const bodyContent = bodyMatch ? bodyMatch[1] : valveHTML;
    
    return `<style>${styles}</style>\n${bodyContent}`;
  }

  /**
   * Validate design
   */
  _validateDesign() {
    const errors = [];
    
    if (this.designer.components.size === 0) {
      errors.push('No components in design');
    }
    
    const connectedIds = new Set();
    for (const conn of this.designer.connections) {
      connectedIds.add(conn.from);
      connectedIds.add(conn.to);
    }
    
    const disconnected = [];
    for (const [id, comp] of this.designer.components) {
      if (!connectedIds.has(id) && this.designer.connections.length > 0) {
        disconnected.push(comp.name);
      }
    }
    
    if (disconnected.length > 0) {
      errors.push(`Disconnected components: ${disconnected.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate all components SVG
   */
  _generateAllComponentsSVG() {
    let svg = '';
    
    for (const [id, comp] of this.designer.components) {
      svg += '        ' + this._generateComponentSVG(comp) + '\n';
    }
    
    return svg;
  }

  /**
   * Generate single component SVG
   */
  _generateComponentSVG(comp) {
    const cleanId = this._sanitizeId(comp.id);
    const template = window.COMPONENT_LIBRARY?.[comp.key] || {};
    const image = template.image;
    const imageSize = template.imageSize || { w: 76, h: 76, x: -38, y: -38 };
    
    if (comp.type === 'tank') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'valve') {
      return `<g id="${cleanId}" class="valve" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type.includes('pump') || comp.type.includes('Pump')) {
      return `<g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-70" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'feed') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#3b82f620" stroke="#3b82f6" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '💧'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'drain') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#6366f120" stroke="#6366f1" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '🚰'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="20" fill="${template.color || '#4f46e5'}20" stroke="${template.color || '#4f46e5'}" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="18">${template.icon || '?'}</text>
          <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
  }

  /**
   * Generate all connections SVG
   */
  _generateAllConnectionsSVG() {
    let svg = '';
    
    this.designer.connections.forEach((conn, idx) => {
      const fromComp = this.designer.components.get(conn.from);
      const toComp = this.designer.components.get(conn.to);
      
      if (!fromComp || !toComp) return;
      
      const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
      const pipeId = `pipe${idx + 1}`;
      
      svg += `        <g id="${pipeId}">
          <path d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20" stroke-linecap="round"></path>
          <path id="${pipeId}Flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8" stroke-linecap="round" class="flow"></path>
        </g>\n`;
    });
    
    return svg;
  }

  /**
   * Generate design JSON
   */
  _generateDesignJSON(simName) {
    const config = {
      metadata: {
        version: EXPORTER_VERSION,
        created: new Date(this.designer.metadata?.created || this.exportTimestamp).toISOString(),
        modified: new Date().toISOString(),
        name: simName,
        exported: new Date().toISOString(),
        source: GITHUB_BASE_URL
      },
      components: [],
      connections: [],
      nextId: this.designer.nextId,
      nextConnectionId: this.designer.nextConnectionId,
      gridSize: this.designer.gridSize,
      viewBox: { width: 1000, height: 600 }
    };
    
    for (const [id, comp] of this.designer.components) {
      config.components.push({
        id: comp.id,
        key: comp.key,
        type: comp.type,
        name: comp.name,
        x: comp.x,
        y: comp.y,
        config: comp.config || {}
      });
    }
    
    for (const conn of this.designer.connections) {
      config.connections.push({
        id: conn.id,
        from: conn.from,
        to: conn.to,
        fromPoint: conn.fromPoint || 'outlet',
        toPoint: conn.toPoint || 'inlet'
      });
    }
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * Sanitize name for filename
   */
  _sanitizeName(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Sanitize ID for JavaScript
   */
  _sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Download file
   */
  _downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export
window.SimulatorExporter = SimulatorExporter;
console.log('✅ Exporter v3.1 loaded (GitHub Only)');
console.log('🌐 Base URL:', GITHUB_BASE_URL);
