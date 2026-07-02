/**
 * OverviewTab 概览页组件样式
 *
 * 经典学术风格的概览页，复用现有组件并添加统一容器样式
 * 采用两栏布局：左侧主体信息，右侧关联资源
 */

export default `
/* ========================================
   OverviewTab 容器 - 两栏布局
   ======================================== */

.yale-overview-tab {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--yale-spacing-module);
  align-items: stretch;
}

/* 无侧栏时单栏居中 */
.yale-overview-tab--no-sidebar {
  grid-template-columns: 1fr;
  max-width: 860px;
  margin: 0 auto;
}

.yale-overview-tab.yale-overview-tab--ancient-book {
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  width: min(100%, 980px);
  max-width: 980px;
  margin: 0 auto;
}

.yale-overview-tab--ancient-book .yale-overview-tab__main {
  gap: 0.9rem;
}

.yale-overview-tab--ancient-book .yale-overview-tab__sidebar {
  position: static;
  max-height: none;
  overflow: visible;
}

/* ========================================
   OverviewTab 主栏（左侧）
   ======================================== */

.yale-overview-tab__main {
  display: flex;
  flex-direction: column;
  gap: var(--yale-spacing-module);
}

/* ========================================
   OverviewTab 侧栏（右侧）
   ======================================== */

.yale-overview-tab__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--yale-spacing-module);
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

/* 侧栏子项禁止被 flex 压缩，避免“上方卡片展开后下方卡片被挤扁” */
.yale-overview-tab__sidebar > * {
  flex-shrink: 0;
}

/* 侧栏标题 - 金色下划线装饰 */
.yale-overview-tab__sidebar-title {
  font: var(--yale-font-h3);
  color: var(--yale-primary);
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--classic-gold);
  position: relative;
}

.yale-overview-tab__sidebar-title::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 30px;
  height: 2px;
  background: var(--yale-primary);
}

/* ========================================
   OverviewTab 区块
   ======================================== */

.yale-overview-tab__section {
  background-color: var(--yale-white);
  border: 1px solid var(--yale-border);
  border-radius: var(--yale-radius-md);
  padding: var(--yale-padding-lg);
  box-shadow: var(--yale-shadow-panel);
}

.yale-overview-tab__section--header {
  border-left: 4px solid var(--yale-primary);
}

/* 侧栏区块样式调整 */
.yale-overview-tab__sidebar .yale-overview-tab__section {
  padding: var(--yale-padding-md);
}

/* ========================================
   OverviewTab 摘要
   ======================================== */

.yale-overview-tab__summary {
  margin: 0;
  font: var(--yale-font-body);
  line-height: 1.8;
  color: var(--yale-text);
}

.yale-overview-tab__section--summary {
  background-color: var(--yale-light);
  border-color: transparent;
}

.ancient-book-detail__reader {
  overflow: hidden;
  border: 1px solid var(--classic-border);
  border-radius: 10px;
  background: var(--classic-panel);
  box-shadow: var(--classic-shadow);
}

.ancient-book-detail__reader-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1.1rem;
  color: var(--classic-text);
  border-bottom: 1px solid var(--classic-border);
  background:
    linear-gradient(90deg, rgba(184, 134, 11, 0.1), transparent 42%),
    var(--classic-panel);
}

.ancient-book-detail__eyebrow {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--classic-gold);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0;
}

.ancient-book-detail__reader-bar h1 {
  margin: 0;
  color: var(--classic-primary);
  font: 600 clamp(1.35rem, 2.2vw, 2rem)/1.2 var(--yale-font-serif);
}

.ancient-book-detail__reader-count {
  flex: none;
  color: var(--classic-text-muted);
  font-size: 0.82rem;
}

.ancient-book-detail__reader iframe {
  display: block;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none;
}

/* ========================================
   图书详情 Hero - 左侧蓝色竖条简约风格
   ======================================== */

.yale-overview-tab__section--book-hero {
  border: 1px solid var(--yale-border);
  border-left: 4px solid var(--yale-primary);
  background-color: var(--yale-white);
  padding: 1.25rem 1.5rem;
}

.yale-overview-tab__book-hero-head {
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  align-items: flex-start;
}

/* 封面容器 - 有/无封面均保持固定宽度 */
.yale-overview-tab__book-cover-wrapper {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  align-self: stretch;
}

/* 有封面：封面图片 */
.yale-overview-tab__book-cover-image {
  width: 88px;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--yale-border);
}

/* 无封面：书名文字占位 */
.yale-overview-tab__book-hero-cover {
  width: 88px;
  height: 100%;
  border-radius: 6px;
  border: 1px dashed #d1d5db;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.yale-overview-tab__book-cover-title {
  color: #9ca3af;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  padding: 0.5rem;
  word-break: break-all;
}

.yale-overview-tab__book-hero-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.yale-overview-tab__book-hero-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--yale-primary);
}

.yale-overview-tab__book-hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.yale-overview-tab__book-hero-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.7rem;
  line-height: 1.2;
  padding: 0.12rem 0.45rem;
}

.yale-overview-tab__book-hero-summary {
  margin: 0;
  color: #4b5563;
  font-size: 0.85rem;
  line-height: 1.75;
}

.yale-overview-tab__book-fields-anchor {
  display: flex;
  flex-direction: column;
  gap: var(--yale-spacing-module);
}

/* ========================================
   类型化信息区块 - 深蓝边框
   ======================================== */

.yale-overview-tab__section--type {
  border-left: 4px solid var(--yale-primary);
}

.yale-overview-tab__type-title {
  margin: 0 0 0.75rem;
  font: var(--yale-font-h3);
  color: var(--yale-primary);
}

.yale-overview-tab__type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.yale-overview-tab__type-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--yale-border);
  border-radius: var(--yale-radius-sm);
  background-color: var(--yale-light);
}

.yale-overview-tab__type-label {
  font-size: 0.8rem;
  color: var(--yale-muted);
}

.yale-overview-tab__type-value {
  font-size: 0.95rem;
  color: var(--yale-text);
  font-weight: 500;
  line-height: 1.55;
  word-break: break-word;
}

.yale-overview-tab__type-item--long .yale-overview-tab__type-value {
  font-weight: 400;
  line-height: 1.75;
}

.yale-overview-tab__type-link {
  font-size: 0.9rem;
  color: var(--yale-link);
  text-decoration: none;
  line-height: 1.55;
}

.yale-overview-tab__type-link:hover {
  color: var(--classic-gold);
  text-decoration: underline;
}

.yale-overview-tab__section--map {
  border-left-color: #2f6fa4;
}

.yale-overview-tab__map-canvas {
  width: 100%;
  height: 320px;
  border: 1px solid var(--yale-border);
  border-radius: var(--yale-radius-sm);
  overflow: hidden;
  background: #f3f6f9;
}

.yale-overview-tab__map-status {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  color: var(--yale-muted);
}

.yale-overview-tab__map-status--error {
  color: #8a1f11;
}

.yale-overview-tab__map-location-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.7rem;
}

.yale-overview-tab__map-location-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--yale-border);
  background: #fff;
  color: var(--yale-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

/* ========================================
   地理详情页 - 卡片化布局
   ======================================== */

.yale-overview-tab--place {
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.2rem;
}

.yale-overview-tab--place .yale-overview-tab__main {
  gap: 1rem;
}

.yale-overview-tab--place .yale-overview-tab__sidebar {
  gap: 0.95rem;
}

.yale-overview-tab__section--place-hero {
  border: 1px solid var(--classic-border-warm);
  background:
    radial-gradient(circle at 6% 12%, rgba(201, 162, 39, 0.14), rgba(201, 162, 39, 0)),
    linear-gradient(135deg, #faf7f1 0%, #fffdf9 55%, #f4ede2 100%);
  padding: 1rem 1.15rem;
}

.yale-place-detail__entity-title {
  margin: 0;
  font-size: 1.56rem;
  line-height: 1.3;
  color: var(--yale-primary);
  letter-spacing: 0.01em;
}

.yale-place-detail__entity-parent {
  margin: 0.56rem 0 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.24rem;
}

.yale-place-detail__entity-parent-label {
  color: var(--yale-muted);
  font-size: 0.84rem;
  line-height: 1.62;
}

.yale-place-detail__entity-parent-links {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.24rem;
}

.yale-place-detail__entity-parent-link {
  color: var(--yale-link);
  text-decoration: none;
  font-size: 0.88rem;
  line-height: 1.6;
}

.yale-place-detail__entity-parent-link:hover {
  color: var(--classic-gold);
  text-decoration: underline;
}

.yale-place-detail__entity-parent-sep {
  color: var(--yale-muted);
  font-size: 0.8rem;
}

.yale-place-card {
  border: 1px solid var(--classic-border-warm);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 245, 237, 0.95));
  border-radius: 12px;
  box-shadow: var(--classic-shadow-md);
  transition: box-shadow 0.2s ease;
  padding: 0.96rem 1rem;
}

.yale-place-detail__title {
  margin: 0 0 0.7rem;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.45;
  color: #5a4632;
}

.yale-place-history-chart {
  min-height: 250px;
}

.yale-place-history-chart__timeline {
  width: 100%;
  min-height: 240px;
}

.yale-place-history-chart .vis-timeline {
  border-color: #d8c9b6;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
}

.yale-place-history-chart .vis-labelset .vis-label {
  color: #6a5841;
  font-size: 0.78rem;
}

.yale-place-history-chart .vis-item {
  border-color: #c7af89;
  background: rgba(243, 232, 214, 0.95);
  color: #3f3324;
}

.yale-place-history-chart .vis-item.vis-range {
  border-radius: 10px;
}

.yale-place-history-chart .vis-time-axis .vis-text {
  color: #7f715f;
}

.yale-place-detail__map-canvas {
  width: 100%;
  height: 320px;
  border: 1px solid var(--classic-border-warm);
  border-radius: var(--yale-radius-sm);
  overflow: hidden;
  background: #f5f1ea;
}

.yale-place-detail__meta {
  margin: 0.55rem 0 0;
  color: var(--yale-muted);
  font-size: 0.79rem;
  line-height: 1.45;
}

.yale-place-detail__meta--error {
  color: #8a1f11;
}

.yale-place-detail__point-list {
  margin-top: 0.62rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
}

.yale-place-detail__point-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--classic-border-warm);
  padding: 0.14rem 0.48rem;
  font-size: 0.76rem;
  line-height: 1.35;
  color: #6e5c47;
}

/* ========================================
   关联资源卡片样式 - 金色装饰
   ======================================== */

.yale-overview-tab__related-card {
  background-color: var(--yale-white);
  border: 1px solid var(--yale-border);
  border-radius: var(--yale-radius-md);
  overflow: hidden;
  position: relative;
}

/* 金色顶部装饰线 */
.yale-overview-tab__related-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--classic-gold);
}

.yale-overview-tab__related-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--yale-light);
  border-bottom: 1px solid var(--yale-border);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.yale-overview-tab__related-header:hover {
  background-color: rgba(201, 162, 39, 0.1);
}

.yale-overview-tab__related-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--yale-text);
}

.yale-overview-tab__related-title i {
  color: var(--classic-gold);
}

.yale-overview-tab__related-title-block {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.yale-overview-tab__related-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: var(--yale-muted);
  line-height: 1.45;
}

.yale-overview-tab__related-count {
  font-size: 0.8rem;
  color: var(--yale-muted);
  background-color: var(--yale-white);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  border: 1px solid var(--yale-border);
}

.yale-overview-tab__related-toggle {
  color: var(--yale-muted);
  transition: transform 0.2s ease;
}

.yale-overview-tab__related-card--expanded .yale-overview-tab__related-toggle {
  transform: rotate(180deg);
}

.yale-overview-tab__related-content {
  padding: 0.75rem 1rem;
  max-height: none;
  overflow-y: visible;
}

.yale-overview-tab__related-content--collapsed {
  display: none;
}

.yale-overview-tab__related-content--external {
  max-height: none;
  overflow-y: visible;
}

.yale-overview-tab__related-content--scroll {
  max-height: 240px;
  overflow-y: auto;
}

/* 关联链接项 */
.yale-overview-tab__link-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(212, 200, 184, 0.5);
}

.yale-overview-tab__link-item:last-child {
  border-bottom: none;
}

.yale-overview-tab__link-icon {
  color: var(--classic-gold);
  font-size: 0.9rem;
  margin-top: 2px;
}

.yale-overview-tab__link-info {
  flex: 1;
  min-width: 0;
}

.yale-overview-tab__link-label {
  font-size: 0.85rem;
  color: var(--yale-text);
  text-decoration: none;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yale-overview-tab__link-label:hover {
  color: var(--classic-gold);
  text-decoration: underline;
}

.yale-overview-tab__link-summary {
  font-size: 0.75rem;
  color: var(--yale-muted);
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============================================================================
   关联人物卡片样式 - 按原始关系类型分组
   ============================================================================ */

/* 分组内容容器 */
.yale-overview-tab__related-content--grouped {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* 单个关系类型分组 */
.yale-overview-tab__relation-group {
  border-radius: var(--yale-radius-sm);
  overflow: hidden;
  border: 1px solid var(--yale-border);
  background: rgba(255, 255, 255, 0.6);
}

/* ===== 颜色主题变体（简化为 3 种）===== */

/* 核心关系 - 主色（深蓝）：父、母、师、徒、亲属 */
.yale-overview-tab__relation-group--primary {
  background: linear-gradient(135deg, rgba(26, 75, 124, 0.08) 0%, rgba(240, 245, 250, 0.6) 100%);
  border-color: rgba(26, 75, 124, 0.2);
}

.yale-overview-tab__relation-group--primary .yale-overview-tab__relation-group-header {
  background: rgba(26, 75, 124, 0.1);
}

.yale-overview-tab__relation-group--primary .yale-overview-tab__relation-group-type {
  color: #1a4b7c;
}

/* 社交关系 - 辅助色（翠绿）：友、诗友、赠诗、合作 */
.yale-overview-tab__relation-group--secondary {
  background: linear-gradient(135deg, rgba(45, 90, 74, 0.08) 0%, rgba(240, 250, 245, 0.6) 100%);
  border-color: rgba(45, 90, 74, 0.2);
}

.yale-overview-tab__relation-group--secondary .yale-overview-tab__relation-group-header {
  background: rgba(45, 90, 74, 0.1);
}

.yale-overview-tab__relation-group--secondary .yale-overview-tab__relation-group-type {
  color: #2d5a4a;
}

/* 职业/时代 - 第三色（中性灰）：同僚、门生、同代、相关 */
.yale-overview-tab__relation-group--tertiary {
  background: rgba(248, 248, 248, 0.8);
  border-color: var(--yale-border);
}

.yale-overview-tab__relation-group--tertiary .yale-overview-tab__relation-group-header {
  background: rgba(0, 0, 0, 0.02);
}

.yale-overview-tab__relation-group--tertiary .yale-overview-tab__relation-group-type {
  color: #5a5a5a;
}

/* ===== 分组头部 ===== */
.yale-overview-tab__relation-group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.yale-overview-tab__relation-group-header:hover {
  background: rgba(0, 0, 0, 0.04) !important;
}

.yale-overview-tab__relation-group-header:focus {
  outline: 2px solid var(--yale-primary);
  outline-offset: -2px;
}

/* 关系类型标签 */
.yale-overview-tab__relation-group-type {
  font-size: 0.82rem;
  font-weight: 600;
  flex: 1;
}

/* 人数计数 */
.yale-overview-tab__relation-group-count {
  font-size: 0.72rem;
  color: var(--yale-muted);
  background: rgba(255, 255, 255, 0.7);
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* 展开/折叠图标 */
.yale-overview-tab__relation-group-toggle {
  font-size: 0.72rem;
  color: var(--yale-muted);
  transition: transform 0.2s ease;
}

/* ===== 分组内容区 ===== */
.yale-overview-tab__relation-group-content {
  padding: 0.5rem 0.7rem 0.7rem;
}

/* 人物网格布局 */
.yale-overview-tab__relation-person-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}

/* 单个人物卡片 */
.yale-overview-tab__relation-person-card {
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.55rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--yale-radius-sm);
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.yale-overview-tab__relation-person-card:hover {
  background: #fff;
  border-color: var(--classic-gold);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 人物姓名 */
.yale-overview-tab__relation-person-name {
  font-size: 0.82rem;
  color: var(--yale-text);
  font-weight: 500;
  line-height: 1.35;
}

.yale-overview-tab__relation-person-card:hover .yale-overview-tab__relation-person-name {
  color: var(--classic-gold);
}

.yale-overview-tab__recommend-list {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.yale-overview-tab__recommend-item {
  display: grid;
  grid-template-columns: 1.65rem minmax(0, 1fr);
  gap: 0.52rem;
  align-items: flex-start;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(212, 200, 184, 0.5);
}

.yale-overview-tab__recommend-item:last-child {
  border-bottom: none;
}

.yale-overview-tab__recommend-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  margin-top: 0.08rem;
  border-radius: 999px;
  background: rgba(6, 46, 92, 0.1);
  color: var(--yale-primary);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.yale-overview-tab__recommend-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.yale-overview-tab__recommend-link {
  font-size: 0.88rem;
  line-height: 1.45;
}

.yale-overview-tab__recommend-meta {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--yale-border);
  background: #fff;
  color: var(--yale-muted);
  font-size: 0.72rem;
  line-height: 1.2;
  padding: 0.14rem 0.42rem;
}

/* ========================================
   推荐资源 - 山水层次式布局
   ======================================== */

.yale-overview-tab__recommend-list--layered {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-left: 0.25rem;
}

.yale-overview-tab__recommend-item--layered {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.45rem 0.6rem;
  padding-left: calc(0.6rem + var(--indent-level, 0));
  border-radius: var(--yale-radius-sm);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 245, 237, 0.9) 100%);
  border: 1px solid rgba(212, 200, 184, 0.4);
  transition: all 0.2s ease;
}

.yale-overview-tab__recommend-item--layered:hover {
  background: #fff;
  border-color: var(--classic-gold);
  box-shadow: 0 2px 8px rgba(39, 27, 8, 0.1);
  transform: translateX(2px);
}

.yale-overview-tab__recommend-item--layered .yale-overview-tab__recommend-body {
  width: 100%;
}

.yale-overview-tab__recommend-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

/* 相关度指示器 - 圆点组 */
.yale-overview-tab__relevance-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
}

/* 单个圆点 */
.yale-overview-tab__relevance-dot {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: rgba(6, 46, 92, 0.15);
  transition: background 0.2s ease;
}

/* 实心圆点 */
.yale-overview-tab__relevance-dot--filled {
  background: var(--classic-gold);
}

.yale-overview-tab__recommend-item--layered:hover .yale-overview-tab__relevance-dot--filled {
  background: var(--yale-primary);
}

/* 外部链接列表 */
.yale-overview-tab__external-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.yale-overview-tab__external-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--yale-link);
  text-decoration: none;
  padding: 0.35rem 0;
}

.yale-overview-tab__external-link:hover {
  color: var(--classic-gold);
  text-decoration: underline;
}

.yale-overview-tab__external-link i {
  font-size: 0.75rem;
}

/* 图书封面 */
.yale-overview-tab__book-cover-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(212, 200, 184, 0.62);
  border-radius: var(--yale-radius-sm);
  background: #fff;
  padding: 0.72rem 0.68rem;
}

.yale-overview-tab__book-cover-image {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--yale-border);
  background: #f8f5ef;
  box-shadow: var(--yale-shadow-panel);
}

.yale-overview-tab__book-cover-title {
  margin: 0;
  font-size: 0.84rem;
  color: var(--yale-text);
  font-weight: 600;
  text-align: center;
  line-height: 1.45;
}

.yale-overview-tab__book-cover-isbn {
  margin: 0;
  font-size: 0.74rem;
  color: var(--yale-muted);
  text-align: center;
  word-break: break-all;
}

/* ========================================
   人物详情页 - 留白优化
   ======================================== */

.yale-overview-tab--person {
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 2rem;
}

.yale-overview-tab--book {
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 1.15rem;
}

.yale-overview-tab--book .yale-overview-tab__main {
  gap: 1.05rem;
}

.yale-overview-tab--book .yale-overview-tab__sidebar {
  gap: 0.9rem;
}

.yale-overview-tab--person .yale-overview-tab__main {
  gap: 1.5rem;
}

.yale-overview-tab--person .yale-overview-tab__section {
  padding: 1.5rem 1.6rem;
  border-radius: 10px;
}

.yale-overview-tab__person-title {
  margin: 0 0 1rem;
  font-size: 1.45rem;
  line-height: 1.35;
  letter-spacing: 0.01em;
  color: var(--yale-primary);
}

.yale-overview-tab--person .yale-overview-tab__section--summary {
  background: #fff;
  border-color: var(--yale-border);
}

.yale-overview-tab__ai-card {
  padding: 1rem 1.05rem !important;
}

.yale-overview-tab__ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.yale-overview-tab__ai-title {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 600;
}

.yale-overview-tab__ai-refresh {
  border: 1px solid var(--yale-border);
  background: #fff;
  border-radius: 6px;
  padding: 0.32rem 0.55rem;
  font-size: 0.78rem;
  color: var(--yale-muted);
  cursor: pointer;
}

.yale-overview-tab__ai-refresh:hover {
  color: var(--yale-text);
  border-color: #c9baa6;
}

.yale-overview-tab--person .yale-overview-tab__sidebar {
  gap: 1rem;
}

.yale-overview-tab--person .yale-overview-tab__sidebar-title {
  margin-bottom: 0.25rem;
}

.yale-overview-tab--person .yale-overview-tab__related-header {
  padding: 0.85rem 1rem;
}

.yale-overview-tab--person .yale-overview-tab__related-content {
  padding: 0.9rem 1rem 1rem;
  max-height: none;
  overflow-y: visible;
}

.yale-overview-tab--person .yale-overview-tab__related-content--scroll {
  max-height: 260px;
  overflow-y: auto;
}

.yale-overview-tab--person .yale-overview-tab__relation-group {
  padding: 0.7rem 0.75rem;
  margin-bottom: 0.7rem;
}

.yale-overview-tab--person .yale-overview-tab__relation-items {
  gap: 0.45rem;
}

.yale-overview-tab--person .yale-overview-tab__relation-link {
  line-height: 1.55;
}

.yale-overview-tab--person .yale-overview-tab__external-link {
  padding: 0.42rem 0;
  font-size: 0.84rem;
}

.yale-overview-tab--person .yale-overview-tab__section--metadata .entity-metadata__table {
  border-collapse: separate;
  border-spacing: 0;
}

.yale-overview-tab--person .yale-overview-tab__section--metadata .entity-metadata__label,
.yale-overview-tab--person .yale-overview-tab__section--metadata .entity-metadata__value {
  padding-top: 0.62rem;
  padding-bottom: 0.62rem;
  line-height: 1.72;
}

.yale-overview-tab--person .yale-overview-tab__section--metadata .entity-metadata__label {
  width: 136px;
  color: #7a6f62;
}

/* ========================================
   概览页内部组件样式覆盖
   ======================================== */

/* EntityHeader 样式调整 */
.yale-overview-tab__section--header .entity-header h1 {
  font: var(--yale-font-h1);
  color: var(--yale-text);
}

.yale-overview-tab__section--header .entity-header__dates {
  color: var(--yale-muted);
  font: var(--yale-font-body);
}

/* EntityMetadata 样式调整 */
.yale-overview-tab__section--metadata .entity-metadata__table {
  width: 100%;
}

.yale-overview-tab__section--metadata .entity-metadata__label {
  font: var(--yale-font-body);
  font-weight: 600;
  color: var(--yale-muted);
  padding: var(--yale-padding-sm) 0;
  width: 120px;
}

.yale-overview-tab__section--metadata .entity-metadata__value {
  font: var(--yale-font-body);
  color: var(--yale-text);
  padding: var(--yale-padding-sm) 0;
}

/* ========================================
   空状态
   ======================================== */

.yale-overview-tab__empty {
  text-align: center;
  padding: 2rem;
  color: var(--yale-muted);
}

.yale-overview-tab__empty i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  display: block;
  color: var(--classic-gold);
}

/* ========================================
   响应式设计
   ======================================== */

@media (max-width: 1024px) {
  .yale-overview-tab {
    grid-template-columns: 1fr 320px;
  }

  .yale-overview-tab--place {
    grid-template-columns: minmax(0, 1fr) 300px;
  }

  .yale-overview-tab--no-sidebar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .yale-overview-tab {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .yale-overview-tab--book .yale-overview-tab__main {
    order: 2;
  }

  .yale-overview-tab--book .yale-overview-tab__sidebar {
    order: 1;
  }

  .yale-overview-tab--place .yale-overview-tab__main {
    order: 2;
  }

  .yale-overview-tab--place .yale-overview-tab__sidebar {
    order: 1;
  }

  .yale-overview-tab__sidebar {
    position: static;
    max-height: none;
    overflow-y: visible;
  }

  .yale-overview-tab__section {
    padding: var(--yale-padding-md);
  }

  .yale-overview-tab__section--header .entity-header h1 {
    font-size: 22px;
  }

  .yale-overview-tab__section--metadata .entity-metadata__label {
    width: 100px;
    font-size: 13px;
  }

  .yale-overview-tab__section--metadata .entity-metadata__value {
    font-size: 13px;
  }

  .yale-overview-tab__book-hero-head {
    gap: 0.75rem;
  }

  .yale-overview-tab__book-cover-wrapper {
    align-self: flex-start;
  }

  .yale-overview-tab__book-cover-image {
    width: 72px;
    height: auto;
    max-height: 104px;
  }

  .yale-overview-tab__book-hero-cover {
    width: 72px;
    height: 98px;
  }

  .yale-overview-tab__book-cover-title {
    font-size: 0.8rem;
  }

  .yale-overview-tab__book-hero-title {
    font-size: 1.22rem;
  }

  .yale-place-detail__entity-title {
    font-size: 1.34rem;
  }

  .yale-overview-tab__map-canvas,
  .yale-place-detail__map-canvas {
    height: 260px;
  }

  .yale-place-history-chart__timeline {
    min-height: 220px;
  }
}

@media (max-width: 560px) {
  .yale-overview-tab__book-hero-head {
    flex-direction: column;
    gap: 0.75rem;
  }

  .yale-overview-tab__book-cover-wrapper {
    align-self: center;
  }

  .yale-overview-tab__book-cover-image,
  .yale-overview-tab__book-hero-cover {
    width: min(120px, 42vw);
  }
}

@media (max-width: 480px) {
  .yale-overview-tab {
    gap: var(--yale-spacing-card);
  }

  .yale-overview-tab__section {
    padding: var(--yale-padding-sm);
    border-radius: var(--yale-radius-sm);
  }

  .yale-overview-tab__type-grid {
    grid-template-columns: 1fr;
  }

  .yale-overview-tab__section--header {
    border-left-width: 3px;
  }

  .yale-overview-tab__summary {
    font-size: 13px;
  }

  .yale-overview-tab__related-content {
    max-height: none;
    overflow-y: visible;
  }

  .yale-overview-tab__map-canvas,
  .yale-place-detail__map-canvas {
    height: 220px;
  }

  .yale-place-history-chart__timeline {
    min-height: 200px;
  }
}

/* ========================================
   工具类 - 禁用交互的卡片头部
   ======================================== */

/* 禁用交互的卡片头部 */
.yale-overview-tab__related-header--static {
  cursor: default;
}

.yale-overview-tab__related-header--static:hover {
  background-color: var(--yale-light);
}

/* 摘要重置变体 */
.yale-overview-tab__summary--reset {
  margin: 0;
}

.yale-overview-tab__summary--error {
  margin: 0;
  color: #8a1f11;
}
`
