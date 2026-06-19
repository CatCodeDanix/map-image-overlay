import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      bundleTypes: true,
      outDirs: ["dist/core", "dist/react"],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: {
        "core/index": resolve(__dirname, "src/core/index.ts"),
        "react/index": resolve(__dirname, "src/react/index.ts"),
      },
      name: "MapImageOverlay",
      formats: ["es", "cjs"], // <-- Changed 'umd' to 'cjs'
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "js" : "cjs"}`, // <-- Updated extension output
    },
    rollupOptions: {
      external: ["react", "react-dom", "mapbox-gl", "maplibre-gl"],
      output: {
        globals: {
          react: "React",
          "mapbox-gl": "mapboxgl",
          "maplibre-gl": "maplibregl",
        },
      },
    },
  },
});
