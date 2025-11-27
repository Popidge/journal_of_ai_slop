import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ViteImageOptimizer({
      includePublic: true,
      cache: true,
      cacheLocation: ".vite-image-cache",
      logStats: true,
      ansiColors: true,
      svg: {
        multipass: true,
        js2svg: { indent: 2, pretty: true },
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                cleanupNumericValues: false,
                removeViewBox: false,
                convertPathData: false,
              },
              cleanupIDs: {
                minify: false,
                remove: false,
              },
            },
          },
          "sortAttrs",
          {
            name: "addAttributesToSVGElement",
            params: {
              attributes: [{ xmlns: "http://www.w3.org/2000/svg" }],
            },
          },
        ],
      },
      png: {
        quality: 85,
        compressionLevel: 8,
        palette: true,
        effort: 7,
      },
      jpeg: {
        quality: 85,
        progressive: true,
        chromaSubsampling: "4:4:4",
      },
      webp: {
        quality: 90,
        lossless: true,
      },
      avif: {
        quality: 90,
        lossless: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
