import { apiClient } from './client'

/**
 * カードが持つ項目の定義と、その値。
 *
 * 記憶したいものは分野で変わる（語学なら読み仮名、解剖なら部位）。
 * 作り付けの欄を足し続ける代わりに、項目そのものを利用者が定義する。
 *
 * 型はここに挙げた6つだけ。分野ごとに型を増やすのではなく、
 * 定義の組み合わせで表す。翻訳は意味・説明、関連カードは relations、
 * 画像は medias が既に持っているので、ここでは扱わない（二重管理を避ける）。
 */
export const PROPERTY_VALUE_TYPES = [
  'text',
  'longtext',
  'list',
  'number',
  'date',
  'url',
  'boolean',
  // 選ぶ項目。**選択肢は定義側が持つ**（ほかの型と違って `options` が要る）
  'select',
  // 言語ごとの読み方。**1つの項目の中に並びで持つ**
  'reading',
  'free_text',
  'free_image',
  'wikipedia',
] as const

export type PropertyValueType = (typeof PROPERTY_VALUE_TYPES)[number]

export const PROPERTY_VALUE_TYPE_LABELS: Record<PropertyValueType, string> = {
  text: '短い文',
  longtext: '長い文',
  list: '複数の値',
  number: '数',
  date: '日付',
  url: 'リンク',
  boolean: 'チェック',
  select: '選ぶ',
  reading: '読み方（言語別）',
  free_text: '自由欄',
  free_image: '自由イメージ',
  wikipedia: 'Wikipedia',
}

/** 型ごとの一言。選ぶときに何が起きるのかを読ませる */
export const PROPERTY_VALUE_TYPE_NOTES: Partial<Record<PropertyValueType, string>> = {
  boolean: '入 / 切で持ちます。触っていないうちは、どちらでもない状態のままです',
  select: '決めた選択肢から1つ選びます。**選択肢はここで決めます**（あとから足せます）',
  reading: '言語ごとの読み方を1つの項目にまとめます。基本の言語を変えると、主に出す読みも変わります',
  free_text: '見出しも中身もカードごとに自由に書けます。同じ種別に何枚でも置けます',
  free_image: '小見出しと、描いてほしいものを書いて絵を作ります。1枚 1クレジット',
  wikipedia: '見出し語で Wikipedia を引き、冒頭と記事リンクを出します',
}

/**
 * Wikipedia の項目に入る値。記事の全文は持たない。
 *
 * 鍵に wikipedia_ を付けるのは、カードの項目に混ぜて置いたときに
 * どこから来た値かが名前だけで分かるようにするため。
 *
 * language_code は、いま画面に選択を出していなくても必ず持つ。
 * あとから多言語に広げるとき、保存済みの値がどの言語のものか分からないと、
 * 全部「たぶん日本語」として扱うしかなくなる。
 */
export interface WikipediaValue {
  wikipedia_page_id?: number
  wikipedia_title: string
  wikipedia_description?: string | null
  wikipedia_url: string | null
  wikipedia_extract: string | null
  wikipedia_thumbnail_url: string | null
  wikipedia_language_code: string
  wikipedia_fetched_at?: string
  /** 曖昧さ回避かどうかを画面が知るためだけの値。保存の対象ではない */
  type?: string
}

/**
 * 項目の役割。**何のために持つのか**で分ける。
 *
 * 分けないと、覚えるための手立てと、調べた事実が同じ見た目で並ぶ。
 * 「語源」と「語呂合わせ」は隣に置くと似て見えるが、
 * 前者は**合っているか**が大事で、後者は**思い出せるか**が大事。
 */
export type PropertyCategory = 'subject' | 'mnemonic' | 'admin'

export const PROPERTY_CATEGORIES: {
  key: PropertyCategory
  label: string
  hint: string
  /** 札の縁の色。色だけに頼らず、見出しの文字でも分かるようにする */
  accent: string
}[] = [
  {
    key: 'subject',
    label: '記憶要素',
    hint: '覚える対象そのもの。読み・語源・品詞など。合っているかが大事',
    accent: 'var(--palace)',
  },
  {
    key: 'mnemonic',
    // 「記憶要素」と「記憶術要素」は2文字違いで、並ぶと見分けが付かなかった。
    // **やっていること**で呼ぶ（覚えにくいものを、思い出せる形へ変換する）
    label: '変換要素',
    hint: '思い出すための手立て。語呂合わせ・変換イメージなど。合っているかより、思い出せるかが大事',
    accent: '#9a6dd7',
  },
  {
    key: 'admin',
    label: '管理要素',
    hint: '整理のためのもの。出典・メモ・注意点など',
    accent: '#6b7280',
  },
]

