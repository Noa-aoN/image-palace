'use client'

import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import { propertyCategoryOf, propertyColorOf, type PropertyCategory } from '@/lib/api/properties'

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
  category,
  color,
  empty = false,
}: {
  title: string
  /** 右上に並べる操作。BlockAction を使う */
  actions?: ReactNode
  children: ReactNode
  /** 見出しの横に回すスピナー（保存中など） */
  busy?: boolean
  /**
   * 何のために持つ項目か。**枠は変えず、小さな文字だけで表す。**
   *
   * 縁に色の線を入れていたが、同じ形で並ぶはずのものが1つだけ違う形に見えた。
   * 見分けたいのは「直すときの物差しが違う」ことであって、
   * 別の種類の入れ物だと思わせたいわけではない。
   */
  category?: PropertyCategory
  /**
   * その項目に付けた目印の色。**見出しの前に小さな丸で出す。**
   *
   * 役割の色は3つしかないので、同じ役割の中に並ぶ項目は全部同じ色になる。
   * これは、その人が自分の物差しで付ける印。**器の形も地も変えない**
   * （縁を塗ると、同じ形で並ぶはずのものが別種の入れ物に見える）。
   */
  color?: string | null
  /**
   * まだ何も書いていないか。**地を灰にして、書いたものと見分ける。**
   *
   * 押して出した直後の欄と、書き終えた欄が同じ地だと、
   * 上から読んでいってどこまで書いたのかが分からない。
   */
  empty?: boolean
}) {
  const role = category ? propertyCategoryOf(category) : null
  const mark = propertyColorOf(color)

  return (
    // 縁は札と同じ金。ただし一段薄く（内側の器のほうが強いと主従が逆になる）。
    // 地は灰をやめて暖かい白へ。muted の灰は青みがあり、ivory の上では汚れて見える。
    // **まだ書いていないものだけ**、地を落として区別する。
    // 落とす先は ivory-dark では足りなかった（ivory との差が小さく、
    // 「少し暗い紙」にしか見えない）。--surface-empty で一段深く、灰寄りにする
    <section
      className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-[var(--edge-gold-soft)]"
      style={{ background: empty ? 'var(--surface-empty)' : 'var(--surface-warm)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          {/* 目印の丸。**字の前に置く。** 後ろに置くと役割の札と並んで、
              どちらも「この項目が何か」を言う印に見える。
              色だけの印なので、読み上げには出さない（title で名前は読める） */}
          {mark && (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: mark.hex }}
              title={mark.label}
            />
          )}
          <h3 className="text-sm font-medium">{title}</h3>
          {/* **色は添えるだけ。** 札の縁は金のままにする。
              縁を役割ごとに塗ると、器が3種類あるように見えてしまう。
              見分けたいのは「直すときの物差しが違う」ことであって、別の入れ物ではない。
              色だけに頼らないよう、文字も出したままにする */}
          {role && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                color: role.accent,
                backgroundColor: `color-mix(in srgb, ${role.accent} 12%, transparent)`,
              }}
              title={role.hint}
            >
              {role.label}
            </span>
          )}
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
