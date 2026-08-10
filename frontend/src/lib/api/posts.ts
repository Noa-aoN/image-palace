import { apiClient } from './client'
import type { AdminPost, AdminPostInput, Post } from '@/types/post'

// 公開済みの読みもの
export async function getPosts(category?: string): Promise<Post[]> {
  const res = await apiClient.get<{ posts: Post[] }>('/api/v1/posts', {
    params: category ? { category } : undefined,
  })
  return res.data.posts
}

export async function getPost(slug: string): Promise<Post> {
  const res = await apiClient.get<Post>(`/api/v1/posts/${slug}`)
  return res.data
}

// --- 運営 ---

export async function getAdminPosts(): Promise<AdminPost[]> {
  const res = await apiClient.get<{ posts: AdminPost[] }>('/api/v1/admin/posts')
  return res.data.posts
}

export async function getAdminPost(id: string): Promise<AdminPost> {
  const res = await apiClient.get<AdminPost>(`/api/v1/admin/posts/${id}`)
  return res.data
}

export async function createAdminPost(input: AdminPostInput): Promise<AdminPost> {
  const res = await apiClient.post<AdminPost>('/api/v1/admin/posts', { post: input })
  return res.data
}

export async function updateAdminPost(id: string, input: AdminPostInput): Promise<AdminPost> {
  const res = await apiClient.patch<AdminPost>(`/api/v1/admin/posts/${id}`, { post: input })
  return res.data
}

export async function deleteAdminPost(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/posts/${id}`)
}

// お知らせとして全員に届ける（公開済み・未配信のみ）
export async function deliverAdminPost(id: string): Promise<AdminPost> {
  const res = await apiClient.post<AdminPost>(`/api/v1/admin/posts/${id}/deliver`)
  return res.data
}
