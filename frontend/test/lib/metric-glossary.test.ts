import { describe, expect, it } from 'vitest'
import { METRIC_GLOSSARY, metricDefinition, metricLabel, type MetricKey } from '@/lib/admin/metric-glossary'

const keys = Object.keys(METRIC_GLOSSARY) as MetricKey[]

describe('経営の用語集', () => {
  it('どの指標も、意味・式・なぜ見るか・この製品での注意を持つ', () => {
    for (const key of keys) {
      const definition = metricDefinition(key)
      expect(definition.name, key).not.toBe('')
      expect(definition.abbr, key).not.toBe('')
      expect(definition.fullName, key).not.toBe('')
      expect(definition.meaning, key).not.toBe('')
      expect(definition.formula, key).not.toBe('')
      expect(definition.why, key).not.toBe('')
      expect(definition.here, key).not.toBe('')
    }
  })

  it('読み方があれば略称に添える', () => {
    expect(metricLabel('dau')).toBe('DAU（ダウ）')
    expect(metricLabel('mau')).toBe('MAU（マウ）')
    expect(metricLabel('arppu')).toBe('ARPPU（アープー）')
  })

  it('読み方が自明なものには添えない', () => {
    expect(metricLabel('cardsCreated')).toBe('Cards')
    expect(metricLabel('revenue')).toBe('Revenue')
  })

  it('略称は重複しない（同じ札に違う説明が付くのを防ぐ）', () => {
    const abbrs = keys.map((key) => metricDefinition(key).abbr)

    expect(new Set(abbrs).size).toBe(abbrs.length)
  })

  it('割り算で出すものは、分母が0のときの扱いを説明に書く', () => {
    for (const key of ['arppu', 'grossMargin'] as MetricKey[]) {
      expect(metricDefinition(key).here, key).toContain('算出不可')
    }
  })

  // 最上段に置く6枚。ここが「10秒で状態を判断する」ための面になる
  it('ビジネスの状態に出す指標が、すべて用語集にある', () => {
    const health: MetricKey[] = ['mrr', 'grossProfit', 'grossMargin', 'mau', 'payingUsers', 'aiCost']

    for (const key of health) {
      expect(metricDefinition(key).name, key).not.toBe('')
    }
    expect(health).toHaveLength(6)
  })

  it('粗利と粗利率の式が食い違わない', () => {
    expect(metricDefinition('grossProfit').formula).toContain('売上 −')
    expect(metricDefinition('grossMargin').formula).toBe('粗利 ÷ 売上 × 100')
  })
})
