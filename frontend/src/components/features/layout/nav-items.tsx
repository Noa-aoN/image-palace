import {
  LayoutDashboard,
  GalleryHorizontal,
  LibraryBig,
  Library,
  Layers,
  LayoutGrid,
  Frame,
  Tag,
  Plus,
  CreditCard,
} from 'lucide-react'

export interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

export interface NavGroup {
  // セクション見出し（任意）。あれば区切り線の代わりに小見出しを表示する。
  label?: string
  items: NavItem[]
}

// サイドバー（デスクトップ）とモバイルドロワーで共有するナビゲーション項目。
// ライブラリの階層（カード/コレクション ┃ ビュー[デッキ/ビュー] ┃ スペース）を
// セクション見出しで表現する。
export const NAV_GROUPS: NavGroup[] = [
  // トップ（見出しなし）
  {
    items: [
      { href: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'ダッシュボード' },
      { href: '/library', icon: <LibraryBig size={22} />, label: 'ライブラリ' },
    ],
  },
  // ライブラリ系
  {
    label: 'ライブラリ',
    items: [
      { href: '/items', icon: <GalleryHorizontal size={22} />, label: 'カード' },
      { href: '/collections', icon: <Library size={22} />, label: 'コレクション' },
    ],
  },
  // ビュー系（表示・学習形式）
  {
    label: 'ビュー',
    items: [
      { href: '/decks', icon: <Layers size={22} />, label: 'デッキ' },
      { href: '/views', icon: <LayoutGrid size={22} />, label: 'ビュー' },
    ],
  },
  // スペース系（記憶の空間）
  {
    label: 'スペース',
    items: [
      { href: '/spaces', icon: <Frame size={22} />, label: 'スペース' },
    ],
  },
  // その他
  {
    items: [
      { href: '/tags', icon: <Tag size={22} />, label: 'タグ' },
    ],
  },
  // 作成ジャンプ系
  {
    items: [
      { href: '/items/new', icon: <Plus size={22} />, label: 'カードを作成' },
    ],
  },
  // アカウント系
  {
    items: [
      { href: '/billing', icon: <CreditCard size={22} />, label: 'プラン' },
    ],
  },
]
