# ChromeTabManager Chrome 扩展实施计划

## 项目概述
ChromeTabManager 是一个用于管理大量浏览器标签页的 Chrome 扩展，帮助用户从标签爆炸中恢复掌控。所有操作基于本地 `chrome.tabs` API，不上传任何数据。

---

## 技术栈
- **Manifest V3**（Chrome 扩展最新标准）
- **原生 HTML/CSS/JavaScript**（无框架依赖，保持轻量）
- **Chrome Tabs API**：`chrome.tabs.query`、`chrome.tabs.group`、`chrome.tabGroups` 等

---

## 项目目录结构
```
ChromeTabManager/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── background/
    └── background.js (可选，用于后台事件)
```

---

## 第一阶段：创建 Chrome 扩展基础结构

### 1.1 创建 manifest.json
- 配置 `manifest_version: 3`
- 声明 `tabs`、`tabGroups` 权限
- 设置 `action.default_popup` 指向 `popup/popup.html`
- 定义扩展图标路径

### 1.2 创建基础目录
- 创建 `popup/` 目录
- 创建 `icons/` 目录
- 创建 `background/` 目录

### 1.3 生成基础图标
- 生成简单的橙色主题图标（16x16、48x48、128x128）

---

## 第二阶段：实现 Popup HTML 和 CSS（玻璃质感 + 橙色主题）

### 2.1 popup.html 结构
- 顶部统计栏：总标签数、组数、陈旧数、重复数
- 搜索框 + 筛选按钮（全部/仅陈旧/仅重复）
- 主体内容区：标签组列表容器
- 操作按钮区

### 2.2 popup.css 样式设计
**核心设计理念**：玻璃质感（Glassmorphism）+ 橙色主色调

**具体样式要求**：
- 背景：半透明深色背景 + 模糊效果（`backdrop-filter: blur()`）
- 主色调：橙色系（`#ff9500`、`#ff6b00`）
- 卡片：半透明白/黑色背景 + 边框 + 圆角
- 按钮：橙色渐变 + hover 效果 + 过渡动画
- 字体：系统默认字体栈，清晰易读
- 响应式：固定宽度 400px，最小高度 500px

**组件样式**：
- 统计数字：大号字体 + 橙色高亮
- 搜索框：玻璃质感输入框
- 标签组：折叠面板样式
- 标签项：列表项样式，hover 高亮
- 徽章：小圆角标签
- 按钮：主要按钮（橙色）、次要按钮（灰色透明）

---

## 第三阶段：实现核心 JavaScript 逻辑

### 3.1 标签数据获取
```javascript
// 使用 chrome.tabs.query 获取所有窗口的所有标签
chrome.tabs.query({}, (tabs) => {
  // 按窗口分组
  // 计算每个标签的闲置时间
});
```

### 3.2 数据模型设计
```javascript
// 标签对象
{
  id: number,
  url: string,
  title: string,
  favIconUrl: string,
  windowId: number,
  lastAccessed: number, // chrome.tabs API 返回的时间戳
  isActive: boolean,
  status: 'fresh' | 'stale' | 'duplicate' | 'both'
}

// 组对象
{
  type: 'domain' | 'category',
  name: string,
  icon: string, // favicon 或类别图标
  tabs: Tab[],
  staleCount: number,
  duplicateCount: number,
  collapsed: boolean
}
```

### 3.3 域名提取工具
```javascript
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'other';
  }
}
```

### 3.4 类别分类规则引擎
**分类规则（按 URL 关键词匹配）**：

| 类别 | 关键词/域名 |
|------|------------|
| 开发工具 | github.com, stackoverflow.com, dev.to, codepen.io, jsfiddle.net, localhost, 127.0.0.1, .dev, .io, developer.* |
| 视频 | youtube.com, youku.com, bilibili.com, vimeo.com, twitch.tv, netflix.com, iqiyi.com, video.* |
| 社交媒体 | twitter.com, x.com, facebook.com, instagram.com, linkedin.com, weibo.com, zhihu.com, tiktok.com, reddit.com |
| 内容社区 | medium.com, juejin.cn, csdn.net, cnblogs.com, blog.*, docs.* |
| 效率办公 | docs.google.com, sheets.google.com, drive.google.com, dropbox.com, notion.so, trello.com, figma.com, docs.*, office.* |
| 其他 | 未匹配以上类别的所有网站 |

**实现方式**：按优先级顺序匹配，匹配到即归类

### 3.5 陈旧检测
- **陈旧定义**：超过 12 小时未访问
- **计算方式**：`Date.now() - tab.lastAccessed > 12 * 60 * 60 * 1000`
- **显示**：在标签行标注闲置小时数，如「闲置 5h」

### 3.6 重复检测
- **重复定义**：相同 URL（忽略末尾斜杠）
- **去重算法**：
  1. 标准化 URL：移除末尾斜杠
  2. 使用 Map 记录每个 URL 出现的所有标签
  3. 出现次数 > 1 的标记为重复
  4. 重复时保留策略：优先保留当前活动标签

### 3.7 双维度分组逻辑
**按域名分组**：
- 提取域名作为组名
- 组图标使用该域名标签的 favicon

**按类别分组**：
- 使用分类规则引擎归类
- 每类使用预设的线性图标（SVG 内联）

**默认行为**：
- 组默认折叠
- 按标签数量降序排列
- 每个组头显示统计徽章

---

## 第四阶段：实现搜索与筛选功能

