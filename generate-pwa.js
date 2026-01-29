const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// 解析命令行参数
const args = process.argv.slice(2);
const url = args[0];
const name = args[1];
const icon = args[2] || 'default';

if (!url || !name) {
    console.error('Usage: node generate-pwa.js <url> <name> [icon]');
    process.exit(1);
}

// 主函数
async function main() {
    try {
        // 创建项目目录
        const projectDir = `build/${name.toLowerCase().replace(/\s+/g, '-')}`;
        const iconsDir = `${projectDir}/icons`;

        // 确保目录存在
        if (!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir);
        }

        if (!fs.existsSync(iconsDir)) {
            fs.mkdirSync(iconsDir);
        }

        // 生成index.html
        const indexHtmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <link rel="manifest" href="manifest.json">
    <link rel="icon" href="icons/icon-512x512.png" type="image/png">
    <meta name="theme-color" content="#ffffff">
    <!-- 防止点击劫持，限制iframe嵌套 -->
    <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'self'">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body, html {
            width: 100%;
            height: 100%;
            overflow: auto;
            margin: 0;
            padding: 0;
        }
        
        iframe {
            width: 100%;
            height: 100vh;
            min-height: 100vh;
            border: none;
            overflow: auto;
            display: block;
        }
    </style>
</head>
<body>
    <iframe src="${url}" title="${name}"></iframe>
    <script>
        // 注册Service Worker（仅在http/https协议下）
        if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
            window.addEventListener('load', function() {
                // 动态获取Service Worker路径，根据当前URL路径计算
                const currentPath = window.location.pathname;
                const serviceWorkerPath = currentPath.endsWith('/') ? currentPath + 'service-worker.js' : currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'service-worker.js';
                
                console.log('Registering ServiceWorker at:', serviceWorkerPath);
                navigator.serviceWorker.register(serviceWorkerPath)
                    .then(function(registration) {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(function(error) {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            });
        } else if (window.location.protocol === 'file:') {
            console.log('File protocol detected, skipping ServiceWorker registration');
        }
    </script>
</body>
</html>`;

        fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtmlContent);

        // 生成manifest.json
        const manifestJsonContent = JSON.stringify({
            "name": name,
            "short_name": name.length > 12 ? name.substring(0, 12) + '...' : name,
            "description": `PWA wrapper for ${name}`,
            "start_url": "/",
            "display": "standalone",
            "orientation": "portrait",
            "background_color": "#ffffff",
            "theme_color": "#3498db",
            "icons": [
                {
                    "src": "icons/icon-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any maskable"
                }
            ]
        }, null, 2);

        fs.writeFileSync(path.join(projectDir, 'manifest.json'), manifestJsonContent);

        // 生成service-worker.js
        const serviceWorkerContent = `// 缓存版本号，用于管理缓存更新
const CACHE_VERSION = 'v1';
const CACHE_NAME = \`pwa-cache-\${CACHE_VERSION}\`;

// 需要缓存的资源
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-512x512.png'
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
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('./icons/')) {
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
                    if (url.pathname.startsWith('./icons/')) {
                        return caches.match('./icons/icon-512x512.png');
                    }
                    return caches.match('./index.html');
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
                    return cachedResponse || caches.match('./index.html');
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
//         icon: './icons/icon-512x512.png',
//         badge: './icons/icon-512x512.png'
//     };
//     event.waitUntil(
//         self.registration.showNotification(data.title, options)
//     );
// });`;

        fs.writeFileSync(path.join(projectDir, 'service-worker.js'), serviceWorkerContent);

        // 处理图标
        async function processIcon(iconSource, outputPath) {
            try {
                let imageBuffer;
                
                if (iconSource.startsWith('http://') || iconSource.startsWith('https://')) {
                    // 从URL下载图标
                    console.log(`正在从URL下载图标: ${iconSource}`);
                    const response = await axios.get(iconSource, {
                        responseType: 'arraybuffer'
                    });
                    imageBuffer = Buffer.from(response.data);
                } else if (iconSource.startsWith('data:image/')) {
                    // 处理Base64编码的图标
                    console.log('正在处理Base64编码的图标');
                    const base64Data = iconSource.split(',')[1];
                    imageBuffer = Buffer.from(base64Data, 'base64');
                } else if (fs.existsSync(iconSource)) {
                    // 处理本地文件路径的图标
                    console.log(`正在处理本地图标文件: ${iconSource}`);
                    imageBuffer = fs.readFileSync(iconSource);
                } else {
                    // 使用默认图标
                    console.log('使用默认图标');
                    const iconPlaceholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
                    fs.writeFileSync(outputPath, iconPlaceholder);
                    return;
                }
                
                // 检查是否为.ico格式
                const isIcoFormat = iconSource.endsWith('.ico') || (
                    iconSource.startsWith('http://') || iconSource.startsWith('https://')
                ) && iconSource.includes('.ico');
                
                if (isIcoFormat) {
                    console.log('检测到.ico格式图标，尝试转换为支持的格式');
                    // 对于.ico格式，我们可以尝试使用一个简单的方法：
                    // 1. 保存.ico文件到临时位置
                    // 2. 使用一个简单的方法来提取其中的图像
                    // 3. 或者使用默认图标（如果转换失败）
                    
                    try {
                        // 尝试使用sharp处理，如果失败则使用默认图标
                        console.log('尝试使用sharp处理.ico格式');
                        await sharp(imageBuffer)
                            .resize(512, 512, {
                                fit: 'cover',
                                withoutEnlargement: false
                            })
                            .toFile(outputPath);
                        console.log(`图标已处理并保存到: ${outputPath}`);
                        return;
                    } catch (icoError) {
                        console.error('处理.ico格式失败:', icoError);
                        // 失败时使用默认图标
                        console.log('使用默认图标替代.ico格式');
                        const iconPlaceholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
                        fs.writeFileSync(outputPath, iconPlaceholder);
                        return;
                    }
                }
                
                // 调整图标尺寸为512x512
                console.log('正在调整图标尺寸为512x512');
                await sharp(imageBuffer)
                    .resize(512, 512, {
                        fit: 'cover',
                        withoutEnlargement: false
                    })
                    .toFile(outputPath);
                
                console.log(`图标已处理并保存到: ${outputPath}`);
            } catch (error) {
                console.error('处理图标失败:', error);
                // 失败时使用默认图标
                const iconPlaceholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
                fs.writeFileSync(outputPath, iconPlaceholder);
            }
        }

        // 处理并保存图标
        const iconPath = path.join(iconsDir, 'icon-512x512.png');
        await processIcon(icon, iconPath);

        console.log(`PWA project generated successfully at: ${projectDir}`);
        console.log('Files created:');
        console.log(`- ${projectDir}/index.html`);
        console.log(`- ${projectDir}/manifest.json`);
        console.log(`- ${projectDir}/service-worker.js`);
        console.log(`- ${projectDir}/icons/icon-512x512.png`);
    } catch (error) {
        console.error('生成PWA项目失败:', error);
        process.exit(1);
    }
}

// 运行主函数
main();
