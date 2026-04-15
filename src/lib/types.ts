export type Company = {
  id: string;
  userId: string;
  name: string;
  address: string;
  representative: string;
  phone: string;
  // 労働条件デフォルト
  defaultStartHour: string;
  defaultStartMinute: string;
  defaultEndHour: string;
  defaultEndMinute: string;
  defaultWeeklyHours: number;
  payClosingDay: string;
  paymentDay: string;
  incrementDefault: boolean;
  bonusDefault: boolean;
  retirementAllowanceDefault: boolean;
  retirementAllowanceDetail: string;
  workRulesLocation: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type Department = {
  id: string;
  userId: string;
  name: string;
  address: string; // 就業場所
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type Employee = {
  id: string;
  userId: string;
  departmentId: string; // 空文字 = 部署なし
  employeeNumber: string;
  name: string;
  address: string;
  email: string;
  status: string; // active | leave | retired
  retiredAt: unknown;
  retirementReason: string;
  retirementRemarks: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type Contract = {
  id: string;
  userId: string;
  departmentId: string;
  employeeId: string;
  documentType: string;
  // 基本情報
  issueDateYear: string;
  issueDateMonth: string;
  issueDateDay: string;
  // 雇用形態・契約期間
  employmentType: string;
  isYuki: boolean;
  isKoyou: boolean;
  contractStartYear: string;
  contractStartMonth: string;
  contractStartDay: string;
  contractEndYear: string;
  contractEndMonth: string;
  contractEndDay: string;
  renewalType: string;
  renewalJudgmentItems: string[];
  renewalLimitType: string; // "無" | "回数" | "期間"
  renewalLimitCount: number;
  renewalLimitYears: number;
  conditionChangeType: string; // "無" | "有"
  trialPeriodMonths: number;
  // 就業情報
  workplaceInitial: string;
  workplaceRange: string;
  jobContentInitial: string;
  jobContentRange: string;
  // 労働時間
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  weeklyHours: number;
  weeklyHoursMax: number; // 範囲の上限（0なら範囲なし、例: weeklyHours=20, weeklyHoursMax=25 → "20〜25時間"）
  weeklyDays: number;
  weeklyDaysMax: number; // 範囲の上限（0なら範囲なし）
  dependentCertNote: boolean; // 被扶養者認定に関する補足
  workTimeSystem: string; // "固定" | "変形1カ月" | "変形1年" | "変形1週間" | "フレックス" | "みなし事業場外" | "みなし専門型" | "みなし企画業務型"
  hasFlexibleSchedule: boolean; // 繰り上げ繰り下げの有無
  breakTimeType: string; // "法定" | "カスタム"
  breakTimeCustom: string; // 自由記載の休憩時間
  sideJobPolicy: string;
  teleworkAllowed: boolean;
  // 賃金
  salaryType: string;
  basicSalary: number;
  hourlyWage: number;
  fixedOvertimeAmount: number;
  fixedOvertimeHours: number;
  commuteAllowance: number;
  commuteAllowanceType: string; // "monthly" | "daily"
  commuteAllowanceMax: number;
  totalSalary: number;
  payClosingDay: string;
  paymentDay: string;
  increment: boolean;
  bonus: boolean;
  retirementAllowance: boolean;
  retirementAllowanceDetail: string;
  // 社保・雇用保険
  socialInsurance: boolean;
  employmentInsurance: boolean;
  pensionFund: boolean; // 厚生年金基金
  socialInsuranceOverride: boolean;
  employmentInsuranceOverride: boolean;
  // 控除
  hasDeduction: boolean;
  deductionItems: string[];
  // 管理情報
  studentType: string;
  recruitmentSource: string;
  remarks: string;
  // 送信管理
  sentAt: unknown;
  sentTo: string;
  // タイムスタンプ
  createdAt: unknown;
  updatedAt: unknown;
};

export const C = {
  navy: "#1C2B4A",
  gold: "#B8905A",
  cream: "#F4F1EC",
  pale: "#F7EEE0",
  green: "#2D6A4F",
  red: "#C53030",
  gray: "#777",
  light: "#e8e2da",
  white: "#fff",
};
