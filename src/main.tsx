import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Card,
  Col,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
  theme
} from 'antd';
import type { TableColumnsType } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './styles.css';

const { Text, Title } = Typography;

type SkillValue = '7' | '10' | '17.5' | '25' | '140' | 'custom';

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

interface FormState {
  attack: number | null;
  skill: SkillValue;
  skillCoeff: number | null;
  outside: number | null;
  inside: number | null;
  finalBonus: number | null;
  actual: number | null;
  actualUnit: number;
  note: string;
}

interface SavedFormState extends Partial<FormState> {
  bonusMode?: 'percent';
  outsidePercent?: number;
  insidePercent?: number;
  finalBonusPercent?: number;
  actualRaw?: number;
  coeff?: number;
}

interface DamageRecord {
  id: number;
  skill: string;
  attack: number;
  coeff: number;
  outsidePercent: number;
  insidePercent: number;
  finalBonusPercent: number;
  outside: number;
  inside: number;
  finalBonus: number;
  actualRaw: number;
  actualUnit: number;
  actual: number;
  theory: number;
  diff: number;
  error: number;
  ratio: number;
  note: string;
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

const defaultForm: FormState = {
  attack: 1000,
  skill: '7',
  skillCoeff: 7,
  outside: 0,
  inside: 0,
  finalBonus: 0,
  actual: 0,
  actualUnit: 1,
  note: ''
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

function formatPercent(value: unknown, digits = 2): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${(numeric * 100).toFixed(digits)}%`;
}

function formatRawPercent(value: unknown): string {
  return `${formatNumber(toNumber(value), 2)}%`;
}

function unitLabel(unit: unknown): string {
  return unitOptions.find((item) => item.value === Number(unit))?.label ?? '';
}

function normalizeSavedForm(saved: SavedFormState | null): FormState {
  if (!saved) return defaultForm;
  return {
    ...defaultForm,
    ...saved,
    skill: saved.skill ?? defaultForm.skill,
    skillCoeff: saved.skillCoeff ?? saved.coeff ?? defaultForm.skillCoeff,
    outside: saved.outsidePercent ?? (saved.bonusMode === 'percent' ? saved.outside ?? 0 : multiplierToPercent(saved.outside ?? 1)),
    inside: saved.insidePercent ?? (saved.bonusMode === 'percent' ? saved.inside ?? 0 : multiplierToPercent(saved.inside ?? 1)),
    finalBonus:
      saved.finalBonusPercent ??
      (saved.bonusMode === 'percent' ? saved.finalBonus ?? 0 : multiplierToPercent(saved.finalBonus ?? 1)),
    actual: saved.actualRaw ?? saved.actual ?? defaultForm.actual,
    actualUnit: saved.actualUnit ?? defaultForm.actualUnit,
    note: saved.note ?? ''
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

function calculate(form: FormState): DamageRecord {
  const attack = toNumber(form.attack);
  const coeff = toNumber(form.skillCoeff);
  const outsidePercent = toNumber(form.outside);
  const insidePercent = toNumber(form.inside);
  const finalBonusPercent = toNumber(form.finalBonus);
  const actualRaw = toNumber(form.actual);
  const actualUnit = toNumber(form.actualUnit, 1);
  const outside = percentToMultiplier(outsidePercent);
  const inside = percentToMultiplier(insidePercent);
  const finalBonus = percentToMultiplier(finalBonusPercent);
  const actual = actualRaw * actualUnit;
  const theory = attack * coeff * outside * inside * finalBonus;
  const diff = actual - theory;
  const error = theory === 0 ? Number.NaN : diff / theory;
  const ratio = theory === 0 ? Number.NaN : actual / theory;
  const skillMeta = skillOptions.find((item) => item.value === form.skill);

  return {
    id: Date.now(),
    skill: skillMeta?.name ?? '自定义',
    attack,
    coeff,
    outsidePercent,
    insidePercent,
    finalBonusPercent,
    outside,
    inside,
    finalBonus,
    actualRaw,
    actualUnit,
    actual,
    theory,
    diff,
    error,
    ratio,
    note: form.note?.trim() ?? ''
  };
}

function App() {
  const [form] = Form.useForm<FormState>();
  const [formState, setFormState] = useState<FormState>(() => normalizeSavedForm(loadJson<SavedFormState | null>(formStorageKey, null)));
  const [records, setRecords] = useState<DamageRecord[]>(() => loadJson<DamageRecord[]>(recordsStorageKey, []));
  const [messageApi, contextHolder] = message.useMessage();

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
    const next: FormState = { ...defaultForm, ...values };
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
      outside: record.outsidePercent ?? multiplierToPercent(record.outside),
      inside: record.insidePercent ?? multiplierToPercent(record.inside),
      finalBonus: record.finalBonusPercent ?? multiplierToPercent(record.finalBonus),
      actual: record.actualRaw ?? record.actual,
      actualUnit: record.actualUnit ?? 1,
      note: record.note ?? ''
    });
  }

  async function copyTable() {
    if (records.length === 0) return;
    const header = ['技能', '攻击力', '系数', '局外%', '局内%', '最终%', '理论', '实测', '实测输入', '单位', '差值', '偏差', '实测/理论', '备注'];
    const rows = records.map((record) => [
      record.skill,
      record.attack,
      record.coeff,
      record.outsidePercent ?? multiplierToPercent(record.outside),
      record.insidePercent ?? multiplierToPercent(record.inside),
      record.finalBonusPercent ?? multiplierToPercent(record.finalBonus),
      formatDamage(record.theory),
      formatDamage(record.actual),
      record.actualRaw ?? record.actual,
      unitLabel(record.actualUnit ?? 1),
      formatDamage(record.diff),
      formatPercent(record.error),
      formatPercent(record.ratio, 1),
      record.note || ''
    ]);
    await navigator.clipboard.writeText([header, ...rows].map((row) => row.join('\t')).join('\n'));
    messageApi.success('已复制表格');
  }

  const columns: TableColumnsType<DamageRecord> = [
    { title: '#', width: 56, render: (_value, _record, index) => index + 1 },
    { title: '技能', dataIndex: 'skill', width: 108, fixed: 'left' },
    { title: '攻击力', dataIndex: 'attack', align: 'right', render: (value) => formatNumber(value) },
    { title: '系数', dataIndex: 'coeff', align: 'right', render: (value) => formatNumber(value) },
    {
      title: '局外%',
      dataIndex: 'outsidePercent',
      align: 'right',
      render: (_value, record) => formatRawPercent(record.outsidePercent ?? multiplierToPercent(record.outside))
    },
    {
      title: '局内%',
      dataIndex: 'insidePercent',
      align: 'right',
      render: (_value, record) => formatRawPercent(record.insidePercent ?? multiplierToPercent(record.inside))
    },
    {
      title: '最终%',
      dataIndex: 'finalBonusPercent',
      align: 'right',
      render: (_value, record) => formatRawPercent(record.finalBonusPercent ?? multiplierToPercent(record.finalBonus))
    },
    { title: '理论', dataIndex: 'theory', align: 'right', render: formatDamage },
    { title: '实测', dataIndex: 'actual', align: 'right', render: formatDamage },
    { title: '差值', dataIndex: 'diff', align: 'right', render: formatDamage },
    { title: '偏差', dataIndex: 'error', align: 'right', render: (value) => formatPercent(value) },
    { title: '实测/理论', dataIndex: 'ratio', align: 'right', render: (value) => formatPercent(value, 1) },
    { title: '备注', dataIndex: 'note', width: 160, render: (value) => value || '-' },
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
            <Text type="secondary">技能倍率口径：6.24 版本</Text>
          </div>
        </header>

        <Card className="formula-card" size="small">
          理论伤害 = 攻击力 × 技能系数 × (1 + 局外增伤%) × (1 + 局内增伤%) × (1 + 最终增伤%)
        </Card>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={9}>
            <Card title="输入">
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
                    <Form.Item label="局外增伤（%）" name="outside">
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="局内增伤（%）" name="inside">
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label="最终增伤（%）" name="finalBonus">
                      <InputNumber step="any" className="full-width" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="实测伤害">
                      <Space.Compact className="full-width">
                        <Form.Item name="actual" noStyle>
                          <InputNumber min={0} step="any" className="actual-input" />
                        </Form.Item>
                        <Form.Item name="actualUnit" noStyle>
                          <Select className="unit-select" options={unitOptions} />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="备注" name="note">
                  <Input maxLength={40} placeholder="例：带宽爆破，无祝福" />
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

          <Col xs={24} lg={15}>
            <Card title="结果">
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} xl={6}>
                  <Statistic title="理论伤害" value={formatDamage(result.theory)} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Statistic title="伤害差值" value={formatDamage(result.diff)} valueStyle={{ color: Math.abs(result.diff) < 1 ? '#1f8f5f' : '#c93535' }} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Statistic title="偏差" value={formatPercent(result.error)} valueStyle={{ color: Math.abs(result.error) <= 0.005 ? '#1f8f5f' : '#ff5c01' }} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Statistic title="实测/理论" value={formatPercent(result.ratio, 1)} />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

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
            scroll={{ x: 1320 }}
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
