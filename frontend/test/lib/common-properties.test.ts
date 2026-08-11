import { describe, it, expect } from 'vitest'
import { COMMON_PROPERTY_KEYS, commonPropertyPresets, PROPERTY_PRESETS } from '@/lib/api/properties'

// 名前で引いているので、プリセット側の key を変えると黙って消える。
// 「7件出るはずが6件だった」は画面を見ても気づきにくい
describe('よく使う項目', () => {
  it('7件すべてがプリセットに存在する', () => {
    expect(commonPropertyPresets()).toHaveLength(COMMON_PROPERTY_KEYS.length)
  })

  it('型と説明を持って返る（画面がそのまま作れる）', () => {
    for (const preset of commonPropertyPresets()) {
      expect(preset.value_type).toBeTruthy()
      expect(preset.description).toBeTruthy()
    }
  })

  // 他は枠を作るだけだが、Wikipedia は押せば中身まで入る。
  // 主導線なので、並びの先頭から動かさない
  it('Wikipedia が先頭', () => {
    expect(commonPropertyPresets()[0].key).toBe('wikipedia')
  })

  it('プリセット全体の部分集合である（勝手な項目を混ぜない）', () => {
    const all = new Set(PROPERTY_PRESETS.flatMap((g) => g.items).map((p) => p.key))

    for (const key of COMMON_PROPERTY_KEYS) expect(all.has(key)).toBe(true)
  })
})
