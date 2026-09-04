'use client'

import {
  createContext,
  memo,
  useContext,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
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
  insertIndexFor,
  pointAtFraction,
  DEFAULT_CURVE_RADIUS,
} from '@/lib/edge-path'

// 折れ点の確定保存はボード側（FreeboardCanvas）へ委譲する（data に関数を入れず lint 回避）。
export const EdgeActionsContext = createContext<{
  commitPoints: (edgeId: string, points: EdgePoint[]) => void
  /**
   * 線の途中から、3つ目の端を引き出す。
   *
   * **線と線をつなぐのではなく、線の上に点を置いて、そこから新しい線を引く。**
   * 両親から子へ1本にまとめる、といった図はこれで描ける。
   * 点は盤の上のものとして持つので、動かす・消す・戻すが既にある仕組みで効く
   */
  branchFrom: (at: EdgePoint, targetNodeId: string) => void
  /** 二重線の内側に敷く色。盤の色を渡す（線を2本描く代わりに、真ん中を盤の色で抜く） */
  boardBg: string
}>({
  commitPoints: () => {},
  branchFrom: () => {},
  boardBg: 'var(--board-bg)',
})

type EditableEdgeData = { edgeStyle?: ViewEdgeStyle; label?: string | null; points?: EdgePoint[] }

