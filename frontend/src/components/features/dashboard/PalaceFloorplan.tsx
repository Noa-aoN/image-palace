'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DoorOpen, Palette, LibraryBig, GraduationCap, House } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// 各部屋のクリック領域（SVG 360×170 に対する％で壁の内側に重ねる）。
type Room = {
  href: string
  label: string
  desc: string
  icon: ReactNode
  rect: { left: string; top: string; width: string; height: string }
  current?: boolean
}

// 左右対称の宮殿平面：左右にライブラリ／スタディ・アトリエ／マイルーム、
// 中央にペリスタイル（列柱中庭）、正面（下）に列柱ポルチコ＝エントランス。
// 部屋の位置は viewBox「0 0 360 158」に対する％。
const ROOMS: Room[] = [
  { href: '/library', label: 'ライブラリ', desc: 'つくった記憶を見返し、整える広間', icon: <LibraryBig size={18} />, rect: { left: '10%', top: '8.9%', width: '24.4%', height: '31.6%' } },
  { href: '/study', label: 'スタディ', desc: 'カードで覚え、思い出す学びの間', icon: <GraduationCap size={18} />, rect: { left: '65.6%', top: '8.9%', width: '24.4%', height: '31.6%' } },
  { href: '/atelier', label: 'アトリエ', desc: '単語をカードや素材に仕立てる工房', icon: <Palette size={18} />, rect: { left: '10%', top: '45.6%', width: '24.4%', height: '31.6%' } },
  { href: '/myroom', label: 'マイルーム', desc: 'アカウント・プラン・環境設定の私室', icon: <House size={18} />, rect: { left: '65.6%', top: '45.6%', width: '24.4%', height: '31.6%' } },
  { href: '/entrance', label: 'エントランス', desc: '情報石碑が立ち並ぶ玄関。ここからすべての場所へ', icon: <DoorOpen size={18} />, rect: { left: '31.7%', top: '81%', width: '36.7%', height: '13.9%' }, current: true },
]

// 壁（ドア／列柱の開口はギャップとして残す）。左右対称。
const WALLS = [
  // 外周（上辺中央は中庭から外へ出る裏口、下辺中央は玄関ポルチコへの開口）
  'M30,10 L160,10', 'M200,10 L330,10', 'M30,10 L30,126', 'M330,10 L330,126',
  'M30,126 L108,126', 'M252,126 L330,126',
  // 左右の間仕切り（x130 / x230・中庭への列柱開口を残す）
  'M130,10 L130,34', 'M130,50 L130,86', 'M130,102 L130,126',
  'M230,10 L230,34', 'M230,50 L230,86', 'M230,102 L230,126',
  // 左右の部屋の上下分割（y68）
  'M30,68 L130,68', 'M230,68 L330,68',
].join(' ')

// 正面ポルチコ（玄関）：枠＋玄関ドアの開口（中央を開けて入口にする）。
// 段差はやめ、他の区切り線と同じ1本の前面ラインにしてシンプルにする。
const PORCH = [
  'M108,126 L108,150', 'M252,126 L252,150',
  'M108,150 L160,150', 'M200,150 L252,150',
].join(' ')

// 基壇（スタイロベート）の縁取り。上辺は裏口の開口ぶんを開ける。
const STYLOBATE = 'M24,6 L160,6 M200,6 L336,6 M24,6 L24,132 M336,6 L336,132'

// 列柱（円形＝柱の断面）。中庭のペリスタイル＋正面ポルチコの2本。
// 裏口（上辺中央）と玄関ドア（下辺中央）の正面は、通り道として柱を置かない。
const COLUMNS: [number, number, number][] = [
  [140, 20, 4], [220, 20, 4], [220, 68, 4],
  [220, 116, 4], [140, 116, 4], [140, 68, 4],
  [134, 143, 5], [226, 143, 5],
]

// エントランスと中庭の間の軽い仕切り（中央はドア開口として残す）。
const PARTITION = 'M130,126 L160,126 M200,126 L230,126'

// 玄関から手前へ伸びる道。奥（上）だけ残して手前へ溶かすフェード。
const ROAD_FADE = 'linear-gradient(to bottom, black 15%, transparent)'

// 道の両脇に等間隔で立つ列柱（道のコンテナ 160×128 に対する座標）。
// 道（幅96・中央＝x32〜128）の縁に乗る位置まで寄せ、玄関からやや下がった位置から並べる。
const ROAD_COLUMNS: [number, number][] = [
  [48, 30], [112, 30],
  [48, 60], [112, 60],
  [48, 90], [112, 90],
  [48, 120], [112, 120],
]

/**
 * 宮殿の「間取り」カード。古代ギリシャの宮殿を思わせる左右対称・横長の平面図。
 * 中央に列柱の中庭（ペリスタイル）、正面に列柱ポルチコ＝エントランスを置き、
 * 各部屋はクリックで遷移、ホバーで下部に軽い説明を表示する。
 */
