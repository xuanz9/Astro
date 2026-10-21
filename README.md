# Astro — personalized astrophotography data prototype

A beginner astrophotography assistant with a React + TypeScript web prototype and a local JavaScript data layer. Requires Node.js 22+.

## Web app

Install dependencies with `pnpm install` (or `npm install`), then run `pnpm dev` (or `npm run dev`). Open the local URL printed in the terminal. `pnpm build` checks TypeScript and creates the production files in `dist/`.

The three-screen preview covers equipment, night planning, and a shooting checklist. Search and select a town to load real Open-Meteo hourly forecasts for the chosen evening through 06:00 the next day. Cloud cover, rain probability, temperature, humidity, and wind use the observing location's timezone. Past hours are excluded; missing values and dates outside the forecast range are identified. Requests go directly from the browser to Open-Meteo; no API key is required for this non-commercial prototype. Review the provider's terms before commercial deployment.

Equipment and practice notes stay in browser storage. Moon calculations, photo import in the web interface, and personalized starting settings are not connected yet. The guide's fixed example settings are explicitly demonstration content. Practice notes are kept separately from the command-line evidence store. Weather does not yet change those settings. Forecast retrieval time is shown; it is not the underlying model-run time. Place attribution: GeoNames via Open-Meteo.

The original command-line data layer still runs without installed packages.

Flickr metadata import is prepared for a local API key. See [Flickr import setup](docs/flickr-import.md). It saves attributed, unreviewed capture settings separately from successful shooting sessions; no live sample has been collected until the key is configured and the importer is run.

## Try it

```sh
node src/cli.js cameras
node src/cli.js demo
node --test
node src/cli.js import path/to/photo.jpg
node src/cli.js record
```

Import supports basic capture EXIF from JPEG and classic TIFF, primary FITS headers, and single-record ExifTool JSON exports. Missing fields remain null. Proprietary RAW, HEIC, compressed FITS, BigTIFF, maker notes, and extended ISO tags are not supported yet. For RAW, export numeric metadata using ExifTool (`exiftool -j -n photo.CR3`) and import that JSON. Files larger than 64 MiB are rejected. Originals are never modified or copied.

The `record` command opens a guided terminal form: select a camera, optionally import a photo, confirm capture details and record the outcome. Alternatively, copy `examples/session.json`, replace the **synthetic** details with your real equipment, conditions and outcome, then run:

```sh
node src/cli.js save my-session.json
node src/cli.js recommend my-session.json
```

Session records are stored in `local-data/sessions.json` (ignored by Git). Imported metadata is printed for review and is not automatically saved as a successful session. GPS, serial numbers and original paths are excluded from extracted fields. Do not add private details in session notes if you intend to share them. The current local store is single-process only.

## Camera catalog

The app has a 320-model SQLite-backed capabilities catalog with 34 fields per model and per-field source tracking. All models have some sourced facts, with uneven coverage; no profile is complete. Specifications stay in background data and are not shown in the UI. See `docs/camera-research-report.md` for current counts and `docs/camera-database.md` for the data workflow. Run `pnpm db:build` to regenerate the SQLite file and browser export.

Three initial Canon models have manufacturer source links and verification dates in `data/cameras.json`. This intentionally small catalog establishes provenance before expansion. Pixel pitch is **estimated**, using full-resolution width and physical sensor width. Photo dimensions are not treated as sensor specifications because photos may be resized or cropped.

For another camera, use its own `cameraId` and add `customCamera` with positive `sensorWidthMm`, `sensorHeightMm`, `widthPixels`, and `heightPixels` to the session. Use a unique camera ID consistently. Enter effective focal length including reducers or Barlows. Geometry assumes full-sensor capture without binning or cropping.

## Recommendation behavior

- Calculates field of view and angular pixel scale from equipment.
- Compares camera ID, target, mount category, filter, modification status, sky-condition label, ISO/gain, and focal length/f-ratio within 10%.
- Only reports exposure ranges from sessions marked good with at least 80% usable frames. These thresholds are prototype heuristics, not research-validated rules.
- Unknown sky conditions do not qualify. No matches means no exposure recommendation. ISO is not inferred from megapixels or transferred between cameras.
- Trailing, clipped highlights and noise produce qualitative test-shot advice, not invented optimal values.
- Self-reported success, duplicate sessions and unmeasured conditions limit the evidence. No automatic image-quality analysis is implemented.

## Sources and next integrations

See `docs/data-sources.md`. Weather is connected through Open-Meteo; a Flickr API metadata importer is available separately. Measured camera-noise curves and live astronomical calculations are not connected. No AstroBin/Flickr scraping or third-party image redistribution is included.

Next product step: camera selector, reviewed photo import and shooting-results form backed by this data layer. Then add more independently sourced camera profiles and weather. No cloud uploads, accounts or deployment are configured.
