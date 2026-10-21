import { readFileSync } from 'node:fs';
import { buildCameraRecords } from './camera-database.js';

const originalCameras = JSON.parse(readFileSync(new URL('../data/cameras.json', import.meta.url)));
export const cameras = buildCameraRecords().filter(c => ['sensorWidthMm','sensorHeightMm','widthPixels','heightPixels'].every(k => c.specifications[k].value !== null)).sort((a,b) => {
  const ai = originalCameras.findIndex(c => c.id === a.id), bi = originalCameras.findIndex(c => c.id === b.id);
  return (ai < 0 ? originalCameras.length : ai) - (bi < 0 ? originalCameras.length : bi);
}).map(c => ({
  id:c.id, name:c.name, aliases:originalCameras.find(old => old.id === c.id)?.aliases ?? [],
  ...Object.fromEntries(['sensorWidthMm','sensorHeightMm','widthPixels','heightPixels'].map(k => [k,c.specifications[k].value])),
}));
export function findCamera(value) {
  const key = String(value || '').trim().toLowerCase();
  return cameras.find(c => [c.id, c.name, ...c.aliases].some(n => n.toLowerCase() === key)) ?? null;
}
function positive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${field} must be a positive number.`);
}
export function geometry(camera, focalLengthMm) {
  positive(focalLengthMm, 'focalLengthMm');
  for (const k of ['sensorWidthMm', 'sensorHeightMm', 'widthPixels', 'heightPixels']) positive(camera[k], k);
  const pixelSizeUm = camera.sensorWidthMm * 1000 / camera.widthPixels;
  return {
    pixelSizeUm: +pixelSizeUm.toFixed(3),
    pixelSizeBasis: 'Estimated from sensor width / full-resolution image width; not a measured pixel pitch.',
    imageScaleArcsecPerPixel: +(206.265 * pixelSizeUm / focalLengthMm).toFixed(3),
    fieldWidthDeg: +(2 * Math.atan(camera.sensorWidthMm / (2 * focalLengthMm)) * 180 / Math.PI).toFixed(3),
    fieldHeightDeg: +(2 * Math.atan(camera.sensorHeightMm / (2 * focalLengthMm)) * 180 / Math.PI).toFixed(3)
  };
}
export function validateSession(s) {
  for (const key of ['cameraId', 'target', 'filter', 'mount', 'skyCondition']) {
    if (typeof s[key] !== 'string' || !s[key].trim()) throw new Error(`${key} is required.`);
  }
  if (!['tripod', 'tracked', 'guided'].includes(s.mount)) throw new Error('mount must be tripod, tracked, or guided.');
  for (const key of ['focalLengthMm', 'fNumber', 'exposureSeconds', 'frames']) positive(s[key], key);
  if (!Number.isInteger(s.frames)) throw new Error('frames must be an integer.');
  if (typeof s.modified !== 'boolean') throw new Error('modified must be true or false.');
  if (s.iso != null) positive(s.iso, 'iso');
  if (s.gain != null && (typeof s.gain !== 'number' || !Number.isFinite(s.gain) || s.gain < 0)) throw new Error('gain must be a non-negative number.');
  if (s.iso == null && s.gain == null) throw new Error('Provide iso or gain.');
  if (!s.outcome || !['good', 'trailing', 'clipped', 'noisy', 'unknown'].includes(s.outcome.result)) throw new Error('Provide outcome.result: good, trailing, clipped, noisy, or unknown.');
  const n = s.outcome.usableFrames;
  if (!Number.isInteger(n) || n < 0 || n > s.frames) throw new Error('usableFrames must be between zero and frames.');
  return s;
}
export function recommend(profile, sessions = []) {
  validateSession(profile);
  const camera = findCamera(profile.cameraId) ?? profile.customCamera;
  if (!camera) throw new Error('Unknown camera. Supply customCamera sensor dimensions and resolution.');
  sessions.forEach(validateSession);
  const comparable = sessions.filter(s =>
    s.cameraId === profile.cameraId && s.target.trim().toLowerCase() === profile.target.trim().toLowerCase() &&
    s.mount === profile.mount && s.filter.toLowerCase() === profile.filter.toLowerCase() &&
    s.modified === profile.modified && s.skyCondition !== 'unknown' && s.skyCondition === profile.skyCondition &&
    Math.abs(s.focalLengthMm / profile.focalLengthMm - 1) <= 0.1 &&
    Math.abs(s.fNumber / profile.fNumber - 1) <= 0.1 &&
    s.iso === profile.iso && s.gain === profile.gain);
  const good = comparable.filter(s => s.outcome.result === 'good' && s.outcome.usableFrames / s.frames >= 0.8);
  const guidance = [];
  if (profile.outcome.result === 'trailing') guidance.push('Try a shorter test exposure and check focus, polar alignment, and tracking. The cause is not determined from metadata.');
  if (profile.outcome.result === 'clipped') guidance.push('Try a shorter test exposure and inspect the original image histogram for clipped highlights.');
  if (profile.outcome.result === 'noisy') guidance.push('Check focus, calibration, and sky conditions; consider collecting more usable frames. Noise alone does not identify the right ISO.');
  if (!good.length) guidance.push('No successful comparable sessions yet. Save a test session before using exposure settings as evidence.');
  else guidance.push('The exposure range below was reported in comparable successful sessions. Test it; it is not an optimized setting.');
  return {
    geometry: geometry(camera, profile.focalLengthMm),
    matchingSuccessfulSessions: good.length,
    confidence: good.length ? 'experimental — self-reported outcomes, not calibrated image quality' : 'insufficient evidence',
    observedExposureSeconds: good.length ? { min: Math.min(...good.map(s => s.exposureSeconds)), max: Math.max(...good.map(s => s.exposureSeconds)) } : null,
    guidance,
    limitations: ['No weather, moon, seeing, or calibrated sky-brightness correction.', 'Same mount category does not guarantee equivalent tracking performance.', 'Full-sensor geometry assumes no crop, binning, or focal reducer beyond the entered effective focal length.']
  };
}
