export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Item {
  id: string
  title: string
  generation_status: GenerationStatus
  media: { id: string; url: string; media_type: string } | null
  created_at: string
}
