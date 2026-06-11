import { apiClient } from './client'
import type { Room, RoomDetail } from '@/types/room'

export async function getRooms(spaceId: string): Promise<Room[]> {
  const res = await apiClient.get<{ rooms: Room[] }>(`/api/v1/spaces/${spaceId}/rooms`)
  return res.data.rooms
}

export async function getRoom(spaceId: string, roomId: string): Promise<RoomDetail> {
  const res = await apiClient.get<RoomDetail>(`/api/v1/spaces/${spaceId}/rooms/${roomId}`)
  return res.data
}

export async function createRoom(spaceId: string, name: string): Promise<Room> {
  const res = await apiClient.post<Room>(`/api/v1/spaces/${spaceId}/rooms`, { room: { name } })
  return res.data
}

export async function updateRoom(
  spaceId: string,
  roomId: string,
  payload: { name?: string; layout_type?: string }
): Promise<Room> {
  const res = await apiClient.patch<Room>(`/api/v1/spaces/${spaceId}/rooms/${roomId}`, { room: payload })
  return res.data
}

export async function deleteRoom(spaceId: string, roomId: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/rooms/${roomId}`)
}

export async function addCollectionToRoom(
  spaceId: string,
  roomId: string,
  collectionId: string
): Promise<void> {
  await apiClient.post(`/api/v1/spaces/${spaceId}/rooms/${roomId}/collections`, {
    collection_id: collectionId,
  })
}

export async function removeCollectionFromRoom(
  spaceId: string,
  roomId: string,
  collectionId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/rooms/${roomId}/collections/${collectionId}`)
}
