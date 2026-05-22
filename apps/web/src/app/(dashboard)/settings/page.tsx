'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyTab } from './components/CompanyTab'
import { MembersTab } from './components/MembersTab'
import { MaterialsTab } from './components/MaterialsTab'

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">设置</h1>
      <Tabs defaultValue="company">
        <TabsList className="mb-6">
          <TabsTrigger value="company">公司资料</TabsTrigger>
          <TabsTrigger value="members">成员管理</TabsTrigger>
          <TabsTrigger value="materials">物料库</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
