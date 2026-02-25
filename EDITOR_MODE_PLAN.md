# Editor Mode Implementation Plan

## Overview

Transform the music visualizer into a dual-mode application with a toggleable **Editor Mode** for creating and manipulating scenes. Editor Mode provides object spawning, file loading, and transform controls while preserving the existing audio-reactive visualization capabilities.

## Mode System

### View Mode (Existing)
- Audio-reactive visualizations (particles, points, skinning)
- Sliders and audio controls active
- Automatic scene switching between visualization types

### Edit Mode (New)
- Object spawning and manipulation
- File import (GLB models)
- Transform gizmos for selected objects
- Scene hierarchy management
- No audio reactivity (sliders hidden)

### Mode Toggle
- **Keyboard Shortcut**: `Tab` key toggles between modes
- **Visual Indicator**: Large overlay text showing current mode
  - View Mode: Blue text "VIEW MODE"
  - Edit Mode: Orange text "EDIT MODE"
  - Fades after 2 seconds
- **State Preservation**: Mode switch preserves scene state

---

## Core Architecture

### State Management

```javascript
// Editor State Structure
editorState: {
  // Mode
  mode: 'view' | 'edit',
  
  // Selection System
  selectedObjects: [],        // Array of selected object IDs
  primarySelection: null,     // Last clicked object (gizmo attaches here)
  selectionCenter: Vector3,   // Calculated center of multi-selection
  
  // Transform Controls
  transformMode: 'translate' | 'rotate' | 'scale',
  transformSpace: 'world' | 'local',
  
  // Snapping
  snapEnabled: false,         // Off by default
  snapIncrement: 1.0,         // Grid units
  
  // Scene Objects
  spawnedObjects: Map,        // id -> { mesh, type, parent, children }
  
  // Hierarchy
  objectHierarchy: {},        // Parent-child relationships
  
  // Tools
  activeTool: 'select' | 'spawn' | 'import',
  
  // History for Undo/Redo
  history: [],
  historyIndex: -1
}
```

### Mode Switching Flow

1. **Tab Key Detection**: Global keyboard listener catches Tab
2. **Mode Transition**:
   - View → Edit: Hide audio UI, show editor UI, enable TransformControls
   - Edit → View: Hide editor UI, show audio UI, disable TransformControls
3. **State Sync**: Save editor state, restore view state
4. **UI Update**: Fade between mode indicator overlays

---

## Transform Controls & Gizmos

### Gizmo Implementation

**Single Gizmo for Multi-Selection**
- One TransformControls instance per scene
- Attaches to calculated center of selected objects
- All selected objects move/rotate/scale together relative to center
- Gizmo remains at selection center during manipulation

### Transform Modes

**Keyboard Shortcuts**:
- `T` - Translate mode (move objects)
- `R` - Rotate mode (rotate objects)
- `S` - Scale mode (resize objects)

**GUI Buttons**:
- Three prominent buttons in editor toolbar
- Active mode highlighted with color
- Shows current mode with icon + text

### Coordinate Spaces

**World Space**: Gizmo aligns with world axes (default)
**Local Space**: Gizmo aligns with selected object's rotation
- Toggle button in UI
- Affects all selected objects uniformly

### Visual Feedback

- **Gizmo Color Coding**:
  - Red: X-axis
  - Green: Y-axis
  - Blue: Z-axis
  - White/Yellow: Center/Planes
- **Mode Indicator**: Text label near gizmo showing current mode
- **Axis Highlight**: Highlighted when hovering over specific axis

---

## Snapping System

### Configuration

**Default State**: Disabled (off)
**Toggle**: Checkbox in editor UI labeled "Snap to Grid"

### Snap Behavior

**When Enabled**:
- Translate: Snaps to grid increments (default 1.0 units)
- Rotate: Snaps to 15-degree increments
- Scale: Snaps to 0.1 increments

**Visual Grid**:
- Infinite grid helper visible in Edit Mode
- Grid size adjustable in settings
- Subdivision lines for finer precision

### Snapping Controls

**UI Elements**:
- Toggle checkbox: "Enable Snapping"
- Slider: "Grid Size" (0.1 to 10.0)
- Visual indicator when snapping is active

---

## Selection System

### Single Selection

**Click Selection**:
- Left-click on object to select
- Click empty space to deselect all
- Selected object highlighted with outline or glow

### Multiple Selection

**Shift+Click**:
- Hold Shift and click to add/remove from selection
- Toggle individual objects in/out of selection

