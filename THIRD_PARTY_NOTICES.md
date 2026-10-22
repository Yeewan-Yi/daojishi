# Third-party components

- Three.js 0.186.1 — Copyright 2010–2026 Three.js Authors. MIT license; the complete license is in `vendor/THREE-LICENSE`. The local ES module was bundled and minified from the official npm package using esbuild. https://threejs.org/
- Natural Earth 1:110m land polygons — public domain. `land.geojson` is the unmodified `geojson/ne_110m_land.geojson` from the Natural Earth vector repository: https://github.com/nvkelso/natural-earth-vector . Terms: https://www.naturalearthdata.com/about/terms-of-use/
- Libre Baskerville and IBM Plex Mono — SIL Open Font License 1.1. Numeric WOFF2 subsets downloaded from the official Google Fonts CSS API are embedded in `fonts.css` and served from this site. Complete copyright notices and licenses are in `vendor/FONT-LICENSES.txt`. Sources: https://github.com/google/fonts/tree/main/ofl/librebaskerville and https://github.com/google/fonts/tree/main/ofl/ibmplexmono .
- 方正宋刻本秀楷简体 / FZSongKeBenXiuKaiS-R-GB — supplied by the project owner. `vendor/FZSongKeBenXiuKaiS.woff2` is a WOFF2 conversion preserving the original font's glyph coverage and metadata. This font is not covered by the open-source licenses above. Typeface information: https://www.foundertype.com/index.php/FontInfo/index/id/6139.html .

All production rendering resources are served from this site's own origin. No third-party script or map service is contacted by the 3D scene at runtime.

- City administrative areas in `visited-cities.geojson` — Alibaba Cloud DataV GeoAtlas, Nanjing (320100) and Shaoxing (330600), retrieved 2026-10-22. Sources: https://geo.datav.aliyun.com/areas_v3/bound/320100.json and https://geo.datav.aliyun.com/areas_v3/bound/330600.json . Used for illustrative shared-travel area highlights, not surveying or navigation. The local copy retains complete city polygons and omits unused metadata. GeoAtlas: https://datav.aliyun.com/portal/school/atlas/area_selector .
