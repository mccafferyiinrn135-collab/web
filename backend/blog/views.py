from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.mail import send_mail
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, F, Prefetch, Q, Sum
from django.utils import timezone
import random
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Category, Comment, EmailVerification, Post, PostLike
from .permissions import (
    IsAdminOrAuthenticatedCreateReadOnly,
    IsAdminOrReadOnly,
    IsAdminUserForWrite,
)
from .serializers import (
    AccountSerializer,
    BlogStatsSerializer,
    CategorySerializer,
    CommentSerializer,
    PostDetailSerializer,
    PostListSerializer,
    PostWriteSerializer,
    RegisterSerializer,
    ResendEmailVerificationSerializer,
    UserBriefSerializer,
    VerifyEmailSerializer,
)


def parse_bool(value):
    if value is None:
        return None
    return str(value).lower() in {"1", "true", "yes", "on"}


def create_email_verification(user):
    code = f"{random.SystemRandom().randint(0, 999999):06d}"
    ttl_minutes = getattr(settings, "EMAIL_VERIFICATION_TTL_MINUTES", 15)
    verification = EmailVerification(
        user=user,
        email=user.email,
        expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
    )
    verification.set_code(code)
    verification.save()
    send_mail(
        "XIAOZHAO 注册验证码",
        f"你的 XIAOZHAO 注册验证码是：{code}\n\n验证码 {ttl_minutes} 分钟内有效。如果不是你本人操作，请忽略这封邮件。",
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    return verification


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["date_joined", "last_login", "username", "is_staff", "is_active"]
    ordering = ["-date_joined"]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return get_user_model().objects.annotate(posts_count=Count("posts", distinct=True))

    def perform_update(self, serializer):
        account = serializer.instance
        data = serializer.validated_data
        if account.pk == self.request.user.pk and (
            data.get("is_staff") is False or data.get("is_active") is False
        ):
            raise PermissionDenied("不能停用或取消自己的管理员权限。")
        if account.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied("不能修改超级管理员账号。")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise PermissionDenied("不能删除当前登录账号。")
        if instance.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied("不能删除超级管理员账号。")
        instance.delete()


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["ordering", "name", "created_at"]

    def get_queryset(self):
        queryset = Category.objects.annotate(
            posts_count=Count(
                "posts",
                filter=Q(posts__status=Post.Status.PUBLISHED),
                distinct=True,
            )
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class PostViewSet(viewsets.ModelViewSet):
    lookup_field = "slug"
    permission_classes = [IsAdminOrAuthenticatedCreateReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "summary", "content", "category__name"]
    ordering_fields = [
        "published_at",
        "created_at",
        "updated_at",
        "views_count",
        "likes_count",
        "title",
    ]
    ordering = ["-published_at", "-created_at"]

    def get_queryset(self):
        approved_comments = Comment.objects.filter(is_approved=True)
        queryset = (
            Post.objects.select_related("category", "author")
            .annotate(
                comments_count=Count(
                    "comments",
                    filter=Q(comments__is_approved=True),
                    distinct=True,
                )
            )
            .prefetch_related(Prefetch("comments", queryset=approved_comments))
        )

        if self.request.user.is_staff:
            pass
        elif self.request.user.is_authenticated and parse_bool(
            self.request.query_params.get("mine")
        ):
            queryset = queryset.filter(author=self.request.user)
        else:
            queryset = queryset.filter(status=Post.Status.PUBLISHED)

        category = self.request.query_params.get("category")
        if category:
            if category.isdigit():
                queryset = queryset.filter(category_id=category)
            else:
                queryset = queryset.filter(category__slug=category)

        featured = parse_bool(self.request.query_params.get("featured"))
        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        requested_status = self.request.query_params.get("status")
        if requested_status and self.request.user.is_staff:
            queryset = queryset.filter(status=requested_status)

        return queryset

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return PostWriteSerializer
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostListSerializer

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            serializer.save(author=self.request.user)
            return
        serializer.save(
            author=self.request.user,
            status=Post.Status.PUBLISHED,
            is_featured=False,
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff:
            Post.objects.filter(pk=instance.pk).update(views_count=F("views_count") + 1)
            instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def like(self, request, slug=None):
        post = self.get_object()
        visitor_id = str(
            request.data.get("visitor_id")
            or request.headers.get("X-Visitor-Id")
            or ""
        ).strip()

        if not visitor_id:
            return Response(
                {"detail": "visitor_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        visitor_id = visitor_id[:80]
        with transaction.atomic():
            _, created = PostLike.objects.get_or_create(
                post=post,
                visitor_id=visitor_id,
            )
            if created:
                Post.objects.filter(pk=post.pk).update(likes_count=F("likes_count") + 1)

        post.refresh_from_db(fields=["likes_count"])
        return Response(
            {
                "likes_count": post.likes_count,
                "liked": True,
                "already_liked": not created,
            },
            status=status.HTTP_200_OK,
        )


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAdminUserForWrite]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "content", "post__title"]
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        queryset = Comment.objects.select_related("post")
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_approved=True)

        post = self.request.query_params.get("post")
        if post:
            if post.isdigit():
                queryset = queryset.filter(post_id=post)
            else:
                queryset = queryset.filter(post__slug=post)

        approved = parse_bool(self.request.query_params.get("approved"))
        if approved is not None and self.request.user.is_staff:
            queryset = queryset.filter(is_approved=approved)

        return queryset

    def perform_create(self, serializer):
        serializer.save(is_approved=False)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        comment = self.get_object()
        comment.is_approved = True
        comment.save(update_fields=["is_approved", "updated_at"])
        return Response(self.get_serializer(comment).data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        create_email_verification(user)
        return Response(
            {
                "detail": "验证码已发送到邮箱，请完成验证后登录。",
                "email": user.email,
                "username": user.username,
                "verification_required": True,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_model = get_user_model()
        try:
            user = user_model.objects.get(
                username=data["username"],
                email=data["email"],
                is_active=False,
            )
        except user_model.DoesNotExist:
            return Response(
                {"detail": "待验证账号不存在或已完成验证。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = (
            EmailVerification.objects.filter(
                user=user,
                email=data["email"],
                verified_at__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )
        if not verification:
            return Response(
                {"detail": "验证码不存在，请重新注册。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if verification.is_expired:
            return Response(
                {"detail": "验证码已过期，请重新注册。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if verification.attempts >= 5:
            return Response(
                {"detail": "验证码错误次数过多，请重新注册。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not verification.check_code(data["code"]):
            verification.attempts = F("attempts") + 1
            verification.save(update_fields=["attempts", "updated_at"])
            return Response(
                {"detail": "验证码不正确。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save(update_fields=["is_active"])
        verification.verified_at = timezone.now()
        verification.save(update_fields=["verified_at", "updated_at"])
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": AccountSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ResendEmailVerificationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_model = get_user_model()
        try:
            user = user_model.objects.get(
                username=data["username"],
                email=data["email"],
                is_active=False,
            )
        except user_model.DoesNotExist:
            return Response(
                {"detail": "待验证账号不存在或已完成验证。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        create_email_verification(user)
        return Response({"detail": "新的验证码已发送到邮箱。"})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(AccountSerializer(request.user).data)


class BlogStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        latest_posts = (
            Post.objects.select_related("category", "author")
            .annotate(
                comments_count=Count(
                    "comments",
                    filter=Q(comments__is_approved=True),
                    distinct=True,
                )
            )
            .order_by("-created_at")[:5]
        )
        data = {
            "posts_total": Post.objects.count(),
            "posts_published": Post.objects.filter(status=Post.Status.PUBLISHED).count(),
            "posts_draft": Post.objects.filter(status=Post.Status.DRAFT).count(),
            "categories_total": Category.objects.count(),
            "comments_total": Comment.objects.count(),
            "comments_pending": Comment.objects.filter(is_approved=False).count(),
            "accounts_total": get_user_model().objects.count(),
            "accounts_active": get_user_model().objects.filter(is_active=True).count(),
            "views_total": Post.objects.aggregate(total=Sum("views_count"))["total"] or 0,
            "likes_total": Post.objects.aggregate(total=Sum("likes_count"))["total"] or 0,
            "latest_posts": latest_posts,
        }
        serializer = BlogStatsSerializer(data, context={"request": request})
        return Response(serializer.data)
