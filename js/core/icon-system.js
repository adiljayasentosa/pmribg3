/* PMR WIRA UNIT — UI Icon System v1.1.70
 * Mengganti emoji yang berfungsi sebagai ikon antarmuka dengan SVG outline.
 * Emoji di paragraf/konten editorial sengaja dipertahankan agar isi teks tidak berubah.
 */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    check: '<path d="m5 12 4 4L19 6"/>', trash: '<path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6m4-6v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    edit: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5Z"/>',
    alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
    x: '<path d="m18 6-12 12M6 6l12 12"/>', package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    hand: '<path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2l-3-3a2 2 0 0 1 3-3l2 2"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>',
    camera: '<path d="M14 5h-4L8 8H4a2 2 0 0 0-2 2v9h20v-9a2 2 0 0 0-2-2h-4l-2-3Z"/><circle cx="12" cy="13" r="3"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/>',
    megaphone: '<path d="m3 11 18-5v12L3 13v-2ZM3 13l2 7h5l-2-5M21 10a3 3 0 0 1 0 6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8L7.1 10.4a16 16 0 0 0 6 6l1.9-1.9a2 2 0 0 1 1.8-.6l3 .5a2 2 0 0 1 2.2 2.5Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z"/>',
    flag: '<path d="M4 22V4m0 0c6-4 10 4 16 0v12c-6 4-10-4-16 0"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    lightbulb: '<path d="M9 18h6m-5 4h4M8 14a7 7 0 1 1 8 0c-1 .7-1 2-1 2h-6s0-1.3-1-2Z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    chart: '<path d="M3 3v18h18M8 16v-4m5 4V6m5 10V9"/>', leaf: '<path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-7 10-16ZM4 21c3-6 7-9 12-12"/>',
    sparkles: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 14l1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    bolt: '<path d="m13 2-3 8h7L9 22l2-9H5l8-11Z"/>', flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-3-10-2 2-3 4-3 6-3-2-3-5-3-7-4 4-6 7-6 11a8 8 0 0 0 8 7Z"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5m5 5H9"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    graduation: '<path d="m2 10 10-5 10 5-10 5-10-5Z"/><path d="M6 12v5c4 3 8 3 12 0v-5m4-2v6"/>',
    calendarCheck: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5 2 2 4-4"/>'
  };
  const MAP = {
    '✓':'check','✅':'check','✗':'x','✕':'x','🗑':'trash','📅':'calendar','🗓':'calendar','❤':'heart','❤️':'heart','✏':'edit','✎':'edit','⚠':'alert','📦':'package','🖨':'printer','👥':'users','👤':'user','🙋':'hand','💰':'wallet','💳':'money','📷':'camera','📸':'camera','🖼':'image','🏠':'home','🔄':'refresh','📋':'clipboard','📝':'edit','📢':'megaphone','🔔':'bell','☎':'phone','🔍':'search','⚙':'settings','🚩':'flag','💾':'save','💡':'lightbulb','🕐':'clock','🕓':'clock','🔒':'lock','📊':'chart','🌱':'leaf','✨':'sparkles','✚':'plus','⚡':'bolt','🔥':'flame','🔴':'alert','👁':'eye','📣':'megaphone','👋':'hand','ℹ':'info','ℹ️':'info','✉':'mail','✉️':'mail','🗺':'map','🗺️':'map','📚':'book','🔗':'link','☰':'menu','↪':'logout','↩':'logout','📈':'chart','🎯':'target','🎓':'graduation','🗓️':'calendar','🗓':'calendar','🩺':'heart','🩹':'heart','🧾':'file','📄':'file','📁':'file','🛡':'shield','🛡️':'shield','🪴':'leaf','⭐':'sparkles','🌟':'sparkles','❌':'x','❎':'x','➕':'plus','➖':'x','⏰':'clock','🕒':'clock','🕔':'clock','🧑':'user','👨‍👩‍👧':'users','🧍':'user','🧑‍🤝‍🧑':'users','📱':'phone','💬':'activity','💭':'activity','📌':'flag','📍':'map','🧹':'trash','🗂':'file','🗂️':'file','📑':'file','🔐':'lock','🔓':'lock','🔧':'settings','🛠':'settings','🛠️':'settings','🧭':'map','🚪':'logout','🎉':'sparkles','🥇':'target','🏆':'target','🩷':'heart','💖':'heart','💗':'heart','🤝':'users','🙏':'hand','🧑‍🏫':'graduation','🧑‍💻':'settings','🔎':'search','➤':'check','♟':'users','👨':'user','👩':'user','👧':'user','🏫':'graduation','💻':'settings'
  };
  function svg(name) {
    const node = document.createElementNS(NS, 'svg');
    node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('width', '1em'); node.setAttribute('height', '1em');
    node.setAttribute('fill', 'none'); node.setAttribute('stroke', 'currentColor'); node.setAttribute('stroke-width', '1.8');
    node.setAttribute('stroke-linecap', 'round'); node.setAttribute('stroke-linejoin', 'round'); node.setAttribute('aria-hidden', 'true');
    node.classList.add('ui-icon-svg'); node.innerHTML = ICONS[name] || ICONS.sparkles; return node;
  }
  function convertTextNode(node) {
    if (!node.parentElement || node.parentElement.closest('script,style,textarea,input,code,pre,[data-keep-emoji]')) return;
    const parent = node.parentElement;
    const isUi = !!parent.closest('button,a,[role="button"],.icon,.stat-icon,.menu-icon,.nav-icon,.action-icon,.badge,.status-badge,.toast,.alert,.empty-state,.card-icon,.feature-icon,.btn,.tab,.sidebar-item,.nav-item,.card-title,.section-label,.page-title,.page-sub,.breadcrumb,.member-brand,.member-hero-copy,.member-settings-actions,.member-lock,.member-kta-red,.pembina-stat-card,.pembina-list-dot,.kta-verified,.footer,.site-footer,footer,[class*="icon"],[class*="title"]');
    if (!isUi) return;
    const raw = node.nodeValue;
    const re = /(?:❤️|❤|🩷|💖|💗|✓|✅|❌|❎|✗|✕|✏|✎|⚠️|⚠|🗑️|🗑|📅|🗓️|🗓|📦|🖨️|🖨|👥|👤|🙋|👋|💰|💳|📷|📸|🖼️|🖼|🏠|🔄|📋|📝|📢|📣|🔔|☎|🔍|🔎|⚙️|⚙|🚩|💾|💡|🕐|🕓|🕒|🕔|⏰|🔒|🔐|🔓|📊|📈|🌱|🪴|✨|⭐|🌟|✚|➕|➖|⚡|🔥|🔴|👁|ℹ️|ℹ|✉️|✉|🗺️|🗺|📚|🔗|☰|↪|↩|🎯|🎓|🩺|🩹|🧾|📄|📁|🛡️|🛡|❌|➤|📱|💬|💭|📌|📍|🧹|🗂️|🗂|📑|🔧|🛠️|🛠|🧭|🚪|🎉|🥇|🏆|🤝|🙏|♟|👨|👩|👧|🏫|💻)/gu;
    if (!re.test(raw)) return; re.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, match;
    while ((match = re.exec(raw))) {
      if (match.index > last) frag.append(document.createTextNode(raw.slice(last, match.index)));
      const name = MAP[match[0]];
      if (name) frag.append(svg(name)); else frag.append(document.createTextNode(match[0]));
      last = match.index + match[0].length;
    }
    if (last < raw.length) frag.append(document.createTextNode(raw.slice(last)));
    node.replaceWith(frag);
  }
  function scan(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convertTextNode);
  }
  function init() {
    scan(document.body);
    const observer = new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) convertTextNode(node); else if (node.nodeType === Node.ELEMENT_NODE) scan(node); });
    }));
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