function EditableEdgeComponent(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerStart, markerEnd, style } = props
  const d = (props.data ?? {}) as EditableEdgeData
  const s = d.edgeStyle ?? {}
  const label = d.label
  const points = d.points ?? []
  // 近づいたときにも操作点を出す。選ぶ→出る、だと**まず選ぶ手間が要る**
  const [hovered, setHovered] = useState(false)

  const { screenToFlowPosition, setEdges } = useReactFlow()
  // 盤の拡大率。**説明の大きさを打ち消す**のに使う（盤ごと縮めると読めなくなる）
  const zoom = useStore((state) => state.transform[2])
  const { commitPoints, branchFrom, boardBg } = useContext(EdgeActionsContext)
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

  /**
   * 折れ点を足す。掴んだ場所に置いて、そのままドラッグへ移る。
   *
   * **どこへ挿すかは、線に沿った位置で決める。**
   * 描かれている頂点の番号で数えていた頃は、助走と直角の角のぶんだけ
   * 番号がずれて、掴んだ場所と違うところに折れ点ができていた。
   */
  const addPointAt = (client: { clientX: number; clientY: number }) => {
    const fp = screenToFlowPosition({ x: client.clientX, y: client.clientY })
    const at = { x: Math.round(fp.x), y: Math.round(fp.y) }
    const index = insertIndexFor(verts, points, at)
    const inserted = [...points]
    inserted.splice(index, 0, at)
    return { index, inserted }
  }

  const startInsert = () => (ev: ReactPointerEvent) => {
    const { index, inserted } = addPointAt(ev)
    writeLocal(inserted)
    // **押しただけでも残す。** 動かさなければ保存されず、
    // 離した瞬間に消えていた（置いたつもりのものが無くなる）
    commitPoints(id, inserted)
    startMove(index, inserted)(ev)
  }

  // 線をダブルクリックしても折れ点が置ける。**掴む的を狙わなくてよい**
  const insertOnPath = (ev: ReactMouseEvent) => {
    ev.stopPropagation()
    const { inserted } = addPointAt(ev)
    writeLocal(inserted)
    commitPoints(id, inserted)
  }

  /**
   * 線の途中から、3つ目の端を引き出す。
   *
   * **折れ点とは別のもの。** 折れ点は線の形を変えるためのもので、
   * こちらは**新しい線をここから生やす**ためのもの。
   * 見た目も三角にして、丸（点）・四角（折れ点）と混ざらないようにする。
   *
   * 引いている間は行き先までの線を見せ、離した所にカードや図形があれば繋ぐ。
   * 何も無い所で離したときは、**何も起きない**（宙に浮いた点を残さない）。
   */
  const [branch, setBranch] = useState<{ from: EdgePoint; to: EdgePoint } | null>(null)

  const startBranch = (at: EdgePoint) => (ev: ReactPointerEvent) => {
    if (ev.button !== 0) return
    ev.stopPropagation()
    setBranch({ from: at, to: at })

    const move = (e: PointerEvent) => {
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setBranch({ from: at, to: { x: fp.x, y: fp.y } })
    }
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setBranch(null)

      // 離した所にあるものを探す。**カードでも図形でもよい**
      const under = document.elementFromPoint(e.clientX, e.clientY)
      const targetId = under?.closest('.react-flow__node')?.getAttribute('data-id')
      if (targetId) branchFrom(at, targetId)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /**
   * 線そのものを引く。
   *
   * 掴んだ場所に折れ点を作って、そのまま引きずる。
   * **点を狙わなくても、線を掴めば曲げられる。**
   *
   * 引かずに離したときは、作った折れ点を捨てる。
   * ちょっと触っただけで折れ点が増えるのは、掴んだつもりの人には邪魔にしかならない
   */
  const dragFromPath = (ev: ReactPointerEvent) => {
    if (ev.button !== 0) return

    const { index, inserted } = addPointAt(ev)
    writeLocal(inserted)

    const before = points
    moved.current = false
    const move = (e: PointerEvent) => {
      moved.current = true
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      writeLocal(inserted.map((p, i) => (i === index ? { x: Math.round(fp.x), y: Math.round(fp.y) } : p)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (moved.current) {
        commitPoints(id, latest.current)
      } else {
        // 引かなかった＝掴んだだけ。**増やさずに戻す**
        writeLocal(before)
      }
    }
    ev.stopPropagation()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
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
      {/* 引き出している間の下書き。**離す前に、どこへ繋がるかを見せる** */}
      {branch && (
        <line
          x1={branch.from.x}
          y1={branch.from.y}
          x2={branch.to.x}
          y2={branch.to.y}
          stroke="var(--palace)"
          strokeWidth={2}
          strokeDasharray="6 4"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/*
        掴むための、見えない太い線。**線そのものは細いので、狙って当てにくい。**

        **線を直接引けるようにする。** これまでは点を狙って掴むしかなく、
        「この線をここまでずらしたい」と思っても、まず折れ点を作る手が要った。
        線を引いた場所に折れ点ができて、そのまま付いてくる——
        図を描く道具（draw.io / Lucidchart）が共通してそうしている。

        ダブルクリックでも置ける（引かずに、その場に1つだけ足したいとき）
      */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth + 12, 16)}
        onPointerDown={dragFromPath}
        onDoubleClick={insertOnPath}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'grab', pointerEvents: 'stroke' }}
      />
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

        {(selected || hovered) && (
          <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            {/*
              線の上の点を、**役割ごとに違う形**にする。

              同じ丸で描いていた頃は、押してみるまで何が起きるか分からなかった。
              図を描く道具（Figma / draw.io / yEd）が共通して使い分けている形に合わせる。

                足せる場所 … 破線の縁・半透明。**まだ何も無い**ことを形で示す
                折り曲げ点 … 白抜き（中が盤の色）。**掴んで動かせる**
                終端       … 塗りつぶし。**相手に刺さっている**
            */}
            {verts.slice(0, -1).map((v, i) => {
              const n = verts[i + 1]
              const mx = (v.x + n.x) / 2
              const my = (v.y + n.y) / 2
              // **短い区間には出さない。** カードから出る助走は 28px しかないので、
              // そこに候補を出しても、置けるのはカードの縁のすぐ横。
              // 狙う的だけが増えて、本当に曲げたい所が押しにくくなる
              if (Math.hypot(n.x - v.x, n.y - v.y) < MIN_SEGMENT_FOR_GHOST) return null
              return (
                <ControlPoint
                  key={`g${i}`}
                  x={mx}
                  y={my}
                  kind="add"
                  hint="押すとここに折れ点ができます（そのまま引くと位置も決まります）"
                  zoom={zoom}
                  onPointerDown={startInsert()}
                />
              )
            })}

            {/* 折り曲げ点。**四角**にして、動かせることを形で示す */}
            {points.map((p, i) => (
              <ControlPoint
                key={`w${i}`}
                x={p.x}
                y={p.y}
                kind="bend"
                hint="引いて動かす／2回押すと消えます"
                zoom={zoom}
                onPointerDown={startMove(i, points)}
                onDoubleClick={removeAt(i)}
              />
            ))}

            {/*
              3つ目の端を引き出す印。**三角**にして、丸（終端）・四角（折れ点）と
              混ざらないようにする。引くと、そこに接合点ができて新しい線が生える
            */}
            {verts.slice(0, -1).map((v, i) => {
              const n = verts[i + 1]
              if (Math.hypot(n.x - v.x, n.y - v.y) < MIN_SEGMENT_FOR_BRANCH) return null

              // 折れ点の候補（真ん中）と重ならないよう、少し先へ置く
              const at = { x: v.x + (n.x - v.x) * 0.72, y: v.y + (n.y - v.y) * 0.72 }
              return (
                <ControlPoint
                  key={`b${i}`}
                  x={at.x}
                  y={at.y}
                  kind="branch"
                  hint="引くと、ここから新しい線が生えます（相手の上で離す）"
                  zoom={zoom}
                  onPointerDown={startBranch(at)}
                />
              )
            })}

            {/* 終端。**線に関わる点なので、接合点と同じ色**にする */}
            {[ verts[0], verts[verts.length - 1] ].map((p, i) => (
              <ControlPoint
                key={`e${i}`}
                x={p.x}
                y={p.y}
                kind="end"
                hint={i === 0 ? 'ここから出ています' : 'ここへ着いています'}
                zoom={zoom}
              />
                        ))}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

/**
 * 線の上の操作点。
 *
 * ## 3つを、形と色で見分ける
 *
 * 同じ丸で描いていた頃は、押してみるまで何が起きるか分からなかった。
 * 図を描く道具（Figma / draw.io / yEd）が共通して使い分けている作法に合わせる。
 *
 * | | 形 | 色 | 意味 |
 * |---|---|---|---|
 * | 足せる場所 | 小さい丸・破線の縁 | 薄い | まだ何も無い |
 * | 折り曲げ点 | **四角** | 濃い | 掴んで動かせる |
 * | 終端 | 丸・塗りつぶし | **線の色** | 相手に刺さっている |
 *
 * **終端と接合点は同じ色**にする。どちらも「線がどこに関わっているか」を示すもので、
 * 折り曲げ点（形を変えるためのもの）とは役割が違う。
 *
 * 説明は近づいたときに出す。形だけでは、初めての人には読めない。
 */
type ControlKind = 'add' | 'bend' | 'end' | 'branch'

/**
 * 点の大きさは**3つとも同じ**にする。
 *
 * 大きさが違うと「大きいほうが大事」と読まれる。だが3つは重さの違いではなく
 * 役割の違いなので、**形と色だけで見分ける**のが正しい。
 */
const CONTROL_SIZE = 11
/**
 * 掴める範囲。**見た目より大きく取る。**
 * 点を大きくすると図が点だらけに見えるので、当たり判定だけ広げる
 */
const CONTROL_HIT_SIZE = 22

/**
 * 折れ点の候補を出す、区間の最短の長さ。
 *
 * 助走（`EDGE_STUB` = 28）より長くする。助走の途中に候補を出しても、
 * 置けるのはカードの縁のすぐ横で、曲げる意味がほとんど無い
 */
const MIN_SEGMENT_FOR_GHOST = 44

/**
 * 点の名前。説明は「**名前：何ができるか**」の形で出す。
 * 説明文だけだと、いま触っているのが何なのかが分からないまま操作を読むことになる
 */
const CONTROL_NAMES: Record<ControlKind, string> = {
  add: '折れ点を足す',
  bend: '折れ点',
  end: '終端',
  branch: '枝分かれ',
}

/**
 * 枝分かれの印を出す、区間の最短の長さ。
 * 折れ点の候補より長い区間にだけ出す（短い線に印が2つ並ぶと、どちらも押しにくい）
 */
const MIN_SEGMENT_FOR_BRANCH = 96

const CONTROL_LOOKS: Record<ControlKind, React.CSSProperties> = {
  add: {
    borderRadius: '50%',
    border: '1.5px dashed var(--palace)',
    background: 'var(--board-bg)',
    opacity: 0.7,
    cursor: 'crosshair',
  },
  // 四角にすると、丸（点）と役割が違うことが形だけで伝わる
  bend: {
    borderRadius: 3,
    border: '2.5px solid var(--palace)',
    background: 'var(--board-bg)',
    cursor: 'grab',
  },
  end: {
    borderRadius: '50%',
    background: 'var(--palace)',
    border: '2px solid var(--board-bg)',
    // 終端は見た目だけ。つなぎ替えは React Flow の受け持ち
    pointerEvents: 'none',
  },
  // **三角**。丸（端）とも四角（折れ点）とも違うことを、形だけで伝える
  branch: {
    background: 'var(--palace)',
    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
    cursor: 'copy',
  },
}

function ControlPoint({
  x,
  y,
  kind,
  hint,
  zoom,
  onPointerDown,
  onDoubleClick,
}: {
  x: number
  y: number
  kind: ControlKind
  /** 何をする点かの一言。**名前は kind から引く**（言い方をばらけさせない） */
  hint: string
  /** 盤の拡大率。**説明の大きさを打ち消す**のに使う */
  zoom: number
  onPointerDown?: (event: ReactPointerEvent) => void
  onDoubleClick?: (event: ReactMouseEvent) => void
}) {
  const [near, setNear] = useState(false)

  return (
    <div
      className="nodrag nopan"
      style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
    >
      {/*
        **掴む的を、見た目より大きく取る。**

        11px の点をそのまま的にしていたので、狙って当てるのに手間がかかった。
        点は小さいままにして（大きくすると図が点だらけに見える）、
        当たり判定だけ広げる。透明な余白は見えないが、確かに掴める
      */}
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setNear(true)}
        onMouseLeave={() => setNear(false)}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: CONTROL_HIT_SIZE,
          height: CONTROL_HIT_SIZE,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'all',
          cursor: CONTROL_LOOKS[kind].cursor,
          // 掴める範囲そのものは見せない（見せると点が大きく見える）
          background: 'transparent',
        }}
      />
      {/* 見える点。**近づいたら少しだけ大きくする**（掴めることが伝わる） */}
      <div
        style={{
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          transition: 'transform 120ms ease',
          transform: near ? 'scale(1.35)' : 'scale(1)',
          ...CONTROL_LOOKS[kind],
        }}
      />
      {/*
        近づいたときだけ説明を出す。常に出すと、点の数だけ文字が散らかる。

        **盤の縮尺に合わせない。** 盤ごと縮めると、遠くを見ているときほど
        説明が小さくなって読めない。読ませるための文字なので、
        いつでも同じ大きさで出す（拡大率の逆数を掛けて打ち消す）
      */}
      {near && (
        <span
          className="pointer-events-none absolute left-1/2 top-full whitespace-nowrap rounded px-1.5 py-0.5"
          style={{
            background: 'var(--foreground)',
            color: 'var(--background)',
            fontSize: 11,
            transform: `translate(-50%, 4px) scale(${1 / zoom})`,
            transformOrigin: 'top center',
          }}
        >
          <strong style={{ fontWeight: 600 }}>{CONTROL_NAMES[kind]}</strong>
          {`：${hint}`}
        </span>
      )}
    </div>
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
