/**

- exporter.js v3.2 - GitHub Only Exporter
- 
- Fetches ALL engine files from GitHub at export time
- Creates 100% standalone HTML files with SVG symbols
- 
- ✅ FIXED: Updated to fetch from ROOT directory structure
- GitHub Pages: https://sco314.github.io/tank-sim/
  */

const EXPORTER_VERSION = ‘3.2.0’;
const ENGINE_VERSION = ‘1.0.0’;

// ✅ UPDATED: GitHub base URL - now points to ROOT, not /101125/
const GITHUB_BASE_URL = ‘https://sco314.github.io/tank-sim/’;

// ✅ UPDATED: All engine files to fetch from ROOT structure
const ENGINE_FILES = [
// Core
‘js/core/Component.js’,
‘js/core/FlowNetwork.js’,
‘js/core/ComponentManager.js’,

// Config (✅ ADDED - was missing before)
‘js/config/systemConfig.js’,

// Boundary components
‘js/components/sources/Feed.js’,
‘js/components/sinks/Drain.js’,

// Tanks
‘js/components/tanks/Tank.js’,

// Pumps
‘js/components/pumps/Pump.js’,
‘js/components/pumps/FixedSpeedPump.js’,
‘js/components/pumps/VariableSpeedPump.js’,
‘js/components/pumps/ThreeSpeedPump.js’,

// Valves
‘js/components/valves/Valve.js’,

// Pipes
‘js/components/pipes/Pipe.js’,

// Sensors
‘js/components/sensors/PressureSensor.js’,

// Managers
‘js/managers/TankManager.js’,
‘js/managers/PumpManager.js’,
‘js/managers/ValveManager.js’,
‘js/managers/PipeManager.js’,
‘js/managers/PressureManager.js’
];

// Valve HTML file (at root)
const VALVE_HTML_FILE = ‘valve.html’;

// CSS file (✅ ADDED)
const CSS_FILE = ‘css/designer-style.css’;

