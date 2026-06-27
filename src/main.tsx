import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme
} from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { TableColumnsType } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './styles.css';

const { Text, Title } = Typography;

type SkillValue = '7' | '10' | '17.5' | '25' | '140' | 'custom';
type SourceBucket = 'outside' | 'inside' | 'final' | 'vulnerability' | 'overclock' | 'crit' | 'leader' | 'info';
type SourceInputKind = 'count' | 'stacks' | 'stars';

interface SkillOption {
  label: string;
  value: SkillValue;
  name: string;
  coeff: number;
}

interface UnitOption {
  label: string;
  value: number;
}

interface SourceInput {
  label: string;
  kind: SourceInputKind;
  min: number;
  max: number;
  defaultValue: number;
  suffix?: string;
  options?: Array<{
    value: number;
    label: string;
    description: string;
  }>;
}

interface Contribution {
  bucket: SourceBucket;
  label: string;
  value?: number;
  text?: string;
  leaderOnly?: boolean;
}

interface DamageSource {
  id: string;
  itemType: '武器' | '衣服';
  itemName: string;
  title: string;
  bucket: SourceBucket;
  summary: string;
  input?: SourceInput;
  optionInput?: SourceInput;
  getContributions: (count: number, option?: number) => Contribution[];
}

interface FormState {
  attack: number | null;
  skill: SkillValue;
  skillCoeff: number | null;
  outside: number | null;
  allOutput: number | null;
  inside: number | null;
  finalBonus: number | null;
  critDamage: number | null;
  normalActual: number | null;
  normalActualUnit: number;
  critActual: number | null;
  critActualUnit: number;
  note: string;
  selectedSources: string[];
  sourceCounts: Record<string, number>;
}

interface SavedFormState extends Partial<FormState> {
  bonusMode?: 'percent';
  outsidePercent?: number;
  insidePercent?: number;
  finalBonusPercent?: number;
  actualRaw?: number;
  actual?: number;
  actualUnit?: number;
  coeff?: number;
}

interface AppliedSummary {
  outsidePercent: number;
  insidePercent: number;
  finalBonusPercent: number;
  vulnerabilityPercent: number;
  overclockPercent: number;
  critDamageBonusPercent: number;
  lines: Contribution[];
  leaderLines: Contribution[];
}

interface DamageRecord {
  id: number;
  skill: string;
  attack: number;
  coeff: number;
  baseOutsidePercent: number;
  allOutputPercent: number;
  baseInsidePercent: number;
  baseFinalBonusPercent: number;
  outsidePercent: number;
  insidePercent: number;
  finalBonusPercent: number;
  vulnerabilityPercent: number;
  overclockPercent: number;
  critDamagePercent: number;
  critDamageBonusPercent: number;
  normalActualRaw: number;
  normalActualUnit: number;
  normalActual: number;
  critActualRaw: number;
  critActualUnit: number;
  critActual: number;
  theory: number;
  critTheory: number;
  diff: number;
  critDiff: number;
  ratio: number;
  critRatio: number;
  note: string;
  selectedSources: string[];
  sourceCounts: Record<string, number>;
  actualRaw?: number;
  actualUnit?: number;
  actual?: number;
}

const skillOptions: SkillOption[] = [
  { label: '普攻（7）', value: '7', name: '普攻', coeff: 7 },
  { label: '网络延迟（10）', value: '10', name: '网络延迟', coeff: 10 },
  { label: '带宽爆破（17.5）', value: '17.5', name: '带宽爆破', coeff: 17.5 },
  { label: '分布打击（25）', value: '25', name: '分布打击', coeff: 25 },
  { label: '奥义（140）', value: '140', name: '奥义', coeff: 140 },
  { label: '自定义', value: 'custom', name: '自定义', coeff: 7 }
];

const unitOptions: UnitOption[] = [
  { label: '无', value: 1 },
  { label: 'k', value: 1000 },
  { label: 'm', value: 1000000 },
  { label: 'b', value: 1000000000 }
];