export function PalaceFloorplan() {
  const [hint, setHint] = useState<string | null>(null)
  // 未ホバー時は、このページ（エントランス）の説明を既定で表示する。
  const current = ROOMS.find((r) => r.current)
  const defaultHint = current ? `${current.label} — ${current.desc}` : ''

  return (
    <Card className="overflow-hidden">
      <CardContent>
        <div className="relative w-full" style={{ aspectRatio: '360 / 158' }}>
          {/* 上辺の開口（壁の切れ目）に重ねて、その先の行き先を示す（スタイルは「現在地」に合わせる） */}
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground"
            style={{ top: `${(10 / 158) * 100}%` }}
          >
            宮殿外へ
          </span>

          <svg viewBox="0 0 360 158" className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} aria-hidden>
            {/* 建物の床（ごく薄く）・現在地（エントランス）のハイライト。中庭は塗らない。 */}
            <rect x={30} y={10} width={300} height={116} fill="rgba(198,167,94,0.035)" />
            <rect x={108} y={126} width={144} height={24} fill="rgba(198,167,94,0.12)" />
            {/* 基壇 */}
            <path d={STYLOBATE} fill="none" stroke="var(--palace)" strokeOpacity={0.3} strokeWidth={1.2} />
            {/* 壁・玄関（上辺中央は外へ抜ける開口） */}
            <path d={WALLS} fill="none" stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="square" />
            <path d={PORCH} fill="none" stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="square" />
            {/* エントランスと中庭の軽い仕切り */}
            <path d={PARTITION} fill="none" stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap="round" />
            {/* 中庭の中央（炉／泉のような装飾）＋ラベル */}
            <circle cx={180} cy={68} r={8} fill="none" stroke="var(--palace)" strokeOpacity={0.55} strokeWidth={1.4} />
            <circle cx={180} cy={68} r={3.2} fill="var(--palace)" fillOpacity={0.4} />
            <text x={180} y={92} textAnchor="middle" fontSize={9} fill="var(--foreground)" fillOpacity={0.45}>中庭</text>
            {/* 列柱 */}
            {COLUMNS.map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(198,167,94,0.5)" stroke="var(--palace)" strokeWidth={1} />
            ))}
          </svg>

          {/* 部屋（クリック領域＋アイコン・名前）。壁の内側に重ねる。 */}
          {ROOMS.map((room) => (
            <Link
              key={room.href}
              href={room.href}
              aria-label={`${room.label}へ`}
              aria-current={room.current ? 'page' : undefined}
              onMouseEnter={() => setHint(`${room.label} — ${room.desc}`)}
              onMouseLeave={() => setHint(null)}
              onFocus={() => setHint(`${room.label} — ${room.desc}`)}
              onBlur={() => setHint(null)}
              style={{ position: 'absolute', ...room.rect }}
              className="group flex flex-col items-center justify-center gap-0.5 rounded-md text-center transition-colors hover:bg-[rgba(198,167,94,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
            >
              <span style={{ color: 'var(--palace)' }}>{room.icon}</span>
              <span className="text-sm font-medium leading-tight">{room.label}</span>
              {room.current && <span className="text-[10px] font-medium text-muted-foreground">現在地</span>}
            </Link>
          ))}
        </div>

        {/* エントランスのドアの下：LPの道を平面のまま小さく朧げに（LPからの繋がりを意識させる）。
            道の左右に列柱を立て、その上に説明の吹き出しと操作ヒントを重ねる。 */}
        <div className="relative -mt-1 h-32 w-full">
          <div className="absolute left-1/2 top-0 h-full w-40 -translate-x-1/2" aria-hidden>
            {/* 道：road.png を repeat-y でループさせ、以前の2倍の長さ（128px）に伸ばす */}
            <div
              className="absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 opacity-30"
              style={{
                backgroundImage: "url('/road.png')",
                backgroundRepeat: 'repeat-y',
                // 1タイルを縦に詰めて、短い距離でも道の模様が2回ちかく繰り返すようにする
                // （road.png は上下端が繋がるので、縦に潰しても継ぎ目は出ない）
                backgroundSize: '96px 72px',
                backgroundPosition: 'center top',
                WebkitMaskImage: ROAD_FADE,
                maskImage: ROAD_FADE,
              }}
            />
            {/* 道の両脇に等間隔で立つ列柱（朧げさは道に合わせる） */}
            <svg
              viewBox="0 0 160 128"
              className="absolute inset-0 h-full w-full opacity-30"
              style={{ WebkitMaskImage: ROAD_FADE, maskImage: ROAD_FADE }}
            >
              {/* 半径は間取り図の中庭の列柱（r=4／viewBox 360幅）と同じ見た目になるよう合わせる */}
              {ROAD_COLUMNS.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={6.5} fill="rgba(198,167,94,0.5)" stroke="var(--palace)" strokeWidth={1.6} />
              ))}
            </svg>
          </div>

          {/* 道の上に重ねる：説明の吹き出し（既定＝エントランス、ホバーで各部屋。
              上向きのしっぽで間取り図を指す）と操作ヒント */}
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center px-2">
            <div className="relative rounded-lg border border-border bg-background/80 px-3 py-1 text-center text-xs text-muted-foreground backdrop-blur-sm">
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-border bg-background/80" />
              {hint ?? defaultHint}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
              各部屋にカーソルを合わせると説明、クリックでその場所へ
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
