# Testing Checklist - Designer v2.0

**Complete verification of all new features**

---

## 🎯 Testing Overview

Test systematically through these categories:
1. ✅ Basic Functionality
2. ✅ Validation System
3. ✅ Import/Export
4. ✅ Preview Mode
5. ✅ Error Handling
6. ✅ Version Compatibility
7. ✅ Export Quality

**Time Required:** ~30 minutes for complete testing

---

## 1️⃣ Basic Functionality Tests

### UI Loading
- [ ] Open `designer/designer.html`
- [ ] Page loads without errors
- [ ] Console shows: "✅ Component library loaded"
- [ ] Console shows: "✅ Designer v2.0.0 ready!"
- [ ] No red errors in console

### Component Library
- [ ] All categories visible (Boundaries, Containers, etc.)
- [ ] Can collapse/expand categories
- [ ] Search box works - filters components
- [ ] Components have images (not just emoji)
- [ ] Can drag component onto canvas

### Canvas Interaction
- [ ] Grid visible by default
- [ ] Can toggle grid on/off
- [ ] Can toggle snap on/off
- [ ] Can drag component to move it
- [ ] Snap works when enabled
- [ ] Mouse position updates in toolbar

### Connection Tool
- [ ] Click "Connect" tool - cursor changes to crosshair
- [ ] Click component A - see dashed line
- [ ] Move mouse - line follows cursor
- [ ] Click component B - permanent line appears
- [ ] Line has arrowhead pointing to B
- [ ] Can't connect to self (should alert)
- [ ] Can't give feed an input (should alert)
- [ ] Can't give drain an output (should alert)

### Properties Panel
- [ ] Select component - properties appear
- [ ] Name field editable - updates label
- [ ] Number fields editable - updates config
- [ ] Input connections listed (if any)
- [ ] Output connections listed (if any)
- [ ] Delete button present

### Component Deletion
- [ ] Click component - select it
- [ ] Click delete button - confirm dialog
- [ ] Confirm - component removed
- [ ] Connections also removed
- [ ] Stats update (component count)

### Connection Deletion
- [ ] Click connection line - confirm dialog
- [ ] Confirm - line removed
- [ ] Input/output lists update
- [ ] Stats update (connection count)

**✅ Basic Functionality: PASS / FAIL**

---

## 2️⃣ Validation System Tests

### UI Health Check (On Load)
- [ ] Console shows UI validation message
- [ ] If elements missing - warning appears
- [ ] Designer still works with warnings

### Component Property Validation

**Test: Negative Capacity**
- [ ] Add pump to canvas
- [ ] Set capacity to -5
- [ ] Click "Export Sim"
- [ ] Validation shows error for negative capacity
- [ ] Cannot proceed to export

**Test: Invalid Efficiency**
- [ ] Add pump to canvas
- [ ] Set efficiency to 5 (should be 0-1)
- [ ] Click "Export Sim"
- [ ] Validation shows error
- [ ] Cannot proceed

**Test: Valid Properties**
- [ ] Add pump with valid values
- [ ] Click "Export Sim"
- [ ] No property errors appear

### Disconnected Component Detection

**Test: Feed with No Output**
- [ ] Add feed component only
- [ ] Click "Export Sim"
- [ ] Warning: "disconnected component"
- [ ] Can proceed with confirmation

**Test: Drain with No Input**
- [ ] Clear canvas
- [ ] Add drain component only
- [ ] Click "Export Sim"
- [ ] Warning appears
- [ ] Can proceed with confirmation

**Test: Isolated Pump**
- [ ] Add pump with no connections
- [ ] Click "Export Sim"
- [ ] Warning for disconnected pump

### Network Topology Validation

**Test: No Feed**
- [ ] Add tank + pump + drain
- [ ] Connect them (no feed)
- [ ] Click "Export Sim"
- [ ] Warning: "No feed component"

**Test: No Drain**
- [ ] Add feed + pump + tank
- [ ] Connect them (no drain)
- [ ] Click "Export Sim"
- [ ] Warning: "No drain component"

**Test: Circular Dependency**
- [ ] Add 3 tanks: A → B → C → A
- [ ] Click "Export Sim"
- [ ] Warning: "Possible circular dependencies"

### Validation Report Modal

**Test: Error Display**
- [ ] Create design with errors
- [ ] Click "Export Sim"
- [ ] Modal appears with red error box
- [ ] Errors listed clearly
- [ ] No "Proceed to Export" button

**Test: Warning Display**
- [ ] Create design with only warnings
- [ ] Click "Export Sim"
- [ ] Modal appears with yellow warning box
- [ ] Warnings listed
- [ ] "Proceed to Export" button present

**Test: Success Display**
- [ ] Create valid design
- [ ] Click "Export Sim"
- [ ] Modal appears with green success box
- [ ] "✅ No critical issues found"
- [ ] Can proceed to export