const sourceCatalog: DamageSource[] = [
  {
    id: 'weapon_miao_miao_chui_early',
    itemType: '武器',
    itemName: '喵喵锤',
    title: '60秒内伤害',
    bucket: 'outside',
    summary: '进入战斗60秒内伤害；2星+10%，4星提升至+20%',
    optionInput: {
      label: '星级',
      kind: 'stars',
      min: 2,
      max: 4,
      defaultValue: 4,
      suffix: '星',
      options: [
        { value: 2, label: '2星', description: '局外+10%' },
        { value: 4, label: '4星', description: '局外+20%' }
      ]
    },
    getContributions: (_count, option = 4) => {
      const stars = option >= 4 ? 4 : 2;
      return [{ bucket: 'outside', label: `喵喵锤：${stars}星60秒内伤害`, value: stars >= 4 ? 20 : 10 }];
    }
  },
  {
    id: 'weapon_da_kai_yan_jie_amp',
    itemType: '武器',
    itemName: '大开眼戒',
    title: '增幅目标',
    bucket: 'final',
    summary: '按星级计算；3星只放大额外爆伤，最终伤害不吃3星放大',
    optionInput: {
      label: '星级',
      kind: 'stars',
      min: 1,
      max: 5,
      defaultValue: 5,
      suffix: '星',
      options: [
        { value: 1, label: '1星', description: '最终+10%' },
        { value: 2, label: '2星', description: '最终+10%，爆伤+100%' },
        { value: 3, label: '3星', description: '最终+10%，爆伤+140%' },
        { value: 4, label: '4星', description: '最终+15%，爆伤+140%' },
        { value: 5, label: '5星', description: '最终+15%，爆伤+336%' }
      ]
    },
    getContributions: (_count, option = 5) => {
      const stars = Math.max(1, Math.min(5, Math.floor(option || 1)));
      const amp = stars >= 3 ? 1.4 : 1;
      const baseFinal = stars >= 4 ? 15 : 10;
      const baseCrit = stars >= 5 ? 240 : stars >= 2 ? 100 : 0;
      const lines: Contribution[] = [
        {
          bucket: 'final',
          label: `大开眼戒：${stars}星最终伤害`,
          value: baseFinal
        }
      ];
      if (baseCrit > 0) {
        lines.push({
          bucket: 'crit',
          label: `大开眼戒：${stars}星额外暴击伤害${stars >= 3 ? `（${baseCrit}% × 1.4）` : ''}`,
          value: baseCrit * amp
        });
      }
      return lines;
    }
  },
  {
    id: 'clothes_qing_wa_xiao_bing',
    itemType: '衣服',
    itemName: '青蛙小兵',
    title: '上阵梦灵',
    bucket: 'outside',
    summary: '每只 +8% 局外增伤；3只额外 +10%；5只最高攻击梦灵额外 +15%',
    input: { label: '梦灵数量', kind: 'count', min: 1, max: 5, defaultValue: 5, suffix: '只' },
    getContributions: (count) => {
      const safeCount = Math.max(1, Math.min(5, Math.floor(count || 1)));
      const lines: Contribution[] = [
        { bucket: 'outside', label: `青蛙小兵：${safeCount}只梦灵全体伤害`, value: safeCount * 8 }
      ];
      if (safeCount >= 3) lines.push({ bucket: 'outside', label: '青蛙小兵：上阵3只额外伤害', value: 10 });
      if (safeCount >= 5) lines.push({ bucket: 'outside', label: '青蛙小兵：最高攻击梦灵额外伤害', value: 15 });
      return lines;
    }
  },
  {
    id: 'clothes_shen_mi_ying_pao_enchant',
    itemType: '衣服',
    itemName: '神秘影袍',
    title: '秘法附魔',
    bucket: 'inside',
    summary: '秘法附魔；1星+40%，3星提升至+60%并提供最终+5%',
    optionInput: {
      label: '星级',
      kind: 'stars',
      min: 1,
      max: 3,
      defaultValue: 3,
      suffix: '星',
      options: [
        { value: 1, label: '1星', description: '局内+40%' },
        { value: 3, label: '3星', description: '局内+60%，最终+5%' }
      ]
    },
    getContributions: (_count, option = 3) => {
      const stars = option >= 3 ? 3 : 1;
      const lines: Contribution[] = [
        { bucket: 'inside', label: `神秘影袍：${stars}星秘法附魔伤害`, value: stars >= 3 ? 60 : 40 }
      ];
      if (stars >= 3) lines.push({ bucket: 'final', label: '神秘影袍：3星最终增伤', value: 5 });
      return lines;
    }
  },
  {
    id: 'clothes_mi_lv_gui_tan_clues',
    itemType: '衣服',
    itemName: '谜律诡探',
    title: '关键线索',
    bucket: 'final',
    summary: '关键线索最终增伤；1星每层+3%，3星每层+6%，5星4层后额外+10%',
    optionInput: {
      label: '星级',
      kind: 'stars',
      min: 1,
      max: 5,
      defaultValue: 5,
      suffix: '星',
      options: [
        { value: 1, label: '1星', description: '每层最终+3%' },
        { value: 3, label: '3星', description: '每层最终+6%' },
        { value: 5, label: '5星', description: '4层额外最终+10%' }
      ]
    },
    input: { label: '关键线索', kind: 'stacks', min: 1, max: 4, defaultValue: 4, suffix: '层' },
    getContributions: (count, option = 5) => {
      const stars = option >= 5 ? 5 : option >= 3 ? 3 : 1;
      const stacks = Math.max(1, Math.min(4, Math.floor(count || 1)));
      const perStack = stars >= 3 ? 6 : 3;
      const lines: Contribution[] = [
        { bucket: 'final', label: `谜律诡探：${stars}星关键线索${stacks}层`, value: stacks * perStack }
      ];
      if (stars >= 5 && stacks >= 4) lines.push({ bucket: 'final', label: '谜律诡探：5星真相锁定', value: 10 });
      return lines;
    }
  },
  {
    id: 'clothes_chao_pin_tian_shi_active',
    itemType: '衣服',
    itemName: '超频天使',
    title: '超频状态',
    bucket: 'overclock',
    summary: '独立乘区 +50%',
    getContributions: () => [{ bucket: 'overclock', label: '超频天使：超频状态', value: 50 }]
  },
  {
    id: 'clothes_chao_pin_tian_shi_stacks',
    itemType: '衣服',
    itemName: '超频天使',
    title: '永久最终增伤',
    bucket: 'final',
    summary: '每层 +2.5% 最终增伤，最多4层',
    input: { label: '永久层数', kind: 'stacks', min: 1, max: 4, defaultValue: 4, suffix: '层' },
    getContributions: (count) => {
      const stacks = Math.max(1, Math.min(4, Math.floor(count || 1)));
      return [{ bucket: 'final', label: `超频天使：永久最终增伤${stacks}层`, value: stacks * 2.5 }];
    }
  },
  {
    id: 'clothes_yu_zhou_zhi_xin_vulnerability',
    itemType: '衣服',
    itemName: '宇宙之心',
    title: '控制易伤',
    bucket: 'vulnerability',
    summary: '易伤乘区 +40%；武器宇宙之心的控制也按这里触发',
    getContributions: () => [{ bucket: 'vulnerability', label: '衣服宇宙之心：控制附加易伤', value: 40 }]
  },
  {
    id: 'weapon_xiao_gou_chui_explosion',
    itemType: '武器',
    itemName: '小狗锤',
    title: '自爆小狗',
    bucket: 'leader',
    summary: '队长伤害：30倍攻击力范围爆炸',
    getContributions: () => [
      { bucket: 'leader', label: '小狗锤：自爆小狗爆炸', text: '队长伤害，30倍攻击力，不计入梦灵伤害', leaderOnly: true }
    ]
  },
  {
    id: 'weapon_qi_yi_quan_zhang_fire',
    itemType: '武器',
    itemName: '奇异权杖',
    title: '魔法焰火',
    bucket: 'leader',
    summary: '队长伤害：40倍攻击力，专属增伤最高 +120%',
    getContributions: () => [
      { bucket: 'leader', label: '奇异权杖：魔法焰火', text: '队长伤害，40倍攻击力，专属增伤不计入梦灵伤害', leaderOnly: true }
    ]
  },
  {
    id: 'weapon_yu_zhou_zhi_xin_wave',
    itemType: '武器',
    itemName: '宇宙之心',
    title: '宇宙波',
    bucket: 'leader',
    summary: '队长伤害：30倍攻击力；控制可触发衣服宇宙之心易伤',
    getContributions: () => [
      { bucket: 'leader', label: '武器宇宙之心：宇宙波', text: '队长伤害，易伤口径按衣服宇宙之心处理', leaderOnly: true }
    ]
  },
  {
    id: 'clothes_yu_zhou_zhi_xin_wave',
    itemType: '衣服',
    itemName: '宇宙之心',
    title: '巨型宇宙波',
    bucket: 'leader',
    summary: '队长伤害：30倍攻击力',
    getContributions: () => [
      { bucket: 'leader', label: '衣服宇宙之心：巨型宇宙波', text: '队长伤害，30倍攻击力，不计入梦灵伤害', leaderOnly: true }
    ]
  },
  {
    id: 'clothes_shen_mi_ying_pao_explosion',
    itemType: '衣服',
    itemName: '神秘影袍',
    title: '魔法爆裂',
    bucket: 'leader',
    summary: '队长伤害：30倍攻击力，专属增伤最高 +120%',
    getContributions: () => [
      { bucket: 'leader', label: '神秘影袍：魔法爆裂', text: '队长伤害，魔法爆裂专属增伤不计入梦灵伤害', leaderOnly: true }
    ]
  }
];

