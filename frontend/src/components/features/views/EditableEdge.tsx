'use client'

import {
  createContext,
  memo,
  useContext,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  Position,
  type EdgeProps,
} from '@xyflow/react'
import type { ViewEdgeStyle, EdgePoint } from '@/types/view'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import {
  axisForHandle,
  buildEdgePath,
  orthogonalize,
  withStubs,
  dashArrayFor,
  resolveLineStyle,
  portedPoint,
  pointAtFraction,
  DEFAULT_CURVE_RADIUS,
} from '@/lib/edge-path'

// 折れ点の確定保存はボード側（FreeboardCanvas）へ委譲する（data に関数を入れず lint 回避）。
export const EdgeActionsContext = createContext<{
  commitPoints: (edgeId: string, points: EdgePoint[]) => void
  /** 二重線の内側に敷く色。盤の色を渡す（線を2本描く代わりに、真ん中を盤の色で抜く） */
  boardBg: string
}>({
  commitPoints: () => {},
  boardBg: 'var(--board-bg)',
})

type EditableEdgeData = { edgeStyle?: ViewEdgeStyle; label?: string | null; points?: EdgePoint[] }

function EditableEdgeComponent(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerStart, markerEnd, style } = props
  const d = (props.data ?? {}) as EditableEdgeData
  const s = d.edgeStyle ?? {}
  const label = d.label
  const points = d.points ?? []

  const { screenToFlowPosition, setEdges } = useReactFlow()
  const { commitPoints, boardBg } = useContext(EdgeActionsContext)
  const latest = useRef<EdgePoint[]>(points)
  const moved = useRef(false)

  /**
   * 線の道すじ。**カードから離してから曲げ、手前で止める。**
   *
   * 2つを順に掛ける。
   *   1. 助走  … 出た辺の向きへまっすぐ離れてから曲がる
   *              （すぐ曲がると、線がそのカードの側面に張り付いて走る）
   *   2. 直交  … 軸に揃っていない対の間に角を挟む
   *              （折れ点はサーバーが「既定のカードの大きさ」で計算するが、
   *                実際の大きさは AI が変える。その差が斜め線になっていた）
   *
   * **端は縁まで届かせる。** 手前で止めていた頃は、助走の終わりから
   * 止めた位置までが数 px しか無く、そこに矢じりが詰まって見えた。
   * 矢印はカードに届いてこそ「これを指している」と読める。
   */
  const sourceHandleSide = handleSide(sourcePosition, Position.Bottom)
  const targetHandleSide = handleSide(targetPosition, Position.Top)
  // 取っ手は辺の中心に1つしかないので、ポートのぶんだけ辺に沿ってずらす。
  // ずらさないと、扇の根元が1点に戻って、どれがどこへ向かう線か読めない
  const start = portedPoint({ x: sourceX, y: sourceY }, sourceHandleSide, s.source_port)
  const end = portedPoint({ x: targetX, y: targetY }, targetHandleSide, s.target_port)
  const verts = orthogonalize(
    withStubs([start, ...points, end], sourceHandleSide, targetHandleSide),
    axisForHandle(sourceHandleSide)
  )
  // 助走と手前止めを掛けたので、折れ点が無い線もここで組む。
  // React Flow の自動経路（getSmoothStepPath）だと、その2つが効かない
  const edgePath = buildEdgePath(verts, s.curve ?? 'sharp', s.curve_radius ?? DEFAULT_CURVE_RADIUS)
  // 道すじが近い線どうしで文字が重なるので、サーバーが線に沿ってずらしている。
  // 線から離すのではなく線の上を滑らせるので、どの線の文字かは見失われない
  const { x: labelX, y: labelY } = pointAtFraction(verts, s.label_t ?? 0.5)

  // 線の種類。二重線だけは1本では描けないので、太い線の真ん中を盤の色で抜く
  const lineStyle = resolveLineStyle(s)
  const strokeWidth = s.width || 2
  const dashArray = dashArrayFor(lineStyle, strokeWidth)
  const doubled = lineStyle === 'double'
  // 二重線は真ん中を抜いて作るので、下地を敷くと抜けが埋まる。そこだけは敷かない
  const backgroundImageUrl = useBoardSettingsStore((state) => state.backgroundImageUrl)
  const haloed = !doubled && !backgroundImageUrl
  const baseStyle = {
    ...style,
    strokeDasharray: dashArray,
    strokeLinecap: lineStyle === 'dotted' ? ('round' as const) : undefined,
    // 二重線は外側を太くする。元の太さのままだと内側を抜いたときに細く見える
    strokeWidth: doubled ? strokeWidth * 2.2 : strokeWidth,
  }

  // 対象 edge の data.points だけを差し替える（他 edge は再描画しない）
  const writeLocal = (next: EdgePoint[]) => {
    latest.current = next
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { ...(e.data as object), points: next } } : e)))
  }

  // 既存 waypoint の移動
  const startMove = (idx: number, base: EdgePoint[]) => (ev: ReactPointerEvent) => {
    ev.stopPropagation()
    moved.current = false
    const move = (e: PointerEvent) => {
      moved.current = true
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      writeLocal(base.map((p, i) => (i === idx ? { x: Math.round(fp.x), y: Math.round(fp.y) } : p)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (moved.current) commitPoints(id, latest.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // セグメント中点のゴースト → 新規 waypoint を挿入し、そのままドラッグに移行
  const startInsert = (segIndex: number) => (ev: ReactPointerEvent) => {
    const fp = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
    const inserted = [...points]
    inserted.splice(segIndex, 0, { x: Math.round(fp.x), y: Math.round(fp.y) })
    writeLocal(inserted)
    startMove(segIndex, inserted)(ev)
  }

  // waypoint ダブルクリックで削除
  const removeAt = (idx: number) => (ev: ReactMouseEvent) => {
    ev.stopPropagation()
    const next = points.filter((_, i) => i !== idx)
    writeLocal(next)
    commitPoints(id, next)
  }

  return (
    <>
      {/* 選択中は線の下にハローを敷き、脈動させて、複数選択でもどの線が選ばれているか分かるようにする */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--palace)"
          strokeWidth={(s.width || 2) + 6}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        >
          <animate attributeName="stroke-opacity" values="0.1;0.8;0.1" dur="0.8s" repeatCount="indefinite" />
        </path>
      )}
      {/*
        線が交わったところを読めるようにする。

        **線の下に、盤の色で少し太い線を敷く。** 重なると上の線の下地が
        下の線を切るので、どちらが手前かが目で分かる（回路図の線の跨ぎと同じ考え）。
        交点を計算しないので、線が何本あっても重くならない。

        盤に背景の絵があるときは敷かない。**絵に帯が走って、そちらのほうが読みにくい。**
      */}
      {haloed && (
        <path
          d={edgePath}
          fill="none"
          stroke={boardBg}
          strokeWidth={strokeWidth + EDGE_HALO_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={baseStyle} />
      {doubled && (
        // 真ん中を盤の色で抜いて2本に見せる。矢印は外側の線だけに付ける
        <path
          d={edgePath}
          fill="none"
          stroke={boardBg}
          strokeWidth={strokeWidth * 0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <EdgeLabelRenderer>
        {label && (
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              // 背景色を指定していなくても、線や他のカードに重なると読めなくなる。
              // 盤の色に馴染む下地を必ず敷き、細い縁で切り分ける
              background: s.label_bg || 'var(--board-bg)',
              color: s.label_color || undefined,
              fontSize: s.label_size || 13,
              opacity: s.label_opacity != null ? s.label_opacity / 100 : undefined,
              padding: '2px 6px',
              borderRadius: 4,
              border: s.label_bg ? undefined : '1px solid rgba(0,0,0,0.08)',
              boxShadow: s.label_bg ? undefined : '0 1px 2px rgba(0,0,0,0.06)',
              lineHeight: 1.3,
              textAlign: 'center',
              maxWidth: 160,
              overflowWrap: 'anywhere',
              writingMode: s.label_vertical ? 'vertical-rl' : undefined,
              whiteSpace: s.label_vertical ? 'nowrap' : undefined,
            }}
          >
            {label}
          </div>
        )}

        {selected && (
          <>
            {/* セグメント中点のゴースト（ドラッグで折れ点を追加） */}
            {verts.slice(0, -1).map((v, i) => {
              const n = verts[i + 1]
              const mx = (v.x + n.x) / 2
              const my = (v.y + n.y) / 2
              return (
                <div
                  key={`g${i}`}
                  className="nodrag nopan"
                  onPointerDown={startInsert(i)}
                  title="ドラッグで折れ点を追加"
                  style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--palace)',
                    opacity: 0.4,
                    cursor: 'crosshair',
                    pointerEvents: 'all',
                  }}
                />
              )
            })}
            {/* 既存 waypoint（ドラッグで移動 / ダブルクリックで削除） */}
            {points.map((p, i) => (
              <div
                key={`w${i}`}
                className="nodrag nopan"
                onPointerDown={startMove(i, points)}
                onDoubleClick={removeAt(i)}
                title="ドラッグで移動 / ダブルクリックで削除"
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--on-accent)',
                  border: '2px solid var(--palace)',
                  cursor: 'grab',
                  pointerEvents: 'all',
                }}
              />
            ))}
          </>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const EditableEdge = memo(EditableEdgeComponent)

/** React Flow の位置を、取っ手の名前へ直す */
function handleSide(position: Position | undefined, fallback: Position): string {
  const value = position ?? fallback
  if (value === Position.Left) return 'left'
  if (value === Position.Right) return 'right'
  if (value === Position.Top) return 'top'
  return 'bottom'
}

/** 線の下に敷く下地の太さ(px)。線より広く、文字より狭く */
const EDGE_HALO_WIDTH = 5
