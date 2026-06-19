import { useEffect, useRef, useReducer, useCallback, useState } from "react";
import { ImageOverlayController } from "../core/ImageOverlayController";
import {
  calculateCentroid,
  scaleCorners,
  rotateExistingCorners,
} from "../utils/geometry";
import type {
  GenericMap,
  ImageOverlayPayload,
  ImageState,
  OverlayState,
  ImageCoords,
  LngLatTuple,
  ImageSettings,
} from "../core/types";

type OverlayAction =
  | { type: "SET_ADD_MODE"; payload: boolean }
  | {
      type: "IMAGE_SELECTED";
      payload: {
        image: ImageState;
        corners: ImageCoords;
        settings: ImageSettings;
        isDirty?: boolean;
      };
    }
  | { type: "SET_METADATA"; key: "title" | "description"; value: string }
  | { type: "SET_OPACITY"; payload: number }
  | { type: "SET_SCALE"; scale: number; corners: ImageCoords }
  | { type: "BAKE_SCALE" }
  | {
      type: "SET_ROTATION";
      rotation: number;
      corners: ImageCoords;
      baseCorners: ImageCoords;
    }
  | {
      type: "CORNERS_DRAGGED";
      corners: ImageCoords;
      center: LngLatTuple;
      isDistorted: boolean;
    }
  | { type: "MARK_SAVED"; id: string }
  | { type: "CLOSE_EDITOR" };

const initialState: OverlayState = {
  isAddMode: false,
  activeImage: null,
  baseCorners: [],
  corners: [],
  settings: {
    rotation: 0,
    opacity: 0.8,
    scale: 100,
    title: "",
    description: "",
  },
  isDistorted: false,
  isTransforming: false,
  isSaving: false,
  isDirty: false,
};

function overlayReducer(
  state: OverlayState,
  action: OverlayAction,
): OverlayState {
  switch (action.type) {
    case "SET_ADD_MODE":
      return { ...state, isAddMode: action.payload };
    case "IMAGE_SELECTED":
      return {
        ...state,
        isAddMode: false,
        activeImage: action.payload.image,
        corners: action.payload.corners,
        baseCorners: action.payload.corners,
        settings: action.payload.settings,
        isDistorted: false,
        isDirty: action.payload.isDirty ?? false,
      };
    case "SET_METADATA":
      return {
        ...state,
        settings: { ...state.settings, [action.key]: action.value },
        isDirty: true,
      };
    case "SET_OPACITY":
      return {
        ...state,
        settings: { ...state.settings, opacity: action.payload },
        isDirty: true,
      };
    case "SET_SCALE":
      return {
        ...state,
        settings: { ...state.settings, scale: action.scale },
        corners: action.corners,
        isDirty: true,
      };
    case "BAKE_SCALE":
      return {
        ...state,
        baseCorners: state.corners,
        settings: { ...state.settings, scale: 100 },
        isDirty: true,
      };
    case "SET_ROTATION":
      return {
        ...state,
        settings: { ...state.settings, rotation: action.rotation },
        corners: action.corners,
        baseCorners: action.baseCorners,
        isDirty: true,
      };
    case "CORNERS_DRAGGED":
      return {
        ...state,
        corners: action.corners,
        baseCorners: action.corners,
        activeImage: state.activeImage
          ? { ...state.activeImage, center: action.center }
          : null,
        settings: { ...state.settings, scale: 100 },
        isDistorted: state.isDistorted || action.isDistorted,
        isDirty: true,
      };
    case "MARK_SAVED":
      return {
        ...state,
        isDirty: false,
        activeImage: state.activeImage
          ? { ...state.activeImage, id: action.id }
          : null,
      };
    case "CLOSE_EDITOR":
      return { ...initialState };
    default:
      return state;
  }
}

