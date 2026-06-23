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
  items: NavItem[]
}

// サイドバー（デスクトップ）とモバイルドロワーで共有するナビゲーション項目。
// グループ間には区切り線を入れて「各ページ系」と「作成ジャンプ系」を整理する。
export const NAV_GROUPS: NavGroup[] = [
  // 各ページ系
  {
    items: [
      { href: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'ダッシュボード' },
      { href: '/library', icon: <LibraryBig size={22} />, label: 'ライブラリ' },
      { href: '/items', icon: <GalleryHorizontal size={22} />, label: 'マイカード' },
      { href: '/decks', icon: <Layers size={22} />, label: 'デッキ' },
      { href: '/collections', icon: <Library size={22} />, label: 'コレクション' },
      { href: '/spaces', icon: <Frame size={22} />, label: 'スペース' },
      { href: '/views', icon: <LayoutGrid size={22} />, label: 'ビュー' },
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