### 4.1 搜索功能
```javascript
// 实时过滤（输入事件防抖 200ms）
searchInput.addEventListener('input', debounce((e) => {
  const keyword = e.target.value.toLowerCase();
  filterTabs(keyword, currentFilter);
}, 200));
```

**搜索范围**：标题、域名、URL

**命中时行为**：自动展开包含匹配标签的组

### 4.2 三档筛选
- **全部**：显示所有标签
- **仅陈旧**：只显示超过 12 小时未访问的标签
- **仅重复**：只显示相同 URL 的标签

**筛选逻辑**：
```javascript
function filterTabs(keyword, filterType) {
  // 1. 先按 filterType 过滤
  // 2. 再按 keyword 搜索
  // 3. 更新 UI
}
```

---

## 第五阶段：实现批量与单条操作

### 5.1 组头批量操作
**「关闭陈旧」按钮**：
1. 收集该组内所有状态为 stale 或 both 的标签 ID
2. 显示确认对话框：「即将关闭 X 个陈旧标签，确定吗？」
3. 用户确认后调用 `chrome.tabs.remove(tabIds)`
4. 关闭成功后刷新数据

**「关闭重复」按钮**：
1. 收集该组内所有重复标签（每个 URL 保留一个）
2. 保留策略：优先保留当前活动标签
3. 显示确认对话框：「即将关闭 X 个重复标签，确定吗？」
4. 用户确认后调用 `chrome.tabs.remove(tabIds)`
5. 关闭成功后刷新数据

### 5.2 单条标签操作
**关闭标签**：
- 点击标签行上的关闭按钮
- 调用 `chrome.tabs.remove(tabId)`
- 关闭成功后刷新数据

**聚焦标签**：
- 点击标签行主体区域
- 调用 `chrome.tabs.update(tabId, { active: true })` + `chrome.windows.update(windowId, { focused: true })`
- 跳转到该标签所在窗口并激活

### 5.3 确认对话框
- 自定义模态对话框（符合玻璃质感设计）
- 显示操作影响数量
- 提供「取消」和「确认」按钮

---

## 第六阶段：实现一键应用为 Chrome 标签组

### 6.1 标签组创建逻辑
**前提条件**：
- 标签组不能跨窗口
- 按窗口分别处理
- 自动跳过「其他」类别
- 自动跳过不足 2 个标签的类别

**实现步骤**：
```javascript
async function createTabGroups() {
  const windows = await chrome.windows.getAll();
  let totalCreated = 0;

  for (const window of windows) {
    const tabs = await chrome.tabs.query({ windowId: window.id });
    
    // 按类别分组（不跨窗口）
    const categoryGroups = groupByCategory(tabs);
    
    for (const [category, categoryTabs] of Object.entries(categoryGroups)) {
      // 跳过"其他"类
      if (category === 'other') continue;
      
      // 跳过不足 2 个标签的类别
      if (categoryTabs.length < 2) continue;
      
      // 创建标签组
      const tabIds = categoryTabs.map(t => t.id);
      const groupId = await chrome.tabs.group({ tabIds });
      
      // 设置组标题和颜色
      await chrome.tabGroups.update(groupId, {
        title: category,
        color: getCategoryColor(category)
      });
      
      totalCreated++;
    }
  }

  // 显示完成提示
  showNotification(`成功创建 ${totalCreated} 个标签组`);
}
```

### 6.2 类别颜色映射
```javascript
const categoryColors = {
  '开发工具': 'blue',
  '视频': 'red',
  '社交媒体': 'yellow',
  '内容社区': 'green',
  '效率办公': 'grey',
  '其他': 'grey'
};
```

### 6.3 完成提示
- 使用自定义 toast 提示（符合整体设计风格）
- 显示创建数量
- 2 秒后自动消失

---

## 第七阶段：测试与验证

### 7.1 功能测试清单
- [ ] 扩展正确加载，popup 正常打开
- [ ] 读取所有窗口所有标签页数据
- [ ] 顶部统计数字准确
- [ ] 按域名分组正确
- [ ] 按类别分组正确（所有分类规则匹配）
- [ ] 陈旧检测准确（12小时阈值）
- [ ] 重复检测准确（忽略末尾斜杠）
- [ ] 组头徽章数字正确
- [ ] 折叠/展开功能正常
- [ ] 搜索过滤实时生效
- [ ] 筛选功能正常
- [ ] 「关闭陈旧」批量操作正常
- [ ] 「关闭重复」批量操作正常
- [ ] 单条标签关闭正常
- [ ] 标签聚焦跳转正常
- [ ] 一键创建标签组正常
- [ ] 确认对话框正常显示

### 7.2 性能测试
- [ ] 100+ 标签情况下 UI 渲染流畅
- [ ] 搜索防抖有效
- [ ] 内存使用合理

### 7.3 边界情况测试
- [ ] 空标签页处理
- [ ] 无效 URL 处理
- [ ] 无网络环境下 favicon 加载
- [ ] 跨窗口标签组创建跳过

---

## 实施顺序
1. 创建基础文件结构（manifest.json、popup.html）
2. 实现 CSS 样式（玻璃质感设计）
3. 实现核心数据获取与处理逻辑
4. 实现分组与检测功能
5. 实现搜索与筛选
6. 实现批量操作与标签组创建
7. 测试与调试

---

## 注意事项
1. **Manifest V3 限制**：不使用 remote code，所有代码本地化
2. **权限最小化**：仅申请 `tabs` 和 `tabGroups` 权限
3. **用户体验**：所有批量操作必须有确认步骤
4. **离线可用**：favicon 复用标签页已加载资源，不额外请求
5. **代码规范**：保持代码整洁，添加必要注释