**✅ Validation System: PASS / FAIL**

---

## 3️⃣ Import/Export Tests

### Save Design

**Test: Save Empty Design**
- [ ] Clear canvas
- [ ] Click "💾 Save Design"
- [ ] File downloads: `Untitled-Design.json`
- [ ] Can open in text editor - valid JSON

**Test: Save Design with Components**
- [ ] Add 3 components + 2 connections
- [ ] Click "💾 Save Design"
- [ ] File downloads with sim name
- [ ] JSON contains components array
- [ ] JSON contains connections array
- [ ] JSON contains metadata

### Import Design

**Test: Import Saved Design**
- [ ] Save design as above
- [ ] Click "🗑️ Clear" - confirm
- [ ] Canvas empty
- [ ] Click "📥 Import"
- [ ] Select saved JSON file
- [ ] Components restored correctly
- [ ] Connections restored correctly
- [ ] Properties preserved

**Test: Import Invalid JSON**
- [ ] Create invalid JSON file
- [ ] Click "📥 Import"
- [ ] Select invalid file
- [ ] Error alert appears
- [ ] Designer still functional

### Export to Simulator

**Test: Export Complete Design**
- [ ] Create design: Feed → Tank → Pump → Valve → Drain
- [ ] Click "📤 Export Sim"
- [ ] Validation passes
- [ ] Enter name: "Test Simulator"
- [ ] Click "Export"
- [ ] 4 files download:
  - [ ] index.html
  - [ ] systemConfig.js
  - [ ] README.md
  - [ ] SETUP.txt

**Test: Exported Files Content**

Check **systemConfig.js**:
- [ ] Contains `_metadata` object
- [ ] Has export timestamp
- [ ] Has version numbers
- [ ] Has component count
- [ ] Components properly grouped

Check **index.html**:
- [ ] Has simulator name in title
- [ ] SVG viewBox matches designer canvas
- [ ] All components present
- [ ] All connections present
- [ ] Script paths use `../../engine/`

Check **README.md**:
- [ ] Lists all components
- [ ] Shows warnings (if any)
- [ ] Has setup instructions
- [ ] Has troubleshooting section

Check **SETUP.txt**:
- [ ] ASCII folder structure diagram
- [ ] Step-by-step setup
- [ ] Troubleshooting guide
- [ ] Quick test checklist

**✅ Import/Export: PASS / FAIL**

---

## 4️⃣ Preview Mode Tests

### Opening Preview

**Test: Preview Button**
- [ ] Add components to canvas
- [ ] Click "👁️ Preview"
- [ ] Modal appears
- [ ] Shows component count
- [ ] Shows connection count
- [ ] Shows validation status

**Test: Preview with Errors**
- [ ] Create design with errors
- [ ] Click "👁️ Preview"
- [ ] Status shows "❌ Has Issues"

