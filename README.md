[![npm version](https://img.shields.io/npm/v/map-image-overlay.svg?style=flat-square)](https://www.npmjs.com/package/map-image-overlay)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

# map-image-overlay

A framework-agnostic georeferencing and image overlay editor for **Mapbox GL JS** (≥ 2.0.0) and **MapLibre GL JS** (≥ 3.0.0).

`map-image-overlay` provides a highly optimized, stateless core engine for manipulating image coordinates directly on web maps, alongside a fully-featured React hook for effortless state management.

## 🌐 Live Demos

Test the interactive editor and viewer modes across different mapping ecosystems:

- 🗺️ [MapLibre GL JS Live Example](https://CatCodeDanix.github.io/map-image-overlay/demo/maplibre.html)
- 🛰️ [Mapbox GL JS Live Example](https://CatCodeDanix.github.io/map-image-overlay/demo/mapbox.html)

## Features

- ⚡ **Engine Agnostic** — Native support for both Mapbox GL and MapLibre GL instances.
- 📐 **True Georeferencing** — Free-form corner dragging, constrained rotation, and infinite scaling directly on the map surface.
- 📦 **Dual Architecture** — Use the stateless Vanilla TS core (`src/core`) or drop in the fully managed React hook (`src/react`).
- 🪶 **Zero Core Dependencies** — The engine runs on pure Web Mercator math and native map instance methods.
- 🎨 **Multi-Layer Support** — Manage, reorder, lock, and adjust opacity for multiple image overlays simultaneously.

## Installation

```bash
npm install map-image-overlay
```

_(Note: `mapbox-gl` or `maplibre-gl` are required peer dependencies depending on your engine of choice)._

## Architecture

This library is split into two distinct modules to give you total architectural control:

1. **Core (`map-image-overlay/core`)**: A vanilla, zero-dependency `ImageOverlayController`. It handles rendering the drag surfaces, corner handles, and viewer layers on the WebGL canvas. **It is completely stateless**—you must provide it with coordinates and listen to its `change` events.
2. **React (`map-image-overlay/react`)**: A `useGeorefManager` hook that handles the heavy lifting of state, ID generation, layer reordering, and the rendering lifecycle for you.

## React Usage

```tsx
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useGeorefManager } from "map-image-overlay/react";

export function MapEditor() {
  const containerRef = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
    });
    instance.on("load", () => setMap(instance));
    return () => instance.remove();
  }, []);

  // Pass the map instance and your engine type
  const { overlays, editorState, actions } = useGeorefManager(map, "mapbox");

  return (
    <div>
      <div ref={containerRef} style={{ width: "100%", height: "500px" }} />
      <button onClick={() => actions.setAddMode(!editorState.isAddMode)}>
        Toggle Add Mode
      </button>
    </div>
  );
}
```

## Vanilla Usage

When using the core controller directly, you act as the state manager. Use `syncEditor` to make an image actively editable, and `syncViewer` to lock images in place.

```typescript
import { ImageOverlayController } from "map-image-overlay";

const controller = new ImageOverlayController(mapInstance, "my-layer-id");

let myImageState = {
  coords: [
    [-80, 46],
    [-71, 46],
    [-71, 37],
    [-80, 37],
  ],
  url: "[https://docs.mapbox.com/mapbox-gl-js/assets/radar.gif](https://docs.mapbox.com/mapbox-gl-js/assets/radar.gif)",
  opacity: 0.8,
};

// 1. Put the image in edit mode
controller.syncEditor(
  myImageState.coords,
  myImageState.url,
  myImageState.opacity,
  "active-id",
);

// 2. Listen to user drag events and update your local state
controller.on("change", (e) => {
  myImageState.coords = e.corners;
});

// 3. Lock the image (clear the editor, move the image to the viewer)
function lockImage() {
  controller.syncEditor(null, null, 1, null);
  controller.syncViewer([
    {
      id: "active-id",
      type: "image",
      title: "My Image",
      coordinates: myImageState.coords,
      imageUrl: myImageState.url,
      opacity: myImageState.opacity,
    },
  ]);
}
```

## License

MIT
