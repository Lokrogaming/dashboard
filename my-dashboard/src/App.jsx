import React, { useEffect, useState, useRef } from "react";

// Phone Dashboard — single-file React component // Features: // - Modular dashboard: load built-in modules or import external ES modules by URL // - Modules persist in localStorage // - Simple module API: external modules must be ES modules that export default function Module(props) { ... } //   and MAY export meta = { id, name, description, icon } for UI information. // - Built-in sample modules included (Weather, Battery, Network) // - WARNING: importing external modules runs arbitrary JS in your page. Only import trusted code.

const STORAGE_KEY = "phone-dashboard-modules-v1";

// Built-in module code as ESM strings (they export default + meta if desired) const BUILTIN_MODULES = [ { id: "weather", name: "Weather (built-in)", description: "Shows current location weather (uses free Open-Meteo).", code:  export const meta = { id: 'weather', name: 'Weather', description: 'Local weather (Open-Meteo)' }; export default function WeatherModule(){ const { useState, useEffect } = React; const [loading, setLoading] = useState(true); const [err, setErr] = useState(null); const [data, setData] = useState(null); useEffect(()=>{ if (!navigator.geolocation) { setErr('Geolocation not supported'); setLoading(false); return; } navigator.geolocation.getCurrentPosition(async (pos)=>{ try{ const lat = pos.coords.latitude; const lon = pos.coords.longitude; // Open-Meteo public API (no key). If blocked, user can provide their own URL. const res = await fetch(https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true); if(!res.ok) throw new Error('Weather fetch failed'); const json = await res.json(); setData(json.current_weather); }catch(e){ setErr(e.message || String(e)); } setLoading(false); }, (e)=>{ setErr(e.message||String(e)); setLoading(false); }); },[]); if(loading) return React.createElement('div', {className:'p-4'}, 'Loading weather...'); if(err) return React.createElement('div', {className:'p-4 text-red-500'}, 'Error: ' + err); if(!data) return React.createElement('div', {className:'p-4'}, 'No weather data'); return React.createElement('div', {className:'p-4'}, React.createElement('div', null, 'Temperature: ' + data.temperature + '°C'), React.createElement('div', null, 'Windspeed: ' + data.windspeed + ' m/s')); } , }, { id: "battery", name: "Battery (built-in)", description: "Shows battery level (if supported).", code: export const meta = { id: 'battery', name: 'Battery', description: 'Battery status' }; export default function BatteryModule(){ const { useState, useEffect } = React; const [info, setInfo] = useState(null); useEffect(()=>{ let mounted=true; navigator.getBattery && navigator.getBattery().then(batt=>{ const update = ()=>mounted && setInfo({level: batt.level, charging: batt.charging}); update(); batt.addEventListener('levelchange', update); batt.addEventListener('chargingchange', update); return ()=>{ batt.removeEventListener('levelchange', update); batt.removeEventListener('chargingchange', update); mounted=false; }; }).catch(()=>{ mounted && setInfo(null); }); },[]); if(!info) return React.createElement('div', {className:'p-4'}, 'Battery API not supported or permission denied'); return React.createElement('div', {className:'p-4'}, React.createElement('div', null, 'Level: ' + Math.round(info.level*100) + '%'), React.createElement('div', null, 'Charging: ' + (info.charging ? 'Yes' : 'No'))); }, }, { id: "network", name: "Network (built-in)", description: "Network information (type & online status).", code: export const meta = { id:'network', name:'Network', description:'Network info' }; export default function NetworkModule(){ const { useState, useEffect } = React; const [info, setInfo] = useState({online: navigator.onLine}); useEffect(()=>{ const onOnline = ()=>setInfo({online:true}); const onOffline = ()=>setInfo({online:false}); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return ()=>{ window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); }; },[]); return React.createElement('div', {className:'p-4'}, React.createElement('div', null, 'Online: ' + (info.online ? 'Yes' : 'No'))); }, } ];

// Utility: create module blob URL from code string function makeModuleBlobURL(code){ const blob = new Blob([code], {type: 'text/javascript'}); return URL.createObjectURL(blob); }

