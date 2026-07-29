# Map asset notices

- Protomaps basemap data is an OpenStreetMap-derived database distributed under
  the Open Database License. Display `© OpenStreetMap contributors` and
  retain the ODbL notice with every production release.
- The generated visual style uses `@protomaps/basemaps` 5.7.2. Protomaps style
  designs are CC0; inspect and retain notices for any separately bundled assets.
- Bundle Noto Sans / Noto Sans CJK font files and their OFL license inside each
  production release. Do not point the production style at a public font CDN.
- The checked-in Victoria Park fixture is an OpenStreetMap-derived database
  extract under ODbL. Its source, bounds and hash are recorded beside the asset.
- Production PMTiles and private activity covers are deployment artifacts and
  must not be committed to Git.

References:

- https://docs.protomaps.com/basemaps/downloads
- https://www.openstreetmap.org/copyright
- https://github.com/protomaps/basemaps
