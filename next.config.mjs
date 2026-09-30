const cacheComponents = process.env.CACHE_COMPONENTS !== "0";

export default {
  cacheComponents,
  // Separate output folders so the flag-on and flag-off builds can sit side by side.
  distDir: cacheComponents ? ".next" : ".next-off",
  turbopack: { root: import.meta.dirname },
};
