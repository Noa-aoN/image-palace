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
  wikipedia: 'Wikipedia',
}

/** 型ごとの一言。選ぶときに何が起きるのかを読ませる */
export const PROPERTY_VALUE_TYPE_NOTES: Partial<Record<PropertyValueType, string>> = {
  boolean: '入 / 切で持ちます。触っていないうちは、どちらでもない状態のままです',
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
    label: 'その語のこと',
    hint: 'その語そのものについて。読み・語源・品詞など。合っているかが大事',
    accent: 'var(--palace)',
  },
  {
    key: 'mnemonic',
    label: '覚えかた',
    hint: '思い出すための手立て。語呂合わせ・変換イメージなど。合っているかより、思い出せるかが大事',
    accent: '#9a6dd7',
  },
  {
    key: 'admin',
    label: '整理',
    hint: '自分のための管理。出典・メモ・注意点など',
    accent: '#6b7280',
  },
]

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
  description?: string | null
  position: number
}

/** カード詳細が返す、その種別の項目一覧（未入力の項目も含む） */
export interface ItemPropertyEntry {
  property_definition_id: string
  key: string
  label: string
  value_type: PropertyValueType
  category?: PropertyCategory
  description?: string | null
  value: string | number | string[] | boolean | null
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
}): Promise<PropertyDefinition> {
  const res = await apiClient.post<PropertyDefinition>('/api/v1/property_definitions', {
    property_definition: payload,
  })
  return res.data
}

// key と種別は変えられない（既に入っている値がどの項目のものか辿れなくなるため）
export async function updatePropertyDefinition(
  id: string,
  payload: { label?: string; value_type?: PropertyValueType; description?: string }
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
      { key: 'note', label: 'メモ', value_type: 'longtext', description: '自分のための覚書。決まった形はない。' },
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
