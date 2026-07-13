// メモリーデュエル（学習統合型TCG）の純粋ロジック。属性相性・モンスター生成・クラッシュ判定。
import { getItems } from '@/lib/api/items'
import { loadQuizCards, type QuizTarget, type QuizCard } from '@/lib/quiz'
import { shuffle } from '@/lib/shuffle'

export type DuelType = 'fire' | 'grass' | 'water' | 'thunder' | 'wind'

// 5すくみの並び：i は (i+1) に強い（fire→grass→water→thunder→wind→fire）
export const DUEL_TYPES: DuelType[] = ['fire', 'grass', 'water', 'thunder', 'wind']

export const TYPE_META: Record<DuelType, { label: string; emoji: string; color: string }> = {
  fire: { label: '火', emoji: '🔥', color: '#ef4444' },
  grass: { label: '草', emoji: '🌿', color: '#22c55e' },
  water: { label: '水', emoji: '💧', color: '#3b82f6' },
  thunder: { label: '雷', emoji: '⚡', color: '#eab308' },
  wind: { label: '風', emoji: '🌀', color: '#14b8a6' },
}

// a が b に対して持つダメージ倍率。相性勝ち=1.5 / 相性負け=0.67 / 同等=1。
export function typeMultiplier(a: DuelType, b: DuelType): number {
  if (a === b) return 1
  const ia = DUEL_TYPES.indexOf(a)
  const ib = DUEL_TYPES.indexOf(b)
  if ((ia + 1) % DUEL_TYPES.length === ib) return 1.5
  if ((ib + 1) % DUEL_TYPES.length === ia) return 0.67
  return 1
}

export type Monster = QuizCard & { type: DuelType; atk: number }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// カードからモンスターを決定的に生成（同じカードは常に同じ属性・ATK）。
export function toMonster(card: QuizCard, tags: string[]): Monster {
  const typeSeed = tags[0] ?? card.title
  const type = DUEL_TYPES[hash(typeSeed) % DUEL_TYPES.length]
  const atk = 3 + (hash(card.id) % 5) + Math.min(tags.length, 2) // 3〜9
  return { ...card, type, atk }
}

export const DUEL_MIN_CARDS = 6

// 対象カードを取得し、所有カードの tags を突き合わせてモンスター化する。
export async function loadDuelMonsters(target: QuizTarget): Promise<Monster[]> {
  // 'all' は loadQuizCards が内部で全ページ取得するため、二重取得を避けて単一フェッチから組み立てる。
  if (target.kind === 'all') {
    const items = await getItems()
    return items
      .filter((i) => i.generation_status === 'completed' && i.media?.url)
      .map((i) => toMonster({ id: i.id, title: i.title, image: i.media!.url }, (i.tags ?? []).map((t) => t.name)))
  }
  const [cards, items] = await Promise.all([loadQuizCards(target), getItems()])
  const tagsById = new Map<string, string[]>(items.map((i) => [i.id, (i.tags ?? []).map((t) => t.name)]))
  return cards.map((c) => toMonster(c, tagsById.get(c.id) ?? []))
}

// CPU は手札から ATK が最も高いものを出す。
export function cpuPick(hand: Monster[]): Monster {
  return hand.reduce((best, m) => (m.atk > best.atk ? m : best), hand[0])
}

// 指定モンスターの想起4択（正解＋他からダミー3、シャッフル済み）。
export function recallChoices(card: Monster, pool: Monster[], n = 4): Monster[] {
  const distractors = shuffle(pool.filter((m) => m.id !== card.id)).slice(0, n - 1)
  return shuffle([card, ...distractors])
}

export type ClashResult = {
  playerEff: number
  cpuEff: number
  winner: 'player' | 'cpu' | 'draw'
  damage: number
}

// クラッシュ判定。recallMult はプレイヤーの想起ボーナス（正解=2 / 不正解=1）。
export function resolveClash(player: Monster, cpu: Monster, recallMult: number): ClashResult {
  const playerEff = Math.round(player.atk * recallMult * typeMultiplier(player.type, cpu.type))
  const cpuEff = Math.round(cpu.atk * typeMultiplier(cpu.type, player.type))
  if (playerEff === cpuEff) return { playerEff, cpuEff, winner: 'draw', damage: 1 }
  const winner: 'player' | 'cpu' = playerEff > cpuEff ? 'player' : 'cpu'
  return { playerEff, cpuEff, winner, damage: Math.max(1, Math.abs(playerEff - cpuEff)) }
}