/**
 * 項目ごとの目印の色。**見出しの前に置く小さな丸**。
 *
 * 役割（記憶要素 / 変換要素 / 管理要素）の色は3つしかないので、
 * 同じ役割の中に並ぶ「語源」「品詞」「読み方」は全部同じ色で出る。
 * ここは、その人が自分の物差しで付ける印。
 *
 * **色の名前だけをサーバーが持つ。** 実際の色味はここで決める。
 * 地はアイボリーなので、載る色はその地に合わせて選んである。
 * 生の値を保存していると、色味を調整するたびに保存済みの行を書き換えることになる。
 */
export const PROPERTY_COLORS: { key: string; label: string; hex: string }[] = [
  // 金だけは既にある札の色（--palace）を使う。ここで別の金を作ると2種類になる
  { key: 'gold', label: '金', hex: 'var(--palace)' },
  { key: 'purple', label: '藤', hex: '#9a6dd7' },
  { key: 'blue', label: '藍', hex: '#4a7fb5' },
  { key: 'green', label: '緑', hex: '#5b8c5a' },
  { key: 'red', label: '朱', hex: '#c05a4e' },
  { key: 'orange', label: '橙', hex: '#d08a3e' },
  { key: 'pink', label: '桃', hex: '#c96b96' },
  { key: 'gray', label: '鼠', hex: '#6b7280' },
]

/**
 * 色の名前から、出す丸を決める。
 *
 * **付けていなければ null**（丸を出さない）。全部に色が付いていると、
 * どれが目印なのかが分からなくなる。
 *
 * 知らない名前も null にする。対応表に無い色が届くのは、
 * こちらが古いときなので、**知らないものは出さない**のが安全側
 * （空の丸や黒い丸が出ると、付けていない項目より目立つ）。
 */
export function propertyColorOf(color?: string | null) {
  if (!color) return null

  return PROPERTY_COLORS.find((row) => row.key === color) ?? null
}

export function propertyCategoryOf(category?: string | null) {
  return PROPERTY_CATEGORIES.find((row) => row.key === category) ?? PROPERTY_CATEGORIES[0]
}

export interface PropertyDefinition {
  id: string
  item_type_id: string
  key: string
  label: string
  value_type: PropertyValueType
  /** 何のために持つ項目か */
  category?: PropertyCategory
  /** 見出しの前に出す丸の色。付けていなければ null */
  color?: string | null
  description?: string | null
  /** 選ぶ項目の選択肢。ほかの型では空 */
  options?: string[]
  position: number
}

/** カード詳細が返す、その種別の項目一覧（未入力の項目も含む） */
export interface ItemPropertyEntry {
  property_definition_id: string
  key: string
  label: string
  value_type: PropertyValueType
  category?: PropertyCategory
  /** 見出しの前に出す丸の色。付けていなければ null */
  color?: string | null
  description?: string | null
  /** 選ぶ項目の選択肢。ほかの型では空 */
  options?: string[]
  value: string | number | string[] | boolean | FreeTextValue | FreeImageValue | ReadingValue | null
}

/**
 * 言語ごとの読み方。**並びで持つ。**
 *
 * 対応表にすると保存の仕組みが鍵の順を保たず、書いた順が失われる。
 * どれを主にするかは基本の言語で決まるが、残りは書いた順に出したい。
 */
export type ReadingValue = { language: string; text: string }[]

/**
 * 自由イメージ。**カードの見出し語には縛られない絵。**
 * そのカードの中の一場面・対比・図解などを持てる。
 */
export interface FreeImageValue {
  heading?: string
  prompt?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  url?: string | null
  error?: string | null
}

/** 自由欄の中身。見出しも中身もカードごとに決める */
export interface FreeTextValue {
  heading: string
  body: string
}

