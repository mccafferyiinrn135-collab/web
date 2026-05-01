const API_BASE = "http://127.0.0.1:8000/api";

function loadStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem("profileSettings") || "{}");
  } catch (error) {
    localStorage.removeItem("profileSettings");
    return {};
  }
}

function loadStoredTheme() {
  return localStorage.getItem("themeMode") === "dark" ? "dark" : "light";
}

const state = {
  token: localStorage.getItem("accessToken") || "",
  currentUser: null,
  profile: loadStoredProfile(),
  theme: loadStoredTheme(),
  currentView: "public",
  categories: [],
  posts: [],
  selectedPost: null,
  detailMode: false,
  adminPosts: [],
  authorPosts: [],
  comments: [],
  accounts: [],
  pendingRegistration: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const viewIds = ["public", "timeline", "more", "categories", "album", "moments", "guestbook", "profile", "admin"];

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

function getItems(data) {
  return Array.isArray(data) ? data : data.results || [];
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

function getCommentIdentity() {
  if (!state.currentUser) return null;
  return {
    name: state.currentUser.first_name || state.currentUser.username,
    email: state.currentUser.email || "",
  };
}

function getProfile() {
  return {
    display_name: state.profile.display_name || "XIAOZHAO",
    bio: state.profile.bio || "记录开发、设计和日常想法。",
    email: state.profile.email || "",
    location: state.profile.location || "",
    wechat: state.profile.wechat || "",
    qq: state.profile.qq || "",
    wechat_image: state.profile.wechat_image || "",
    qq_image: state.profile.qq_image || "",
  };
}

function readImageInput(input, fallback = "") {
  if (!input?.files?.length) return Promise.resolve(fallback);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.readAsDataURL(input.files[0]);
  });
}

