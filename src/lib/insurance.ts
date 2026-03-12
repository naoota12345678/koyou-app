import { Employee, Contract } from "./types";

// 特定適用事業所判定（在職中かつ週30時間以上が51人以上）
export function calcIsTokutei(employees: Employee[], contracts: Contract[]): boolean {
  const activeEmpIds = new Set(employees.filter((e) => e.status === "active").map((e) => e.id));
  const count = contracts.filter(
    (c) => activeEmpIds.has(c.employeeId) && c.weeklyHours >= 30
  ).length;
  return count >= 51;
}

// 個人の社保・雇用保険判定
export function calcInsurance(
  contract: { weeklyHours: number; totalSalary: number; studentType: string },
  isTokutei: boolean
): { socialInsurance: boolean; employmentInsurance: boolean } {
  const h = contract.weeklyHours || 0;
  const isHirumaStudent = contract.studentType === "昼間学生";
  const salary = contract.totalSalary || 0;

  if (isHirumaStudent) {
    return { socialInsurance: false, employmentInsurance: false };
  }

  let socialInsurance = false;
  let employmentInsurance = false;

  if (isTokutei) {
    socialInsurance = h >= 20 && salary >= 88000;
    employmentInsurance = h >= 20;
  } else {
    socialInsurance = h >= 30;
    employmentInsurance = h >= 20;
  }

  return { socialInsurance, employmentInsurance };
}

// 書類種別の自動決定
export function calcDocumentType(isYuki: boolean, isKoyou: boolean): string {
  if (isKoyou && !isYuki) return "koyou_muki";
  if (isKoyou && isYuki) return "koyou_yuki";
  if (!isKoyou && !isYuki) return "roudou_muki";
  return "roudou_yuki";
}

export function documentTypeLabel(type: string): string {
  switch (type) {
    case "koyou_muki": return "雇用契約書（無期）";
    case "koyou_yuki": return "雇用契約書（有期）";
    case "roudou_muki": return "労働条件通知書（無期）";
    case "roudou_yuki": return "労働条件通知書（有期）";
    default: return "";
  }
}
