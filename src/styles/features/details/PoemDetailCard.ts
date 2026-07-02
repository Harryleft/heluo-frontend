/**
 * PoemDetailCard 组件样式
 *
 * 设计理念：水墨留白 · 卷轴意境
 * - 去边界化：移除显式边框，使用留白和字重区分层次
 * - 垂直流动：如卷轴自上而下展开
 * - 大量留白：给诗文呼吸空间
 * - 色彩体系：墨色主调，淡褐边框，古朴典雅
 */

const poemDetailCardStyles = `
  /* ===== 卡片容器 - 去边框化 ===== */
  .poem-detail-card {
    margin-top: 0;
    border: none;
    border-radius: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    overflow: hidden;
    position: relative;
  }

  /* ===== 内部容器 - 增加留白与居中 ===== */
  .poem-detail-card__inner {
    padding: 0;
    max-width: 720px;
    margin: 0 auto;
  }

  /* ===== 标题区 - 卷轴头部 ===== */
  .poem-detail-card__header {
    text-align: center;
    padding: 48px 24px 32px;
    border-bottom: 1px solid rgba(139, 90, 43, 0.12);
    margin-bottom: 0;
    display: block;
  }

  .poem-detail-card__title-section {
    width: 100%;
  }

  .poem-detail-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-bottom: 16px;
  }

  .poem-detail-card__tag {
    background: transparent;
    border: 1px solid rgba(139, 90, 43, 0.25);
    color: #6b5344;
    padding: 4px 14px;
    border-radius: 999px;
    font-size: 13px;
    line-height: 1;
  }

  .poem-detail-card__title {
    font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
    font-size: clamp(28px, 5vw, 42px);
    line-height: 1.4;
    letter-spacing: 4px;
    color: #2c1810;
    margin: 0;
  }

  .poem-detail-card__actions {
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }

  .poem-detail-card__copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid rgba(139, 90, 43, 0.2);
    border-radius: 999px;
    background: transparent;
    color: #6b5344;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .poem-detail-card__copy-btn:hover {
    border-color: rgba(139, 90, 43, 0.4);
    background: rgba(139, 90, 43, 0.05);
  }

  .poem-detail-card__copy-btn.copied {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.4);
    color: #059669;
  }

  .poem-detail-card__copy-btn.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.4);
    color: #dc2626;
  }

  /* ===== 正文区 - 核心视觉焦点 ===== */
  .poem-detail-card__section {
    border: none;
    border-radius: 0;
    padding: 40px 32px;
    margin-bottom: 0;
    background: transparent;
  }

  .poem-detail-card__section-title {
    display: none;
  }

  .poem-detail-card__content-wrapper {
    padding: 0;
  }

  .poem-detail-card__content {
    margin: 0;
    white-space: pre-wrap;
    text-align: center;
    line-height: 2.2;
    font-size: clamp(18px, 3vw, 24px);
    color: #1a1a1a;
    letter-spacing: 3px;
    font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  }

  /* ===== 校注区 - 古朴小字 ===== */
  .poem-detail-card__section--annotations {
    padding: 24px 32px 0;
    background: transparent;
    border-top: none;
    border-bottom: none;
  }

  .poem-detail-card__annotations-title {
    margin: 0 0 12px;
    font-size: 13px;
    color: #8b7355;
    font-weight: 600;
    letter-spacing: 2px;
  }

  .poem-detail-card__annotations-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .poem-detail-card__annotation-item {
    padding: 8px 0;
    border-bottom: 1px dashed rgba(139, 90, 43, 0.12);
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14px;
    line-height: 1.8;
  }

  .poem-detail-card__annotation-item:last-child {
    border-bottom: none;
  }

  .poem-detail-card__annotation-text {
    color: #999;
    font-size: 13px;
    flex-shrink: 0;
    max-width: 40%;
  }

  .poem-detail-card__annotation-comment {
    color: #5c3d1e;
  }

  /* ===== 元数据区 - 内联标签式 ===== */
  .poem-detail-card__section--fields {
    padding: 24px 32px;
    border-top: 1px solid rgba(139, 90, 43, 0.08);
    border-bottom: 1px solid rgba(139, 90, 43, 0.08);
    background: rgba(250, 247, 240, 0.5);
    border-radius: 0;
  }

  .poem-detail-card__section--fields .poem-detail-card__section-title {
    display: none;
  }

  .poem-detail-card__field-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
  }

  .poem-detail-card__field {
    border: none;
    border-radius: 0;
    padding: 0;
    background: transparent;
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: baseline;
  }

  .poem-detail-card__field--full {
    width: 100%;
  }

  .poem-detail-card__field-key {
    color: #8b7355;
    font-size: 13px;
    flex-shrink: 0;
  }

  .poem-detail-card__field-value {
    color: #3d2914;
    font-size: 14px;
    line-height: 1.6;
  }

  .poem-detail-card__field-link {
    color: #5c3d1e;
    text-decoration: none;
    border-bottom: 1px solid rgba(92, 61, 30, 0.3);
    transition: color 0.2s ease, border-color 0.2s ease;
  }

  .poem-detail-card__field-link:hover {
    color: #2c1810;
    border-bottom-color: rgba(44, 24, 16, 0.5);
  }

  /* ===== 赏析区 - 简洁卡片 ===== */
  .poem-detail-card__analysis-head {
    padding: 24px 32px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .poem-detail-card__analysis-head .poem-detail-card__section-title {
    display: block;
    margin: 0;
    font-size: 14px;
    color: #4a3728;
    font-weight: 600;
  }

  .poem-detail-card__analysis-refresh {
    border: 1px solid rgba(139, 90, 43, 0.2);
    border-radius: 999px;
    background: transparent;
    color: #6b5344;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .poem-detail-card__analysis-refresh:hover {
    border-color: rgba(139, 90, 43, 0.4);
    background: rgba(139, 90, 43, 0.05);
  }

  .poem-detail-card__analysis-content {
    margin: 0;
    padding: 0 32px 32px;
    color: #4a3728;
    line-height: 2;
    font-size: 14px;
  }

  .poem-detail-card__analysis-content--error {
    color: #8a1f11;
  }

  /* ===== 地图区 - 保持功能 ===== */
  .poem-detail-card__geo {
    padding: 24px 32px 48px;
    margin-bottom: 0;
    border-top: 1px solid rgba(139, 90, 43, 0.08);
    border-radius: 0;
    background: transparent;
  }

  .poem-detail-card__geo-title {
    margin: 0 0 12px;
    font-size: 14px;
    color: #4a3728;
    font-weight: 600;
  }

  .poem-detail-card__geo-empty {
    margin: 0;
    color: #8b7355;
    font-size: 13px;
  }

  .poem-detail-card__map-canvas {
    width: 100%;
    height: 260px;
    border-radius: 8px;
    border: 1px solid rgba(139, 90, 43, 0.15);
    background: #f9f7f3;
  }

  .poem-detail-card__map-status {
    margin: 10px 0 0;
    color: #6b5344;
    font-size: 13px;
  }

  .poem-detail-card__map-status--error {
    color: #8a1f11;
  }

  /* ===== 空状态 ===== */
  .poem-detail-card__empty {
    text-align: center;
    padding: 48px 24px;
    color: #8b7355;
    font-size: 14px;
  }

  /* ===== 响应式适配 ===== */
  @media (max-width: 1024px) {
    .poem-detail-card__content {
      font-size: clamp(16px, 2.8vw, 22px);
      line-height: 2.1;
    }

    .poem-detail-card__section--annotations {
      padding: 20px 24px 0;
    }
  }

  @media (max-width: 720px) {
    .poem-detail-card__inner {
      padding: 0 16px;
    }

    .poem-detail-card__header {
      padding: 32px 16px 24px;
    }

    .poem-detail-card__section {
      padding: 32px 20px;
    }

    .poem-detail-card__section--fields {
      padding: 20px;
    }

    .poem-detail-card__section--annotations {
      padding: 16px 20px 0;
    }

    .poem-detail-card__annotation-item {
      flex-direction: column;
      gap: 2px;
    }

    .poem-detail-card__annotation-text {
      max-width: 100%;
    }

    .poem-detail-card__field-grid {
      flex-direction: column;
      gap: 12px;
    }

    .poem-detail-card__content {
      font-size: 17px;
      letter-spacing: 2px;
    }

    .poem-detail-card__analysis-head {
      padding: 20px 20px 0;
    }

    .poem-detail-card__analysis-content {
      padding: 0 20px 24px;
    }

    .poem-detail-card__geo {
      padding: 20px 20px 32px;
    }

    .poem-detail-card__map-canvas {
      height: 220px;
    }
  }
`

export default poemDetailCardStyles
