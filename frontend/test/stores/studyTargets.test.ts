import { describe, it, expect, beforeEach } from 'vitest'
import { useStudyTargetStore, toQuizTarget } from '@/stores/studyTargets'

describe('toQuizTarget', () => {
  it('SavedTarget を QuizTarget に戻す', () => {
    expect(toQuizTarget({ key: 'all', kind: 'all', name: 'すべてのカード' })).toEqual({ kind: 'all' })
    expect(toQuizTarget({ key: 'box:x', kind: 'box', id: 'x', name: 'X' })).toEqual({
      kind: 'box',
      id: 'x',
      name: 'X',
    })
  })
})

describe('useStudyTargetStore.toggleSave', () => {
  beforeEach(() => {
    useStudyTargetStore.setState({ targets: [] })
  })

  it('未保存なら追加し、もう一度で外す（トグル）', () => {
    const { toggleSave } = useStudyTargetStore.getState()
    toggleSave({ kind: 'all' })
    expect(useStudyTargetStore.getState().targets.map((t) => t.key)).toEqual(['all'])
    toggleSave({ kind: 'all' })
    expect(useStudyTargetStore.getState().targets).toHaveLength(0)
  })

  it('新しく保存した対象が先頭に来る', () => {
    const { toggleSave } = useStudyTargetStore.getState()
    toggleSave({ kind: 'box', id: 'a', name: 'A' })
    toggleSave({ kind: 'box', id: 'b', name: 'B' })
    expect(useStudyTargetStore.getState().targets.map((t) => t.id)).toEqual(['b', 'a'])
  })
})
