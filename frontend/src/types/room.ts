export interface Room {
  id: string
  space_id: string
  name: string
  layout_type: string
  collection_count: number
  created_at: string
}

// ルームに配置されたコレクションの軽量表現
export interface RoomCollection {
  id: string
  name: string
  description: string | null
  deck_count: number
}

export interface RoomDetail extends Room {
  collections: RoomCollection[]
}
