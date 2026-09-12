'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const BUILD = '5.0.0-self-contained';

function readRequired(name) {
  const p = path.join(ROOT, name);
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { throw new Error(`Missing required app file: public/${name} (${e.message})`); }
}

let BOOT_ERROR = null;
let APP_HTML = '';
try {
  const html = readRequired('index.html');
  const css = readRequired('styles.css');
  const js = readRequired('app.js');
  if (!html.includes('<!-- INLINE_CSS -->') || !html.includes('<!-- INLINE_JS -->')) {
    throw new Error('index.html is missing LineForge inline asset markers.');
  }
  APP_HTML = html
    .replace('<!-- INLINE_CSS -->', `<style id="lineforge-css">${css}</style>`)
    .replace('<!-- INLINE_JS -->', `<script id="lineforge-js">${js.split('</script>').join('<\/script>')}</script>`);
} catch (e) {
  BOOT_ERROR = e;
  APP_HTML = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:24px;background:#fff;color:#111"><h1>LineForge failed to start</h1><p>${escapeHtml(e.message)}</p><p>Build ${BUILD}</p></body></html>`;
}

function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache', 'Expires': '0',
    'X-LineForge-Build': BUILD,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}
function json(res,status,obj){ send(res,status,JSON.stringify(obj,null,2),'application/json; charset=utf-8'); }

