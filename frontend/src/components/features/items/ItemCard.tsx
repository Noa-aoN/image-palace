'use client'

import { startTransition, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import {
  RegeneratingOverlay,
  REGENERATING_IMAGE_CLASS,
} from '@/components/features/items/RegeneratingOverlay'
import { SafeguardVeil, useSafeguardImage } from '@/components/features/items/SafeguardVeil'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { ItemTypeMark } from '@/components/features/items/ItemTypeMark'
import { EMPTY_VALUE_MARK } from '@/lib/card-list-layout'
import { STATUS_LABEL, isRegenerating } from '@/lib/item-status'
import { aspectRatioCss } from '@/lib/aspect-ratio'
import { cardShows, type CardDensity } from '@/lib/items/card-density'
import type { CardFit } from '@/hooks/useCardDisplay'
import { CARD_IMAGE_EDGE, CARD_MAT_BG, CARD_MAT_BORDER } from '@/lib/card-frame'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'

/**
 * 一覧に並ぶカード1枚。
 *
 * ItemList の中に置いていたため、**同じ札を出したい他の画面から使えなかった**。
 * デッキをカードで見せるときも、一覧と違う見え方になっていた。
 *
 * 出すものは呼び出し側が渡す（blocks / density / showTypeMark）。
 * ここに書き込むと、設定を変えても札が変わらなくなる。
 */
// 単語名の吹き出しの最大幅（max-w-[18rem] と合わせる）。寄せ方の判定に使う
const TITLE_TOOLTIP_MAX_WIDTH = 288

const TOOLTIP_ALIGN_CLASSES = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
} as const

// ファクトチェックで「正しい」以外のときの単語名の色（一覧カードで使用）。
// 人が読んで判断したもの（確認済み）は色を出さない。棚を開くたびに
// 解決済みの指摘で警告され続けるのは、警告そのものを読み飛ばす癖につながる。
function factCheckTitleClass(item: Item): string {
  if (item.fact_check_acknowledged_at) return ''
  if (item.fact_check_status === 'incorrect') return 'text-red-600'
  if (item.fact_check_status === 'doubtful') return 'text-yellow-700'
  return ''
}

function needsFactCheckAttention(item: Item): boolean {
  return Boolean(
    !item.fact_check_acknowledged_at && item.fact_check_status && item.fact_check_status !== 'correct'
  )
}


export type ItemCardProps = {
  item: Item
  selectionMode: boolean
  selected: boolean
  onToggle: (id: string) => void
  fit: CardFit
  /** 列数から作った表示幅の申告。列を増やしたのに大きい画像を落とさないため */
  sizes: string
  /** いま一括処理の順番が回っているカード。どれを触っているかを見せる */
  working: boolean
  /** 何をしている最中か。輪だけだと「動いている」ことしか分からない */
  workingLabel: string | null
  /** 種別の印を出すか。「表示」で切れる。置き場所は見出し語の右で固定 */
  showTypeMark: boolean
  /**
   * その幅で何が読めるか。**列数から決まる**。
   *
   * 札は格子の幅いっぱいに広がるので、列を増やすほど1枚は細くなる。
   * 10列だと1枚 約120px で、見出しも項目も数文字で切れる。
   * それでも積んでいると、読めない字のぶんだけ絵が小さくなる。
   */
  density: CardDensity
  /**
   * 何をどの順で積むか（サーバーの設定から来る）。
   * カード側に固定で書いていたころは、絵を外しても出続け、並べ替えても順が変わらなかった。
   */
  blocks: string[]
}

