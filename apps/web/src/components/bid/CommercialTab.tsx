'use client'
// apps/web/src/components/bid/CommercialTab.tsx
import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card } from '../ui/card'
import { bidApi, type BidCommercialData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function CommercialTab({ bidId }: Props) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { register, control, handleSubmit, reset } = useForm<BidCommercialData>({
    defaultValues: { licenses: [], keyPersonnel: [], pastProjects: [] },
  })
  const { fields: licenses, append: addLicense, remove: removeLicense } =
    useFieldArray({ control, name: 'licenses' })
  const { fields: personnel, append: addPersonnel, remove: removePersonnel } =
    useFieldArray({ control, name: 'keyPersonnel' })
  const { fields: projects, append: addProject, remove: removeProject } =
    useFieldArray({ control, name: 'pastProjects' })

  useEffect(() => {
    bidApi.getCommercial(bidId)
      .then((res) => { if (res.data.data) reset(res.data.data) })
      .catch(() => {})
  }, [bidId, reset])

  async function onSubmit(data: BidCommercialData) {
    setSaving(true)
    try {
      await bidApi.updateCommercial(bidId, data)
      toast({ title: '商务标已保存' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 max-w-3xl">
      {/* 公司基本信息 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">公司基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>公司名称</Label>
            <Input {...register('companyName')} placeholder="ABC 装修工程有限公司" />
          </div>
          <div>
            <Label>营业执照号</Label>
            <Input {...register('registrationNo')} placeholder="12345678" />
          </div>
        </div>
        <div>
          <Label>公司简介</Label>
          <Textarea {...register('companyProfile')} rows={4} placeholder="公司简介..." />
        </div>
      </Card>

      {/* 资质证书 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">资质证书</h3>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => addLicense({ name: '', no: '', expiresAt: '' })}>
            + 添加证书
          </Button>
        </div>
        {licenses.map((field, idx) => (
          <div key={field.id} className="flex gap-2 items-start">
            <Input {...register(`licenses.${idx}.name`)} placeholder="证书名称" />
            <Input {...register(`licenses.${idx}.no`)} placeholder="证书编号" />
            <Input {...register(`licenses.${idx}.expiresAt`)} placeholder="有效期 YYYY-MM-DD" className="w-40" />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeLicense(idx)}>删除</Button>
          </div>
        ))}
        {licenses.length === 0 && (
          <p className="text-sm text-gray-400">暂无证书，点击「添加证书」</p>
        )}
      </Card>

      {/* 关键人员 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">关键人员</h3>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => addPersonnel({ name: '', title: '', certificate: '', yearsExp: 0, role: '' })}>
            + 添加人员
          </Button>
        </div>
        {personnel.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-5 gap-2 items-start">
            <Input {...register(`keyPersonnel.${idx}.name`)} placeholder="姓名" />
            <Input {...register(`keyPersonnel.${idx}.title`)} placeholder="职位" />
            <Input {...register(`keyPersonnel.${idx}.certificate`)} placeholder="资质证书" />
            <Input {...register(`keyPersonnel.${idx}.role`)} placeholder="项目角色" />
            <Button type="button" variant="ghost" size="sm" onClick={() => removePersonnel(idx)}>删除</Button>
          </div>
        ))}
        {personnel.length === 0 && (
          <p className="text-sm text-gray-400">暂无人员，点击「添加人员」</p>
        )}
      </Card>

      {/* 业绩案例 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">业绩案例</h3>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => addProject({ title: '', client: '', contractAmount: 0, completedAt: '', description: '' })}>
            + 添加业绩
          </Button>
        </div>
        {projects.map((field, idx) => (
          <div key={field.id} className="space-y-2 border rounded p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input {...register(`pastProjects.${idx}.title`)} placeholder="项目名称" />
              <Input {...register(`pastProjects.${idx}.client`)} placeholder="业主" />
              <Input {...register(`pastProjects.${idx}.completedAt`)} placeholder="完工日期 YYYY-MM-DD" />
            </div>
            <Textarea {...register(`pastProjects.${idx}.description`)} placeholder="项目描述" rows={2} />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeProject(idx)}>删除</Button>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-gray-400">暂无业绩，点击「添加业绩」</p>
        )}
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存商务标'}
      </Button>
    </form>
  )
}
