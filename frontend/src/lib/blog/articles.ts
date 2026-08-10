// コラム記事のデータ。MVP 段階では CMS を導入せず、型付きのデータ配列で管理する。
// 記事を1本追加するときは、この配列に Article を1つ足すだけでよい。

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }

export type Article = {
  slug: string
  title: string
  excerpt: string
  date: string // ISO (YYYY-MM-DD)
  readingMinutes: number
  tags: string[]
  /** 見出し画像の URL。用意できた記事から足していく */
  image?: string
  body: ArticleBlock[]
  references?: string[]
}

export const ARTICLES: Article[] = [
  {
    slug: 'why-images-help-memory',
    title: 'なぜ「イメージ」で覚えると忘れにくいのか — 画像化学習の効果を裏づける認知科学',
    excerpt:
      '文字だけで覚えるより、絵と一緒に覚えるほうが記憶に残りやすい。「絵優位性効果」「二重符号化理論」「記憶の宮殿」など、イメージ化学習を支える研究知見と、それを ImagePalace がどう活かしているかを紹介します。',
    date: '2026-07-21',
    readingMinutes: 6,
    tags: ['記憶', '認知科学', '学習法'],
    body: [
      {
        type: 'p',
        text: '「単語帳を何周しても覚えられない」——多くの人が経験する悩みです。一方で、旅行先で見た風景や、印象的な映画のワンシーンは、覚えようと努力しなくても長く記憶に残ります。この差は、私たちの記憶が「文字」よりも「イメージ」を得意としていることに由来します。',
      },
      { type: 'h2', text: '見たものは忘れにくい ——「絵優位性効果」' },
      {
        type: 'p',
        text: '同じ内容でも、単語として提示されるより、絵として提示されたほうがよく記憶される——この現象は「絵優位性効果（Picture Superiority Effect）」として、数多くの実験で繰り返し確認されてきました。',
      },
      {
        type: 'p',
        text: '視覚記憶の容量の大きさを示す古典的な研究もあります。心理学者スタンディング（Standing, 1973）は、被験者に数千枚もの画像を見せた後の再認テストで、非常に高い正答率が得られることを示しました。私たちの脳は、膨大な数の視覚イメージを驚くほど正確に覚えていられるのです。',
      },
      { type: 'h2', text: 'ことばとイメージ、2つの手がかり ——「二重符号化理論」' },
      {
        type: 'p',
        text: 'なぜ絵は強いのか。心理学者アラン・パイビオが提唱した「二重符号化理論（Dual-Coding Theory）」がひとつの説明を与えます。人間の記憶には、言語的な情報を扱う系統と、視覚的（イメージ）な情報を扱う系統の2つがあり、両方で符号化された情報は、片方だけよりも思い出す手がかりが増える、という考え方です。',
      },
      {
        type: 'quote',
        text: '単語を「文字」としてだけでなく「イメージ」としても覚えておくと、思い出すための入り口が二重になる。',
      },
      {
        type: 'p',
        text: 'たとえば「apple」という単語を、綴りだけで覚えるのと、りんごの鮮やかな画像とセットで覚えるのとでは、後者のほうが後から引き出しやすくなります。片方の手がかりを忘れても、もう片方から辿り着けるからです。',
      },
      { type: 'h2', text: '場所に置いて覚える ——「記憶の宮殿」' },
      {
        type: 'p',
        text: '古代ギリシア・ローマの弁論家が使っていた記憶術「場所法（method of loci）」、いわゆる「記憶の宮殿」も、イメージと空間を使う技法です。覚えたい事柄を、頭の中の見慣れた場所に鮮やかなイメージとして配置し、あとでその場所を巡ることで思い出します。記憶力競技の選手が今も使う、実証された方法です。',
      },
      {
        type: 'p',
        text: '近年の脳科学の研究（Dresler ら, 2017 など）では、この場所法のトレーニングによって記憶成績が大きく向上し、脳の活動パターンにも変化が見られることが報告されています。特別な才能ではなく、訓練で身につく技術だということです。',
      },
      { type: 'h2', text: '語学学習への応用 ——「キーワード法」' },
      {
        type: 'p',
        text: '外国語の語彙学習では、単語の音に似た母語のイメージを介して覚える「キーワード法（Atkinson & Raugh, 1975）」の効果が知られています。ここでも鍵になるのは、抽象的な綴りを、具体的で思い浮かべやすいイメージへ変換することです。',
      },
      {
        type: 'ul',
        items: [
          '抽象的な情報より、具体的でイメージしやすい情報のほうが記憶に残る（具体性効果）',
          '自分なりのイメージや関連づけを作る「精緻化」が定着を助ける',
          '間隔をあけて思い出す「想起練習」と組み合わせると、さらに効果が高まる',
        ],
      },
      { type: 'h2', text: 'ImagePalace はこれをどう活かしているか' },
      {
        type: 'p',
        text: 'ImagePalace は、これらの知見を日常の学習に落とし込むために生まれました。入力した単語や概念を、その意味を表すイメージに自動で変換し、「文字＋イメージ」のカードとして手元に残します。二重符号化を、手間なく実現するためのしくみです。',
      },
      {
        type: 'p',
        text: 'さらにフリーボードでは、カードを空間に配置し、線でつないで関係を「地図」のように可視化できます。これは記憶の宮殿の発想に近く、単語どうしのつながりを、位置と視覚で覚える助けになります。',
      },
      {
        type: 'p',
        text: 'イメージは、記憶のいちばん古くて強い入り口です。その入り口を、誰でも手軽に使えるようにすること——それが ImagePalace の目指すところです。',
      },
      { type: 'h2', text: 'まとめ' },
      {
        type: 'ul',
        items: [
          '絵は文字より記憶に残りやすい（絵優位性効果）',
          'ことばとイメージの二重符号化で、思い出す手がかりが増える',
          '空間に置くイメージ（記憶の宮殿）は訓練で身につく強力な技法',
          'ImagePalace は「文字＋イメージ」のカードと空間配置で、これらを日常に取り入れる',
        ],
      },
    ],
    references: [
      'Standing, L. (1973). Learning 10,000 pictures. Quarterly Journal of Experimental Psychology.',
      'Paivio, A. (1971/1986). Imagery and Verbal Processes / Mental Representations: A Dual Coding Approach.',
      'Atkinson, R. C., & Raugh, M. R. (1975). An application of the mnemonic keyword method to the acquisition of a Russian vocabulary.',
      'Dresler, M., et al. (2017). Mnemonic Training Reshapes Brain Networks to Support Superior Memory. Neuron.',
    ],
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}
