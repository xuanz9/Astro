# Light pollution alongside weather

The observing screen samples David Lorenz's modeled 2025 artificial zenith sky brightness atlas at the selected place's coordinates. The map is a long-term baseline, separate from hourly weather, Moon brightness, astronomical darkness, target visibility, and nearby lamps. The geocoder selects a town/place center, which may differ from the actual observing site.

## Source and reuse

- Author and usage guidance: https://djlorenz.github.io/astronomy/lp/
- Original medium-resolution, border-free raster: https://djlorenz.github.io/astronomy/lp2025/world2025_low3.png
- Author's zone scale: https://djlorenz.github.io/astronomy/lp/colors.html

The author discusses using these maps on other sites and asks that they not be conflated with Bortle classes. The UI credits the author and links to the atlas. No CC license or right to relicense is claimed. Review the current author's terms for redistribution or commercial use. The source's light input is 2025 annual satellite data; this is not a measurement taken on the selected night.

## Local data

`public/data/light-pollution-2025.rle` losslessly stores the original indexed map. It does not downsample, infer values from town population, average cells, or substitute satellite ground radiance for sky brightness. Metadata, source-image hash, encoding, coverage, and resolution are in `public/data/light-pollution-2025.json`.

Coverage: 65°S to 75°N, global longitude. Resolution: 1/40 degree (0.025°, approximately 2.8 km north–south; east–west spacing depends on latitude). Rows run north to south and columns west to east. Longitude 180° wraps to -180°. The lower latitude boundary is excluded. The sample uses the containing source grid cell.

The three labels are app-defined qualitative groupings, not scientific classifications or Bortle classes: atlas zones 0–3b are “Dark sky”, 4a–5b “Moderately light-polluted”, and 6a–7b “Heavily light-polluted”. Their purpose is introductory guidance; no exact measured sky brightness or exposure optimization is claimed.

The atlas is served as a local static asset. Coordinate lookup does not call an external light-pollution API. Weather and place search continue to use Open-Meteo. Atlas errors and locations outside coverage produce an unavailable state, not a dark-sky result. Weather remains usable independently.

Users may override the qualitative level for local conditions. Practice notes retain the level, origin (map/manual/unknown), location, and atlas year separately from camera settings and forecast data. Changing location resets the override. Camera exposure recommendations are still demonstration content.

## Nearby dark-sky search

The selected coordinates automatically start a local atlas search within 100 km (50/100/150 km options). Great-circle rings are sampled every 5 km with roughly 5 km spacing around each ring. Up to three dark-group areas are returned, nearest sampled ring first, separated by at least 15 km. Four additional samples 3 km around each candidate must also be dark to reject isolated pixels. This is an approximate sampled search, not an exhaustive nearest-cell or road-route search. A location that is already dark may return other nearby dark areas.

Candidates are coordinates with straight-line distance and compass direction, not named or verified venues. The atlas cannot establish land/water, public access, roads, opening hours, terrain, current weather, or safety. The UI discloses these limits and links to Google Maps for inspection. Clicking “Check weather here” explicitly changes the observing location to that candidate, fetching its own forecast and resetting the previous local light assessment. Merely listing candidates does not send their coordinates externally; opening their map or checking their weather does.