const regionNames = (()=>{try{return new Intl.DisplayNames(['en'],{type:'region'});}catch{return null;}})();
function countryName(code){const c=String(code||'US').toUpperCase();try{return regionNames?.of(c)||c;}catch{return c==='US'?'United States':c;}}
const regPrefixes={US:['N'],CA:['C-F','C-G','CF-','CG-'],GB:['G-'],DE:['D-'],FR:['F-'],AU:['VH-'],NZ:['ZK-','ZL-','ZM-'],IE:['EI-'],NL:['PH-'],BE:['OO-'],CH:['HB-'],AT:['OE-'],ES:['EC-'],PT:['CS-'],IT:['I-'],NO:['LN-'],SE:['SE-'],DK:['OY-'],FI:['OH-'],PL:['SP-'],CZ:['OK-'],GR:['SX-'],JP:['JA'],CN:['B-'],KR:['HL'],IN:['VT-'],BR:['PP-','PR-','PT-','PU-'],MX:['XA-','XB-','XC-'],ZA:['ZS-','ZT-','ZU-'],AE:['A6-'],SA:['HZ-'],IL:['4X-','4Z-'],TR:['TC-'],SG:['9V-'],MY:['9M-'],TH:['HS-']};
function regMatchesCountry(reg,code){const u=String(reg||'').trim().toUpperCase();const p=regPrefixes[code];return !p?.length?true:p.some(x=>u.startsWith(x));}
function normalizeAdsb(a={}){return {hex:a.hex||'',registration:a.r||a.reg||'',callsign:String(a.flight||'').trim(),aircraft:a.t||a.type||'',operator:a.ownOp||a.owner||'',altitude:a.alt_baro??a.alt_geom??'',lat:a.lat??null,lon:a.lon??null,source:'ADSB.lol'};}
const RANDOM_TYPES=['H25B','C25A','C25B','C25C','E545','C750','CL30','CL35','CL60','GLF4','GLF5','GLF6','GL7T','PC24','B350','B738','B737','B739','A319','A320','A321','E145','E170','E190','CRJ2','CRJ7','CRJ9','B763','B772','B77W','B788','B789','A332','A333','A359','A35K'];
const choose=a=>a[Math.floor(Math.random()*a.length)];
async function getJson(url,headers={}){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);try{const r=await fetch(url,{headers:{Accept:'application/json',...headers},redirect:'follow',signal:ctrl.signal});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const ct=r.headers.get('content-type')||'';if(!ct.includes('json'))throw new Error(`provider returned ${ct||'non-JSON'}`);return r.json();}finally{clearTimeout(t);}}
async function adsbType(type){return getJson(`https://api.adsb.lol/v2/type/${encodeURIComponent(type)}`);}
async function adsbHex(hex){return getJson(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`);}
async function randomFromAdsb(country,type){const types=type?[type]:[...RANDOM_TYPES].sort(()=>Math.random()-.5);for(const t of types.slice(0,type?1:12)){try{const j=await adsbType(t);const rows=(j.ac||j.aircraft||[]).map(normalizeAdsb).filter(a=>a.registration&&regMatchesCountry(a.registration,country));if(rows.length){const a=choose(rows);a.country=countryName(country);return a;}}catch(e){if(type)throw e;}}throw new Error(`No live ADSB.lol aircraft matched ${country}${type?' / '+type:''}.`);}
async function randomFromOpenSky(country,type){const j=await getJson('https://opensky-network.org/api/states/all');const cname=countryName(country);let rows=(j.states||[]).filter(s=>String(s[2]||'').toLowerCase()===String(cname).toLowerCase()&&s[0]);if(!rows.length&&country==='US')rows=(j.states||[]).filter(s=>/united states/i.test(String(s[2]||''))&&s[0]);rows=[...rows].sort(()=>Math.random()-.5);for(const s of rows.slice(0,Math.min(type?50:15,rows.length))){let enriched={};try{const x=await adsbHex(s[0]);const a=(x.ac||x.aircraft||[])[0];if(a)enriched=normalizeAdsb(a);}catch{}const out={hex:s[0],registration:enriched.registration||'',callsign:enriched.callsign||String(s[1]||'').trim(),aircraft:enriched.aircraft||'',operator:enriched.operator||'',altitude:s[7]??enriched.altitude??'',lat:s[6]??enriched.lat??null,lon:s[5]??enriched.lon??null,country:cname,source:enriched.registration?'OpenSky + ADSB.lol':'OpenSky'};if(type&&String(out.aircraft).toUpperCase()!==type)continue;if(out.registration&&regMatchesCountry(out.registration,country))return out;}throw new Error(`OpenSky found no resolvable ${country}${type?' / '+type:''} registration.`);}

async function handleApi(req,res,url){
  if(url.pathname==='/health' || url.pathname==='/health.json') return json(res,BOOT_ERROR?500:200,{ok:!BOOT_ERROR,service:'lineforge-dispatch',build:BUILD,assetMode:'server-inlined',bootError:BOOT_ERROR?.message||null,time:new Date().toISOString()});
  if(url.pathname==='/diagnostic') return json(res,200,{build:BUILD,node:process.version,cwd:process.cwd(),dirname:__dirname,publicFiles:fs.existsSync(ROOT)?fs.readdirSync(ROOT):[],htmlBytes:Buffer.byteLength(APP_HTML),bootError:BOOT_ERROR?.message||null});
  if(url.pathname==='/api/random-tail'){
    const country=String(url.searchParams.get('country')||'US').toUpperCase();
    const source=String(url.searchParams.get('source')||'auto').toLowerCase();
    const type=String(url.searchParams.get('type')||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
    try{let out;if(source==='adsblol')out=await randomFromAdsb(country,type);else if(source==='opensky')out=await randomFromOpenSky(country,type);else{try{out=await randomFromAdsb(country,type);}catch{out=await randomFromOpenSky(country,type);}}return json(res,200,{ok:true,...out});}catch(e){return json(res,502,{ok:false,error:`Live tail lookup failed: ${e.message}`});}
  }
  if(url.pathname.startsWith('/api/')) return json(res,404,{ok:false,error:'Unknown LineForge API route.',build:BUILD});
  return false;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    const apiResult=await handleApi(req,res,url); if(apiResult!==false)return;
    // Every browser page route returns one fully self-contained document.
    return send(res,BOOT_ERROR?500:200,APP_HTML,'text/html; charset=utf-8');
  }catch(e){return json(res,500,{ok:false,error:e.message,build:BUILD});}
});
server.listen(PORT,()=>console.log(`LineForge ${BUILD} listening on ${PORT}; self-contained HTML ${Buffer.byteLength(APP_HTML)} bytes`));
