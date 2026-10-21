# Flickr metadata sample

The local importer searches public Flickr photos and saves available capture settings as unreviewed reference records. It does not download images or change the web UI or recommendation engine.

Create `.env` at the project root with `FLICKR_API_KEY=your-key` (do not share this file). Both `.env` and `local-data/` are ignored by Git. The key belongs only in this local environment, never in a VITE_ variable or browser bundle. Node 22+ can load it directly:

```powershell
node --env-file=.env scripts/import-flickr.mjs "milky way" 25
```

If the key is already an environment variable, omit `--env-file=.env`. No Flickr secret or account access token is needed for these public methods. Do not use credentials from other websites or API examples.

Each run writes a separate timestamped file in `local-data/flickr/`. The sample inspects at most 25 photos by default (configurable 1–100), so fewer records may be retained. Requests are sequential with a 500 ms pause and a 20-second timeout. Private/removed photos, hidden EXIF and empty metadata are skipped. Connection or service errors stop the run before writing a partial dataset; previous samples remain unchanged.

Stored fields: photo ID, title, photographer, source-page link, license and retrieval timestamp; available camera make/model, lens, focal length, f-number, shutter duration and ISO. Only this EXIF whitelist is retained; GPS, serial numbers and full metadata payloads are discarded. Missing fields remain null. Search results can be irrelevant, EXIF can be edited or describe one component of a composite, and frame counts, tracker use, conditions and image quality cannot be established from basic EXIF. All records require review and never become successful-session evidence automatically.

Initial search is limited to Flickr license IDs 4 (CC BY), 9 (CC0), and 10 (public-domain mark), using the license names and URLs returned by Flickr. This does not independently verify the uploader's rights. Respect each work's attribution and license when using it. Keep original photo-page links. Flickr's API availability and terms still apply; commercial use requires arrangement with Flickr.

Official references:
- https://www.flickr.com/services/developer/api/
- https://www.flickr.com/services/api/flickr.photos.search.html
- https://www.flickr.com/services/api/flickr.photos.getExif.html
- https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html
- https://www.flickr.com/services/api/tos/
