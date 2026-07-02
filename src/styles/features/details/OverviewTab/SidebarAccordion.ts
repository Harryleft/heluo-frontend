/**
 * SidebarAccordion 样式
 *
 * 书斋式设计 - 古典学术风侧栏
 * 灵感来源：传统册页的装帧形式与文人书案布局
 */

export default `
/* ============================================================================
   书斋式容器 - 纵向册页布局
   ============================================================================ */

.yale-sidebar-accordion {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--classic-border);
  border-radius: var(--yale-radius-md);
  background: var(--yale-bg-elevated, #ffffff);
  overflow: hidden;
  box-shadow: var(--classic-shadow);
}

/* ============================================================================
   册页分隔线 - 水墨渐隐效果
   ============================================================================ */

.yale-sidebar-accordion__divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 1rem;
  color: var(--classic-text-muted);
  font-size: 11px;
  letter-spacing: 0.15em;
  background: linear-gradient(
    180deg,
    var(--yale-bg-warm, #fdfaf5) 0%,
    rgba(253, 250, 245, 0.4) 100%
  );
  border-top: 1px solid var(--classic-border-light);
  border-bottom: 1px solid var(--classic-border-light);
}

.yale-sidebar-accordion__divider::before,
.yale-sidebar-accordion__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--classic-border) 20%,
    var(--classic-border) 80%,
    transparent 100%
  );
}

/* ============================================================================
   册页项 - 折叠面板
   ============================================================================ */

.yale-sidebar-accordion__item {
  border-bottom: 1px solid var(--classic-border-light);
  transition: background 0.25s ease;
}

.yale-sidebar-accordion__item:last-child {
  border-bottom: none;
}

/* 展开状态 - 左侧金色竖线指示 */
.yale-sidebar-accordion__item--expanded {
  background: linear-gradient(
    90deg,
    rgba(201, 162, 39, 0.06) 0%,
    transparent 40%
  );
}

/* ============================================================================
   册页项头部 - 扉页标题风格
   ============================================================================ */

.yale-sidebar-accordion__item-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
  position: relative;
}

.yale-sidebar-accordion__item-header:hover {
  background: var(--yale-hover, #f3f4f6);
}

.yale-sidebar-accordion__item-header:focus {
  outline: 2px solid var(--yale-primary);
  outline-offset: -2px;
}

/* 左侧装饰竖线 - 展开时变为金色 */
.yale-sidebar-accordion__item--expanded > .yale-sidebar-accordion__item-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2.5px;
  border-radius: 0 2px 2px 0;
  background: var(--classic-gold);
  box-shadow: 0 0 6px rgba(184, 134, 11, 0.25);
}

.yale-sidebar-accordion__item-icon {
  font-size: 0.82rem;
  color: var(--yale-text-muted);
  width: 18px;
  text-align: center;
  transition: color 0.2s ease;
}

.yale-sidebar-accordion__item--expanded .yale-sidebar-accordion__item-icon {
  color: var(--classic-gold);
}

.yale-sidebar-accordion__item-title {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--yale-text);
  letter-spacing: 0.03em;
}

.yale-sidebar-accordion__item-count {
  font-size: 0.65rem;
  color: var(--yale-text-muted);
  background: var(--yale-bg-muted, #eef1f4);
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* 展开/折叠指示器 - 书法笔触风格 */
.yale-sidebar-accordion__item-toggle {
  font-size: 0.65rem;
  color: var(--yale-text-muted);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease;
}

.yale-sidebar-accordion__item--expanded .yale-sidebar-accordion__item-toggle {
  color: var(--classic-gold);
  transform: rotate(180deg);
}

/* ============================================================================
   册页项内容 - 展开区域
   ============================================================================ */

.yale-sidebar-accordion__item-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
  opacity: 0;
}

.yale-sidebar-accordion__item--expanded .yale-sidebar-accordion__item-content {
  max-height: 2000px;
  opacity: 1;
}

.yale-sidebar-accordion__item-body {
  padding: 0.4rem 1rem 0.75rem 1rem;
}

.yale-sidebar-accordion__item-body--person-balanced {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.yale-sidebar-accordion__item-body--person-ai {
  max-height: clamp(180px, 28vh, 300px);
}

.yale-sidebar-accordion__item-body--person-relations {
  max-height: clamp(260px, 46vh, 560px);
}

.yale-sidebar-accordion__item-body--person-recommend {
  max-height: clamp(180px, 30vh, 340px);
}

/* ============================================================================
   空状态 - 水墨留白
   ============================================================================ */

.yale-sidebar-accordion__empty {
  text-align: center;
  padding: 0.75rem 0;
  color: var(--classic-text-muted);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  position: relative;
}

.yale-sidebar-accordion__empty::before,
.yale-sidebar-accordion__empty::after {
  content: '';
  display: block;
  width: 24px;
  height: 1px;
  background: var(--classic-border);
  margin: 0.4rem auto;
}

.yale-sidebar-accordion__empty::after {
  width: 16px;
  margin-top: 0;
}

/* ============================================================================
   AI 内容区域
   ============================================================================ */

.yale-sidebar-accordion__ai-content {
  padding: 0.4rem 0;
}

.yale-sidebar-accordion__text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.8;
  color: var(--yale-text);
  text-align: justify;
}

.yale-sidebar-accordion__loading {
  margin: 0;
  font-size: 0.8rem;
  color: var(--classic-text-muted);
  font-style: italic;
  text-align: center;
  padding: 0.3rem 0;
}

.yale-sidebar-accordion__error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--yale-error, #8a1f11);
}

.yale-sidebar-accordion__refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.5rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.72rem;
  color: var(--yale-primary);
  background: transparent;
  border: 1px solid var(--yale-border);
  border-radius: var(--yale-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.yale-sidebar-accordion__refresh-btn:hover {
  background: rgba(26, 75, 124, 0.06);
  border-color: var(--yale-primary);
}

.yale-sidebar-accordion__refresh-btn:focus {
  outline: 2px solid var(--yale-primary);
  outline-offset: 2px;
}

/* ============================================================================
   推荐资源列表 - 竖排题跋风格
   ============================================================================ */

.yale-sidebar-accordion__related-content {
  padding: 0.2rem 0;
}

.yale-sidebar-accordion__related-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.yale-sidebar-accordion__related-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.55rem;
  background: var(--yale-bg-warm, #fdfaf5);
  border: 1px solid transparent;
  border-radius: var(--yale-radius-sm);
  text-decoration: none;
  transition: all 0.2s ease;
}

.yale-sidebar-accordion__related-item:hover {
  background: #ffffff;
  border-color: var(--classic-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.yale-sidebar-accordion__related-title {
  font-size: 0.8rem;
  color: var(--yale-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yale-sidebar-accordion__related-type {
  font-size: 0.65rem;
  color: var(--classic-text-muted);
  background: var(--classic-border-light);
  padding: 0.08rem 0.38rem;
  border-radius: 999px;
  margin-left: 0.4rem;
  text-transform: capitalize;
  letter-spacing: 0.03em;
}

/* ============================================================================
   外部链接 - 印章式列表
   ============================================================================ */

.yale-sidebar-accordion__external-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.yale-sidebar-accordion__external-link {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.38rem 0.5rem;
  font-size: 0.78rem;
  color: var(--yale-text);
  text-decoration: none;
  background: var(--yale-bg-warm, #fdfaf5);
  border: 1px solid transparent;
  border-radius: var(--yale-radius-sm);
  transition: all 0.2s ease;
}

.yale-sidebar-accordion__external-link:hover {
  color: var(--classic-gold);
  background: #ffffff;
  border-color: var(--classic-border);
}

.yale-sidebar-accordion__external-link i {
  color: var(--classic-text-muted);
  font-size: 0.7rem;
  transition: color 0.2s ease;
}

.yale-sidebar-accordion__external-link:hover i {
  color: var(--classic-gold);
}

.yale-sidebar-accordion__more {
  margin: 0.4rem 0 0;
  font-size: 0.72rem;
  color: var(--classic-text-muted);
  text-align: center;
  letter-spacing: 0.05em;
}

/* ============================================================================
   响应式适配
   ============================================================================ */

@media (max-width: 768px) {
  .yale-sidebar-accordion {
    border-radius: var(--yale-radius-sm);
  }

  .yale-sidebar-accordion__item-content {
    max-height: none;
    opacity: 1;
  }

  .yale-sidebar-accordion__item-toggle {
    display: none;
  }

  .yale-sidebar-accordion__item-header {
    cursor: default;
    background: transparent;
  }

  .yale-sidebar-accordion__item-body--person-balanced,
  .yale-sidebar-accordion__item-body--person-ai,
  .yale-sidebar-accordion__item-body--person-relations,
  .yale-sidebar-accordion__item-body--person-recommend {
    max-height: none;
    overflow-y: visible;
    scrollbar-gutter: auto;
  }
}
`
