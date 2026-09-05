const cacheName = "sirCheetoDust-FieldSim-2.1";
const chunkedFiles = [
  {
    file: "Build/New folder.data",
    parts: Array.from({ length: 20 }, (_, index) => `Build/New folder.data.part-${String(index).padStart(3, "0")}`)
  },
  {
    file: "Build/New folder.wasm",
    parts: Array.from({ length: 2 }, (_, index) => `Build/New folder.wasm.part-${String(index).padStart(3, "0")}`)
  }
];

const contentToCache = [
    "Build/New folder.loader.js",
    "Build/New folder.framework.js",
  ...chunkedFiles.flatMap(file => file.parts),
    "TemplateData/style.css"

];

const chunkedFileMap = new Map(chunkedFiles.map(entry => [entry.file, entry.parts]));

async function responseForChunkedFile(request, parts) {
  const responses = await Promise.all(parts.map(part => caches.match(new URL(part, self.registration.scope))));
  const body = new ReadableStream({
    async start(controller) {
      for (const response of responses) {
        if (!response) {
          controller.error(new Error("Missing cached chunk"));
          return;
        }
        controller.enqueue(new Uint8Array(await response.arrayBuffer()));
      }
      controller.close();
    }
  });
  return new Response(body, { headers: { "Content-Type": request.url.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" } });
}

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    
    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      const pathname = new URL(e.request.url).pathname;
      const buildPath = pathname.indexOf('/Build/');
      const path = buildPath >= 0 ? pathname.substring(buildPath + 1) : pathname.replace(/^\//, '');
      const parts = chunkedFileMap.get(path);
      if (parts) {
        return responseForChunkedFile(e.request, parts);
      }
      let response = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (response) { return response; }

      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      cache.put(e.request, response.clone());
      return response;
    })());
});
