'use client'

/** サーバー（Admin::Period）が返す、いま見ている期間と選べる候補 */
export interface AdminPeriod {
  key: string
  label: string
  from: string
  to: string
  days: number
  options: {
    rolling: { value: string; label: string }[]
    months: { value: string; label: string }[]
    all: { value: string; label: string }
  }
}

/**
 * 運営画面で見る期間の選び方。**どのページでも同じもの**を使う。
 *
 * ページごとに別の選び方があると、同じ「7月」を見ているつもりで違う範囲を見ることになる。
 * 候補はサーバーが返す（月の一覧は記録のある月だけなので、画面側では作れない）。
 *
 * 実際の範囲（◯/◯ 〜 ◯/◯）も併せて出す。「全期間」や「直近半年」は、
 * どこからどこまでなのかが名前だけでは分からない。
 */
export function PeriodSelect({
  period,
  value,
  onChange,
}: {
  period: AdminPeriod
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {period.label}（{new Date(period.from).toLocaleDateString('ja-JP')} 〜{' '}
        {new Date(period.to).toLocaleDateString('ja-JP')}）
      </p>
      <label className="text-sm">
        <span className="mr-2 text-muted-foreground">期間</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1"
        >
          <optgroup label="直近">
            {period.options.rolling.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
          {period.options.months.length > 0 && (
            <optgroup label="月ごと">
              {period.options.months.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )}
          <option value={period.options.all.value}>{period.options.all.label}</option>
        </select>
      </label>
    </div>
  )
}
