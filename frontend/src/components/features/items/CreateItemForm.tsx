'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

const schema = z.object({
  title: z.string().min(1, '単語を入力してください'),
})

type FormValues = z.infer<typeof schema>

const STATUS_LABEL: Record<string, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function CreateItemForm() {
  const [createdItem, setCreatedItem] = useState<Item | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setApiError(null)
    try {
      const item = await createItem(values.title)
      setCreatedItem(item)
      reset()
    } catch {
      setApiError('カードの作成に失敗しました。もう一度試してください。')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">単語</Label>
          <Input
            id="title"
            placeholder="例: photosynthesis"
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        {apiError && <p className="text-sm text-destructive">{apiError}</p>}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? '作成中...' : 'カードを作成'}
        </Button>
      </form>

      {createdItem && (
        <Card>
          <CardHeader>
            <CardTitle>作成しました</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{createdItem.title}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[createdItem.generation_status] ?? ''}`}
              >
                {STATUS_LABEL[createdItem.generation_status] ?? createdItem.generation_status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">ID: {createdItem.id}</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setCreatedItem(null)}>
                続けて作成
              </Button>
              <Link href="/dashboard">
                <Button size="sm">ダッシュボードへ</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
