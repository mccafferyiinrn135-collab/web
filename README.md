# Django Blog Template

一个使用 Django + 独立静态前端开发的个人博客系统。项目采用前后端分离思路：后端只提供 JSON 数据接口和 Django Admin，前端使用原生 HTML / CSS / JavaScript 构建页面、交互、Markdown 文章编辑器和后台管理界面。

## 项目特点

- 前后端分离：前端静态文件独立部署，后端接口统一走 `/api`。
- 个人博客主题：参考 Butterfly 风格，包含二次元背景、白天/夜间模式、菜单图标、相册、说说、留言等页面。
- 文章系统：支持文章列表、详情页、分类筛选、搜索、阅读量、点赞、封面图和附件。
- Markdown 编辑器：发布文章是独立页面，支持标题、摘要、分类、封面、附件、Markdown 排版、代码块和实时预览。
- 代码块复制：文章详情中的代码块会显示语言标签和复制按钮。
- 用户体系：支持注册、登录、JWT 鉴权、个人资料、头像、微信/QQ 图标和二维码图片。
- 作者权限：普通注册用户可以发布文章、查看自己的文章、编辑和删除自己的文章。
- 管理员后台：管理员可以管理文章、分类、评论、账号和站点统计。
- 评论系统：登录用户评论时自动使用账号昵称、邮箱和头像；游客仍可填写昵称评论。
- AI 自动审核：评论会按合规规则自动审核，安全评论自动通过，风险评论进入人工审核。
- 点赞限制：同一访客对同一篇文章只能点赞一次。
- 留言页：支持本地留言气泡、纸飞机发送按钮、背景图和流星动画。

## 技术栈

### 后端

- Python 3
- Django 5
- Django JSON API
- Simple JWT
- SQLite
- Pillow
- CORS Headers

### 前端

- HTML
- CSS
- JavaScript
- 原生 Markdown 渲染逻辑
- 响应式布局
- 静态资源部署

### 生产部署

- Ubuntu 24.04
- Nginx
- Gunicorn
- systemd
- SQLite 或可替换为 MySQL/PostgreSQL

## 目录结构

```text
.
├── backend/
│   ├── blog/
│   │   ├── migrations/          # 数据库迁移
│   │   ├── comment_moderation.py# 评论自动审核规则
│   │   ├── models.py            # 文章、分类、评论、点赞、用户资料等模型
│   │   ├── serializers.py       # JSON 序列化
│   │   ├── views.py             # API 视图
│   │   └── urls.py              # API 路由
│   ├── config/
│   │   └── settings.py          # Django 配置
│   └── manage.py
├── frontend/
│   ├── assets/                  # 图片、图标和背景资源
│   ├── index.html               # 首页和主要页面
│   ├── article.html             # 独立文章详情页
│   ├── editor.html              # 独立文章发布/编辑页
│   ├── app.js                   # 首页、后台、留言、个人设置逻辑
│   ├── article.js               # 文章详情页逻辑
│   ├── editor.js                # Markdown 编辑器逻辑
│   └── styles.css               # 全站样式
├── requirements.txt             # Python 依赖
├── requirements.md              # 原始需求文档
└── README.md
```

## 核心功能

## 1. 首页

- 顶部菜单：主页、时间轴、更多、分类、相册、说说、留言、登录。
- 菜单前带图标。
- 白天/夜间模式切换。
- 首页标题和个人简介打字机效果。
- 右侧个人资料卡，显示头像、昵称、简介、微信和 QQ 图标。
- 微信/QQ 图标 hover 时显示对应图片。
- 最新文章、文章分类和标签组件。

## 2. 文章

- 文章列表。
- 文章详情独立页面：`article.html?post=<slug>`。
- 文章顶部显示作者头像和作者昵称。
- 文章底部显示文章作者、类型和本文链接。
- 支持封面图。
- 支持附件下载。
- 支持 Markdown 内容。
- 支持代码块复制。
- 支持阅读量统计。
- 支持点赞，同一访客只能点一次。

## 3. 发布文章

文章发布已经拆成独立页面：

```text
frontend/editor.html
```

支持：

- 标题
- 摘要
- Markdown 正文
- 分类选择
- 封面图上传
- 多附件上传
- 管理员设置草稿/发布
- 管理员设置推荐
- 实时预览
- Markdown 工具栏
- 代码块插入

示例代码块：

````markdown
```c
#include <stdio.h>

int main(void) {
    printf("Hello, Open Blog!\n");
    return 0;
}
```
````

## 4. 用户和权限

### 游客

- 浏览公开文章。
- 查看分类、相册、说说和留言页。
- 可以提交评论，但需要通过审核后展示。

### 普通用户

- 注册和登录。
- 发布文章。
- 编辑自己的文章。
- 删除自己的文章。
- 查看自己的文章列表。
- 设置个人头像、昵称、简介、微信、QQ 和二维码图片。
- 评论时自动使用账号昵称、邮箱和头像。

### 管理员

- 管理全部文章。
- 管理分类。
- 审核和删除评论。
- 管理账号。
- 查看统计数据。
- 设置文章为草稿、发布、推荐。

## 5. 评论自动审核规则

评论提交后会先经过自动审核规则：

