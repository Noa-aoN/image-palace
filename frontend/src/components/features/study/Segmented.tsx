// スタディのゲームオプション等で使う、ラベル付きの小さなセグメント切替。
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className="rounded-lg border px-3 py-1 text-sm font-medium transition"
              style={{
                borderColor: active ? 'var(--palace)' : 'var(--border)',
                color: active ? 'var(--palace)' : undefined,
                backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
