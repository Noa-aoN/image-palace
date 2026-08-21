'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { wasEndedPreview } from '@/lib/studio/previewTombstone'

/**
 * 終えた下見の行き先を、あとから開いたときに出す。
 *
 * 下見を終えるとカードごと消えるので、開いていたタブを再読み込みすると
 * ただの「見つかりません」になる。**意図して終えたことが伝わらない。**
 *
 * 消えたものを呼び戻しはしない（それでは終えたことにならない）。
 * 終わったと分かる形で言い、工房室へ戻す。
 */
export function PreviewEndedNotice({ id }: { id: string | null | undefined }) {
  if (!wasEndedPreview(id)) return null

  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 py-12 text-center">
      <p className="text-base font-medium">この下見は終了しました</p>
      <p className="text-sm text-muted-foreground">
        下見で入れたものは、終えたときに片付けています。
        もう一度見るには、工房室から下見をやり直してください。
      </p>
      <Link href="/studio">
        <Button variant="outline">工房室へ戻る</Button>
      </Link>
    </div>
  )
}
