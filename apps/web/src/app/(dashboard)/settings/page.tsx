'use client'

import { useState } from 'react'
import { CompanyTab } from './components/CompanyTab'
import { MembersTab } from './components/MembersTab'
import { MaterialsTab } from './components/MaterialsTab'
import { DangerTab } from './components/DangerTab'

type TabId = 'company' | 'members' | 'materials' | 'danger'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'company',   label: '公司信息',  icon: '🏢' },
  { id: 'members',   label: '成员管理',  icon: '👥' },
  { id: 'materials', label: '物料资料库', icon: '📦' },
  { id: 'danger',    label: '危险操作',  icon: '⚠' },
]

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>('company')

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <div className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-xl font-semibold text-fg">组织设置</h1>
        <p className="text-[13px] text-muted mt-0.5">管理公司信息、成员权限和物料资料库</p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidenav */}
        <aside className="w-[220px] border-r border-border bg-surface py-4 shrink-0">
          <div className="px-4 pb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
            设置
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="w-full flex items-center gap-2 px-4 py-[7px] text-[13px] text-left transition-colors"
              style={{
                background: active === tab.id ? '#ddf4ff' : 'transparent',
                color: active === tab.id ? '#0969da' : '#1f2328',
                fontWeight: active === tab.id ? 500 : 400,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 max-w-[760px]">
          {active === 'company'   && <CompanyTab />}
          {active === 'members'   && <MembersTab />}
          {active === 'materials' && <MaterialsTab />}
          {active === 'danger'    && <DangerTab />}
        </main>
      </div>
    </div>
  )
}
