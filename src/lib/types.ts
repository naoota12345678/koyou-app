export type Department = {
  id: string;
  userId: string;
  name: string;
  address: string;
  representative: string;
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

export type Employee = {
  id: string;
  userId: string;
  companyId: string;
  employeeNumber: string;
  name: string;
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
  companyId: string;
  employeeId: string;
  documentType: string;
  // STEP1: 基本情報
  issueDateYear: string;
  issueDateMonth: string;
  issueDateDay: string;
  // STEP2: 雇用形態・契約期間
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
  trialPeriodMonths: number;
  // STEP3: 就業情報
  workplaceInitial: string;
  workplaceRange: string;
  jobContentInitial: string;
  jobContentRange: string;
  // STEP4: 労働時間
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  weeklyHours: number;
  weeklyDays: number;
  sideJobPolicy: string;
  teleworkAllowed: boolean;
  // STEP5: 賃金
  salaryType: string;
  basicSalary: number;
  hourlyWage: number;
  fixedOvertimeAmount: number;
  fixedOvertimeHours: number;
  commuteAllowance: number;
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
  socialInsuranceOverride: boolean;
  employmentInsuranceOverride: boolean;
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
