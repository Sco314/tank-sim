# Integration Guide - Designer v2.0 Setup

**Last Updated:** October 14, 2025  
**Version:** 2.0.0

---

## 📁 Complete File Structure

Here's the final structure you need:

```
project-root/
├── designer/                        ← Designer app
│   ├── designer.html               ← NEW VERSION (with new buttons)
│   ├── designer-style.css          ← NEW VERSION (with modal styles)
│   ├── designer.js                 ← NEW VERSION (v2.0 with validation)
│   ├── exporter.js                 ← NEW VERSION (v2.0 with validation)
│   └── component-library.js        ← UNCHANGED
│
├── engine/                          ← Simulator engine
│   ├── core/
│   │   ├── version.js              ← NEW FILE (version checking)
│   │   ├── Component.js            ← UNCHANGED
│   │   ├── FlowNetwork.js          ← UNCHANGED
│   │   └── ComponentManager.js     ← UNCHANGED
│   ├── components/
│   │   ├── pumps/                  ← UNCHANGED
│   │   ├── valves/                 ← UNCHANGED
│   │   ├── tanks/                  ← UNCHANGED
│   │   ├── pipes/                  ← UNCHANGED
│   │   ├── sources/                ← UNCHANGED
│   │   └── sinks/                  ← UNCHANGED
│   ├── managers/
│   │   ├── PumpManager.js          ← UNCHANGED
│   │   ├── ValveManager.js         ← UNCHANGED
│   │   ├── TankManager.js          ← UNCHANGED
│   │   ├── PipeManager.js          ← UNCHANGED
│   │   └── PressureManager.js      ← UNCHANGED
│   └── style.css                   ← UNCHANGED
│
├── sims/                            ← Exported simulators go here
│   └── (your exports)/
│
├── valve.html                       ← UNCHANGED
└── README.md                        ← Update with new features
```

---

## 🔄 Migration Steps

### Step 1: Backup Current Files

```bash
# Create backup
mkdir backup-$(date +%Y%m%d)
cp -r designer/ backup-$(date +%Y%m%d)/
cp -r engine/ backup-$(date +%Y%m%d)/
```

### Step 2: Update Designer Files

Replace these 4 files in `designer/`:

1. **designer.html** - New version with Preview, Import, Save buttons
2. **designer-style.css** - New version with modal styles
3. **designer.js** - v2.0 with validation features
4. **exporter.js** - v2.0 with path checking

Keep these files unchanged:
- component-library.js ✅

### Step 3: Add Engine Version File

Create new file: `engine/core/version.js`

Add to **ALL** simulator HTML files (including existing ones):
```html
<script src="../../engine/core/version.js" defer></script>
```

This should be the FIRST engine script loaded.

### Step 4: Update Existing Simulator Files (Optional)

For simulators already exported, you can optionally update their `index.html` to include version checking:

```html
<!-- Add this BEFORE other engine scripts -->
<script src="../../engine/core/version.js" defer></script>
```

---

## ✅ Verification Checklist

After integration, verify everything works:

### Designer Checks
- [ ] Open `designer/designer.html` in browser
- [ ] All buttons visible: Select, Connect, Preview, Import, Save, Export
- [ ] Component library loads (check console for errors)
- [ ] Can drag components onto canvas
- [ ] Can connect components
- [ ] Properties panel shows when component selected

### Validation Checks
- [ ] Create design with disconnected component
- [ ] Click "Export Sim" - should show validation report
- [ ] Validation shows warnings for disconnected component
- [ ] Can proceed to export after reviewing warnings

### Import/Export Checks
- [ ] Click "Save Design" - downloads .json file
- [ ] Click "Import" - can select and load the .json
- [ ] Design restores correctly with all components and connections
- [ ] Click "Export Sim" - downloads 4 files (index.html, systemConfig.js, README.md, SETUP.txt)

### Preview Checks
- [ ] Click "Preview" - modal appears
- [ ] Shows component count, connection count, status
- [ ] Can click "Run Validation" from preview
- [ ] Can click "Export" from preview

### Version Checks
- [ ] Open browser console
- [ ] Should see: "✅ Engine v1.0.0 loaded"
- [ ] Should see: "✅ Designer v2.0.0 ready!"
- [ ] No version mismatch warnings

