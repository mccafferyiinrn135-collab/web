const API_BASE = "http://127.0.0.1:8000/api";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
let themeMode = localStorage.getItem("themeMode") === "dark" ? "dark" : "light";
let currentUser = null;

function applyTheme() {
  document.documentElement.dataset.theme = themeMode;
  const toggle = $("#themeToggleBtn");
  if (toggle) {
    const isDark = themeMode === "dark";
    const icon = toggle.querySelector("use");
    const label = toggle.querySelector(".theme-label");
    if (icon) icon.setAttribute("href", `./assets/menu-icons.svg#icon-${isDark ? "sun" : "moon"}`);
    if (label) label.textContent = isDark ? "白天" : "夜间";
    toggle.setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到黑夜模式");
  }
}

function toggleTheme() {
  themeMode = themeMode === "dark" ? "light" : "dark";
  localStorage.setItem("themeMode", themeMode);
  applyTheme();
}

function getVisitorId() {
  let visitorId = localStorage.getItem("visitorId");
  if (!visitorId) {
    visitorId =
      crypto.randomUUID?.() ||
      `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("visitorId", visitorId);
  }
  return visitorId;
}

function getLikedPosts() {
  try {
    return JSON.parse(localStorage.getItem("likedPosts") || "[]");
  } catch (error) {
    localStorage.removeItem("likedPosts");
    return [];
  }
}

function hasLikedPost(slug) {
  return getLikedPosts().includes(slug);
}

function markPostLiked(slug) {
  const likedPosts = new Set(getLikedPosts());
  likedPosts.add(slug);
  localStorage.setItem("likedPosts", JSON.stringify([...likedPosts]));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function formatDate(value) {
  if (!value) return "未发布";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const token = localStorage.getItem("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  if (response.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    currentUser = null;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof data === "string" ? data : data.detail || JSON.stringify(data);
    throw new Error(detail || "请求失败");
  }

  return data;
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

async function loadCurrentUser() {
  if (!localStorage.getItem("accessToken")) return null;
  try {
    currentUser = await api("/auth/me/");
  } catch (error) {
    currentUser = null;
  }
  return currentUser;
}

function getCommentIdentity() {
  if (!currentUser) return null;
  return {
    name: currentUser.first_name || currentUser.username,
    email: currentUser.email || "",
  };
}

function renderArticle(post) {
  const comments = post.comments || [];
  const alreadyLiked = hasLikedPost(post.slug);
  const commentIdentity = getCommentIdentity();
  document.title = `${post.title} - XIAOZHAO`;
  $("#articleHeroText").textContent = post.category?.name || "文章详情";

  $("#articleDetail").innerHTML = `
    <button id="detailBackBtn" class="secondary small" type="button">返回列表</button>
    <header class="article-header">
      <h1 class="article-title">${escapeHtml(post.title)}</h1>
      <div class="article-meta">
        <span class="item category">${escapeHtml(post.category?.name || "未分类")}</span>
        <span class="item time">${formatDate(post.published_at)}</span>
        <span class="item views">${post.views_count} 阅读</span>
        <span class="item" id="likeCount">${post.likes_count} 点赞</span>
        <span class="item">${comments.length} 评论</span>
      </div>
      ${post.summary ? `<p class="article-summary">${escapeHtml(post.summary)}</p>` : ""}
    </header>
    ${post.cover_image_url ? `<img class="detail-cover" src="${escapeHtml(post.cover_image_url)}" alt="">` : ""}
    <article class="article-content">${escapeHtml(post.content)}</article>
    <div class="detail-actions">
      <button id="likeBtn" type="button" ${alreadyLiked ? "disabled" : ""}>
        ${alreadyLiked ? "已点赞" : "点赞"}
      </button>
      <button id="copyLinkBtn" class="secondary" type="button">复制链接</button>
    </div>
    <section class="article-comment">
      <div class="title"><h3>评论</h3></div>
      <div class="comment-list">
        ${
          comments.length
            ? comments
                .map(
                  (comment) => `
                    <div class="comment-content">
                      <div class="comment-main">
                        <p>
                          <span class="name">${escapeHtml(comment.name)}</span>
                          <span class="time">${formatDate(comment.created_at)}</span><br>
                          ${escapeHtml(comment.content)}
                        </p>
                      </div>
                    </div>
                  `,
                )
                .join("")
            : `<div class="empty-state compact">暂无已审核评论</div>`
        }
      </div>
      <form id="commentForm" class="stack">
        ${
          commentIdentity
            ? `<p class="comment-login-note">将以 ${escapeHtml(commentIdentity.name)} 的身份评论</p>`
            : `<div class="form-row">
                <label>
                  <span>昵称</span>
                  <input name="name" required maxlength="80" />
                </label>
                <label>
                  <span>邮箱</span>
                  <input name="email" type="email" />
                </label>
              </div>`
        }
        <label>
          <span>评论内容</span>
          <textarea name="content" rows="4" required maxlength="1000"></textarea>
        </label>
        <button type="submit">提交评论</button>
        <p id="commentMessage" class="form-message"></p>
      </form>
    </section>
  `;

  $("#detailBackBtn").addEventListener("click", goBack);

  $("#likeBtn").addEventListener("click", async () => {
    const likeBtn = $("#likeBtn");
    if (likeBtn.disabled) return;

    try {
      const data = await api(`/posts/${encodeURIComponent(post.slug)}/like/`, {
        method: "POST",
        body: {
          visitor_id: getVisitorId(),
        },
      });
      $("#likeCount").textContent = `${data.likes_count} 点赞`;
      markPostLiked(post.slug);
      likeBtn.textContent = data.already_liked ? "已点赞" : "已点赞";
      likeBtn.disabled = true;
    } catch (error) {
      alert(error.message);
    }
  });

  $("#copyLinkBtn").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?post=${encodeURIComponent(post.slug)}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      prompt("文章链接", url);
    }
  });

  $("#commentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#commentMessage");
    const body = {
      post: post.id,
      content: form.elements.content.value.trim(),
    };
    if (!commentIdentity) {
      body.name = form.elements.name.value.trim();
      body.email = form.elements.email.value.trim();
    }
    try {
      await api("/comments/", {
        method: "POST",
        body,
      });
      form.reset();
      setMessage(message, "评论已提交，审核后展示。", "success");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function goBack() {
  if (history.length > 1) {
    history.back();
    return;
  }
  window.location.href = "index.html";
}

function scrollToPageBottom() {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: "smooth",
  });
}

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function syncTopbarState() {
  $(".topbar").classList.toggle("scrolled", window.scrollY > 80);
}

function goIndexView(view) {
  window.location.href = view === "public" ? "index.html" : `index.html?view=${encodeURIComponent(view)}`;
}

function handleKeyboardNavigation(event) {
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "Left")) {
    event.preventDefault();
    goBack();
  }
}

async function init() {
  applyTheme();
  await loadCurrentUser();
  $$("[data-index-view]").forEach((button) => {
    button.addEventListener("click", () => goIndexView(button.dataset.indexView));
  });
  $("#themeToggleBtn").addEventListener("click", toggleTheme);
  $("#rightsideTopBtn").addEventListener("click", scrollToPageTop);
  $("#rightsideBottomBtn").addEventListener("click", scrollToPageBottom);
  window.addEventListener("scroll", syncTopbarState, { passive: true });
  document.addEventListener("keydown", handleKeyboardNavigation);
  syncTopbarState();

  const slug = new URLSearchParams(location.search).get("post");
  if (!slug) {
    $("#articleDetail").innerHTML = `<div class="empty-state">缺少文章地址</div>`;
    return;
  }

  try {
    const post = await api(`/posts/${encodeURIComponent(slug)}/`);
    renderArticle(post);
  } catch (error) {
    $("#articleHeroText").textContent = "加载失败";
    $("#articleDetail").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

init();
