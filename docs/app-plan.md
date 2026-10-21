# Beginner astrophotography app — first-version plan

## Purpose

Help a beginner answer: “What can I photograph tonight, and how do I start with the equipment I own?”

Build a responsive web app for planning on a computer and following instructions on a phone. Start with stars and the Milky Way using a camera, lens, and tripod. A star tracker is optional. Deep-sky telescope workflows come later.

## Screen 1: Your equipment

Show a short form:

- Camera model, with a manual entry option if it is missing.
- Lens focal length and widest available aperture, with plain-language examples.
- Tripod or star tracker.
- Optional photo import to review available camera settings.

Explain unfamiliar terms beside the fields. Imported values must be reviewed; missing metadata stays blank. Let the user continue without a photo. Retain equipment locally so returning users can reuse it.

Primary action: **Plan my night**.

## Screen 2: Your night

Ask for a town or approximate location, date, and target: stars or Milky Way. Offer location access only as an optional shortcut.

Display:

- Forecast cloud cover and available relevant weather conditions by time.
- Moon illumination and whether it is above the horizon during the selected period.
- Available darkness and target visibility when astronomical calculations are connected.
- A suggested shooting window with a clear explanation of the factors used.

Every live result needs its source, forecast time, and timezone. If data is unavailable, explain what is missing and allow manual conditions. Do not display sample conditions as a real forecast. Do not claim the Milky Way is visible without calculating its visibility for that location and time.

Primary action: **Show my shooting guide**.

## Screen 3: Settings and guide

Put a compact equipment and night summary above the guidance.

Show shutter speed, aperture, ISO, and focus guidance when there is a supported basis for each. Label suggestions as starting points, explain their basis, and ask for a test shot. Distinguish general guidance from settings observed in comparable photos. Missing evidence should produce an honest explanation and useful next steps.

Use a checklist:

1. Set up the tripod and frame the scene.
2. Choose the suggested camera mode and capture format.
3. Follow a focusing guide with a magnified star check.
4. Take a test exposure.
5. Review star shape and brightness; follow the appropriate adjustment advice.
6. Capture the sequence and save the session result.

Offer result choices such as good, star trails, too bright, noisy, and unsure. Save confirmed settings and the reported result so future comparisons can use real sessions. End with an introductory editing and stacking guide.

Primary actions: **Save my session** and **Adjust after a test shot**.

## Existing foundation

The repository currently contains a local command-line prototype, rather than an Astro-framework website:

- Three camera profiles with source references.
- Basic JPEG/TIFF, FITS, and ExifTool JSON metadata import.
- Equipment geometry calculations.
- Locally stored session records and comparisons with successful similar sessions.

The current recommendation function requires a completed shooting session, including settings and outcome. A pre-shoot planning interface needs a separate input model; it must not invent a successful outcome just to call that function. Camera coverage is currently limited, and external photos, weather, and astronomy calculations are not connected.

## Build order and completion checks

### 1. Clickable screen prototype

Build the three screens with a clear progress indicator, readable forms, and phone-friendly layouts. Use explicitly labeled demonstration data. A beginner can complete the flow without a photo or an account.

### 2. Equipment, import, and session saving

Connect the existing camera catalog and metadata reader through a local server. Review imported values before saving. Add equipment-only planning inputs separately from completed session records. Verify unsupported files, missing fields, unknown cameras, and local persistence.

### 3. Conditions and astronomy

Select and verify weather and astronomical data sources, usage terms, coverage, and costs before integrating them. Add location/date handling, forecast freshness, timezones, and failure states. Keep service credentials on the server. Verify local dates and daylight-saving transitions.

### 4. Starting settings and teaching content

Research and document the basis and limitations of any initial-setting rules before implementation. Connect comparable-session evidence separately. Verify that insufficient data never produces invented recommendations, and that beginners receive a useful test-shot workflow.

### 5. Photo learning and broader equipment support

Start with the user's own reviewed photo metadata. Later, add external examples only through permitted sources with attribution and usable capture metadata. Track equipment, conditions, exposure count, processing, and reported outcomes where available. Explain why a processed or stacked photo cannot guarantee the same result from one exposure.

## Outside the first version

Accounts, social feeds, paid subscriptions, automatic image-quality analysis, automatic camera control, a large public photo library, and advanced deep-sky telescope recommendations.

## First milestone

A beginner can enter their equipment, select a night and target, follow a clearly labeled demonstration guide, and understand how to review a test shot. Live conditions and evidence-backed settings follow as separate milestones.