---

## 🐛 Troubleshooting

### Problem: "Designer UI missing elements" warning

**Cause:** HTML file doesn't have all expected button IDs

**Fix:** Verify your `designer.html` has these IDs:
- `#exportBtn` (or `#exportSimBtn` or `#exportSim`)
- `#previewBtn`
- `#importBtn`
- `#saveDesignBtn`
- `#selectTool`
- `#connectTool`

### Problem: Modal styles not working

**Cause:** CSS file not updated or not loaded

**Fix:**
1. Verify `designer-style.css` is the new version
2. Check browser console for 404 errors
3. Clear browser cache (Ctrl+F5)

### Problem: Export validation not running

**Cause:** Exporter.js not loaded or old version

**Fix:**
1. Verify `exporter.js` is v2.0 (check for `EXPORTER_VERSION` constant)
2. Check console for "Loading exporter.js..." message
3. Verify file path in HTML is correct

### Problem: Import button does nothing

**Cause:** Browser blocking file input

**Fix:**
1. Check browser console for errors
2. Try different browser (Chrome/Firefox recommended)
3. Verify JavaScript is enabled

### Problem: "Version mismatch" warning

**Cause:** Config from old designer exported with old exporter

**Fix:**
1. This is just a warning - simulator should still work
2. Re-export design with new exporter to update metadata
3. Or ignore warning if simulator works fine

---

## 🔍 Testing Script

Run this in browser console after loading designer:

```javascript
// Test all new features
console.log('=== DESIGNER v2.0 TEST ===');

// 1. Check versions
console.log('Designer Version:', typeof DESIGNER_VERSION !== 'undefined' ? DESIGNER_VERSION : '❌ Not Found');
console.log('Engine Version:', typeof ENGINE_VERSION !== 'undefined' ? ENGINE_VERSION : '❌ Not Found');

// 2. Check methods exist
const requiredMethods = [
  '_validateUI',
  '_validateDesign', 
  '_showValidationReport',
  '_showPreview',
  'importConfig',
  'exportDesignJSON'
];

requiredMethods.forEach(method => {
  const exists = typeof designer[method] === 'function';
  console.log(`${exists ? '✅' : '❌'} ${method}:`, exists ? 'OK' : 'MISSING');
});

// 3. Test validation
try {
  const uiValid = designer._validateUI();
  console.log('✅ UI Validation:', uiValid ? 'PASSED' : 'FAILED');
  
  const designValid = designer._validateDesign();
  console.log('✅ Design Validation:', designValid.valid ? 'PASSED' : 'HAS ISSUES');
  console.log('   - Issues:', designValid.issues.length);
  console.log('   - Warnings:', designValid.warnings.length);
} catch (e) {
  console.error('❌ Validation Error:', e.message);
}

// 4. Test export
try {
  const json = designer.exportDesignJSON();
  const data = JSON.parse(json);
  console.log('✅ Export JSON:', 'OK');
  console.log('   - Components:', data.components.length);
  console.log('   - Connections:', data.connections.length);
  console.log('   - Metadata:', data.metadata ? 'Present' : 'Missing');
} catch (e) {
  console.error('❌ Export Error:', e.message);
}

// 5. Check exporter
if (typeof SimulatorExporter !== 'undefined') {
  console.log('✅ SimulatorExporter:', 'LOADED');
  console.log('   - Version:', typeof EXPORTER_VERSION !== 'undefined' ? EXPORTER_VERSION : 'Unknown');
} else {
  console.error('❌ SimulatorExporter:', 'NOT LOADED');
}

console.log('=== TEST COMPLETE ===');
```

Expected output:
```
=== DESIGNER v2.0 TEST ===
Designer Version: 2.0.0
Engine Version: 1.0.0
✅ _validateUI: OK
✅ _validateDesign: OK
✅ _showValidationReport: OK
✅ _showPreview: OK
✅ importConfig: OK
✅ exportDesignJSON: OK
✅ UI Validation: PASSED
✅ Design Validation: PASSED (or HAS ISSUES if components on canvas)
   - Issues: 0
   - Warnings: X
✅ Export JSON: OK
   - Components: X
   - Connections: X
   - Metadata: Present
✅ SimulatorExporter: LOADED
   - Version: 2.0.0
=== TEST COMPLETE ===
```

