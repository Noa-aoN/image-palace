export interface Tag {
  id: string
  name: string
  item_count: number
  pinned: boolean
  is_default?: boolean
  position?: number | null
}

// タグのグループ（タイトルのあるタグの集まり）。多対多のため tag_ids で所属を表す。
export interface TagGroup {
  id: string
  name: string
  pinned: boolean
  is_default: boolean
  default_key: string | null
  position: number | null
  tag_ids: string[]
}
