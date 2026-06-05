const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
const DEBOUNCE_DELAY = 200;

let allTabs = [];
let groupedData = [];
let currentView = 'domain';
let currentFilter = 'all';
let searchKeyword = '';
let modalCallback = null;

const categoryConfig = {
  '开发工具': {
    keywords: ['github.com', 'stackoverflow.com', 'dev.to', 'codepen.io', 'jsfiddle.net', 'localhost', '127.0.0.1', '.dev', '.io', 'developer.', 'gitlab.com', 'bitbucket.org'],
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
    color: '#3b82f6'
  },
  '视频': {
    keywords: ['youtube.com', 'youku.com', 'bilibili.com', 'vimeo.com', 'twitch.tv', 'netflix.com', 'iqiyi.com', 'video.', 'microsoftstream.com', 'webex.com', 'zoom.us'],
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    color: '#ef4444'
  },
  '社交媒体': {
    keywords: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'weibo.com', 'zhihu.com', 'tiktok.com', 'reddit.com', 'pinterest.com', 'threads.net'],
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    color: '#eab308'
  },
  '内容社区': {
    keywords: ['medium.com', 'juejin.cn', 'csdn.net', 'cnblogs.com', 'blog.', 'docs.', 'dev.to', 'hashnode.com', 'substack.com', 'notion.site'],
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
    color: '#22c55e'
  },
  '效率办公': {
    keywords: ['docs.google.com', 'sheets.google.com', 'drive.google.com', 'dropbox.com', 'notion.so', 'trello.com', 'figma.com', 'docs.', 'office.', 'microsoft.com', 'office365', 'workspace.google', 'asana.com', 'airtable.com'],
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
    color: '#64748b'
  }
};

const categoryColors = {
  '开发工具': 'blue',
  '视频': 'red',
  '社交媒体': 'yellow',
  '内容社区': 'green',
  '效率办公': 'grey',
  '其他': 'grey'
};

function extractDomain(url) {
  try {
    if (!url || url === 'chrome://newtab/' || url === 'chrome://extensions/') {
      return 'chrome';
    }
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'other';
  }
}

function classifyCategory(url) {
  if (!url || url === 'chrome://newtab/' || url === 'chrome://extensions/') {
    return '其他';
  }
  const lowerUrl = url.toLowerCase();
  for (const [category, config] of Object.entries(categoryConfig)) {
    for (const keyword of config.keywords) {
      if (lowerUrl.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return '其他';
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    let pathname = u.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    u.pathname = pathname;
    return u.toString();
  } catch {
    return url.replace(/\/+$/, '') || '/';
  }
}

function getStaleHours(lastAccessed) {
  const diff = Date.now() - lastAccessed;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours;
}

function getFaviconUrl(tab) {
  if (tab.favIconUrl && !tab.favIconUrl.includes('chrome://favicon') && !tab.favIconUrl.includes('chrome-extension://')) {
    return tab.favIconUrl;
  }
  if (tab.url) {
    try {
      const domain = extractDomain(tab.url);
      if (domain !== 'chrome' && domain !== 'other') {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      }
    } catch {}
  }
  return null;
}

async function fetchAllTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      resolve(tabs || []);
    });
  });
}

function analyzeTabs(tabs) {
  const urlMap = new Map();
  const domainMap = new Map();
  const categoryMap = new Map();

  for (const tab of tabs) {
    const normalizedUrl = normalizeUrl(tab.url || '');
    const domain = extractDomain(tab.url || '');
    const category = classifyCategory(tab.url || '');

    const isStale = getStaleHours(tab.lastAccessed || Date.now()) >= 12;

    if (!urlMap.has(normalizedUrl)) {
      urlMap.set(normalizedUrl, []);
    }
    urlMap.get(normalizedUrl).push({ ...tab, isStale, normalizedUrl });

    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push({ ...tab, isStale, normalizedUrl });

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push({ ...tab, isStale, normalizedUrl, category });
  }

  const duplicateUrls = new Set();
  for (const [url, tabList] of urlMap.entries()) {
    if (tabList.length > 1) {
      duplicateUrls.add(url);
    }
  }

  for (const tabList of urlMap.values()) {
    for (const t of tabList) {
      if (duplicateUrls.has(t.normalizedUrl)) {
        t.isDuplicate = true;
      }
    }
  }
  for (const tabList of domainMap.values()) {
    for (const t of tabList) {
      if (duplicateUrls.has(t.normalizedUrl)) {
        t.isDuplicate = true;
      }
    }
  }
  for (const tabList of categoryMap.values()) {
    for (const t of tabList) {
      if (duplicateUrls.has(t.normalizedUrl)) {
        t.isDuplicate = true;
      }
    }
  }

  function buildGroups(map, type) {
    const groups = [];
    for (const [name, tabs] of map.entries()) {
      const staleCount = tabs.filter(t => t.isStale).length;
      const duplicateCount = tabs.filter(t => t.isDuplicate).length;

      let icon = '';
      if (type === 'domain') {
        const faviconUrl = getFaviconUrl(tabs[0]);
        if (faviconUrl) {
          icon = faviconUrl;
        } else {
          icon = name.charAt(0).toUpperCase();
        }
      } else {
        icon = categoryConfig[name]?.icon || '📄';
      }

      groups.push({
        type,
        name,
        icon,
        tabs: tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)),
        staleCount,
        duplicateCount,
        collapsed: true
      });
    }
    return groups.sort((a, b) => b.tabs.length - a.tabs.length);
  }

  const domainGroups = buildGroups(domainMap, 'domain');
  const categoryGroups = buildGroups(categoryMap, 'category');

  return {
    domainGroups,
    categoryGroups,
    stats: {
      total: tabs.length,
      stale: tabs.filter(t => t.isStale).length,
      duplicate: tabs.filter(t => t.isDuplicate).length
    }
  };
}

