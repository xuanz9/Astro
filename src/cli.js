import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { cameras, findCamera, validateSession, recommend } from './core.js';
import { extractMetadata } from './metadata.js';
import { recordSession } from './record.js';

const [command, file] = process.argv.slice(2);
const output = value => console.log(JSON.stringify(value, null, 2));
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const store = resolve('local-data/sessions.json');
const history = () => existsSync(store) ? readJson(store) : [];
try {
  if (command === 'cameras') output(cameras);
  else if (command === 'import') {
    if (!file) throw new Error('Provide a photo or metadata file.');
    if (statSync(file).size > 64 * 1024 * 1024) throw new Error('Maximum import size is 64 MiB.');
    const result = extractMetadata(readFileSync(file), extname(file).toLowerCase());
    output({ ...result, matchedCameraId: findCamera(result.fields.cameraModel)?.id ?? null });
  } else if (command === 'save' || command === 'record') {
    const session = command === 'record' ? await recordSession() : validateSession(readJson(file));
    const sessions = history();
    const advice = recommend(session, sessions);
    sessions.push({ ...session, recordedAt: new Date().toISOString(), source: 'user-reported' });
    mkdirSync('local-data', { recursive: true });
    writeFileSync(store, JSON.stringify(sessions, null, 2));
    output({ saved: true, sessionCount: sessions.length, advice });
  } else if (command === 'recommend') output(recommend(readJson(file), history()));
  else if (command === 'demo') {
    const session = readJson(new URL('../examples/session.json', import.meta.url));
    output({ note: 'Synthetic demonstration only. No real photo or real successful session is claimed.', result: recommend(session, [session]) });
  } else console.log('Astro data prototype\n\nnode src/cli.js record\nnode src/cli.js cameras\nnode src/cli.js import photo.jpg\nnode src/cli.js save session.json\nnode src/cli.js recommend session.json\nnode src/cli.js demo');
} catch (error) { console.error(error.message); process.exitCode = 1; }