function sourceOptionKey(sourceId: string): string {
  return `${sourceId}:option`;
}

const defaultSourceCounts = sourceCatalog.reduce<Record<string, number>>((result, source) => {
  if (source.input) result[source.id] = source.input.defaultValue;
  if (source.optionInput) result[sourceOptionKey(source.id)] = source.optionInput.defaultValue;
  return result;
}, {});

const defaultForm: FormState = {
  attack: 1000,
  skill: '7',
  skillCoeff: 7,
  outside: 0,
  allOutput: 0,
  inside: 0,
  finalBonus: 0,
  critDamage: 200,
  normalActual: 0,
  normalActualUnit: 1,
  critActual: 0,
  critActualUnit: 1,
  note: '',
  selectedSources: [],
  sourceCounts: defaultSourceCounts
};

const formStorageKey = 'zero-day-hacker-damage-form';
const recordsStorageKey = 'zero-day-hacker-damage-records';

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentToMultiplier(value: unknown): number {
  return 1 + toNumber(value) / 100;
}

function multiplierToPercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric - 1) * 10000) / 100;
}

function formatNumber(value: unknown, digits = 2): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  const fixed = Math.abs(numeric) >= 100 ? 0 : digits;
  return numeric.toLocaleString('zh-CN', { maximumFractionDigits: fixed });
}

