import { EventEmitter } from "./EventEmitter";
import type {
  ControllerEvents,
  GenericMap,
  ImageCoords,
  ImageOverlayPayload,
} from "./types";

export class ImageOverlayController extends EventEmitter<ControllerEvents> {
  private map: GenericMap;
  private savedOverlays: ImageOverlayPayload[] = [];

  private editCoords: ImageCoords | null = null;
  private editOpacity: number = 1;
  private isAddMode: boolean = false;
  private activeEditId: string | null = null;

  private draggingCorner: number | null = null;
  private draggingEdge: number | null = null;
  private isDraggingOverlay: boolean = false;
  private startPoint: { x: number; y: number } | null = null;
  private startCoords: ImageCoords | null = null;

  private hoveredOverlayId: string | null = null;

  private editorIds = {
    src: "",
    layer: "",
    geoSrc: "",
    dragLayer: "",
    edgesLayer: "",
    cornersLayer: "",
  };

  constructor(mapInstance: GenericMap, layerId: string) {
    super();
    this.map = (mapInstance as any).getMap
      ? (mapInstance as any).getMap()
      : mapInstance;

    this.editorIds = {
      src: `georef-src-${layerId}`,
      layer: `georef-layer-${layerId}`,
      geoSrc: `georef-geo-${layerId}`,
      dragLayer: `georef-drag-${layerId}`,
      edgesLayer: `georef-edges-${layerId}`,
      cornersLayer: `georef-corners-${layerId}`,
    };
    this.bindEvents();
  }

