/**
 * DRAG & DROP FIX for designer.js
 * 
 * INSTRUCTIONS:
 * 1. Find _setupEventListeners() in your designer.js
 * 2. Add the two canvas event listeners shown below
 * 3. Add the _onCanvasDrop() method to your ProcessDesigner class
 * 4. Verify _onPaletteDragStart() exists (shown below)
 */

// ============================================================================
// STEP 1: Add to _setupEventListeners() method (after line with canvas.addEventListener)
// ============================================================================

_setupEventListeners() {
  // ADD THESE TWO LINES anywhere in this method:
  this.canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  
  this.canvas.addEventListener('drop', (e) => this._onCanvasDrop(e));
  
  // ... rest of your existing event listeners ...
}


// ============================================================================
// STEP 2: Add this NEW method to your ProcessDesigner class
// ============================================================================

_onCanvasDrop(e) {
  e.preventDefault();
  
  // Get the dragged item data
  const dataStr = e.dataTransfer.getData('text/plain');
  if (!dataStr) {
    console.warn('No data in drop event');
    return;
  }
  
  let item;
  try {
    item = JSON.parse(dataStr);
  } catch (err) {
    console.error('Failed to parse dropped data:', err);
    return;
  }
  
  // Convert mouse position to SVG coordinates
  const rect = this.canvas.getBoundingClientRect();
  const viewBox = this.canvas.viewBox.baseVal;
  const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
  const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;
  
  // Apply grid snapping if enabled
  const snapToggle = document.getElementById('snapToggle');
  const snapToGrid = snapToggle ? snapToggle.checked : false;
  
  const finalX = snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x;
  const finalY = snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y;
  
  // Add the component at the drop position
  this._addFromPalette(item, { x: finalX, y: finalY });
  
  console.log(`✅ Dropped ${item.label} at (${finalX}, ${finalY})`);
}


// ============================================================================
// STEP 3: VERIFY this method exists (it should already be in your file)
// ============================================================================

_onPaletteDragStart(e, item) {
  e.dataTransfer.setData('text/plain', JSON.stringify(item));
  e.dataTransfer.effectAllowed = 'copy';
  console.log('Started dragging:', item.label);
}


// ============================================================================
// STEP 4: Your existing _addFromPalette should work, but here's a reference:
// ============================================================================

_addFromPalette(item, pos) {
  const id = `comp${this.nextId++}`;
  
  // Get default config from component library
  const lib = this.componentLibrary?.components || {};
  const def = lib[item.key] || lib[item.type] || {};
  const defaultConfig = def.defaultConfig || {};
  
  const comp = {
    id,
    key: item.key || item.type,
    type: item.type,
    name: item.label || item.type,
    x: pos.x,
    y: pos.y,
    config: { ...defaultConfig }
  };
  
  this.components.set(id, comp);
  this._renderComponent(comp);
  this._updateStats();
  
  console.log(`✅ Added ${comp.name} at (${pos.x}, ${pos.y})`);
}


// ============================================================================
// ALTERNATIVE: If you prefer, replace your ENTIRE _setupEventListeners 
// with this version that includes all necessary handlers:
// ============================================================================

_setupEventListeners() {
  // Canvas drag & drop support (CRITICAL for component placement)
  this.canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  
  this.canvas.addEventListener('drop', (e) => this._onCanvasDrop(e));
  
  // Canvas interactions
  this.canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
  this.canvas.addEventListener('mousemove', (e) => this._handleCanvasMouseMove(e));

  // Toolbar buttons
  document.getElementById('selectTool')?.addEventListener('click', () => this._setTool('select'));
  document.getElementById('connectTool')?.addEventListener('click', () => this._setTool('connect'));

  // Primary export button
  document.getElementById('exportBtn')?.addEventListener('click', (e) => this._onExportClicked(e));
  document.getElementById('exportBtn2')?.addEventListener('click', (e) => this._onExportClicked(e));

  // Export modal wiring
  const exportModal = document.getElementById('exportModal');
  const exportModalClose = document.getElementById('exportModalClose');
  const exportConfirmBtn = document.getElementById('exportConfirmBtn');
  const exportCancelBtn = document.getElementById('exportCancelBtn');

  const closeExportModal = () => exportModal?.classList.remove('open');

  exportConfirmBtn?.addEventListener('click', () => {
    const simNameInput = document.getElementById('simName');
    const name = (simNameInput?.value?.trim()) || this.getSimulatorName();
    if (name) {
      this._ensureExporter(() => {
        try {
          const exporter = new SimulatorExporter(this);
          exporter.exportSimulator(name);
        } catch (err) {
          console.error('Export failed:', err);
          alert('Export failed: ' + err.message);
        }
      });
    }
    closeExportModal();
  });
  
  exportModalClose?.addEventListener('click', closeExportModal);
  exportCancelBtn?.addEventListener('click', closeExportModal);
  exportModal?.addEventListener('click', (e) => {
    if (e.target === exportModal) closeExportModal();
  });

  // Single-file export
  document.getElementById('exportSingleFile')?.addEventListener('click', () => {
    const name = this.getSimulatorName();
    this._ensureExporter(() => {
      try {
        const exporter = new SimulatorExporter(this);
        exporter.exportSimulator(name);
      } catch (err) {
        console.error('Single-file export failed:', err);
        alert('Export failed: ' + err.message);
      }
    });
  });

  // ZIP export
  document.getElementById('exportZip')?.addEventListener('click', () => {
    const name = this.getSimulatorName();
    this._ensureExporter(() => {
      try {
        const exporter = new SimulatorExporter(this);
        if (typeof exporter.exportAsZip === 'function') {
          exporter.exportAsZip(name);
        } else {
          alert('ZIP export requires exporter.js support. Please update exporter.js.');
        }
      } catch (err) {
        console.error('ZIP export failed:', err);
        alert('Export failed: ' + err.message);
      }
    });
  });

  // Dragging end on window mouseup (cleanup)
  window.addEventListener('mouseup', () => { this._dragState = null; });

  console.log('✅ Event listeners set up');
}
