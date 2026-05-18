/**
 * Skill Registry - 8 个 AI Skill 的注册表
 * 每个 Skill 对应规格书 3.2 节的定义
 */

export type SkillName =
  | 'match-tender'      // Skill 1: 标书配对
  | 'generate-remark'   // Skill 2: 备注生成
  | 'risk-assessment'   // Skill 3: 风险评估
  | 'price-analysis'    // Skill 4: 价格分析
  | 'parse-drawing'     // Skill 5: 图纸解析
  | 'generate-bid'      // Skill 6: 标书生成
  | 'review-bid'        // Skill 7: 标书审查
  | 'bim-analysis'      // Skill 8: IFC/BIM 分析

export interface SkillDefinition {
  name: SkillName
  description: string
  inputSchema: Record<string, unknown>
  ragDomains: string[]
}

export const SKILL_REGISTRY: Record<SkillName, SkillDefinition> = {
  'match-tender': {
    name: 'match-tender',
    description: '标书配对 - 计算招标公告与公司能力的匹配度评分',
    inputSchema: {},
    ragDomains: ['historical-bids', 'match-records'],
  },
  'generate-remark': {
    name: 'generate-remark',
    description: '备注生成 - 根据标书条款生成专业备注文本',
    inputSchema: {},
    ragDomains: ['technical-solutions', 'historical-bids'],
  },
  'risk-assessment': {
    name: 'risk-assessment',
    description: '风险评估 - 扫描招标文件识别风险条款',
    inputSchema: {},
    ragDomains: ['tender-specs', 'industry-standards'],
  },
  'price-analysis': {
    name: 'price-analysis',
    description: '价格分析 - 基于历史报价提供定价建议',
    inputSchema: {},
    ragDomains: ['material-prices', 'historical-bids'],
  },
  'parse-drawing': {
    name: 'parse-drawing',
    description: '图纸解析 - 关联图纸与项目清单',
    inputSchema: {},
    ragDomains: ['drawing-mappings'],
  },
  'generate-bid': {
    name: 'generate-bid',
    description: '标书生成 - 自动生成完整标书 PDF',
    inputSchema: {},
    ragDomains: ['historical-bids', 'technical-solutions'],
  },
  'review-bid': {
    name: 'review-bid',
    description: '标书审查 - 完整性、一致性、合规性检查',
    inputSchema: {},
    ragDomains: ['tender-specs', 'scoring-criteria'],
  },
  'bim-analysis': {
    name: 'bim-analysis',
    description: 'IFC/BIM 分析 - 模型合规检查与 BOQ 提取',
    inputSchema: {},
    ragDomains: ['bim-standards', 'historical-ifc'],
  },
}
