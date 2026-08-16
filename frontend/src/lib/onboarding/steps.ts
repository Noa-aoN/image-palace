import { DEFAULT_DISPLAY_STYLE, type DisplayStyle } from '@/lib/display-style'

/**
 * 登録直後の案内。**1ステップ1テーマ**で、5枚だけ。
 *
 * 増やしたくなったら、まず「初回に決める価値があるか」を疑う。
 * あとから変えられる設定は、ここではなく環境設定の仕事。
 *
 * 入れ物はすべて既存のもの（`users.name` / `settings.palace_name` /
 * `settings.display_style` / `settings.onboarded_at`）。
 * **オンボーディング専用の列は作らない。**
 */
export type OnboardingStepKey = 'welcome' | 'profile' | 'concepts' | 'palace' | 'settings'

export interface OnboardingStep {
  key: OnboardingStepKey
  /** 進捗の下に出す見出し */
  title: string
  /**
   * 飛ばせるか。**入力を求めるステップだけ true**。
   * 読むだけのステップに「スキップ」を出すと、読まずに進む導線を増やすだけになる。
   */
  skippable: boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'welcome', title: '宮殿へようこそ', skippable: false },
  { key: 'profile', title: 'あなたについて', skippable: true },
  { key: 'concepts', title: 'ImagePalace のしくみ', skippable: false },
  { key: 'palace', title: '宮殿に名前をつける', skippable: true },
  { key: 'settings', title: '最初の設定', skippable: true },
]

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** 範囲の外を渡されても落ちない（戻る/進むの端で呼ばれる） */
export function stepAt(index: number): OnboardingStep | null {
  return ONBOARDING_STEPS[index] ?? null
}

export function clampIndex(index: number): number {
  if (index < 0) return 0
  if (index > ONBOARDING_STEP_COUNT - 1) return ONBOARDING_STEP_COUNT - 1

  return index
}

export function isLastStep(index: number): boolean {
  return index >= ONBOARDING_STEP_COUNT - 1
}

/** 「2 / 5」。読み上げにも使う */
export function progressLabel(index: number): string {
  return `${clampIndex(index) + 1} / ${ONBOARDING_STEP_COUNT}`
}

/** 進んだ割合（0〜1）。最初の1枚でも 0 にしない — 何も進んでいないように見える */
export function progressRatio(index: number): number {
  return (clampIndex(index) + 1) / ONBOARDING_STEP_COUNT
}

export interface OnboardingDraft {
  name: string
  palaceName: string
  displayStyle: DisplayStyle
}

export const EMPTY_DRAFT: OnboardingDraft = {
  name: '',
  palaceName: '',
  displayStyle: DEFAULT_DISPLAY_STYLE,
}

export interface OnboardingPayloads {
  /** 名前を触っていなければ送らない（空文字で既存の名前を消さないため） */
  profile: { name: string } | null
  settings: {
    display_style: DisplayStyle
    palace_name: string | null
    onboarded: boolean
  }
}

/**
 * 入力を、保存する2つの呼び出しに割り振る。
 *
 * **空欄は「消したい」ではなく「決めていない」**。
 * 飛ばした人の名前を空で上書きしてしまうと、OAuth が持ってきた名前が消える。
 *
 * 宮殿名だけは null を送る。画面側が既定の呼び方に落とすので、
 * 空文字のまま置くと「名前のない宮殿」として扱われてしまう。
 */
export function draftToPayloads(draft: OnboardingDraft, current: { name?: string | null } = {}): OnboardingPayloads {
  const name = draft.name.trim()
  const palaceName = draft.palaceName.trim()
  const unchanged = name === (current.name ?? '').trim()

  return {
    profile: name && !unchanged ? { name } : null,
    settings: {
      display_style: draft.displayStyle,
      palace_name: palaceName || null,
      onboarded: true,
    },
  }
}
