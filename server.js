const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const fs = require('fs');

// 配置multer用于文件上传
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

const app = express();
const port = 3000;

// 静态文件服务
app.use(express.static(__dirname, {
    setHeaders: function(res, path) {
        // 为HTML文件设置X-Frame-Options头
        if (path.endsWith('.html')) {
            res.setHeader('X-Frame-Options', 'sameorigin');
        }
    }
}));

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 确保uploads目录存在
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
}

// 解析网址标题和图标API端点
app.get('/get-title', async (req, res) => {
    console.log('收到get-title请求:', req.query);
    
    try {
        const { url } = req.query;
        
        if (!url) {
            console.error('缺少url参数');
            return res.status(400).json({ error: 'Missing required parameter: url' });
        }
        
        console.log('解析网址:', url);
        
        // 准备返回的数据
        let title = 'PWA App';
        const icons = [];
        
        console.log('初始化数据 - title:', title, 'icons:', icons);
        
        try {
            // 尝试获取网页内容
            console.log('开始获取网页内容...');
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            
            console.log('成功获取网页内容，状态码:', response.status);
            
            // 解析HTML提取标题
            const $ = cheerio.load(response.data);
            const pageTitle = $('title').text().trim();
            
            console.log('解析到的标题:', pageTitle);
            
            // 如果没有title标签，尝试从meta标签获取
            let finalTitle = pageTitle;
            if (!finalTitle) {
                finalTitle = $('meta[name="title"]').attr('content') || $('meta[property="og:title"]').attr('content') || '';
                console.log('从meta标签获取标题:', finalTitle);
            }
            
            // 如果仍然没有标题，使用网址域名作为默认值
            if (!finalTitle) {
                try {
                    const urlObj = new URL(url);
                    finalTitle = urlObj.hostname.replace('www.', '');
                    console.log('使用域名作为标题:', finalTitle);
                } catch (e) {
                    console.error('解析域名失败:', e);
                }
            }
            
            if (finalTitle) {
                title = finalTitle;
            }
            
            // 查找img标签中的图片（优先）
            console.log('查找img标签中的图片');
            const imgIcons = [];
            $('img').each((i, el) => {
                try {
                    const src = $(el).attr('src');
                    const className = $(el).attr('class');
                    const alt = $(el).attr('alt');
                    
                    // 检查是否符合图标条件：
                    // 1. class包含icon
                    // 2. alt包含app、logo或icon
                    // 3. src包含icon
                    const isIconClass = className && className.includes('icon');
                    const isIconAlt = alt && (alt.includes('app') || alt.includes('logo') || alt.includes('icon'));
                    const isIconSrc = src && src.includes('icon');
                    
                    if (src && (isIconClass || isIconAlt || isIconSrc)) {
                        // 过滤掉base64编码的图标
                        if (!src.startsWith('data:image/')) {
                            const imgUrl = new URL(src, url).href;
                            imgIcons.push({
                                url: imgUrl,
                                type: 'img',
                                className: className,
                                alt: alt,
                                src: src
                            });
                            console.log(`找到图标: ${imgUrl}, class: ${className}, alt: ${alt}, src: ${src}`);
                        }
                    }
                } catch (e) {
                    console.error('处理img标签失败:', e);
                }
            });
            
            // 查找link标签中rel="icon"或rel="apple-touch-icon"的图标
            console.log('查找link标签中的图标');
            const linkIcons = [];
            $('link').each((i, el) => {
                try {
                    const rel = $(el).attr('rel');
                    const href = $(el).attr('href');
                    
                    if (href && rel && (rel.includes('icon') || rel.includes('apple-touch-icon'))) {
                        // 不过滤base64编码的图标
                        const iconUrl = new URL(href, url).href;
                        linkIcons.push({
                            url: iconUrl,
                            type: 'link',
                            rel: rel
                        });
                        console.log(`找到link标签中的图标: ${iconUrl}, rel: ${rel}`);
                    }
                } catch (e) {
                    console.error('处理link标签失败:', e);
                }
            });
            
            // 优先使用img标签的图标，然后使用link标签的图标
            // 从img标签中选择最合适的图标
            if (imgIcons.length > 0) {
                // 优先选择class包含icon的图标
                const iconClassIcons = imgIcons.filter(icon => icon.className && icon.className.includes('icon'));
                if (iconClassIcons.length > 0) {
                    icons.push(iconClassIcons[0].url);
                    console.log('选择class包含icon的图标:', iconClassIcons[0].url);
                } else {
                    // 其次选择alt包含logo或icon的图标
                    const logoAltIcons = imgIcons.filter(icon => icon.alt && (icon.alt.includes('logo') || icon.alt.includes('icon')));
                    if (logoAltIcons.length > 0) {
                        icons.push(logoAltIcons[0].url);
                        console.log('选择alt包含logo/icon的图标:', logoAltIcons[0].url);
                    } else {
                        // 否则选择第一个图片
                        icons.push(imgIcons[0].url);
                        console.log('选择第一个图片作为图标:', imgIcons[0].url);
                    }
                }
            } 
            // 如果没有img标签的图标，使用link标签的图标
            else if (linkIcons.length > 0) {
                // 优先选择apple-touch-icon
                const appleTouchIcons = linkIcons.filter(icon => icon.rel.includes('apple-touch-icon'));
                if (appleTouchIcons.length > 0) {
                    icons.push(appleTouchIcons[0].url);
                    console.log('选择apple-touch-icon:', appleTouchIcons[0].url);
                } else {
                    // 否则选择第一个符合条件的图标
                    icons.push(linkIcons[0].url);
                    console.log('选择第一个link图标:', linkIcons[0].url);
                }
            }
            
            // 如果还是没有找到图标，尝试从favicon.ico获取
            if (icons.length === 0) {
                try {
                    const faviconUrl = new URL('/favicon.ico', url).href;
                    icons.push(faviconUrl);
                    console.log('添加favicon.ico作为图标:', faviconUrl);
                } catch (e) {
                    console.error('添加favicon.ico失败:', e);
                }
            }
            
        } catch (error) {
            console.error('获取网页内容失败:', error);
            // 获取网页内容失败时，返回空图标数组
        }
        
        // 去重
        const uniqueIcons = [...new Set(icons)];
        console.log('最终数据 - title:', title, 'icons:', uniqueIcons);
        
        // 直接返回包含用户提到图标的结果
        const result = {
            title: title,
            icons: uniqueIcons
        };
        
        console.log('返回结果:', result);
        res.json(result);
    } catch (error) {
        console.error('处理get-title请求失败:', error);
        // 返回默认数据
        const fallbackResult = {
            title: 'PWA App',
            icons: []
        };
        console.log('返回默认结果:', fallbackResult);
        res.json(fallbackResult);
    }
});

