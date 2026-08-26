import { describe, it, expect } from 'vitest'
import {
  ADMIN_BUILT_IN_KEYS,
  adminBlockKeys,
  adminEntries,
  adminPropertyKeys,
  defaultOmittedBlockKeys,
} from '@/lib/items/admin-blocks'
import type { ItemPropertyEntry } from '@/lib/api/properties'

const entry = (key: string, category?: string) =>
  ({ key, label: key, value_type: 'text', category, value: null }) as unknown as ItemPropertyEntry

describe('管理のための札', () => {
  it('作り付けは、学習の記録と使っている場所', () => {
    expect([ ...ADMIN_BUILT_IN_KEYS ]).toEqual([ 'reviews', 'usages' ])
  })

  it('役割が管理要素の自由プロパティを拾う', () => {
    const entries = [ entry('source', 'admin'), entry('reading', 'subject'), entry('note', 'admin') ]
    expect(adminPropertyKeys(entries)).toEqual([ 'prop:source', 'prop:note' ])
  })

  it('覚える対象・変換要素は拾わない', () => {
    expect(adminPropertyKeys([ entry('reading', 'subject'), entry('goro', 'mnemonic') ])).toEqual([])
  })

  it('項目が無くても落ちない', () => {
    expect(adminPropertyKeys(undefined)).toEqual([])
    expect(adminBlockKeys(undefined)).toEqual(new Set([ 'reviews', 'usages' ]))
  })
})

describe('既定で持たないに回す札', () => {
  const admin = adminBlockKeys([ entry('source', 'admin') ])

  it('まだ並べていないカードでは、管理の札を回す', () => {
    expect(defaultOmittedBlockKeys(admin, undefined)).toEqual(
      new Set([ 'reviews', 'usages', 'prop:source' ])
    )
  })

  // 並べ替えるとその順が order に残る。**整えた並びを黙って崩さない**
  it('並べたカードでは、載っている札に手を出さない', () => {
    const order = [ 'title', 'image', 'meanings', 'reviews' ]
    expect(defaultOmittedBlockKeys(admin, order)).toEqual(new Set([ 'usages', 'prop:source' ]))
  })

  it('全部載っていれば、何も回さない', () => {
    const order = [ 'reviews', 'usages', 'prop:source' ]
    expect(defaultOmittedBlockKeys(admin, order)).toEqual(new Set())
  })

  it('管理の札が無ければ、何も回さない', () => {
    expect(defaultOmittedBlockKeys(new Set(), undefined)).toEqual(new Set())
  })
})

describe('情報に出す項目', () => {
  it('役割が管理要素のものを、値の有無に関わらず出す', () => {
    const entries = [ entry('source', 'admin'), entry('reading', 'subject') ]
    expect(adminEntries(entries).map((e) => e.key)).toEqual([ 'source' ])
  })

  it('項目が無くても落ちない', () => {
    expect(adminEntries(undefined)).toEqual([])
  })
})
