from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Category, Comment, Post


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("id", "username", "first_name", "last_name")


class AccountSerializer(serializers.ModelSerializer):
    posts_count = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "is_active",
            "date_joined",
            "last_login",
            "posts_count",
        )
        read_only_fields = (
            "id",
            "username",
            "is_superuser",
            "date_joined",
            "last_login",
            "posts_count",
        )

    def get_posts_count(self, obj):
        return getattr(obj, "posts_count", obj.posts.count())


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = get_user_model()
        fields = ("id", "username", "email", "password", "password_confirm")
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "两次输入的密码不一致。"})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = get_user_model()(**validated_data)
        user.is_staff = False
        user.is_active = False
        user.set_password(password)
        user.save()
        return user


class VerifyEmailSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


class ResendEmailVerificationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()


class CategorySerializer(serializers.ModelSerializer):
    posts_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_active",
            "ordering",
            "posts_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class CommentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    post_title = serializers.CharField(source="post.title", read_only=True)

    class Meta:
        model = Comment
        fields = (
            "id",
            "post",
            "post_title",
            "name",
            "email",
            "content",
            "is_approved",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_post(self, post):
        if post.status != Post.Status.PUBLISHED:
            raise serializers.ValidationError("Comments are only allowed on published posts.")
        return post

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if self.instance is None and user and user.is_authenticated:
            attrs["name"] = attrs.get("name") or user.get_full_name() or user.username
            attrs["email"] = attrs.get("email") or user.email
            return attrs
        if self.instance is None and not attrs.get("name"):
            raise serializers.ValidationError({"name": "请填写昵称。"})
        return attrs


class ApprovedCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ("id", "name", "content", "created_at")


class PostListSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    comments_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "cover_image",
            "cover_image_url",
            "category",
            "author",
            "status",
            "is_featured",
            "views_count",
            "likes_count",
            "comments_count",
            "published_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return ""
        request = self.context.get("request")
        url = obj.cover_image.url
        return request.build_absolute_uri(url) if request else url


class PostDetailSerializer(PostListSerializer):
    comments = ApprovedCommentSerializer(many=True, read_only=True)

    class Meta(PostListSerializer.Meta):
        fields = PostListSerializer.Meta.fields + ("content", "comments")


class PostWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "content",
            "cover_image",
            "category",
            "status",
            "is_featured",
            "published_at",
        )
        read_only_fields = ("id",)


class BlogStatsSerializer(serializers.Serializer):
    posts_total = serializers.IntegerField()
    posts_published = serializers.IntegerField()
    posts_draft = serializers.IntegerField()
    categories_total = serializers.IntegerField()
    comments_total = serializers.IntegerField()
    comments_pending = serializers.IntegerField()
    accounts_total = serializers.IntegerField()
    accounts_active = serializers.IntegerField()
    views_total = serializers.IntegerField()
    likes_total = serializers.IntegerField()
    latest_posts = PostListSerializer(many=True)
