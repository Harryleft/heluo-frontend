/**
 * EntityMetadata 组件样式
 *
 * 经典学术风格
 * 优化表格样式、可读性和悬停效果
 */

const entityMetadataStyles = `
  .entity-metadata {
    margin-top: var(--yale-spacing-module, 1.5rem);
    padding: var(--yale-padding-md, 1rem);
    background: var(--yale-white, #ffffff);
    border-radius: var(--yale-radius-md, 8px);
    border: 1px solid var(--yale-border, #d4c8b8);
    box-shadow: var(--yale-shadow-panel, 0 1px 4px rgba(0, 0, 0, 0.06));
  }

  .entity-metadata__table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font: var(--yale-font-body, 400 14px/20px "Noto Sans SC", sans-serif);
  }

  .entity-metadata__row {
    transition: background-color 0.2s ease;
  }

  /* 行悬停 - 金色高亮 */
  .entity-metadata__row:hover {
    background-color: rgba(201, 162, 39, 0.05);
  }

  .entity-metadata__row:hover .entity-metadata__label {
    background-color: rgba(201, 162, 39, 0.1);
  }

  /* 行间分隔线 */
  .entity-metadata__row + .entity-metadata__row .entity-metadata__label,
  .entity-metadata__row + .entity-metadata__row .entity-metadata__value {
    border-top: 1px solid var(--yale-border, #d4c8b8);
  }

  /* 标签列 - 暖米色背景 */
  .entity-metadata__label {
    padding: 10px 14px;
    color: var(--yale-muted, #6b6b6b);
    font-weight: 600;
    font-size: 13px;
    width: 130px;
    min-width: 130px;
    vertical-align: top;
    text-align: left;
    background-color: var(--classic-bg, #f8f5f0);
    border-radius: var(--yale-radius-sm, 4px) 0 0 var(--yale-radius-sm, 4px);
    transition: background-color 0.2s ease;
  }

  .entity-metadata__value {
    padding: 10px 14px;
    color: var(--yale-text, #2c2c2c);
    vertical-align: top;
    line-height: 1.6;
    border-radius: 0 var(--yale-radius-sm, 4px) var(--yale-radius-sm, 4px) 0;
  }

  .entity-metadata__empty {
    padding: var(--yale-padding-lg, 1.5rem);
    color: var(--yale-muted, #6b6b6b);
    font-style: italic;
    text-align: center;
    background: var(--yale-light, #f8f5f0);
    border-radius: var(--yale-radius-md, 8px);
    font: var(--yale-font-body, 400 14px/20px "Noto Sans SC", sans-serif);
  }

  .entity-metadata__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .entity-metadata__list-item {
    display: inline-flex;
    align-items: center;
    margin: 0;
    padding: 0;
  }

  .entity-metadata__list-item::after {
    content: "·";
    margin: 0 6px;
    color: var(--classic-gold, #c9a227);
    font-weight: bold;
  }

  .entity-metadata__list-item:last-child::after {
    content: "";
    margin: 0;
  }

  /* 链接 - 经典风格配色 */
  .entity-metadata__link {
    color: var(--classic-primary, #1e3a5f);
    text-decoration: none;
    word-break: break-word;
    padding: 2px 6px;
    margin: -2px -6px;
    border-radius: var(--yale-radius-sm, 4px);
    transition: all 0.2s ease;
    display: inline-block;
    border-bottom: 1px solid transparent;
  }

  .entity-metadata__link:hover {
    color: var(--classic-gold, #c9a227);
    background-color: rgba(201, 162, 39, 0.1);
    text-decoration: none;
    border-bottom-color: var(--classic-gold, #c9a227);
  }

  .entity-metadata__link:focus {
    outline: 2px solid var(--classic-gold, #c9a227);
    outline-offset: 2px;
  }

  .entity-metadata__image {
    max-width: 140px;
    max-height: 140px;
    display: inline-block;
    margin-right: 10px;
    margin-bottom: 10px;
    border-radius: var(--yale-radius-md, 8px);
    border: 1px solid var(--yale-border, #d4c8b8);
    box-shadow: 0 2px 8px rgba(30, 58, 95, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    object-fit: cover;
  }

  .entity-metadata__image:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(30, 58, 95, 0.15);
  }

  @media (max-width: 768px) {
    .entity-metadata {
      padding: var(--yale-padding-sm, 0.75rem);
    }

    .entity-metadata__label {
      width: 100px;
      min-width: 100px;
      padding: 8px 10px;
      font-size: 12px;
    }

    .entity-metadata__value {
      padding: 8px 10px;
      font-size: 13px;
    }

    .entity-metadata__list {
      gap: 2px;
    }

    .entity-metadata__image {
      max-width: 100px;
      max-height: 100px;
      margin-right: 8px;
      margin-bottom: 8px;
    }
  }

  @media (max-width: 480px) {
    /* 小屏幕时表格改为堆叠布局 */
    .entity-metadata__table,
    .entity-metadata__table tbody,
    .entity-metadata__row,
    .entity-metadata__label,
    .entity-metadata__value {
      display: block;
      width: 100%;
    }

    .entity-metadata__label {
      padding: 8px 10px 4px;
      border-radius: var(--yale-radius-sm, 4px) var(--yale-radius-sm, 0 0;
      background-color: transparent;
      font-size: 12px;
      color: var(--classic-primary, #1e3a5f);
    }

    .entity-metadata__value {
      padding: 0 10px 10px;
      border-radius: 0 0 var(--yale-radius-sm, 4px) var(--yale-radius-sm, 4px);
      border-bottom: 1px solid var(--yale-border, #d4c8b8);
    }

    .entity-metadata__row:last-child .entity-metadata__value {
      border-bottom: none;
    }

    .entity-metadata__row:hover {
      background-color: transparent;
    }

    .entity-metadata__row:hover .entity-metadata__label {
      background-color: transparent;
    }
  }
`

export default entityMetadataStyles