function renderProfile() {
  const profile = getProfile();
  $("#authorName").textContent = profile.display_name;
  $("#authorBio").textContent = profile.bio;
  const socials = $("#authorSocials");
  if (socials) {
    const items = [
      ["wechat", "微信", "icon-wechat", profile.wechat, profile.wechat_image],
      ["qq", "QQ", "icon-qq", profile.qq, profile.qq_image],
    ];
    socials.innerHTML = items
      .map(
        ([key, label, icon, value, image]) => `
          <button class="social-image-button ${image ? "has-preview" : "is-empty"}" type="button" data-profile-shortcut="${key}" title="${escapeHtml(label)}：${escapeHtml(value || "未设置")}">
            <svg class="social-icon" aria-hidden="true"><use href="./assets/menu-icons.svg#${icon}"></use></svg>
            ${image ? `<span class="social-preview"><img src="${escapeHtml(image)}" alt="${escapeHtml(label)}" /></span>` : ""}
          </button>
        `,
      )
      .join("");
    $$("[data-profile-shortcut]").forEach((button) => {
      button.addEventListener("click", () => switchView("profile"));
    });
  }

  const form = $("#profileForm");
  if (!form) return;
  form.elements.display_name.value = profile.display_name;
  form.elements.bio.value = profile.bio;
  form.elements.email.value = profile.email;
  form.elements.location.value = profile.location;
  form.elements.wechat.value = profile.wechat;
  form.elements.qq.value = profile.qq;
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = getProfile();
  let wechatImage = profile.wechat_image;
  let qqImage = profile.qq_image;
  try {
    [wechatImage, qqImage] = await Promise.all([
      readImageInput(form.elements.wechat_image, profile.wechat_image),
      readImageInput(form.elements.qq_image, profile.qq_image),
    ]);
  } catch (error) {
    setMessage($("#profileMessage"), error.message, "error");
    return;
  }
  state.profile = {
    display_name: form.elements.display_name.value.trim() || "XIAOZHAO",
    bio: form.elements.bio.value.trim() || "记录开发、设计和日常想法。",
    email: form.elements.email.value.trim(),
    location: form.elements.location.value.trim(),
    wechat: form.elements.wechat.value.trim(),
    qq: form.elements.qq.value.trim(),
    wechat_image: wechatImage,
    qq_image: qqImage,
  };
  localStorage.setItem("profileSettings", JSON.stringify(state.profile));
  renderProfile();
  setMessage($("#profileMessage"), "个人设置已保存。", "success");
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const toggle = $("#themeToggleBtn");
  if (toggle) {
    const isDark = state.theme === "dark";
    const icon = toggle.querySelector("use");
    const label = toggle.querySelector(".theme-label");
    if (icon) icon.setAttribute("href", `./assets/menu-icons.svg#icon-${isDark ? "sun" : "moon"}`);
    if (label) label.textContent = isDark ? "白天" : "夜间";
    toggle.setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到黑夜模式");
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("themeMode", state.theme);
  applyTheme();
}

function updatePublicSummary() {
  const summary = $("#publicSummary");
  if (!summary) return;
  const total = state.posts.length;
  const featured = state.posts.filter((post) => post.is_featured).length;
  summary.textContent = total
    ? `当前 ${total} 篇文章，${featured} 篇推荐`
    : "记录开发、设计和日常想法";
}

function showListMode() {
  state.currentView = "public";
  state.detailMode = false;
  state.selectedPost = null;
  $("#contentTitle").textContent = "文章专区";
  $("#postList").classList.remove("hidden");
  $("#postDetail").classList.add("hidden");
  history.replaceState(null, "", location.pathname);
  renderPostList();
}

function openArticlePage(slug) {
  window.location.href = `article.html?post=${encodeURIComponent(slug)}`;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  if (response.status === 401 && !path.includes("/auth/token/")) {
    logout(false);
    throw new Error("登录已过期，请重新登录。");
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof data === "string" ? data : data.detail || JSON.stringify(data);
    throw new Error(detail || "请求失败");
  }

  return data;
}

async function loadCurrentUser() {
  if (!state.token) {
    state.currentUser = null;
    return null;
  }
  state.currentUser = await api("/auth/me/");
  return state.currentUser;
}

function renderCover(post) {
  if (post.cover_image_url) {
    return `<div class="post-cover"><img src="${escapeHtml(post.cover_image_url)}" alt=""></div>`;
  }
  return `<div class="post-cover">${escapeHtml(post.title.slice(0, 1) || "B")}</div>`;
}

function renderCategoryOptions() {
  const publicSelect = $("#categoryFilter");
  const editorSelect = $('#postForm select[name="category"]');
  const authorSelect = $('#authorPostForm select[name="category"]');
  const options = state.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");

  if (publicSelect) publicSelect.innerHTML = `<option value="">全部分类</option>${options}`;
  if (editorSelect) editorSelect.innerHTML = `<option value="">未分类</option>${options}`;
  if (authorSelect) authorSelect.innerHTML = `<option value="">未分类</option>${options}`;
  renderCategoryWidgets();
  renderCategoryCards();
}

function renderPostList() {
  const list = $("#postList");
  updatePublicSummary();
  if (!state.posts.length) {
    list.innerHTML = `<div class="empty-state compact">暂无文章</div>`;
    $("#postDetail").classList.add("hidden");
    return;
  }

  list.innerHTML = state.posts
    .map((post) => {
      const active = state.selectedPost?.slug === post.slug ? " active" : "";
      const category = post.category?.name || "未分类";
      return `
        <article class="excerpt${active}" data-slug="${escapeHtml(post.slug)}">
          ${renderCover(post)}
          <div class="excerpt-info">
            <header>
              <a class="cat" href="#" data-category-id="${post.category?.id || ""}">
                ${escapeHtml(category)}<i></i>
              </a>
              <h2>${escapeHtml(post.title)}</h2>
            </header>
            <p>${escapeHtml(post.summary || "暂无摘要")}</p>
            <p class="meta">
              <button class="meta-link category" type="button" data-category-id="${post.category?.id || ""}">目录：${escapeHtml(category)}</button>
              <button class="meta-link time" type="button">${formatDate(post.published_at)}</button>
              <button class="meta-link views" type="button">${post.views_count} 阅读</button>
              <button class="meta-link comment" type="button">${post.comments_count || 0} 评论</button>
              ${post.is_featured ? `<span class="recommend">推荐</span>` : ""}
            </p>
          </div>
        </article>
      `;
    })
    .join("");

  $$(".excerpt").forEach((card) => {
    card.addEventListener("click", () => openArticlePage(card.dataset.slug));
  });
  $$("[data-category-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const id = button.dataset.categoryId;
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      $("#categoryFilter").value = id;
      loadPosts().catch(alertError);
    });
  });
}