class SimulatorExporter {
constructor(designer) {
this.designer = designer;
this.exportTimestamp = Date.now();
}

/**

- Main export method
  */
  async exportSimulator(defaultName = ‘My Simulator’) {
  // Step 1: Prompt for name
  const simName = prompt(‘Enter simulator name:’, defaultName) || defaultName;

```
if (!simName || simName.trim() === '') {
  alert('Export cancelled - no name provided');
  return;
}

console.log(`📦 Exporting simulator: ${simName}`);
console.log(`🌐 Fetching from: ${GITHUB_BASE_URL}`);

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
  // Step 4: Fetch CSS
  progressUI.update('⏳ Fetching CSS from GitHub...', 5);
  const css = await this._fetchCSS();
  
  // Step 5: Fetch all engine files from GitHub
  progressUI.update('⏳ Fetching engine files from GitHub...', 10);
  const engineCode = await this._fetchAllEngineFiles(progressUI);
  
  // Step 6: Fetch valve.html
  progressUI.update('⏳ Fetching valve control...', 80);
  const valveHTML = await this._fetchValveHTML();
  
  // Step 7: Generate complete standalone HTML with SVG symbols
  progressUI.update('⏳ Generating HTML...', 90);
  const cleanName = this._sanitizeName(simName);
  const html = this._generateStandaloneHTML(simName, cleanName, css, engineCode, valveHTML);
  
  // Step 8: Download
  progressUI.update('⏳ Downloading file...', 95);
  this._downloadFile(`${cleanName}.html`, html);
  
  // Step 9: Success!
  progressUI.close();
  
  const fileSize = (html.length / 1024).toFixed(1);
  console.log(`✅ Export complete! File size: ${fileSize} KB`);
  alert(`✅ Export complete!\n\nFile: ${cleanName}.html\nSize: ${fileSize} KB\n\n✔ 100% standalone\n✔ Works anywhere\n✔ Latest engine code from GitHub\n✔ SVG symbols (optimized)`);
  
} catch (error) {
  progressUI.close();
  console.error('❌ Export failed:', error);
  
  // Show detailed error message
  this._showDetailedError(error);
}
```

}

/**

- Create progress UI overlay
  */
  _createProgressUI() {
  const overlay = document.createElement(‘div’);
  overlay.style.cssText = ‘position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#172144;color:#e9f0ff;padding:30px 50px;border-radius:12px;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,0.5);min-width:400px;’;

```
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
```

}

/**

- Fetch CSS from GitHub
  */
  async _fetchCSS() {
  console.log(‘📂 Fetching CSS from GitHub…’);

```
const url = GITHUB_BASE_URL + CSS_FILE;

try {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const css = await response.text();
  console.log(`  ✔ ${CSS_FILE} (${(css.length / 1024).toFixed(1)} KB)`);
  
  return css;
  
} catch (error) {
  console.warn('  ⚠ Failed to fetch CSS, using fallback');
  // Return minimal fallback CSS if fetch fails
  return `
    body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
    #canvas { width: 100%; height: 100%; background: #0e1734; }
  `;
}
```

}

/**

- Fetch all engine files from GitHub
  */
  async _fetchAllEngineFiles(progressUI) {
  console.log(`📂 Fetching ${ENGINE_FILES.length} engine files from GitHub...`);
  console.log(`🌐 Base URL: ${GITHUB_BASE_URL}`);

```
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
```

// ============================================================================
// ${filename}
// Path: ${path}
// Source: ${url}
// ============================================================================
${code}`);

```
    fetchedCount++;
    const percent = 10 + Math.floor((fetchedCount / ENGINE_FILES.length) * 65); // 10-75%
    progressUI.update('⏳ Fetching engine files from GitHub...', percent);
    progressUI.setDetail(`✔ ${filename} (${fetchedCount}/${ENGINE_FILES.length})`);
    
    console.log(`  ✔ ${filename}`);
    
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
```

}

/**

- Fetch valve.html from GitHub
  */
  async _fetchValveHTML() {
  console.log(‘📂 Fetching valve.html from GitHub…’);

```
const url = GITHUB_BASE_URL + VALVE_HTML_FILE;

try {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  console.log(`  ✔ valve.html (${(html.length / 1024).toFixed(1)} KB)`);
  
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
```

}

/**

- Show detailed error with failed files
  */
  _showDetailedError(error) {
  let errorDetails;

```
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
```

Failed Files (${errorDetails.failCount}/${errorDetails.totalFiles}):

${failedList}

Possible Causes:
• No internet connection
• GitHub Pages is down
• Files have been moved/deleted
• CORS/network firewall blocking requests

What To Do:

1. Check your internet connection
1. Verify GitHub Pages is accessible:
   ${GITHUB_BASE_URL}
1. Try again in a few moments
1. Check browser console for details

If problem persists, contact support.`;

```
alert(message);

// Also log to console for debugging
console.error('📋 Detailed Error Report:');
console.error('Failed files:', errorDetails.failedFiles);
console.error(`Success: ${errorDetails.successCount}/${errorDetails.totalFiles}`);
```

}

/**

- Generate complete standalone HTML with SVG symbols
  */
  _generateStandaloneHTML(simName, cleanName, css, engineCode, valveHTML) {
  const svg = document.getElementById(‘canvas’);
  const viewBox = svg ? svg.getAttribute(‘viewBox’) : ‘0 0 1000 600’;

```
// Extract all SVG symbols from the designer
const svgSymbols = this._extractSVGSymbols();

// Generate component instances as <use> elements
const componentElements = this._generateAllComponentsSVG();

// Generate connections
const connectionElements = this._generateAllConnectionsSVG();

// Generate design JSON
const designJSON = this._generateDesignJSON(simName);

// Prepare valve HTML for iframe
const valveIframeContent = this._prepareValveForIframe(valveHTML);

// Build complete HTML
const html = `<!DOCTYPE html>
```

<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${simName}</title>
  <meta name="generator" content="Tank Simulator Exporter v${EXPORTER_VERSION}">
  <meta name="export-date" content="${new Date().toISOString()}">
  <meta name="source" content="${GITHUB_BASE_URL}">
  <style>
    /* ========== Embedded CSS ========== */
    ${css}

```
/* ========== Additional Simulator Styles ========== */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #0e1734;
  font-family: system-ui, -apple-system, sans-serif;
}

#simulator-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

#canvas {
  flex: 1;
  width: 100%;
  height: 100%;
}

.flow {
  animation: flow 2s linear infinite;
  stroke-dasharray: 20 10;
}

@keyframes flow {
  to { stroke-dashoffset: -30; }
}

/* Hide valve iframe initially */
#valveFrame {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 300px;
  border: 2px solid #7cc8ff;
  border-radius: 8px;
  background: white;
  z-index: 1000;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}
```

  </style>
</head>
<body>
  <div id="simulator-container">
    <svg id="canvas" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      <!-- ========== SVG Symbol Definitions ========== -->
      <defs>
${svgSymbols}
      </defs>

```
  <!-- ========== Background Grid ========== -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#22305f" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" opacity="0.4"/>
  
  <!-- ========== Connections Layer ========== -->
  <g id="connectionsLayer">
```

${connectionElements}
</g>

```
  <!-- ========== Components Layer ========== -->
  <g id="componentsLayer">
