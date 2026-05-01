from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from blog.models import Category, Comment, Post


class Command(BaseCommand):
    help = "Create demo admin, categories, posts, and comments."

    def handle(self, *args, **options):
        user_model = get_user_model()
        admin, created = user_model.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("admin123456")
            admin.save()
        else:
            changed = False
            if not admin.is_staff:
                admin.is_staff = True
                changed = True
            if not admin.is_superuser:
                admin.is_superuser = True
                changed = True
            if changed:
                admin.save()

        django, _ = Category.objects.get_or_create(
            name="Django",
            defaults={"description": "Django backend notes.", "ordering": 1},
        )
        frontend, _ = Category.objects.get_or_create(
            name="Frontend",
            defaults={"description": "Separated frontend implementation notes.", "ordering": 2},
        )

        first_post, _ = Post.objects.get_or_create(
            title="Django 后端开发记录",
            defaults={
                "summary": "用 Django 搭建文章、分类和评论数据服务。",
                "content": (
                    "这个示例博客采用前后端分离结构。后端负责认证、数据模型和权限控制，"
                    "前端通过 fetch 获取数据并完成文章浏览和管理操作。\n\n"
                    "当前版本包含文章发布、分类维护、评论审核、搜索、分页、点赞和阅读统计。"
                ),
                "category": django,
                "author": admin,
                "status": Post.Status.PUBLISHED,
                "is_featured": True,
            },
        )
        Post.objects.get_or_create(
            title="前端管理面板说明",
            defaults={
                "summary": "管理员登录后可以维护分类、文章状态和评论审核。",
                "content": (
                    "前端项目放在 frontend 目录，使用原生 HTML、CSS 和 JavaScript。"
                    "它与 Django 后端解耦，只依赖统一的数据地址。"
                ),
                "category": frontend,
                "author": admin,
                "status": Post.Status.PUBLISHED,
            },
        )
        Post.objects.get_or_create(
            title="待完善的草稿文章",
            defaults={
                "summary": "草稿不会展示在公开文章列表中。",
                "content": "管理员可以在管理区编辑草稿，并在完成后发布。",
                "category": django,
                "author": admin,
                "status": Post.Status.DRAFT,
            },
        )

        Comment.objects.get_or_create(
            post=first_post,
            name="读者",
            content="这篇文章已经通过审核，会展示在公开详情页。",
            defaults={"email": "reader@example.com", "is_approved": True},
        )
        Comment.objects.get_or_create(
            post=first_post,
            name="待审核用户",
            content="这条评论需要管理员审核。",
            defaults={"email": "pending@example.com", "is_approved": False},
        )

        self.stdout.write(self.style.SUCCESS("Demo data ready. Admin: admin / admin123456"))
