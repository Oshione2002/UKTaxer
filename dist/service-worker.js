const CACHE_VERSION='uktaxer-offline-2026-2';
const CORE=['./','./index.html','./app-v27.js','./ai.js','./theme.js','./styles-v39.css','./ai.css','./manifest.webmanifest','./calculators.js','./coverage.js','./engine.js','./export.js','./assets/icon.svg','./law/manifest.json'];
async function report(type,done,total,error=''){
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const window of windows)window.postMessage({type,done,total,error});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE_VERSION);
 try{
  const manifestResponse=await fetch('./law/manifest.json',{cache:'no-store'});
  if(!manifestResponse.ok)throw new Error('Law manifest could not be downloaded.');
  const manifest=await manifestResponse.clone().json();
  const assets=[...CORE,...manifest.documents.flatMap(doc=>[doc.index,doc.text])];
  for(let index=0;index<assets.length;index++){
   const url=assets[index],response=url==='./law/manifest.json'?manifestResponse.clone():await fetch(url,{cache:'no-store'});
   if(!response.ok)throw new Error('Offline download failed: '+url);
   await cache.put(url,response);
   await report('CACHE_PROGRESS',index+1,assets.length);
  }
  await report('CACHE_READY',assets.length,assets.length);
  await self.skipWaiting();
 }catch(error){
  await caches.delete(CACHE_VERSION);
  await report('CACHE_ERROR',0,0,String(error.message||error));
  throw error;
 }
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('uktaxer-offline-')&&name!==CACHE_VERSION).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_VERSION);
  if(event.request.mode==='navigate'){
   try{const response=await fetch(event.request);if(response.ok)await cache.put('./index.html',response.clone());return response;}catch{return await cache.match('./index.html')||await cache.match('./');}
  }
  const cached=await cache.match(event.request,{ignoreSearch:true});
  if(cached)return cached;
  try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}
  catch{return new Response('Unavailable offline',{status:503,headers:{'Content-Type':'text/plain'}});}
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