```

${componentElements}
</g>
</svg>

```
<!-- Valve Control iframe -->
<iframe id="valveFrame" title="Valve Control"></iframe>
```

  </div>

  <!-- ========== Embedded Design JSON ========== -->

  <script id="design-data" type="application/json">
${designJSON}
  </script>

  <!-- ========== Embedded Engine Code ========== -->

  <script>
// ============================================================================
// Tank Simulator Engine v${ENGINE_VERSION}
// Exported: ${new Date().toISOString()}
// Source: ${GITHUB_BASE_URL}
// ============================================================================

${engineCode}

// ============================================================================
// Simulator Initialization
// ============================================================================

// Load design configuration
const designData = JSON.parse(document.getElementById('design-data').textContent);
console.log('🎯 Loaded design:', designData.metadata);

// Initialize components from design
function initializeSimulator() {
  console.log('🚀 Initializing simulator...');
  
  // Set up valve iframe content
  const valveFrame = document.getElementById('valveFrame');
  const valveHTML = \`${valveIframeContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
  valveFrame.srcdoc = valveHTML;
  
  // Initialize component managers
  // (Engine code handles this automatically)
  
  console.log('✅ Simulator ready!');
  console.log('Components:', designData.components.length);
  console.log('Connections:', designData.connections.length);
}

// Start when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSimulator);
} else {
  initializeSimulator();
}
  </script>

</body>
</html>`;

```
return html;
```

}

/**

- Extract SVG symbols from component library
  */
  _extractSVGSymbols() {
  const symbols = [];

```
for (const [id, comp] of this.designer.components) {
  const componentDef = this.designer.componentLibrary?.components?.[comp.type];
  
  if (componentDef && componentDef.symbol) {
    const symbolId = `symbol-${comp.type}`;
    
    // Only add each symbol once
    if (!symbols.find(s => s.includes(`id="${symbolId}"`))) {
      symbols.push(`        <symbol id="${symbolId}" viewBox="0 0 60 60">
      ${componentDef.symbol}
    </symbol>`);
    }
  }
}

return symbols.join('\n');
```

}

/**

- Generate all components as SVG <use> elements
  */
  _generateAllComponentsSVG() {
  let svg = ‘’;

```
for (const [id, comp] of this.designer.components) {
  const symbolId = `symbol-${comp.type}`;
  const compId = this._sanitizeId(comp.id);
  
  svg += `        <g id="${compId}" data-type="${comp.type}">
      <use href="#${symbolId}" x="${comp.x - 30}" y="${comp.y - 30}" width="60" height="60"/>
      <text x="${comp.x}" y="${comp.y - 35}" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
    </g>\n`;
}

return svg;
```

}

/**

- Generate all connections SVG
  */
  _generateAllConnectionsSVG() {
  let svg = ‘’;

```
this.designer.connections.forEach((conn, idx) => {
  const fromComp = this.designer.components.get(conn.from);
  const toComp = this.designer.components.get(conn.to);
  
  if (!fromComp || !toComp) return;
  
  const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
  const pipeId = `pipe${idx + 1}`;
  
  svg += `        <g id="${pipeId}">
      <path d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20" stroke-linecap="round"/>
      <path id="${pipeId}Flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8" stroke-linecap="round" class="flow"/>
    </g>\n`;
});

return svg;
```

}

/**

- Generate design JSON
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

```
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
```

}

/**

- Prepare valve HTML for iframe embedding
  */
  _prepareValveForIframe(valveHTML) {
  // Extract just the essential parts
  const bodyMatch = valveHTML.match(/<body[^>]*>([\s\S]*?)</body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : valveHTML;

```
const styleMatch = valveHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const style = styleMatch ? styleMatch[1] : '';

const scriptMatch = valveHTML.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
const script = scriptMatch ? scriptMatch[1] : '';

return `<!DOCTYPE html>
```

<html>
<head>
<meta charset="utf-8">
<title>Valve Control</title>
<style>${style}</style>
</head>
<body>
${bodyContent}
<script>${script}</script>
</body>
</html>`;
  }

/**

- Validate design before export
  */
  _validateDesign() {
  const errors = [];
  const warnings = [];

```
// Check for components
if (this.designer.components.size === 0) {
  errors.push('No components in design');
}

// Check for at least one tank
const hasTank = Array.from(this.designer.components.values())
  .some(c => c.type === 'tank');

if (!hasTank) {
  warnings.push('No tanks in design');
}

// Check for sources and sinks
const hasSource = Array.from(this.designer.components.values())
  .some(c => c.type === 'feed');
const hasSink = Array.from(this.designer.components.values())
  .some(c => c.type === 'drain');

if (!hasSource) {
  warnings.push('No feed source in design');
}
if (!hasSink) {
  warnings.push('No drain sink in design');
}

return {
  valid: errors.length === 0,
  errors: errors,
  warnings: warnings
};
```

}

/**

- Sanitize name for filename
  */
  _sanitizeName(name) {
  return name.toLowerCase()
  .replace(/[^a-z0-9]+/g, ‘-’)
  .replace(/^-+|-+$/g, ‘’);
  }

/**

- Sanitize ID for JavaScript
  */
  *sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9*]/g, ‘_’);
  }

/**

- Download file
  */
  _downloadFile(filename, content) {
  const blob = new Blob([content], { type: ‘text/html;charset=utf-8’ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement(‘a’);
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
console.log(‘✅ Exporter v3.2 loaded (ROOT structure)’);
console.log(‘🌐 Base URL:’, GITHUB_BASE_URL);