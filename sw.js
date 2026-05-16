const CACHE = 'meusite-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const DB_URL = 'https://afiliados-5ae3a-default-rtdb.firebaseio.com';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com')){
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ── Recebe baseline do admin ──────────────────────────────────
self.addEventListener('message', async e => {
  if(e.data && e.data.type === 'INIT_FIREBASE'){
    await saveCount(e.data.lastCount);
    // Agenda verificação periódica
    scheduleCheck();
  }
  if(e.data && e.data.type === 'CHECK_NOW'){
    checkNewAccess();
  }
});

// ── Periodic Background Sync ──────────────────────────────────
self.addEventListener('periodicsync', e => {
  if(e.tag === 'check-acessos') {
    e.waitUntil(checkNewAccess());
  }
});

// ── Verifica novos acessos ────────────────────────────────────
async function checkNewAccess(){
  try {
    const res  = await fetch(`${DB_URL}/acessos.json?shallow=true`);
    const data = await res.json();
    if(!data) return;

    const total    = Object.keys(data).length;
    const previous = await getCount();

    if(total > previous){
      await saveCount(total);
      // Busca o mais recente
      const res2  = await fetch(`${DB_URL}/acessos.json?orderBy="tsUnix"&limitToLast=1`);
      const data2 = await res2.json();
      const item  = data2 ? Object.values(data2)[0] : {};

      await self.registration.showNotification('🔔 Novo acesso!', {
        body: `${item.device||'Dispositivo'} · ${item.os||''}\n📍 ${item.city||''} ${item.country||''}\n${item.ip||''}`,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'acesso-' + Date.now(),
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
    }
  } catch(e){}
}

// ── Agenda polling via setInterval no SW ─────────────────────
let pollInterval = null;

function scheduleCheck(){
  if(pollInterval) clearInterval(pollInterval);
  // Checa a cada 20 segundos — SW fica vivo enquanto tiver clientes (abas)
  pollInterval = setInterval(() => checkNewAccess(), 20000);
  // Primeira checagem imediata
  checkNewAccess();
}

// ── Persiste contagem no Cache Storage ───────────────────────
const COUNT_KEY = 'access-count';

async function getCount(){
  try {
    const cache = await caches.open('sw-state');
    const res   = await cache.match(COUNT_KEY);
    if(!res) return 0;
    return parseInt(await res.text()) || 0;
  } catch(e){ return 0; }
}

async function saveCount(n){
  try {
    const cache = await caches.open('sw-state');
    await cache.put(COUNT_KEY, new Response(String(n)));
  } catch(e){}
}
