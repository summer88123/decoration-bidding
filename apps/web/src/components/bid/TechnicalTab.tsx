'use client'
// apps/web/src/components/bid/TechnicalTab.tsx
import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card } from '../ui/card'
import { bidApi, type BidTechnicalData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function TechnicalTab({ bidId }: Props) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { register, control, handleSubmit, reset } = useForm<BidTechnicalData>({
    defaultValues: { milestonePlan: [] },
  })
  const { fields: milestones, append: addMilestone, remove: removeMilestone } =
    useFieldArray({ control, name: 'milestonePlan' })

  useEffect(() => {
    bidApi.getTechnical(bidId)
      .then((res) => { if (res.data.data) reset(res.data.data) })
      .catch(() => {})
  }, [bidId, reset])

  async function onSubmit(data: BidTechnicalData) {
    setSaving(true)
    try {
      await bidApi.updateTechnical(bidId, data)
      toast({ title: '技术标已保存' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 max-w-3xl">
      {/* 施工方案 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">施工方案</h3>
        <div>
          <Label>施工方法描述</Label>
          <Textarea {...register('constructionMethod')} rows={5}
            placeholder="描述主要施工方法、特殊工艺..." />
        </div>
        <div>
          <Label>现场管理方案</Label>
          <Textarea {...register('siteManagement')} rows={4}
            placeholder="现场管理方式、封闭施工措施..." />
        </div>
      </Card>

      {/* 工期计划 */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-gray-900">工期计划</h3>
        <div className="w-32">
          <Label>总工期（天）</Label>
          <Input {...register('durationDays', { valueAsNumber: true })} type="number" min={1} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>里程碑节点</Label>
            <Button type="button" variant="secondary" size="sm"
              onClick={() => addMilestone({ phase: '', startDay: 1, endDay: 7 })}>
              + 添加里程碑
            </Button>
          </div>
          {milestones.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-center mb-2">
              <Input {...register(`milestonePlan.${idx}.phase`)} placeholder="阶段名称" className="flex-1" />
              <Input {...register(`milestonePlan.${idx}.startDay`, { valueAsNumber: true })}
                type="number" placeholder="开始天" className="w-24" />
              <Input {...register(`milestonePlan.${idx}.endDay`, { valueAsNumber: true })}
                type="number" placeholder="结束天" className="w-24" />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeMilestone(idx)}>删除</Button>
            </div>
          ))}
          {milestones.length === 0 && (
            <p className="text-sm text-gray-400">暂无里程碑，点击「添加里程碑」</p>
          )}
        </div>
      </Card>

      {/* 安全与质量 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">安全与质量管理</h3>
        <div>
          <Label>安全措施</Label>
          <Textarea {...register('safetyMeasures')} rows={4}
            placeholder="安全管理措施、合规要求..." />
        </div>
        <div>
          <Label>质量控制方案</Label>
          <Textarea {...register('qualityControl')} rows={4}
            placeholder="质量检验流程、验收标准..." />
        </div>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存技术标'}
      </Button>
    </form>
  )
}