function renderPostDetail(post) {
  const comments = post.comments || [];
  const alreadyLiked = hasLikedPost(post.slug);
  const commentIdentity = getCommentIdentity();
  $("#postDetail").innerHTML = `
    <button id="backToListBtn" class="secondary small" type="button">返回列表</button>
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

  $("#backToListBtn").addEventListener("click", showListMode);

  $("#likeBtn").addEventListener("click", async () => {
    const likeBtn = $("#likeBtn");
    if (likeBtn.disabled) return;

    try {
      const data = await api(`/posts/${post.slug}/like/`, {
        method: "POST",
        body: {
          visitor_id: getVisitorId(),
        },
      });
      $("#likeCount").textContent = `${data.likes_count} 点赞`;
      markPostLiked(post.slug);
      likeBtn.textContent = "已点赞";
      likeBtn.disabled = true;
    } catch (error) {
      alert(error.message);
    }
  });

  $("#copyLinkBtn").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?post=${post.slug}`;
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

async function loadCategories() {
  const data = await api("/categories/?ordering=ordering,name");
  state.categories = getItems(data);
  renderCategoryOptions();
  renderCategoryList();
}

async function loadPosts() {
  const params = new URLSearchParams();
  const search = $("#searchInput").value.trim();
  const category = $("#categoryFilter").value;
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  params.set("ordering", "-published_at");

  const data = await api(`/posts/?${params.toString()}`);
  state.posts = getItems(data);
  state.detailMode = false;
  state.selectedPost = null;
  renderPostList();
  renderLatestWidget();
  renderTimeline();
  renderMoments();

  if (!state.posts.length) {
    return;
  }

  if (search || category) {
    history.replaceState(null, "", location.pathname);
  }

  $("#postList").classList.remove("hidden");
  $("#postDetail").classList.add("hidden");
}

async function loadPostDetail(slug, updateUrl = true) {
  const post = await api(`/posts/${slug}/`);
  state.currentView = "public";
  state.selectedPost = post;
  state.detailMode = true;
  $("#contentTitle").textContent = "文章详情";
  $("#postList").classList.add("hidden");
  $("#postDetail").classList.remove("hidden");
  if (updateUrl) history.replaceState(null, "", `${location.pathname}?post=${encodeURIComponent(slug)}`);
  renderPostList();
  renderPostDetail(post);
}

function renderCategoryWidgets() {
  const categoryLinks = $("#categoryLinks");
  const categoryWidget = $("#categoryWidget");
  const tagWidget = $("#tagWidget");
  if (!categoryLinks || !categoryWidget || !tagWidget) return;

  categoryLinks.innerHTML = [
    `<button class="text-link" type="button" data-filter-category="">全部</button>`,
    ...state.categories
      .slice(0, 3)
      .map(
        (category) =>
          `<button class="text-link" type="button" data-filter-category="${category.id}">${escapeHtml(category.name)}</button>`,
      ),
  ].join("");

  categoryWidget.innerHTML = state.categories.length
    ? state.categories
        .map(
          (category) => `
            <li>
              <button class="widget-link" type="button" data-filter-category="${category.id}">
                <span class="text">${escapeHtml(category.name)}</span>
                <span class="count">${category.posts_count || 0} 篇</span>
              </button>
            </li>
          `,
        )
        .join("")
    : `<li><span class="muted">暂无分类</span></li>`;

  tagWidget.innerHTML = state.categories.length
    ? state.categories
        .map(
          (category) => `
            <li>
              <button class="tag-link" type="button" data-filter-category="${category.id}">
                ${escapeHtml(category.name)} <span class="badge">${category.posts_count || 0}</span>
              </button>
            </li>
          `,
        )
        .join("")
    : `<li><span class="muted">暂无标签</span></li>`;

  $$("[data-filter-category]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#categoryFilter").value = button.dataset.filterCategory;
      loadPosts().catch(alertError);
    });
  });
}

function renderLatestWidget() {
  const latestWidget = $("#latestWidget");
  if (!latestWidget) return;
  latestWidget.innerHTML = state.posts.length
    ? state.posts
        .slice(0, 6)
        .map(
          (post) => `
            <li>
              <button class="widget-link" type="button" data-latest-post="${escapeHtml(post.slug)}">
                <span class="text">${escapeHtml(post.title)}</span>
                <span class="muted">${formatDate(post.published_at)}</span>
                <span class="muted">${post.views_count} 阅读</span>
              </button>
            </li>
          `,
        )
        .join("")
    : `<li><span class="muted">暂无文章</span></li>`;

  $$("[data-latest-post]").forEach((button) => {
    button.addEventListener("click", () => openArticlePage(button.dataset.latestPost));
  });
}

function renderTimeline() {
  const list = $("#timelineList");
  if (!list) return;
  if (!state.posts.length) {
    list.innerHTML = `<div class="empty-state compact">暂无时间轴内容</div>`;
    return;
  }

  list.innerHTML = state.posts
    .map(
      (post) => `
        <article class="timeline-item">
          <time>${formatDate(post.published_at)}</time>
          <button type="button" data-timeline-post="${escapeHtml(post.slug)}">
            <strong>${escapeHtml(post.title)}</strong>
            <span>${escapeHtml(post.category?.name || "未分类")} · ${post.views_count} 阅读</span>
          </button>
        </article>
      `,
    )
    .join("");

  $$("[data-timeline-post]").forEach((button) => {
    button.addEventListener("click", () => openArticlePage(button.dataset.timelinePost));
  });
}

function renderCategoryCards() {
  const list = $("#categoryCards");
  if (!list) return;
  if (!state.categories.length) {
    list.innerHTML = `<div class="empty-state compact">暂无分类</div>`;
    return;
  }

  list.innerHTML = state.categories
    .map(
      (category) => `
        <button class="category-card" type="button" data-category-page="${category.id}">
          <strong>${escapeHtml(category.name)}</strong>
          <span>${category.posts_count || 0} 篇文章</span>
          <small>${escapeHtml(category.description || "暂无描述")}</small>
        </button>
      `,
    )
    .join("");

  $$("[data-category-page]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#categoryFilter").value = button.dataset.categoryPage;
      switchView("public");
      loadPosts().catch(alertError);
    });
  });
}

