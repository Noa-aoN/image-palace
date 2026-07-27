'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getTags, createTag, updateTag, deleteTag, setTagPinned } from '@/lib/api/tags'
import {
  getTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  reorderTagGroups,
  addTagToGroup,
  removeTagFromGroup,
  reorderGroupItems,
} from '@/lib/api/tagGroups'
import type { Tag } from '@/types/tag'

// クライアント内部モデル。cid は undo/redo をまたいで安定する識別子。
// サーバー ID (`id`) は作成・削除の取り消しで作り直すと変わるため、参照は常に cid で行い
// API 呼び出しの直前に cid → id を解決する。
export type BoardTag = { cid: string; id: string; name: string; itemCount: number; pinned: boolean }
export type BoardGroup = {
  cid: string
  id: string
  name: string
  pinned: boolean
  isDefault: boolean
  defaultKey: string | null
  position: number
  tagCids: string[]
}
type BoardState = { tags: BoardTag[]; groups: BoardGroup[] }

// 削除取り消し用に、タグが属していたグループと並び位置を控える。
type Membership = { groupCid: string; index: number }
type Command = { redo: () => Promise<void>; undo: () => Promise<void>; label: string }

let cidSeq = 0
const newCid = () => `c${++cidSeq}`

function toBoardTag(t: Tag): BoardTag {
  return { cid: t.id, id: t.id, name: t.name, itemCount: t.item_count, pinned: t.pinned }
}

// ---- 純粋な状態更新ヘルパ（すべて新しい state を返す）----
const patchTag = (s: BoardState, cid: string, patch: Partial<BoardTag>): BoardState => ({
  ...s,
  tags: s.tags.map((t) => (t.cid === cid ? { ...t, ...patch } : t)),
})
const patchGroup = (s: BoardState, cid: string, patch: Partial<BoardGroup>): BoardState => ({
  ...s,
  groups: s.groups.map((g) => (g.cid === cid ? { ...g, ...patch } : g)),
})
const removeTagEverywhere = (s: BoardState, cid: string): BoardState => ({
  tags: s.tags.filter((t) => t.cid !== cid),
  groups: s.groups.map((g) => ({ ...g, tagCids: g.tagCids.filter((c) => c !== cid) })),
})
const setGroupCids = (s: BoardState, groupCid: string, cids: string[]): BoardState => ({
  ...s,
  groups: s.groups.map((g) => (g.cid === groupCid ? { ...g, tagCids: cids } : g)),
})
const cidsOf = (s: BoardState, groupCid: string): string[] =>
  s.groups.find((g) => g.cid === groupCid)?.tagCids ?? []
