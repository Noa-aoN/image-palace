import test from 'node:test'
import assert from 'node:assert/strict'

import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, PRIVATE_PATHS } from '../src/lib/site.ts'

// 公開してインデックスさせたいパス。PRIVATE_PATHS に混入していないことを保証する。
const PUBLIC_PATHS = ['/', '/login', '/signup', '/privacy', '/terms']

test('SITE_URL は絶対 https URL である', () => {
  assert.match(SITE_URL, /^https:\/\//)
  // 末尾スラッシュなし（sitemap/robots で `${SITE_URL}${path}` 連結するため）
  assert.equal(SITE_URL.endsWith('/'), false)
})

test('SITE_NAME / SITE_DESCRIPTION が設定されている', () => {
  assert.equal(SITE_NAME, 'ImagePalace')
  assert.ok(SITE_DESCRIPTION.length > 0)
})

test('PRIVATE_PATHS は全て先頭スラッシュ始まり', () => {
  for (const path of PRIVATE_PATHS) {
    assert.match(path, /^\//, `${path} should start with /`)
  }
})

test('PRIVATE_PATHS に公開ページが混入していない', () => {
  for (const publicPath of PUBLIC_PATHS) {
    assert.ok(
      !PRIVATE_PATHS.includes(publicPath),
      `${publicPath} は公開ページなので Disallow してはいけない`
    )
  }
})

test('認証が必要な主要画面は PRIVATE_PATHS に含まれる', () => {
  for (const required of ['/dashboard', '/items', '/account', '/billing']) {
    assert.ok(PRIVATE_PATHS.includes(required), `${required} は Disallow 対象であるべき`)
  }
})