**Selection Box (Optional)**:
- Click and drag to create selection rectangle
- Selects all objects within bounds
- Shift+drag adds to existing selection

### Selection Center Calculation

```javascript
// Calculate geometric center of all selected objects
function calculateSelectionCenter(objects) {
  const center = new THREE.Vector3();
  objects.forEach(obj => {
    center.add(obj.position);
  });
  center.divideScalar(objects.length);
  return center;
}
```

### Selection Feedback

- **Outline**: Selected objects have colored outline (orange)
- **Highlight**: Slight emissive glow on selected objects
- **Wireframe**: Optional wireframe overlay on selection

---

## Object Hierarchy & Parenting

### Hierarchy Structure

**Scene Graph**:
```
Scene (root)
├── Group_Lights
├── Group_Background
├── Group_SpawnedObjects
│   ├── Object_A (parent)
│   │   ├── Object_B (child)
│   │   └── Object_C (child)
│   └── Object_D
└── Group_ImportedGLBs
    └── Michelle_Model
        ├── Skeleton
        └── Animations
```

### Parenting Behavior

**Parent-Child Relationships**:
- Child objects move/rotate/scale with parent
- Child local transforms preserved relative to parent
- Unparenting restores world transform

**UI Representation**:
- Tree view showing hierarchy
- Indentation indicates parent-child depth
- Expandable/collapsible branches

### Parenting Operations

**Create Parent**:
- Select multiple objects
- Click "Group" button
- Creates empty parent object containing selection

**Reparent**:
- Drag object in hierarchy tree onto new parent
- Or select child, then "Set Parent" and click target parent

**Unparent**:
- Right-click child → "Remove from Parent"
- Child becomes sibling of former parent

---

## Object Spawning

### Primitive Spawning

**Available Primitives**:
- **Box**: 1x1x1 unit cube
- **Sphere**: 0.5 radius (1 unit diameter)
- **Cylinder**: 1 height, 0.5 radius
- **Plane**: 1x1 unit, Y-up

**Spawn Location**:
- At selection center (if objects selected)
- At world origin (0,0,0) if nothing selected
- Slightly offset to avoid Z-fighting with existing objects

