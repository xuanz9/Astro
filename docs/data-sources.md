# Data sources and integration decisions

Reviewed 2026-09-27. Distinguish public reference documentation from permission to bulk import or redistribute data.

| Source | Status | Intended use |
| --- | --- | --- |
| Canon manufacturer specifications | Three catalog records, URLs per record | Sensor dimensions, resolution, estimated pixel pitch |
| User-owned original images | Implemented local import | Capture EXIF / primary FITS header metadata; not quality labels |
| User shooting outcomes | Implemented local JSON record | Success, trailing, clipping, noise, usable-frame counts |
| [Open-Meteo](https://open-meteo.com/en/docs) | Future integration; review service tier and attribution | Forecast clouds, wind, humidity and temperature |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) | Future integration | Sun/Moon/planet observing geometry, not a deep-sky catalog |
| [Photons to Photos](https://www.photonstophotos.net/Charts/RN_e.htm) | Reference only; bulk reuse permission unverified | Measured read noise versus ISO |
| [Flickr API](https://www.flickr.com/services/api/) | Not connected; key/access and usage review needed | Available capture EXIF and attributed examples |
| [AstroBin API announcement](https://app.astrobin.com/forum/topic/207871/astrobin/api-keys) | Not connected | December 2025 announcement suspended new API keys; reopening unconfirmed |

Metadata references: [ExifTool](https://exiftool.org/exiftool_pod2.html), [Siril FITS fields](https://siril.readthedocs.io/en/latest/file-formats/FITS.html).

Preserve provenance, missing values and contradictions. A polished stacked photo is not a ground-truth exposure recommendation. Conditions, optical configuration, filters, camera modifications and processing influence results. Never derive sensor pixel pitch from an exported photo's dimensions alone.
