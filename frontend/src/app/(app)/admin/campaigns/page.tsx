'use client'

import { AdminCampaignCodesPanel } from '@/components/features/admin/AdminCampaignCodesPanel'

// 引き換えコードの発行と成績
export default function AdminCampaignsPage() {
  return (
    <div className="space-y-8">
      <AdminCampaignCodesPanel />
    </div>
  )
}
