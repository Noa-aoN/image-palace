// 運営からの読みもの（お知らせ・更新情報・コラム）。
// バックエンド /api/v1/posts・/api/v1/admin/posts のレスポンスに対応。

export type PostCategory = 'news' | 'update' | 'column'

export const POST_CATEGORIES: PostCategory[] = ['news', 'update', 'column']

// お知らせの面に出す種別。コラムは読みたい理由が違うので /blog へ回す
export const NEWS_CATEGORIES: PostCategory[] = ['news', 'update']

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  news: 'お知らせ',
  update: '更新情報',
  column: 'コラム',
}

// 本文の塊。フロントの描画と合わせること（バックエンドの Post::BLOCK_TYPES と対応）
export type PostBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }

export interface Post {
  slug: string
  category: PostCategory
  category_label: string
  title: string
  excerpt: string | null
  tags: string[]
  reading_minutes: number | null
  pinned: boolean
  published_at: string | null
  /** 見出し画像。一覧はサムネ、記事の中は原寸。出さない設定なら null */
  image_url?: string | null
  /** 詳細でのみ返る */
  body?: PostBlock[]
}

// 運営画面で扱う形（下書きも含む）
export interface AdminPost {
  id: string
  slug: string
  category: PostCategory
  category_label: string
  title: string
  excerpt: string | null
  /** 編集用の平文。保存時もこの形で送る */
  body_text: string
  tags: string[]
  reading_minutes: number | null
  pinned: boolean
  published: boolean
  published_at: string | null
  /** draft（下書き）/ scheduled（予約）/ published（公開）。published だけでは予約が下書きに見える */
  status: 'draft' | 'scheduled' | 'published'
  /** 読まれた回数 */
  views_count: number
  delivered_at: string | null
  author_email: string | null
  /** 添付があっても、これが false なら一覧・記事に出さない */
  cover_visible: boolean
  image_url: string | null
  updated_at: string
}

export interface AdminPostInput {
  slug?: string
  category?: PostCategory
  title?: string
  excerpt?: string
  body_text?: string
  tags?: string[]
  reading_minutes?: number | null
  pinned?: boolean
  published?: boolean
  cover_visible?: boolean
}
