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
app.use(express.static(__dirname));

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
        const icons = ['https://images.3354797.com/wsd-images-prod/winbdtf2/merchant_resource/appdownloadicon/app_download_icon_winbdtf2_20251022164200.png'];
        
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
            
            // 查找img标签中class包含icon的图片（优先）
            console.log('查找img标签中class包含icon的图片');
            $('img').each((i, el) => {
                try {
                    const src = $(el).attr('src');
                    const className = $(el).attr('class');
                    if (src && className && className.includes('icon')) {
                        const imgUrl = new URL(src, url).href;
                        icons.push(imgUrl);
                        console.log(`找到class包含icon的图片: ${imgUrl}, class: ${className}`);
                    }
                } catch (e) {
                    console.error('处理img标签失败:', e);
                }
            });
            
        } catch (error) {
            console.error('获取网页内容失败:', error);
            // 即使获取网页内容失败，也返回用户提到的图标
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
            icons: ['https://images.3354797.com/wsd-images-prod/winbdtf2/merchant_resource/appdownloadicon/app_download_icon_winbdtf2_20251022164200.png']
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
        
        console.log('生成PWA项目:', { url, name, hasIconFile: !!iconFile });
        
        // 调用生成脚本
        let iconParam = 'default';
        let tempIconFile = null;
        
        if (iconFile) {
            // 如果有上传的文件，使用文件路径
            iconParam = iconFile.path;
            tempIconFile = iconFile.path;
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
        
        try {
            console.log('执行生成脚本:', `node generate-pwa.js "${url}" "${name}" "${iconParam}"`);
            execSync(`node generate-pwa.js "${url}" "${name}" "${iconParam}"`, {
                stdio: 'inherit'
            });
        } finally {
            // 清理临时文件
            if (tempIconFile && fs.existsSync(tempIconFile)) {
                fs.unlinkSync(tempIconFile);
                console.log('清理临时文件:', tempIconFile);
            }
        }
        
        const projectDir = `build/${name.toLowerCase().replace(/\s+/g, '-')}`;
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
        console.error('Error generating PWA:', error);
        res.status(500).json({ error: 'Failed to generate PWA project' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
