'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'public', 'index.html');
const BUILD = '6.0.0-rebuild';

function send(res, status, body, type='text/plain; charset=utf-8', headers={}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store, max-age=0', ...headers });
  res.end(body);
}
function json(res, status, data) { send(res, status, JSON.stringify(data), 'application/json; charset=utf-8'); }
function fetchJSON(url, timeoutMs=9000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent':'LineForge/6.0 (+https://lineforge-dispatch.onrender.com)', 'Accept':'application/json' } }, (r) => {
      let chunks='';
      r.setEncoding('utf8');
      r.on('data', d => chunks += d);
      r.on('end', () => {
        if (r.statusCode < 200 || r.statusCode >= 300) return reject(new Error(`HTTP ${r.statusCode}`));
        try { resolve(JSON.parse(chunks)); } catch(e) { reject(new Error('Invalid JSON from provider')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Provider timeout')));
    req.on('error', reject);
  });
}

const typePool = ['H25B','C25A','C25B','C25C','E545','E55P','C750','CL30','CL35','CL60','GLF4','GLF5','GLF6','GL7T','PC24','B350','B738','B38M','A320','A21N','E75L','CRJ2'];
function regPrefixOk(reg, prefix) {
  if (!reg) return false;
  const r = String(reg).toUpperCase().replace(/\s+/g,'');
  const p = String(prefix || 'N').toUpperCase();
  if (p === 'C-') return /^C-[FGI]/.test(r);
  return r.startsWith(p);
}
function normalizePlane(ac) {
  return {
    hex: ac.hex || ac.icao24 || '',
    registration: ac.r || ac.registration || '',
    type: ac.t || ac.type || ac.typecode || '',
    callsign: (ac.flight || ac.callsign || '').trim(),
    description: ac.desc || '',
    lat: ac.lat ?? null, lon: ac.lon ?? null
  };
}
async function randomTail(prefix, type) {
  const candidates = type && type !== 'ANY' ? [type] : [...typePool].sort(() => Math.random()-0.5).slice(0,10);
  for (const t of candidates) {
    try {
      const data = await fetchJSON(`https://api.adsb.lol/v2/type/${encodeURIComponent(t)}`);
      const arr = (data.ac || data.aircraft || []).map(normalizePlane).filter(a => regPrefixOk(a.registration, prefix));
      if (arr.length) return { provider:'ADSB.lol', aircraft: arr[Math.floor(Math.random()*arr.length)] };
    } catch (_) {}
  }
  throw new Error('No matching live aircraft found. Try Any aircraft or another registration country.');
}

const server = http.createServer(async (req,res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && u.pathname === '/health') return json(res,200,{ok:true,build:BUILD});
  if (req.method === 'GET' && u.pathname === '/api/random-tail') {
    try {
      const prefix = u.searchParams.get('prefix') || 'N';
      const type = (u.searchParams.get('type') || 'ANY').toUpperCase();
      const result = await randomTail(prefix, type);
      return json(res,200,{ok:true,...result});
    } catch (e) { return json(res,404,{ok:false,error:e.message}); }
  }
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(INDEX);
      return send(res,200,html,'text/html; charset=utf-8');
    } catch(e) { return send(res,500,`LineForge failed to load index.html: ${e.message}`); }
  }
  if (u.pathname.startsWith('/api/')) return json(res,404,{ok:false,error:'Unknown API route'});
  return send(res,404,'Not found');
});
server.listen(PORT, '0.0.0.0', () => console.log(`LineForge ${BUILD} listening on ${PORT}`));
