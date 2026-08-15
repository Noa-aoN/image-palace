'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { sectionFromHash } from '@/lib/nav/section-hash'

export interface CategorySection<K extends string> {
  key: K
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface Props<K extends string> {
  sections: CategorySection<K>[]
  ariaLabel: string
}

/**
 * マイルーム配下ページ（アカウント管理 / 環境設定 / 利用と支払い / トロフィー）で共有する。
 * 全カテゴリを縦に一覧表示しつつ、上部の sticky タブをクリックすると該当セクションへスクロールする。
 * スクロール位置に応じてアクティブタブが追従する（スクロールスパイ）。
 */
export function CategorySections<K extends string>({ sections, ariaLabel }: Props<K>) {
  const [active, setActive] = useState<K>(sections[0]?.key)
  // クリック直後はジャンプ先を一時的に active 固定し、スクロール中のちらつきを防ぐ。
  const lockedRef = useRef<K | null>(null)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.key))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (lockedRef.current) return
        // 画面上部に最も近い（intersecting な）セクションを active にする。
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id as K)
      },
      // sticky ナビ（約56px）の下端を基準に、上寄りのセクションを active 判定する。
      { rootMargin: '-64px 0px -70% 0px', threshold: 0 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current)
    }
  }, [])

  // URL が項目を名指ししていたら、そこを開く（`/account#basic` など）。
  //
  // ブラウザ任せにできない。**この中身はログインの確認が済んだあとに現れる**ので、
  // 素の飛び先合わせが走る時点では、まだ行き先の要素が無い。
  useEffect(() => {
    const jumpToHash = () => {
      const key = sectionFromHash(window.location.hash, sections.map((s) => s.key)) as K | null
      if (!key) return

      setActive(key)
      // 出来上がるのを1回待つ（現れる前に呼んでも、どこへも動かない）
      requestAnimationFrame(() => {
        document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }

    jumpToHash()
    window.addEventListener('hashchange', jumpToHash)
    return () => window.removeEventListener('hashchange', jumpToHash)
    // sections は毎回作り直されるので、鍵の並びだけを見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.key).join(',')])

  const handleJump = (key: K) => {
    setActive(key)
    lockedRef.current = key
    if (lockTimer.current) clearTimeout(lockTimer.current)
    // スムーススクロール完了を見込んでロック解除。
    lockTimer.current = setTimeout(() => {
      lockedRef.current = null
    }, 700)
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    // 全幅活用: lg 以上は「左=縦タブ(sticky) / 右=内容」の2カラム。モバイルは上部の横スクロールタブ＋縦積み。
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      {/* アンカーナビ（モバイル=上部 sticky 横スクロール / lg+=左の縦並び sticky） */}
      <div className="sticky top-0 z-10 mb-6 rounded-xl border border-border bg-[var(--ivory-dark)]/95 px-2 py-1.5 backdrop-blur lg:mb-0 lg:self-start lg:top-4">
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="flex gap-1 overflow-x-auto whitespace-nowrap lg:flex-col lg:overflow-visible"
        >
          {sections.map((s) => {
            const isActive = s.key === active
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={s.key}
                onClick={() => handleJump(s.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors lg:w-full lg:justify-start ${
                  isActive ? 'bg-white text-[var(--palace)] shadow-sm' : 'text-muted-foreground hover:bg-black/5'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 全セクションを縦に一覧表示（セクション間は区切り線で分ける） */}
      <div className="min-w-0 divide-y divide-border">
        {sections.map((s) => (
          <section
            key={s.key}
            id={s.key}
            aria-label={s.label}
            className="scroll-mt-20 py-8 first:pt-0 lg:first:pt-0"
          >
            {/* タブに沿ったセクション見出し */}
            <div className="mb-4 flex items-center gap-2">
              <span style={{ color: 'var(--palace)' }}>{s.icon}</span>
              <h2 className="text-lg font-semibold">{s.label}</h2>
            </div>
            <div className="space-y-4">{s.content}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
