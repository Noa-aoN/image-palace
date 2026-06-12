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
} from 'lucide-react'

export interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

// サイドバー（デスクトップ）とモバイルドロワーで共有するナビゲーション項目
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'ダッシュボード' },
  { href: '/items', icon: <GalleryHorizontal size={22} />, label: 'マイカード' },
  { href: '/library', icon: <LibraryBig size={22} />, label: 'ライブラリ' },
  { href: '/decks', icon: <Library size={22} />, label: 'デッキ' },
  { href: '/collections', icon: <Layers size={22} />, label: 'コレクション' },
  { href: '/spaces', icon: <LayoutGrid size={22} />, label: 'スペース' },
  { href: '/views', icon: <Frame size={22} />, label: 'ビュー' },
  { href: '/tags', icon: <Tag size={22} />, label: 'タグ' },
  { href: '/items/new', icon: <Plus size={22} />, label: 'カードを作成' },
]
