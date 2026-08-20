import type { PackageStatus, StatusAction } from '@/lib/api/studio'

// 荷物の扱いを、画面の言葉に直す。
//
// **止めるのと終えるのを分けてある。**
// 誤って出したときに「削除」で応えると、何を出していたのかが分からなくなる。

export const STATUS_LABEL: Record<PackageStatus, string> = {
  draft: '下書き',
  published: '配布中',
  suspended: '停止中',
  archived: '終了',
}

export const STATUS_NOTE: Record<PackageStatus, string> = {
  draft: 'まだ誰にも配っていません。下見はできます',
  published: 'いま配っています',
  suspended: '配るのを止めています。**戻せます**',
  archived: '役目を終えました。戻せません',
}

/** 目立たせ方。配布中だけを強く、終了は沈める */
export const STATUS_TONE: Record<PackageStatus, 'active' | 'paused' | 'quiet'> = {
  draft: 'paused',
  published: 'active',
  suspended: 'paused',
  archived: 'quiet',
}

export type ActionSpec = {
  action: StatusAction
  label: string
  /** 押す前に確かめるか。**戻せない操作だけ** */
  confirm?: string
}

/**
 * その扱いから、次にできること。
 *
 * **戻せない操作（終える）は必ず確認を挟む。**
 * 止めるのは戻せるので、確認は要らない。
 */
export function actionsFor(status: PackageStatus): ActionSpec[] {
  switch (status) {
    case 'draft':
      return [{ action: 'publish', label: '公開する' }]
    case 'published':
      return [
        { action: 'suspend', label: '配るのを止める' },
        { action: 'archive', label: '終了する', confirm: '終了すると、もう配り直せません。よろしいですか。' },
      ]
    case 'suspended':
      return [
        { action: 'resume', label: 'もう一度配る' },
        { action: 'archive', label: '終了する', confirm: '終了すると、もう配り直せません。よろしいですか。' },
      ]
    case 'archived':
      return []
  }
}

/** 下見できるか。**終えたものは見ない**（見ても出せない） */
export function canPreview(status: PackageStatus): boolean {
  return status !== 'archived'
}

/**
 * 鍵の形。英小文字・数字・_ で3〜50字。
 *
 * URL や rake の引数に出るので、扱いやすい字だけにする。
 * **サーバー側と同じ決まり**（片方だけ緩めると、送ってから断られる）
 */
export function validateKey(key: string): string | null {
  if (!key) return '鍵を入れてください'
  if (!/^[a-z][a-z0-9_]{2,49}$/.test(key)) {
    return '英小文字ではじまり、英小文字・数字・_ で3〜50字にしてください'
  }
  return null
}
