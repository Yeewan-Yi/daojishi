# Third-party components

- Three.js 0.186.1 — Copyright 2010–2026 Three.js Authors. MIT license; the complete license is in `vendor/THREE-LICENSE`. The local ES module was bundled and minified from the official npm package using esbuild. https://threejs.org/
- Natural Earth 1:110m land polygons — public domain. `land.geojson` is the unmodified `geojson/ne_110m_land.geojson` from the Natural Earth vector repository: https://github.com/nvkelso/natural-earth-vector . Terms: https://www.naturalearthdata.com/about/terms-of-use/

All production rendering resources are served from this site's own origin. No third-party script or map service is contacted by the 3D scene at runtime.