function renderMoments() {
  const list = $("#momentList");
  if (!list) return;
  const items = state.posts.length
    ? state.posts.slice(0, 4).map((post) => ({
        title: post.title,
        text: post.summary || "更新了一篇新文章。",
        time: post.published_at,
        slug: post.slug,
      }))
    : [
        {
          title: "站点建设中",
          text: "这里会记录一些零散想法、开发进度和日常片段。",
          time: new Date().toISOString(),
          slug: "",
        },
      ];

  list.innerHTML = items
    .map(
      (item) => `
        <article class="moment-item">
          <time>${formatDate(item.time)}</time>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
          ${
            item.slug
              ? `<button class="text-link" type="button" data-moment-post="${escapeHtml(item.slug)}">查看文章</button>`
              : ""
          }
        </article>
      `,
    )
    .join("");

  $$("[data-moment-post]").forEach((button) => {
    button.addEventListener("click", () => openArticlePage(button.dataset.momentPost));
  });
}

function getGuestbookEntries() {
  try {
    return JSON.parse(localStorage.getItem("guestbookEntries") || "[]");
  } catch (error) {
    localStorage.removeItem("guestbookEntries");
    return [];
  }
}

function renderGuestbook() {
  const list = $("#guestbookList");
  if (!list) return;
  const entries = getGuestbookEntries();
  list.innerHTML = entries.length
    ? entries
        .map(
          (entry, index) => `
            <article class="guestbook-item bubble-${(index % 5) + 1}">
              <p>${escapeHtml(entry.content)}</p>
            </article>
          `,
        )
        .join("")
    : `<div class="guestbook-empty">写下第一条留言</div>`;
}

function handleGuestbookSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const content = form.elements.content.value.trim();
  if (!content) return;
  const entries = getGuestbookEntries();
  entries.unshift({
    content,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem("guestbookEntries", JSON.stringify(entries.slice(0, 30)));
  form.reset();
  setMessage($("#guestbookMessage"), "");
  renderGuestbook();
}

function renderStats(stats) {
  const items = [
    ["文章总数", stats.posts_total],
    ["已发布", stats.posts_published],
    ["草稿", stats.posts_draft],
    ["待审评论", stats.comments_pending],
    ["分类", stats.categories_total],
    ["评论", stats.comments_total],
    ["账号", stats.accounts_total],
    ["启用账号", stats.accounts_active],
    ["阅读", stats.views_total],
    ["点赞", stats.likes_total],
  ];

  $("#statsGrid").innerHTML = items
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderAdminPosts() {
  const list = $("#adminPostList");
  if (!state.adminPosts.length) {
    list.innerHTML = `<div class="empty-state">暂无文章</div>`;
    return;
  }

  list.innerHTML = state.adminPosts
    .map(
      (post) => `
        <article class="admin-item">
          <div>
            <h3>${escapeHtml(post.title)}</h3>
            <div class="meta">
              <span class="badge ${post.status === "published" ? "success" : "neutral"}">
                ${post.status === "published" ? "已发布" : "草稿"}
              </span>
              <span>${escapeHtml(post.category?.name || "未分类")}</span>
              <span>${formatDate(post.updated_at)}</span>
            </div>
          </div>
          <div class="admin-actions">
            <button class="secondary small" data-edit-post="${escapeHtml(post.slug)}">编辑</button>
            <button class="danger small" data-delete-post="${escapeHtml(post.slug)}">删除</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$("[data-edit-post]").forEach((button) => {
    button.addEventListener("click", () => editPost(button.dataset.editPost));
  });
  $$("[data-delete-post]").forEach((button) => {
    button.addEventListener("click", () => deletePost(button.dataset.deletePost));
  });
}

function renderAuthorPosts() {
  const list = $("#authorPostList");
  if (!list) return;
  if (!state.authorPosts.length) {
    list.innerHTML = `<div class="empty-state">暂无自己的文章</div>`;
    return;
  }

  list.innerHTML = state.authorPosts
    .map(
      (post) => `
        <article class="admin-item">
          <div>
            <h3>${escapeHtml(post.title)}</h3>
            <div class="meta">
              <span class="badge ${post.status === "published" ? "success" : "neutral"}">
                ${post.status === "published" ? "已发布" : "草稿"}
              </span>
              <span>${escapeHtml(post.category?.name || "未分类")}</span>
              <span>${formatDate(post.published_at || post.created_at)}</span>
              <span>${post.views_count} 阅读</span>
            </div>
          </div>
          <div class="admin-actions">
            <button class="secondary small" data-author-view-post="${escapeHtml(post.slug)}">查看</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$("[data-author-view-post]").forEach((button) => {
    button.addEventListener("click", () => openArticlePage(button.dataset.authorViewPost));
  });
}

function renderCategoryList() {
  const list = $("#categoryList");
  if (!list) return;
  if (!state.categories.length) {
    list.innerHTML = `<div class="empty-state">暂无分类</div>`;
    return;
  }

  list.innerHTML = state.categories
    .map(
      (category) => `
        <article class="admin-item">
          <div>
            <h3>${escapeHtml(category.name)}</h3>
            <div class="meta">
              <span>${category.posts_count || 0} 篇文章</span>
              <span class="badge ${category.is_active ? "success" : "neutral"}">
                ${category.is_active ? "启用" : "停用"}
              </span>
            </div>
          </div>
          <div class="admin-actions">
            <button class="danger small" data-delete-category="${category.id}">删除</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
  });
}

function renderComments() {
  const list = $("#commentList");
  if (!state.comments.length) {
    list.innerHTML = `<div class="empty-state">暂无评论</div>`;
    return;
  }

  list.innerHTML = state.comments
    .map(
      (comment) => `
        <article class="admin-item">
          <div>
            <h3>${escapeHtml(comment.name)} ${comment.is_approved ? "" : '<span class="badge warning">待审</span>'}</h3>
            <p>${escapeHtml(comment.content)}</p>
            <div class="meta">
              <span>${escapeHtml(comment.post_title)}</span>
              <span>${formatDate(comment.created_at)}</span>
            </div>
          </div>
          <div class="admin-actions">
            ${
              comment.is_approved
                ? ""
                : `<button class="small" data-approve-comment="${comment.id}">通过</button>`
            }
            <button class="danger small" data-delete-comment="${comment.id}">删除</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$("[data-approve-comment]").forEach((button) => {
    button.addEventListener("click", () => approveComment(button.dataset.approveComment));
  });
  $$("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", () => deleteComment(button.dataset.deleteComment));
  });
}

function renderAccounts() {
  const list = $("#accountList");
  if (!list) return;
  if (!state.accounts.length) {
    list.innerHTML = `<div class="empty-state">暂无账号</div>`;
    return;
  }

  list.innerHTML = state.accounts
    .map((account) => {
      const isSelf = state.currentUser?.id === account.id;
      const protectedSuper = account.is_superuser && !state.currentUser?.is_superuser;
      const roleLabel = account.is_superuser ? "超级管理员" : account.is_staff ? "管理员" : "作者";
      const roleClass = account.is_superuser || account.is_staff ? "success" : "neutral";
      const disabled = isSelf || protectedSuper ? " disabled" : "";
      const roleAction = account.is_staff
        ? `<button class="secondary small" data-account-role="${account.id}" data-role-value="author"${disabled}>设为作者</button>`
        : `<button class="secondary small" data-account-role="${account.id}" data-role-value="admin"${protectedSuper ? " disabled" : ""}>设为管理员</button>`;
      const activeAction = account.is_active
        ? `<button class="secondary small" data-account-active="${account.id}" data-active-value="false"${disabled}>停用</button>`
        : `<button class="small" data-account-active="${account.id}" data-active-value="true"${protectedSuper ? " disabled" : ""}>启用</button>`;
      const deleteAction =
        isSelf || protectedSuper
          ? `<button class="danger small" disabled>删除</button>`
          : `<button class="danger small" data-delete-account="${account.id}">删除</button>`;

      return `
        <article class="admin-item account-item">
          <div>
            <h3>${escapeHtml(account.username)}${isSelf ? ' <span class="badge warning">当前账号</span>' : ""}</h3>
            <p>${escapeHtml(account.email || "未填写邮箱")}</p>
            <div class="meta">
              <span class="badge ${roleClass}">${roleLabel}</span>
              <span class="badge ${account.is_active ? "success" : "neutral"}">
                ${account.is_active ? "启用" : "停用"}
              </span>
              <span>${account.posts_count || 0} 篇文章</span>
              <span>注册：${formatDate(account.date_joined)}</span>
            </div>
          </div>
          <div class="admin-actions">
            ${roleAction}
            ${activeAction}
            ${deleteAction}
          </div>
        </article>
      `;
    })
    .join("");

  $$("[data-account-role]").forEach((button) => {
    button.addEventListener("click", () =>
      updateAccount(button.dataset.accountRole, {
        is_staff: button.dataset.roleValue === "admin",
      }),
    );
  });
  $$("[data-account-active]").forEach((button) => {
    button.addEventListener("click", () =>
      updateAccount(button.dataset.accountActive, {
        is_active: button.dataset.activeValue === "true",
      }),
    );
  });
  $$("[data-delete-account]").forEach((button) => {
    button.addEventListener("click", () => deleteAccount(button.dataset.deleteAccount));
  });
}

async function loadAdminData() {
  if (!state.token) return;
  const [stats, posts, comments, accounts] = await Promise.all([
    api("/stats/"),
    api("/posts/?ordering=-updated_at"),
    api("/comments/?ordering=-created_at"),
    api("/accounts/?ordering=-date_joined"),
  ]);
  renderStats(stats);
  state.adminPosts = getItems(posts);
  state.comments = getItems(comments);
  state.accounts = getItems(accounts);
  renderAdminPosts();
  renderComments();
  renderAccounts();
}

async function loadAccounts() {
  if (!state.token) return;
  const accounts = await api("/accounts/?ordering=-date_joined");
  state.accounts = getItems(accounts);
  renderAccounts();
}

async function loadAuthorPosts() {
  if (!state.token) return;
  const posts = await api("/posts/?mine=1&ordering=-published_at,-created_at");
  state.authorPosts = getItems(posts);
  renderAuthorPosts();
}

async function editPost(slug) {
  const post = await api(`/posts/${slug}/`);
  const form = $("#postForm");
  form.elements.slug.value = post.slug;
  form.elements.title.value = post.title;
  form.elements.summary.value = post.summary || "";
  form.elements.content.value = post.content;
  form.elements.category.value = post.category?.id || "";
  form.elements.status.value = post.status;
  form.elements.is_featured.checked = post.is_featured;
  $("#postFormTitle").textContent = "编辑文章";
  setMessage($("#postFormMessage"), "");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deletePost(slug) {
  if (!confirm("确定删除这篇文章吗？")) return;
  await api(`/posts/${slug}/`, { method: "DELETE" });
  await refreshAll();
}

async function deleteCategory(id) {
  if (!confirm("确定删除这个分类吗？分类下文章会变为未分类。")) return;
  await api(`/categories/${id}/`, { method: "DELETE" });
  await refreshAll();
}

async function approveComment(id) {
  await api(`/comments/${id}/approve/`, { method: "POST" });
  await refreshAll();
}

async function deleteComment(id) {
  if (!confirm("确定删除这条评论吗？")) return;
  await api(`/comments/${id}/`, { method: "DELETE" });
  await refreshAll();
}

async function updateAccount(id, payload) {
  if (payload.is_active === false && !confirm("确定停用这个账号吗？停用后该账号不能登录。")) return;
  if (payload.is_staff === true && !confirm("确定把这个账号设为管理员吗？")) return;
  if (payload.is_staff === false && !confirm("确定把这个管理员改为作者吗？")) return;

  try {
    await api(`/accounts/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    await loadAdminData();
  } catch (error) {
    alert(parseApiError(error.message));
  }
}

async function deleteAccount(id) {
  if (!confirm("确定删除这个账号吗？该账号发布的文章会一起删除。")) return;
  try {
    await api(`/accounts/${id}/`, { method: "DELETE" });
    await loadAdminData();
  } catch (error) {
    alert(parseApiError(error.message));
  }
}

function resetPostForm() {
  $("#postForm").reset();
  $('#postForm input[name="slug"]').value = "";
  $("#postFormTitle").textContent = "新建文章";
  setMessage($("#postFormMessage"), "");
}

function resetAuthorPostForm() {
  $("#authorPostForm").reset();
  setMessage($("#authorPostFormMessage"), "");
}

async function handlePostSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#postFormMessage");
  const slug = form.elements.slug.value;
  const payload = new FormData(form);

  if (!form.elements.cover_image.files.length) payload.delete("cover_image");
  if (!payload.get("category")) payload.delete("category");
  if (!payload.get("slug")) payload.delete("slug");
  payload.set("is_featured", form.elements.is_featured.checked ? "true" : "false");

  try {
    await api(slug ? `/posts/${slug}/` : "/posts/", {
      method: slug ? "PATCH" : "POST",
      body: payload,
    });
    resetPostForm();
    setMessage(message, "文章已保存。", "success");
    await refreshAll();
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

async function handleAuthorPostSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#authorPostFormMessage");
  const payload = new FormData(form);

  if (!form.elements.cover_image.files.length) payload.delete("cover_image");
  if (!payload.get("category")) payload.delete("category");

  try {
    await api("/posts/", {
      method: "POST",
      body: payload,
    });
    resetAuthorPostForm();
    setMessage(message, "文章已发布。", "success");
    await Promise.all([loadPosts(), loadAuthorPosts()]);
  } catch (error) {
    setMessage(message, parseApiError(error.message), "error");
  }
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/categories/", {
    method: "POST",
    body: {
      name: form.elements.name.value.trim(),
      description: form.elements.description.value.trim(),
    },
  });
  form.reset();
  await refreshAll();
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#loginMessage");
  try {
    const data = await api("/auth/token/", {
      method: "POST",
      body: {
        username: form.elements.username.value.trim(),
        password: form.elements.password.value,
      },
    });
    state.token = data.access;
    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("refreshToken", data.refresh);
    await loadCurrentUser();
    form.reset();
    setMessage(message, "");
    renderAuthState();
    if (state.currentUser?.is_staff) {
      await Promise.all([loadCategories(), loadAdminData()]);
    } else {
      await Promise.all([loadCategories(), loadAuthorPosts()]);
    }
  } catch (error) {
    setMessage(message, "用户名或密码错误。", "error");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#registerMessage");
  const username = form.elements.username.value.trim();
  const email = form.elements.email.value.trim();
  if (form.elements.password.value !== form.elements.password_confirm.value) {
    setMessage(message, "两次输入的密码不一致。", "error");
    return;
  }

  try {
    const data = await api("/auth/register/", {
      method: "POST",
      body: {
        username,
        email,
        password: form.elements.password.value,
        password_confirm: form.elements.password_confirm.value,
      },
    });
    state.pendingRegistration = {
      username: data.username || username,
      email: data.email || email,
    };
    const verifyForm = $("#verifyEmailForm");
    verifyForm.elements.username.value = state.pendingRegistration.username;
    verifyForm.elements.email.value = state.pendingRegistration.email;
    verifyForm.elements.code.value = "";
    $("#verifyEmailText").textContent = state.pendingRegistration.email;
    $("#registerForm").classList.add("hidden");
    verifyForm.classList.remove("hidden");
    setMessage(message, "");
    setMessage($("#verifyEmailMessage"), "请输入邮箱中的 6 位验证码。", "success");
  } catch (error) {
    const detail = parseApiError(error.message);
    setMessage(message, detail || "注册失败，请检查输入。", "error");
  }
}

async function handleVerifyEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#verifyEmailMessage");
  try {
    const data = await api("/auth/verify-email/", {
      method: "POST",
      body: {
        username: form.elements.username.value,
        email: form.elements.email.value,
        code: form.elements.code.value.trim(),
      },
    });
    state.token = data.access;
    state.currentUser = data.user;
    state.pendingRegistration = null;
    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("refreshToken", data.refresh);
    $("#registerForm").reset();
    form.reset();
    setMessage(message, "邮箱验证成功，已登录。", "success");
    renderAuthState();
    await Promise.all([loadCategories(), loadAuthorPosts()]);
  } catch (error) {
    setMessage(message, parseApiError(error.message) || "验证失败，请检查验证码。", "error");
  }
}

async function resendVerificationCode() {
  const form = $("#verifyEmailForm");
  const message = $("#verifyEmailMessage");
  try {
    await api("/auth/resend-verification/", {
      method: "POST",
      body: {
        username: form.elements.username.value,
        email: form.elements.email.value,
      },
    });
    form.elements.code.value = "";
    setMessage(message, "新的验证码已发送，请查看邮箱。", "success");
  } catch (error) {
    setMessage(message, parseApiError(error.message) || "发送失败，请稍后再试。", "error");
  }
}

function parseApiError(message) {
  try {
    const data = JSON.parse(message);
    if (typeof data === "string") return data;
    return Object.values(data).flat().join(" ");
  } catch (error) {
    return message;
  }
}

function logout(reloadView = true) {
  state.token = "";
  state.currentUser = null;
  state.authorPosts = [];
  state.accounts = [];
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  renderAuthState();
  if (reloadView) loadPosts().catch(console.error);
}

function renderAuthState() {
  const loggedIn = Boolean(state.token);
  const isStaff = Boolean(state.currentUser?.is_staff);
  $("#loginPanel").classList.toggle("hidden", loggedIn);
  $("#dashboardPanel").classList.toggle("hidden", !loggedIn || !isStaff);
  $("#authorPanel").classList.toggle("hidden", !loggedIn || isStaff);
}

function switchAuthTab(mode) {
  const isRegister = mode === "register";
  $("#showLoginTab").classList.toggle("active", !isRegister);
  $("#showRegisterTab").classList.toggle("active", isRegister);
  $("#loginForm").classList.toggle("hidden", isRegister);
  $("#registerForm").classList.toggle("hidden", !isRegister);
  $("#verifyEmailForm").classList.add("hidden");
  setMessage($("#loginMessage"), "");
  setMessage($("#registerMessage"), "");
  setMessage($("#verifyEmailMessage"), "");
}

async function refreshAll() {
  await loadCategories();
  if (!state.token) {
    await loadPosts();
    return;
  }
  if (state.currentUser?.is_staff) {
    await Promise.all([loadPosts(), loadAdminData()]);
    return;
  }
  await Promise.all([loadPosts(), loadAuthorPosts()]);
}

function switchView(name) {
  if (!viewIds.includes(name)) return;
  state.currentView = name;
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  viewIds.forEach((viewName) => {
    const view = $(`#${viewName}View`);
    if (view) view.classList.toggle("active", name === viewName);
  });
  if (name === "admin") {
    renderAuthState();
    if (state.token && !state.currentUser) {
      loadCurrentUser()
        .then(() => {
          renderAuthState();
          return state.currentUser?.is_staff ? loadAdminData() : loadAuthorPosts();
        })
        .catch(() => logout(false));
    } else if (state.token && state.currentUser?.is_staff) {
      loadAdminData().catch(console.error);
    } else if (state.token) {
      loadAuthorPosts().catch(console.error);
    }
  }
  if (name === "profile") {
    renderProfile();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (name === "guestbook") renderGuestbook();
  if (name !== "public") {
    history.replaceState(null, "", `${location.pathname}?view=${name}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  history.replaceState(null, "", location.pathname);
  window.scrollTo({ top: 0, behavior: "smooth" });
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

function openAlbumLightbox(image) {
  const lightbox = $("#albumLightbox");
  const preview = $("#albumLightboxImage");
  const caption = $("#albumLightboxCaption");
  if (!lightbox || !preview || !caption) return;
  preview.src = image.currentSrc || image.src;
  preview.alt = image.alt || "相册图片";
  caption.textContent = image.closest("figure")?.querySelector("figcaption")?.textContent || image.alt || "";
  lightbox.classList.remove("hidden");
  document.body.classList.add("lightbox-open");
}

function closeAlbumLightbox() {
  const lightbox = $("#albumLightbox");
  const preview = $("#albumLightboxImage");
  if (!lightbox || !preview) return;
  lightbox.classList.add("hidden");
  document.body.classList.remove("lightbox-open");
  preview.removeAttribute("src");
}

function bindAlbumLightbox() {
  $$(".album-grid img").forEach((image) => {
    image.addEventListener("dblclick", () => openAlbumLightbox(image));
  });
}

function syncTopbarState() {
  $(".topbar").classList.toggle("scrolled", window.scrollY > 80);
}

function goBackInApp() {
  if (state.detailMode) {
    showListMode();
    return;
  }
  if (state.currentView !== "public") {
    switchView("public");
    return;
  }
  window.history.back();
}

function handleKeyboardNavigation(event) {
  if (event.key === "Escape" && !$("#albumLightbox")?.classList.contains("hidden")) {
    closeAlbumLightbox();
    return;
  }
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "Left")) {
    event.preventDefault();
    goBackInApp();
  }
}

function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function bindEvents() {
  $("#themeToggleBtn").addEventListener("click", toggleTheme);
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  $$("[data-shortcut-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.shortcutView));
  });
  $("#refreshPostsBtn").addEventListener("click", () => loadPosts().catch(alertError));
  $("#searchInput").addEventListener("input", debounce(() => loadPosts().catch(alertError)));
  $("#categoryFilter").addEventListener("change", () => loadPosts().catch(alertError));
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#registerForm").addEventListener("submit", handleRegister);
  $("#verifyEmailForm").addEventListener("submit", handleVerifyEmail);
  $("#resendVerificationBtn").addEventListener("click", resendVerificationCode);
  $("#showLoginTab").addEventListener("click", () => switchAuthTab("login"));
  $("#showRegisterTab").addEventListener("click", () => switchAuthTab("register"));
  $("#backRegisterBtn").addEventListener("click", () => {
    $("#verifyEmailForm").classList.add("hidden");
    $("#registerForm").classList.remove("hidden");
    setMessage($("#verifyEmailMessage"), "");
  });
  $("#logoutBtn").addEventListener("click", () => logout());
  $("#authorLogoutBtn").addEventListener("click", () => logout());
  $("#postForm").addEventListener("submit", handlePostSubmit);
  $("#authorPostForm").addEventListener("submit", handleAuthorPostSubmit);
  $("#resetPostFormBtn").addEventListener("click", resetPostForm);
  $("#resetAuthorPostFormBtn").addEventListener("click", resetAuthorPostForm);
  $("#categoryForm").addEventListener("submit", (event) => {
    handleCategorySubmit(event).catch(alertError);
  });
  $("#reloadAdminPostsBtn").addEventListener("click", () => loadAdminData().catch(alertError));
  $("#reloadAccountsBtn").addEventListener("click", () => loadAccounts().catch(alertError));
  $("#reloadAuthorPostsBtn").addEventListener("click", () => loadAuthorPosts().catch(alertError));
  $("#reloadCommentsBtn").addEventListener("click", () => loadAdminData().catch(alertError));
  $("#profileAvatarBtn").addEventListener("click", () => switchView("profile"));
  $("#profileBackBtn").addEventListener("click", () => switchView("public"));
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#guestbookForm").addEventListener("submit", handleGuestbookSubmit);
  $("#scrollBottomBtn").addEventListener("click", scrollToPageBottom);
  bindAlbumLightbox();
  $("#albumLightboxClose").addEventListener("click", closeAlbumLightbox);
  $("#albumLightbox").addEventListener("click", (event) => {
    if (event.target.id === "albumLightbox") closeAlbumLightbox();
  });
  $("#rightsideTopBtn").addEventListener("click", scrollToPageTop);
  $("#rightsideBottomBtn").addEventListener("click", scrollToPageBottom);
  window.addEventListener("scroll", syncTopbarState, { passive: true });
  document.addEventListener("keydown", handleKeyboardNavigation);
  syncTopbarState();
}

function alertError(error) {
  alert(error.message || error);
}

async function init() {
  applyTheme();
  bindEvents();
  renderProfile();
  renderGuestbook();
  try {
    if (state.token) {
      try {
        await loadCurrentUser();
      } catch (error) {
        logout(false);
      }
    }
    renderAuthState();
    await loadCategories();
    await loadPosts();
    if (state.token && state.currentUser?.is_staff) await loadAdminData();
    if (state.token && !state.currentUser?.is_staff) await loadAuthorPosts();
    const initialView = new URLSearchParams(location.search).get("view");
    if (initialView && viewIds.includes(initialView)) {
      switchView(initialView);
    }
  } catch (error) {
    $("#postList").innerHTML = `<div class="empty-state">无法连接后端服务</div>`;
    $("#postDetail").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

init();