export async function getPropertyDefinitions(itemTypeId?: string): Promise<PropertyDefinition[]> {
  const res = await apiClient.get<{ property_definitions: PropertyDefinition[] }>(
    '/api/v1/property_definitions',
    { params: itemTypeId ? { item_type_id: itemTypeId } : undefined }
  )
  return res.data.property_definitions
}

export async function createPropertyDefinition(payload: {
  item_type_id: string
  key: string
  label: string
  value_type: PropertyValueType
  description?: string
  /** 見出しの前に出す丸の色。付けなければ無色 */
  color?: string | null
}): Promise<PropertyDefinition> {
  const res = await apiClient.post<PropertyDefinition>('/api/v1/property_definitions', {
    property_definition: payload,
  })
  return res.data
}

// key と種別は変えられない（既に入っている値がどの項目のものか辿れなくなるため）
export async function updatePropertyDefinition(
  id: string,
  payload: {
    label?: string
    value_type?: PropertyValueType
    description?: string
    options?: string[]
    /** 空文字を送ると外れる（サーバーが「付けていない」に戻す） */
    color?: string | null
  }
): Promise<PropertyDefinition> {
  const res = await apiClient.patch<PropertyDefinition>(`/api/v1/property_definitions/${id}`, {
    property_definition: payload,
  })
  return res.data
}

