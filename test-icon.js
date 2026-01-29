const axios = require('axios');

// 测试生成PWA项目，包含解析的图标
async function testGeneratePWA() {
    try {
        const url = 'https://www.29winbd.com/m/index.html?affiliateCode=code1502&fbPixelId=33119121294397957';
        const name = 'WINBD-Test';
        const icon = 'https://images.3354797.com/wsd-images-prod/winbdtf2/merchant_resource/appdownloadicon/app_download_icon_winbdtf2_20251022164200.png';
        
        console.log('测试生成PWA项目：');
        console.log('URL:', url);
        console.log('名称:', name);
        console.log('图标:', icon);
        
        const response = await axios.post('http://localhost:3000/generate-pwa', {
            url,
            name,
            icon
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n生成成功！');
        console.log('响应:', response.data);
        
    } catch (error) {
        console.error('生成失败:', error);
    }
}

testGeneratePWA();
