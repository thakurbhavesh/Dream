const APP_BRANDING_ASSETS = {
    mascot: '/teamchatXElement.png',
    notificationIcon: '/aabhyasa_logo_element.png',
};

const CACHE_NAME = 'teamchatx-cache-v3';

const getPrecacheUrls = () => [
    // Do NOT cache '/': it can serve different content depending on deploy
    '/index.html',
    APP_BRANDING_ASSETS.notificationIcon
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(getPrecacheUrls()))
            .then(() => self.skipWaiting())
            .catch((error) => console.error('Install failed:', error))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => {
                        if (name !== CACHE_NAME) {
                            return caches.delete(name);
                        }
                    })
                );
            }),
            self.clients.claim()
        ]).catch((error) => console.error('Activate failed:', error))
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Network-first for navigations (HTML) to avoid blank screen after deploys
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
                    return res;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Cache-first for static assets
    const destination = req.destination;
    if (['script', 'style', 'image', 'font'].includes(destination)) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req).then((res) => {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    return res;
                });
            })
        );
        return;
    }
});

self.addEventListener('message', (event) => {
    if (!event.data) {
        return;
    }

    if (event.data.type === 'APP_BRANDING_ASSETS') {
        const { mascot, notificationIcon } = event.data.payload || {};
        if (typeof mascot === 'string') {
            APP_BRANDING_ASSETS.mascot = mascot;
        }
        if (typeof notificationIcon === 'string') {
            APP_BRANDING_ASSETS.notificationIcon = notificationIcon;
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then((cache) => cache.add(notificationIcon))
                    .catch((error) => console.error('Branding asset cache failed:', error))
            );
        }
        return;
    }

    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, messageId, threadId = null, organizationId = null } = event.data;
        const notificationOptions = {
            body,
            icon: APP_BRANDING_ASSETS.notificationIcon,
            badge: APP_BRANDING_ASSETS.notificationIcon,
            vibrate: [200, 100, 200],
            tag: messageId,
            data: { messageId, threadId, organizationId },
            requireInteraction: true
        };

        event.waitUntil(
            self.registration.showNotification(title, notificationOptions)
                .then(() => {
                    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
                        .then((clients) => {
                            clients.forEach((client) => {
                                client.postMessage({
                                    type: 'PLAY_NOTIFICATION_SOUND',
                                    messageId
                                });
                            });
                        });
                })
                .catch((error) => console.error('Notification failed:', error))
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const { threadId = null, organizationId = null } = event.notification.data || {};
    const payload = {
        type: 'OPEN_THREAD_FROM_NOTIFICATION',
        threadId,
        organizationId,
    };
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                const preferred = clients.find((client) =>
                    typeof client.url === 'string' && client.url.includes('/app')
                );
                const targetClient = preferred || clients[0];
                if (targetClient) {
                    if (targetClient.focus) {
                        targetClient.focus();
                    }
                    targetClient.postMessage(payload);
                    return;
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/app').then((client) => {
                        if (client) {
                            client.postMessage(payload);
                        }
                    });
                }
            })
            .catch((error) => console.error('Notification click failed:', error))
    );
});
