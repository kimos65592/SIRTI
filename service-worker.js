const CACHE_NAME = "jarvis-v1-cache-v1";

const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.json"
];


// Install
self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))

    );

    self.skipWaiting();
});


// Activate
self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys.map(key => {

                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }

                })

            );

        })

    );

    self.clients.claim();
});


// Fetch
self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                return cachedResponse ||
                       fetch(event.request);

            })

    );

});