function renderStats(stats) {
  document.getElementById('totalTabs').textContent = stats.total;
  document.getElementById('totalGroups').textContent = groupedData.length;
  document.getElementById('staleCount').textContent = stats.stale;
  document.getElementById('duplicateCount').textContent = stats.duplicate;
}

function renderGroups() {
  const container = document.getElementById('groupsContainer');
  container.innerHTML = '';

  let groups = currentView === 'domain' ? groupedData.domainGroups : groupedData.categoryGroups;

  if (currentFilter === 'stale') {
    groups = groups.filter(g => g.staleCount > 0);
  } else if (currentFilter === 'duplicate') {
    groups = groups.filter(g => g.duplicateCount > 0);
  }

  if (searchKeyword) {
    groups = groups.map(g => {
      const matchedTabs = g.tabs.filter(tab => {
        const searchText = `${tab.title} ${extractDomain(tab.url || '')} ${tab.url || ''}`.toLowerCase();
        return searchText.includes(searchKeyword.toLowerCase());
      });
      return { ...g, tabs: matchedTabs, staleCount: matchedTabs.filter(t => t.isStale).length, duplicateCount: matchedTabs.filter(t => t.isDuplicate).length };
    }).filter(g => g.tabs.length > 0);
  }

  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>没有匹配的标签</p></div>';
    return;
  }

  for (const group of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'group';

    const headerEl = document.createElement('div');
    headerEl.className = 'group-header';

    let iconHtml;
    if (group.icon && (group.icon.startsWith('http') || group.icon.startsWith('data:'))) {
      iconHtml = `<div class="group-icon"><img src="${group.icon}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${group.name.charAt(0).toUpperCase()}'"></div>`;
    } else if (group.type === 'domain') {
      iconHtml = `<div class="group-icon">${group.icon}</div>`;
    } else {
      iconHtml = `<div class="group-icon">${group.icon}</div>`;
    }

    headerEl.innerHTML = `
      ${iconHtml}
      <span class="group-name">${escapeHtml(group.name)}</span>
      <span class="group-count">${group.tabs.length}</span>
      ${group.staleCount > 0 ? `<span class="badge badge-stale">陈旧 ${group.staleCount}</span>` : ''}
      ${group.duplicateCount > 0 ? `<span class="badge badge-duplicate">重复 ${group.duplicateCount}</span>` : ''}
      <div class="group-actions">
        ${group.staleCount > 0 ? `<button class="group-action-btn danger" data-action="closeStale" data-group="${escapeHtml(group.name)}">关闭陈旧</button>` : ''}
        ${group.duplicateCount > 0 ? `<button class="group-action-btn danger" data-action="closeDuplicate" data-group="${escapeHtml(group.name)}">关闭重复</button>` : ''}
      </div>
      <div class="group-toggle ${group.collapsed ? 'collapsed' : ''}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    `;

    const tabsListEl = document.createElement('div');
    tabsListEl.className = `tabs-list ${group.collapsed ? '' : 'expanded'}`;

    for (const tab of group.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item';

      const faviconUrl = getFaviconUrl(tab);
      const faviconHtml = faviconUrl
        ? `<div class="tab-favicon"><img src="${faviconUrl}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${extractDomain(tab.url || '').charAt(0).toUpperCase()}'"></div>`
        : `<div class="tab-favicon">${extractDomain(tab.url || '').charAt(0).toUpperCase()}</div>`;

      let metaHtml = '';
      if (tab.isStale) {
        const hours = getStaleHours(tab.lastAccessed || Date.now());
        metaHtml += `<span class="tab-stale">闲置 ${hours}h</span>`;
      }
      if (tab.isDuplicate) {
        metaHtml += `<span class="tab-duplicate">重复</span>`;
      }

      tabEl.innerHTML = `
        ${faviconHtml}
        <div class="tab-info" data-tab-id="${tab.id}" data-action="focus">
          <div class="tab-title">${escapeHtml(tab.title || '无标题')}</div>
          <div class="tab-url">${escapeHtml(extractDomain(tab.url || ''))}${tab.url && tab.url !== extractDomain(tab.url || '') ? ` · ${escapeHtml(tab.url.length > 50 ? tab.url.substring(0, 50) + '...' : tab.url)}` : ''}</div>
        </div>
        <div class="tab-meta">${metaHtml}</div>
        <button class="tab-close" data-tab-id="${tab.id}" data-action="close">×</button>
      `;

      tabsListEl.appendChild(tabEl);
    }

    groupEl.appendChild(headerEl);
    groupEl.appendChild(tabsListEl);
    container.appendChild(groupEl);
  }

  attachEventListeners();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function attachEventListeners() {
  document.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.group-action-btn')) return;
      const groupEl = header.closest('.group');
      const tabsList = groupEl.querySelector('.tabs-list');
      const toggle = header.querySelector('.group-toggle');
      const isCollapsed = tabsList.classList.contains('expanded');
      tabsList.classList.toggle('expanded');
      toggle.classList.toggle('collapsed');
    });
  });

  document.querySelectorAll('.group-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const groupName = btn.dataset.group;
      handleGroupAction(action, groupName);
    });
  });

  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target;
      if (target.closest('.tab-close')) return;
      const action = target.closest('[data-action]')?.dataset.action;
      if (action === 'focus') {
        const tabId = parseInt(target.dataset.tabId);
        focusTab(tabId);
      }
    });
  });

  document.querySelectorAll('.tab-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = parseInt(btn.dataset.tabId);
      closeTab(tabId);
    });
  });
}

