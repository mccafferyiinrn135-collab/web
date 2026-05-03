const API_BASE = "/api";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const params = new URLSearchParams(location.search);
const TOPBAR_HIDE_AFTER = 120;
const TOPBAR_SCROLL_DELTA = 6;
let lastTopbarScrollY = Math.max(window.scrollY, 0);
const state = {
  token: localStorage.getItem("accessToken") || "",
  theme: localStorage.getItem("themeMode") === "dark" ? "dark" : "light",
  currentUser: null,
  categories: [],
  tags: [],
  slug: params.get("post") || "",
  defaultVisibility: params.get("visibility") === "draft" ? "draft" : "published",
  post: null,
  coverObjectUrl: "",
  removeCover: false,
};

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

function getVisitPayload() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return {
    visitor_id: getVisitorId(),
    path: `${location.pathname}${location.search}`.slice(0, 255),
    page_title: document.title.slice(0, 180),
    referrer: document.referrer.slice(0, 500),
    language: (navigator.language || "").slice(0, 40),
    timezone: timezone.slice(0, 80),
    screen_width: window.screen?.width || null,
    screen_height: window.screen?.height || null,
  };
}

function recordSiteVisit() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  fetch(`${API_BASE}/visits/`, {
    method: "POST",
    headers,
    body: JSON.stringify(getVisitPayload()),
    keepalive: true,
  }).catch(() => {});
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

function formatFileSize(size) {
  const value = Number(size || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getItems(data) {
  return Array.isArray(data) ? data : data.results || [];
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+|\.{1,2}\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/\^([^^]+)\^/g, "<sup>$1</sup>");
  html = html.replace(/~([^~]+)~/g, "<sub>$1</sub>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return html;
}

function normalizeCodeLines(lines) {
  const nonEmptyLines = lines.filter((line) => line.trim());
  if (!nonEmptyLines.length) return lines.join("\n").trimEnd();
  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => (line.match(/^[ \t]*/) || [""])[0].length),
  );
  return lines
    .map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))
    .join("\n")
    .trimEnd();
}

function renderMarkdown(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inCode = false;
  let codeLanguage = "";
  let codeLines = [];
  let listType = "";

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };

  const openList = (type) => {
    if (listType === type) return;
    closeList();
    html.push(`<${type}>`);
    listType = type;
  };

  const splitTableRow = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const isTableSeparator = (line) => {
    const cells = splitTableRow(line);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const closeCode = () => {
    const codeText = normalizeCodeLines(codeLines);
    const languageLabel = codeLanguage || "code";
    html.push(
      `<div class="code-block">
        <div class="code-toolbar">
          <span>${escapeHtml(languageLabel)}</span>
          <button class="code-copy" type="button">复制</button>
        </div>
        <pre><code${codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""}>${escapeHtml(codeText)}</code></pre>
      </div>`,
    );
    inCode = false;
    codeLanguage = "";
    codeLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^\s*(`{3,}|~{3,})([\w-]*)\s*$/);
    if (fence) {
      if (inCode) {
        closeCode();
      } else {
        closeList();
        inCode = true;
        codeLanguage = fence[2] || "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const blockLine = line.replace(/^\s{0,3}/, "").trimEnd();

    if (!blockLine.trim()) {
      closeList();
      continue;
    }

    if (blockLine.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      closeList();
      const headers = splitTableRow(blockLine);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(`
        <table>
          <thead>
            <tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || "")}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      `);
      continue;
    }

    const heading = blockLine.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const unordered = blockLine.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      openList("ul");
      const task = unordered[1].match(/^\[( |x|X)\]\s+(.+)$/);
      if (task) {
        html.push(
          `<li class="task-list-item"><input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}>${renderInlineMarkdown(task[2])}</li>`,
        );
      } else {
        html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      }
      continue;
    }

    const ordered = blockLine.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const quote = blockLine.match(/^>\s?(.+)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(blockLine.trim())}</p>`);
  }

  if (inCode) closeCode();
  closeList();
  return html.join("");
}

function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value);
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

