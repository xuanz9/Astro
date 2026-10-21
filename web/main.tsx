import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import cameras from '../data/cameras.json';
import { cameraOptions, cameraBrands } from './camera-catalog';
import './style.css';
import { WeatherPlanner, type PollutionAssessment } from './WeatherPlanner';

type Equipment = { camera: string; brand?: string; custom: string; focal: number; aperture: number; mount: string };
const initial: Equipment = { camera: cameras[0].id, custom: '', focal: 18, aperture: 3.5, mount: 'Tripod' };
function readGear(): Equipment {
  try { const v = JSON.parse(localStorage.getItem('astro-gear') || 'null');
    if (v && (cameraOptions.some(c => c.id === v.camera) || (v.camera === 'custom' && typeof v.custom === 'string' && v.custom.trim())) && Number.isFinite(v.focal) && v.focal > 0 && Number.isFinite(v.aperture) && v.aperture > 0 && ['Tripod', 'Star tracker'].includes(v.mount)) return v;
  } catch { /* A fresh form remains available if storage is unavailable. */ }
  return initial;
}
const lessons = [
  ['Set up & compose', 'Place your tripod on firm ground. Frame an open patch of sky with something interesting in the foreground. Keep the camera steady throughout the exposure.'],
  ['Find your focus', 'Switch to manual focus. Magnify a bright star in live view and adjust until it looks as small and sharp as possible. Do not rely on the infinity mark alone.'],
  ['Take a test shot', 'Use manual exposure mode and RAW if available. The values shown here are demonstration values only. A researched settings engine is still to come.'],
  ['Check & adjust', 'Magnify the photo. If stars are streaked, try a shorter exposure. If the scene is too bright, reduce exposure. Recheck focus before judging noise.'],
  ['Capture & learn', 'Take several consistent frames. Keep the originals for editing or stacking later, and write down what worked for your next night.'],
];
function App() {
  const [step, setStep] = useState(0);
  const [gear, setGear] = useState<Equipment>(readGear);
  const [place, setPlace] = useState('');
  const [lightPollution,setLightPollution]=useState<PollutionAssessment|null>(null);
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [target, setTarget] = useState('Stars & constellations');
  const [checked, setChecked] = useState<number[]>([]);
  const [outcome, setOutcome] = useState('Unsure');
  const [message, setMessage] = useState('');
  const selectedCamera = cameraOptions.find(c => c.id === gear.camera);
  const brand = selectedCamera?.brand || gear.brand || 'Other';
  const brandModels = cameraOptions.filter(c => c.brand === brand);
  const cameraName = selectedCamera?.name || gear.custom || 'Your camera';
  function saveGear() { try { localStorage.setItem('astro-gear', JSON.stringify(gear)); } catch { setMessage('Your browser could not save equipment. You can still continue.'); } setStep(1); }
  function saveSession() {
    try { const raw: unknown = JSON.parse(localStorage.getItem('astro-practice') || '[]'); const entries = Array.isArray(raw) ? raw : [];
      localStorage.setItem('astro-practice', JSON.stringify([...entries, { equipment: gear, place, date, target, lightPollution, outcome, completedSteps: checked, demonstration: true, savedAt: new Date().toISOString() }]));
      setMessage('Practice notes saved in this browser. Demonstration values are excluded from recommendation evidence.');
    } catch { setMessage('Your browser could not save these notes. Please check its storage settings.'); }
  }
  return <div className="app">
    <header><a className="brand" href="#" onClick={e => { e.preventDefault(); setStep(0); }}><span className="brand-icon">✦</span> astro<span className="brand-dot">.</span></a><span className="header-note">A little guidance. A whole sky of possibilities.</span><span className="pill">EARLY PREVIEW</span></header>
    <main><div className="intro"><div className="eyebrow">YOUR NEXT ADVENTURE STARTS AFTER DARK</div><h1>Your first night<br/>under the <em>stars.</em></h1><p>You bring the camera. We’ll help you take the first step.</p></div>
    <nav className="steps" aria-label="Planning progress">{['Your equipment', 'Your night', 'Your guide'].map((name, i) => <button key={name} className={step === i ? 'active' : ''} disabled={i > step} onClick={() => { setStep(i); setMessage(''); }} aria-current={step === i ? 'step' : undefined}><span>{step > i ? '✓' : `0${i+1}`}</span>{name}</button>)}</nav>
    <div className="workspace"><section className="panel">
      <div className="section-label">STEP 0{step+1} OF 03</div><h2>{['Let’s meet your camera.', 'Make a little room for the night.', 'A small step. Your first stars.'][step]}</h2><p className="muted">{['Great photos start with the gear you already have.', 'Choose where, when, and what you’d like to photograph.', 'Take your time. A test shot is part of the process.'][step]}</p>
      {step === 0 && <form onSubmit={e => { e.preventDefault(); saveGear(); }}>
        <label>Camera brand<select value={brand} onChange={e => { const nextBrand = e.target.value; setGear({...gear, brand: nextBrand, camera: cameraOptions.find(c => c.brand === nextBrand)?.id || 'custom', custom: ''}); }}>{cameraBrands.map(b => <option key={b}>{b}</option>)}<option>Other</option></select></label>
        <label>Camera model<select value={gear.camera} onChange={e => setGear({...gear, brand, camera: e.target.value, custom: ''})}>{brandModels.map(c => <option key={c.id} value={c.id}>{c.model}</option>)}<option value="custom">My camera isn’t listed</option></select></label>
        {gear.camera === 'custom' && <label>Your camera name<input required value={gear.custom} onChange={e => setGear({...gear, custom: e.target.value})} placeholder="e.g. Nikon D5300"/><small>We’ll save the name. Camera-specific calculations are not available yet.</small></label>}
        <div className="fields"><label>Lens focal length <span>mm</span><input required type="number" min="1" max="2000" value={gear.focal || ''} onChange={e => setGear({...gear, focal: Number(e.target.value)})}/><small>Look for a number like 18mm on your lens.</small></label><label>Widest aperture <span>f/</span><input required type="number" min="0.7" max="64" step="0.1" value={gear.aperture || ''} onChange={e => setGear({...gear, aperture: Number(e.target.value)})}/><small>The lowest f-number your lens allows.</small></label></div>
        <fieldset><legend>What’s holding your camera?</legend><div className="choices">{['Tripod', 'Star tracker'].map(m => <label className={gear.mount === m ? 'choice selected' : 'choice'} key={m}><input type="radio" name="mount" value={m} checked={gear.mount === m} onChange={() => setGear({...gear, mount:m})}/><strong>{m === 'Tripod' ? '△' : '✧'} {m}</strong><small>{m === 'Tripod' ? 'A steady place to start' : 'Follows the moving sky'}</small></label>)}</div></fieldset>
        <div className="hint">✧ <div><strong>You don’t need fancy equipment.</strong><p>A camera, a wide lens, and a sturdy tripod are a lovely place to begin.</p></div></div>
        <footer><span>Saved on this device</span><button className="primary" type="submit">Plan my night <b>→</b></button></footer>
      </form>}
      {step === 1 && <form onSubmit={e => { e.preventDefault(); setStep(2); setMessage(''); }}><label>Your night<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label>What would you like to photograph?<select value={target} onChange={e => setTarget(e.target.value)}><option>Stars & constellations</option><option>Milky Way</option></select></label><WeatherPlanner date={date} onPlace={setPlace} onPollution={setLightPollution}/><footer><button type="button" className="back" onClick={() => setStep(0)}>← Equipment</button><button className="primary">Show my guide →</button></footer></form>}
      {step === 2 && <div><div className="notice"><strong>Example settings — not a recommendation</strong><p>These fixed values demonstrate the guide layout. They have not been calculated for your equipment or conditions.</p></div><div className="settings">{[['Shutter','10 sec'],['Aperture','f/2.8'],['ISO','1600']].map(([k,v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div><div className="checklist">{lessons.map(([title, body], i) => <label key={title} className={checked.includes(i) ? 'done lesson' : 'lesson'}><input type="checkbox" checked={checked.includes(i)} onChange={() => setChecked(checked.includes(i) ? checked.filter(n => n !== i) : [...checked,i])}/><div><strong>{title}</strong><p>{body}</p></div></label>)}</div><label>How did your test shot look?<select value={outcome} onChange={e => setOutcome(e.target.value)}>{['Unsure','Good','Star trails','Too bright','Noisy'].map(v => <option key={v}>{v}</option>)}</select></label><footer><button className="back" onClick={() => setStep(1)}>← Your night</button><button className="primary" onClick={saveSession}>Save practice notes →</button></footer></div>}
      {message && <p className="status" role="status">{message}</p>}
    </section><aside><div className="sky-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="star star-one">✦</div><div className="star star-two">✧</div><div className="star star-three">✦</div><div className="mountain far"/><div className="mountain near"/><span className="sky-caption">LOOK UP. THERE’S A LOT TO DISCOVER.</span></div><div className="aside-copy"><span className="eyebrow">{step === 0 ? 'MADE FOR YOUR FIRST TRY' : 'YOUR NIGHT AT A GLANCE'}</span><h3>{step === 0 ? 'Everyone starts with a single photo.' : target}</h3><p>{step === 0 ? 'No perfect gear. No experience required. Just a little curiosity about what’s up there.' : `${cameraName} · ${gear.focal}mm · f/${gear.aperture} · ${gear.mount}`}</p>{step > 0 && <p>{place || 'Location to be chosen'}{date && ` · ${date}`}</p>}<div className="aside-rule"/><small>✦ Built for beginners, one clear step at a time.</small></div></aside></div>
    <p className="bottom-note">A quieter kind of adventure. <span>Start where you are.</span></p></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