  public syncViewer(overlays: ImageOverlayPayload[], activeEditId?: string) {
    const currentIds = new Set(overlays.map((o) => o.id));

    this.savedOverlays.forEach((old) => {
      if (!currentIds.has(old.id)) {
        try {
          if (this.map.getLayer(`viewer-layer-${old.id}`))
            this.map.removeLayer(`viewer-layer-${old.id}`);
          if (this.map.getSource(`viewer-src-${old.id}`))
            this.map.removeSource(`viewer-src-${old.id}`);
          if (this.map.getLayer(`viewer-hitbox-${old.id}`))
            this.map.removeLayer(`viewer-hitbox-${old.id}`);
          if (this.map.getSource(`viewer-hitbox-src-${old.id}`))
            this.map.removeSource(`viewer-hitbox-src-${old.id}`);
        } catch {
          /* ignore missing layers */
        }
      }
    });

    this.savedOverlays = overlays;

    overlays.forEach((overlay) => {
      const srcId = `viewer-src-${overlay.id}`;
      const layerId = `viewer-layer-${overlay.id}`;
      const hitboxSrcId = `viewer-hitbox-src-${overlay.id}`;
      const hitboxLayerId = `viewer-hitbox-${overlay.id}`;

      const hitboxVisibility = overlay.id === activeEditId ? "none" : "visible";
      const closedCoords = [...overlay.coordinates, overlay.coordinates[0]];

      if (this.map.getSource(srcId)) {
        try {
          this.map.getSource(srcId).setCoordinates(overlay.coordinates);
          if (this.map.getLayer(layerId)) {
            this.map.setPaintProperty(
              layerId,
              "raster-opacity",
              overlay.opacity ?? 1,
            );
            this.map.setLayoutProperty(layerId, "visibility", "visible");
          }
          if (this.map.getSource(hitboxSrcId)) {
            this.map.getSource(hitboxSrcId).setData({
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [closedCoords] },
            });
          }
          if (this.map.getLayer(hitboxLayerId)) {
            this.map.setLayoutProperty(
              hitboxLayerId,
              "visibility",
              hitboxVisibility,
            );
          }
        } catch {
          /* ignore update errors */
        }
      } else {
        try {
          this.map.addSource(srcId, {
            type: "image",
            url: overlay.imageUrl,
            coordinates: overlay.coordinates,
          });
          this.map.addLayer({
            id: layerId,
            type: "raster",
            source: srcId,
            layout: { visibility: "visible" },
            paint: {
              "raster-opacity": overlay.opacity ?? 1,
              "raster-fade-duration": 0,
            },
          });

          this.map.addSource(hitboxSrcId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [closedCoords] },
            },
          });
          this.map.addLayer({
            id: hitboxLayerId,
            type: "fill",
            source: hitboxSrcId,
            layout: { visibility: hitboxVisibility },
            paint: { "fill-opacity": 0 },
          });
        } catch {
          /* ignore creation errors */
        }
      }

      try {
        if (this.map.getLayer(layerId)) this.map.moveLayer(layerId);
        if (this.map.getLayer(hitboxLayerId)) this.map.moveLayer(hitboxLayerId);
      } catch {
        /* ignore layer move errors */
      }
    });

    this.ensureEditorOnTop();
  }

  public syncEditor(
    coords: ImageCoords | null,
    url: string | null,
    opacity: number,
    activeId: string | null,
  ) {
    this.editCoords = coords;
    this.editOpacity = opacity;
    this.activeEditId = activeId;

    if (!coords || !url) {
      this.setEditorVisibility("none");
      return;
    }

    const isNewUnsavedImage = !this.savedOverlays.some(
      (o) => o.id === activeId,
    );

    try {
      if (!this.map.getSource(this.editorIds.src)) {
        this.initEditorLayers(coords, url);
      } else {
        this.map
          .getSource(this.editorIds.geoSrc)
          .setData(this.generateGeoJson(coords));

        if (isNewUnsavedImage) {
          this.map.getSource(this.editorIds.src).setCoordinates(coords);
          this.map.setPaintProperty(
            this.editorIds.layer,
            "raster-opacity",
            opacity,
          );
          this.map.setLayoutProperty(
            this.editorIds.layer,
            "visibility",
            "visible",
          );
        } else {
          this.map.setLayoutProperty(
            this.editorIds.layer,
            "visibility",
            "none",
          );
          if (this.map.getLayer(`viewer-layer-${activeId}`)) {
            this.map.setPaintProperty(
              `viewer-layer-${activeId}`,
              "raster-opacity",
              opacity,
            );
          }
        }
        this.setEditorVisibility("visible", isNewUnsavedImage);
      }
      this.ensureEditorOnTop();
    } catch {
      /* ignore editor sync errors */
    }
  }

  public setAddMode(isAdd: boolean) {
    this.isAddMode = isAdd;
    try {
      this.map.getCanvas().style.cursor = isAdd ? "crosshair" : "";
    } catch {
      /* ignore canvas access errors */
    }
  }

  private setEditorVisibility(
    visibility: "visible" | "none",
    isNewUnsavedImage: boolean = false,
  ) {
    [
      this.editorIds.dragLayer,
      this.editorIds.edgesLayer,
      this.editorIds.cornersLayer,
    ].forEach((id) => {
      try {
        if (this.map.getLayer(id))
          this.map.setLayoutProperty(id, "visibility", visibility);
      } catch {
        /* ignore layout property errors */
      }
    });
    if (!isNewUnsavedImage) {
      try {
        if (this.map.getLayer(this.editorIds.layer))
          this.map.setLayoutProperty(
            this.editorIds.layer,
            "visibility",
            "none",
          );
      } catch {
        /* ignore layout property errors */
      }
    }
  }

  private ensureEditorOnTop() {
    [
      this.editorIds.layer,
      this.editorIds.dragLayer,
      this.editorIds.edgesLayer,
      this.editorIds.cornersLayer,
    ].forEach((id) => {
      try {
        if (this.map.getLayer(id)) this.map.moveLayer(id);
      } catch {
        /* ignore move layer errors */
      }
    });
  }

  private initEditorLayers(coords: ImageCoords, url: string) {
    this.map.addSource(this.editorIds.src, {
      type: "image",
      url,
      coordinates: coords,
    });
    this.map.addLayer({
      id: this.editorIds.layer,
      type: "raster",
      source: this.editorIds.src,
      paint: { "raster-opacity": this.editOpacity, "raster-fade-duration": 0 },
    });

    this.map.addSource(this.editorIds.geoSrc, {
      type: "geojson",
      data: this.generateGeoJson(coords),
    });
    this.map.addLayer({
      id: this.editorIds.dragLayer,
      type: "fill",
      source: this.editorIds.geoSrc,
      filter: ["==", "type", "body"],
      paint: { "fill-color": "#fff", "fill-opacity": 0 },
    });
    this.map.addLayer({
      id: this.editorIds.edgesLayer,
      type: "line",
      source: this.editorIds.geoSrc,
      filter: ["==", "type", "edge"],
      paint: { "line-color": "#3b82f6", "line-width": 4, "line-opacity": 0.5 },
    });
    this.map.addLayer({
      id: this.editorIds.cornersLayer,
      type: "circle",
      source: this.editorIds.geoSrc,
      filter: ["==", "type", "corner"],
      paint: {
        "circle-radius": 8,
        "circle-color": "#3b82f6",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  private generateGeoJson(corners: ImageCoords) {
    const [c0, c1, c2, c3] = corners;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { type: "body" },
          geometry: { type: "Polygon", coordinates: [[c0, c1, c2, c3, c0]] },
        },
        {
          type: "Feature",
          properties: { type: "edge", index: 0 },
          geometry: { type: "LineString", coordinates: [c0, c1] },
        },
        {
          type: "Feature",
          properties: { type: "edge", index: 1 },
          geometry: { type: "LineString", coordinates: [c1, c2] },
        },
        {
          type: "Feature",
          properties: { type: "edge", index: 2 },
          geometry: { type: "LineString", coordinates: [c2, c3] },
        },
        {
          type: "Feature",
          properties: { type: "edge", index: 3 },
          geometry: { type: "LineString", coordinates: [c3, c0] },
        },
        ...corners.map((c, i) => ({
          type: "Feature",
          properties: { type: "corner", index: i },
          geometry: { type: "Point", coordinates: c },
        })),
      ],
    };
  }

  private bindEvents() {
    this.map.on("mousedown", this.handleMouseDown);
    this.map.on("mousemove", this.handleMouseMove);
    this.map.on("mouseup", this.handleMouseUp);
    this.map.on("click", this.handleClick);
  }

  private unbindEvents() {
    this.map.off("mousedown", this.handleMouseDown);
    this.map.off("mousemove", this.handleMouseMove);
    this.map.off("mouseup", this.handleMouseUp);
    this.map.off("click", this.handleClick);
  }

  public destroy() {
    this.unbindEvents();
    try {
      [
        this.editorIds.cornersLayer,
        this.editorIds.edgesLayer,
        this.editorIds.dragLayer,
        this.editorIds.layer,
      ].forEach((id) => {
        if (this.map.getLayer && this.map.getLayer(id))
          this.map.removeLayer(id);
      });
      [this.editorIds.geoSrc, this.editorIds.src].forEach((id) => {
        if (this.map.getSource && this.map.getSource(id))
          this.map.removeSource(id);
      });
    } catch {
      /* ignore destroy errors */
    }
  }

  private handleClick = (e: any) => {
    if (this.isAddMode) {
      this.emit("mapClickForAdd", [e.lngLat.lng, e.lngLat.lat]);
      return;
    }

    if (this.editCoords) {
      const layersToCheck = [
        this.editorIds.cornersLayer,
        this.editorIds.edgesLayer,
        this.editorIds.dragLayer,
      ].filter((id) => {
        try {
          return !!this.map.getLayer(id);
        } catch {
          return false;
        }
      });

      if (layersToCheck.length) {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: layersToCheck,
        });
        if (features.length === 0) this.emit("clickOutside", undefined);
      } else {
        this.emit("clickOutside", undefined);
      }
      return;
    }

    const hitboxLayers = this.savedOverlays
      .map((o) => `viewer-hitbox-${o.id}`)
      .filter((id) => {
        try {
          return !!this.map.getLayer(id);
        } catch {
          return false;
        }
      });

    if (hitboxLayers.length === 0) return;

    const features = this.map.queryRenderedFeatures(e.point, {
      layers: hitboxLayers,
    });
    if (features.length > 0) {
      const id = features[0].layer.id.replace("viewer-hitbox-", "");
      this.emit("editOverlay", id);
    }
  };

  private handleMouseDown = (e: any) => {
    if (!this.editCoords) return;

    const layersToCheck = [
      this.editorIds.cornersLayer,
      this.editorIds.edgesLayer,
      this.editorIds.dragLayer,
    ].filter((id) => {
      try {
        return !!this.map.getLayer(id);
      } catch {
        return false;
      }
    });

    if (!layersToCheck.length) return;
    const features = this.map.queryRenderedFeatures(e.point, {
      layers: layersToCheck,
    });
    if (!features.length) return;

    e.preventDefault();
    this.map.dragPan.disable();
    this.startPoint = { x: e.point.x, y: e.point.y };
    this.startCoords = [...this.editCoords] as ImageCoords;

    const props = features[0].properties;
    if (props.type === "corner") {
      this.draggingCorner = props.index;
      this.map.getCanvas().style.cursor = "grabbing";
    } else if (props.type === "edge") {
      this.draggingEdge = props.index;
      this.map.getCanvas().style.cursor = "grabbing";
    } else if (props.type === "body") {
      this.isDraggingOverlay = true;
      this.map.getCanvas().style.cursor = "move";
    }
  };

  private handleMouseMove = (e: any) => {
    if (!this.editCoords && !this.isAddMode && this.savedOverlays.length > 0) {
      const hitboxLayers = this.savedOverlays
        .map((o) => `viewer-hitbox-${o.id}`)
        .filter((id) => {
          try {
            return !!this.map.getLayer(id);
          } catch {
            return false;
          }
        });

      if (hitboxLayers.length > 0) {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: hitboxLayers,
        });
        const foundId =
          features.length > 0
            ? features[0].layer.id.replace("viewer-hitbox-", "")
            : null;

        if (foundId !== this.hoveredOverlayId) {
          this.hoveredOverlayId = foundId;
          this.map.getCanvas().style.cursor = foundId ? "pointer" : "";
          this.emit("hoverOverlay", foundId);
        }
      } else if (this.hoveredOverlayId !== null) {
        this.hoveredOverlayId = null;
        this.map.getCanvas().style.cursor = "";
        this.emit("hoverOverlay", null);
      }
      return;
    }

    if (
      this.editCoords &&
      this.draggingCorner === null &&
      this.draggingEdge === null &&
      !this.isDraggingOverlay
    ) {
      const layersToCheck = [
        this.editorIds.cornersLayer,
        this.editorIds.edgesLayer,
        this.editorIds.dragLayer,
      ].filter((id) => {
        try {
          return !!this.map.getLayer(id);
        } catch {
          return false;
        }
      });

      if (layersToCheck.length) {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: layersToCheck,
        });
        if (features.length) {
          const type = features[0].properties.type;
          this.map.getCanvas().style.cursor =
            type === "body" ? "move" : "crosshair";
        } else {
          this.map.getCanvas().style.cursor = "";
        }
      }
      return;
    }

    if (!this.startPoint || !this.startCoords) return;

    const deltaX = e.point.x - this.startPoint.x;
    const deltaY = e.point.y - this.startPoint.y;
    let newCorners = [...this.startCoords] as ImageCoords;

    if (this.draggingCorner !== null) {
      newCorners[this.draggingCorner] = [e.lngLat.lng, e.lngLat.lat];
    } else if (this.draggingEdge !== null) {
      const idxA = this.draggingEdge;
      const idxB = (this.draggingEdge + 1) % 4;
      [idxA, idxB].forEach((idx) => {
        const px = this.map.project(this.startCoords![idx]);
        const unpx = this.map.unproject({ x: px.x + deltaX, y: px.y + deltaY });
        newCorners[idx] = [unpx.lng, unpx.lat];
      });
    } else if (this.isDraggingOverlay) {
      newCorners = this.startCoords.map((coord) => {
        const px = this.map.project(coord);
        const unpx = this.map.unproject({ x: px.x + deltaX, y: px.y + deltaY });
        return [unpx.lng, unpx.lat] as [number, number];
      }) as ImageCoords;
    }

    try {
      this.map
        .getSource(this.editorIds.geoSrc)
        .setData(this.generateGeoJson(newCorners));

      if (
        this.activeEditId &&
        this.map.getSource(`viewer-src-${this.activeEditId}`)
      ) {
        this.map
          .getSource(`viewer-src-${this.activeEditId}`)
          .setCoordinates(newCorners);
      } else if (!this.activeEditId && this.map.getSource(this.editorIds.src)) {
        this.map.getSource(this.editorIds.src).setCoordinates(newCorners);
      }
      this.editCoords = newCorners;
    } catch {
      /* ignore set data errors */
    }
  };

  private handleMouseUp = () => {
    if (
      this.draggingCorner !== null ||
      this.draggingEdge !== null ||
      this.isDraggingOverlay
    ) {
      this.map.dragPan.enable();
      const isDistorted =
        this.draggingCorner !== null || this.draggingEdge !== null;

      this.draggingCorner = null;
      this.draggingEdge = null;
      this.isDraggingOverlay = false;
      this.startPoint = null;
      this.map.getCanvas().style.cursor = "";

      if (this.editCoords) {
        this.emit("change", { corners: this.editCoords, isDistorted });
      }
    }
  };
}