function bindCodeCopyButtons(container = document) {
  container.querySelectorAll(".code-copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".code-block")?.querySelector("code")?.textContent || "";
      if (!code) return;
      await copyText(code);
      button.textContent = "已复制";
      window.setTimeout(() => {
        button.textContent = "复制";
      }, 1200);
    });
  });
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

  if (response.status === 401) {
    state.token = "";
    state.currentUser = null;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
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

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const toggle = $("#themeToggleBtn");
  if (!toggle) return;
  const isDark = state.theme === "dark";
  const icon = toggle.querySelector("use");
  const label = toggle.querySelector(".theme-label");
  if (icon) icon.setAttribute("href", `./assets/menu-icons.svg#icon-${isDark ? "sun" : "moon"}`);
  if (label) label.textContent = isDark ? "白天" : "夜间";
  toggle.setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到黑夜模式");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("themeMode", state.theme);
  applyTheme();
}

function goIndexView(view) {
  const target = view === "public" ? "index.html" : `index.html?view=${encodeURIComponent(view)}`;
  window.location.href = target;
}

function goBackInApp() {
  if (history.length > 1) {
    history.back();
    return;
  }
  goIndexView("admin");
}

function getArticleUrl(slug) {
  return new URL(`article.html?post=${encodeURIComponent(slug)}`, location.href).href;
}

function setEditorPageTitle(title, actionLabel = "发布文章") {
  const heading = $("#editorFormTitle");
  const label = $("#saveArticleBtn [data-save-label]");
  if (heading) heading.textContent = title;
  if (label) label.textContent = actionLabel;
  document.title = `${title} - XIAOZHAO`;
}

function showGate(message = "登录后可以发布和管理自己的文章。") {
  $("#editorGateText").textContent = message;
  $("#editorGate").classList.remove("hidden");
  $("#editorForm").classList.add("hidden");
}

function showEditor() {
  $("#editorGate").classList.add("hidden");
  $("#editorForm").classList.remove("hidden");
}

async function loadCurrentUser() {
  if (!state.token) return null;
  state.currentUser = await api("/auth/me/");
  return state.currentUser;
}

async function loadCategories() {
  const data = await api("/categories/?ordering=ordering,name");
  state.categories = getItems(data);
  const select = $('#editorForm select[name="category"]');
  select.innerHTML = `<option value="">未分类</option>${state.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("")}`;
}

async function loadTags() {
  const data = await api("/tags/?ordering=ordering,name");
  state.tags = getItems(data);
  const select = $('#editorForm select[name="tags"]');
  if (!select) return;
  select.innerHTML = state.tags
    .map((tag) => `<option value="${tag.id}">${escapeHtml(tag.name)}</option>`)
    .join("");
}

async function loadPost(slug) {
  const post = await api(`/posts/${slug}/`);
  state.post = post;
  state.slug = post.slug;
  populateForm(post);
  setEditorPageTitle("编辑文章", "保存修改");
  $("#viewArticleBtn").disabled = false;
}

function applyUserMode() {
  const isStaff = Boolean(state.currentUser?.is_staff);
  $("#staffFields").classList.toggle("hidden", !isStaff);
}

function populateForm(post) {
  const form = $("#editorForm");
  state.removeCover = false;
  form.elements.slug.value = post.slug || "";
  form.elements.title.value = post.title || "";
  form.elements.summary.value = post.summary || "";
  form.elements.content.value = post.content || "";
  form.elements.category.value = post.category?.id || "";
  Array.from(form.elements.tags?.options || []).forEach((option) => {
    option.selected = (post.tags || []).some((tag) => String(tag.id) === option.value);
  });
  form.elements.status.value = post.status || "published";
  form.elements.is_featured.checked = Boolean(post.is_featured);
  form.elements.is_pinned.checked = Boolean(post.is_pinned);
  renderCoverPreview();
  renderExistingAttachments();
  renderSelectedAttachments();
  renderPreview();
}

function getAuthorName() {
  return (
    state.post?.author?.display_name ||
    state.currentUser?.display_name ||
    state.currentUser?.first_name ||
    state.currentUser?.username ||
    "作者"
  );
}

function getSelectedCategoryName() {
  const select = $('#editorForm select[name="category"]');
  const option = select.options[select.selectedIndex];
  return option?.textContent || "未分类";
}

function getPostVisibilityLabel(status) {
  return status === "draft" ? "仅个人可见" : "所有人可见";
}

function getCoverPreviewSrc() {
  if (state.removeCover) return "";
  return state.coverObjectUrl || state.post?.cover_image_url || "";
}

function renderCoverPreview() {
  const image = $("#coverPreview");
  const button = $("#removeCoverBtn");
  const src = getCoverPreviewSrc();
  image.src = src;
  image.classList.toggle("hidden", !src);
  button.disabled = !src && !state.post?.cover_image_url;
  button.textContent = state.removeCover ? "已取消封面" : "取消封面";
}

