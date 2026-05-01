# Django 前后端分离博客系统

## 技术栈

- 后端：Django 5 + JSON 数据接口
- 认证：JWT
- 数据库：SQLite
- 前端：独立 HTML/CSS/JavaScript SPA

## 目录结构

```text
backend/      Django 后端项目
frontend/     独立前端页面
requirements.txt
```

## 本地运行

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed_demo
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

另开一个终端启动前端：

```powershell
cd frontend
python -m http.server 5173 --bind 127.0.0.1
```

访问地址：

- 前端：http://127.0.0.1:5173
- Django Admin：http://127.0.0.1:8000/admin/

演示管理员：

- 用户名：admin
- 密码：admin123456