async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    showToast('已跳转到标签');
  } catch (err) {
    showToast('跳转失败');
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    showToast('标签已关闭');
    await refreshData();
  } catch (err) {
    showToast('关闭失败');
  }
}

async function handleGroupAction(action, groupName) {
  const groups = currentView === 'domain' ? groupedData.domainGroups : groupedData.categoryGroups;
  const group = groups.find(g => g.name === groupName);
  if (!group) return;

  let tabsToClose = [];
  if (action === 'closeStale') {
    tabsToClose = group.tabs.filter(t => t.isStale).map(t => t.id);
  } else if (action === 'closeDuplicate') {
    const urlMap = new Map();
    for (const tab of group.tabs) {
      const normalizedUrl = normalizeUrl(tab.url || '');
      if (!urlMap.has(normalizedUrl)) {
        urlMap.set(normalizedUrl, []);
      }
      urlMap.get(normalizedUrl).push(tab);
    }
    for (const [url, tabList] of urlMap.entries()) {
      if (tabList.length > 1) {
        const activeTab = tabList.find(t => t.active);
        const toKeep = activeTab ? activeTab : tabList[0];
        const toClose = tabList.filter(t => t.id !== toKeep.id);
        tabsToClose.push(...toClose.map(t => t.id));
      }
    }
  }

  if (tabsToClose.length === 0) {
    showToast('没有可操作的标签');
    return;
  }

  const actionText = action === 'closeStale' ? '关闭陈旧标签' : '关闭重复标签';
  showModal(
    '确认操作',
    `${actionText}：即将关闭 ${tabsToClose.length} 个标签，确定吗？`,
    async () => {
      try {
        await chrome.tabs.remove(tabsToClose);
        showToast(`已关闭 ${tabsToClose.length} 个标签`);
        await refreshData();
      } catch (err) {
        showToast('操作失败');
      }
    }
  );
}

async function createTabGroups() {
  try {
    const windows = await chrome.windows.getAll();
    let totalCreated = 0;

    for (const window of windows) {
      const tabs = await chrome.tabs.query({ windowId: window.id });
      const categoryMap = new Map();

      for (const tab of tabs) {
        const category = classifyCategory(tab.url || '');
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category).push(tab);
      }

      for (const [category, categoryTabs] of categoryMap.entries()) {
        if (category === '其他') continue;
        if (categoryTabs.length < 2) continue;

        const tabIds = categoryTabs.map(t => t.id);
        try {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: category,
            color: categoryColors[category] || 'grey'
          });
          totalCreated++;
        } catch (err) {
          console.error('创建标签组失败:', err);
        }
      }
    }

    if (totalCreated > 0) {
      showToast(`成功创建 ${totalCreated} 个标签组`);
    } else {
      showToast('没有可创建的标签组');
    }
  } catch (err) {
    showToast('创建标签组失败');
  }
}

function showModal(title, content, onConfirm) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalContent').textContent = content;
  overlay.classList.add('active');

  modalCallback = onConfirm;
}

function hideModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  modalCallback = null;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(() => {
    toast.classList.remove('active');
  }, 2200);
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

async function refreshData() {
  allTabs = await fetchAllTabs();
  const analyzed = analyzeTabs(allTabs);
  groupedData = analyzed;
  renderStats(analyzed.stats);
  renderGroups();
}

function initEventListeners() {
  document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    searchKeyword = e.target.value;
    renderGroups();
  }, DEBOUNCE_DELAY));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderGroups();
    });
  });

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderGroups();
    });
  });

  document.getElementById('modalCancel').addEventListener('click', hideModal);
  document.getElementById('modalConfirm').addEventListener('click', () => {
    if (modalCallback) modalCallback();
    hideModal();
  });

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  document.getElementById('createGroupsBtn').addEventListener('click', createTabGroups);
}

async function init() {
  initEventListeners();
  await refreshData();
}

init();