export async function deletePropertyDefinition(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/property_definitions/${id}`)
}

export async function reorderPropertyDefinitions(ids: string[]): Promise<PropertyDefinition[]> {
  const res = await apiClient.patch<{ property_definitions: PropertyDefinition[] }>(
    '/api/v1/property_definitions/reorder',
    { ids }
  )
  return res.data.property_definitions
}

// 値の出し入れ。空を渡すと、その項目の行ごと消える（未設定に戻る）
export async function setItemProperty(
  itemId: string,
  definitionId: string,
  value: string | string[] | null
): Promise<ItemPropertyEntry> {
  const res = await apiClient.put<ItemPropertyEntry>(
    `/api/v1/items/${itemId}/properties/${definitionId}`,
    { value }
  )
  return res.data
}

/** AI でまとめて埋めた結果。埋まらなかった項目は skipped_keys に載る */
export interface FillPropertiesResult {
  filled_keys: string[]
  skipped_keys: string[]
  item: unknown
}

// 項目ごとではなく1回でまとめて埋める（項目数に費用と待ち時間を比例させない）。
// 既定は空いている項目だけ。手で書いたものは上書きしない。
//
// keys を渡すとその項目だけを書く。1項目を書き直したいとき用で、
// 呼び出しは1回のままなので「項目ごとに叩く」形にはならない。
export async function fillItemProperties(
  itemId: string,
  opts?: { overwrite?: boolean; keys?: string[] }
): Promise<FillPropertiesResult> {
  const res = await apiClient.post<FillPropertiesResult>(`/api/v1/items/${itemId}/fill_properties`, {
    overwrite: opts?.overwrite ?? false,
    ...(opts?.keys ? { keys: opts.keys } : {}),
  })
  return res.data
}

/**
 * よく使う項目の出発点。
 *
 * 一から key と型を決めるのは骨が折れるうえ、key の付け方が人によってばらつくと
 * あとで書き出しや AI への指示を揃えにくくなる。分野ごとの出発点を用意しておく。
 */
export const PROPERTY_PRESETS: {
  group: string
  /** description は「何を入れる項目か」の一行。名前だけでは分からないものがある
      （「分類」に何を書くのか、「例」は例文なのか用例なのか） */
  /** その群の項目が既定でどの役割になるか（1つずつ変えられる） */
  category: PropertyCategory
  items: { key: string; label: string; value_type: PropertyValueType; description: string }[]
}[] = [
  {
    group: 'ことば',
    category: 'subject',
    items: [
      { key: 'reading', label: '読み仮名', value_type: 'text', description: 'その語の読み。複数の読みがあれば全部。' },
      // 言語ごとに持ちたいとき。**1つの項目の中に並びで持つ**ので、
      // 言語を増やしても項目は増えない
      { key: 'readings', label: '読み方（言語別・まとめて）', value_type: 'reading', description: '言語ごとの読み方を1つの項目にまとめます。主に出るのは、環境設定で選んでいる言語のもの。言語ごとに分けたいなら「読み方（言語ごと）」から選びます。' },
      // 見出し語は短い呼び名で置くことが多い（DNS・国連・東大）。
      // **正式な言い方は別に持つ**。別名（複数）とは役割が違うので、分けて置く
      { key: 'formal_name', label: '正式名称', value_type: 'text', description: '省略せずに書いたときの正式な呼び名。' },
      { key: 'aliases', label: '別名・異表記', value_type: 'list', description: '同じものを指す別の呼び名や書き方。' },
      { key: 'pronunciation', label: '発音記号', value_type: 'text', description: '発音記号（IPA など）。' },
      { key: 'part_of_speech', label: '品詞', value_type: 'text', description: '名詞・動詞など、その語の働き。' },
      { key: 'derivatives', label: '派生語', value_type: 'list', description: 'その語から作られた語、関係の深い語。' },
      { key: 'examples', label: '例', value_type: 'list', description: 'その語を使った短い文や、具体的な例。' },
      { key: 'etymology', label: '語源', value_type: 'longtext', description: 'どこから来た語か。成り立ちの説明。' },
      { key: 'origin', label: '由来', value_type: 'longtext', description: 'その名が付いたいきさつ。誰が・いつ・なぜ。' },
    ],
  },
  {
    group: 'ものごと',
    category: 'subject',
    items: [
      { key: 'category', label: '分類', value_type: 'text', description: 'それが何の仲間か（動物・化合物・王朝など）。' },
      { key: 'formula', label: '式・公式', value_type: 'text', description: '数式・化学式など、記号で書ける形。' },
      { key: 'year', label: '年', value_type: 'number', description: '起きた年・作られた年。数字だけ。' },
      { key: 'date', label: '日付', value_type: 'date', description: '年月日まで決まっているとき。' },
      { key: 'source', label: '出典', value_type: 'url', description: '確かめた先の URL。' },
      { key: 'caution', label: '注意点', value_type: 'longtext', description: '取り違えやすい点、覚え間違えやすい点。' },
    ],
  },
  {
    group: '覚えかた',
    category: 'mnemonic',
    items: [
      { key: 'mnemonic', label: '語呂合わせ', value_type: 'longtext', description: '思い出すための語呂・こじつけ。' },
      // 覚えるための手立ては「合っているか」より「思い出せるか」で選ぶ。
      // 事実の項目と混ぜると、直すときの物差しが変わってしまう
      { key: 'substitute_word', label: '変換語', value_type: 'text', description: '覚えにくい語を、音の似た身近な語へ置き換えたもの。' },
      { key: 'substitute_image', label: '変換イメージ', value_type: 'longtext', description: '変換語から思い浮かべる場面。奇抜なほど残る。' },
      // 見出しごと自由に決められる欄。決まった項目に収まらないもののために置く。
      // 同じものを何枚でも足せるよう、鍵は追加時に採番する
      { key: 'free', label: '自由欄', value_type: 'free_text', description: '見出しも中身もカードごとに自由。' },
      { key: 'scene', label: '自由イメージ', value_type: 'free_image', description: '小見出しと指示で、この語の一場面を描く。' },
    ],
  },
  {
    // **言語ごとに、別々の項目として持ちたいとき。**
    //
    // 「読み方（言語別）」は1つの項目の中に全部を持つ形で、
    // 主に出るものが基本の言語で変わる。まとめて扱いたいときはそちら。
    //
    // だが**その言語の読みだけを、独立した項目として置きたい**ことがある。
    // 一覧の列に出す・並び順を自分で決める・使う言語だけ持つ、といった扱いは、
    // 項目が分かれていないとできない。両方を選べるようにする。
    group: '読み方（言語ごと）',
    category: 'subject',
    items: [
      { key: 'reading_ja', label: '読み方（日本語）', value_type: 'text', description: '日本語での読み。かな・ローマ字など。' },
      { key: 'reading_en', label: '読み方（英語）', value_type: 'text', description: '英語での読み。発音の目安。' },
      { key: 'reading_zh', label: '読み方（中国語）', value_type: 'text', description: '中国語での読み。ピンインなど。' },
      { key: 'reading_ko', label: '読み方（韓国語）', value_type: 'text', description: '韓国語での読み。' },
      { key: 'reading_es', label: '読み方（スペイン語）', value_type: 'text', description: 'スペイン語での読み。' },
      { key: 'reading_fr', label: '読み方（フランス語）', value_type: 'text', description: 'フランス語での読み。' },
      { key: 'reading_de', label: '読み方（ドイツ語）', value_type: 'text', description: 'ドイツ語での読み。' },
    ],
  },
  {
    // **整理のためのもの。** 覚える対象でも、覚え方でもない。
    // 群を分けないと「覚えた」の印と「語源」が同じ重さで並ぶ
    group: '整理する',
    category: 'admin',
    items: [
      { key: 'learned', label: '覚えた', value_type: 'boolean', description: '覚え終えたかどうか。触っていない状態と「まだ」は別に持つ。' },
      { key: 'status', label: '状態', value_type: 'text', description: '下書き・確認待ち・完成など、自分で決める段階。' },
      { key: 'note', label: 'メモ', value_type: 'longtext', description: '自分のための覚書。決まった形はない。' },
      { key: 'review_note', label: '見直しの記録', value_type: 'longtext', description: 'いつ・何を直したか。あとで辿るためのもの。' },
    ],
  },
  {
    // 引いてくる項目。手で書くものとは性質が違うので群を分ける。
    // ここに無いと、型の一覧から「Wikipedia」を選ぶまで存在に気づけない
    group: '調べる',
    category: 'subject',
    items: [
      {
        key: 'wikipedia',
        label: 'Wikipedia',
        value_type: 'wikipedia',
        description: 'Wikipedia の記事の冒頭を引いてくる。手で書かず、押して取り込む。',
      },
    ],
  },
]

/**
 * 項目が1つも無いときに、まず出す7件。
 *
 * プリセットは全19件あるが、最初から全部出すと「どれから始めるか」が仕事になる。
 * 覚えるのに効くもの・単語カードで埋まりやすいものだけに絞る
 * （本番の219枚中218枚が「単語」種別）。残りは「ほかの項目を見る」から。
 *
 * Wikipedia を先頭に置くのは、これだけ性質が違うため。
 * 他は枠を作るだけだが、Wikipedia は押せば中身まで入る。
 */
export const COMMON_PROPERTY_KEYS = [
  'wikipedia',
  'reading',
  // 言語ごとの読み。**まとめて持つ形と、言語ごとに分ける形の両方**を候補に出す。
  //
  // まとめる形は1項目で済み、主に出るものが基本の言語で変わる。
  // 分ける形は、一覧の列に出したり並び順を自分で決めたりできる。
  // どちらが要るかは使い方で変わるので、選べるようにする。
  //
  // ここに出すのは日本語と英語だけ。ほかの言語は「細かく決める」から選ぶ
  // （候補を7つに絞っているのは、多いと選ぶより探すほうが大変になるため）
  'readings',
  'reading_ja',
  'reading_en',
  'aliases',
  'etymology',
  'pronunciation',
  'examples',
  'derivatives',
] as const

/** よく使う7件を、プリセットの定義（型・説明つき）で引く */
export function commonPropertyPresets() {
  const all = PROPERTY_PRESETS.flatMap((group) => group.items)
  return COMMON_PROPERTY_KEYS.map((key) => all.find((p) => p.key === key)).filter(
    (p): p is NonNullable<typeof p> => p != null
  )
}

/** 名前から識別名を下書きする。英字が拾えなければ空にして、利用者に決めてもらう */
export function suggestPropertyKey(label: string): string {
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(ascii) ? ascii.slice(0, 40) : ''
}

/** 自由イメージを作る。**1枚 1クレジット**（カードの絵と同じ） */
export async function generateFreeImage(
  itemId: string,
  propertyDefinitionId: string,
  payload: { heading: string; prompt: string }
): Promise<void> {
  await apiClient.post(
    `/api/v1/items/${itemId}/properties/${propertyDefinitionId}/free_image`,
    payload
  )
}
