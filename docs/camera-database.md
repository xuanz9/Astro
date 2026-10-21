# Camera capabilities database

All 320 selectable models have a database record with 34 specification slots. A catalog entry is not a completed specification profile. Coverage is reported per camera; no profile is labeled fully verified.

## Files and rebuilding

- `data/camera-models.json`: stable IDs, names, brands, and catalog links. Catalog links do not verify individual specifications.
- `data/camera-fields.json`: field definitions, types, units, and relevance.
- `data/camera-specifications.json`: researched manufacturer claims, with a source and date for each group of values. Separate groups can source different fields for one camera.
- `data/camera-researched-specifications.json`: extracted source-backed facts that passed consistency checks; curated claims take precedence.
- `data/camera-research-status.json`: research coverage and remaining fields for every model, plus extractions held for review.
- `data/camera-research-summary.json`: current aggregate coverage. `docs/camera-research-report.md` gives a readable report.
- `data/cameras.json`: three original sourced geometry profiles, retained for compatibility.
- `data/cameras.sqlite`: generated SQLite database with cameras, fields, specifications, and derived_geometry tables.
- `data/camera-database.json`: generated browser export of the same records.

Run `node scripts/build-camera-database.mjs` after editing source records. The normal app build also regenerates outputs. Do not edit generated outputs directly. Requires Node.js 22.13+ with the built-in SQLite module.

## Evidence rules

Unknown means SQL NULL / JSON null, never zero or false. Manufacturer facts carry per-field URLs and dates. Pixel pitch, sensor area, and diagonal crop factor are explicitly labeled geometric estimates. Effective megapixels are separate from output image pixel count. Only cameras with all four sourced geometry dimensions enter the existing recommendation engine's geometry catalog.

ISO limits are not a quality score or an optimal ISO. Read noise, dynamic range, quantum efficiency, dark current, full-well capacity, and RAW filtering need calibrated evidence including ISO, firmware, readout mode, exposure, and temperature where relevant. Those slots remain unknown until a measurement model with those conditions is implemented. No camera suitability rating is inferred from a marketing specification.

Capabilities vary with firmware, shutter mode, RAW compression, bit depth, and crop. Exposure-mode notes record restrictions when researched. User modifications, lenses, tracking, filters, sky, temperature, and processing belong to individual equipment/session records.

## Current coverage

All 320 models now have at least one source-backed fact. Coverage varies substantially; this is a first research pass rather than 320 complete profiles. See the generated research report for current totals and the per-model status file for missing fields. No specifications or research status are displayed in the product UI.

## Research workflow

`scripts/research-cameras.py` collects conservative manufacturer table facts into a review file, retaining exact source URLs, snapshot hashes, and source-row evidence. `scripts/research-camera-pdfs.py` supplements linked manufacturer PDFs and instruction manuals. Downloaded originals remain in ignored `local-data/research/`; they are not shipped with the app. Python 3 and pypdf are needed for research collection, but not for running the app or rebuilding the database.

After reviewing candidates, run `node scripts/import-camera-research.mjs` and then `node scripts/build-camera-database.mjs`. The importer holds ambiguous dimensions and duplicated PDF text for review. A successful extraction alone does not constitute a complete profile or calibrated performance validation.
