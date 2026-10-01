const cacheComponents = process.env.CACHE_COMPONENTS !== "0";

export default {
  cacheComponents,
  // Separate output folders so the flag-on and flag-off builds can sit side by side.
  distDir: cacheComponents ? ".next" : ".next-off",
  // `export const instant` is only accepted with the flag on, so each mode has its own root layout:
  // app/layout.flag-on.jsx or app/layout.flag-off.jsx. Everything else is shared.
  pageExtensions: [cacheComponents ? "flag-on.jsx" : "flag-off.jsx", "jsx"],
  turbopack: { root: import.meta.dirname },
};
