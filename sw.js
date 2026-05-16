const CACHE = 'meusite-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

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

// ── Firebase listener em background ──────────────────────────
// Recebe mensagem da aba admin com config do Firebase
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'INIT_FIREBASE'){
    const { dbUrl, apiKey, lastCount } = e.data;
    startWatching(dbUrl, apiKey, lastCount);
  }
});

let watchInterval = null;
let knownCount = 0;

function startWatching(dbUrl, apiKey, lastCount){
  knownCount = lastCount || 0;
  if(watchInterval) clearInterval(watchInterval);

  // Polling a cada 30 segundos via REST API do Firebase
  watchInterval = setInterval(async () => {
    try {
      const res  = await fetch(`${dbUrl}/acessos.json?auth=&shallow=true`);
      const data = await res.json();
      if(!data) return;
      const total = Object.keys(data).length;
      if(total > knownCount){
        const diff = total - knownCount;
        knownCount = total;
        // Busca o acesso mais recente
        const res2  = await fetch(`${dbUrl}/acessos.json?orderBy="tsUnix"&limitToLast=1`);
        const data2 = await res2.json();
        const item  = data2 ? Object.values(data2)[0] : {};
        self.registration.showNotification('🔔 Novo acesso!', {
          body: `${item.device||'Dispositivo'} · ${item.os||''}\n📍 ${item.city||''} ${item.country||''} · ${item.ip||''}`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: 'novo-acesso-' + Date.now(),
          requireInteraction: false,
        });
      }
    } catch(e){}
  }, 30000);
}
