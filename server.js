const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.static(__dirname, { extensions: ['html'] }));

const cache = new Map();
function cached(key, ttl, producer){
  const now = Date.now(), hit = cache.get(key);
  if(hit && now-hit.time < ttl) return Promise.resolve(hit.value);
  return Promise.resolve().then(producer).then(value => { cache.set(key,{time:now,value}); return value; });
}
async function getJson(url, headers={}){
  const r = await fetch(url,{headers:{'User-Agent':'LineForge/2.0 (+personal flight-sim dispatch app)',...headers}});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const regionNames = new Intl.DisplayNames(['en'], {type:'region'});
function countryName(code){ try{return regionNames.of(String(code||'US').toUpperCase()) || 'United States';}catch{return 'United States';} }

let osToken = {token:null, exp:0};
async function openSkyHeaders(){
  const id=process.env.OPENSKY_CLIENT_ID, secret=process.env.OPENSKY_CLIENT_SECRET;
  if(!id || !secret) return {};
  if(osToken.token && Date.now() < osToken.exp-60000) return {Authorization:`Bearer ${osToken.token}`};
  const body = new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:secret});
  const r=await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok) throw new Error(`OpenSky auth ${r.status}`);
  const j=await r.json(); osToken={token:j.access_token,exp:Date.now()+(j.expires_in||1800)*1000};
  return {Authorization:`Bearer ${j.access_token}`};
}
async function openSkyStates(){
  return cached('opensky-states',25000,async()=>getJson('https://opensky-network.org/api/states/all',await openSkyHeaders()));
}
async function adsbAll(){ return cached('adsblol-all',25000,()=>getJson('https://api.adsb.lol/v2/all')); }
async function adsbHex(hex){ return cached('adsblol-'+hex,120000,()=>getJson(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`)); }

const regPrefixes = {
  US:['N'], CA:['C-F','C-G','CF-','CG-'], GB:['G-'], DE:['D-'], FR:['F-'], AU:['VH-'], NZ:['ZK-','ZL-','ZM-'],
  IE:['EI-'], NL:['PH-'], BE:['OO-'], CH:['HB-'], AT:['OE-'], ES:['EC-'], PT:['CS-'], IT:['I-'], NO:['LN-'], SE:['SE-'],
  DK:['OY-'], FI:['OH-'], PL:['SP-'], CZ:['OK-'], GR:['SX-'], JP:['JA'], CN:['B-'], KR:['HL'], IN:['VT-'], BR:['PP-','PR-','PT-','PU-'],
  MX:['XA-','XB-','XC-'], ZA:['ZS-','ZT-','ZU-'], AE:['A6-'], SA:['HZ-'], IL:['4X-','4Z-'], TR:['TC-'], SG:['9V-'], MY:['9M-'], TH:['HS-']
};
function regMatchesCountry(reg,code){ const u=String(reg||'').toUpperCase(); return (regPrefixes[code]||[]).some(p=>u.startsWith(p)); }
function normalizeAdsb(a={}){
  return {hex:a.hex||'',registration:a.r||a.reg||'',callsign:String(a.flight||'').trim(),aircraft:a.t||a.type||'',operator:a.ownOp||a.owner||'',altitude:a.alt_baro??a.alt_geom??'',lat:a.lat??null,lon:a.lon??null,source:'ADSB.lol'};
}

app.get('/api/random-tail', async (req,res)=>{
  const code=String(req.query.country||'US').toUpperCase();
  const source=String(req.query.source||'auto').toLowerCase();
  try{
    if(source==='adsblol'){
      const j=await adsbAll(); const all=(j.ac||j.aircraft||[]).map(normalizeAdsb).filter(a=>a.registration && regMatchesCountry(a.registration,code));
      if(!all.length) return res.status(404).json({error:`No live ADSB.lol registrations matched ${code}. Try Auto/OpenSky.`});
      return res.json(all[Math.floor(Math.random()*all.length)]);
    }
    const states=await openSkyStates(); const cname=countryName(code);
    let rows=(states.states||[]).filter(s=>String(s[2]||'').toLowerCase()===cname.toLowerCase() && s[0]);
    if(!rows.length && code==='US') rows=(states.states||[]).filter(s=>/united states/i.test(String(s[2]||'')) && s[0]);
    if(!rows.length) return res.status(404).json({error:`No live OpenSky aircraft found for ${code} (${cname}).`});
    for(let attempt=0; attempt<Math.min(10,rows.length); attempt++){
      const s=rows[Math.floor(Math.random()*rows.length)], hex=s[0];
      let enriched={};
      try{ const j=await adsbHex(hex); const a=(j.ac||j.aircraft||[])[0]; if(a) enriched=normalizeAdsb(a); }catch{}
      const out={hex,registration:enriched.registration||'',callsign:enriched.callsign||String(s[1]||'').trim(),aircraft:enriched.aircraft||'',operator:enriched.operator||'',altitude:s[7]??enriched.altitude??'',lat:s[6]??enriched.lat??null,lon:s[5]??enriched.lon??null,country:cname,source: enriched.registration ? 'OpenSky + ADSB.lol' : 'OpenSky'};
      if(out.registration) return res.json(out);
      if(source==='opensky') return res.json(out);
    }
    return res.status(404).json({error:'Found live aircraft but could not resolve a registration. Try again.'});
  }catch(e){ res.status(502).json({error:`Live tail lookup failed: ${e.message}`}); }
});

// Open a same-origin browser tab first, then navigate to FR24. This avoids a direct
// universal-link tap from the app and helps iPadOS keep the destination in Safari.
app.get('/fr24', (req,res)=>{
  const raw=String(req.query.path||'/');
  const safe = raw.startsWith('/') ? raw : '/';
  const target='https://www.flightradar24.com'+safe;
  res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width"><title>Opening Flightradar24…</title><style>body{font-family:system-ui;padding:2rem}a{font-size:1.1rem}</style><p>Opening Flightradar24 in this Safari tab…</p><p><a id="go" href="${target.replace(/"/g,'&quot;')}">Continue to Flightradar24</a></p><script>setTimeout(()=>location.replace(${JSON.stringify(target)}),40)</script>`);
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,()=>console.log(`LineForge listening on ${PORT}`));