function formatDamage(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  const sign = numeric < 0 ? '-' : '';
  const abs = Math.abs(numeric);
  const units = [
    { limit: 1e16, value: 1e9, label: 'b' },
    { limit: 1e10, value: 1e6, label: 'm' },
    { limit: 1e4, value: 1e3, label: 'k' },
    { limit: 0, value: 1, label: '' }
  ];
  let unit = units.find((item) => abs >= item.limit) ?? units[units.length - 1];
  let compact = abs / unit.value;

  if (compact >= 10000 && unit.label === 'k') {
    unit = units[1];
    compact = abs / unit.value;
  } else if (compact >= 10000 && unit.label === 'm') {
    unit = units[0];
    compact = abs / unit.value;
  }

  const maxDecimals = compact >= 100 ? 0 : compact >= 10 ? 1 : 2;
  return `${sign}${compact.toLocaleString('zh-CN', {
    maximumFractionDigits: maxDecimals,
    useGrouping: false
  })}${unit.label}`;
}

function formatSignedDamage(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (numeric === 0) return formatDamage(0);
  return `${numeric > 0 ? '+' : ''}${formatDamage(numeric)}`;
}

function formatPercent(value: unknown, digits = 2): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${(numeric * 100).toFixed(digits)}%`;
}

function formatRawPercent(value: unknown, digits = 2): string {
  return `${formatNumber(toNumber(value), digits)}%`;
}

function unitLabel(unit: unknown): string {
  return unitOptions.find((item) => item.value === Number(unit))?.label ?? '';
}

function bucketLabel(bucket: SourceBucket): string {
  const labels: Record<SourceBucket, string> = {
    outside: '局外',
    inside: '局内',
    final: '最终',
    vulnerability: '易伤',
    overclock: '超频',
    crit: '爆伤',
    leader: '队长伤害',
    info: '机制'
  };
  return labels[bucket];
}

function normalizeSavedForm(saved: SavedFormState | null): FormState {
  if (!saved) return defaultForm;
  return {
    ...defaultForm,
    ...saved,
    skill: saved.skill ?? defaultForm.skill,
    skillCoeff: saved.skillCoeff ?? saved.coeff ?? defaultForm.skillCoeff,
    outside: saved.outsidePercent ?? (saved.bonusMode === 'percent' ? saved.outside ?? 0 : multiplierToPercent(saved.outside ?? 1)),
    allOutput: saved.allOutput ?? 0,
    inside: saved.insidePercent ?? (saved.bonusMode === 'percent' ? saved.inside ?? 0 : multiplierToPercent(saved.inside ?? 1)),
    finalBonus:
      saved.finalBonusPercent ??
      (saved.bonusMode === 'percent' ? saved.finalBonus ?? 0 : multiplierToPercent(saved.finalBonus ?? 1)),
    critDamage: saved.critDamage ?? defaultForm.critDamage,
    normalActual: saved.normalActual ?? saved.actualRaw ?? saved.actual ?? defaultForm.normalActual,
    normalActualUnit: saved.normalActualUnit ?? saved.actualUnit ?? defaultForm.normalActualUnit,
    critActual: saved.critActual ?? defaultForm.critActual,
    critActualUnit: saved.critActualUnit ?? defaultForm.critActualUnit,
    note: saved.note ?? '',
    selectedSources: Array.isArray(saved.selectedSources) ? saved.selectedSources : [],
    sourceCounts: { ...defaultSourceCounts, ...(saved.sourceCounts ?? {}) }
  };
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function summarizeSources(form: FormState): AppliedSummary {
  const summary: AppliedSummary = {
    outsidePercent: 0,
    insidePercent: 0,
    finalBonusPercent: 0,
    vulnerabilityPercent: 0,
    overclockPercent: 0,
    critDamageBonusPercent: 0,
    lines: [],
    leaderLines: []
  };

  for (const sourceId of form.selectedSources) {
    const source = sourceCatalog.find((item) => item.id === sourceId);
    if (!source) continue;
    const count = form.sourceCounts[sourceId] ?? source.input?.defaultValue ?? 1;
    const option = form.sourceCounts[sourceOptionKey(sourceId)] ?? source.optionInput?.defaultValue;
    for (const contribution of source.getContributions(count, option)) {
      if (contribution.leaderOnly || contribution.bucket === 'leader') {
        summary.leaderLines.push(contribution);
        continue;
      }

      summary.lines.push(contribution);
      const value = contribution.value ?? 0;
      if (contribution.bucket === 'outside') summary.outsidePercent += value;
      if (contribution.bucket === 'inside') summary.insidePercent += value;
      if (contribution.bucket === 'final') summary.finalBonusPercent += value;
      if (contribution.bucket === 'vulnerability') summary.vulnerabilityPercent += value;
      if (contribution.bucket === 'overclock') summary.overclockPercent += value;
      if (contribution.bucket === 'crit') summary.critDamageBonusPercent += value;
    }
  }

  return summary;
}

function calculate(form: FormState): DamageRecord {
  const sourceSummary = summarizeSources(form);
  const attack = toNumber(form.attack);
  const coeff = toNumber(form.skillCoeff);
  const baseOutsidePercent = toNumber(form.outside);
  const allOutputPercent = toNumber(form.allOutput);
  const baseInsidePercent = toNumber(form.inside);
  const baseFinalBonusPercent = toNumber(form.finalBonus);
  const outsidePercent = baseOutsidePercent + allOutputPercent + sourceSummary.outsidePercent;
  const insidePercent = baseInsidePercent + sourceSummary.insidePercent;
  const finalBonusPercent = baseFinalBonusPercent + sourceSummary.finalBonusPercent;
  const vulnerabilityPercent = sourceSummary.vulnerabilityPercent;
  const overclockPercent = sourceSummary.overclockPercent;
  const critDamagePercent = toNumber(form.critDamage, 200);
  const critDamageBonusPercent = sourceSummary.critDamageBonusPercent;
  const normalActualRaw = toNumber(form.normalActual);
  const normalActualUnit = toNumber(form.normalActualUnit, 1);
  const normalActual = normalActualRaw * normalActualUnit;
  const critActualRaw = toNumber(form.critActual);
  const critActualUnit = toNumber(form.critActualUnit, 1);
  const critActual = critActualRaw * critActualUnit;
  const theory =
    attack *
    coeff *
    percentToMultiplier(outsidePercent) *
    percentToMultiplier(insidePercent) *
    percentToMultiplier(finalBonusPercent) *
    percentToMultiplier(vulnerabilityPercent) *
    percentToMultiplier(overclockPercent);
  const critTheory = theory * ((critDamagePercent + critDamageBonusPercent) / 100);
  const diff = normalActual - theory;
  const critDiff = critActual - critTheory;
  const ratio = theory === 0 ? Number.NaN : normalActual / theory;
  const critRatio = critTheory === 0 ? Number.NaN : critActual / critTheory;
  const skillMeta = skillOptions.find((item) => item.value === form.skill);

  return {
    id: Date.now(),
    skill: skillMeta?.name ?? '自定义',
    attack,
    coeff,
    baseOutsidePercent,
    allOutputPercent,
    baseInsidePercent,
    baseFinalBonusPercent,
    outsidePercent,
    insidePercent,
    finalBonusPercent,
    vulnerabilityPercent,
    overclockPercent,
    critDamagePercent,
    critDamageBonusPercent,
    normalActualRaw,
    normalActualUnit,
    normalActual,
    critActualRaw,
    critActualUnit,
    critActual,
    theory,
    critTheory,
    diff,
    critDiff,
    ratio,
    critRatio,
    note: form.note?.trim() ?? '',
    selectedSources: [...form.selectedSources],
    sourceCounts: { ...form.sourceCounts }
  };
}

function App() {
  const [form] = Form.useForm<FormState>();
  const [formState, setFormState] = useState<FormState>(() => normalizeSavedForm(loadJson<SavedFormState | null>(formStorageKey, null)));
  const [records, setRecords] = useState<DamageRecord[]>(() => loadJson<DamageRecord[]>(recordsStorageKey, []));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const sourceSummary = useMemo(() => summarizeSources(formState), [formState]);
  const result = useMemo(() => calculate(formState), [formState]);

  useEffect(() => {
    form.setFieldsValue(formState);
  }, [form, formState]);

  useEffect(() => {
    localStorage.setItem(formStorageKey, JSON.stringify({ ...formState, bonusMode: 'percent' }));
  }, [formState]);

  useEffect(() => {
    localStorage.setItem(recordsStorageKey, JSON.stringify(records));
  }, [records]);

  function handleValuesChange(changed: Partial<FormState>, values: FormState) {
    const next: FormState = {
      ...defaultForm,
      ...values,
      selectedSources: formState.selectedSources,
      sourceCounts: formState.sourceCounts
    };
    if (Object.prototype.hasOwnProperty.call(changed, 'skill') && changed.skill !== 'custom') {
      next.skillCoeff = Number(changed.skill);
      form.setFieldValue('skillCoeff', next.skillCoeff);
    }
    if (Object.prototype.hasOwnProperty.call(changed, 'skillCoeff')) {
      const matched = skillOptions.find((item) => item.value !== 'custom' && item.coeff === Number(changed.skillCoeff));
      next.skill = matched?.value ?? 'custom';
      form.setFieldValue('skill', next.skill);
    }
    setFormState(next);
  }

  function toggleSource(sourceId: string, event: CheckboxChangeEvent) {
    setFormState((current) => {
      const selectedSources = event.target.checked
        ? Array.from(new Set([...current.selectedSources, sourceId]))
        : current.selectedSources.filter((item) => item !== sourceId);
      return { ...current, selectedSources };
    });
  }

  function updateSourceCount(sourceId: string, value: number | null) {
    setFormState((current) => ({
      ...current,
      sourceCounts: { ...current.sourceCounts, [sourceId]: toNumber(value, defaultSourceCounts[sourceId] ?? 1) }
    }));
  }

  function selectSourceOption(sourceId: string, value: number) {
    setFormState((current) => ({
      ...current,
      selectedSources: Array.from(new Set([...current.selectedSources, sourceId])),
      sourceCounts: { ...current.sourceCounts, [sourceOptionKey(sourceId)]: value }
    }));
  }

  function addRecord() {
    setRecords((current) => [{ ...result, id: Date.now() }, ...current]);
  }

  function resetForm() {
    setFormState(defaultForm);
  }

  function restoreRecord(record: DamageRecord) {
    const matchedSkill = skillOptions.find((item) => item.value !== 'custom' && item.name === record.skill && item.coeff === record.coeff);
    setFormState({
      ...defaultForm,
      attack: record.attack,
      skill: matchedSkill?.value ?? 'custom',
      skillCoeff: record.coeff,
      outside: record.baseOutsidePercent ?? record.outsidePercent ?? 0,
      allOutput: record.allOutputPercent ?? 0,
      inside: record.baseInsidePercent ?? record.insidePercent ?? 0,
      finalBonus: record.baseFinalBonusPercent ?? record.finalBonusPercent ?? 0,
      critDamage: record.critDamagePercent ?? 200,
      normalActual: record.normalActualRaw ?? record.actualRaw ?? record.actual ?? 0,
      normalActualUnit: record.normalActualUnit ?? record.actualUnit ?? 1,
      critActual: record.critActualRaw ?? 0,
      critActualUnit: record.critActualUnit ?? 1,
      note: record.note ?? '',
      selectedSources: record.selectedSources ?? [],
      sourceCounts: { ...defaultSourceCounts, ...(record.sourceCounts ?? {}) }
    });
  }

  async function copyTable() {
    if (records.length === 0) return;
    const header = [
      '技能',
      '攻击力',
      '系数',
      '局外%',
      '局内%',
      '最终%',
      '易伤%',
      '超频%',
      '暴击伤害%',
      '装备爆伤%',
      '非暴击理论',
      '暴击理论',
      '非暴击实测',
      '非暴击实测输入',
      '非暴击单位',
      '暴击实测',
      '暴击实测输入',
      '暴击单位',
      '非暴击比',
      '暴击比',
      '备注'
    ];
    const rows = records.map((record) => [
      record.skill,
      record.attack,
      record.coeff,
      record.outsidePercent,
      record.insidePercent,
      record.finalBonusPercent,
      record.vulnerabilityPercent ?? 0,
      record.overclockPercent ?? 0,
      record.critDamagePercent ?? 200,
      record.critDamageBonusPercent ?? 0,
      formatDamage(record.theory),
      formatDamage(record.critTheory ?? record.theory),
      formatDamage(record.normalActual ?? record.actual ?? 0),
      record.normalActualRaw ?? record.actualRaw ?? record.actual ?? 0,
      unitLabel(record.normalActualUnit ?? record.actualUnit ?? 1),
      formatDamage(record.critActual ?? 0),
      record.critActualRaw ?? 0,
      unitLabel(record.critActualUnit ?? 1),
      formatPercent(record.ratio, 1),
      formatPercent(record.critRatio, 1),
      record.note || ''
    ]);
    await navigator.clipboard.writeText([header, ...rows].map((row) => row.join('\t')).join('\n'));
    messageApi.success('已复制表格');
  }

  const columns: TableColumnsType<DamageRecord> = [
    { title: '#', width: 52, render: (_value, _record, index) => index + 1 },
    { title: '技能', dataIndex: 'skill', width: 108, fixed: 'left' },
    { title: '攻击力', dataIndex: 'attack', align: 'right', render: (value) => formatNumber(value) },
    { title: '系数', dataIndex: 'coeff', align: 'right', render: (value) => formatNumber(value) },
    { title: '局外%', dataIndex: 'outsidePercent', align: 'right', render: (value) => formatRawPercent(value) },
    { title: '局内%', dataIndex: 'insidePercent', align: 'right', render: (value) => formatRawPercent(value) },
    { title: '最终%', dataIndex: 'finalBonusPercent', align: 'right', render: (value) => formatRawPercent(value) },
    { title: '易伤%', dataIndex: 'vulnerabilityPercent', align: 'right', render: (value) => formatRawPercent(value ?? 0) },
    { title: '超频%', dataIndex: 'overclockPercent', align: 'right', render: (value) => formatRawPercent(value ?? 0) },
    { title: '非暴击', dataIndex: 'theory', align: 'right', render: formatDamage },
    { title: '暴击', dataIndex: 'critTheory', align: 'right', render: formatDamage },
    { title: '非暴击实测', dataIndex: 'normalActual', width: 112, align: 'right', render: (value, record) => formatDamage(value ?? record.actual ?? 0) },
    { title: '暴击实测', dataIndex: 'critActual', width: 96, align: 'right', render: (value) => formatDamage(value ?? 0) },
    { title: '非暴击比', dataIndex: 'ratio', align: 'right', render: (value) => formatPercent(value, 1) },
    { title: '暴击比', dataIndex: 'critRatio', align: 'right', render: (value) => formatPercent(value, 1) },
    { title: '备注', dataIndex: 'note', width: 150, render: (value) => value || '-' },
    {
      title: '',
      width: 132,
      fixed: 'right',
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => restoreRecord(record)}>
            复原
          </Button>
          <Button size="small" danger onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}>
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#ff5c01', borderRadius: 8 } }}>
      {contextHolder}
      <main className="app-shell">
        <header className="app-header">
          <div>
            <Title level={1}>零日骇客伤害对比工具</Title>
            <Text type="secondary">梦灵伤害和队长触发伤害分开标记</Text>
          </div>
        </header>

        <Card className="formula-card" size="small">
          梦灵理论伤害 = 攻击力 × 技能系数 × 局外 × 局内 × 最终 × 易伤 × 超频；暴击 = 非暴击 ×（输入暴击伤害 + 装备额外爆伤）
        </Card>

        <Row gutter={[16, 16]} align="top" className="top-layout">
          <Col xs={24} xl={7}>
            <Card title="基础输入" className="panel-card">
              <Form form={form} layout="vertical" initialValues={formState} onValuesChange={handleValuesChange}>
                <Form.Item label="攻击力" name="attack">
                  <InputNumber min={0} step="any" className="full-width" />
                </Form.Item>

                <Row gutter={10}>
                  <Col span={16}>
                    <Form.Item label="技能" name="skill">
                      <Select options={skillOptions.map(({ label, value }) => ({ label, value }))} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="系数" name="skillCoeff">
                      <InputNumber min={0} step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item
                      label="局外增伤（面板）"
                      name="outside"
                    >
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space size={4}>
                          <span>全员出力</span>
                          <Tooltip title="全员出力属于局外增伤乘区；填写整数百分比，计算时会与局外增伤（面板）相加后进入局外乘区。">
                            <Tag color="orange" className="tip-tag">
                              tips
                            </Tag>
                          </Tooltip>
                        </Space>
                      }
                      name="allOutput"
                    >
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label="局内增伤（%）" name="inside">
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="最终增伤（%）" name="finalBonus">
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label="暴击伤害（%）" name="critDamage">
                      <InputNumber min={0} step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label="非暴击实测">
                      <Space.Compact className="full-width">
                        <Form.Item name="normalActual" noStyle>
                          <InputNumber min={0} step="any" className="actual-input" />
                        </Form.Item>
                        <Form.Item name="normalActualUnit" noStyle>
                          <Select className="unit-select" options={unitOptions} />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="暴击实测">
                      <Space.Compact className="full-width">
                        <Form.Item name="critActual" noStyle>
                          <InputNumber min={0} step="any" className="actual-input" />
                        </Form.Item>
                        <Form.Item name="critActualUnit" noStyle>
                          <Select className="unit-select" options={unitOptions} />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="备注" name="note">
                  <Input maxLength={40} placeholder="例：带宽爆破，暴击样本" />
                </Form.Item>

                <Space wrap>
                  <Button type="primary" onClick={addRecord}>
                    添加对比
                  </Button>
                  <Button onClick={resetForm}>重置输入</Button>
                </Space>
              </Form>
            </Card>
          </Col>

          <Col xs={24} xl={17}>
            <Card className="source-card panel-card" title="衣服 / 武器来源选择">
              <div className="source-list">
                {sourceCatalog.map((source) => {
                  const checked = formState.selectedSources.includes(source.id);
                  return (
                    <div className={`source-row${checked ? ' is-selected' : ''}`} key={source.id}>
                      <div className="source-row-head">
                        <Checkbox checked={checked} onChange={(event) => toggleSource(source.id, event)}>
                          <span className="source-name">{source.itemName}</span>
                        </Checkbox>
                        <Space size={4} wrap>
                          <Tag color={source.itemType === '武器' ? 'volcano' : 'geekblue'}>{source.itemType}</Tag>
                          <Tag className="bucket-tag" color={source.bucket === 'leader' ? 'red' : 'default'}>
                            {bucketLabel(source.bucket)}
                          </Tag>
                        </Space>
                      </div>
                      <div className="source-effect">{source.title}</div>
                      <div className="source-summary">{source.summary}</div>
                      {source.optionInput?.kind === 'stars' && source.optionInput.options ? (
                        <div className="source-option-list">
                          {source.optionInput.options.map((option) => {
                            const active =
                              checked &&
                              (formState.sourceCounts[sourceOptionKey(source.id)] ?? source.optionInput?.defaultValue) === option.value;
                            return (
                              <button
                                className={`source-option${active ? ' is-active' : ''}`}
                                key={option.value}
                                type="button"
                                onClick={() => selectSourceOption(source.id, option.value)}
                              >
                                <span>{option.label}</span>
                                <strong>{option.description}</strong>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {source.input && source.input.kind !== 'stars' && checked ? (
                        <div className="source-input">
                          <Text type="secondary">{source.input.label}</Text>
                          <InputNumber
                            min={source.input.min}
                            max={source.input.max}
                            value={formState.sourceCounts[source.id] ?? source.input.defaultValue}
                            onChange={(value) => updateSourceCount(source.id, value)}
                            addonAfter={source.input.suffix}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top" className="result-layout">
          <Col span={24}>
            <Card
              title="当前结果"
              className="panel-card result-card"
              extra={<Button onClick={() => setSummaryOpen(true)}>查看生效乘区</Button>}
            >
              <div className="result-compare">
                <div className="compare-row">
                  <Text strong>非暴击</Text>
                  <span>实测 {formatDamage(result.normalActual)}</span>
                  <span>理论 {formatDamage(result.theory)}</span>
                  <span className={result.diff >= 0 ? 'diff-positive' : 'diff-negative'}>
                    差值 {formatSignedDamage(result.diff)}
                  </span>
                  <Tag color={Math.abs(result.ratio - 1) <= 0.02 ? 'green' : 'orange'}>
                    实测/理论 {formatPercent(result.ratio, 1)}
                  </Tag>
                </div>
                <div className="compare-row">
                  <Text strong>暴击</Text>
                  <span>实测 {formatDamage(result.critActual)}</span>
                  <span>理论 {formatDamage(result.critTheory)}</span>
                  <span className={result.critDiff >= 0 ? 'diff-positive' : 'diff-negative'}>
                    差值 {formatSignedDamage(result.critDiff)}
                  </span>
                  <Tag color={Math.abs(result.critRatio - 1) <= 0.02 ? 'green' : 'orange'}>
                    实测/理论 {formatPercent(result.critRatio, 1)}
                  </Tag>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Modal
          title="已生效梦灵乘区"
          open={summaryOpen}
          onCancel={() => setSummaryOpen(false)}
          footer={null}
          width={720}
        >
          <div className="summary-grid modal-summary">
            <div>
              <Text type="secondary">局外</Text>
              <strong>{formatRawPercent(result.outsidePercent)}</strong>
            </div>
            <div>
              <Text type="secondary">局内</Text>
              <strong>{formatRawPercent(result.insidePercent)}</strong>
            </div>
            <div>
              <Text type="secondary">最终</Text>
              <strong>{formatRawPercent(result.finalBonusPercent)}</strong>
            </div>
            <div>
              <Text type="secondary">易伤</Text>
              <strong>{formatRawPercent(result.vulnerabilityPercent)}</strong>
            </div>
            <div>
              <Text type="secondary">超频</Text>
              <strong>{formatRawPercent(result.overclockPercent)}</strong>
            </div>
            <div>
              <Text type="secondary">额外爆伤</Text>
              <strong>{formatRawPercent(result.critDamageBonusPercent)}</strong>
            </div>
          </div>

          <Divider />

          <div className="applied-list">
            <Text strong>梦灵伤害来源</Text>
            {sourceSummary.lines.length === 0 ? <Text type="secondary">暂无装备来源</Text> : null}
            {sourceSummary.lines.map((line, index) => (
              <div className="applied-line" key={`${line.label}-${index}`}>
                <Tag>{bucketLabel(line.bucket)}</Tag>
                <span>{line.label}</span>
                <strong>{formatRawPercent(line.value ?? 0)}</strong>
              </div>
            ))}
          </div>

          <Divider />

          <div className="applied-list">
            <Text strong>队长伤害标记</Text>
            {sourceSummary.leaderLines.length === 0 ? <Text type="secondary">暂无队长伤害来源</Text> : null}
            {sourceSummary.leaderLines.map((line, index) => (
              <div className="leader-line" key={`${line.label}-${index}`}>
                <Tag color="red">队长</Tag>
                <span>{line.label}</span>
                <Text type="secondary">{line.text}</Text>
              </div>
            ))}
          </div>
        </Modal>

        <Card
          className="records-card"
          title="对比记录"
          extra={
            <Space wrap>
              <Button onClick={copyTable}>复制表格</Button>
              <Button danger onClick={() => setRecords([])}>
                清空
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={records}
            scroll={{ x: 1480 }}
            pagination={false}
            locale={{ emptyText: '暂无记录' }}
            size="middle"
          />
        </Card>
      </main>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