export default function PhoneDashboard(){ const [modules, setModules] = useState([]); const [activeModules, setActiveModules] = useState([]); const [selectedModuleIndex, setSelectedModuleIndex] = useState(null); const [marketplaceOpen, setMarketplaceOpen] = useState(true); const [importUrl, setImportUrl] = useState(''); const [inlineCode, setInlineCode] = useState(''); const moduleRefs = useRef({});

// load saved modules from localStorage or initialize with built-ins useEffect(()=>{ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ try{ const parsed = JSON.parse(raw); setModules(parsed); setActiveModules(parsed.filter(m=>m.enabled).map(m=>m.id)); return; }catch(e){ console.warn('Failed to parse saved modules, reinitializing.'); } } // initialize with built-ins const initial = BUILTIN_MODULES.map(m=>({ id: m.id, name: m.name, description: m.description, source: 'inline', code: m.code, enabled: true })); setModules(initial); setActiveModules(initial.map(m=>m.id)); localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); },[]);

useEffect(()=>{ // update saved state when modules change localStorage.setItem(STORAGE_KEY, JSON.stringify(modules)); },[modules]);

// dynamic import a module (inline or url) async function loadModule(mod){ try{ // clear previous blob URL if any if(moduleRefs.current[mod.id] && moduleRefs.current[mod.id].blobUrl){ URL.revokeObjectURL(moduleRefs.current[mod.id].blobUrl); } let blobUrl; if(mod.source === 'inline'){ blobUrl = makeModuleBlobURL(mod.code); }else if(mod.source === 'url'){ // fetch remote text and create blob (we could just import the url directly if CORS allows) const res = await fetch(mod.url); if(!res.ok) throw new Error('Failed to fetch remote module'); const text = await res.text(); blobUrl = makeModuleBlobURL(text); } const imported = await import(/* @vite-ignore */ blobUrl); moduleRefs.current[mod.id] = { module: imported.default, meta: imported.meta || imported.meta || (imported?.meta), blobUrl }; return moduleRefs.current[mod.id]; }catch(e){ console.error('Module load failed', e); throw e; } }

// add module from URL (expects an ES module that export default a React component) async function addModuleFromUrl(url){ const id = 'ext-' + Math.random().toString(36).slice(2,9); const newMod = { id, name: url, description: 'External module', source: 'url', url, enabled: true }; setModules(prev=>[...prev, newMod]); setActiveModules(prev=>[...prev, id]); try{ await loadModule(newMod); }catch(e){ alert('Failed to load module: ' + e.message); } }

// add inline module from user-pasted code async function addInlineModule(code, name){ const id = 'inline-' + Math.random().toString(36).slice(2,9); const newMod = { id, name: name || id, description: 'Inline module', source: 'inline', code, enabled: true }; setModules(prev=>[...prev, newMod]); setActiveModules(prev=>[...prev, id]); try{ await loadModule(newMod); }catch(e){ alert('Failed to evaluate inline module: ' + e.message); } }

function toggleModule(id){ setModules(prev => prev.map(m => m.id === id ? {...m, enabled: !m.enabled} : m)); setActiveModules(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]); }

async function removeModule(id){ if(!confirm('Remove module? This cannot be undone.')) return; setModules(prev => prev.filter(m=>m.id !== id)); setActiveModules(prev => prev.filter(x=>x !== id)); if(moduleRefs.current[id] && moduleRefs.current[id].blobUrl){ URL.revokeObjectURL(moduleRefs.current[id].blobUrl); delete moduleRefs.current[id]; } }

// UI helpers function ModuleCard({mod}){ const [error, setError] = useState(null); const [loaded, setLoaded] = useState(false); const [Comp, setComp] = useState(null); useEffect(()=>{ let mounted = true; (async ()=>{ try{ const loadedModule = await loadModule(mod); if(!mounted) return; const C = loadedModule.module || (()=>React.createElement('div', null, 'No default export')); setComp(()=>C); setLoaded(true); }catch(e){ setError(e.message || String(e)); } })(); return ()=>{ mounted=false; }; },[mod.id]);

return (
  React.createElement('div', {className:'bg-white rounded-2xl shadow p-2 m-2 w-full md:w-1/3'},
    React.createElement('div', {className:'flex justify-between items-start'},
      React.createElement('div', null, React.createElement('strong', null, mod.name || mod.id), React.createElement('div', {className:'text-xs text-gray-500'}, mod.description || '')),
      React.createElement('div', null,
        React.createElement('button', {className:'px-2 py-1 rounded text-sm border', onClick:()=>toggleModule(mod.id)}, mod.enabled ? 'Disable' : 'Enable'),
        React.createElement('button', {className:'ml-2 px-2 py-1 rounded text-sm border', onClick:()=>removeModule(mod.id)}, 'Remove')
      )
    ),
    React.createElement('div', {className:'mt-2'},
      error ? React.createElement('div', {className:'text-red-500'}, 'Load error: ' + error) : (
        !loaded ? React.createElement('div', null, 'Loading module...') : (
          Comp ? React.createElement(Comp, {}) : React.createElement('div', null, 'No component')
        )
      )
    )
  )
);

}

return ( React.createElement('div', {className:'min-h-screen bg-slate-50 p-4 font-sans'}, React.createElement('div', {className:'max-w-6xl mx-auto'}, React.createElement('header', {className:'flex items-center justify-between mb-4'}, React.createElement('h1', {className:'text-2xl font-bold'}, 'Phone Dashboard'), React.createElement('div', null, React.createElement('button', {className:'px-3 py-2 bg-blue-600 text-white rounded', onClick:()=>setMarketplaceOpen(o=>!o)}, marketplaceOpen ? 'Close Marketplace' : 'Open Marketplace') ) ),

marketplaceOpen && React.createElement('section', {className:'mb-6 bg-white p-4 rounded-2xl shadow'},
      React.createElement('h2', {className:'text-lg font-semibold mb-2'}, 'Module marketplace / importer'),
      React.createElement('p', {className:'text-sm text-gray-600 mb-2'}, 'You can import external ES modules (must export default a React component). Beware: imported modules run arbitrary JS in your page.'),
      React.createElement('div', {className:'flex gap-2 mb-4'},
        React.createElement('input', {className:'flex-1 border px-2 py-1 rounded', placeholder:'https://example.com/my-module.mjs', value:importUrl, onChange:e=>setImportUrl(e.target.value)}),
        React.createElement('button', {className:'px-3 py-2 border rounded', onClick:()=>{ if(importUrl) addModuleFromUrl(importUrl); }}, 'Import URL')
      ),
      React.createElement('div', {className:'mb-4'},
        React.createElement('div', {className:'text-sm text-gray-600 mb-1'}, 'Or paste module code (ESM):'),
        React.createElement('textarea', {className:'w-full h-28 border rounded p-2', value:inlineCode, onChange:e=>setInlineCode(e.target.value)}),
        React.createElement('div', {className:'flex justify-end mt-2'}, React.createElement('button', {className:'px-3 py-2 bg-green-600 text-white rounded', onClick={()=>{ if(inlineCode) addInlineModule(inlineCode, 'User module'); setInlineCode(''); }}, 'Add inline module'))
      ),
      React.createElement('div', {className:'grid md:grid-cols-3 gap-2'},
        modules.map(m => React.createElement(ModuleCard, {key:m.id, mod:m}))
      )
    ),

    React.createElement('section', {className:'mb-6'},
      React.createElement('h2', {className:'text-lg font-semibold mb-2'}, 'Active dashboard'),
      React.createElement('div', {className:'flex flex-wrap -m-2'},
        modules.filter(m=>m.enabled).map(m => (
          React.createElement('div', {key:m.id, className:'m-2 bg-white p-3 rounded-2xl shadow w-full md:w-1/2 lg:w-1/3'},
            React.createElement('div', {className:'flex items-center justify-between'}, React.createElement('strong', null, m.name || m.id), React.createElement('button', {className:'text-sm', onClick:()=>toggleModule(m.id)}, 'Disable')),
            React.createElement('div', {className:'mt-2'}, React.createElement(ActiveModuleRenderer, {mod:m, moduleRefs:moduleRefs}))
          )
        ))
      )
    ),

    React.createElement('footer', {className:'text-sm text-gray-500 mt-6'},
      React.createElement('div', null, 'Persistence: modules saved to localStorage under "' + STORAGE_KEY + '".'),
      React.createElement('div', null, 'Tip: to access more phone data (contacts, SMS, call logs), create a small native companion app that exposes an API or use a secure WebRTC peer connection from your phone to this dashboard.')
    )
  )
)

); }

// Helper component to render loaded module (safely handles async loading) function ActiveModuleRenderer({mod, moduleRefs}){ const [Comp, setComp] = useState(null); const [err, setErr] = useState(null); useEffect(()=>{ let mounted = true; (async ()=>{ try{ // If already loaded in refs, use it if(moduleRefs.current[mod.id] && moduleRefs.current[mod.id].module){ setComp(()=>moduleRefs.current[mod.id].module); return; } const loaded = await (async ()=>{ if(mod.source === 'inline'){ const url = makeModuleBlobURL(mod.code); const imported = await import(/* @vite-ignore / url); moduleRefs.current[mod.id] = {module: imported.default, blobUrl: url}; return imported.default; }else if(mod.source === 'url'){ const res = await fetch(mod.url); if(!res.ok) throw new Error('Failed to fetch remote module'); const text = await res.text(); const url = makeModuleBlobURL(text); const imported = await import(/ @vite-ignore */ url); moduleRefs.current[mod.id] = {module: imported.default, blobUrl: url}; return imported.default; } throw new Error('Unknown module source'); })(); if(mounted) setComp(()=>loaded); }catch(e){ if(mounted) setErr(e.message || String(e)); } })(); return ()=>{ mounted=false; }; },[mod.id]);

if(err) return React.createElement('div', {className:'text-red-500'}, 'Module error: ' + err); if(!Comp) return React.createElement('div', null, 'Loading...'); return React.createElement(Comp, {}); }