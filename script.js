// 监听网址输入，自动解析标题和图标
document.getElementById('url').addEventListener('input', function(e) {
    const url = e.target.value;
    if (url) {
        fetch(`/get-title?url=${encodeURIComponent(url)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('解析失败');
                }
                return response.json();
            })
            .then(data => {
                if (data.title) {
                    document.getElementById('name').value = data.title;
                }
                if (data.icons && data.icons.length > 0) {
                    displayIcons(data.icons);
                } else {
                    clearIcons();
                }
            })
            .catch(error => {
                console.error('解析标题失败:', error);
                clearIcons();
            });
    }
});

// 显示解析的图标
function displayIcons(icons) {
    const iconsContainer = document.getElementById('iconsContainer');
    if (!iconsContainer) {
        const container = document.createElement('div');
        container.id = 'iconsContainer';
        container.innerHTML = '<h3>解析到的图标</h3><div id="iconsList"></div>';
        container.style.textAlign = 'center';
        // 将图标容器放在生成PWA项目按钮的上面
        const form = document.getElementById('pwaForm');
        const submitButton = form.querySelector('button[type="submit"]');
        form.insertBefore(container, submitButton);
    }
    
    const iconsList = document.getElementById('iconsList');
    iconsList.innerHTML = '';
    iconsList.style.display = 'flex';
    iconsList.style.justifyContent = 'center';
    iconsList.style.flexWrap = 'wrap';
    
    icons.forEach((icon, index) => {
        const iconItem = document.createElement('div');
        iconItem.className = 'icon-item';
        iconItem.style.margin = '10px';
        iconItem.style.cursor = 'pointer';
        iconItem.title = '点击选择此图标';
        // 移除选择按钮，通过点击图片选择
        iconItem.innerHTML = `
            <img src="${icon}" alt="Icon ${index + 1}" style="width: 64px; height: 64px; margin: 5px;">
        `;
        // 添加点击事件
        iconItem.addEventListener('click', () => selectIcon(icon));
        iconsList.appendChild(iconItem);
    });
    
    // 自动选择第一个图标
    if (icons.length > 0) {
        selectIcon(icons[0]);
    }
}

// 清空解析的图标
function clearIcons() {
    const iconsContainer = document.getElementById('iconsContainer');
    if (iconsContainer) {
        iconsContainer.remove();
    }
}

// 选择图标
function selectIcon(iconUrl) {
    // 存储图标URL，供提交时使用
    window.selectedIcon = iconUrl;
    
    // 更新UI，显示已选择的图标
    const iconsList = document.getElementById('iconsList');
    const iconItems = iconsList.querySelectorAll('.icon-item');
    iconItems.forEach(item => {
        item.style.border = '';
    });
    
    // 找到被选择的图标项并高亮显示
    const selectedItem = Array.from(iconItems).find(item => {
        const img = item.querySelector('img');
        return img && img.src === iconUrl;
    });
    
    if (selectedItem) {
        selectedItem.style.border = '2px solid blue';
    }
}

// 监听文件上传
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // 创建临时URL用于预览
            const tempUrl = e.target.result;
            
            // 显示预览
            const iconsContainer = document.getElementById('iconsContainer') || createIconsContainer();
            const iconsList = document.getElementById('iconsList');
            iconsList.innerHTML = '';
            iconsList.style.display = 'flex';
            iconsList.style.justifyContent = 'center';
            iconsList.style.flexWrap = 'wrap';
            
            const iconItem = document.createElement('div');
            iconItem.className = 'icon-item';
            iconItem.style.margin = '10px';
            iconItem.innerHTML = `
                <img src="${tempUrl}" alt="Selected Icon" style="width: 64px; height: 64px; margin: 5px;">
                <p>本地文件已选择</p>
            `;
            iconsList.appendChild(iconItem);
            
            // 存储文件对象，供提交时使用
            window.selectedIconFile = file;
        };
        reader.readAsDataURL(file);
    }
}

// 创建图标容器
function createIconsContainer() {
    const container = document.createElement('div');
    container.id = 'iconsContainer';
    container.innerHTML = '<h3>解析到的图标</h3><div id="iconsList"></div>';
    container.style.textAlign = 'center';
    // 将图标容器放在生成PWA项目按钮的上面
    const form = document.getElementById('pwaForm');
    const submitButton = form.querySelector('button[type="submit"]');
    form.insertBefore(container, submitButton);
    return container;
}

document.getElementById('pwaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const url = document.getElementById('url').value;
    const name = document.getElementById('name').value;
    
    generatePWAProject(url, name);
});

function generatePWAProject(url, name) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<h2>生成中...</h2><p>正在创建PWA项目文件，请稍候...</p>';
    resultDiv.style.display = 'block';
    
    // 检查是否有选择的本地文件
    if (window.selectedIconFile) {
        // 使用FormData发送文件
        const formData = new FormData();
        formData.append('url', url);
        formData.append('name', name);
        formData.append('iconFile', window.selectedIconFile);
        
        fetch('/generate-pwa', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('生成失败');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                resultDiv.innerHTML = `
                    <h2>生成成功！</h2>
                    <p>项目名称: ${name}</p>
                    <p>封装网址: ${url}</p>
                    <p>生成目录: ${data.projectDir}</p>
                    <p class="success">PWA项目已成功生成，包含以下文件：</p>
                    <ul>
                        ${data.files.map(file => `<li>${file}</li>`).join('')}
                    </ul>
                    <p>您可以将生成的目录部署到任何静态网站托管服务。</p>
                `;
            } else {
                resultDiv.innerHTML = `
                    <h2>生成失败</h2>
                    <p class="error">${data.error || '未知错误'}</p>
                `;
            }
        })
        .catch(error => {
            resultDiv.innerHTML = `
                <h2>生成失败</h2>
                <p class="error">${error.message}</p>
            `;
        });
    } else {
        // 使用JSON发送普通请求
        const icon = window.selectedIcon || 'default';
        
        fetch('/generate-pwa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, name, icon })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('生成失败');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                resultDiv.innerHTML = `
                    <h2>生成成功！</h2>
                    <p>项目名称: ${name}</p>
                    <p>封装网址: ${url}</p>
                    <p>生成目录: ${data.projectDir}</p>
                    <p class="success">PWA项目已成功生成，包含以下文件：</p>
                    <ul>
                        ${data.files.map(file => `<li>${file}</li>`).join('')}
                    </ul>
                    <p>您可以将生成的目录部署到任何静态网站托管服务。</p>
                `;
            } else {
                resultDiv.innerHTML = `
                    <h2>生成失败</h2>
                    <p class="error">${data.error || '未知错误'}</p>
                `;
            }
        })
        .catch(error => {
            resultDiv.innerHTML = `
                <h2>生成失败</h2>
                <p class="error">${error.message}</p>
            `;
        });
    }
}

