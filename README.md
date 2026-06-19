# map-image-overlay

A framework-agnostic georeferencing and image overlay editor for Mapbox GL and MapLibre GL.

`map-image-overlay` provides a highly optimized, stateless core engine for manipulating image coordinates on web maps, alongside a fully-featured React hook for state management.

## Installation

```bash
npm install map-image-overlay
```

_(Note: `mapbox-gl` or `maplibre-gl` are required peer dependencies depending on your engine of choice)._

## Architecture

This library is split into two parts:

1. **Core (`src/core`)**: A vanilla, zero-dependency `ImageOverlayController`. It handles rendering the drag surfaces, corner handles, and viewer layers on the canvas. **It is stateless**—you must provide it with coordinates and handle its `change` events.
2. **React (`src/react`)**: A `useGeorefManager` hook that handles the state, ID generation, history, and rendering lifecycle for you.

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

```ts
import { ImageOverlayController } from "map-image-overlay";

const controller = new ImageOverlayController(mapInstance, "my-layer-id");

let myImageState = {
  coords: [
    [-80, 46],
    [-71, 46],
    [-71, 37],
    [-80, 37],
  ],
  url: "[https://example.com/radar.gif](https://example.com/radar.gif)",
  opacity: 0.8,
};

// 1. Put the image in edit mode
controller.syncEditor(
  myImageState.coords,
  myImageState.url,
  myImageState.opacity,
  "active-id",
);

// 2. Listen to user drag events and update your state
controller.on("change", (e) => {
  myImageState.coords = e.corners;
});

// 3. Lock the image (clear the editor, move it to the viewer)
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
