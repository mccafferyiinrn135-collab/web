from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
import re
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Comment, EmailVerification, Post, PostLike


class BlogApiTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(
            username="admin",
            password="admin123456",
            is_staff=True,
        )
        self.category = Category.objects.create(name="Django")
        self.published_post = Post.objects.create(
            title="Published post",
            summary="Visible summary",
            content="Visible content",
            category=self.category,
            author=self.admin,
            status=Post.Status.PUBLISHED,
        )
        self.draft_post = Post.objects.create(
            title="Draft post",
            summary="Hidden summary",
            content="Hidden content",
            category=self.category,
            author=self.admin,
            status=Post.Status.DRAFT,
        )

    def test_public_post_list_only_shows_published_posts(self):
        response = self.client.get("/api/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in response.data["results"]]
        self.assertIn(self.published_post.title, titles)
        self.assertNotIn(self.draft_post.title, titles)

    def test_staff_can_create_post(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            "/api/posts/",
            {
                "title": "New admin post",
                "summary": "Created through API",
                "content": "Long enough body",
                "category": self.category.id,
                "status": Post.Status.PUBLISHED,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Post.objects.filter(title="New admin post").exists())

    def test_public_comment_is_pending(self):
        response = self.client.post(
            "/api/comments/",
            {
                "post": self.published_post.id,
                "name": "Reader",
                "email": "reader@example.com",
                "content": "This is a useful comment.",
                "is_approved": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get(name="Reader")
        self.assertFalse(comment.is_approved)

    def test_authenticated_user_can_comment_without_name_and_email(self):
        author = get_user_model().objects.create_user(
            username="commenter",
            email="commenter@example.com",
            password="authorpass123",
        )
        self.client.force_authenticate(author)

        response = self.client.post(
            "/api/comments/",
            {
                "post": self.published_post.id,
                "content": "Logged in comment.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get(content="Logged in comment.")
        self.assertEqual(comment.name, "commenter")
        self.assertEqual(comment.email, "commenter@example.com")
        self.assertFalse(comment.is_approved)

    def test_same_visitor_can_like_post_once(self):
        url = f"/api/posts/{self.published_post.slug}/like/"

        first = self.client.post(url, {"visitor_id": "visitor-a"}, format="json")
        second = self.client.post(url, {"visitor_id": "visitor-a"}, format="json")
        third = self.client.post(url, {"visitor_id": "visitor-b"}, format="json")

        self.published_post.refresh_from_db()
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(third.status_code, status.HTTP_200_OK)
        self.assertFalse(first.data["already_liked"])
        self.assertTrue(second.data["already_liked"])
        self.assertEqual(self.published_post.likes_count, 2)
        self.assertEqual(PostLike.objects.filter(post=self.published_post).count(), 2)

    def test_like_requires_visitor_id(self):
        response = self.client.post(
            f"/api/posts/{self.published_post.slug}/like/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_registration_sends_email_code_and_verification_returns_tokens(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newadmin",
                "email": "newadmin@example.com",
                "password": "newpass123456",
                "password_confirm": "newpass123456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["verification_required"])
        self.assertNotIn("access", response.data)
        user = get_user_model().objects.get(username="newadmin")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_active)
        self.assertTrue(user.check_password("newpass123456"))
        self.assertEqual(len(mail.outbox), 1)

        code = re.search(r"(\d{6})", mail.outbox[0].body).group(1)
        verification = self.client.post(
            "/api/auth/verify-email/",
            {
                "username": "newadmin",
                "email": "newadmin@example.com",
                "code": code,
            },
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(verification.status_code, status.HTTP_200_OK)
        self.assertIn("access", verification.data)
        self.assertIn("refresh", verification.data)
        self.assertTrue(user.is_active)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_registration_verification_rejects_wrong_code(self):
        self.client.post(
            "/api/auth/register/",
            {
                "username": "wrongcode",
                "email": "wrongcode@example.com",
                "password": "newpass123456",
                "password_confirm": "newpass123456",
            },
            format="json",
        )

        response = self.client.post(
            "/api/auth/verify-email/",
            {
                "username": "wrongcode",
                "email": "wrongcode@example.com",
                "code": "000000",
            },
            format="json",
        )

        user = get_user_model().objects.get(username="wrongcode")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(user.is_active)
        self.assertEqual(EmailVerification.objects.get(user=user).attempts, 1)

        resend = self.client.post(
            "/api/auth/resend-verification/",
            {
                "username": "wrongcode",
                "email": "wrongcode@example.com",
            },
            format="json",
        )

        self.assertEqual(resend.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

    def test_registered_user_can_create_and_only_manage_own_posts(self):
        author = get_user_model().objects.create_user(
            username="author",
            password="authorpass123",
        )
        self.client.force_authenticate(author)

        created = self.client.post(
            "/api/posts/",
            {
                "title": "Author post",
                "summary": "Owned by author",
                "content": "Author content",
                "category": self.category.id,
                "status": Post.Status.DRAFT,
                "is_featured": True,
            },
            format="json",
        )
        mine = self.client.get("/api/posts/?mine=1")
        category_create = self.client.post(
            "/api/categories/",
            {"name": "Private category"},
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        post = Post.objects.get(title="Author post")
        self.assertEqual(post.author, author)
        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertFalse(post.is_featured)
        self.assertEqual(category_create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual([item["title"] for item in mine.data["results"]], ["Author post"])

    def test_admin_can_manage_accounts(self):
        author = get_user_model().objects.create_user(
            username="managed-author",
            email="author@example.com",
            password="authorpass123",
        )
        self.client.force_authenticate(self.admin)

        account_list = self.client.get("/api/accounts/")
        updated = self.client.patch(
            f"/api/accounts/{author.id}/",
            {"is_staff": True, "is_active": False, "email": "changed@example.com"},
            format="json",
        )

        author.refresh_from_db()
        usernames = [item["username"] for item in account_list.data["results"]]
        self.assertEqual(account_list.status_code, status.HTTP_200_OK)
        self.assertIn("managed-author", usernames)
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertTrue(author.is_staff)
        self.assertFalse(author.is_active)
        self.assertEqual(author.email, "changed@example.com")

    def test_non_staff_cannot_manage_accounts(self):
        author = get_user_model().objects.create_user(
            username="plain-author",
            password="authorpass123",
        )
        self.client.force_authenticate(author)

        response = self.client.get("/api/accounts/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_lock_or_delete_own_account(self):
        self.client.force_authenticate(self.admin)

        demote = self.client.patch(
            f"/api/accounts/{self.admin.id}/",
            {"is_staff": False},
            format="json",
        )
        deactivate = self.client.patch(
            f"/api/accounts/{self.admin.id}/",
            {"is_active": False},
            format="json",
        )
        delete = self.client.delete(f"/api/accounts/{self.admin.id}/")

        self.admin.refresh_from_db()
        self.assertEqual(demote.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(deactivate.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self.admin.is_staff)
        self.assertTrue(self.admin.is_active)

# Create your tests here.
