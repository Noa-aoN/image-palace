export interface Tag {
  id: string
  name: string
  item_count: number
  pinned: boolean
  is_default?: boolean
  position?: number | null
  default_groups?: string[]
}