// PWA生成API端点
app.post('/generate-pwa', upload.single('iconFile'), (req, res) => {
    try {
        // 处理不同的请求格式
        let url, name, iconFile;
        
        if (req.file) {
            // 处理文件上传的情况
            url = req.body.url;
            name = req.body.name;
            iconFile = req.file;
        } else {
            // 处理JSON请求的情况
            url = req.body.url;
            name = req.body.name;
        }
        
        if (!url || !name) {
            return res.status(400).json({ error: 'Missing required parameters: url and name' });
        }
        
        // 检查图标参数
        if (!req.file && !req.body.icon) {
            return res.status(400).json({ error: 'Missing required parameter: icon' });
        }
        
        console.log('生成PWA项目:', { url, name, hasIconFile: !!req.file, hasIconParam: !!req.body.icon });
        
        // 调用生成脚本
        let iconParam = 'default';
        let tempIconFile = null;
        
        if (req.file) {
            // 如果有上传的文件，使用文件路径
            iconParam = req.file.path;
            tempIconFile = req.file.path;
            console.log('使用上传的图标文件:', iconParam);
        } else if (req.body.icon) {
            // 如果有图标参数，使用它
            iconParam = req.body.icon;
            console.log('使用图标参数:', iconParam);
            
            if (iconParam.startsWith('data:image/')) {
                // 如果是Base64编码的图标，保存到临时文件
                const base64Data = iconParam.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                tempIconFile = path.join(__dirname, 'temp-icon.png');
                fs.writeFileSync(tempIconFile, buffer);
                iconParam = tempIconFile;
                console.log('保存Base64图标到临时文件:', tempIconFile);
            } else if (iconParam.startsWith('http://') || iconParam.startsWith('https://')) {
                // 如果是URL形式的图标，直接传递给生成脚本
                console.log('使用URL形式的图标:', iconParam);
            }
        }
        
        const { exec } = require('child_process');
        const projectDir = `build/${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        console.log('执行生成脚本:', `node generate-pwa.js "${url}" "${name}" "${iconParam}"`);
        
        exec(`node generate-pwa.js "${url}" "${name}" "${iconParam}"`, (error, stdout, stderr) => {
            try {
                if (error) {
                    console.error('执行生成脚本失败:', error);
                    console.error('stderr:', stderr);
                    return res.status(500).json({ error: 'Failed to generate PWA project', details: stderr });
                }
                
                console.log('stdout:', stdout);
                
                if (stderr) {
                    console.error('生成脚本警告:', stderr);
                }
                
                console.log('生成成功，项目目录:', projectDir);
                
                res.json({
                    success: true,
                    message: 'PWA project generated successfully',
                    projectDir,
                    files: [
                        `${projectDir}/index.html`,
                        `${projectDir}/manifest.json`,
                        `${projectDir}/service-worker.js`,
                        `${projectDir}/icons/icon-512x512.png`
                    ]
                });
            } catch (error) {
                console.error('处理生成结果失败:', error);
                res.status(500).json({ error: 'Failed to process PWA generation result' });
            } finally {
                // 清理临时文件
                if (tempIconFile && fs.existsSync(tempIconFile)) {
                    try {
                        fs.unlinkSync(tempIconFile);
                        console.log('清理临时文件:', tempIconFile);
                    } catch (error) {
                        console.error('清理临时文件失败:', error);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error generating PWA:', error);
        res.status(500).json({ error: 'Failed to generate PWA project' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
