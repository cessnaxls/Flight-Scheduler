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
  const r = await fetch(url,{headers:{'Accept':'application/json',...headers},redirect:'follow'});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const ct=r.headers.get('content-type')||'';
  if(!ct.includes('json')) throw new Error(`Provider returned ${ct||'non-JSON'} data`);
  return r.json();
}

const regionNames = (()=>{try{return new Intl.DisplayNames(['en'], {type:'region'});}catch{return null;}})();
function countryName(code){
  const c=String(code||'US').toUpperCase();
  try{return regionNames?.of(c) || c;}catch{return c==='US'?'United States':c;}
}

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
async function adsbType(type){ return cached('adsblol-type-'+type,20000,()=>getJson(`https://api.adsb.lol/v2/type/${encodeURIComponent(type)}`)); }
async function adsbHex(hex){ return cached('adsblol-'+hex,120000,()=>getJson(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`)); }

const regPrefixes = {
  US:['N'], CA:['C-F','C-G','CF-','CG-'], GB:['G-'], DE:['D-'], FR:['F-'], AU:['VH-'], NZ:['ZK-','ZL-','ZM-'],
  IE:['EI-'], NL:['PH-'], BE:['OO-'], CH:['HB-'], AT:['OE-'], ES:['EC-'], PT:['CS-'], IT:['I-'], NO:['LN-'], SE:['SE-'],
  DK:['OY-'], FI:['OH-'], PL:['SP-'], CZ:['OK-'], GR:['SX-'], JP:['JA'], CN:['B-'], KR:['HL'], IN:['VT-'], BR:['PP-','PR-','PT-','PU-'],
  MX:['XA-','XB-','XC-'], ZA:['ZS-','ZT-','ZU-'], AE:['A6-'], SA:['HZ-'], IL:['4X-','4Z-'], TR:['TC-'], SG:['9V-'], MY:['9M-'], TH:['HS-']
};
function regMatchesCountry(reg,code){
  const u=String(reg||'').trim().toUpperCase();
  const p=regPrefixes[code];
  return !p?.length ? true : p.some(x=>u.startsWith(x));
}
function normalizeAdsb(a={}){
  return {hex:a.hex||'',registration:a.r||a.reg||'',callsign:String(a.flight||'').trim(),aircraft:a.t||a.type||'',operator:a.ownOp||a.owner||'',altitude:a.alt_baro??a.alt_geom??'',lat:a.lat??null,lon:a.lon??null,source:'ADSB.lol'};
}
const RANDOM_TYPES=['H25B','C25A','C25B','C25C','E545','C750','CL30','CL35','CL60','GLF4','GLF5','GLF6','GL7T','PC24','B350','B738','B737','B739','A319','A320','A321','E145','E170','E190','CRJ2','CRJ7','CRJ9','B763','B772','B77W','B788','B789','A332','A333','A359','A35K'];
function choose(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

async function randomFromAdsb(country,type){
  const types=type?[type]:[...RANDOM_TYPES].sort(()=>Math.random()-.5);
  const tries=Math.min(type?1:12,types.length);
  for(let i=0;i<tries;i++){
    const t=types[i];
    try{
      const j=await adsbType(t);
      const rows=(j.ac||j.aircraft||[]).map(normalizeAdsb).filter(a=>a.registration && regMatchesCountry(a.registration,country));
      if(rows.length){ const a=choose(rows); a.country=countryName(country); return a; }
    }catch(e){ if(type) throw e; }
  }
  throw new Error(`No live ADSB.lol aircraft matched ${country}${type?' / '+type:''}.`);
}

async function randomFromOpenSky(country,type){
  const states=await openSkyStates(); const cname=countryName(country);
  let rows=(states.states||[]).filter(s=>String(s[2]||'').toLowerCase()===String(cname).toLowerCase() && s[0]);
  if(!rows.length && country==='US') rows=(states.states||[]).filter(s=>/united states/i.test(String(s[2]||'')) && s[0]);
  if(!rows.length) throw new Error(`No live OpenSky aircraft found for ${country} (${cname}).`);
  rows=[...rows].sort(()=>Math.random()-.5);
  for(const s of rows.slice(0,Math.min(type?50:15,rows.length))){
    const hex=s[0]; let enriched={};
    try{ const j=await adsbHex(hex); const a=(j.ac||j.aircraft||[])[0]; if(a) enriched=normalizeAdsb(a); }catch{}
    const out={hex,registration:enriched.registration||'',callsign:enriched.callsign||String(s[1]||'').trim(),aircraft:enriched.aircraft||'',operator:enriched.operator||'',altitude:s[7]??enriched.altitude??'',lat:s[6]??enriched.lat??null,lon:s[5]??enriched.lon??null,country:cname,source: enriched.registration ? 'OpenSky + ADSB.lol' : 'OpenSky'};
    if(type && String(out.aircraft).toUpperCase()!==type) continue;
    if(out.registration) return out;
  }
  throw new Error(`OpenSky found aircraft for ${country}, but none resolved${type?' as '+type:''}.`);
}

app.get('/api/random-tail', async (req,res)=>{
  const country=String(req.query.country||'US').toUpperCase();
  const source=String(req.query.source||'auto').toLowerCase();
  const type=String(req.query.type||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  try{
    let out;
    if(source==='adsblol') out=await randomFromAdsb(country,type);
    else if(source==='opensky') out=await randomFromOpenSky(country,type);
    else {
      try{ out=await randomFromAdsb(country,type); }
      catch(first){ try{ out=await randomFromOpenSky(country,type); } catch(second){ throw new Error(`${first.message} OpenSky fallback: ${second.message}`); } }
    }
    res.json(out);
  }catch(e){ res.status(502).json({error:`Live tail lookup failed: ${e.message}`}); }
});

// Safari-safe FR24 handoff. We deliberately DO NOT navigate to FR24 because iPadOS
// Universal Links can hand that navigation to the installed FR24 app. Instead we copy
// the exact FR24 URL and keep the user on this same-origin helper page. Pasting the URL
// into Safari's address bar is the reliable way to force the web site.
app.get('/fr24', (req,res)=>{
  const raw=String(req.query.path||'/');
  const safe = raw.startsWith('/') ? raw : '/';
  const target='https://www.flightradar24.com'+safe;
  const targetJs=JSON.stringify(target).replace(/</g,'\\u003c');
  res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FR24 Safari</title><style>body{font-family:-apple-system,BlinkMacSystemFont,system-ui;margin:0;background:#eef2f6;color:#17212b}.box{max-width:720px;margin:10vh auto;background:#fff;border:1px solid #b9c3cd;padding:24px}.url{font-family:ui-monospace,monospace;word-break:break-all;background:#f4f6f8;padding:12px;border:1px solid #ccd4dc}.ok{font-weight:700;color:#176c48}button{font:inherit;padding:10px 14px;border:0;background:#185f9c;color:white;font-weight:700}ol{line-height:1.6}</style></head><body><div class="box"><h1>Open FR24 in Safari</h1><p class="ok">FR24 URL copied.</p><p>iPadOS Universal Links can force ordinary FR24 links into the installed FR24 app. A website cannot disable that system association, so LineForge does not directly open the FR24 link.</p><ol><li>Tap Safari's address bar.</li><li>Tap <strong>Paste and Go</strong>.</li></ol><div class="url" id="url"></div><p><button id="copy">Copy URL again</button></p></div><script>const u=${targetJs};document.getElementById('url').textContent=u;async function cp(){try{await navigator.clipboard.writeText(u)}catch(e){const t=document.createElement('textarea');t.value=u;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}};cp();document.getElementById('copy').onclick=cp;</script></body></html>`);
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,()=>console.log(`LineForge listening on ${PORT}`));