**Default Material**:
- Standard material, medium gray (#888888)
- Cast and receive shadows enabled

### Spawn UI

**Toolbar Buttons**:
- Icon + label for each primitive type
- Click spawns object at current location
- Object automatically selected after spawn

---

## File Import (GLB Loading)

### Import Method

**Drag and Drop**:
- Drag GLB files from file system into canvas
- Visual feedback on drag (highlighted drop zone)
- Auto-import on drop

**File Picker**:
- "Import GLB" button opens system file dialog
- Support for .glb and .gltf files

### Import Behavior

**At Drop Location**:
- Raycast to find drop position on virtual ground plane
- Spawn model at that location
- Auto-select imported model

**Animation Handling**:
- Extract animation clips from GLB
- Store with spawned object
- Optional: Animation mixer creation

### Import UI

**Progress Indicator**:
- Loading spinner while parsing
- Error message if import fails
- Success confirmation with object name

---

## Editor UI Components

### 1. Mode Indicator Overlay

**Display**:
- Large centered text when mode switches
- "VIEW MODE" in blue
- "EDIT MODE" in orange
- Fades out after 2 seconds
- Semi-transparent background

### 2. Transform Toolbar

**Layout**: Horizontal bar at top or side
**Buttons**:
- [T] Translate - Move selected objects
- [R] Rotate - Rotate selected objects
- [S] Scale - Scale selected objects
- Active button highlighted
- Shows keyboard shortcut in brackets

**Additional Controls**:
- World/Local toggle
- Snap toggle + size slider

### 3. Object Hierarchy Panel

**Layout**: Collapsible sidebar (left or right)
**Features**:
- Tree view of all scene objects
- Expand/collapse branches
- Checkboxes for multi-selection
- Click to select single object
- Shift+click to toggle multi-selection
- Drag to reparent
- Right-click context menu (delete, duplicate, rename)

**Hierarchy Features**:
- Object type icons (box, sphere, GLB, etc.)
- Object names (editable)
- Visibility toggle (eye icon)
- Lock toggle (prevents selection)

### 4. Inspector Panel

**Layout**: Sidebar, shows when object(s) selected
**Sections**:

**Transform**:
- Position: X, Y, Z input fields
- Rotation: X, Y, Z input fields (degrees)
- Scale: X, Y, Z input fields
- "Reset" buttons for each

**Object Info**:
- Name: Text input
- Type: Display only (Box, Sphere, GLB, etc.)
- Parent: Dropdown selector

**Material** (simplified):
- Color picker
- Roughness slider
- Metalness slider
- Wireframe toggle

### 5. Spawn Toolbar

**Layout**: Horizontal or vertical button group
**Buttons**:
- Box (cube icon)
- Sphere (sphere icon)
- Cylinder (cylinder icon)
- Plane (plane icon)
- Import GLB (folder icon)

### 6. Scene Tools

**Grid Toggle**: Show/hide grid helper
**Grid Size**: Adjust grid subdivision
**Snap Settings**: Enable/disable, set increment

---

## Keyboard Shortcuts Reference

### Global Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Toggle between View/Edit Mode |
| `Escape` | Deselect all objects |
| `Delete` / `Backspace` | Delete selected objects |

### Edit Mode Shortcuts

| Key | Action |
|-----|--------|
| `T` | Switch to Translate mode |
| `R` | Switch to Rotate mode |
| `S` | Switch to Scale mode |
| `G` | Toggle grid visibility |
| `Shift + Click` | Add/remove from multi-selection |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + D` | Duplicate selected objects |
| `Ctrl + G` | Group selected objects |

### View Mode Shortcuts

| Key | Action |
|-----|--------|
| `H` | Toggle UI visibility (fade) |
| Number keys | Switch scenes (if implemented) |

---

## Visual Design

### Color Scheme

**View Mode**:
- Primary: Blue tones (#667eea)
- Background: Dark (#14171a)
- Accent: Green for active audio

**Edit Mode**:
- Primary: Orange tones (#ff9000)
- Selection: Orange outline (#ff6b00)
- Gizmo: Standard Three.js colors (red/green/blue)
- Grid: Subtle gray (#444444 major, #222222 minor)

### UI Styling

- Consistent with existing visualizer UI
- Semi-transparent dark panels
- Rounded corners on buttons
- Hover states with subtle glow
- Active states with color fill

### Gizmo Appearance

- **Translate**: Arrows + planes
- **Rotate**: Circular arcs
- **Scale**: Boxes on axes
- **Size**: Proportional to selection bounds
- **Opacity**: Slight transparency for non-active axes

---

## Implementation Phases

### Phase 1: Core Mode System (Week 1)

**Tasks**:
1. Create `src/editor/mode.js` - Mode state and toggle logic
2. Modify `main.js` - Add mode switching with Tab key
3. Create mode indicator overlay - Fade in/out text
4. Modify scene update loop - Skip audio updates in Edit Mode

**Deliverable**: Working mode toggle with visual feedback

### Phase 2: Transform Controls (Week 1-2)

**Tasks**:
1. Create `src/editor/transform.js` - TransformControls wrapper
2. Add gizmo initialization to scene setup
3. Implement T/R/S keyboard shortcuts
4. Add transform toolbar UI
5. Handle gizmo mode switching

**Deliverable**: Gizmo appears in Edit Mode, keyboard shortcuts work

### Phase 3: Selection System (Week 2)

**Tasks**:
1. Create `src/editor/selection.js` - Raycasting and selection logic
2. Implement click selection
3. Implement Shift+click multi-selection
4. Add selection highlighting (outline/glow)
5. Calculate selection center for gizmo

**Deliverable**: Can select single and multiple objects

### Phase 4: Object Spawning (Week 2-3)

**Tasks**:
1. Create `src/editor/spawning.js` - Primitive creation
2. Add spawn toolbar with primitive buttons
3. Implement spawn at selection center
4. Auto-select spawned objects

**Deliverable**: Can spawn primitives, they appear in scene

### Phase 5: File Import (Week 3)

**Tasks**:
1. Extend `src/core/loader.js` - Generic GLB loading
2. Create `src/gui/editor-dropzone.js` - Drag-and-drop UI
3. Implement file picker button
4. Handle drop position via raycasting
5. Extract and store animations

**Deliverable**: Can import GLB files via drag-and-drop

### Phase 6: Hierarchy & Parenting (Week 3-4)

**Tasks**:
1. Create `src/editor/hierarchy.js` - Scene graph management
2. Build hierarchy tree view UI
3. Implement reparenting via drag-and-drop
4. Implement grouping (Ctrl+G)
5. Store parent-child relationships

**Deliverable**: Hierarchy panel shows object tree, parenting works

### Phase 7: Inspector Panel (Week 4)

**Tasks**:
1. Create `src/gui/editor-inspector.js`
2. Show transform values (position/rotation/scale)
3. Make values editable
4. Add material controls
5. Sync gizmo changes to inspector

**Deliverable**: Inspector updates with selection, edits affect objects

### Phase 8: Snapping & Polish (Week 4)

**Tasks**:
1. Implement grid helper toggle
2. Add snapping toggle and controls
3. Implement snap behavior in TransformControls
4. Add undo/redo system
5. Final UI polish and consistency

**Deliverable**: Complete editor with all features

---

## File Structure

```
src/
├── editor/
│   ├── mode.js           # Mode switching logic
│   ├── state.js          # Editor state management
│   ├── transform.js      # TransformControls wrapper
│   ├── selection.js      # Object selection system
│   ├── spawning.js       # Primitive spawning
│   ├── hierarchy.js      # Parent-child relationships
│   ├── snapping.js       # Grid snapping logic
│   └── history.js        # Undo/redo system
├── gui/
│   ├── editor-toolbar.js # Transform tools UI
│   ├── editor-hierarchy.js # Scene tree UI
│   ├── editor-inspector.js # Object properties UI
│   └── editor-dropzone.js # File drag-and-drop UI
├── core/
│   └── loader.js         # Extended with generic GLB loading
└── scenes/
    └── editor.js         # (Optional) Dedicated editor scene
```

---

## Dependencies

### New Three.js Addons

```javascript
// Transform controls
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Selection box (optional, for drag selection)
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';

// Grid helper (built into Three.js)
import { GridHelper } from 'three';
```

---

## Testing Checklist

### Mode Switching
- [ ] Tab key switches between View/Edit modes
- [ ] Visual indicator appears and fades correctly
- [ ] Audio UI hides in Edit Mode
- [ ] Editor UI hides in View Mode
- [ ] Scene state preserved across switches

### Transform Controls
- [ ] Gizmo appears in Edit Mode
- [ ] T/R/S keys switch transform modes
- [ ] Gizmo updates visually for each mode
- [ ] Clicking UI buttons switches modes
- [ ] Gizmo attaches to selection center
- [ ] World/Local space toggle works

### Selection
- [ ] Click selects single object
- [ ] Shift+click adds to selection
- [ ] Click empty space deselects all
- [ ] Multiple objects show selection highlights
- [ ] Selection center calculated correctly

### Spawning
- [ ] Spawn buttons create objects
- [ ] Objects spawn at appropriate location
- [ ] Spawned objects are automatically selected
- [ ] Objects appear in hierarchy

### File Import
- [ ] Drag GLB onto canvas imports file
- [ ] File picker imports file
- [ ] Imported model is positioned correctly
- [ ] Model appears in hierarchy
- [ ] Animations extracted (if present)

### Hierarchy
- [ ] Hierarchy panel shows all objects
- [ ] Tree expands/collapses
- [ ] Checkboxes toggle selection
- [ ] Drag to reparent works
- [ ] Grouping (Ctrl+G) creates parent

### Snapping
- [ ] Grid toggle shows/hides grid
- [ ] Snap toggle enables/disables snapping
- [ ] Snap increment adjustable
- [ ] Snapping works in all transform modes

### Inspector
- [ ] Panel shows when object selected
- [ ] Transform values editable
- [ ] Changes update object in real-time
- [ ] Changes update gizmo position
- [ ] Material controls work

---

## Notes

### Performance Considerations

- Use object pooling for spawned primitives
- Limit undo history to prevent memory bloat
- Only raycast when necessary (not every frame)
- Use GPU picking for large object counts (optional optimization)

### Accessibility

- All editor functions keyboard-accessible
- Tooltips on hover for all buttons
- Clear visual feedback for all actions
- High contrast for selection highlights

### Future Enhancements

- Save/Load editor scenes to JSON
- Export scenes as GLB
- Material editor with node graph
- Animation timeline editor
- Lighting editor with real-time shadows
- Particle system editor

---

## Limits & Best Practices

### Performance Limits

**WebGPU Context Considerations**:
The project uses WebGPU with compute shaders, which requires careful resource management:

**Object Count Limits**:
- **Recommended Maximum**: 100 spawned objects
- **Hard Limit**: 500 spawned objects (enforced)
- **Rationale**: Each object requires draw calls and GPU resources. WebGPU compute shaders are efficient but the browser still has limits on active render objects.
- **UI Indicator**: Show current count: "Objects: 47/100" with warning color at 80%
- **On Limit Reached**: Display error message "Maximum object count reached. Delete objects to spawn more."

**GLB Import Limits**:
- **Max File Size**: 50MB per GLB
- **Max Vertices per Model**: 100,000
- **Max Animations per Model**: 20
- **Validation**: Check on import, reject files exceeding limits
- **Memory Management**: Unload unused textures and meshes

**Hierarchy Depth Limits**:
- **Maximum Nesting**: 5 levels deep
- **Prevents**: Deep recursion issues in scene graph traversal
- **Error**: "Cannot nest objects deeper than 5 levels"

### Memory Management Best Practices

**Automatic Cleanup**:
- Dispose geometries when objects are deleted
- Free GPU memory for removed objects
- Clear textures of deleted imported models
- Remove orphaned animation mixers

**Memory Warnings**:
- Monitor GPU memory usage
- Warn when approaching 80% of available VRAM
- Suggest cleanup actions

**Recommended Workflow**:
1. Spawn objects in groups
2. Position roughly
3. Group/parent related objects
4. Delete temporary objects immediately
5. Save scene state before major changes

### Performance Optimization Guidelines

**For Complex Scenes**:
- Use simplified geometry for distant objects
- Enable LOD (Level of Detail) for imported GLBs
- Batch similar materials
- Limit real-time shadows to 3 lights max

**In View Mode**:
- Hide editor helpers (grid, axes, gizmos)
- Disable selection raycasting
- Pause editor update loops
- Maintain audio reactivity focus

**Object Spacing**:
- Keep objects within 1000 units of origin
- Use world space for large scenes
- Group related objects under parent transforms

### WebGPU-Specific Considerations

**Compute Shader Limits**:
- Points scene uses compute shaders for animation
- Spawned objects use standard rendering
- Don't spawn objects that duplicate compute shader functionality
- Limit simultaneous compute operations

**Browser Compatibility**:
- WebGPU support varies by browser
- Provide fallback or warning for unsupported browsers
- Test on target hardware (check GPU memory)

**Context Loss Handling**:
- Save scene state before GPU-intensive operations
- Handle context loss gracefully
- Auto-restore after context recovery

### Scene Organization Best Practices

**Naming Conventions**:
- Use descriptive names: "Floor_Plane", "Character_Michelle", "Light_Key"
- Avoid generic names: "Object_1", "Mesh_2"
- Prefix grouped objects: "Group_Background", "Group_Lighting"

**Layer Organization**:
- Group by function: Lights, Cameras, Background, Foreground
- Separate static and dynamic objects
- Keep reference objects in "Helpers" group

**Version Control** (if saving implemented):
- Save iterations frequently
- Name saves descriptively: "Scene_V1_Exploration", "Scene_V2_Final"
- Export important versions as GLB

### Usage Recommendations

**For Live Streaming**:
- Pre-build complex scenes
- Limit spawned objects to 20-30
- Test performance at target resolution
- Have fallback simple scenes ready

**For Audio-Reactive Scenes**:
- Balance visual density with audio clarity
- Don't obscure beat-reactive elements
- Position spawned objects to frame, not block, main visualizers

**Mobile/Performance Mode**:
- Optional: Reduce spawn limit to 50 on lower-end GPUs
- Disable advanced features (shadows, post-processing)
- Use simplified materials

### Error Handling & Recovery

**Common Issues**:
1. **GLB Import Fails**: Check file format, size, vertex count
2. **Gizmo Disappears**: Re-select objects, check if object locked
3. **Performance Drops**: Check object count, simplify materials
4. **Mode Switch Lag**: Large scenes may pause briefly during switch

**Recovery Procedures**:
- Undo available for all operations (Ctrl+Z)
- Auto-save editor state every 30 seconds
- "Reset View" button if camera lost
- Emergency "Clear All Spawned" option

### Development Guidelines

**Adding New Spawnable Types**:
1. Define geometry and material defaults
2. Add to spawn limits calculation
3. Include in hierarchy tree
4. Add inspector panel support
5. Test with max object count

**Extending Editor**:
- Keep UI panels modular
- Lazy-load heavy features
- Maintain separation between View and Edit modes
- Profile performance changes

---

## Conclusion

This Editor Mode transforms the music visualizer into a complete scene creation tool while maintaining the existing audio-reactive visualization capabilities. The dual-mode system allows seamless switching between creating content (Edit Mode) and experiencing it (View Mode).

The modular architecture allows incremental implementation, starting with basic transform controls and expanding to full scene editing capabilities.
