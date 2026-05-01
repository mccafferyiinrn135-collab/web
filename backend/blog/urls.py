from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountViewSet,
    BlogStatsView,
    CategoryViewSet,
    CommentViewSet,
    MeView,
    PostViewSet,
    RegisterView,
    ResendEmailVerificationView,
    VerifyEmailView,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("posts", PostViewSet, basename="post")
router.register("comments", CommentViewSet, basename="comment")
router.register("accounts", AccountViewSet, basename="account")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("auth/resend-verification/", ResendEmailVerificationView.as_view(), name="auth-resend-verification"),
    path("stats/", BlogStatsView.as_view(), name="blog-stats"),
]
