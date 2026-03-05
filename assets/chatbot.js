/* ═══════════════════════════════════════════════════════════
   STRATEGE — Chatbot Widget (self-initializing)
   Load via: <script src="/assets/chatbot.js" defer></script>
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── Config ──
  var API_URL = '/api/chatbot';
  var SESSION_KEY = 'stratege_chatbot_session';
  var HISTORY_KEY = 'stratege_chatbot_history';
  var SESSION_ID = sessionStorage.getItem('stratege_chatbot_sid') || ('cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  sessionStorage.setItem('stratege_chatbot_sid', SESSION_ID);

  var LOGO_SVG_SMALL = '<svg viewBox="0 0 36 36" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#fff"/>' +
    '<path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#95E8DF"/>' +
    '<path d="M26 2.5C26 2.5 27 5.5 24 6.5C24 6.5 27 7.5 26 10.5C26 10.5 27 7.5 30 6.5C30 6.5 27 5.5 26 2.5Z" fill="#B8F0E8"/>' +
    '</svg>';

  var CHAT_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var SEND_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var MINIMIZE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  // ── Inject styles ──
  var styleEl = document.createElement('style');
  styleEl.textContent = '\n' +
    '#stg-chatbot-fab{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#4ECDC4,#26A09A);color:#fff;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(78,205,196,.4);z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s;}\n' +
    '#stg-chatbot-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(78,205,196,.55);}\n' +
    '#stg-chatbot-fab .stg-unread{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#EF4444;border-radius:50%;border:2px solid #fff;display:none;}\n' +
    '#stg-chatbot-panel{position:fixed;bottom:100px;right:24px;width:380px;height:540px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(27,42,74,.18);z-index:99998;display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(24px) scale(.95);pointer-events:none;transition:opacity .3s cubic-bezier(.4,0,.2,1),transform .3s cubic-bezier(.4,0,.2,1);}\n' +
    '#stg-chatbot-panel.stg-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}\n' +

    /* Header */
    '.stg-chat-header{background:linear-gradient(135deg,#1B2A4A 0%,#2D3A52 100%);color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;}\n' +
    '.stg-chat-header-logo{width:40px;height:40px;background:rgba(78,205,196,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}\n' +
    '.stg-chat-header-info{flex:1;min-width:0;}\n' +
    '.stg-chat-header-title{font-size:15px;font-weight:700;letter-spacing:.3px;}\n' +
    '.stg-chat-header-status{font-size:12px;color:#95E8DF;display:flex;align-items:center;gap:5px;margin-top:2px;}\n' +
    '.stg-chat-header-status::before{content:"";width:7px;height:7px;background:#4ECDC4;border-radius:50%;}\n' +
    '.stg-chat-header-actions{display:flex;gap:4px;}\n' +
    '.stg-chat-header-actions button{background:rgba(255,255,255,.1);border:none;color:#fff;width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;}\n' +
    '.stg-chat-header-actions button:hover{background:rgba(255,255,255,.2);}\n' +

    /* Messages area */
    '.stg-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#F8FAFB;scroll-behavior:smooth;}\n' +
    '.stg-chat-messages::-webkit-scrollbar{width:5px;}\n' +
    '.stg-chat-messages::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px;}\n' +

    /* Message bubbles */
    '.stg-msg{max-width:85%;animation:stgFadeIn .3s ease;}\n' +
    '.stg-msg-bot{align-self:flex-start;}\n' +
    '.stg-msg-user{align-self:flex-end;}\n' +
    '.stg-msg-bubble{padding:12px 16px;font-size:14px;line-height:1.55;border-radius:16px;word-wrap:break-word;}\n' +
    '.stg-msg-bot .stg-msg-bubble{background:#fff;color:#1B2A4A;border:1px solid #E8ECF0;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.04);}\n' +
    '.stg-msg-user .stg-msg-bubble{background:linear-gradient(135deg,#4ECDC4,#3DBDB5);color:#fff;border-bottom-right-radius:4px;}\n' +
    '.stg-msg-time{font-size:11px;color:#94A3B8;margin-top:4px;padding:0 4px;}\n' +
    '.stg-msg-user .stg-msg-time{text-align:right;}\n' +

    /* Markdown-like in bot messages */
    '.stg-msg-bot .stg-msg-bubble strong{color:#1B2A4A;font-weight:600;}\n' +

    /* Typing indicator */
    '.stg-typing{align-self:flex-start;display:none;}\n' +
    '.stg-typing .stg-msg-bubble{display:flex;gap:5px;padding:14px 20px;}\n' +
    '.stg-typing-dot{width:8px;height:8px;background:#94A3B8;border-radius:50%;animation:stgBounce 1.4s infinite;}\n' +
    '.stg-typing-dot:nth-child(2){animation-delay:.2s;}\n' +
    '.stg-typing-dot:nth-child(3){animation-delay:.4s;}\n' +

    /* Suggestions */
    '.stg-suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}\n' +
    '.stg-suggestion-btn{background:#EFF8F7;color:#26A09A;border:1px solid #B8F0E8;padding:7px 14px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}\n' +
    '.stg-suggestion-btn:hover{background:#4ECDC4;color:#fff;border-color:#4ECDC4;}\n' +

    /* Input area */
    '.stg-chat-input{padding:12px 16px;border-top:1px solid #E8ECF0;background:#fff;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}\n' +
    '.stg-chat-input textarea{flex:1;border:1px solid #DEE2E6;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;resize:none;max-height:80px;min-height:40px;line-height:1.4;outline:none;transition:border-color .2s;}\n' +
    '.stg-chat-input textarea:focus{border-color:#4ECDC4;}\n' +
    '.stg-chat-input textarea::placeholder{color:#94A3B8;}\n' +
    '.stg-chat-send{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4ECDC4,#26A09A);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s,transform .15s;}\n' +
    '.stg-chat-send:hover{transform:scale(1.05);}\n' +
    '.stg-chat-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}\n' +

    /* Powered by */
    '.stg-chat-powered{text-align:center;font-size:11px;color:#94A3B8;padding:6px;background:#fff;border-top:1px solid #F1F5F9;flex-shrink:0;}\n' +

    /* Animations */
    '@keyframes stgFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}\n' +
    '@keyframes stgBounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-6px);}}\n' +

    /* Mobile */
    '@media(max-width:480px){\n' +
      '#stg-chatbot-panel{bottom:0;right:0;left:0;width:100%;height:100%;border-radius:0;}\n' +
      '#stg-chatbot-fab{bottom:16px;right:16px;width:56px;height:56px;}\n' +
    '}\n';

  document.head.appendChild(styleEl);

  // ── Build DOM ──
  var isOpen = false;
  var hasUnread = false;
  var hasGreeted = false;
  var history = [];

  // Restore history from sessionStorage
  try {
    var stored = sessionStorage.getItem(HISTORY_KEY);
    if (stored) {
      history = JSON.parse(stored);
      hasGreeted = true;
    }
  } catch(e) {}

  // FAB button
  var fab = document.createElement('button');
  fab.id = 'stg-chatbot-fab';
  fab.setAttribute('aria-label', 'Ouvrir le chat');
  fab.innerHTML = CHAT_ICON + '<span class="stg-unread"></span>';

  // Panel
  var panel = document.createElement('div');
  panel.id = 'stg-chatbot-panel';
  panel.innerHTML =
    '<div class="stg-chat-header">' +
      '<div class="stg-chat-header-logo">' + LOGO_SVG_SMALL + '</div>' +
      '<div class="stg-chat-header-info">' +
        '<div class="stg-chat-header-title">Conseiller IA Stratege</div>' +
        '<div class="stg-chat-header-status">En ligne</div>' +
      '</div>' +
      '<div class="stg-chat-header-actions">' +
        '<button class="stg-btn-minimize" aria-label="Reduire">' + MINIMIZE_ICON + '</button>' +
        '<button class="stg-btn-close" aria-label="Fermer">' + CLOSE_ICON + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="stg-chat-messages" id="stg-chat-messages">' +
      '<div class="stg-msg stg-msg-bot stg-typing" id="stg-typing">' +
        '<div class="stg-msg-bubble">' +
          '<div class="stg-typing-dot"></div>' +
          '<div class="stg-typing-dot"></div>' +
          '<div class="stg-typing-dot"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="stg-chat-input">' +
      '<textarea id="stg-chat-textarea" placeholder="Posez votre question..." rows="1"></textarea>' +
      '<button class="stg-chat-send" id="stg-chat-send" aria-label="Envoyer">' + SEND_ICON + '</button>' +
    '</div>' +
    '<div class="stg-chat-powered">Stratege CGP &mdash; Lyon, France</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // ── References ──
  var messagesContainer = document.getElementById('stg-chat-messages');
  var typingEl = document.getElementById('stg-typing');
  var textarea = document.getElementById('stg-chat-textarea');
  var sendBtn = document.getElementById('stg-chat-send');
  var unreadDot = fab.querySelector('.stg-unread');

  // ── Open/Close logic ──
  function openChat() {
    isOpen = true;
    panel.classList.add('stg-open');
    fab.innerHTML = CLOSE_ICON;
    fab.style.background = 'linear-gradient(135deg,#1B2A4A,#2D3A52)';
    hideUnread();
    textarea.focus();

    if (!hasGreeted) {
      hasGreeted = true;
      setTimeout(function() {
        addBotMessage(
          'Bonjour ! Je suis votre **conseiller IA Stratege**. Comment puis-je vous aider ?\n\nSimulation, SCPI, credit immobilier, catalogue de biens... Je suis la pour repondre a toutes vos questions sur l\'investissement immobilier.',
          [
            { label: 'Simuler un credit', action: 'pret' },
            { label: 'Top SCPI 2026', action: 'scpi' },
            { label: 'Prendre RDV', action: 'rdv' },
            { label: 'Voir le catalogue', action: 'catalogue' }
          ]
        );
      }, 500);
    }
  }

  function closeChat() {
    isOpen = false;
    panel.classList.remove('stg-open');
    fab.innerHTML = CHAT_ICON + '<span class="stg-unread" style="display:none"></span>';
    fab.style.background = 'linear-gradient(135deg,#4ECDC4,#26A09A)';
    unreadDot = fab.querySelector('.stg-unread');
  }

  function toggleChat() {
    if (isOpen) closeChat(); else openChat();
  }

  fab.addEventListener('click', toggleChat);
  panel.querySelector('.stg-btn-close').addEventListener('click', closeChat);
  panel.querySelector('.stg-btn-minimize').addEventListener('click', closeChat);

  // ── Format text (basic markdown) ──
  function formatText(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function getTimeStr() {
    var d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  // ── Add messages ──
  function addUserMessage(text) {
    var div = document.createElement('div');
    div.className = 'stg-msg stg-msg-user';
    div.innerHTML = '<div class="stg-msg-bubble">' + escapeHtml(text) + '</div>' +
                    '<div class="stg-msg-time">' + getTimeStr() + '</div>';
    messagesContainer.insertBefore(div, typingEl);
    scrollToBottom();

    history.push({ role: 'user', text: text });
    saveHistory();
  }

  function addBotMessage(text, suggestions) {
    var div = document.createElement('div');
    div.className = 'stg-msg stg-msg-bot';
    var html = '<div class="stg-msg-bubble">' + formatText(text) + '</div>';

    if (suggestions && suggestions.length > 0) {
      html += '<div class="stg-suggestions">';
      suggestions.forEach(function(s) {
        html += '<button class="stg-suggestion-btn" data-action="' + escapeAttr(s.action) + '"' +
                (s.url ? ' data-url="' + escapeAttr(s.url) + '"' : '') +
                '>' + escapeHtml(s.label) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="stg-msg-time">' + getTimeStr() + '</div>';
    div.innerHTML = html;
    messagesContainer.insertBefore(div, typingEl);

    // Attach suggestion handlers
    div.querySelectorAll('.stg-suggestion-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        handleSuggestion(btn.getAttribute('data-action'), btn.getAttribute('data-url'), btn.textContent);
      });
    });

    scrollToBottom();

    history.push({ role: 'bot', text: text });
    saveHistory();

    // Show unread if panel closed
    if (!isOpen) showUnread();
  }

  function showTyping() { typingEl.style.display = 'block'; scrollToBottom(); }
  function hideTyping() { typingEl.style.display = 'none'; }

  function scrollToBottom() {
    setTimeout(function() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  }

  function showUnread() {
    hasUnread = true;
    if (unreadDot) unreadDot.style.display = 'block';
  }

  function hideUnread() {
    hasUnread = false;
    if (unreadDot) unreadDot.style.display = 'none';
  }

  function saveHistory() {
    try {
      // Keep only last 30 messages in sessionStorage
      var toSave = history.slice(-30);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
    } catch(e) {}
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Restore previous messages ──
  function restoreHistory() {
    if (history.length === 0) return;
    history.forEach(function(msg) {
      var div = document.createElement('div');
      div.className = 'stg-msg ' + (msg.role === 'user' ? 'stg-msg-user' : 'stg-msg-bot');
      var bubble = msg.role === 'user' ? escapeHtml(msg.text) : formatText(msg.text);
      div.innerHTML = '<div class="stg-msg-bubble">' + bubble + '</div>';
      messagesContainer.insertBefore(div, typingEl);
    });
    scrollToBottom();
  }

  restoreHistory();

  // ── Handle suggestion actions ──
  function handleSuggestion(action, url, label) {
    switch(action) {
      case 'link':
        if (url) window.location.href = url;
        break;
      case 'catalogue':
        window.location.href = 'catalogue.html';
        break;
      case 'scpi':
        sendMessage('Quelles sont les meilleures SCPI en 2026 ?');
        break;
      case 'pret':
        sendMessage('Quels sont les taux de credit immobilier actuels ?');
        break;
      case 'rdv':
        window.location.href = 'contact.html';
        break;
      case 'ask_ville':
        textarea.value = 'Je cherche un bien a ';
        textarea.focus();
        break;
      case 'reset':
        history = [];
        saveHistory();
        messagesContainer.querySelectorAll('.stg-msg:not(.stg-typing)').forEach(function(el) { el.remove(); });
        hasGreeted = false;
        openChat();
        break;
      default:
        sendMessage(label);
    }
  }

  // ── Send message ──
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    var msg = text.trim();
    addUserMessage(msg);
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    showTyping();

    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: history.slice(-10),
          sessionId: SESSION_ID
        })
      });

      var data = await res.json();

      // Simulate brief typing delay for natural feel
      await new Promise(function(resolve) { setTimeout(resolve, 600 + Math.random() * 800); });

      hideTyping();
      addBotMessage(data.response || 'Desole, je n\'ai pas pu traiter votre demande.', data.suggestions || []);
    } catch(err) {
      hideTyping();
      addBotMessage(
        'Desole, je rencontre un probleme de connexion. Vous pouvez nous contacter directement.',
        [{ label: 'Page de contact', action: 'link', url: 'contact.html' }]
      );
    }

    sendBtn.disabled = false;
    textarea.focus();
  }

  // ── Input handlers ──
  sendBtn.addEventListener('click', function() {
    sendMessage(textarea.value);
  });

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textarea.value);
    }
  });

  // Auto-resize textarea
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // ── Close on Escape ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

})();
