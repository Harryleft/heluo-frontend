import { Link } from 'react-router-dom'
import type { TopicConfig } from './topicData'

export function TopicPage({ topic }: { topic: TopicConfig }): JSX.Element {
  return (
    <main className="topic-page">
      <section className="topic-hero" aria-labelledby="topic-title">
        <div className="topic-hero-inner">
          <p className="topic-kicker">{topic.kicker}</p>
          <h1 id="topic-title">{topic.title}</h1>
          <p className="topic-subtitle">{topic.subtitle}</p>
          <p className="topic-lead">{topic.lead}</p>
          <div className="topic-hero-actions">
            <Link className="topic-primary-link" to={topic.personDetailPath}>
              查看{topic.personName}人物详情
            </Link>
            <a className="topic-secondary-link" href="#topic-chapters">
              开始阅读专题
            </a>
          </div>
        </div>
      </section>

      <section className="topic-metrics" aria-label="专题资料概览">
        {topic.metrics.map((metric) => (
          <article className="topic-metric" key={`${metric.value}-${metric.label}`}>
            <p className="topic-metric-scope">{metric.scope}</p>
            <p className="topic-metric-value">
              <strong>{metric.value}</strong> {metric.label}
            </p>
          </article>
        ))}
      </section>

      <div className="topic-layout" id="topic-chapters">
        <aside className="topic-toc" aria-label="专题目录">
          <p className="topic-toc-title">阅读路径</p>
          <ol>
            {topic.chapters.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#${chapter.id}`}>{chapter.title}</a>
              </li>
            ))}
          </ol>
        </aside>

        <div className="topic-chapter-list">
          {topic.chapters.map((chapter, index) => (
            <article
              className="topic-chapter"
              data-topic-chapter
              id={chapter.id}
              key={chapter.id}
            >
              <div className="topic-chapter-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="topic-chapter-body">
                <p className="topic-chapter-eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
                <p className="topic-chapter-summary">{chapter.summary}</p>
                <p className="topic-chapter-detail">{chapter.detail}</p>
                <ul className="topic-evidence-list" aria-label={`${chapter.title}资料依据`}>
                  {chapter.evidence.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>

      <section className="topic-question-section" aria-labelledby="topic-question-title">
        <p className="topic-kicker">继续探索</p>
        <h2 id="topic-question-title">带着问题离开专题</h2>
        <div className="topic-question-grid">
          {topic.questions.map((question) => <p key={question}>{question}</p>)}
        </div>
        <Link className="topic-primary-link" to="/chat">向智能助手继续追问</Link>
      </section>
    </main>
  )
}
