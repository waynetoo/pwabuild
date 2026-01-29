// 缓存版本号，用于管理缓存更新
const CACHE_VERSION = 'v1';
const CACHE_NAME = `pwa-cache-${CACHE_VERSION}`;

// 需要缓存的资源
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-512x512.png'
];

// 安装事件：缓存基本资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('缓存打开成功');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // 强制等待中的service worker变为激活状态
    self.skipWaiting();
});

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('清理旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // 立即获得控制权
    self.clients.claim();
});

// 获取事件：根据资源类型使用不同的缓存策略
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // 对静态资源使用缓存优先策略
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
        event.respondWith(
            caches.match(request).then((response) => {
                return response || fetch(request).then((networkResponse) => {
                    // 如果从网络获取成功，更新缓存
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // 网络请求失败时，返回离线页面或默认图标
                    if (url.pathname.startsWith('/icons/')) {
                        return caches.match('/icons/icon-512x512.png');
                    }
                    return caches.match('/index.html');
                });
            })
        );
    } else {
        // 对其他资源使用网络优先策略
        event.respondWith(
            fetch(request).then((networkResponse) => {
                return networkResponse;
            }).catch(() => {
                // 网络请求失败时，尝试从缓存获取
                return caches.match(request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/index.html');
                });
            })
        );
    }
});

// 背景同步事件（可选，根据需要启用）
// self.addEventListener('sync', (event) => {
//     if (event.tag === 'sync-data') {
//         event.waitUntil(syncData());
//     }
// });

// 推送通知事件（可选，根据需要启用）
// self.addEventListener('push', (event) => {
//     const data = event.data.json();
//     const options = {
//         body: data.body,
//         icon: '/icons/icon-512x512.png',
//         badge: '/icons/icon-512x512.png'
//     };
//     event.waitUntil(
//         self.registration.showNotification(data.title, options)
//     );
// });