export function ItemCard({
  item, selectionMode, selected, onToggle, fit, sizes, working, workingLabel, blocks, showTypeMark, density,
}: ItemCardProps) {
  const shows = cardShows(density)
  // 絵を出さない設定のときは、状態バッジの置き場所が無くなる。
  // その場合だけ、従来どおり見出しの行に残す
  const showsImage = blocks.includes('image')
  const router = useRouter()
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const warmedRef = useRef(false)
  const imageUrl = item.media?.thumb_url ?? item.media?.url
  const resolvedImageUrl = imageUrl ?? null
  const hasImageError = resolvedImageUrl !== null && failedImageUrl === resolvedImageUrl
  // 前の画像が残ったまま生成中＝作り直し中。初回生成（画像が無い）とは見せ方を変える
  const regenerating = isRegenerating(item.generation_status, resolvedImageUrl !== null && !hasImageError)
  // 承認待ちは一覧でも覆う。ここで素の絵を出したら、覆う意味が無い。
  // 決めるのは詳細（カードをめくった先）で行う
  const veiled = Boolean(item.media?.needs_approval) && !regenerating
  // 覆いの濃さは設定で変えられる（薄い / 標準 / 濃い）
  const safeguard = useSafeguardImage()

  // 単語名が枠に入り切らないときだけ、ホバーで全文を出す。
  // 列数を増やせるようにした結果、8〜10列では名前が数文字で切れる。
  // 切れていないカードにまで出すと、ただの邪魔になるので測ってから決める。
  //
  // 寄せ方も測って決める。真ん中から伸ばすと、左端・右端の列では棚の外へ出て切れる。
  // 段数は画面幅で変わる（xl で10列でも、md では5列）ので、何列目かは数えられない。
  // 棚そのものの左右端と見比べて、はみ出す側には付けない。
  const [tooltipAlign, setTooltipAlign] = useState<'left' | 'center' | 'right' | null>(null)

  const showTitleTooltip = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    if (el.scrollWidth <= el.clientWidth) return setTooltipAlign(null)

    const grid = el.closest('[data-card-grid]')?.getBoundingClientRect()
    if (!grid) return setTooltipAlign('center')

    const card = el.getBoundingClientRect()
    const center = (card.left + card.right) / 2
    // 実際の幅は出してみないと分からないので、上限で見積もっておく（狭まるぶんには困らない）
    const half = TITLE_TOOLTIP_MAX_WIDTH / 2
    setTooltipAlign(center - half < grid.left ? 'left' : center + half > grid.right ? 'right' : 'center')
  }

  const warmupDetail = () => {
    if (warmedRef.current) return
    warmedRef.current = true

    startTransition(() => {
      useItemsStore.getState().upsertItem(item)
      router.prefetch(`/items/${item.id}`)
    })
  }

  // 絵。設定で外されていれば、そもそも積まない（枠だけ・余白だけが残らない）
  // 画像の周りに細い余白（マット）を入れ、トレーディングカードの縁に見せる。
  // スキンやフレームを差し替えるときはこの枠を変える。
  //
  // そろえるときは枠を正方形に固定し、画像は縮めて全体を収める。台紙の余白が
  // 画像の周りに回るので、比率の違うカードが混ざっても棚が波打たない。
  // 画像側に w/h を張らないのは、張ると縁の影と線が画像ではなく余白の外周に付くため。
  const imageBlock = (
      <div
        className="relative w-full flex items-center justify-center overflow-hidden rounded-[3px]"
        style={{ aspectRatio: fit === 'uniform' ? '1 / 1' : aspectRatioCss(item.aspect_ratio) }}
      >
        {/* 丸型のチェックを画像の右上に。
            丸なのは、押して入り切りするつまみが一個だけだから。
            状態バッジも右上を使うので、選んでいる最中はそちらが左上へ回る */}
        {selectionMode && (
          <span
            aria-hidden
            className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? 'border-[var(--palace)] bg-[var(--palace)] text-white'
                : 'border-white/90 bg-black/25 text-transparent'
            }`}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
          >
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {resolvedImageUrl && !hasImageError ? (
          <>
            {/* **絵があるときだけ**、状態を絵の上に出す。
                絵が無いときは枠そのものが「まだ絵が無い」と言っているので、
                その上にバッジを重ねると同じことを2度言うことになる
                （実際、失敗した札には ⚠ が中央と右上に2つ並んでいた）。

                ここに出るのは「絵はあるが、最後の生成に失敗した」ような場合で、
                そのときバッジは**唯一の手がかり**になる。

                選んでいる最中は右上を印（チェック）が使うので、状態は左上へ回る */}
            <span
              className={`pointer-events-none absolute top-1.5 z-10 ${selectionMode ? 'left-1.5' : 'right-1.5'}`}
            >
              <StatusBadge status={item.generation_status} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt={item.title}
              className={`${CARD_IMAGE_EDGE} ${
                fit === 'uniform' ? 'max-h-full max-w-full object-contain' : 'w-full h-full object-cover'
              } ${regenerating ? REGENERATING_IMAGE_CLASS : ''} ${veiled ? safeguard.className : ''}`}
              style={veiled ? safeguard.style : undefined}
              // 覆っている間は掴めなくする（引きずるとぼかす前の絵が持ち上がる）
              draggable={!veiled}
              loading="lazy"
              decoding="async"
              sizes={sizes}
              onError={() => setFailedImageUrl(resolvedImageUrl)}
            />
            {regenerating && <RegeneratingOverlay compact />}
            {veiled && <SafeguardVeil />}
          </>
        ) : (
          <GeneratingOverlay
            status={item.generation_status}
            label={hasImageError ? '期限切れ' : STATUS_LABEL[item.generation_status]}
            className="h-full w-full"
            textClassName="text-muted-foreground text-xs"
            // 失敗の理由は、指を乗せれば読める形にしておく。
            // 一覧に本文を出すと1枚が縦に伸びるが、理由が分からないままだと
            // 「また押す」以外の手が思いつかない
            title={item.generation_status === 'failed' ? (item.generation_error ?? undefined) : undefined}
          />
        )}
      </div>
  )

  // 項目1行。出す指定なら、値が無くても「-」で出す。
  // 落としてしまうと、出るカードと出ないカードが混ざり、法則が読めない
  const renderField = (field: { key: string; label: string; value: string }) => {
    const empty = !field.value?.trim()
    // 意味・説明だけは長い。3行までに丸める（それ以上は一覧を圧迫する）
    const clamped = field.key === 'meaning'
    return (
      <div className="flex gap-1.5 text-2xs leading-snug">
        <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
        {/* **丸める上限ぶんの高さを、いつも取っておく。**
            まだ生成中で「-」しか無いカードは1行、書き終えたカードは3行になり、
            並べると**カードごとに高さが違って**見えていた。
            高さを先に確保すれば、中身が入っても入らなくても札の形が変わらない。

            4.125em ＝ 3行ぶん（leading-snug = 1.375 × 3） */}
        <dd
          className={`${clamped ? 'line-clamp-3' : 'truncate'} ${empty ? 'text-muted-foreground/60' : ''}`}
          style={clamped ? { minHeight: '4.125em' } : undefined}
        >
          {empty ? EMPTY_VALUE_MARK : field.value}
        </dd>
      </div>
    )
  }

  const inner = (
    <>
      {/* いま順番が回っているカードは、そうと分かるようにする。
          上の進捗（3/12）だけだと、どれを触っているのか分からず、
          並んでいるカードのどこかが変わるのを待つことになる。
          見え方は大きく変えない。薄い覆いと小さな輪だけ */}
      {working && (
        <span className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background/60">
          <Spinner size={18} />
          {/* **何をしている最中かを書く。** 輪だけだと「動いている」ことしか
              分からず、タグを付けているのか絵を作り直しているのかが読めない */}
          {workingLabel && (
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
              {workingLabel}中
            </span>
          )}
        </span>
      )}
      {/* 間隔は**この包みだけが決める**。
          以前はブロックごとに `pt-1.5` を持っていたので、

            見出し → 絵    … 6px（見出しの pb だけ）
            見出し → 項目  … 12px（見出しの pb ＋ 項目の pt）
            絵 → 項目      … 6px

          となり、**並べ替えると間隔が変わって見えた**。
          並びに関わらず同じ間隔になるよう、1か所に寄せる */}
      <div className="flex flex-col gap-1.5">
      {/* 見出しも台紙の上に置く。**枠の外に文字があると、絵だけが「カード」に見える。**
          札の名前欄のつもりで、絵と同じ紙に載せる。
          細い格子（9列以上）では出さない ― 数文字で切れた字は身元にならない */}
      {shows.title && (
      <div className="px-0.5 flex items-center justify-between gap-2">
        {/* ファクトチェックで「正しい」以外なら単語名に色を付けて気づけるようにする */}
        <span
          className={`text-sm font-medium truncate ${factCheckTitleClass(item)}`}
          title={needsFactCheckAttention(item) ? 'AIチェックで要確認' : undefined}
          onMouseEnter={showTitleTooltip}
          onMouseLeave={() => setTooltipAlign(null)}
        >
          {item.headline || item.title}
        </span>
        {/* 種別の印。**見出しのすぐ右**に置く（何のカードかは、名前の次に知りたいこと）。
            「表示」で切れる。置き場所は固定なので、並べ替えの対象にはしない */}
        {/* 見出し語と同じ字の大きさを渡す。印はそこから `em` で自分の大きさを決める */}
        {showTypeMark && shows.mark && <ItemTypeMark type={item.item_type} className="text-sm" />}
        {/* 下見で入ったカードは、自分で作ったものと見分けが付かない。
            **小さく印を出すだけ**にする（専用の画面には変えない） */}
        {item.from_preview ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-medium"
            style={{ backgroundColor: 'var(--preview)', color: 'var(--on-accent)' }}
            title="公式コンテンツの下見で入ったカードです。下見を終えると消えます"
          >
            下見
          </span>
        ) : null}
        {/* 絵を出していないなら、状態の置き場所はここしかない */}
        {!showsImage && <StatusBadge status={item.generation_status} />}
      </div>
      )}
      {blocks.map((block) => {
        if (block === 'image') return <div key="image">{imageBlock}</div>

        // 細い格子では項目を積まない。読めない字のぶん、絵が小さくなるだけ
        if (!shows.fields) return null

        const field = item.list_fields?.find((row) => row.key === block)
        if (!field) return null
        return (
          <dl key={block} className="space-y-0.5 px-0.5">
            {renderField(field)}
          </dl>
        )
      })}
      </div>
    </>
  )

  // 選択モード中はナビゲーションせず、クリックで選択をトグルする
  const card = selectionMode ? (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={selected}
      className={`relative flex w-full flex-col rounded-xl border p-2 text-left transition-shadow ${CARD_MAT_BG} ${
        selected ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]' : `${CARD_MAT_BORDER} hover:shadow-md`
      }`}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={`/items/${item.id}`}
      className={`relative flex flex-col rounded-xl border p-2 transition-shadow hover:shadow-md ${CARD_MAT_BG} ${CARD_MAT_BORDER}`}
      prefetch
      onMouseEnter={warmupDetail}
      onFocus={warmupDetail}
    >
      {inner}
    </Link>
  )

  // 吹き出しはカードの外に置く。カード自身は overflow-hidden（画像を角丸で切るため）なので、
  // 中に置くと上へはみ出したぶんが切られる。
  //
  // 幅は中身なり（w-max）。折り返すのは、画面や隣のカードを押しのけるほど長いときだけ。
  return (
    <div className="relative flex flex-col">
      {tooltipAlign && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-full z-30 mb-1 w-max max-w-[min(18rem,80vw)] rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background shadow-md ${TOOLTIP_ALIGN_CLASSES[tooltipAlign]}`}
        >
          {item.headline || item.title}
        </span>
      )}
      {card}
    </div>
  )
}
