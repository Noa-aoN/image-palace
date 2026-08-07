'use client'

import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * カード詳細のプロパティを載せる、共通の器。
 *
 * カードに持たせたいものは分野ごとに際限なく増える（読み仮名・発音記号・派生語・
 * 翻訳・関連カード・学習の記録…）。増えるたびに見出しの出し方や操作の置き場所が
 * ばらけると、同じ画面なのに項目ごとに作法が違う状態になる。
 *
 * そこで**どの項目も同じ形**にする。
 *   見出し ……… 何の項目か
 *   操作 ………… 右上に寄せる（AI生成・追加・編集など、その項目に効くものだけ）
 *   中身 ………… 型ごとの表示・編集
 *   補足 ………… 未設定時の案内やエラー
 *
 * あとから足す自由プロパティも同じ器に乗るので、作り付けの項目と見分けが付かない。
 */
export function PropertyBlock({
  title,
  actions,
  children,
  busy = false,
}: {
  title: string
  /** 右上に並べる操作。BlockAction を使う */
  actions?: ReactNode
  children: ReactNode
  /** 見出しの横に回すスピナー（保存中など） */
  busy?: boolean
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {busy && <Spinner size={14} className="text-muted-foreground" />}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * ブロック右上の操作。見た目と当たり判定をここに集約する。
 *
 * ラベルは省略できる（アイコンだけにする）。省略しても `label` は
 * aria-label と tooltip に使うので、読み上げでも意味が分かる。
 */
export function BlockAction({
  icon,
  label,
  onClick,
  disabled = false,
  busy = false,
  hideLabel = false,
  title,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  /** 幅が惜しいときはラベルを畳む。aria-label には残る */
  hideLabel?: boolean
  /** 押す前に効き方を説明したいときだけ。既定は label */
  title?: string
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Spinner size={14} /> : icon}
      {!hideLabel && label}
    </button>
  )

  // ラベルを畳んだものは、何のボタンか見て分からない。指を乗せたら出す。
  // ラベルが出ているものでも、効き方の説明があるなら添える
  const hint = hideLabel ? (title ? `${label}（${title}）` : label) : title
  return hint ? <Tooltip label={hint}>{button}</Tooltip> : button
}

/** 未設定のときの案内。項目ごとに書き方がぶれないよう、ここに寄せる */
export function BlockEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** 項目の中のエラー。置き場所と見た目を揃える */
export function BlockError({ message }: { message: string | null }) {
  if (!message) return null

  return <p className="text-xs text-destructive">{message}</p>
}
