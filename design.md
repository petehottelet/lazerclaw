# LazerClaw — Design Tool: Complete Feature Specification

> This document describes the LazerClaw design application — a free, browser-based, Fabric.js-powered canvas editor built with React 18, Vite, and Tailwind CSS. It is written so that the entire application can be rebuilt from scratch with a single prompt.
>
> **Note:** The Templates system (section 13) has been removed from this distribution. All template-related components, utilities, and API endpoints have been removed. References to templates in this document are historical.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Authentication](#4-authentication)
5. [Application Layout](#5-application-layout)
6. [Canvas Engine](#6-canvas-engine)
7. [Tools](#7-tools)
8. [Object Types & Properties](#8-object-types--properties)
9. [Panels & Sidebars](#9-panels--sidebars)
10. [Toolbar Features](#10-toolbar-features)
11. [Color Picker](#11-color-picker)
12. [Layers Panel](#12-layers-panel)
13. [Templates System](#13-templates-system)
14. [Tiling System](#14-tiling-system)
15. [Masking System](#15-masking-system)
16. [Motion & Video](#16-motion--video)
17. [Audio & Timeline](#17-audio--timeline)
18. [Printer Marks & Print Production](#18-printer-marks--print-production)
19. [Export System](#19-export-system)
20. [AI Design Assistant (Zee)](#20-ai-design-assistant-zee)
21. [Dark Mode](#21-dark-mode)
22. [Keyboard Shortcuts](#22-keyboard-shortcuts)
23. [Canvas Size & Units](#23-canvas-size--units)
24. [S3 Asset Infrastructure](#24-s3-asset-infrastructure)
25. [Data Schemas](#25-data-schemas)

---

## 1. Architecture Overview

The app is a single-page React application with no router. It uses a centralized state hook (`useCanvasState`) that exposes the entire canvas state, undo/redo system, tool settings, and audio management. This state object is passed as `canvasState` to every component.

**Component Hierarchy:**
```
App
├── Toolbar (canvasState, templatesOpen, onToggleTemplates, onToggleDarkMode)
├── IconSidebar (activePanel, onSelectPanel, darkMode)
├── [Conditional Left Panels]
│   ├── LeftSidebar (templates) — when templatesOpen && !activePanel
│   ├── ShapesPanel — when activePanel === 'images'
│   ├── MyImagesPanel — when activePanel === 'my_images'
│   ├── MotionPanel — when activePanel === 'motion'
│   ├── SoundPanel — when activePanel === 'sound'
│   └── LayersPanel — when activePanel === 'layers'
├── CanvasArea (main Fabric.js canvas)
├── FloatingPenToolbar (draggable, visible when pen tool active)
├── RightSidebar (properties panel, closeable)
├── AgentChat (floating AI orb)
├── Timeline (bottom, toggleable)
└── BottomBar (zoom controls, timeline toggle, transparency toggle, object count)
```

**State Flow:** `useCanvasState()` returns a single object containing:
- Canvas ref, Fabric canvas instance, selected object, canvas objects list
- Zoom, assets, undo/redo stacks (30 max), history version counter
- Template bindings (objectTokens), text selection state, background color
- Active tool (select | blobBrush | pen), blob brush settings (size, color, shape, angle)
- Pen tool settings (sub-tool, stroke/fill color, width, dash, cap, join, opacity)
- Canvas dimensions (canvasW, canvasH), unit system (px/in/cm/mm/pt), DPI
- Audio tracks, audio element refs, timeline open state
- Dark mode, checkerboard transparency, printer marks
- Refs for fitToView, createMask, removeMask, syncMaskClipPath

---

## 2. Tech Stack & Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3 | UI framework |
| react-dom | 18.3 | React renderer |
| fabric | 6.6.1 | Canvas rendering engine |
| vite | 6.3+ | Build tool / dev server |
| tailwindcss | 3.4 | Utility CSS framework |
| postcss | 8.x | CSS processing |
| autoprefixer | 10.x | CSS vendor prefixes |
| uuid | 11.x | Unique ID generation |
| gifuct-js | 2.x | GIF decoding |
| jspdf | 3.x | PDF generation |
| jszip | 3.x | ZIP file creation |
| mp4-muxer | 5.x | MP4 video encoding |
| file-saver | 2.x | File download helper |
| @aws-sdk/client-s3 | 3.x | S3 uploads (scripts only) |

---

## 3. Project Structure

```
LazerClaw/
├── index.html                     # Single HTML entry point
├── package.json                   # Dependencies & scripts
├── vite.config.js                 # Vite config with React plugin
├── tailwind.config.js             # Tailwind with darkMode: 'class'
├── postcss.config.js              # PostCSS with Tailwind + autoprefixer
├── public/                        # Static assets
│   ├── shapes/                    # SVG vector shapes
│   │   ├── vs_stars/              # Stars, bursts, etc.
│   │   ├── vs_arrows/             # Arrow shapes
│   │   ├── vs_rectangles/         # Rectangle variants
│   │   ├── vs_polygons/           # Polygon shapes
│   │   └── vs_icons/              # Icon shapes (cloud, lock, etc.)
│   └── ...                        # Other static assets
├── scripts/                       # Build/upload scripts
│   ├── build-clipart-manifests.mjs # Build clipart manifests from S3
│   ├── build-curated-clipart.mjs  # Build curated clipart lists
│   ├── upload-s3.mjs              # Upload to S3
│   └── clipart-manifests/         # JSON manifest files
├── src/
│   ├── main.jsx                   # Entry: login gate + App render
│   ├── App.jsx                    # Root layout, keyboard shortcuts, zoom
│   ├── index.css                  # Tailwind + custom styles
│   ├── components/
│   │   ├── CanvasArea.jsx         # Main Fabric.js canvas (~3700 lines)
│   │   ├── Toolbar.jsx            # Top toolbar with all tools
│   │   ├── RightSidebar.jsx       # Properties panel
│   │   ├── LeftSidebar.jsx        # Templates panel
│   │   ├── IconSidebar.jsx        # Vertical icon bar
│   │   ├── LayersPanel.jsx        # Layer management
│   │   ├── ShapesPanel.jsx        # Shapes, vectors, patterns, clipart
│   │   ├── MyImagesPanel.jsx      # User uploads
│   │   ├── MotionPanel.jsx        # Video clips browser
│   │   ├── SoundPanel.jsx         # Audio clips browser
│   │   ├── Timeline.jsx           # Video/audio timeline
│   │   ├── FloatingPenToolbar.jsx # Draggable pen sub-tool picker
│   │   ├── DownloadButton.jsx     # Export dropdown
│   │   ├── AgentChat.jsx          # AI design assistant
│   │   └── ColorPicker.jsx        # Color/gradient/pattern picker
│   ├── hooks/
│   │   └── useCanvasState.js      # Central state management
│   ├── utils/
│   │   ├── tiling.js              # Tiling/repeat logic
│   │   ├── contour.js             # Alpha contour tracing & path flattening
│   │   ├── motionMedia.js         # GIF/WebP/video decode & playback
│   │   └── penTool.js             # Pen tool Bézier path utilities
│   ├── data/
│   │   ├── schema.js              # Moments, fields, formats, fonts
│   │   ├── clipartCategories.js   # 40+ clipart categories
│   │   ├── artworks.js            # Floral art categories
│   │   ├── vectorShapes.js        # SVG shape categories
│   │   ├── patterns.js            # Pattern image categories
│   │   ├── motionClips.js         # Video clip categories
│   │   └── audioClips.js          # Audio clip categories
│   ├── config/
│   │   └── s3.js                  # S3 base URLs
│   └── constants/
│       └── canvas.js              # Default canvas dimensions (500×700)
```

---

## 4. Authentication

A simple password gate protects the app:
- Hash-based comparison using `hashStr()` (shift-add hash → unsigned hex)
- Expected hash: `f8d7b446`
- On success, sets cookie `dtool_auth=1` for 90 days
- On fail, shows red error for 1.5 seconds
- UI: centered white card with password input and "Sign In" button

---

## 5. Application Layout

The app fills the entire viewport (`h-screen w-screen`):
- **Top:** 56px toolbar (`h-14`)
- **Middle:** Flex row containing:
  - Icon sidebar (48px wide, vertical)
  - Optional left panel (280px wide): templates, shapes, my images, motion, sound, or layers
  - Canvas area (flexible, fills remaining space)
  - Right sidebar (256px, `w-64`): properties panel, closeable
- **Bottom:** 32px status bar (`h-8`) with:
  - Object count
  - Timeline toggle button
  - Transparency grid toggle
  - Zoom controls (presets dropdown, +/- buttons, slider, "Fit" button)
  - Properties button (if sidebar is closed)

---

## 6. Canvas Engine

### Fabric.js Setup
- Uses `fabric.Canvas` (not `StaticCanvas`)
- Canvas dimensions are `canvasW + 2*PASTEBOARD` by `canvasH + 2*PASTEBOARD` (PASTEBOARD = 300px)
- The artboard (white rectangle) is at position (PASTEBOARD, PASTEBOARD)
- A "pasteboard" overlay is drawn as 4 semi-transparent rectangles surrounding the artboard
- Background can be solid color, gradient, pattern, or transparent
- When transparent, optional checkerboard pattern is rendered

### Custom Rendering
- **FabricImage._render override:** Implements alpha-based stroke rendering. Instead of a rectangular stroke, it traces the image's alpha channel to create a stroke that follows the image contour. Uses offscreen canvas with composite operations.
- **Textbox._render override:** Implements:
  - **Vertical anchor** (`_dtoolVAnchor`): top, middle, bottom — shifts text rendering within the textbox bounds
  - **Text overflow** (`_dtoolOverflow`):
    - `wrap`: default, text can overflow
    - `shrink`: reduces font size to fit within box height
    - `clip`: clips text at box boundaries using `ctx.clip()`

### Zoom & Pan
- Zoom range: 10%–400%
- Mouse wheel zoom (Ctrl+scroll)
- Zoom presets: 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400%
- Fit-to-view: auto-calculates zoom to fit artboard with 40px padding
- Pan: middle-mouse drag or space+drag

### Snap-to-Edge Guides
- Threshold: 5px
- Guide color: magenta (#FF00FF)
- Snaps to: canvas edges (0, canvasW, canvasH), center lines (canvasW/2, canvasH/2), other object edges
- Draws visual guide lines on the overlay canvas

### Right-Click Context Menu
- Appears on right-click when an object is selected
- Items: Copy, Cut, Paste, Duplicate, Delete, separator, Bring Forward, Bring to Front, Send Backward, Send to Back, separator, Group/Ungroup, separator, Fit to Canvas, Fill Canvas, separator, Crop/Remove Crop
- Styled for dark mode, semi-transparent background, blur backdrop

### Object IDs
- Every object gets a `_dtoolId` (UUID v4) stored as a custom property
- Used for undo/redo reselection, template token bindings, tiling master/clone relationships

---

## 7. Tools

### Select Tool (V)
- Default tool
- Standard Fabric.js selection behavior
- Click to select, drag to move, handles to resize/rotate
- Shift+click for multi-select
- Rubber-band selection for multiple objects

### Blob Brush Tool (B)
- Freehand drawing that produces filled vector paths (not stroked lines)
- Settings panel with:
  - **Tip shape:** Circle, Square, Diamond, Wedge
  - **Size:** 4–100px
  - **Angle:** 0–180° (for non-circle shapes)
  - **Color:** full color picker
- Path generation: generates outline path based on brush tip shape using normal offsets along the stroke centerline, with Catmull-Rom smoothing
- **Blob merging:** When a new blob overlaps existing blobs of the same color, they are automatically merged into a single path using:
  1. Bounding box pre-check
  2. Canvas compositing overlap test
  3. Alpha contour tracing (marching squares)
  4. RDP simplification → smooth path generation
- Canvas cursor shows the brush shape at current size

### Pen Tool (P)
- Bézier path drawing tool with sub-tools:
  - **Pen:** Click to add anchor points, drag to create curves with handles
  - **Rectangle:** Click-drag to draw rectangles
  - **Ellipse:** Click-drag to draw ellipses
  - **Polygon:** Click to add vertices, double-click/close to finish
  - **Line:** Click-drag for straight lines
  - **Arc:** Click-drag for arc segments
  - **Spiral:** Click-drag for spiral paths
  - **Direct Select:** Move individual anchor points and handles
  - **Add Point:** Click on path segment to insert point
  - **Delete Point:** Click on anchor to remove it
  - **Convert Point:** Click to toggle between smooth/corner points
- Custom overlay rendering for anchor points (filled/hollow circles), handles (lines with dots), and preview lines
- Path completion on double-click, escape, or closing the path
- Pen settings in RightSidebar when no object selected:
  - Fill color (with no-color option)
  - Stroke color, width (0.5–20)
  - Dash style presets (solid, dash, dot, dash-dot, long dash)
  - Line cap (butt, round, square)
  - Line join (miter, round, bevel)
  - Opacity (0–100%)
- Floating pen toolbar: draggable panel showing all sub-tool icons

---

## 8. Object Types & Properties

### Text (Textbox)
- Created via Toolbar "Text" button
- Default: "Type here", 24px, Inter font, black, width 200px
- Properties:
  - Font family (from AVAILABLE_FONTS list)
  - Font size (1–500)
  - Color (full color picker with no-color option)
  - Alignment: left, center, right, justify
  - Style: bold, italic, underline, strikethrough, overline
  - Text case transforms: UPPERCASE, lowercase, Capitalize
  - Letter spacing (-200 to 800)
  - Line spacing (0.5–3.0)
  - Curved text (-100 to 100): uses SVG arc path as text path
  - Text orientation: horizontal / vertical (stacks characters with newlines)
  - Vertical anchor: top, middle, bottom (within textbox bounds)
  - Text overflow: wrap (allow overflow), shrink (reduce font to fit), clip (truncate)
- Inline editing: double-click to enter edit mode
- Character style clearing: when changing a style property, per-character overrides are removed to ensure uniform appearance

### Shapes
- Basic shapes added from ShapesPanel:
  - Rectangle, Square, Circle, Ellipse, Triangle, Diamond, Pentagon, Hexagon, Star (5-point), Heart, Arrow (right)
- Created using Fabric primitives (Rect, Circle, Ellipse, Triangle, Polygon, Path)
- Default: positioned at (100,100), default size varies, no stroke, colored fill

### Images (FabricImage)
- Added by:
  - Drag-and-drop from file system onto canvas
  - Upload via MyImagesPanel
  - Drag from asset panels
- Supported formats: PNG, JPEG, WebP, SVG, GIF
- SVGs are loaded via `loadSVGFromString` and converted to groups
- Alpha-stroke rendering (custom _render override)
- Crop mode: double-click image to enter crop overlay, drag to adjust visible area

### Paths
- Created by pen tool and blob brush
- "Flatten Path" button in RightSidebar: converts self-intersecting paths into clean outlines with holes preserved (uses alpha contour tracing)

### Groups
- Created by Ctrl+G on multi-selection
- Ungrouped by Ctrl+Shift+G
- Special group types:
  - Mask groups (`_dtoolMaskGroup: true`)
  - Tiling groups (auto-grouped for tiling)

### Common Properties (RightSidebar)
For all object types:
- **Position:** X, Y coordinates
- **Size:** Width, Height (shown for single selection only)
- **Rotation:** 0–360° slider
- **Opacity:** 0–100% slider
- **Flip:** Horizontal / Vertical
- **Canvas Sizing:** Fit (scale to fit within canvas) / Fill (scale to cover canvas)
- **Crop:** Enter crop mode / Remove crop
- **Stroke:**
  - Color (with no-color option)
  - Width (0–20px)
  - Dash style presets (solid, dash, dot, dash-dot, long dash)
  - Custom dash length and gap (when dash is active)
  - Line cap (butt, round, square)
  - Line join (miter, round, bevel)
- **Drop Shadow:**
  - Enable/disable toggle
  - Color (with picker)
  - Blur (0–50)
  - Opacity (0–100%)
  - Offset X, Offset Y

---

## 9. Panels & Sidebars

### Icon Sidebar (leftmost, vertical)
Five icons arranged vertically:
1. **Images** → opens ShapesPanel
2. **My Images** → opens MyImagesPanel
3. **Motion** → opens MotionPanel
4. **Sound** → opens SoundPanel
5. **Layers** → opens LayersPanel

Click toggles panel on/off. Only one panel is active at a time. Opening a panel closes the Templates sidebar.

### Shapes Panel (Images)
Collapsible sections:
1. **Basic Shapes:** Grid of shape buttons (rect, circle, etc.)
2. **Vector Shapes:** Categories (stars, arrows, rectangles, polygons, icons) with SVG thumbnails from `/shapes/` directory
3. **Patterns:** Abstract pattern images from S3
4. **Floral Art:** Flower artwork images from S3
5. **Clip Art:** 40+ categories with 40,000+ images from S3
   - Manifest-based loading with pagination (50 per page, "Show more" button)
   - Each category is expandable/collapsible
   - Search across all categories and items

Items can be clicked to add to canvas or dragged to position on canvas.

### My Images Panel
- Upload area with drag-and-drop and file picker
- Accepts: PNG, JPEG, WebP, SVG, GIF, MP4, WebM, MOV
- Shows uploaded assets as thumbnail grid
- Click to reuse (place on canvas)
- Delete button on hover
- Drag as `application/dtool-image-fill` for pattern fill on shapes

### Motion Panel
- Video clips organized by category (Birthday, Halloween, Wedding, etc.)
- Thumbnails generated from first video frame, cached in IndexedDB
- Click to add video to canvas
- Videos become `FabricImage` objects with proxy canvas for frame rendering
- Auto-plays when added if autoplay is on
- Opens timeline automatically

### Sound Panel
- Audio clips organized by category (Calm, Easy Listening, Funk, etc.)
- Click to preview, double-click to add to layers as audio track
- Search across categories
- Tracks managed via `audioTracks` state and HTML5 Audio elements

---

## 10. Toolbar Features

Left to right:
1. **Logo** (LazerClaw)
2. **Undo / Redo** — 30-step history, serializes full canvas JSON
3. **Copy / Paste / Duplicate** — clipboard stored in ref, paste offsets by 20px
4. **Bring Forward / Send Backward** — z-order manipulation
5. **Group / Ungroup** — multi-selection ↔ Group
6. **Create Mask** — requires multi-selection with vector + non-vector objects
7. **Align & Distribute** — dropdown panel:
   - Align to Canvas or Selection (toggle for multi-selection)
   - 6 alignment buttons: left, center-H, right, top, center-V, bottom
   - 2 distribute buttons: horizontal, vertical (requires 3+ objects)
8. **Tiling** — dropdown panel (see Tiling System section)
9. **Select / Blob Brush / Pen** — tool buttons
10. **Add Text** — creates Textbox at (100,100)
11. **Delete** — removes selected objects
12. **Templates** — toggle Templates panel
13. **Canvas Size** — dropdown with units, DPI, custom size, presets
14. **Printer Marks** — dropdown (see Printer Marks section)
15. **Play/Pause** — toggle autoplay for animations/videos
16. **(spacer)**
17. **Download** — export dropdown
18. **Dark Mode** — toggle with view transition animation

---

## 11. Color Picker

A sophisticated color picker component used for text color, shape fill, background, and stroke:

### Tabs
1. **Solid:** HSV color picker with:
   - Saturation-Value area (256×180px, drag to pick)
   - Hue bar (horizontal, drag to pick)
   - Hex input (direct entry)
   - No-color (transparent) option
   - 11 preset swatches
   - Recent colors (last 12, persisted to localStorage)
2. **Gradient** (when enabled):
   - Linear gradient editor
   - Angle slider (0–360°)
   - Gradient stops with color + position
   - Add/remove stops
   - Drag to reposition stops
   - Preset gradient buttons
3. **Image Fill** (when enabled):
   - Upload image or drop image
   - Two modes: Tile (repeating pattern) or Mask (clip-to-shape)
   - Recent image fills (persisted to localStorage)
   - Motion fill: drop video/GIF to fill shape with animation
4. **Pattern** (swatchable):
   - Drop zone on swatch for pattern fills from MyImagesPanel

### Gradient Editor Details
- Creates `fabric.Gradient` with `type: 'linear'`
- Gradient angle converts to coordinate system for Fabric
- Stops stored as `{ offset: 0-1, color: hex }`
- At least 2 stops required

### Image Fill Details
- **Tile mode:** Creates `fabric.Pattern` with `repeat: 'repeat'` using scaled image
- **Mask mode:** Creates a mask group (see Masking System):
  - Clones the target shape as a clipPath
  - Creates a FabricImage with the image
  - Wraps in a Group with the clip path
  - Original shape becomes the mask boundary

---

## 12. Layers Panel

A full-featured layer management panel:

### Layer List
- Shows all canvas objects in top-to-bottom visual order (reversed from Fabric z-index)
- Each row shows:
  - Drag handle
  - Layer type icon (text, image, shape, group, mask group)
  - Layer name (auto-generated from type, customizable via double-click rename)
  - Visibility toggle (eye icon)
  - Lock toggle (lock icon)
- Multi-select with Ctrl+click and Shift+click
- Delete selected layers with Delete/Backspace key
- Drag-and-drop reorder (updates Fabric z-index)
- Click to select object on canvas (syncs selection both ways)

### Groups & Masks in Layer List
- Groups show as expandable/collapsible with member count
- Mask groups show mask icon and "Masked" prefix
- Mask group children listed inline with indentation

### Background Section
- Collapsible section at bottom
- Background color/gradient picker
- Background objects: objects can be dragged to background section
  - Background objects are locked, fill-to-canvas, non-selectable from main list
  - Can be removed (returned to regular layers)
- Background image fill: drag image to background area
- Delete background object button

### Audio Tracks Section
- Shows all audio tracks below layers
- Each track: name, play/pause button, volume slider (0-1), remove button
- Audio waveform visualization (in Timeline)

---

## 13. Templates System

The templates system allows binding text objects to data fields for personalization:

### Concepts
- **Moment:** An event type (Wedding, Birthday, Graduation, Christmas, etc.)
- **Field:** A data attribute for that moment (e.g., "Couple Names", "Event Date")
- **Format:** How the field value is displayed (e.g., "January 1, 2025" vs "01/01/25")
- **Token:** A binding between a text range and a field+format

### Workflow
1. Select a Moment from the dropdown
2. Select text on canvas (enter edit mode, highlight text)
3. Choose a field from the Field Catalog
4. Choose a format from the Format Picker
5. Token is created, binding the selected text to the field

### Token Management
- Tokens stored as `_dtoolTokens` on each text object
- Token editor shows bound tokens, allows editing field/format
- "Clear All" removes all tokens from the object
- Auto-templatize: AI-based automatic field detection and binding (via `/api/agent`)

### Onboarding
- Two-step onboarding tooltip:
  1. "Select the text you'd like to mark as a template field" (if no text selection)
  2. "Highlight the text you want to bind" (pointing to text object on canvas)

### Data Schema
- `MOMENTS`: Array of `{ id, label, icon }` (wedding, birthday, graduation, christmas, valentines, baby_shower, anniversary, generic)
- `FIELD_CATALOGS`: Map of moment → fields array, each field has `{ path, type, label }`
- `FORMATS`: Map of type → format array, each format has `{ id, label, example, template }`
- `AVAILABLE_FONTS`: Array of 50+ font family names

---

## 14. Tiling System

Repeats an object across the canvas with various patterns:

### Tile Modes
1. **None:** No tiling
2. **Basic:** Simple grid repeat
3. **Half Brick:** Every other row is offset by half the tile width (like brickwork)
4. **Half Drop:** Every other column is offset by half the tile height
5. **Mirror:** Alternating rows/columns are flipped horizontally/vertically

### Implementation
- Tiling creates clone objects with `_dtoolTileClone: true` flag
- Clones are non-selectable, non-evented, no controls/borders
- Master object tracks: `_dtoolTileMode`, `_dtoolTileMasterId`, `_dtoolTileSpacing`, `_dtoolTileRandomRotation`
- Tiling covers `canvasW + 2*PASTEBOARD` area
- Uses pattern-based approach (for performance) or individual clones (when random rotation is enabled)

### Spacing
- Adjustable spacing (-100 to 200px)
- Negative = overlap, Positive = gap

### Random Rotation
- Toggle to apply random rotation (0, 90, 180, 270°) to each tile clone

### Auto-Group on Tile
- If an ActiveSelection is tiled, it auto-groups the selection first

### Sync on Changes
- When the master object is modified (fill, size, position, etc.), tile clones are automatically refreshed via `refreshTileClones()`
- Deleting the master removes all clones via `removeTiling()`

---

## 15. Masking System

Vector shapes can mask other objects:

### Create Mask (Toolbar button or context menu)
Requirements: multi-selection with at least one vector shape (rect, circle, ellipse, triangle, polygon, path) and at least one non-vector object

Process:
1. The topmost vector shape becomes the clip path
2. All other selected objects become masked content
3. A Group is created with:
   - `_dtoolMaskGroup: true`
   - `_dtoolMaskLinked: true`
   - `clipPath` set to cloned vector shape
   - Mask shape child with `_dtoolMaskShape: true` (transparent, locked)
   - Content children positioned relative to group center

### Mask Properties
- Stroke/dash applied to the mask shape (visible outline)
- Shadow applied to the mask group
- Fill applied to the content objects only

### Remove Mask
- Removes the group, restores the original shape
- Available from LayersPanel ("Unlink" / "Remove Mask") and context menu

### Image Fill as Mask
From RightSidebar's ColorPicker, choosing "Mask" mode for image fill:
- Clones the target shape as clipPath
- Creates FabricImage for the image
- Clones shape again as transparent mask shape child
- Wraps all in a Group

---

## 16. Motion & Video

### Adding Video to Canvas
- From MotionPanel: click a video clip thumbnail
- From MyImagesPanel: upload video file
- From drag-and-drop: drop video file onto canvas

### Video Object Structure
- `FabricImage` with a proxy canvas as the image source
- Custom properties:
  - `_dtoolAnimated: true`
  - `_dtoolMediaElement`: HTML video element
  - `_dtoolMediaProxy`: offscreen canvas for frame rendering
  - `_dtoolMediaSrcW/SrcH`: original video dimensions
  - `_dtoolMediaBlobUrl`: blob URL for the video
- Video is cover-scaled to fit the object dimensions
- `objectCaching: false` for real-time frame updates

### Motion Fill (Video/GIF in Shapes)
- From RightSidebar → Fill → Image tab → drop video/GIF
- Converts shape fill to animated pattern:
  - Creates proxy canvas at shape dimensions
  - For video: uses HTML video element, renders frames to proxy
  - For GIF: decodes with gifuct-js, uses FrameAnimator for frame cycling
  - For animated WebP: uses ImageDecoder API

### Animation Loop
- In `CanvasArea`, an animation frame loop (`requestAnimationFrame`) continuously:
  1. Iterates all canvas objects
  2. For video objects: draws current video frame to proxy canvas
  3. For GIF/WebP objects: advances frame using FrameAnimator timing
  4. For motion-filled shapes: same approach but on the fill pattern source
  5. Renders canvas

### Playback Control
- Play/Pause button in Toolbar
- `autoplay` state controls whether new videos auto-play
- Timeline provides scrubbing and seeking

---

## 17. Audio & Timeline

### Audio Track Management
- `audioTracks` state: array of `{ id, url, name, playing, volume }`
- `audioElementsRef`: map of id → HTML Audio element
- Functions: `addAudioTrack`, `playAudioTrack`, `pauseAudioTrack`, `stopAudioTrack`, `setAudioVolume`
- Audio elements are set to loop by default

### Timeline Component
- Toggle from bottom bar
- Shows:
  - **Ruler:** Time markers at 1-second intervals
  - **Playhead:** Draggable position indicator
  - **Video tracks:** One row per animated canvas object, showing duration
  - **Audio tracks:** One row per audio track with:
    - Waveform visualization (decoded from AudioContext)
    - Mute/unmute button
    - Volume slider
    - Duration bar with loop indicators
  - **Controls:** Play/pause button, current time display, total duration
- Seeking: click on ruler or drag playhead
- Duration: computed as max of all audio and video track durations

---

## 18. Printer Marks & Print Production

### Bleed Zone
- Extends beyond the canvas (trim) edge
- Per-side offsets (top, right, bottom, left) in current units
- Linkable (all sides equal) or per-side independent
- Displayed as red dashed rectangle
- Standard: 0.125 in / 3 mm

### Cut / Trim Line
- The canvas edge itself (green dashed rectangle when enabled)
- Size determined by canvas dimensions, not editable in marks panel

### Safe Area
- Interior margin where critical content should stay
- Per-side offsets, linkable
- Displayed as blue dashed rectangle
- Standard: 0.125 in / 3 mm inward

### Grid Lines
- Toggle-able grid overlay on the canvas

### Printer's Marks (require bleed > 0)
- **Crop Marks:** L-shaped marks at each corner of the trim area
- **Registration Marks:** Cross-hair targets at midpoints of each edge
- **Color Bars:** CMYK color calibration bars along edges

### Visual Preview
- Schematic SVG preview in the panel showing all zones
- Color-coded legend: Red=Bleed, Green=Trim, Blue=Safe

### In PDF Export
- Marks are rendered into the PDF output
- `drawPrintMarks()` function draws marks on the PDF canvas

---

## 19. Export System

### Design Package (.zip)
- Contains:
  - `design.json`: full Fabric.js canvas serialization
  - `preview.png`: canvas rendered as PNG
  - `metadata.json`: canvas dimensions, DPI, unit

### PDF Export
- Uses jsPDF library
- Canvas rendered to image, placed on PDF page
- Optional printer marks overlay
- Page size matches canvas dimensions in current units

### Flat Video (.mp4)
- Uses mp4-muxer for encoding
- Records canvas frames at animation rate
- Progress callback updates UI with percentage
- Includes all animated content (video, GIF, motion fills)
- Audio tracks are not included in MP4 (visual only)

---

## 20. AI Design Assistant (Zee)

### UI
- Floating orb in bottom-right corner
- Draggable with snap-back animation
- Click or drag to open chat panel
- Lightning bolt animation on open
- Spark burst particles on interaction

### Chat Interface
- Message history with user/assistant bubbles
- Text input with send button
- Reference image support (paste or drop images)
- Canvas snapshot sent as context

### Design Flow
- Single-turn: simple questions/answers
- Iterative design mode (for design requests):
  1. **Plan:** AI describes what it will create
  2. **Build:** AI executes actions on the canvas
  3. **Refine:** User requests changes, AI applies them
  4. **Rate:** User rates the result
- Design request detection: regex-based (`/design|create|make|build|layout|template/i`)

### Actions
- AI can execute canvas actions via `executeActions()`:
  - Add shapes, text, images
  - Modify properties (fill, stroke, font, position, etc.)
  - Add clipart, motion clips, audio
  - Group/ungroup, align, delete

### Backend
- POST to `/api/agent` with messages, canvas state, reference images
- System prompt built from `buildAgentSystemPrompt()`

---

## 21. Dark Mode

### Implementation
- Toggle button in toolbar (sun/moon icon)
- Uses `dark` class on root element for Tailwind dark variant
- State persisted to localStorage (`dtool-dark-mode`)
- View transition animation:
  - Uses `document.startViewTransition()` API
  - Ripple effect from button position using CSS custom properties
  - Fallback to instant switch if API unavailable

### Canvas
- Dark mode changes:
  - Pasteboard color adjusts
  - Canvas background remains user-defined
  - Selection handles and guides use appropriate colors

### Components
- Every component accepts `dm` (dark mode boolean) or reads from `canvasState.darkMode`
- All UI elements have dark/light variants via Tailwind classes

---

## 22. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+X | Cut |
| Ctrl+D | Duplicate |
| Ctrl+A | Select All |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+G | Group |
| Ctrl+Shift+G | Ungroup |
| Ctrl+] | Bring Forward |
| Ctrl+[ | Send Backward |
| Ctrl+= / Ctrl++ | Zoom In |
| Ctrl+- | Zoom Out |
| Ctrl+0 | Fit to View |
| Delete / Backspace | Delete selected |
| Escape | Deselect / exit tool |
| V | Select tool |
| B | Blob brush tool |
| P | Pen tool |
| Arrow keys | Nudge 1px |
| Shift+Arrow keys | Nudge 10px |

All shortcuts are suppressed when focus is in INPUT, TEXTAREA, SELECT, or when text is being edited inline.

---

## 23. Canvas Size & Units

### Unit System
Supported units: pixels (px), inches (in), centimeters (cm), millimeters (mm), points (pt)

Conversion formulas (all based on DPI):
- `in → px`: value × DPI
- `cm → px`: (value / 2.54) × DPI
- `mm → px`: (value / 25.4) × DPI
- `pt → px`: (value / 72) × DPI

### DPI Options
72, 96, 150, 300

### Canvas Presets
| Preset | Dimensions | Description |
|--------|-----------|-------------|
| 5×7 | 5 × 7 in | Portrait |
| 7×5 | 7 × 5 in | Landscape |
| 1:1 | 6 × 6 in | Square |
| 9:16 | 4.5 × 8 in | Story/Reel |
| 16:9 | 8 × 4.5 in | Widescreen |
| 4:5 | 4.8 × 6 in | Instagram Post |
| 4×6 | 4 × 6 in | Photo |
| 6×4 | 6 × 4 in | Photo Landscape |
| 3:2 | 6 × 4 in | Classic |
| 2:3 | 4 × 6 in | Classic Portrait |
| 11×14 | 11 × 14 in | Print |
| Letter | 8.5 × 11 in | Letter |
| A4 | 8.27 × 11.69 in | A4 |

### Size Picker UI
- Shows current size in selected units
- Dropdown with:
  - Unit selector
  - DPI selector
  - Custom width/height inputs with "Apply Size" button
  - Shows pixel equivalent
  - Preset list with aspect ratio thumbnails

---

## 24. S3 Asset Infrastructure

### Base URL
`https://<YOUR_S3_BUCKET>.s3.<YOUR_REGION>.amazonaws.com`

Configure via environment variables `VITE_S3_BUCKET` and `VITE_S3_REGION` (see `.env.example`).

### Asset Paths
| Asset Type | Path |
|-----------|------|
| Motion clips | `/motion/{folder}/{filename}` |
| Audio clips | `/audio/{folder}/{filename}` |
| Clip art | `/clipart/{folder}/{filename}` |
| Artworks | `/artworks/{filename}` |
| Patterns | `/patterns/{filename}` |

### Clipart Manifest System
- Each clipart category has a JSON manifest file listing all images
- Manifests are loaded on-demand when a category is expanded
- Pagination: 50 items per page with "Show more" button
- 40+ categories with 40,000+ total images

---

## 25. Data Schemas

### AVAILABLE_FONTS (50+ fonts)
Inter, Arial, Helvetica, Verdana, Georgia, Times New Roman, Courier New, Trebuchet MS, Impact, Comic Sans MS, Palatino, Garamond, Bookman, Didot, Futura, Gill Sans, Lucida, Optima, Rockwell, Baskerville, Bodoni, Brush Script, Copperplate, Papyrus, Century Gothic, Cambria, Calibri, Candara, Consolas, Tahoma, Geneva, Monaco, Menlo, Lato, Montserrat, Raleway, Poppins, Roboto, Open Sans, Nunito, Playfair Display, Merriweather, Source Sans Pro, Work Sans, DM Sans, Quicksand, Josefin Sans, Lexend, Urbanist, Caveat, Pacifico, Lobster, Great Vibes, Dancing Script, Satisfy, Sacramento, Pinyon Script, Allura, Alex Brush, Tangerine

### MOMENTS
wedding, birthday, graduation, christmas, valentines, baby_shower, anniversary, generic

### Motion Categories
Birthday, Halloween, Wedding, St. Patrick's Day, Easter, Christmas, Valentine's, Chinese New Year

### Audio Categories
Calm, Easy Listening, Funk, Groovy, Happy, Inspirational, Romantic, Cinematic

### Clipart Categories (40+)
Various styles: watercolor, impressionist, line art, sketch, cute cartoon, chibi, ethereal, fauvist, etc. — organized by theme (general, Halloween, holiday, Christmas, Valentine's, Easter, St. Patrick's, Chinese New Year)
