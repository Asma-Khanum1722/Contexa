(async function () {
  "use strict";

  // ─── Config ──────────────────────────────────────────────────────────────────
  const script = document.currentScript;
  const botId = script && script.getAttribute("data-bot");
  const forceTheme = script && script.getAttribute("data-theme"); // 'light' or 'dark'
  const baseUrl =
    (script && script.getAttribute("data-origin")) ||
    (script ? new URL(script.src).origin : window.location.origin);

  if (!botId) {
    console.error("[Contexa] Missing data-bot attribute on <script> tag.");
    return;
  }

  let botConfig = { name: "Contexa AI", themeColor: "#4338CA", bgColor: "#0B1120", avatarUrl: "" };
  try {
    const res = await fetch(`${baseUrl}/api/bot/${botId}`);
    if (res.ok) {
      const data = await res.json();
      botConfig = { ...botConfig, ...data };
    }
  } catch(e) {
    console.warn("[Contexa] Failed to fetch bot config, using defaults.");
  }

  // ─── Shadow DOM host ─────────────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = "contexa-widget-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  
  const wrapper = document.createElement("div");
  wrapper.id = "sb-wrapper";
  if (forceTheme === "dark") wrapper.classList.add("theme-dark");
  else if (forceTheme === "light") wrapper.classList.add("theme-light");
  else wrapper.classList.add("theme-auto");
  
  shadow.appendChild(wrapper);

  // ─── Style generation ─────────────────────────────────────────────────────────
  function buildStyles(cfg) {
    const primary = cfg.themeColor || "#4338CA";
    const bg = cfg.bgColor || "";
    
    return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* Default Light Theme */
    #sb-wrapper {
      --sb-bg: #FFFFFF;
      --sb-panel-bg: ${bg || "#F8FAFC"};
      --sb-text: #1E293B;
      --sb-text-muted: #64748B;
      --sb-border: rgba(0, 0, 0, 0.08);
      --sb-shadow: rgba(0, 0, 0, 0.12);
      --sb-bot-msg-bg: #FFFFFF;
      --sb-bot-msg-border: #E2E8F0;
      --sb-input-bg: #FFFFFF;
      --sb-code-bg: #F1F5F9;
      --sb-code-text: #0F172A;
      --sb-primary: ${primary};
      --sb-primary-text: #FFFFFF;
    }

    /* Dark Theme Properties */
    .theme-dark {
      --sb-bg: #0B1120;
      --sb-panel-bg: #0F172A;
      --sb-text: #E2E8F0;
      --sb-text-muted: #94A3B8;
      --sb-border: rgba(255, 255, 255, 0.08);
      --sb-shadow: rgba(0, 0, 0, 0.4);
      --sb-bot-msg-bg: rgba(255, 255, 255, 0.05);
      --sb-bot-msg-border: transparent;
      --sb-input-bg: rgba(0, 0, 0, 0.2);
      --sb-code-bg: rgba(0, 0, 0, 0.4);
      --sb-code-text: #CBD5E1;
    }

    /* Auto Theme based on system preference */
    @media (prefers-color-scheme: dark) {
      .theme-auto {
        --sb-bg: #0B1120;
        --sb-panel-bg: #0F172A;
        --sb-text: #E2E8F0;
        --sb-text-muted: #94A3B8;
        --sb-border: rgba(255, 255, 255, 0.08);
        --sb-shadow: rgba(0, 0, 0, 0.4);
        --sb-bot-msg-bg: rgba(255, 255, 255, 0.05);
        --sb-bot-msg-border: transparent;
        --sb-input-bg: rgba(0, 0, 0, 0.2);
        --sb-code-bg: rgba(0, 0, 0, 0.4);
        --sb-code-text: #CBD5E1;
      }
    }

    #sb-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--sb-primary);
      border: none; cursor: pointer; z-index: 2147483647;
      box-shadow: 0 4px 24px color-mix(in srgb, var(--sb-primary) 50%, transparent), 0 2px 8px var(--sb-shadow);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s;
    }
    #sb-bubble:hover { transform: scale(1.07) translateY(-2px); }
    #sb-bubble:active { transform: scale(0.94); }
    .sb-icon-chat, .sb-icon-close {
      position: absolute;
      width: 22px; height: 22px;
      transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .sb-icon-chat { opacity: 1; transform: scale(1) rotate(0deg); fill: var(--sb-primary-text); }
    .sb-icon-close { opacity: 0; transform: scale(0.5) rotate(-90deg); stroke: var(--sb-primary-text); }
    #sb-bubble.open .sb-icon-chat { opacity: 0; transform: scale(0.5) rotate(90deg); }
    #sb-bubble.open .sb-icon-close { opacity: 1; transform: scale(1) rotate(0deg); }
    #sb-bubble-img {
      width: 56px; height: 56px; border-radius: 50%;
      object-fit: cover; display: block;
      transition: opacity 0.2s ease;
    }
    #sb-bubble.open #sb-bubble-img { opacity: 0; pointer-events: none; }

    #sb-panel {
      position: fixed; bottom: 92px; right: 24px;
      width: 376px; height: 540px; max-height: calc(100vh - 120px);
      background: var(--sb-panel-bg);
      border: 1px solid var(--sb-border);
      border-radius: 20px;
      box-shadow: 0 32px 80px var(--sb-shadow), 0 8px 24px var(--sb-shadow);
      display: flex; flex-direction: column;
      z-index: 2147483647;
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
      opacity: 0; pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transform-origin: bottom right;
      transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1);
    }
    #sb-panel.open { opacity: 1; pointer-events: all; transform: translateY(0) scale(1); }

    /* Header */
    #sb-header {
      background: var(--sb-primary);
      padding: 16px 16px 14px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #sb-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,0.2); display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      overflow: hidden;
    }
    #sb-avatar svg { width: 18px; height: 18px; fill: var(--sb-primary-text); }
    #sb-avatar img { width: 36px; height: 36px; object-fit: cover; border-radius: 10px; }
    #sb-header-info { flex: 1; min-width: 0; }
    #sb-header-title { font-size: 14px; font-weight: 600; color: var(--sb-primary-text); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #sb-header-sub { font-size: 11px; color: color-mix(in srgb, var(--sb-primary-text) 70%, transparent); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
    #sb-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; display: inline-block; flex-shrink: 0; animation: sb-pulse 2s ease-in-out infinite; }
    @keyframes sb-pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
    #sb-close {
      background: rgba(255,255,255,0.15); border: none; border-radius: 8px;
      width: 30px; height: 30px; cursor: pointer; color: var(--sb-primary-text);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s; flex-shrink: 0;
    }
    #sb-close:hover { background: rgba(255,255,255,0.28); }
    #sb-close svg { width: 14px; height: 14px; stroke: var(--sb-primary-text); fill: none; }

    /* Messages */
    #sb-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: var(--sb-border) transparent;
    }
    #sb-messages::-webkit-scrollbar { width: 4px; }
    #sb-messages::-webkit-scrollbar-thumb { background: var(--sb-border); border-radius: 4px; }

    @keyframes sb-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes sb-pop-in {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }

    .sb-msg-wrap {
      display: flex; flex-direction: column; gap: 4px;
      animation: sb-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .sb-msg-wrap.user { 
      align-items: flex-end; 
      transform-origin: bottom right;
      animation: sb-pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .sb-msg-wrap.bot  { align-items: flex-start; }

    .sb-msg {
      max-width: 85%; padding: 10px 14px; border-radius: 16px;
      font-size: 13.5px; line-height: 1.6; word-break: break-word; color: var(--sb-text);
    }
    .sb-msg.user {
      background: var(--sb-primary);
      color: var(--sb-primary-text); border-bottom-right-radius: 4px;
    }
    .sb-msg.bot {
      background: var(--sb-bot-msg-bg);
      border: 1px solid var(--sb-bot-msg-border);
      border-bottom-left-radius: 4px;
    }
    .sb-msg.error {
      background: rgba(239,68,68,0.1); color: #ef4444;
      border: 1px solid rgba(239,68,68,0.2); border-radius: 12px;
    }

    /* Bot message markdown */
    .sb-msg.bot strong { font-weight: 600; color: var(--sb-text); }
    .sb-msg.bot em { font-style: italic; color: var(--sb-text-muted); }
    .sb-msg.bot code {
      background: var(--sb-code-bg); color: var(--sb-code-text);
      padding: 2px 5px; border-radius: 4px; font-size: 12.5px; font-family: monospace;
    }
    .sb-msg.bot pre {
      background: var(--sb-code-bg); border: 1px solid var(--sb-border);
      border-radius: 8px; padding: 12px; margin: 8px 0;
      overflow-x: auto; font-size: 12px; font-family: monospace; line-height: 1.6; color: var(--sb-code-text);
    }
    .sb-msg.bot pre code { background: none; padding: 0; }
    .sb-msg.bot ul, .sb-msg.bot ol { padding-left: 18px; margin: 4px 0; }
    .sb-msg.bot li { margin: 4px 0; }
    .sb-msg.bot a { color: var(--sb-primary); text-decoration: underline; text-underline-offset: 2px; }
    .sb-msg.bot blockquote {
      border-left: 3px solid var(--sb-primary); padding-left: 12px;
      color: var(--sb-text-muted); margin: 6px 0;
    }

    /* Sources */
    .sb-sources-toggle {
      display: flex; align-items: center; gap: 4px; margin-top: 6px;
      font-size: 11px; color: var(--sb-text-muted); cursor: pointer;
      user-select: none; transition: color 0.2s;
    }
    .sb-sources-toggle:hover { color: var(--sb-text); }
    .sb-sources-toggle svg { width: 12px; height: 12px; fill: currentColor; transition: transform 0.2s; }
    .sb-sources-toggle.sb-open svg { transform: rotate(180deg); }
    .sb-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; overflow: hidden; max-height: 200px; transition: max-height 0.25s ease, opacity 0.2s; }
    .sb-sources.sb-collapsed { max-height: 0; opacity: 0; pointer-events: none; margin: 0; }
    .sb-source-chip {
      font-size: 11px; padding: 3px 8px; border-radius: 20px;
      background: var(--sb-code-bg); color: var(--sb-text-muted);
      border: 1px solid var(--sb-border);
    }

    /* Typing */
    .sb-typing {
      align-self: flex-start; display: flex; gap: 5px;
      padding: 14px 16px; background: var(--sb-bot-msg-bg); border: 1px solid var(--sb-bot-msg-border);
      border-radius: 16px; border-bottom-left-radius: 4px;
    }
    .sb-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--sb-primary); opacity: 0.3;
      animation: sb-pulse-scale 1.2s ease-in-out infinite;
    }
    .sb-typing span:nth-child(2) { animation-delay: 0.15s; }
    .sb-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes sb-pulse-scale {
      0%, 100% { transform: scale(0.8); opacity: 0.3; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    /* Cursor */
    .sb-cursor {
      display: inline-block; width: 2px; height: 14px;
      background: var(--sb-primary); margin-left: 3px; vertical-align: middle;
      animation: sb-blink 0.75s steps(1) infinite;
    }
    @keyframes sb-blink { 0%,100%{opacity:1;} 50%{opacity:0;} }

    /* Input */
    #sb-input-row {
      padding: 12px; border-top: 1px solid var(--sb-border);
      display: flex; gap: 8px; align-items: center; flex-shrink: 0;
      background: var(--sb-panel-bg);
    }
    #sb-input {
      flex: 1; background: var(--sb-input-bg);
      border: 1px solid var(--sb-border);
      border-radius: 12px; padding: 12px 14px; font-size: 13.5px;
      color: var(--sb-text); outline: none; font-family: inherit;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    #sb-input::placeholder { color: var(--sb-text-muted); opacity: 0.7; }
    #sb-input:focus { border-color: var(--sb-primary); background: var(--sb-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sb-primary) 15%, transparent); }
    #sb-input:disabled { opacity: 0.5; cursor: not-allowed; }

    #sb-send {
      background: var(--sb-primary);
      border: none; border-radius: 12px; width: 44px; height: 44px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #sb-send:hover:not(:disabled) { opacity: 0.9; transform: scale(1.04); }
    #sb-send:active { transform: scale(0.95); }
    #sb-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    #sb-send svg { width: 18px; height: 18px; stroke: var(--sb-primary-text); }

    #sb-footer {
      text-align: center; padding: 4px 0 10px;
      font-size: 10px; color: var(--sb-text-muted); flex-shrink: 0;
      letter-spacing: 0.02em; font-weight: 500;
    }

    #sb-tooltip {
      position: fixed; bottom: 94px; right: 24px;
      background: var(--sb-primary);
      color: var(--sb-primary-text); padding: 12px 16px; border-radius: 14px;
      font-size: 13.5px; font-weight: 500;
      box-shadow: 0 8px 24px var(--sb-shadow);
      opacity: 0; transform: translateY(10px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483646;
      transform-origin: bottom right;
    }
    #sb-tooltip.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; cursor: pointer; }
    #sb-tooltip::after {
      content: ''; position: absolute;
      bottom: -6px; right: 22px;
      border-width: 7px 7px 0; border-style: solid;
      border-color: var(--sb-primary) transparent transparent;
      display: block; width: 0;
    }

    @media (max-width: 420px) {
      #sb-panel { width: calc(100vw - 16px); right: 8px; bottom: 76px; max-height: calc(100vh - 90px); border-radius: 16px; }
      #sb-bubble { right: 12px; bottom: 12px; width: 50px; height: 50px; }
      #sb-bubble-img { width: 50px; height: 50px; }
      #sb-tooltip { right: 12px; bottom: 76px; max-width: calc(100vw - 80px); font-size: 12.5px; }
    }
  `;
  }

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = buildStyles(botConfig);
  shadow.appendChild(style);

  // ─── Minimal markdown renderer ────────────────────────────────────────────────
  function renderMarkdown(text) {
    return text
      .replace(/\[(?:Source\s*)?\d+\]/g, '') // Strip inline citations like [1] or [Source 1]
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  // ─── Icons ────────────────────────────────────────────────────────────────────
  const chatSvg = `<svg class="sb-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7.5 14c-.83 0-1.5-.67-1.5-1.5S6.67 11 7.5 11s1.5.67 1.5 1.5S8.33 14 7.5 14zm4.5 0c-.83 0-1.5-.67-1.5-1.5S11.17 11 12 11s1.5.67 1.5 1.5S12.83 14 12 14zm4.5 0c-.83 0-1.5-.67-1.5-1.5S15.67 11 16.5 11s1.5.67 1.5 1.5S17.33 14 16.5 14z"/></svg>`;
  const closeSvg = `<svg class="sb-icon-close" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const sendSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><polyline points="15 5 22 12 15 19"/></svg>`;
  const closePanelSvg = `<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const botSvg   = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="8.5" cy="16" r="1" fill="currentColor"/><circle cx="15.5" cy="16" r="1" fill="currentColor"/></svg>`;

  // ─── Build bubble ─────────────────────────────────────────────────────────────
  const bubble = document.createElement("button");
  bubble.id = "sb-bubble";
  bubble.setAttribute("aria-label", "Open Chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = chatSvg + closeSvg;

  // ─── Build tooltip ────────────────────────────────────────────────────────────
  const tooltip = document.createElement("div");
  tooltip.id = "sb-tooltip";
  tooltip.textContent = "👋 Ask me anything, I'm here to help!";

  // ─── Build avatar for header ──────────────────────────────────────────────────
  const headerAvatarHtml = botConfig.avatarUrl
    ? `<img src="${botConfig.avatarUrl}" alt="avatar" />`
    : botSvg;

  // ─── Build panel ──────────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "sb-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `${botConfig.name} chat`);
  panel.innerHTML = `
    <div id="sb-header">
      <div id="sb-avatar">${headerAvatarHtml}</div>
      <div id="sb-header-info">
        <div id="sb-header-title">${botConfig.name}</div>
        <div id="sb-header-sub"><span id="sb-dot"></span>Online · AI Assistant</div>
      </div>
      <button id="sb-close" aria-label="Close chat">${closePanelSvg}</button>
    </div>
    <div id="sb-messages" role="log" aria-live="polite"></div>
    <div id="sb-input-row">
      <input id="sb-input" type="text" placeholder="Ask anything…" autocomplete="off" aria-label="Chat message" />
      <button id="sb-send" aria-label="Send">${sendSvg}</button>
    </div>
    <div id="sb-footer">Powered by Contexa</div>
  `;

  wrapper.appendChild(bubble);
  wrapper.appendChild(tooltip);
  wrapper.appendChild(panel);

  // ─── Session history ──────────────────────────────────────────────────────────
  const SESSION_KEY = `sb_history_${botId}`;
  const MAX_HISTORY = 40;
  function loadHistory()  { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"); } catch { return []; } }
  function saveHistory(m) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(m.slice(-MAX_HISTORY))); } catch {} }
  let history = loadHistory();

  // Proactive tooltip logic
  let tooltipTimeout;
  if (!sessionStorage.getItem(SESSION_KEY)) {
    tooltipTimeout = setTimeout(() => {
      if (!panelOpen) tooltip.classList.add("show");
    }, 2500);
  }
  tooltip.addEventListener("click", () => {
    tooltip.classList.remove("show");
    togglePanel();
  });

  // ─── Refs ─────────────────────────────────────────────────────────────────────
  const messagesEl = shadow.getElementById("sb-messages");
  const inputEl    = shadow.getElementById("sb-input");
  const sendBtn    = shadow.getElementById("sb-send");
  const closeBtn   = shadow.getElementById("sb-close");

  // ─── Rendering ────────────────────────────────────────────────────────────────
  function appendMessage(text, role) {
    const wrap = document.createElement("div");
    wrap.className = `sb-msg-wrap ${role}`;
    const el = document.createElement("div");
    el.className = `sb-msg ${role}`;
    el.innerHTML = role === "bot" ? renderMarkdown(text) : "";
    if (role !== "bot") el.textContent = text;
    wrap.appendChild(el);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "sb-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function setDisabled(d) { sendBtn.disabled = d; inputEl.disabled = d; }

  // ─── Restore history ──────────────────────────────────────────────────────────
  let historyRestored = false;
  function restoreHistory() {
    if (history.length === 0) {
      appendMessage("👋 Hi! I'm here to help. Ask me anything!", "bot");
    } else {
      history.forEach(m => appendMessage(m.text, m.role, m.sources));
    }
  }

  // ─── Send ─────────────────────────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    appendMessage(text, "user");
    history.push({ role: "user", text });
    inputEl.value = "";
    setDisabled(true);
    const typing = showTyping();

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, message: text }),
      });
      typing.remove();

      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        let errMsg = d.error || `Error ${res.status}`;
        if (res.status === 429) {
          errMsg = "I'm getting a lot of questions right now, try again shortly";
        }
        appendMessage(errMsg, "error");
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "sb-msg-wrap bot";
      const msgEl = document.createElement("div");
      msgEl.className = "sb-msg bot";
      const cursor = document.createElement("span");
      cursor.className = "sb-cursor";
      msgEl.appendChild(cursor);
      wrap.appendChild(msgEl);
      messagesEl.appendChild(wrap);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", fullText = "", sources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "token") {
              fullText += ev.text;
              msgEl.innerHTML = renderMarkdown(fullText);
              msgEl.appendChild(cursor);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            } else if (ev.type === "done") {
              cursor.remove();
              msgEl.innerHTML = renderMarkdown(fullText);
            } else if (ev.type === "error") {
              cursor.remove(); msgEl.className = "sb-msg error"; msgEl.textContent = ev.error || "Something went wrong.";
            }
          } catch {}
        }
      }
      if (fullText) { history.push({ role: "bot", text: fullText, sources }); saveHistory(history); }
    } catch {
      typing.remove();
      appendMessage("Connection error — please try again.", "error");
    } finally {
      setDisabled(false);
      inputEl.focus();
    }
  }

  // ─── Toggle ───────────────────────────────────────────────────────────────────
  let panelOpen = false;
  function togglePanel() {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    bubble.classList.toggle("open", panelOpen);
    bubble.setAttribute("aria-expanded", String(panelOpen));
    
    if (panelOpen) {
      tooltip.classList.remove("show");
      clearTimeout(tooltipTimeout);
      if (!historyRestored) { restoreHistory(); historyRestored = true; }
      inputEl.focus();
    }
  }

  // ─── Live config update via postMessage (sandbox preview) ──────────────────
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "sb-update") return;
    const cfg = e.data.config || {};
    Object.assign(botConfig, cfg);
    style.textContent = buildStyles(botConfig);
    // Update title
    const titleEl = shadow.getElementById("sb-header-title");
    if (titleEl && cfg.name) titleEl.textContent = cfg.name;
    // Update avatar in header if changed
    if (cfg.avatarUrl !== undefined) {
      const avatarEl = shadow.getElementById("sb-avatar");
      if (avatarEl) avatarEl.innerHTML = cfg.avatarUrl ? `<img src="${cfg.avatarUrl}" alt="avatar" />` : botSvg;
    }
  });

  // ─── Events ───────────────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) togglePanel(); });
  bubble.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", togglePanel);
  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
})();