---

## 📝 What's New - Feature Summary

### For Designers (People using the designer)

1. **Validation Before Export** ⚠️
   - Automatically checks for common mistakes
   - Warns about disconnected components
   - Blocks export if critical errors found
   - Shows detailed report with suggestions

2. **Import/Export Designs** 💾
   - Save your design as JSON
   - Load designs back into designer
   - Share designs with team
   - Keep backups of your work

3. **Preview Mode** 👁️
   - See design before exporting
   - Check component/connection counts
   - Quick validation from preview
   - Export directly from preview

4. **Better Error Messages** 🔍
   - Clear warnings when UI elements missing
   - Detailed setup instructions in exports
   - Version mismatch detection
   - Helpful troubleshooting guides

### For Developers (People modifying the code)

1. **Modular Validation System**
   - `_validateUI()` - UI health check
   - `_validateDesign()` - Design validation
   - `_validateComponentProperties()` - Property checking
   - `_findDisconnectedComponents()` - Topology analysis
   - `_detectCircularDependencies()` - Cycle detection

2. **Version Tracking**
   - `DESIGNER_VERSION` constant
   - `EXPORTER_VERSION` constant
   - `ENGINE_VERSION` constant
   - Metadata in all exports
   - Compatibility checking

3. **Better File Structure**
   - Separate concerns (designer/exporter)
   - Clear file organization
   - Version checking system
   - Enhanced documentation

---

## 🚀 Next Steps

### Immediate (Do Now)
1. ✅ Replace 4 designer files
2. ✅ Add engine/core/version.js
3. ✅ Test with checklist above
4. ✅ Create test design and export
5. ✅ Verify exported simulator works

### Short-term (This Week)
1. 📦 Implement ZIP export (using JSZip library)
2. 🖼️ Bundle images as base64 (remove GitHub dependency)
3. 📚 Update main README with new features
4. 🧪 Create automated tests
5. 📹 Record demo video

### Long-term (This Month)
1. 🔄 Add undo/redo functionality
2. 📋 Component templates system
3. 🎨 Custom component builder
4. 🌐 Multi-user collaboration
5. 📊 Analytics dashboard

---

## 💡 Tips for Success

### For Best Results:

1. **Always validate before export**
   - Catch mistakes early
   - Better user experience
   - Fewer support questions

2. **Save designs frequently**
   - Use "Save Design" button
   - Keep JSON backups
   - Version control your designs

3. **Check version compatibility**
   - Watch for warnings
   - Update engine when needed
   - Keep designer and exporter in sync

4. **Test exported simulators**
   - Open in browser after export
   - Check all components work
   - Verify connections flow correctly

5. **Read setup instructions**
   - SETUP.txt has crucial info
   - Folder structure matters
   - Follow troubleshooting guide

---

## 📞 Support

If you encounter issues:

1. **Check Console** (F12)
   - Look for error messages
   - Note any failed file loads
   - Check for version mismatches

2. **Run Test Script**
   - Copy test script above
   - Paste in console
   - Share output if asking for help

3. **Verify File Structure**
   - Use tree command to check layout
   - Ensure all files in correct locations
   - Check file permissions

4. **Clear Cache**
   - Ctrl+F5 (Windows/Linux)
   - Cmd+Shift+R (Mac)
   - Sometimes fixes weird issues

---

## ✨ What You Get

With v2.0, you now have:

✅ **Professional-grade designer**
- Validation system catches mistakes
- Import/export for workflows
- Preview before committing

✅ **Production-ready exports**
- Detailed setup instructions
- Version compatibility checking
- Comprehensive troubleshooting

✅ **Developer-friendly code**
- Modular architecture
- Clear separation of concerns
- Well-documented methods

✅ **Future-proof system**
- Version tracking
- Compatibility checking
- Easy to extend

---

**You're ready to go! 🎉**

Start by replacing the 4 files, then run the verification checklist.

Questions? Check the troubleshooting section first!
