'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createItem } from '@/lib/api/items'

const schema = z.object({
  title: z.string().min(1, '単語を入力してください'),
})

type FormValues = z.infer<typeof schema>

export function CreateItemForm() {
  const router = useRouter()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setApiError(null)
    try {
      const item = await createItem(values.title)
      router.push(`/items/${item.id}`)
    } catch {
      setApiError('カードの作成に失敗しました。もう一度試してください。')
    }
  }

  return (
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
  )
}
