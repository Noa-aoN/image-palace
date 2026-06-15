export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ItemMedia {
  id: string
  url: string
  thumb_url?: string
  media_type: string
}

export interface ItemType {
  id: string
  name: string
  label: string
}

export interface ItemTag {
  id: string
  name: string
}

export interface Item {
  id: string
  title: string
  generation_status: GenerationStatus
  generation_error?: string | null
  item_type?: ItemType | null
  meaning?: string | null
  meaning_example?: string | null
  style?: string | null
  custom_prompt?: string | null
  tags?: ItemTag[]
  media: ItemMedia | null
  created_at: string
}
