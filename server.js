'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const BUILD = '4.1.0-static-assets';

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8'
};

function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache', 'Expires': '0',
    'X-LineForge-Build': BUILD
  });
  res.end(body);
}
function json(res,status,obj){ send(res,status,JSON.stringify(obj),MIME['.json']); }

const regionNames = (()=>{try{return new Intl.DisplayNames(['en'],{type:'region'});}catch{return null;}})();
function countryName(code){const c=String(code||'US').toUpperCase();try{return regionNames?.of(c)||c;}catch{return c==='US'?'United States':c;}}
const regPrefixes={
  US:['N'],CA:['C-F','C-G','CF-','CG-'],GB:['G-'],DE:['D-'],FR:['F-'],AU:['VH-'],NZ:['ZK-','ZL-','ZM-'],IE:['EI-'],NL:['PH-'],BE:['OO-'],CH:['HB-'],AT:['OE-'],ES:['EC-'],PT:['CS-'],IT:['I-'],NO:['LN-'],SE:['SE-'],DK:['OY-'],FI:['OH-'],PL:['SP-'],CZ:['OK-'],GR:['SX-'],JP:['JA'],CN:['B-'],KR:['HL'],IN:['VT-'],BR:['PP-','PR-','PT-','PU-'],MX:['XA-','XB-','XC-'],ZA:['ZS-','ZT-','ZU-'],AE:['A6-'],SA:['HZ-'],IL:['4X-','4Z-'],TR:['TC-'],SG:['9V-'],MY:['9M-'],TH:['HS-']
};
function regMatchesCountry(reg,code){const u=String(reg||'').trim().toUpperCase();const p=regPrefixes[code];return !p?.length?true:p.some(x=>u.startsWith(x));}
function normalizeAdsb(a={}){return {hex:a.hex||'',registration:a.r||a.reg||'',callsign:String(a.flight||'').trim(),aircraft:a.t||a.type||'',operator:a.ownOp||a.owner||'',altitude:a.alt_baro??a.alt_geom??'',lat:a.lat??null,lon:a.lon??null,source:'ADSB.lol'};}
const RANDOM_TYPES=['H25B','C25A','C25B','C25C','E545','C750','CL30','CL35','CL60','GLF4','GLF5','GLF6','GL7T','PC24','B350','B738','B737','B739','A319','A320','A321','E145','E170','E190','CRJ2','CRJ7','CRJ9','B763','B772','B77W','B788','B789','A332','A333','A359','A35K'];
const choose=a=>a[Math.floor(Math.random()*a.length)];
async function getJson(url,headers={}){const r=await fetch(url,{headers:{Accept:'application/json',...headers},redirect:'follow',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const ct=r.headers.get('content-type')||'';if(!ct.includes('json'))throw new Error(`provider returned ${ct||'non-JSON'}`);return r.json();}
async function adsbType(type){return getJson(`https://api.adsb.lol/v2/type/${encodeURIComponent(type)}`);}
async function adsbHex(hex){return getJson(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`);}
async function randomFromAdsb(country,type){
  const types=type?[type]:[...RANDOM_TYPES].sort(()=>Math.random()-.5);
  for(const t of types.slice(0,type?1:12)){
    try{const j=await adsbType(t);const rows=(j.ac||j.aircraft||[]).map(normalizeAdsb).filter(a=>a.registration&&regMatchesCountry(a.registration,country));if(rows.length){const a=choose(rows);a.country=countryName(country);return a;}}catch(e){if(type)throw e;}
  }
  throw new Error(`No live ADSB.lol aircraft matched ${country}${type?' / '+type:''}.`);
}
async function randomFromOpenSky(country,type){
  const j=await getJson('https://opensky-network.org/api/states/all');
  const cname=countryName(country);
  let rows=(j.states||[]).filter(s=>String(s[2]||'').toLowerCase()===String(cname).toLowerCase()&&s[0]);
  if(!rows.length&&country==='US')rows=(j.states||[]).filter(s=>/united states/i.test(String(s[2]||''))&&s[0]);
  rows=[...rows].sort(()=>Math.random()-.5);
  for(const s of rows.slice(0,Math.min(type?50:15,rows.length))){
    let enriched={};try{const x=await adsbHex(s[0]);const a=(x.ac||x.aircraft||[])[0];if(a)enriched=normalizeAdsb(a);}catch{}
    const out={hex:s[0],registration:enriched.registration||'',callsign:enriched.callsign||String(s[1]||'').trim(),aircraft:enriched.aircraft||'',operator:enriched.operator||'',altitude:s[7]??enriched.altitude??'',lat:s[6]??enriched.lat??null,lon:s[5]??enriched.lon??null,country:cname,source:enriched.registration?'OpenSky + ADSB.lol':'OpenSky'};
    if(type&&String(out.aircraft).toUpperCase()!==type)continue;if(out.registration&&regMatchesCountry(out.registration,country))return out;
  }
  throw new Error(`OpenSky found no resolvable ${country}${type?' / '+type:''} registration.`);
}

async function handleApi(req,res,url){
  if(url.pathname==='/health' || url.pathname==='/health.json') return json(res,200,{ok:true,service:'lineforge-dispatch',build:BUILD,time:new Date().toISOString()});
  if(url.pathname==='/api/random-tail'){
    const country=String(url.searchParams.get('country')||'US').toUpperCase();
    const source=String(url.searchParams.get('source')||'auto').toLowerCase();
    const type=String(url.searchParams.get('type')||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
    try{
      let out;
      if(source==='adsblol')out=await randomFromAdsb(country,type);
      else if(source==='opensky')out=await randomFromOpenSky(country,type);
      else {try{out=await randomFromAdsb(country,type);}catch(e){out=await randomFromOpenSky(country,type);}}
      return json(res,200,{ok:true,...out});
    }catch(e){return json(res,502,{ok:false,error:`Live tail lookup failed: ${e.message}`});}
  }
  if(url.pathname.startsWith('/api/')) return json(res,404,{ok:false,error:'Unknown LineForge API route.',build:BUILD});
  return false;
}

function safeFile(pathname){
  const clean=decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate=path.normalize(path.join(ROOT,clean));
  return candidate.startsWith(ROOT)?candidate:null;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    const apiResult=await handleApi(req,res,url); if(apiResult!==false)return;
    let filename=url.pathname==='/'?path.join(ROOT,'index.html'):safeFile(url.pathname);
    if(!filename)return send(res,400,'Bad request');
    fs.stat(filename,(err,st)=>{
      if(!err&&st.isFile()){
        const ext=path.extname(filename).toLowerCase();
        res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate','X-LineForge-Build':BUILD});
        return fs.createReadStream(filename).pipe(res);
      }
      // SPA fallback only for browser page requests; never for assets/API.
      if(!path.extname(url.pathname)){
        const idx=path.join(ROOT,'index.html');
        res.writeHead(200,{'Content-Type':MIME['.html'],'Cache-Control':'no-store, no-cache, must-revalidate','X-LineForge-Build':BUILD});
        return fs.createReadStream(idx).pipe(res);
      }
      send(res,404,'Not found');
    });
  }catch(e){json(res,500,{ok:false,error:e.message,build:BUILD});}
});
server.listen(PORT,()=>console.log(`LineForge ${BUILD} listening on ${PORT}`));