function updateCoverObjectUrl() {
  const input = $('#editorForm input[name="cover_image"]');
  state.removeCover = false;
  if (state.coverObjectUrl) {
    URL.revokeObjectURL(state.coverObjectUrl);
    state.coverObjectUrl = "";
  }
  if (input.files.length) {
    state.coverObjectUrl = URL.createObjectURL(input.files[0]);
  }
  renderCoverPreview();
  renderPreview();
}

function removeCoverImage() {
  const input = $('#editorForm input[name="cover_image"]');
  input.value = "";
  if (state.coverObjectUrl) {
    URL.revokeObjectURL(state.coverObjectUrl);
    state.coverObjectUrl = "";
  }
  state.removeCover = Boolean(state.post?.cover_image_url);
  renderCoverPreview();
  renderPreview();
}

function renderExistingAttachments() {
  const container = $("#existingAttachments");
  const attachments = state.post?.attachments || [];
  if (!attachments.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <h3>已有附件</h3>
    <ul>
      ${attachments
        .map(
          (attachment) => `
            <li>
              <a href="${escapeHtml(attachment.file_url)}" target="_blank" rel="noopener noreferrer" download>${escapeHtml(attachment.name)}</a>
              <span>${formatFileSize(attachment.size)}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderSelectedAttachments() {
  const container = $("#selectedAttachments");
  const files = Array.from($('#editorForm input[name="attachments"]').files || []);
  if (!files.length) {
    container.innerHTML = "";
    renderPreview();
    return;
  }
  container.innerHTML = `
    <h3>新附件</h3>
    <ul>
      ${files
        .map(
          (file) => `
            <li>
              <span>${escapeHtml(file.name)}</span>
              <span>${formatFileSize(file.size)}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
  renderPreview();
}

function renderPreviewAttachments() {
  const existing = state.post?.attachments || [];
  const selected = Array.from($('#editorForm input[name="attachments"]').files || []).map((file) => ({
    name: file.name,
    size: file.size,
  }));
  const items = [
    ...existing.map((attachment) => ({
      name: attachment.name,
      size: attachment.size,
      url: attachment.file_url,
    })),
    ...selected,
  ];
  if (!items.length) return "";
  return `
    <section class="article-attachments">
      <h3>附件</h3>
      <ul>
        ${items
          .map((item) => {
            const name = escapeHtml(item.name);
            return `
              <li>
                ${
                  item.url
                    ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" download>${name}</a>`
                    : `<span>${name}</span>`
                }
                <span>${formatFileSize(item.size)}</span>
              </li>
            `;
          })
          .join("")}
      </ul>
    </section>
  `;
}

function renderPreview() {
  const form = $("#editorForm");
  const title = form.elements.title.value.trim();
  const summary = form.elements.summary.value.trim();
  const content = form.elements.content.value.trim();
  const cover = getCoverPreviewSrc();
  const visibility = getPostVisibilityLabel(form.elements.status.value);
  const preview = $("#editorPreview");

  if (!title && !summary && !content && !cover) {
    preview.innerHTML = "";
    return;
  }

  preview.innerHTML = `
    ${title || summary ? `<header class="article-header">
      ${title ? `<h1 class="article-title">${escapeHtml(title)}</h1>` : ""}
      <div class="article-meta">
        <span class="item category">${escapeHtml(getSelectedCategoryName())}</span>
        <span class="item">${escapeHtml(visibility)}</span>
      </div>
      ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ""}
    </header>` : ""}
    ${cover ? `<img class="detail-cover" src="${escapeHtml(cover)}" alt="">` : ""}
    <article class="article-content">
      ${content ? renderMarkdown(content) : ""}
    </article>
    ${renderPreviewAttachments()}
  `;
  bindCodeCopyButtons(preview);
}

function replaceSelection(transform) {
  const textarea = $("#editorContent");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const replacement = transform(selected);
  textarea.setRangeText(replacement, start, end, "end");
  textarea.focus();
  renderPreview();
}

function prefixLines(selected, prefixFactory, fallback) {
  const source = selected || fallback;
  return source
    .split("\n")
    .map((line, index) => `${prefixFactory(index)}${line || fallback}`)
    .join("\n");
}

function applyFormat(format) {
  const actions = {
    heading: (selected) => prefixLines(selected, () => "## ", "小标题"),
    bold: (selected) => `**${selected || "加粗文字"}**`,
    underline: (selected) => `++${selected || "下划线文字"}++`,
    italic: (selected) => `*${selected || "斜体文字"}*`,
    strike: (selected) => `~~${selected || "删除线文字"}~~`,
    subscript: (selected) => `~${selected || "下标"}~`,
    superscript: (selected) => `^${selected || "上标"}^`,
    "inline-code": (selected) => `\`${selected || "code"}\``,
    "code-block": (selected) => `\n\`\`\`c\n${selected || "int main(void) {\n    return 0;\n}"}\n\`\`\`\n`,
    quote: (selected) => prefixLines(selected, () => "> ", "引用内容"),
    "unordered-list": (selected) => prefixLines(selected, () => "- ", "列表项"),
    "ordered-list": (selected) => prefixLines(selected, (index) => `${index + 1}. `, "列表项"),
    "task-list": (selected) => prefixLines(selected, () => "- [ ] ", "待办事项"),
    link: (selected) => `[${selected || "链接文字"}](https://example.com)`,
    image: (selected) => `![${selected || "图片描述"}](https://example.com/image.png)`,
    table: () => "\n| 标题 | 内容 |\n| --- | --- |\n| 示例 | 文本 |\n",
    diagram: () => "\n```mermaid\ngraph TD\n    A[开始] --> B[处理]\n    B --> C[结束]\n```\n",
    math: (selected) => `\n$$\n${selected || "E = mc^2"}\n$$\n`,
  };
  const transform = actions[format];
  if (transform) replaceSelection(transform);
}

function buildPostPayload() {
  const form = $("#editorForm");
  const payload = new FormData();
  payload.set("title", form.elements.title.value.trim());
  payload.set("summary", form.elements.summary.value.trim());
  payload.set("content", form.elements.content.value);
  if (form.elements.category.value) payload.set("category", form.elements.category.value);
  Array.from(form.elements.tags?.selectedOptions || []).forEach((option) => {
    payload.append("tags", option.value);
  });
  payload.set("status", form.elements.status.value);

  if (state.currentUser?.is_staff) {
    payload.set("is_featured", form.elements.is_featured.checked ? "true" : "false");
    payload.set("is_pinned", form.elements.is_pinned.checked ? "true" : "false");
  }

  if (form.elements.cover_image.files.length) {
    payload.set("cover_image", form.elements.cover_image.files[0]);
  } else if (state.removeCover) {
    payload.set("remove_cover", "true");
  }

  Array.from(form.elements.attachments.files || []).forEach((file) => {
    payload.append("attachments", file);
  });

  return payload;
}

async function saveArticle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#editorMessage");
  const button = $("#saveArticleBtn");
  const slug = state.slug || form.elements.slug.value;

  setMessage(message, "");
  button.disabled = true;

  try {
    const data = await api(slug ? `/posts/${slug}/` : "/posts/", {
      method: slug ? "PATCH" : "POST",
      body: buildPostPayload(),
    });
    state.slug = data?.slug || slug;
    form.elements.slug.value = state.slug;
    form.elements.cover_image.value = "";
    form.elements.attachments.value = "";
    state.removeCover = false;
    if (state.coverObjectUrl) {
      URL.revokeObjectURL(state.coverObjectUrl);
      state.coverObjectUrl = "";
    }
    if (state.slug) {
      await loadPost(state.slug);
    }
    setMessage(message, "文章已保存。", "success");
  } catch (error) {
    setMessage(message, parseApiError(error.message), "error");
  } finally {
    button.disabled = false;
  }
}

function openCurrentArticle() {
  if (!state.slug) return;
  window.location.href = `article.html?post=${encodeURIComponent(state.slug)}`;
}

function scrollToPageTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToPageBottom() {
  window.scrollTo({
    top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    behavior: "smooth",
  });
}

function syncTopbarState() {
  const topbar = $(".topbar");
  if (!topbar) return;
  const currentScrollY = Math.max(window.scrollY, 0);
  const movement = currentScrollY - lastTopbarScrollY;
  topbar.classList.toggle("scrolled", currentScrollY > 24);
  if (currentScrollY <= TOPBAR_HIDE_AFTER) {
    topbar.classList.remove("is-hidden");
  } else if (movement > TOPBAR_SCROLL_DELTA) {
    topbar.classList.add("is-hidden");
  } else if (movement < -TOPBAR_SCROLL_DELTA) {
    topbar.classList.remove("is-hidden");
  }
  lastTopbarScrollY = currentScrollY;
}

function handleKeyboardNavigation(event) {
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "Left")) {
    event.preventDefault();
    goBackInApp();
  }
}

function setEditorViewMode(mode) {
  const shell = $("#editorMarkdownShell");
  if (!shell) return;
  shell.dataset.mode = mode;
  $$("[data-editor-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.editorMode === mode);
  });
  renderPreview();
}

function toggleEditorFullscreen() {
  const card = $(".editor-markdown-card");
  if (!card) return;
  card.classList.toggle("is-fullscreen");
  renderPreview();
}

function runEditorCommand(action) {
  const textarea = $("#editorContent");
  if (action === "save") {
    const form = $("#editorForm");
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
    return;
  }
  if (action === "refresh") {
    renderPreview();
    return;
  }
  if (action === "fullscreen") {
    toggleEditorFullscreen();
    return;
  }
  if (action === "view") {
    openCurrentArticle();
    return;
  }
  if (action === "back") {
    goIndexView("admin");
    return;
  }
  if ((action === "undo" || action === "redo") && textarea) {
    textarea.focus();
    document.execCommand(action);
    renderPreview();
  }
}

function debounce(fn, wait = 160) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function bindEvents() {
  const bindClick = (selector, handler) => {
    const element = $(selector);
    if (element) element.addEventListener("click", handler);
  };
  const bindChange = (selector, handler) => {
    const element = $(selector);
    if (element) element.addEventListener("change", handler);
  };
  const bindInput = (selector, handler) => {
    const element = $(selector);
    if (element) element.addEventListener("input", handler);
  };

  bindClick("#themeToggleBtn", toggleTheme);
  $$("[data-index-view]").forEach((button) => {
    button.addEventListener("click", () => goIndexView(button.dataset.indexView));
  });
  bindClick("#goLoginBtn", () => goIndexView("admin"));
  bindClick("#backManageBtn", () => goIndexView("admin"));
  bindClick("#viewArticleBtn", openCurrentArticle);
  $("#editorForm").addEventListener("submit", saveArticle);
  bindInput("#editorContent", debounce(renderPreview));
  bindInput('#editorForm input[name="title"]', debounce(renderPreview));
  bindInput('#editorForm textarea[name="summary"]', debounce(renderPreview));
  bindChange('#editorForm select[name="category"]', renderPreview);
  bindChange('#editorForm select[name="tags"]', renderPreview);
  bindChange('#editorForm select[name="status"]', renderPreview);
  bindChange('#editorForm input[name="cover_image"]', updateCoverObjectUrl);
  bindClick("#removeCoverBtn", removeCoverImage);
  bindChange('#editorForm input[name="attachments"]', renderSelectedAttachments);
  $$(".format-toolbar [data-format]").forEach((button) => {
    button.addEventListener("click", () => applyFormat(button.dataset.format));
  });
  $$("[data-editor-action]").forEach((button) => {
    button.addEventListener("click", () => runEditorCommand(button.dataset.editorAction));
  });
  $$("[data-editor-mode]").forEach((button) => {
    button.addEventListener("click", () => setEditorViewMode(button.dataset.editorMode));
  });
  bindClick("#rightsideTopBtn", scrollToPageTop);
  bindClick("#rightsideBottomBtn", scrollToPageBottom);
  window.addEventListener("scroll", syncTopbarState, { passive: true });
  document.addEventListener("keydown", handleKeyboardNavigation);
  window.addEventListener("beforeunload", () => {
    if (state.coverObjectUrl) URL.revokeObjectURL(state.coverObjectUrl);
  });
}

async function init() {
  applyTheme();
  bindEvents();
  syncTopbarState();

  if (!state.token) {
    showGate();
    return;
  }

  try {
    await loadCurrentUser();
    if (!state.currentUser) {
      showGate("登录已过期，请重新登录。");
      return;
    }
    recordSiteVisit();
    applyUserMode();
    await Promise.all([loadCategories(), loadTags()]);
    showEditor();
    if (state.slug) {
      await loadPost(state.slug);
    } else {
      setEditorPageTitle("新增文章", "发布文章");
      $("#viewArticleBtn").disabled = true;
      $("#editorForm").elements.status.value = state.defaultVisibility;
      renderCoverPreview();
      renderSelectedAttachments();
      renderPreview();
    }
  } catch (error) {
    showGate(parseApiError(error.message));
  }
}

init();
