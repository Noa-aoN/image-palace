import { PROPERTY_TOOLS_KEY } from '@/components/features/items/ItemPropertyBlocks'

/**
 * ひな型を当てたカードで、どの札を「持たない」に回すか。
 *
 * ひな型が決めるのは**作り付けの中身のうち、どれを出すか**。
 * だから、それ以外の2つは畳まない。
 *
 *   - 種別に足した項目（`prop:`）… ひな型を決めたあとに足したもの。
 *     畳むと、Wikipedia の項目を足しても既存のカードに出てこない
 *   - 道具（PROPERTY_TOOLS_KEY）… 項目を足す・AI で埋める入口。
 *     畳むと、ひな型を当てた瞬間に項目を足す方法が画面から消える
 *
 * ここを純粋な関数にしてあるのは、畳みすぎ・畳み漏れがどちらも
 * 「画面から何かが消える」形で出るため。目で見て気づける保証がない。
 */
export function omittedKeysForPreset(allKeys: string[], presetKeys: Set<string>): Set<string> {
  return new Set(
    allKeys.filter(
      (key) => !presetKeys.has(key) && !key.startsWith('prop:') && key !== PROPERTY_TOOLS_KEY
    )
  )
}
