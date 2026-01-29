# PWA URL Wrapper

一个将任何网址封装成PWA（Progressive Web App）项目的工具。

## 功能特点

- 将任何网址封装成独立的PWA应用
- 支持自定义项目名称和图标
- 生成完整的PWA项目结构，包括：
  - 主页面（index.html）
  - PWA配置文件（manifest.json）
  - 服务工作线程（service-worker.js）
  - 图标文件
- 生成的项目可直接部署到任何静态网站托管服务

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动工具

```bash
npm start
```

工具会在浏览器中打开，默认地址为 `http://localhost:3000`。

### 使用方法

1. 在工具界面中输入以下信息：
   - **网址**：要封装的网址，例如 `https://www.doubao.com/chat/36767892034944258`
   - **项目名称**：生成的PWA应用名称，例如 `Doubao Chat`
   - **图标选择**：选择应用图标类型

2. 点击「生成PWA项目」按钮

3. 工具会在build文件夹中生成一个包含完整PWA项目结构的目录

## 生成的项目结构

```
build/project-name/
├── index.html          # 主页面，包含iframe加载原始网址
├── manifest.json       # PWA配置文件
├── service-worker.js   # 服务工作线程，实现离线功能
└── icons/
    ├── icon-192x192.png  # 192x192尺寸图标
    └── icon-512x512.png  # 512x512尺寸图标
```

## 部署指南

生成的PWA项目是一个纯静态网站，可以部署到任何静态网站托管服务，例如：

- GitHub Pages
- Vercel
- Netlify
- AWS S3
- 阿里云OSS
- 腾讯云COS

### 部署步骤

1. 将生成的项目目录上传到托管服务
2. 确保启用HTTPS（PWA要求）
3. 访问部署后的网址，即可使用PWA应用

## 示例

本项目包含一个示例PWA项目，位于 `pwa-example/` 目录，演示了如何封装 `https://www.doubao.com/chat` 为PWA应用。

## 技术说明

- **前端框架**：纯HTML5 + CSS3 + JavaScript
- **PWA特性**：
  - 可安装到主屏幕
  - 离线访问能力
  - 独立的应用体验
- **构建工具**：无，纯静态项目

## 注意事项

1. 生成的PWA应用会通过iframe加载原始网址，某些网站可能会设置 `X-Frame-Options` 头阻止iframe加载
2. 为了获得最佳体验，建议选择响应式设计的网址进行封装
3. 部署时必须使用HTTPS协议，否则PWA特性可能无法正常工作

## 许可证

MIT License