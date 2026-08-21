import type { PackageStatus, StatusAction } from '@/lib/api/studio'

// 荷物の扱いを、画面の言葉に直す。
//
// **止めるのと終えるのを分けてある。**
// 誤って出したときに「削除」で応えると、何を出していたのかが分からなくなる。

// **扱いと届け先は別のこと。**
//
//   扱い   … その荷物を外へ出しているか（下書き / 出している / 止めた / 終えた）
//   届け先 … 出しているものが、どこへ届くか（体験 / デルフォイ / コード…）
//
// 出していても届け先がゼロなら、誰にも届かない。
// 逆に届け先を入れても、止めていれば届かない。**両方そろって初めて届く。**
export const STATUS_LABEL: Record<PackageStatus, string> = {
  draft: '下書き',
  published: '出している',
  suspended: '止めた',
  archived: '終了',
}

export const STATUS_NOTE: Record<PackageStatus, string> = {
  draft: 'まだ外へ出していません。下見はできます',
  published: '外へ出しています。あとは届け先しだいです',
  suspended: '外へ出すのを止めています。戻せます',
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
      return [{ action: 'publish', label: '外へ出す' }]
    case 'published':
      return [
        { action: 'suspend', label: '出すのを止める' },
        { action: 'archive', label: '終了する', confirm: '終了すると、もう出し直せません。よろしいですか。' },
      ]
    case 'suspended':
      return [
        { action: 'resume', label: 'もう一度出す' },
        { action: 'archive', label: '終了する', confirm: '終了すると、もう出し直せません。よろしいですか。' },
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

// 体験用の宮殿の入口を、どこまで開けるか。
//
// **一般の方に対しての見え方。** 制作の権限があれば、準備中でも確かめられる。
export type DemoStage = 'hidden' | 'development' | 'prototype' | 'released'

export const DEMO_STAGE_LABEL: Record<DemoStage, string> = {
  hidden: '入口ごと出さない',
  development: '準備中と伝える',
  prototype: '準備中と伝える',
  released: '一般に開く',
}

export const DEMO_STAGE_NOTE: Record<DemoStage, string> = {
  hidden: 'ボタンそのものを出しません',
  development: 'ボタンは見えますが、押せません',
  prototype: 'ボタンは見えますが、押せません',
  released: '誰でも体験用の宮殿に入れます',
}

/**
 * 届け先に添える一言。**いま実際に何が届くのかを言う。**
 *
 * 扱い（status）だけを見て「配っていません」と書くと、
 * 新しい下書きを起こしただけで「届きません」と出てしまう。
 * 実際にはひとつ前の版が届き続けている
 */
export function deliveryNoteFor(pkg: {
  version: number
  delivering_version: number | null
}): string | null {
  if (pkg.delivering_version === null) {
    return 'いまはどの版も出していないので、入れても届きません'
  }
  if (pkg.delivering_version !== pkg.version) {
    return `いま届くのは v${pkg.delivering_version} です（この版はまだ出していません）`
  }
  return null
}