**Test: Preview with Warnings**
- [ ] Create design with warnings
- [ ] Click "👁️ Preview"
- [ ] Status shows "✅ Valid" (warnings don't fail)

### Preview Actions

**Test: Validate from Preview**
- [ ] Open preview
- [ ] Click "Run Validation"
- [ ] Preview closes
- [ ] Validation report opens
- [ ] Shows issues/warnings

**Test: Export from Preview**
- [ ] Open preview
- [ ] Click "Export This Design"
- [ ] Preview closes
- [ ] Validation report shows
- [ ] Can proceed to export

**Test: Close Preview**
- [ ] Open preview
- [ ] Click "×" button
- [ ] Preview closes
- [ ] Designer still functional

**✅ Preview Mode: PASS / FAIL**

---

## 5️⃣ Error Handling Tests

### Missing UI Elements

**Test: Missing Export Modal**
- [ ] Temporarily rename `#exportModal` in HTML
- [ ] Click "📤 Export Sim"
- [ ] Console warning appears
- [ ] Prompt appears for sim name
- [ ] Export still works

**Test: Missing Button IDs**
- [ ] Check console on load
- [ ] No errors for missing buttons
- [ ] Available buttons work normally

### Invalid User Input

**Test: Empty Sim Name**
- [ ] Click "📤 Export Sim"
- [ ] Leave name blank
- [ ] Click Export
- [ ] Should handle gracefully

**Test: Special Characters in Name**
- [ ] Enter name: "My Sim <> Test"
- [ ] Export
- [ ] Filename sanitized: `my-sim-test`

### Network Issues

**Test: Missing Component Library**
- [ ] Temporarily break component-library.js path
- [ ] Reload designer
- [ ] Error message appears
- [ ] Designer doesn't crash

**Test: Missing Exporter**
- [ ] Don't load exporter.js initially
- [ ] Click "📤 Export Sim"
- [ ] Console shows "Loading exporter.js..."
- [ ] Auto-loads and continues

**✅ Error Handling: PASS / FAIL**

---

## 6️⃣ Version Compatibility Tests

### Version Display

**Test: Version Constants**
- [ ] Open console
- [ ] Type: `DESIGNER_VERSION`
- [ ] Shows: `"2.0.0"`
- [ ] Type: `ENGINE_VERSION`
- [ ] Shows: `"1.0.0"`
- [ ] Type: `EXPORTER_VERSION`
- [ ] Shows: `"2.0.0"`

### Export Metadata

**Test: Metadata in Config**
- [ ] Export a design
- [ ] Open systemConfig.js
- [ ] Find `_metadata` object
- [ ] Verify fields present:
  - [ ] name
  - [ ] version
  - [ ] exportVersion
  - [ ] designerVersion
  - [ ] exported (timestamp)
  - [ ] componentCount
  - [ ] connectionCount

### Compatibility Checking

**Test: Version Check Script**
- [ ] Create `engine/core/version.js`
- [ ] Load in simulator HTML
- [ ] Console shows: "✅ Engine v1.0.0 loaded"
- [ ] Console shows: "✅ Version compatibility: OK"

**Test: Version Mismatch** (Manual)
- [ ] Edit config `_metadata.version` to "2.0.0"
- [ ] Load simulator
- [ ] Console warns about version mismatch
- [ ] Still loads (doesn't crash)

**✅ Version Compatibility: PASS / FAIL**

---

## 7️⃣ Export Quality Tests

### Path Validation

**Test: Path Warnings**
- [ ] Export design
- [ ] Check validation warnings
- [ ] Should mention: "Ensure valve.html exists"
- [ ] Should mention: "Ensure engine/ folder exists"

### Setup Instructions

**Test: SETUP.txt Quality**
- [ ] Open exported SETUP.txt
- [ ] Folder structure diagram present
- [ ] Step-by-step instructions clear
- [ ] Troubleshooting section complete
- [ ] Quick test checklist present

**Test: README.md Quality**
- [ ] Open exported README.md
- [ ] Component list correct
- [ ] Warnings documented
- [ ] Setup instructions clear
- [ ] Technical details present

### Simulator Functionality

**Test: Run Exported Simulator**
- [ ] Create: `sims/test-sim/` folder
- [ ] Copy 4 files there
- [ ] Verify `engine/` at `../../engine/`
- [ ] Verify `valve.html` at `../../valve.html`
- [ ] Open `index.html` in browser
- [ ] Console shows: "✅ System initialized"
- [ ] Console shows: "✅ Simulation started"
- [ ] No errors in console

**Test: Simulator Controls**
- [ ] Click "Controls" button - drawer opens
- [ ] Click pump - modal opens
- [ ] Can start/stop pump
- [ ] Click valve - modal with wheel opens
- [ ] Can turn valve wheel
- [ ] Valve position updates

**✅ Export Quality: PASS / FAIL**

---

## 📊 Test Results Summary

Fill out after completing all tests:

```
=== DESIGNER v2.0 TEST RESULTS ===

Date: _______________
Tester: _______________
Browser: _______________

1. Basic Functionality:     ☐ PASS  ☐ FAIL
2. Validation System:       ☐ PASS  ☐ FAIL
3. Import/Export:           ☐ PASS  ☐ FAIL
4. Preview Mode:            ☐ PASS  ☐ FAIL
5. Error Handling:          ☐ PASS  ☐ FAIL
6. Version Compatibility:   ☐ PASS  ☐ FAIL
7. Export Quality:          ☐ PASS  ☐ FAIL

OVERALL: ☐ READY FOR PRODUCTION  ☐ NEEDS FIXES

Critical Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

Minor Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

Notes:
_______________________________________
_______________________________________
_______________________________________
```

---

## 🐛 Bug Report Template

If you find issues, document them:

```markdown
**Bug Title:** [Brief description]

**Severity:** Critical / Major / Minor

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Console Output:**
```
[Paste console errors]
```

**Environment:**
- Browser: [Chrome 119 / Firefox 120 / etc.]
- OS: [Windows 11 / macOS 14 / etc.]
- Designer Version: 2.0.0

**Screenshots:**
[Attach if relevant]
```

---

## ✅ Sign-Off

**Tested By:** _______________  
**Date:** _______________  
**Version:** 2.0.0  
**Status:** ☐ APPROVED  ☐ REJECTED

**Approver Comments:**
```
[Your comments here]
```

---

## 🎓 Testing Tips

1. **Test in order** - Basic → Advanced
2. **Use fresh browser** - Clear cache first
3. **Check console always** - F12 your friend
4. **Document issues** - Use bug template
5. **Test edge cases** - Empty, invalid, extreme values
6. **Compare with v1** - Ensure no regressions
7. **Test multiple browsers** - Chrome, Firefox, Edge
8. **Take screenshots** - Helps debugging

---

**Ready to test? Start with section 1️⃣ and work through systematically!**

Good luck! 🚀
