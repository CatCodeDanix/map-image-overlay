export type LngLatTuple = [number, number];
export type ImageCoords = [LngLatTuple, LngLatTuple, LngLatTuple, LngLatTuple];

export interface ImageOverlayPayload {
  id: string;
  type: "image";
  title: string;
  description?: string;
  coordinates: ImageCoords;
  imageUrl: string;
  opacity: number;
}

export interface ImageState {
  file?: File;
  url: string;
  center: LngLatTuple;
  naturalWidth: number;
  naturalHeight: number;
  id?: string;
}

export interface ImageSettings {
  rotation: number;
  opacity: number;
  title: string;
  description: string;
  scale: number;
}

export interface OverlayState {
  isAddMode: boolean;
  activeImage: ImageState | null;
  baseCorners: ImageCoords | [];
  corners: ImageCoords | [];
  settings: ImageSettings;
  isDistorted: boolean;
  isTransforming: boolean;
  isSaving: boolean;
  isDirty: boolean;
}

export interface ControllerEvents {
  change: { corners: ImageCoords; isDistorted: boolean };
  editOverlay: string;
  mapClickForAdd: LngLatTuple;
  hoverOverlay: string | null;
  clickOutside: void;
}

export interface GenericMap {
  on: (
    type: string,
    layerId: string | ((e: any) => void),
    listener?: (e: any) => void,
  ) => void;
  off: (
    type: string,
    layerId: string | ((e: any) => void),
    listener?: (e: any) => void,
  ) => void;
  getSource: (id: string) => any;
  addSource: (id: string, source: any) => void;
  removeSource: (id: string) => void;
  getLayer: (id: string) => any;
  addLayer: (layer: any) => void;
  moveLayer: (id: string, beforeId?: string) => void;
  removeLayer: (id: string) => void;
  setPaintProperty: (layerId: string, name: string, value: any) => void;
  setLayoutProperty: (layerId: string, name: string, value: any) => void;
  queryRenderedFeatures: (
    point: { x: number; y: number },
    options?: { layers?: string[] },
  ) => any[];
  project: (lnglat: [number, number] | LngLatTuple) => { x: number; y: number };
  unproject: (point: [number, number] | { x: number; y: number }) => {
    lng: number;
    lat: number;
  };
  getCanvas: () => HTMLCanvasElement;
  dragPan: { enable: () => void; disable: () => void };
}