> 评论不得违反中华人民共和国现行法律法规及公序良俗；不得包含危害国家安全、暴力恐怖、诈骗赌博、色情低俗、毒品枪支等违法交易、侵犯隐私、侮辱诽谤、仇恨歧视、恶意广告、教唆犯罪、泄露他人个人信息等内容。

处理结果：

- 合规评论：自动批准并展示。
- 命中风险词、外部链接或异常重复符号：进入人工审核。
- 管理员可在后台手动通过或删除评论。

审核逻辑在：

```text
backend/blog/comment_moderation.py
```

## 主要接口

接口统一以 `/api` 开头。

| 功能 | 方法 | 地址 |
| --- | --- | --- |
| 注册 | POST | `/api/auth/register/` |
| 登录 | POST | `/api/auth/token/` |
| 当前用户 | GET/PATCH | `/api/auth/me/` |
| 文章列表 | GET | `/api/posts/` |
| 文章详情 | GET | `/api/posts/<slug>/` |
| 新建文章 | POST | `/api/posts/` |
| 编辑文章 | PATCH | `/api/posts/<slug>/` |
| 删除文章 | DELETE | `/api/posts/<slug>/` |
| 点赞 | POST | `/api/posts/<slug>/like/` |
| 分类 | GET/POST | `/api/categories/` |
| 评论 | GET/POST | `/api/comments/` |
| 通过评论 | POST | `/api/comments/<id>/approve/` |
| 账号管理 | GET/PATCH/DELETE | `/api/accounts/` |
| 统计数据 | GET | `/api/stats/` |

## 本地开发

### 1. 创建虚拟环境

Windows PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Linux / macOS：

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
```

### 2. 初始化数据库

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py migrate
```

Linux / macOS：

```bash
cd backend
../.venv/bin/python manage.py migrate
```

### 3. 创建管理员

不要把真实管理员密码提交到 GitHub。请在本地或服务器上自行创建：

```powershell
..\.venv\Scripts\python.exe manage.py createsuperuser
```

Linux / macOS：

```bash
../.venv/bin/python manage.py createsuperuser
```

### 4. 启动后端

```powershell
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

### 5. 启动前端

前端默认请求同源 `/api`，生产环境由 Nginx 反向代理到 Django。  
本地开发时可以使用反向代理，或者临时把前端 JS 中的：

```js
const API_BASE = "/api";
```

改为：

```js
const API_BASE = "http://127.0.0.1:8000/api";
```

然后启动静态文件服务：

```powershell
cd frontend
python -m http.server 5173 --bind 127.0.0.1
```

访问：

```text
http://127.0.0.1:5173
```

## 环境变量

生产环境建议通过环境变量覆盖默认配置：

```bash
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=example.com,www.example.com,127.0.0.1
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
```

说明：

- `DJANGO_SECRET_KEY`：生产环境必须使用强随机密钥。
- `DJANGO_DEBUG`：生产环境必须设为 `false`。
- `DJANGO_ALLOWED_HOSTS`：允许访问的域名或 IP。
- `CORS_ALLOWED_ORIGINS`：允许跨域访问的前端地址。
- `CSRF_TRUSTED_ORIGINS`：可信任的 CSRF 来源。

## 部署参考

以下为 Ubuntu + Nginx + Gunicorn 的常见部署方式，路径可按实际情况调整。

### 1. 安装基础依赖

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx
```

### 2. 安装 Python 依赖

```bash
cd /opt/django-blog
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
./.venv/bin/pip install gunicorn
```

### 3. 初始化 Django

```bash
cd /opt/django-blog/backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py collectstatic
../.venv/bin/python manage.py createsuperuser
```

### 4. systemd 服务示例

```ini
[Unit]
Description=Django Blog Template
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/django-blog/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings"
Environment="DJANGO_DEBUG=false"
Environment="DJANGO_SECRET_KEY=replace-with-a-strong-secret"
ExecStart=/opt/django-blog/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable django-blog
sudo systemctl start django-blog
```

### 5. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /opt/django-blog/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /opt/django-blog/backend/media/;
    }

    location /static/ {
        alias /opt/django-blog/backend/staticfiles/;
    }
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 测试

后端测试：

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test
```

前端脚本语法检查：

```powershell
node --check frontend\app.js
node --check frontend\article.js
node --check frontend\editor.js
```

## 媒体文件

上传文件默认保存在：

```text
backend/media/
```

常见子目录：

```text
backend/media/avatars/          # 用户头像
backend/media/covers/           # 文章封面
backend/media/attachments/      # 文章附件
backend/media/profiles/wechat/  # 微信二维码
backend/media/profiles/qq/      # QQ 二维码
```

这些文件不建议提交到 GitHub，应由服务器持久化保存。

## 安全说明

- 不要把服务器密码、数据库文件、管理员密码、JWT 密钥提交到 GitHub。
- 生产环境必须设置 `DJANGO_DEBUG=false`。
- 生产环境必须设置强随机 `DJANGO_SECRET_KEY`。
- 管理员密码应通过 `createsuperuser` 或 `changepassword` 设置。
- `backend/db.sqlite3`、`backend/media/`、`.env` 已加入 `.gitignore`。

## 后续可优化方向

- 接入真正的第三方 AI 内容审核服务。
- 增加评论审核原因字段。
- 增加文章草稿自动保存。
- 增加图片懒加载和资源压缩。
- 增加 Docker 部署配置。
- 增加 HTTPS 证书自动续期说明。
