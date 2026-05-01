from django.contrib import admin

from .models import Category, Comment, EmailVerification, Post, PostLike


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "ordering", "updated_at")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "description")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "author",
        "status",
        "is_featured",
        "views_count",
        "likes_count",
        "published_at",
    )
    list_filter = ("status", "is_featured", "category", "published_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "summary", "content")
    readonly_fields = ("views_count", "likes_count", "created_at", "updated_at")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("name", "post", "is_approved", "created_at")
    list_filter = ("is_approved", "created_at")
    search_fields = ("name", "email", "content", "post__title")
    actions = ("approve_comments",)

    @admin.action(description="Approve selected comments")
    def approve_comments(self, request, queryset):
        queryset.update(is_approved=True)


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ("post", "visitor_id", "created_at")
    search_fields = ("post__title", "visitor_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ("email", "user", "verified_at", "attempts", "expires_at", "created_at")
    list_filter = ("verified_at", "expires_at", "created_at")
    search_fields = ("email", "user__username")
    readonly_fields = ("created_at", "updated_at", "code_hash")
