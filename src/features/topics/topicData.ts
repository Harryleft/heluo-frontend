export interface TopicChapter {
  id: string
  eyebrow: string
  title: string
  summary: string
  detail: string
  evidence: string[]
}

export interface TopicMetric {
  value: string
  label: string
  scope: string
}

export interface TopicConfig {
  slug: string
  kicker: string
  title: string
  subtitle: string
  personName: string
  personDetailPath: string
  lead: string
  metrics: TopicMetric[]
  chapters: TopicChapter[]
  questions: string[]
}

export const DUFU_TOPIC: TopicConfig = {
  slug: 'dufu-from-gongxian',
  kicker: '河洛人物专题 · 第一期',
  title: '杜甫：从巩县出发的诗史人生',
  subtitle: '沿着地点、诗歌与文献，重走一个河洛诗人的时代旅程',
  personName: '杜甫',
  personDetailPath: '/details?uri=%2Fperson%2F17270',
  lead: '杜甫并不只属于几首名篇。他从河南巩县出发，在漫游、入仕、战乱与漂泊中，把个人生命写进时代现场。这个专题以人物资料为锚点，将分散的诗文、地点与古籍重新编排成一条可阅读的路径。',
  metrics: [
    { value: '46', label: '种传记资料', scope: '人物生平' },
    { value: '1,289', label: '篇诗文', scope: '作品线索' },
    { value: '1,270', label: '条地点关联', scope: '空间轨迹' },
    { value: '643', label: '条典故关联', scope: '知识脉络' },
  ],
  chapters: [
    {
      id: 'origin',
      eyebrow: '第一章',
      title: '河洛原点',
      summary: '巩县不是履历表上的一个地名，而是理解杜甫家世、文化记忆与出发姿态的第一把钥匙。',
      detail: '专题从故乡切入，把人物与河洛地区的关系放回可定位的空间之中；随后再看他如何离开故土、进入更广阔的唐代世界。',
      evidence: ['籍贯：河南巩县（今河南巩义）', '人物实体：/person/17270'],
    },
    {
      id: 'identity',
      eyebrow: '第二章',
      title: '名字与身份',
      summary: '诗圣、杜工部、少陵野老，是后世记忆、官职经历与自我表达叠加出的不同侧面。',
      detail: '把称谓拆开，人物便不再是单一标签。专题以传记资料交叉阅读这些身份，区分时代中的杜甫与后世塑造的杜甫。',
      evidence: ['46 种传记资料可供互证', '人物称谓与官职线索'],
    },
    {
      id: 'journey',
      eyebrow: '第三章',
      title: '漫游与相遇',
      summary: '青年时代的出发，让山川、城市与交游进入诗人的知识结构。',
      detail: '地点不只是背景。每一次移动都可能带来新的观看方式、关系网络与写作题材，人物轨迹因此成为阅读诗歌的索引。',
      evidence: ['1,270 条作品地点关联', '人物、作品与地点可相互跳转'],
    },
    {
      id: 'history',
      eyebrow: '第四章',
      title: '时代进入诗歌',
      summary: '当宏大事件落到饥饿、离散与日常生活，所谓“诗史”才有了具体重量。',
      detail: '这一章不做名篇罗列，而是把作品放回写作时刻：谁在场、身处何地、面对何种现实，以及个人经验如何保存历史细节。',
      evidence: ['1,289 篇作品线索', '1,271 条时间标注'],
    },
    {
      id: 'map',
      eyebrow: '第五章',
      title: '漂泊地图',
      summary: '从河洛出发的路径不断延伸，最终构成一幅由作品标记的生命地图。',
      detail: '地图阅读的重点不是打卡，而是比较不同时期的空间尺度：出发、停留、避乱与安居，如何改变诗中的视野和情绪。',
      evidence: ['地点关系来自作品 AuthorPlace 字段', '可继续进入地理实体检索'],
    },
    {
      id: 'afterlife',
      eyebrow: '第六章',
      title: '后世如何阅读杜甫',
      summary: '经典并非一次形成；注本、选本和评论持续重写人们理解杜甫的方式。',
      detail: '从作品中的典故，到后世文献的编排和阐释，杜甫的形象在长期阅读中不断增厚，也产生彼此不同的解释路径。',
      evidence: ['643 条典故关联', '传记、评注与古籍互为补充'],
    },
    {
      id: 'archive',
      eyebrow: '第七章',
      title: '打开古籍',
      summary: '回到文献本身，才能看见知识如何被抄写、刊刻、编目与传递。',
      detail: '专题的终点不是结论，而是资料入口。读者可以继续进入人物详情、关联古籍与全文检索，核对叙事背后的原始线索。',
      evidence: ['2,719 份古籍文件待探索', '人物详情提供关联资源入口'],
    },
  ],
  questions: [
    '杜甫与河洛地区的关系有哪些资料依据？',
    '哪些地点改变了杜甫的写作主题？',
    '后世为什么把杜甫称为诗史与诗圣？',
  ],
}
