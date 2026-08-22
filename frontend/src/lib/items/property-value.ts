import type { ItemPropertyEntry } from '@/lib/api/properties'

/**
 * その項目に、値が入っているか。
 *
 * **型ごとに「空」の形が違う。** 文字は空文字、一覧は空配列、
 * 自由欄は見出しも中身も空、チェックは触っていなければ null。
 *
 * 数えるところと並べるところで別々に書いていたので、1か所に出す。
 * 片方だけ直ると「未記入が3件」と言いながら3件とも埋まって見える、が起きる。
 *
 * **チェックの `false` は「入っている」。**
 * 触っていない（null）のと、見て「違う」と決めた（false）のは別のこと。
 */
export function isFilled(entry: Pick<ItemPropertyEntry, 'value_type' | 'value'>): boolean {
  const value = entry.value

  if (value == null) return false

  switch (entry.value_type) {
    case 'list':
      return Array.isArray(value) && value.length > 0

    case 'boolean':
      // 触っていなければ null。`false` は「見て決めた」なので入っている
      return typeof value === 'boolean'

    case 'free_text': {
      const v = value as { heading?: string | null; body?: string | null }
      return Boolean(v.heading?.trim() || v.body?.trim())
    }

    case 'free_image': {
      // 絵は `url`。まだ作っていなくても、指示や見出しがあれば「書いた」
      const v = value as { heading?: string; prompt?: string; url?: string | null }
      return Boolean(v.heading?.trim() || v.prompt?.trim() || v.url)
    }

    case 'reading': {
      // 並びで持つ。1つでも書いてあれば入っている
      return Array.isArray(value) && value.length > 0
    }

    case 'wikipedia': {
      // **文字で入ってくる**（JSON の文字列）。引いた結果が空のこともある
      if (typeof value !== 'string' || value.trim() === '') return false

      try {
        const parsed: unknown = JSON.parse(value)
        if (parsed && typeof parsed === 'object') {
          const v = parsed as { wikipedia_title?: string; wikipedia_extract?: string }
          return Boolean(v.wikipedia_title?.trim() || v.wikipedia_extract?.trim())
        }
      } catch {
        // JSON でなければ、そのまま文字として見る
      }
      return true
    }

    default:
      return typeof value === 'string' ? value.trim() !== '' : true
  }
}

export function isEmpty(entry: Pick<ItemPropertyEntry, 'value_type' | 'value'>): boolean {
  return !isFilled(entry)
}

/**
 * 設定済みと、まだ書いていないものに分ける。
 *
 * **未設定を本文に全部並べない。** 定義した項目が20あれば、
 * 書いていない18件が「未設定」と並んで、カード詳細が縦に伸びる。
 * 書いたものを読みに来た人が、空欄をかき分けることになる。
 */
export function splitByFilled<T extends Pick<ItemPropertyEntry, 'value_type' | 'value'>>(
  entries: T[]
): { filled: T[]; empty: T[] } {
  return {
    filled: entries.filter((e) => isFilled(e)),
    empty: entries.filter((e) => isEmpty(e)),
  }
}
