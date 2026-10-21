import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { cameras, findCamera, validateSession, geometry } from './core.js';
import { extractMetadata } from './metadata.js';

export async function recordSession() {
  const form = createInterface({ input: stdin, output: stdout });
  const ask = async (label, fallback = '') => (await form.question(`${label}${fallback !== '' ? ` [${fallback}]` : ''}: `)).trim() || String(fallback);
  const number = async (label, fallback = '') => Number(await ask(label, fallback));
  try {
    console.log('\nAstro — record a shooting session\nAll details stay on this computer. Press Enter to accept a shown value.\n');
    const file = await ask('Optional photo path (JPEG, TIFF, FITS or metadata JSON)');
    let metadata = {};
    if (file) {
      if (statSync(file).size > 64 * 1024 * 1024) throw new Error('Maximum import size is 64 MiB.');
      metadata = extractMetadata(readFileSync(file), extname(file).toLowerCase()).fields;
      console.log('Read capture metadata. Confirm the values below; missing details need your input.');
    }
    cameras.forEach((camera, i) => console.log(`${i + 1}. ${camera.name}`));
    console.log(`${cameras.length + 1}. Another camera (manual specifications)`);
    const matched = findCamera(metadata.cameraModel);
    const selection = await number('Camera number', matched ? cameras.indexOf(matched) + 1 : '');
    if (!Number.isInteger(selection) || selection < 1 || selection > cameras.length + 1) throw new Error('Choose one of the listed camera numbers.');
    const session = {};
    if (selection === cameras.length + 1) {
      session.cameraId = await ask('Unique camera model name', metadata.cameraModel ?? '');
      session.customCamera = {
        sensorWidthMm: await number('Manufacturer sensor width (mm)'), sensorHeightMm: await number('Manufacturer sensor height (mm)'),
        widthPixels: await number('Full-resolution sensor image width (pixels)'), heightPixels: await number('Full-resolution sensor image height (pixels)')
      };
    } else session.cameraId = cameras[selection - 1].id;
    session.target = await ask('Target, for example M31');
    session.focalLengthMm = await number('Effective focal length (mm)', metadata.focalLengthMm ?? '');
    session.fNumber = await number('F-number', metadata.fNumber ?? '');
    session.mount = await ask('Support: tripod / tracked / guided');
    const modified = await ask('Camera astro-modified? yes / no', 'no');
    if (!['yes','no'].includes(modified)) throw new Error('Answer yes or no for camera modification.');
    session.modified = modified === 'yes';
    session.filter = await ask('Filter name', 'none');
    session.skyCondition = await ask('Sky conditions (reuse a label for comparable conditions)', 'unknown');
    session.exposureSeconds = await number('Exposure per frame (seconds)', metadata.exposureSeconds ?? '');
    const mode = await ask('Sensitivity setting: iso / gain', metadata.gain != null ? 'gain' : 'iso');
    if (!['iso','gain'].includes(mode)) throw new Error('Choose iso or gain.');
    session[mode] = await number(mode === 'iso' ? 'ISO' : 'Camera gain', metadata[mode] ?? '');
    session.frames = await number('Frames captured');
    session.outcome = { result: await ask('Result: good / trailing / clipped / noisy / unknown', 'unknown'), usableFrames: await number('Usable frames') };
    validateSession(session);
    geometry(findCamera(session.cameraId) ?? session.customCamera, session.focalLengthMm);
    return session;
  } finally { form.close(); }
}
