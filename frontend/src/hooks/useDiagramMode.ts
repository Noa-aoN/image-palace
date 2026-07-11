'use client'

import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import type { DiagramMode } from '@/types/settings'

/**
 * 図（間取り図・記憶資産など）を 2D / 3D どちらで描くかを返す。
 * 優先順位は「この図の個別指定（端末に記憶）> アカウントの環境設定 > 既定の 3D」。
 * key は図の識別子（例: 'floorplan' / 'memory-assets'）。
 */
export function useDiagramMode(key: string): [DiagramMode, (mode: DiagramMode) => void] {
  const accountMode = useSettingsStore((s) => s.settings?.diagram_mode)
  const override = useUiStore((s) => s.diagramOverrides[key])
  const setOverride = useUiStore((s) => s.setDiagramOverride)

  const mode: DiagramMode = override ?? accountMode ?? '3d'

  return [mode, (next: DiagramMode) => setOverride(key, next)]
}
