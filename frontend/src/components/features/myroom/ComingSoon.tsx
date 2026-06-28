import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  /** カード見出し（省略時はセクション見出しに任せ、準備中バッジのみ表示） */
  title?: string
  /** 見出し横のアイコン（省略時は時計）。title がある時のみ表示 */
  icon?: ReactNode
  /** 補足説明（任意） */
  description?: string
  /** 準備中に予定している項目（muted リストで表示） */
  items?: string[]
}

/**
 * マイルーム配下の未実装カテゴリを「準備中」として明示する共通カード。
 * title を省略すると、上位のセクション見出しと重複しないよう準備中バッジのみを表示する。
 */
export function ComingSoon({ title, icon, description, items }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-card/60 p-5">
      <div className="flex items-center gap-2">
        {title && <span style={{ color: 'var(--palace)' }}>{icon ?? <Clock size={18} />}</span>}
        {title && <h3 className="text-base font-semibold">{title}</h3>}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">準備中</span>
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
