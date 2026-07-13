// スタディ＞クイズの純粋ロジック（データ取得・設問生成）。UIから切り離してテスト・拡張しやすくする。
import { getItems } from '@/lib/api/items'
import { getBox } from '@/lib/api/boxes'
import { getViewDetail } from '@/lib/api/views'
import { shuffle } from '@/lib/shuffle'

// クイズに使う最小のカード情報（画像＋単語）
export type QuizCard = { id: string; title: string; image: string }

// クイズ対象。将来 'recent' / 'tag' / 'space' / 'weak' を足せる。
export type QuizTarget =
  | { kind: 'all' }
  | { kind: 'box'; id: string; name: string }
  | { kind: 'view'; id: string; name: string }

// 対象を一意に識別するキー（選択ハイライト・最近の対象の重複排除に使う）
export function targetKey(t: QuizTarget): string {
  return t.kind === 'all' ? 'all' : `${t.kind}:${t.id}`
}

// 対象の表示名
export function targetLabel(t: QuizTarget): string {
  return t.kind === 'all' ? 'すべてのカード' : t.name
}

// 完了かつ画像ありのカードだけを QuizCard に整形し、id で重複排除する。
function toQuizCards(
  cards: { id: string; title: string; generation_status: string; media: { url: string } | null }[]
): QuizCard[] {
  const seen = new Set<string>()
  const result: QuizCard[] = []
  for (const c of cards) {
    if (c.generation_status !== 'completed' || !c.media?.url || seen.has(c.id)) continue
    seen.add(c.id)
    result.push({ id: c.id, title: c.title, image: c.media.url })
  }
  return result
}

// 出題形式
export type QuizFormat = 'image_to_word' | 'word_to_image'

export type QuizQuestion = {
  card: QuizCard // 正解のカード
  choices: QuizCard[] // シャッフル済みの選択肢（正解を含む）
}

const CHOICES_PER_QUESTION = 4
export const MIN_CARDS = CHOICES_PER_QUESTION // 4択に必要な最低枚数
const DEFAULT_QUESTION_COUNT = 10

// 対象に応じて、画像付き・生成完了のカードだけを取得する。
export async function loadQuizCards(target: QuizTarget): Promise<QuizCard[]> {
  if (target.kind === 'all') {
    const items = await getItems()
    return toQuizCards(items)
  }

  if (target.kind === 'box') {
    // box: entries のうち Item かつ画像ありのものだけ
    const detail = await getBox(target.id)
    const items = detail.entries
      .filter((e): e is Extract<typeof e, { entry_type: 'Item' }> => e.entry_type === 'Item')
      .map((e) => ({ id: e.id, title: e.title, generation_status: 'completed', media: e.media }))
    return toQuizCards(items)
  }

  // view（キャンバス）: freeboard/deck は items[].item、space_map は points[].placed_item
  const detail = await getViewDetail(target.id)
  const fromItems = (detail.items ?? []).map((p) => p.item)
  const fromPoints = (detail.points ?? [])
    .map((p) => p.placed_item)
    .filter((it): it is NonNullable<typeof it> => it !== null)
  return toQuizCards([...fromItems, ...fromPoints])
}

// プラクティス（フラッシュカード）用。QuizCard に意味を添える。
export type PracticeCard = QuizCard & { meaning: string | null }

// 対象のカードを取得し、所有カードの意味を id で突き合わせて添える。
export async function loadPracticeCards(target: QuizTarget): Promise<PracticeCard[]> {
  // 'all' は loadQuizCards が内部で全ページ取得するため、二重取得を避けて単一フェッチから組み立てる。
  if (target.kind === 'all') {
    const items = await getItems()
    return items
      .filter((i) => i.generation_status === 'completed' && i.media?.url)
      .map((i) => ({ id: i.id, title: i.title, image: i.media!.url, meaning: i.meaning ?? null }))
  }
  const [cards, items] = await Promise.all([loadQuizCards(target), getItems()])
  const meaningById = new Map(items.map((i) => [i.id, i.meaning ?? null]))
  return cards.map((c) => ({ ...c, meaning: meaningById.get(c.id) ?? null }))
}

// カード集合から count 問を作る。各問は正解1＋他カードからダミー3をランダム抽出し選択肢をシャッフル。
export function buildQuestions(cards: QuizCard[], count = DEFAULT_QUESTION_COUNT): QuizQuestion[] {
  if (cards.length < MIN_CARDS) return []
  const questionCards = shuffle(cards).slice(0, Math.min(count, cards.length))

  return questionCards.map((card) => {
    const distractors = shuffle(cards.filter((c) => c.id !== card.id)).slice(0, CHOICES_PER_QUESTION - 1)
    const choices = shuffle([card, ...distractors])
    return { card, choices }
  })
}