export function useGeorefManager(
  mapInstance: GenericMap | null,
  instanceId: string,
) {
  const engineRef = useRef<ImageOverlayController | null>(null);
  const [overlays, setOverlays] = useState<ImageOverlayPayload[]>([]);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const [state, dispatch] = useReducer(overlayReducer, initialState);

  const overlaysRef = useRef(overlays);
  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  const mountNewImage = useCallback(
    (lngLat: LngLatTuple, fileUrl: string) => {
      if (!mapInstance) return;
      const px = mapInstance.project(lngLat);
      const hw = 100,
        hh = 100;
      const c0 = mapInstance.unproject({ x: px.x - hw, y: px.y - hh });
      const c1 = mapInstance.unproject({ x: px.x + hw, y: px.y - hh });
      const c2 = mapInstance.unproject({ x: px.x + hw, y: px.y + hh });
      const c3 = mapInstance.unproject({ x: px.x - hw, y: px.y + hh });
      const corners: ImageCoords = [
        [c0.lng, c0.lat],
        [c1.lng, c1.lat],
        [c2.lng, c2.lat],
        [c3.lng, c3.lat],
      ];

      dispatch({
        type: "IMAGE_SELECTED",
        payload: {
          image: {
            url: fileUrl,
            center: lngLat,
            naturalWidth: 500,
            naturalHeight: 500,
          },
          corners,
          settings: {
            rotation: 0,
            opacity: 0.8,
            scale: 100,
            title: "New Image",
            description: "",
          },
          isDirty: true,
        },
      });
    },
    [mapInstance],
  );

  const editOverlay = useCallback(
    (id: string) => {
      const target = overlaysRef.current.find((o) => o.id === id);
      if (!target || !mapInstance) return;
      const center = calculateCentroid(mapInstance, target.coordinates);
      dispatch({
        type: "IMAGE_SELECTED",
        payload: {
          image: {
            url: target.imageUrl,
            center,
            naturalWidth: 500,
            naturalHeight: 500,
            id: target.id,
          },
          corners: target.coordinates,
          settings: {
            opacity: target.opacity ?? 1,
            rotation: 0,
            scale: 100,
            title: target.title,
            description: target.description || "",
          },
          isDirty: false,
        },
      });
    },
    [mapInstance],
  );

  const saveOverlay = useCallback(() => {
    if (!state.activeImage || !state.settings.title.trim()) return;
    const id = state.activeImage.id || Math.random().toString(36).substring(7);
    const payload: ImageOverlayPayload = {
      id,
      type: "image",
      title: state.settings.title,
      description: state.settings.description,
      coordinates: state.corners as ImageCoords,
      imageUrl: state.activeImage.url,
      opacity: state.settings.opacity,
    };

    setOverlays((prev) => {
      const exists = prev.find((o) => o.id === id);
      return exists
        ? prev.map((o) => (o.id === id ? payload : o))
        : [...prev, payload];
    });

    dispatch({ type: "MARK_SAVED", id });
  }, [state]);

  const closeEditor = useCallback(() => {
    dispatch({ type: "CLOSE_EDITOR" });
  }, []);

  const autoSaveOrClose = useCallback(() => {
    if (state.isDirty && state.settings.title.trim()) {
      saveOverlay();
    }
    closeEditor();
  }, [state.isDirty, state.settings.title, saveOverlay, closeEditor]);

  const latestAutoSave = useRef(autoSaveOrClose);
  useEffect(() => {
    latestAutoSave.current = autoSaveOrClose;
  }, [autoSaveOrClose]);

  useEffect(() => {
    if (!mapInstance) return;
    const controller = new ImageOverlayController(mapInstance, instanceId);
    engineRef.current = controller;

    controller.on("change", ({ corners, isDistorted }) => {
      const center = calculateCentroid(mapInstance, corners);
      dispatch({ type: "CORNERS_DRAGGED", corners, center, isDistorted });
    });

    controller.on("editOverlay", (id: string) => editOverlay(id));
    controller.on("mapClickForAdd", (lngLat: LngLatTuple) =>
      mountNewImage(
        lngLat,
        "https://docs.mapbox.com/mapbox-gl-js/assets/radar.gif",
      ),
    );
    controller.on("hoverOverlay", (id: string | null) =>
      setHoveredOverlayId(id),
    );
    controller.on("clickOutside", () => latestAutoSave.current());

    return () => {
      controller.destroy();
      engineRef.current = null;
    };
  }, [mapInstance, instanceId, mountNewImage, editOverlay]);

  useEffect(() => {
    engineRef.current?.syncViewer(overlays, state.activeImage?.id);
  }, [overlays, state.activeImage?.id]);

  useEffect(() => {
    if (engineRef.current) {
      if (state.activeImage)
        engineRef.current.syncEditor(
          state.corners as ImageCoords,
          state.activeImage.url,
          state.settings.opacity,
          state.activeImage.id || null,
        );
      else engineRef.current.syncEditor(null, null, 1, null);
      engineRef.current.setAddMode(state.isAddMode);
    }
  }, [
    state.activeImage,
    state.corners,
    state.settings.opacity,
    state.isAddMode,
  ]);

  const handleScale = useCallback(
    (scale: number) => {
      if (!mapInstance || !state.baseCorners.length) return;
      const centroid = calculateCentroid(
        mapInstance,
        state.baseCorners as ImageCoords,
      );
      const scaled = scaleCorners(
        state.baseCorners as ImageCoords,
        centroid,
        scale / 100,
      );
      dispatch({ type: "SET_SCALE", scale, corners: scaled });
    },
    [mapInstance, state.baseCorners],
  );

  const handleRotation = useCallback(
    (rotation: number) => {
      if (!mapInstance || !state.corners.length) return;
      const delta = rotation - state.settings.rotation;
      const centroid = calculateCentroid(
        mapInstance,
        state.corners as ImageCoords,
      );
      const newCorners = rotateExistingCorners(
        mapInstance,
        state.corners as ImageCoords,
        centroid,
        delta,
      ) as ImageCoords;
      const newBase = rotateExistingCorners(
        mapInstance,
        state.baseCorners as ImageCoords,
        centroid,
        delta,
      ) as ImageCoords;
      dispatch({
        type: "SET_ROTATION",
        rotation,
        corners: newCorners,
        baseCorners: newBase,
      });
    },
    [mapInstance, state.corners, state.baseCorners, state.settings.rotation],
  );

  const editCorner = useCallback(
    ({ index, axis, value }: { index: number; axis: 0 | 1; value: number }) => {
      if (!mapInstance || isNaN(value) || state.corners.length !== 4) return;
      const newCorners = [...state.corners] as ImageCoords;
      newCorners[index] = [...newCorners[index]] as LngLatTuple;
      newCorners[index][axis] = value;
      const centroid = calculateCentroid(mapInstance, newCorners);
      dispatch({
        type: "CORNERS_DRAGGED",
        corners: newCorners,
        center: centroid,
        isDistorted: true,
      });
    },
    [mapInstance, state.corners],
  );

  const deleteOverlay = useCallback(
    (id: string) => {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      closeEditor();
    },
    [closeEditor],
  );

  const reorder = useCallback(
    (id: string, dir: "front" | "back") => {
      setOverlays((prev) => {
        const idx = prev.findIndex((o) => o.id === id);
        if (idx === -1) return prev;
        const arr = [...prev];
        if (state.activeImage && state.activeImage.id === id) {
          arr[idx] = {
            ...arr[idx],
            coordinates: state.corners as ImageCoords,
            opacity: state.settings.opacity,
          };
        }
        const [item] = arr.splice(idx, 1);
        dir === "front" ? arr.push(item) : arr.unshift(item);
        return arr;
      });
    },
    [state.activeImage, state.corners, state.settings.opacity],
  );

  return {
    overlays,
    editorState: state,
    hoveredOverlayId,
    actions: {
      setOpacity: (val: number) =>
        dispatch({ type: "SET_OPACITY", payload: val }),
      setRotation: handleRotation,
      setScale: handleScale,
      bakeScale: () => dispatch({ type: "BAKE_SCALE" }),
      updateMetadata: (key: "title" | "description", val: string) =>
        dispatch({ type: "SET_METADATA", key, value: val }),
      setAddMode: (val: boolean) =>
        dispatch({ type: "SET_ADD_MODE", payload: val }),
      editCorner,
      saveOverlay,
      deleteOverlay,
      reorder,
      mountNewImage,
      editOverlay,
      closeEditor,
    },
  };
}
