import * as THREE from 'three'
import type { RoomSurface } from '@/types/space'
import { gridStroke, type RoomStyle } from '@/lib/room-style'

// 面から内側へわずかに浮かせて z-fighting を避ける
export const EPS = 0.04

// 部屋の幾何（面の位置・回転・(u,v)変換）。3D 配置ビューとウォークスルーで共有する。
export type Vec3 = [number, number, number]
export type SurfaceDef = {
  size: [number, number]
  position: Vec3
  rotation: Vec3
  offset: Vec3
  pos: (u: number, v: number) => Vec3
  uv: (p: THREE.Vector3) => { u: number; v: number }
}
export type Surfaces = Record<RoomSurface, SurfaceDef>

export const SURFACE_KEYS: RoomSurface[] = ['floor', 'ceiling', 'wall_north', 'wall_south', 'wall_east', 'wall_west']
export const PLACEABLE_3D: RoomSurface[] = ['floor', 'wall_north', 'wall_east', 'wall_south', 'wall_west']
// 面の色は部屋スタイルから引く（2D と共通の定義）
export const surfaceColor = (s: RoomSurface, style: RoomStyle) =>
  s === 'floor' ? style.floor : s === 'ceiling' ? style.ceiling : style.wall
export const noRaycast = () => {}

// 床の 1m グリッド（tex.repeat = 幅×奥行き で寸法に連動）。
export function makeFloorGridTexture(style: RoomStyle): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = style.floor
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = gridStroke(style)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(128, 0)
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 128)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 部屋の寸法(W,H,D)から各面の幾何と (u,v) 変換を作る。v=0 は壁の上端/床の奥。
export function buildSurfaces(W: number, H: number, D: number): Surfaces {
  const HW = W / 2
  const HH = H / 2
  const HD = D / 2
  return {
    floor: {
      size: [W, D],
      position: [0, -HH, 0],
      rotation: [-Math.PI / 2, 0, 0],
      offset: [0, EPS, 0],
      pos: (u, v) => [(u - 0.5) * W, -HH, (v - 0.5) * D],
      uv: (p) => ({ u: p.x / W + 0.5, v: p.z / D + 0.5 }),
    },
    ceiling: {
      size: [W, D],
      position: [0, HH, 0],
      rotation: [Math.PI / 2, 0, 0],
      offset: [0, -EPS, 0],
      pos: (u, v) => [(u - 0.5) * W, HH, (v - 0.5) * D],
      uv: (p) => ({ u: p.x / W + 0.5, v: p.z / D + 0.5 }),
    },
    wall_north: {
      size: [W, H],
      position: [0, 0, -HD],
      rotation: [0, 0, 0],
      offset: [0, 0, EPS],
      pos: (u, v) => [(u - 0.5) * W, (0.5 - v) * H, -HD],
      uv: (p) => ({ u: p.x / W + 0.5, v: 0.5 - p.y / H }),
    },
    wall_south: {
      size: [W, H],
      position: [0, 0, HD],
      rotation: [0, Math.PI, 0],
      offset: [0, 0, -EPS],
      pos: (u, v) => [(0.5 - u) * W, (0.5 - v) * H, HD],
      uv: (p) => ({ u: 0.5 - p.x / W, v: 0.5 - p.y / H }),
    },
    wall_east: {
      size: [D, H],
      position: [HW, 0, 0],
      rotation: [0, -Math.PI / 2, 0],
      offset: [-EPS, 0, 0],
      pos: (u, v) => [HW, (0.5 - v) * H, (u - 0.5) * D],
      uv: (p) => ({ u: p.z / D + 0.5, v: 0.5 - p.y / H }),
    },
    wall_west: {
      size: [D, H],
      position: [-HW, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      offset: [EPS, 0, 0],
      pos: (u, v) => [-HW, (0.5 - v) * H, (0.5 - u) * D],
      uv: (p) => ({ u: 0.5 - p.z / D, v: 0.5 - p.y / H }),
    },
  }
}

