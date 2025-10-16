// Dashboard Service Worker
// Version 1.0

const CACHE_NAME = 'dashboard-v1';
const STATIC_ASSETS = [
    '/',
    '/WebAppEnhanced.html',
    '/test-dashboard.html',
    '/test-dashboard-logic.js'
];

// Install Event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('[Service Worker] Cache failed:', error);
            })
    );
    
    // Активувати одразу
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[Service Worker] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    
    // Взяти контроль над всіма клієнтами
    self.clients.claim();
});

// Fetch Event - Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    // Пропустити chrome-extension та інші не-http запити
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Перевірка чи відповідь валідна
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Клонуємо відповідь для кешування
                const responseClone = response.clone();
                
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return response;
            })
            .catch(() => {
                // Якщо мережа недоступна, використовуємо кеш
                return caches.match(event.request).then((response) => {
                    if (response) {
                        console.log('[Service Worker] Serving from cache:', event.request.url);
                        return response;
                    }

                    // Якщо немає в кеші, повернути базову сторінку
                    return caches.match('/');
                });
            })
    );
});

// Background Sync Event
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sync event:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// Функція синхронізації даних
async function syncData() {
    console.log('[Service Worker] Syncing data...');
    
    try {
        // Отримати pending actions з IndexedDB або LocalStorage
        const pendingActions = await getPendingActions();
        
        for (const action of pendingActions) {
            try {
                await executeAction(action);
                await removePendingAction(action.id);
                console.log('[Service Worker] Action synced:', action.id);
            } catch (error) {
                console.error('[Service Worker] Sync failed for action:', action.id, error);
            }
        }
        
        console.log('[Service Worker] Sync complete');
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
    }
}

// Допоміжні функції для синхронізації
async function getPendingActions() {
    // TODO: Реалізувати отримання pending actions
    return [];
}

async function executeAction(action) {
    // TODO: Реалізувати виконання action
    console.log('[Service Worker] Executing action:', action);
}

async function removePendingAction(actionId) {
    // TODO: Реалізувати видалення action
    console.log('[Service Worker] Removing action:', actionId);
}

// Message Event - для комунікації з клієнтом
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('[Service Worker] Cache cleared');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
    
    if (event.data.type === 'GET_CACHE_SIZE') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(async (cache) => {
                const keys = await cache.keys();
                event.ports[0].postMessage({ 
                    size: keys.length,
                    keys: keys.map(req => req.url)
                });
            })
        );
    }
});

// Push Notification Event (опціонально)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');
    
    const options = {
        body: event.data ? event.data.text() : 'Нове оновлення даних',
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Аналітична Панель', options)
    );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('[Service Worker] Loaded');
