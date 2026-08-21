'use client'

import type { StudioBox, StudioSpace, StudioView } from '@/lib/api/studio'

/**
 * 原本の入れもの。**箱・キャンバス・宮殿。**
 *
 * カードと違って、ここで押せることは無い。並べる意味は
 * **「これを選んだら何が起きるか」を、選ぶ前に見せる**こと。
 *
 *   箱     … 袋なので、外したカードは落ちるだけ。何枚落ちるかが分かればよい
 *   キャンバス … 構造なので、外したカードが1枚でもあると下書きが止まる
 *   宮殿   … まだ配れない
 */
export function StudioContainers({
  boxes,
  views,
  spaces,
}: {
  boxes: StudioBox[]
  views: StudioView[]
  spaces: StudioSpace[]
}) {
  return (
    <div className="space-y-6">
      <Group title="箱" empty="公式宮殿に箱がありません" count={boxes.length}>
        {boxes.map((box) => (
          <Row key={box.id} name={box.name} meta={`カード ${box.items} 枚`}>
            {box.excluded > 0 ? (
              <Note>{box.excluded} 枚を「出さない」にしています（選ぶと、その分だけ落ちます）</Note>
            ) : null}
            {box.blocked > 0 ? (
              <Note warn>{box.blocked} 枚に絵か意味か種別が足りません（選ぶと下書きが止まります）</Note>
            ) : null}
          </Row>
        ))}
      </Group>

      <Group title="キャンバス" empty="公式宮殿にキャンバスがありません" count={views.length}>
        {views.map((view) => (
          <Row
            key={view.id}
            name={view.name}
            meta={`カード ${view.items} / 線 ${view.edges} ・ ${view.view_type}`}
          >
            {!view.portable ? (
              <Note>宮殿に結びついているため、まだ配れません</Note>
            ) : null}
            {/* **選ぶ前に言う。** キャンバスは節を抜くと穴が開く */}
            {view.blocking.length > 0 ? (
              <Note warn>
                「{view.blocking.join('」「')}」を「出さない」にしています。
                このキャンバスを選ぶと、下書きが止まります
              </Note>
            ) : null}
          </Row>
        ))}
      </Group>

      <Group title="宮殿" empty="公式宮殿にスペースがありません" count={spaces.length}>
        {spaces.map((space) => (
          <Row key={space.id} name={space.name} meta={`ポイント ${space.points}`}>
            <Note>宮殿ごと配る仕組みは、まだありません</Note>
          </Row>
        ))}
      </Group>
    </div>
  )
}

function Group({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">
        {title} <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </h3>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}

function Row({
  name,
  meta,
  children,
}: {
  name: string
  meta: string
  children?: React.ReactNode
}) {
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <p className="font-medium">
        {name} <span className="text-xs font-normal text-muted-foreground">{meta}</span>
      </p>
      {children}
    </li>
  )
}

function Note({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <p className="mt-1 text-xs" style={warn ? { color: '#8A6210' } : undefined}>
      <span className={warn ? '' : 'text-muted-foreground'}>{children}</span>
    </p>
  )
}
