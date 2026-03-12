import { Contract, Employee } from "./types";

export type Alert = {
  type: "danger" | "warning" | "info";
  message: string;
  employeeId: string;
  employeeName: string;
};

// 令和→西暦変換
function reiwaToDate(y: string, m: string, d: string): Date | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || !month || !day) return null;
  return new Date(year + 2018, month - 1, day);
}

export function calcAlerts(
  employees: Employee[],
  contracts: Contract[]
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const emp of employees) {
    if (emp.status !== "active") continue;

    // この従業員の最新契約
    const empContracts = contracts
      .filter((c) => c.employeeId === emp.id)
      .sort((a, b) => {
        const aTime = a.createdAt && typeof a.createdAt === "object" && "toMillis" in a.createdAt
          ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const bTime = b.createdAt && typeof b.createdAt === "object" && "toMillis" in b.createdAt
          ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return bTime - aTime;
      });

    if (empContracts.length === 0) continue;
    const latest = empContracts[0];

    // 有期契約の満了チェック
    if (latest.isYuki && latest.contractEndYear) {
      const endDate = reiwaToDate(
        latest.contractEndYear,
        latest.contractEndMonth,
        latest.contractEndDay
      );
      if (endDate) {
        if (endDate < now) {
          alerts.push({
            type: "danger",
            message: "契約期間が満了しています",
            employeeId: emp.id,
            employeeName: emp.name,
          });
        } else if (endDate < in30days) {
          alerts.push({
            type: "warning",
            message: `契約満了まであと${Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))}日`,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
    }

    // 無期契約の試用期間チェック
    if (!latest.isYuki && latest.trialPeriodMonths > 0 && latest.contractStartYear) {
      const startDate = reiwaToDate(
        latest.contractStartYear,
        latest.contractStartMonth,
        latest.contractStartDay
      );
      if (startDate) {
        const trialEnd = new Date(startDate);
        trialEnd.setMonth(trialEnd.getMonth() + latest.trialPeriodMonths);
        if (trialEnd > now && trialEnd < in30days) {
          alerts.push({
            type: "info",
            message: `試用期間終了まであと${Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))}日`,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
    }

    // 未送信の契約書チェック
    if (!latest.sentAt) {
      alerts.push({
        type: "warning",
        message: "契約書が未送信です",
        employeeId: emp.id,
        employeeName: emp.name,
      });
    }
  }

  // 危険度順にソート
  const priority = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => priority[a.type] - priority[b.type]);

  return alerts;
}
