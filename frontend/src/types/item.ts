export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ItemMedia {
  id: string
  url: string
  thumb_url?: string
  media_type: string
}

export interface Item {
  id: string
  title: string
  generation_status: GenerationStatus
  generation_error?: string | null
  media: ItemMedia | null
  created_at: string
}
