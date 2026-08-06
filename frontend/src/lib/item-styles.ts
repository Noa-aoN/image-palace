// 画像生成スタイルのプリセット。value はバックエンド PromptBuilderService::STYLES と一致させること。
export interface StyleOption {
  value: string
  label: string
}

export const STYLE_OPTIONS: StyleOption[] = [
  { value: '', label: 'おまかせ' },
  { value: 'illustration', label: 'イラスト' },
  { value: 'photo', label: '写真' },
  { value: 'watercolor', label: '水彩' },
  { value: 'anime', label: 'アニメ' },
  { value: '3d', label: '3D' },
  { value: 'pixel', label: 'ドット絵' },
  { value: 'sketch', label: 'スケッチ' },
]

// 構図のプリセット。value はバックエンド PromptBuilderService::FRAMINGS と一致させること。
//
// おまかせ（空）は従来どおりの指示のまま。ここを変えると画像キャッシュのキーが変わり、
// 同じ単語の使い回しが効かなくなるので、既定は動かさず選んだカードだけ別扱いにする。
export interface FramingOption {
  value: string
  label: string
  note: string
}

export const FRAMING_OPTIONS: FramingOption[] = [
  { value: '', label: 'おまかせ', note: '全体が枠に収まるように作ります' },
  { value: 'single', label: '単体', note: '被写体だけを大きく。人物の肖像はこちら' },
  { value: 'scene', label: '情景', note: '場面として見せる。概念や関係を表すときに' },
]

// 画像への指示をどう作るか。value はバックエンド Item::PROMPT_SOURCES と一致させること。
//
// 既定は brief（単語から情景を起こす）。概念語を絵にできるようにするための経路で、
// 同じ単語なら全ユーザーで指示が一致するため、画像も共有キャッシュで使い回せる。
export interface PromptSourceOption {
  value: string
  label: string
  note: string
}

export const PROMPT_SOURCE_OPTIONS: PromptSourceOption[] = [
  {
    value: 'word',
    label: '単語をそのまま',
    note: '下ごしらえを挟まず、単語だけを画像生成に渡します。いちばん速く、絵の解釈もモデル任せ',
  },
  {
    value: 'brief',
    label: '単語から情景を起こす',
    note: '単語を説明文にしてから情景へ言い換えます。「機会費用」のような形の無い語を絵にできます',
  },
  {
    value: 'research',
    label: '調べてから絵にする',
    note: '先に意味・説明を作り、それをもとに指示を書き直します。多義語・専門用語・固有名詞に効きます',
  },
]

export const DEFAULT_PROMPT_SOURCE = 'brief'

export const CUSTOM_PROMPT_MAX_LENGTH = 300
