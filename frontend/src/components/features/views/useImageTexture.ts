'use client'

import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * 画像 URL を WebGL テクスチャとして読み込む。
 *
 * TextureLoader に直接 URL を渡すと `crossOrigin=anonymous` の CORS 取得になり、
 * 同じ画像を 2D の <img>（CORS なし）が先に読んでいると、キャッシュのモード不一致で
 * 失敗し続けることがある（サーバーが CORS ヘッダーを返していても直らない）。
 * そこで fetch でバイト列を取り、blob から直接テクスチャを作る。
 *
 * 重さ対策:
 * - URL 単位でテクスチャを共有する（同じ画像を点ごと・2D/3D 切替のたびに取り直さない）
 * - 大きな画像は MAX_TEXTURE_PX まで縮小してから GPU に載せる
 */
const MAX_TEXTURE_PX = 512
// 同時に保持するテクスチャ数の上限。超えたら古いものから破棄する
const CACHE_LIMIT = 60

const cache = new Map<string, Promise<THREE.Texture | null>>()

function touch(url: string, entry: Promise<THREE.Texture | null>) {
  cache.delete(url)
  cache.set(url, entry)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest) {
      const dropped = cache.get(oldest)
      cache.delete(oldest)
      dropped?.then((t) => t?.dispose()).catch(() => {})
    }
  }
}

/** 大きすぎる画像は縮小する。点マーカーは小さく表示されるので原寸は要らない */
function toTexture(bitmap: ImageBitmap): THREE.Texture {
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= MAX_TEXTURE_PX) {
    const tex = new THREE.Texture(bitmap)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }
  const scale = MAX_TEXTURE_PX / longest
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function load(url: string): Promise<THREE.Texture | null> {
  const hit = cache.get(url)
  if (hit) {
    touch(url, hit)
    return hit
  }
  const entry = (async () => {
    try {
      // CORS ヘッダーを持たない古いキャッシュを掴んでいると失敗するため、その場合だけ取り直す
      let res: Response
      try {
        res = await fetch(url, { mode: 'cors', credentials: 'omit' })
      } catch {
        res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'reload' })
      }
      if (!res.ok) {
        console.warn('[room] 画像を取得できませんでした', { url, status: res.status })
        return null
      }
      return toTexture(await createImageBitmap(await res.blob()))
    } catch (e) {
      // 取得できない画像はフォールバック色のまま表示する（描画は止めない）
      console.warn('[room] 画像をテクスチャにできませんでした', { url, error: e })
      return null
    }
  })()
  touch(url, entry)
  return entry
}

export function useImageTexture(url: string | null): THREE.Texture | null {
  // URL とセットで持ち、切り替え直後に前の画像が残らないようにする
  const [loaded, setLoaded] = useState<{ url: string; tex: THREE.Texture } | null>(null)

  useEffect(() => {
    if (!url) return
    let alive = true
    load(url)
      .then((tex) => {
        if (alive && tex) setLoaded({ url, tex })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // テクスチャはキャッシュが保持するのでここでは破棄しない（他の点と共有している）
  }, [url])

  return loaded && loaded.url === url ? loaded.tex : null
}
