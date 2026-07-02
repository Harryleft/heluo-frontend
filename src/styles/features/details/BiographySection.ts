/**
 * BiographySection 组件样式
 *
 * 经典学术风格，用于人物介绍的结构化展示
 * 支持多个来源和字段分类展示
 */

const biographySectionStyles = `
/* 人物介绍区块容器 */
.yale-biography-section {
  margin-top: 1.5rem;
  font-family: "Georgia", "Noto Serif SC", "Source Han Serif SC", "Source Han Serif CN", serif;
}

/* 单个来源块 - 暖色背景 + 深蓝边框 */
.yale-biography-source {
  background: var(--classic-bg);
  border: 1px solid var(--classic-border);
  border-left: 3px solid var(--classic-primary);
  border-radius: 4px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  position: relative;
}

.yale-biography-source:last-child {
  margin-bottom: 0;
}

/* 来源块装饰角 */
.yale-biography-source::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--classic-gold);
  border-left: 1px solid var(--classic-gold);
}

/* 来源标题 - 衬线字体 */
.yale-biography-source__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--classic-border);
}

.yale-biography-source__icon {
  color: var(--classic-gold);
  font-size: 1rem;
}

.yale-biography-source__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--classic-primary);
  font-family: "Georgia", "Noto Serif SC", serif;
  letter-spacing: 1px;
}

/* 字段列表 */
.yale-biography-source__fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 单个字段 */
.yale-biography-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.yale-biography-field--birth-death {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 0.5rem;
}

.yale-biography-field--alias {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* 字段标签 */
.yale-biography-field__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--classic-text-muted);
  flex-shrink: 0;
}

/* 字段值 */
.yale-biography-field__value {
  font-size: 0.9rem;
  color: var(--classic-text);
  line-height: 1.6;
}

.yale-biography-field--birth-death .yale-biography-field__value {
  color: var(--classic-primary);
  font-weight: 500;
}

.yale-biography-field--alias .yale-biography-field__value {
  color: #555;
}

/* 介绍文本（较长内容） */
.yale-biography-field--introduction .yale-biography-field__value {
  text-align: justify;
  text-indent: 2em;
  margin-top: 0.25rem;
}

/* 原始内容（回退展示） */
.yale-biography-raw {
  font-size: 0.9rem;
  color: var(--classic-text);
  line-height: 1.8;
  text-align: justify;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 多来源折叠 */
.yale-biography-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-top: 0.5rem;
  background: none;
  border: 1px dashed var(--classic-border);
  border-radius: 4px;
  color: var(--classic-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.yale-biography-toggle:hover {
  border-color: var(--classic-primary);
  color: var(--classic-primary);
  background: rgba(30, 58, 95, 0.05);
}

.yale-biography-toggle__icon {
  transition: transform 0.2s ease;
}

.yale-biography-toggle--expanded .yale-biography-toggle__icon {
  transform: rotate(180deg);
}

/* 无结构化数据时的简单展示 */
.yale-biography-simple {
  background: var(--classic-bg);
  border-left: 3px solid var(--classic-primary);
  padding: 1rem 1.25rem;
  border-radius: 0 4px 4px 0;
  position: relative;
}

.yale-biography-simple::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--classic-gold);
  border-left: 1px solid var(--classic-gold);
}

.yale-biography-simple__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--classic-primary);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "Georgia", "Noto Serif SC", serif;
}

.yale-biography-simple__content {
  font-size: 0.9rem;
  color: var(--classic-text);
  line-height: 1.8;
  text-align: justify;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 人物介绍中的超链接 - 深蓝主色 + 金色悬停 */
.yale-biography-link {
  color: var(--classic-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--classic-primary);
  transition: all 0.2s ease;
}

.yale-biography-link:hover {
  color: var(--classic-gold);
  border-bottom-color: var(--classic-gold);
  background: rgba(201, 162, 39, 0.1);
}

.yale-biography-link:visited {
  color: #5a3d7a;
  border-bottom-color: #5a3d7a;
}
`

export default biographySectionStyles
