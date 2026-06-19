import mapboxgl from "mapbox-gl";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { GenericMap, LngLatTuple } from "./core/types";
import { useGeorefManager } from "./react/useGeorefManager";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const MAPBOX_TOKEN = "YOUR_MAPBOX_ACCESS_TOKEN";
const TEST_IMAGE_URL = "https://docs.mapbox.com/mapbox-gl-js/assets/radar.gif";

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors",
    },
  },
  layers: [
    {
      id: "osm-layer",
      type: "raster",
      source: "osm",
    },
  ],
};

function MapWorkspace({ engine }: { engine: "mapbox" | "maplibre" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<GenericMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: any;
    if (engine === "mapbox") {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: OSM_STYLE as any,
        center: [-75.97, 42.18],
        zoom: 4,
      });
    } else {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE as any,
        center: [-75.97, 42.18],
        zoom: 4,
      });
    }

    map.on("load", () => setMapInstance(map as unknown as GenericMap));
    return () => map.remove();
  }, [engine]);

  const { overlays, editorState, hoveredOverlayId, actions } = useGeorefManager(
    mapInstance,
    engine,
  );
  const isEditing = editorState.activeImage !== null;
  const isNewImage = isEditing && !editorState.activeImage?.id;
  const isDirty = editorState.isDirty;

  const handleSimulateClickAdd = () => {
    const center: LngLatTuple = [-75.97, 42.18];
    actions.mountNewImage(center, TEST_IMAGE_URL);
  };

  const hoveredData = hoveredOverlayId
    ? overlays.find((o) => o.id === hoveredOverlayId)
    : null;

  return (
    <div className="relative w-full h-full border-r border-border">
      <div className="absolute top-2 left-2 z-10 bg-black/80 px-2 py-1 text-xs rounded pointer-events-none capitalize">
        {engine}
      </div>

      <div ref={containerRef} className="w-full h-full" />

      {/* INDEPENDENT EDITOR PANEL */}
      {isEditing && (
        <Card className="absolute top-4 right-4 w-[380px] z-20 shadow-2xl bg-zinc-950/95 backdrop-blur">
          <CardHeader className="flex flex-row justify-between items-center pb-2 border-b">
            <CardTitle className="text-sm">Image Settings</CardTitle>
            <div className="flex gap-1">
              {!isNewImage && (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      actions.reorder(editorState.activeImage!.id!, "back")
                    }
                  >
                    Back
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      actions.reorder(editorState.activeImage!.id!, "front")
                    }
                  >
                    Front
                  </Button>
                </>
              )}
              {/* Only show delete if it is an existing saved layer */}
              {!isNewImage && (
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() =>
                    actions.deleteOverlay(editorState.activeImage!.id!)
                  }
                >
                  Del
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => actions.closeEditor()}
              >
                X
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto">
            <div className="space-y-2">
              <Input
                placeholder="Image Title"
                value={editorState.settings.title}
                onChange={(e) =>
                  actions.updateMetadata("title", e.target.value)
                }
              />
              <Input
                placeholder="Description (Optional)"
                value={editorState.settings.description}
                onChange={(e) =>
                  actions.updateMetadata("description", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Opacity: {Math.round(editorState.settings.opacity * 100)}%
              </label>
              <Slider
                value={[editorState.settings.opacity]}
                max={1}
                step={0.01}
                onValueChange={(v) => actions.setOpacity(v[0])}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Scale (Relative Jump)
              </label>
              <Slider
                value={[editorState.settings.scale]}
                min={10}
                max={190}
                step={1}
                onValueChange={(v) => actions.setScale(v[0])}
                onValueCommit={() => actions.bakeScale()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Rotation: {editorState.settings.rotation}°
              </label>
              <Slider
                value={[editorState.settings.rotation]}
                min={-360}
                max={360}
                step={1}
                onValueChange={(v) => actions.setRotation(v[0])}
              />
            </div>

            <hr className="border-zinc-800" />
            <h4 className="font-bold text-xs text-muted-foreground mb-2">
              Coordinates (Lng, Lat)
            </h4>
            <div className="space-y-2">
              {editorState.corners.map((corner, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="number"
                    value={Number(corner[0].toFixed(5))}
                    className="h-8 text-xs font-mono"
                    onChange={(e) =>
                      actions.editCorner({
                        index: i,
                        axis: 0,
                        value: parseFloat(e.target.value),
                      })
                    }
                  />
                  <Input
                    type="number"
                    value={Number(corner[1].toFixed(5))}
                    className="h-8 text-xs font-mono"
                    onChange={(e) =>
                      actions.editCorner({
                        index: i,
                        axis: 1,
                        value: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-4"
              disabled={!isDirty || !editorState.settings.title.trim()}
              onClick={() => actions.saveOverlay()}
            >
              {isDirty ? "Save Overlay" : "Saved!"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* INDEPENDENT VIEWER PANEL & TOOLTIPS */}
      {!isEditing && (
        <Card className="absolute bottom-4 left-4 w-72 z-20 shadow-2xl bg-zinc-950/95 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle>Saved Overlays</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={editorState.isAddMode ? "destructive" : "default"}
              className="w-full"
              onClick={() => actions.setAddMode(!editorState.isAddMode)}
            >
              {editorState.isAddMode
                ? "Cancel Add Mode"
                : "Click Map to Add Image"}
            </Button>
            <Button
              className="w-full mt-2"
              variant="secondary"
              onClick={handleSimulateClickAdd}
            >
              Quick Add at Center
            </Button>

            {hoveredData ? (
              <div className="mt-4 p-3 bg-zinc-900 border border-zinc-700 rounded-md">
                <h4 className="font-bold text-sm text-primary">
                  {hoveredData.title || "Untitled Image"}
                </h4>
                {hoveredData.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {hoveredData.description}
                  </p>
                )}
                <p className="text-[10px] text-zinc-500 mt-2 uppercase">
                  Click image on map to edit
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {overlays.length === 0 && (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                )}
                {overlays.map((o) => (
                  <Button
                    key={o.id}
                    variant="outline"
                    className="w-full justify-start text-xs"
                    onClick={() => actions.editOverlay(o.id)}
                  >
                    Edit: {o.title || "Untitled"}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function App() {
  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      <MapWorkspace engine="mapbox" />
      <MapWorkspace engine="maplibre" />
    </div>
  );
}