const insertAt = (arr: string[], item: string, index: number): string[] => {
  const next = arr.filter((c) => c !== item)
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

export function useTagBoard() {
  // 描画には useState、コマンド用の同期読み取りには stateRef（両者を commit で同期）。
  const [state, setStateRaw] = useState<BoardState>({ tags: [], groups: [] })
  const stateRef = useRef<BoardState>(state)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const undoStack = useRef<Command[]>([])
  const redoStack = useRef<Command[]>([])
  const [stacks, setStacks] = useState<{
    canUndo: boolean
    canRedo: boolean
    undoLabel: string | null
    redoLabel: string | null
  }>({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null })
  const syncStacks = useCallback(() => {
    const undoTop = undoStack.current[undoStack.current.length - 1]
    const redoTop = redoStack.current[redoStack.current.length - 1]
    setStacks({
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
      undoLabel: undoTop?.label ?? null,
      redoLabel: redoTop?.label ?? null,
    })
  }, [])

  const commit = useCallback((next: BoardState) => {
    stateRef.current = next
    setStateRaw(next)
  }, [])

  // cid → serverId 解決（呼び出し時の最新状態を参照）
  const tagIdOf = (cid: string) => stateRef.current.tags.find((t) => t.cid === cid)?.id ?? ''
  const groupIdOf = (cid: string) => stateRef.current.groups.find((g) => g.cid === cid)?.id ?? ''

  // ---- 初期ロード ----
  useEffect(() => {
    let cancelled = false
    Promise.all([getTags(), getTagGroups()])
      .then(([tags, groups]) => {
        if (cancelled) return
        const known = new Set(tags.map((t) => t.id))
        const boardTags = tags.map(toBoardTag)
        const boardGroups = [...groups]
          .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name, 'ja'))
          .map((g, i) => ({
            cid: g.id,
            id: g.id,
            name: g.name,
            pinned: g.pinned,
            isDefault: g.is_default,
            defaultKey: g.default_key,
            position: i + 1,
            tagCids: g.tag_ids.filter((id) => known.has(id)),
          }))
        commit({ tags: boardTags, groups: boardGroups })
      })
      .catch(() => {
        if (!cancelled) setError('タグの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [commit])

  // ---- コマンド実行（楽観更新→API。失敗時はスナップショットへ復帰）----
  const perform = useCallback(
    async (command: Command, failMessage: string) => {
      const snapshot = stateRef.current
      try {
        await command.redo()
        undoStack.current.push(command)
        redoStack.current = []
        syncStacks()
      } catch {
        commit(snapshot)
        setError(failMessage)
      }
    },
    [commit, syncStacks]
  )

  const undo = useCallback(async () => {
    const command = undoStack.current[undoStack.current.length - 1]
    if (!command) return
    const snapshot = stateRef.current
    try {
      await command.undo()
      undoStack.current.pop()
      redoStack.current.push(command)
      syncStacks()
    } catch {
      commit(snapshot)
      setError('操作の取り消しに失敗しました')
    }
  }, [commit, syncStacks])

  const redo = useCallback(async () => {
    const command = redoStack.current[redoStack.current.length - 1]
    if (!command) return
    const snapshot = stateRef.current
    try {
      await command.redo()
      redoStack.current.pop()
      undoStack.current.push(command)
      syncStacks()
    } catch {
      commit(snapshot)
      setError('やり直しに失敗しました')
    }
  }, [commit, syncStacks])

  // タグを指定グループの指定位置へ復元（状態＋API）。削除取り消しなどで使う。
  const restoreMembership = useCallback(
    async (tagCid: string, m: Membership) => {
      const nextCids = insertAt(cidsOf(stateRef.current, m.groupCid), tagCid, m.index)
      commit(setGroupCids(stateRef.current, m.groupCid, nextCids))
      await addTagToGroup(groupIdOf(m.groupCid), tagIdOf(tagCid))
      await reorderGroupItems(
        groupIdOf(m.groupCid),
        nextCids.map((c) => tagIdOf(c))
      )
    },
    [commit]
  )

  // ================= タグ操作 =================

  const renameTag = useCallback(
    (cid: string, to: string) => {
      const from = stateRef.current.tags.find((t) => t.cid === cid)?.name ?? ''
      if (!to || to === from) return
      const set = async (name: string) => {
        commit(patchTag(stateRef.current, cid, { name }))
        await updateTag(tagIdOf(cid), name)
      }
      perform(
        { redo: () => set(to), undo: () => set(from), label: `タグ名を「${to}」に変更` },
        'タグ名の更新に失敗しました'
      )
    },
    [commit, perform]
  )

  const setTagPin = useCallback(
    (cid: string, to: boolean) => {
      const name = stateRef.current.tags.find((t) => t.cid === cid)?.name ?? ''
      const set = async (pinned: boolean) => {
        commit(patchTag(stateRef.current, cid, { pinned }))
        await setTagPinned(tagIdOf(cid), pinned)
      }
      perform(
        { redo: () => set(to), undo: () => set(!to), label: `タグ「${name}」を${to ? 'ピン留め' : 'ピン留め解除'}` },
        'ピン留めの更新に失敗しました'
      )
    },
    [commit, perform]
  )

  // タグを1つ作成（未所属）。undo=削除、redo=作り直し（ID は変わるが cid は不変）。
  const addTag = useCallback(
    (name: string) => {
      const cid = newCid()
      const doCreate = async () => {
        commit({
          ...stateRef.current,
          tags: [...stateRef.current.tags, { cid, id: '', name, itemCount: 0, pinned: false }],
        })
        const created = await createTag(name)
        commit(patchTag(stateRef.current, cid, { id: created.id, itemCount: created.item_count }))
      }
      const doDelete = async () => {
        const id = tagIdOf(cid)
        commit(removeTagEverywhere(stateRef.current, cid))
        if (id) await deleteTag(id)
      }
      perform({ redo: doCreate, undo: doDelete, label: `タグ「${name}」を作成` }, 'タグの作成に失敗しました')
    },
    [commit, perform]
  )

  // タグを削除。undo で実体・ピン・所属（並び位置）を復元する（カード付与は復元しない）。
  const deleteTagCmd = useCallback(
    (cid: string) => {
      const snap = stateRef.current
      const tag = snap.tags.find((t) => t.cid === cid)
      if (!tag) return
      const { name, pinned } = tag
      const memberships: Membership[] = snap.groups
        .map((g) => ({ groupCid: g.cid, index: g.tagCids.indexOf(cid) }))
        .filter((m) => m.index >= 0)

      const doDelete = async () => {
        const id = tagIdOf(cid)
        commit(removeTagEverywhere(stateRef.current, cid))
        if (id) await deleteTag(id)
      }
      const doRestore = async () => {
        commit({
          ...stateRef.current,
          tags: [...stateRef.current.tags, { cid, id: '', name, itemCount: 0, pinned }],
        })
        const created = await createTag(name)
        commit(patchTag(stateRef.current, cid, { id: created.id }))
        if (pinned) await setTagPinned(created.id, true)
        for (const m of memberships) await restoreMembership(cid, m)
      }
      perform({ redo: doDelete, undo: doRestore, label: `タグ「${name}」を削除` }, 'タグの削除に失敗しました')
    },
    [commit, perform, restoreMembership]
  )

  // ================= グループ操作 =================

  const renameGroup = useCallback(
    (cid: string, to: string) => {
      const from = stateRef.current.groups.find((g) => g.cid === cid)?.name ?? ''
      if (!to || to === from) return
      const set = async (name: string) => {
        commit(patchGroup(stateRef.current, cid, { name }))
        await updateTagGroup(groupIdOf(cid), { name })
      }
      perform(
        { redo: () => set(to), undo: () => set(from), label: `グループ名を「${to}」に変更` },
        'グループ名の更新に失敗しました'
      )
    },
    [commit, perform]
  )

  const setGroupPin = useCallback(
    (cid: string, to: boolean) => {
      const name = stateRef.current.groups.find((g) => g.cid === cid)?.name ?? ''
      const set = async (pinned: boolean) => {
        commit(patchGroup(stateRef.current, cid, { pinned }))
        await updateTagGroup(groupIdOf(cid), { pinned })
      }
      perform(
        { redo: () => set(to), undo: () => set(!to), label: `グループ「${name}」を${to ? 'ピン留め' : 'ピン留め解除'}` },
        'ピン留めの更新に失敗しました'
      )
    },
    [commit, perform]
  )

  const addGroup = useCallback(
    (name: string) => {
      const cid = newCid()
      const doCreate = async () => {
        const position = Math.max(0, ...stateRef.current.groups.map((g) => g.position)) + 1
        commit({
          ...stateRef.current,
          groups: [
            ...stateRef.current.groups,
            { cid, id: '', name, pinned: false, isDefault: false, defaultKey: null, position, tagCids: [] },
          ],
        })
        const created = await createTagGroup(name)
        commit(patchGroup(stateRef.current, cid, { id: created.id }))
      }
      const doDelete = async () => {
        const id = groupIdOf(cid)
        commit({ ...stateRef.current, groups: stateRef.current.groups.filter((g) => g.cid !== cid) })
        if (id) await deleteTagGroup(id, false)
      }
      perform({ redo: doCreate, undo: doDelete, label: `グループ「${name}」を作成` }, 'グループの作成に失敗しました')
    },
    [commit, perform]
  )

  // グループ削除。deleteTags=true はメンバータグごと削除し、undo で全て復元する。
  const deleteGroupCmd = useCallback(
    (cid: string, deleteTags: boolean) => {
      const snap = stateRef.current
      const group = snap.groups.find((g) => g.cid === cid)
      if (!group) return
      const groupData = { name: group.name, pinned: group.pinned, position: group.position, tagCids: [...group.tagCids] }

      // deleteTags の場合、消えるタグと「全グループにまたがる」所属を控える。
      const removedTagCids = deleteTags ? [...group.tagCids] : []
      const removedTags = removedTagCids
        .map((tc) => snap.tags.find((t) => t.cid === tc))
        .filter((t): t is BoardTag => Boolean(t))
        .map((t) => ({ cid: t.cid, name: t.name, pinned: t.pinned }))
      const removedMemberships = new Map<string, Membership[]>()
      for (const t of removedTags) {
        removedMemberships.set(
          t.cid,
          snap.groups
            .filter((g) => g.cid !== cid)
            .map((g) => ({ groupCid: g.cid, index: g.tagCids.indexOf(t.cid) }))
            .filter((m) => m.index >= 0)
        )
      }

      const doDelete = async () => {
        const id = groupIdOf(cid)
        let next: BoardState = { ...stateRef.current, groups: stateRef.current.groups.filter((g) => g.cid !== cid) }
        if (deleteTags) {
          const removedSet = new Set(removedTagCids)
          next = {
            tags: next.tags.filter((t) => !removedSet.has(t.cid)),
            groups: next.groups.map((g) => ({ ...g, tagCids: g.tagCids.filter((c) => !removedSet.has(c)) })),
          }
        }
        commit(next)
        if (id) await deleteTagGroup(id, deleteTags)
      }

      const doRestore = async () => {
        commit({
          ...stateRef.current,
          groups: [
            ...stateRef.current.groups,
            {
              cid,
              id: '',
              name: groupData.name,
              pinned: groupData.pinned,
              isDefault: false,
              defaultKey: null,
              position: groupData.position,
              tagCids: [],
            },
          ],
        })
        const created = await createTagGroup(groupData.name)
        commit(patchGroup(stateRef.current, cid, { id: created.id }))
        if (groupData.pinned) await updateTagGroup(created.id, { pinned: true })

        if (deleteTags) {
          for (const rt of removedTags) {
            commit({
              ...stateRef.current,
              tags: [...stateRef.current.tags, { cid: rt.cid, id: '', name: rt.name, itemCount: 0, pinned: rt.pinned }],
            })
            const createdTag = await createTag(rt.name)
            commit(patchTag(stateRef.current, rt.cid, { id: createdTag.id }))
            if (rt.pinned) await setTagPinned(createdTag.id, true)
            await restoreMembership(rt.cid, { groupCid: cid, index: groupData.tagCids.indexOf(rt.cid) })
            for (const m of removedMemberships.get(rt.cid) ?? []) await restoreMembership(rt.cid, m)
          }
        } else {
          for (let i = 0; i < groupData.tagCids.length; i++) {
            await restoreMembership(groupData.tagCids[i], { groupCid: cid, index: i })
          }
        }
      }

      perform(
        {
          redo: doDelete,
          undo: doRestore,
          label: `グループ「${groupData.name}」を削除${deleteTags ? '（タグごと）' : ''}`,
        },
        'グループの削除に失敗しました'
      )
    },
    [commit, perform, restoreMembership]
  )

  // ================= メンバーシップ / DnD =================

  // グループへタグを追加（コピー＝元にも残す）。undo=除外。
  const addTagToGroupCmd = useCallback(
    (groupCid: string, tagCid: string) => {
      const group = stateRef.current.groups.find((g) => g.cid === groupCid)
      if (!group || group.tagCids.includes(tagCid)) return
      const index = group.tagCids.length
      const tagName = stateRef.current.tags.find((t) => t.cid === tagCid)?.name ?? ''
      const label = `「${tagName}」を「${group.name}」に追加`
      const doAdd = async () => {
        commit(setGroupCids(stateRef.current, groupCid, insertAt(cidsOf(stateRef.current, groupCid), tagCid, index)))
        await addTagToGroup(groupIdOf(groupCid), tagIdOf(tagCid))
      }
      const doRemove = async () => {
        commit(setGroupCids(stateRef.current, groupCid, cidsOf(stateRef.current, groupCid).filter((c) => c !== tagCid)))
        await removeTagFromGroup(groupIdOf(groupCid), tagIdOf(tagCid))
      }
      perform({ redo: doAdd, undo: doRemove, label }, 'タグの追加に失敗しました')
    },
    [commit, perform]
  )

  // グループからタグを除外。undo=元の位置へ戻す。
  const removeTagFromGroupCmd = useCallback(
    (groupCid: string, tagCid: string) => {
      const group = stateRef.current.groups.find((g) => g.cid === groupCid)
      if (!group) return
      const index = group.tagCids.indexOf(tagCid)
      if (index < 0) return
      const tagName = stateRef.current.tags.find((t) => t.cid === tagCid)?.name ?? ''
      const label = `「${tagName}」を「${group.name}」から外す`
      const doRemove = async () => {
        commit(setGroupCids(stateRef.current, groupCid, cidsOf(stateRef.current, groupCid).filter((c) => c !== tagCid)))
        await removeTagFromGroup(groupIdOf(groupCid), tagIdOf(tagCid))
      }
      const doRestore = async () => {
        await restoreMembership(tagCid, { groupCid, index })
      }
      perform({ redo: doRemove, undo: doRestore, label }, 'タグの除外に失敗しました')
    },
    [commit, perform, restoreMembership]
  )

  // グループ内の並べ替え（ドラッグ）。undo で元順序に戻す。
  const reorderTags = useCallback(
    (groupCid: string, nextCids: string[]) => {
      const prev = cidsOf(stateRef.current, groupCid)
      const groupName = stateRef.current.groups.find((g) => g.cid === groupCid)?.name ?? ''
      const set = async (cids: string[]) => {
        commit(setGroupCids(stateRef.current, groupCid, cids))
        await reorderGroupItems(
          groupIdOf(groupCid),
          cids.map((c) => tagIdOf(c))
        )
      }
      perform(
        { redo: () => set(nextCids), undo: () => set(prev), label: `「${groupName}」内の並べ替え` },
        '並べ替えに失敗しました'
      )
    },
    [commit, perform]
  )

  // グループ間のタグ移動（ドラッグ＝移動: 元から外して先へ挿入）。
  const moveTagBetweenGroups = useCallback(
    (fromGroupCid: string, toGroupCid: string, tagCid: string, toIndex: number) => {
      if (fromGroupCid === toGroupCid) return
      const fromPrev = cidsOf(stateRef.current, fromGroupCid)
      const fromIndex = fromPrev.indexOf(tagCid)
      if (fromIndex < 0) return
      const tagName = stateRef.current.tags.find((t) => t.cid === tagCid)?.name ?? ''
      const toName = stateRef.current.groups.find((g) => g.cid === toGroupCid)?.name ?? ''
      if (cidsOf(stateRef.current, toGroupCid).includes(tagCid)) {
        removeTagFromGroupCmd(fromGroupCid, tagCid)
        return
      }
      const doMove = async () => {
        commit(setGroupCids(stateRef.current, fromGroupCid, cidsOf(stateRef.current, fromGroupCid).filter((c) => c !== tagCid)))
        commit(setGroupCids(stateRef.current, toGroupCid, insertAt(cidsOf(stateRef.current, toGroupCid), tagCid, toIndex)))
        await removeTagFromGroup(groupIdOf(fromGroupCid), tagIdOf(tagCid))
        await addTagToGroup(groupIdOf(toGroupCid), tagIdOf(tagCid))
        await reorderGroupItems(
          groupIdOf(toGroupCid),
          cidsOf(stateRef.current, toGroupCid).map((c) => tagIdOf(c))
        )
      }
      const doBack = async () => {
        commit(setGroupCids(stateRef.current, toGroupCid, cidsOf(stateRef.current, toGroupCid).filter((c) => c !== tagCid)))
        commit(setGroupCids(stateRef.current, fromGroupCid, insertAt(cidsOf(stateRef.current, fromGroupCid), tagCid, fromIndex)))
        await removeTagFromGroup(groupIdOf(toGroupCid), tagIdOf(tagCid))
        await addTagToGroup(groupIdOf(fromGroupCid), tagIdOf(tagCid))
        await reorderGroupItems(
          groupIdOf(fromGroupCid),
          cidsOf(stateRef.current, fromGroupCid).map((c) => tagIdOf(c))
        )
      }
      perform(
        { redo: doMove, undo: doBack, label: `「${tagName}」を「${toName}」へ移動` },
        'タグの移動に失敗しました'
      )
    },
    [commit, perform, removeTagFromGroupCmd]
  )

  // グループ自体の並べ替え（ドラッグ）。position を表示順で振り直す。
  const reorderGroups = useCallback(
    (nextGroupCids: string[]) => {
      const prev = [...stateRef.current.groups].sort((a, b) => a.position - b.position).map((g) => g.cid)
      const set = async (order: string[]) => {
        const posByCid = new Map(order.map((cid, i) => [cid, i + 1]))
        commit({
          ...stateRef.current,
          groups: stateRef.current.groups.map((g) => ({ ...g, position: posByCid.get(g.cid) ?? g.position })),
        })
        await reorderTagGroups(order.map((cid) => groupIdOf(cid)))
      }
      perform(
        { redo: () => set(nextGroupCids), undo: () => set(prev), label: 'グループの並べ替え' },
        'グループの並べ替えに失敗しました'
      )
    },
    [commit, perform]
  )

  // ---- 派生値 ----
  const groups = useMemo(
    () => [...state.groups].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'ja')),
    [state.groups]
  )
  const tagsByCid = useMemo(() => new Map(state.tags.map((t) => [t.cid, t])), [state.tags])
  const ungroupedTags = useMemo(() => {
    const grouped = new Set(state.groups.flatMap((g) => g.tagCids))
    return state.tags
      .filter((t) => !grouped.has(t.cid))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'ja'))
  }, [state.tags, state.groups])

  return {
    loading,
    error,
    setError,
    isEmpty: state.tags.length === 0 && state.groups.length === 0,
    groups,
    tagsByCid,
    ungroupedTags,
    canUndo: stacks.canUndo,
    canRedo: stacks.canRedo,
    undoLabel: stacks.undoLabel,
    redoLabel: stacks.redoLabel,
    undo,
    redo,
    addTag,
    renameTag,
    setTagPin,
    deleteTag: deleteTagCmd,
    addGroup,
    renameGroup,
    setGroupPin,
    deleteGroup: deleteGroupCmd,
    addTagToGroup: addTagToGroupCmd,
    removeTagFromGroup: removeTagFromGroupCmd,
    reorderTags,
    moveTagBetweenGroups,
    reorderGroups,
  }
}

export type TagBoard = ReturnType<typeof useTagBoard>
