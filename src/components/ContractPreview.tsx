"use client";

import { C, Company, Contract, Employee } from "@/lib/types";
import { documentTypeLabel } from "@/lib/insurance";

type Props = {
  contract: Contract;
  employee: Employee;
  company: Company | null;
  onClose: () => void;
};

function formatReiwa(year: string, month: string, day: string): string {
  if (!year || !month || !day) return "";
  return `令和${year}年${month}月${day}日`;
}

function salaryLabel(contract: Contract): string {
  if (contract.salaryType === "monthly") {
    return `月給 ${contract.basicSalary?.toLocaleString() || 0}円`;
  }
  return `時給 ${contract.hourlyWage?.toLocaleString() || 0}円`;
}

const isKoyouType = (type: string) => type === "koyou_muki" || type === "koyou_yuki";

export default function ContractPreview({ contract, employee, company, onClose }: Props) {
  const companyName = company?.name || "（事業所名）";
  const companyAddress = company?.address || "";
  const companyRep = company?.representative || "";
  const isKoyou = isKoyouType(contract.documentType);
  const isYuki = contract.isYuki;
  const title = isKoyou ? "雇用契約書" : "労働条件通知書";
  const issueDate = formatReiwa(contract.issueDateYear, contract.issueDateMonth, contract.issueDateDay);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 2000, overflow: "auto", padding: "40px 20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "relative", width: "100%", maxWidth: 780 }}>
        {/* 操作バー */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 24px", fontSize: 13, fontWeight: 600,
              color: C.white, background: C.navy,
              border: "none", borderRadius: 6, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            閉じる
          </button>
        </div>

        {/* A4 用紙風 */}
        <div style={{
          background: "#fff", padding: "60px 64px", minHeight: 1000,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', 'MS PMincho', serif",
          color: "#1a1a1a", lineHeight: 1.8, fontSize: 14,
        }}>

          {/* 通知書スタイルヘッダー */}
          {!isKoyou && (
            <div style={{
              textAlign: "right", fontSize: 12, color: "#555",
              marginBottom: 8, borderBottom: "1px solid #ccc", paddingBottom: 8,
            }}>
              通知
            </div>
          )}

          {/* タイトル */}
          <h1 style={{
            textAlign: "center", fontSize: 24, fontWeight: 700,
            letterSpacing: 8, marginBottom: 4, color: "#1a1a1a",
          }}>
            {title}
          </h1>
          <div style={{
            textAlign: "center", fontSize: 13, color: "#555", marginBottom: 32,
          }}>
            {documentTypeLabel(contract.documentType)}
          </div>

          {/* 日付 */}
          <div style={{ textAlign: "right", fontSize: 14, marginBottom: 24 }}>
            {issueDate}
          </div>

          {/* 当事者 */}
          {isKoyou ? (
            <div style={{ marginBottom: 28 }}>
              <div style={{ marginBottom: 6, fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>甲（使用者）：</span>
                {companyName}
                {companyRep && ` 代表取締役 ${companyRep}`}
              </div>
              <div style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>乙（労働者）：</span>
                {employee.name} 殿
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
                甲と乙は、以下の条件により雇用契約を締結する。
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 28 }}>
              <div style={{ marginBottom: 8, fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{employee.name}</span> 殿
              </div>
              <div style={{ textAlign: "right", fontSize: 14, marginBottom: 8 }}>
                {companyName}
                {companyRep && <><br />代表取締役 {companyRep}</>}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
                以下の労働条件により通知いたします。
              </div>
            </div>
          )}

          {/* 本文 */}
          <table style={{
            width: "100%", borderCollapse: "collapse",
            border: "2px solid #333", marginBottom: 28,
          }}>
            <tbody>
              {/* 契約期間 */}
              <Section title="1. 契約期間">
                {isYuki ? (
                  <>
                    <div>期間の定めあり</div>
                    <div>
                      {formatReiwa(contract.contractStartYear, contract.contractStartMonth, contract.contractStartDay)}
                      {" ～ "}
                      {formatReiwa(contract.contractEndYear, contract.contractEndMonth, contract.contractEndDay)}
                    </div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                      更新: {contract.renewalType || "-"}
                    </div>
                  </>
                ) : (
                  <>
                    <div>期間の定めなし</div>
                    <div>
                      {formatReiwa(contract.contractStartYear, contract.contractStartMonth, contract.contractStartDay)} より
                    </div>
                    {contract.trialPeriodMonths > 0 && (
                      <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                        試用期間: {contract.trialPeriodMonths}ヶ月
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* 就業場所 */}
              <Section title="2. 就業の場所">
                <div>
                  <span style={{ fontSize: 12, color: "#777" }}>雇入れ直後: </span>
                  {contract.workplaceInitial || "-"}
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#777" }}>変更の範囲: </span>
                  {contract.workplaceRange || "-"}
                </div>
              </Section>

              {/* 業務内容 */}
              <Section title="3. 従事すべき業務の内容">
                <div>
                  <span style={{ fontSize: 12, color: "#777" }}>雇入れ直後: </span>
                  {contract.jobContentInitial || "-"}
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#777" }}>変更の範囲: </span>
                  {contract.jobContentRange || "-"}
                </div>
              </Section>

              {/* 労働時間 */}
              <Section title="4. 労働時間等">
                <div>
                  始業 {contract.startHour}:{contract.startMinute}
                  {"　"}
                  終業 {contract.endHour}:{contract.endMinute}
                </div>
                <div>
                  所定労働時間: 週{contract.weeklyHours}時間 / 週{contract.weeklyDays}日勤務
                </div>
                {contract.teleworkAllowed && (
                  <div style={{ fontSize: 13, color: "#555" }}>テレワーク勤務あり</div>
                )}
                <div style={{ fontSize: 13, color: "#555" }}>
                  副業・兼業: {contract.sideJobPolicy || "-"}
                </div>
              </Section>

              {/* 賃金 */}
              <Section title="5. 賃金">
                <div style={{ fontWeight: 600 }}>
                  {salaryLabel(contract)}
                </div>
                {contract.salaryType === "monthly" && contract.fixedOvertimeAmount > 0 && (
                  <div style={{ fontSize: 13 }}>
                    固定残業手当: {contract.fixedOvertimeAmount.toLocaleString()}円
                    （{contract.fixedOvertimeHours}時間分）
                  </div>
                )}
                {contract.commuteAllowance > 0 && (
                  <div style={{ fontSize: 13 }}>
                    通勤手当: {contract.commuteAllowance.toLocaleString()}円/月
                  </div>
                )}
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  総支給額: {contract.totalSalary?.toLocaleString() || 0}円
                </div>
                <div style={{ borderTop: "1px dashed #bbb", marginTop: 8, paddingTop: 8, fontSize: 13 }}>
                  <div>賃金締切日: {contract.payClosingDay || "-"}</div>
                  <div>支払日: {contract.paymentDay || "-"}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  昇給: {contract.increment ? "あり" : "なし"}
                  {"　"}
                  賞与: {contract.bonus ? "あり" : "なし"}
                </div>
              </Section>

              {/* 退職金 */}
              <Section title="6. 退職に関する事項">
                <div>退職金制度: {contract.retirementAllowance ? "あり" : "なし"}</div>
                {contract.retirementAllowance && contract.retirementAllowanceDetail && (
                  <div style={{ fontSize: 13, color: "#555" }}>{contract.retirementAllowanceDetail}</div>
                )}
              </Section>

              {/* 社会保険 */}
              <Section title="7. 社会保険・雇用保険">
                <div style={{ display: "flex", gap: 32 }}>
                  <div>
                    社会保険:
                    <span style={{ fontWeight: 600, color: contract.socialInsurance ? "#2D6A4F" : "#C53030", marginLeft: 8 }}>
                      {contract.socialInsurance ? "加入" : "非加入"}
                    </span>
                  </div>
                  <div>
                    雇用保険:
                    <span style={{ fontWeight: 600, color: contract.employmentInsurance ? "#2D6A4F" : "#C53030", marginLeft: 8 }}>
                      {contract.employmentInsurance ? "加入" : "非加入"}
                    </span>
                  </div>
                </div>
              </Section>

              {/* その他 */}
              <Section title="8. その他">
                <div style={{ fontSize: 13 }}>雇用形態: {contract.employmentType || "-"}</div>
                {company?.workRulesLocation && (
                  <div style={{ fontSize: 13 }}>就業規則の確認: {company.workRulesLocation}</div>
                )}
                {contract.remarks && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    備考: {contract.remarks}
                  </div>
                )}
              </Section>
            </tbody>
          </table>

          {/* 署名欄（雇用契約書のみ） */}
          {isKoyou && (
            <div style={{ marginTop: 48 }}>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>
                上記の内容について、甲乙双方が合意し、本契約を締結する。
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 40, marginTop: 32 }}>
                {/* 甲 */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>甲（使用者）</div>
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 12, fontSize: 13 }}>
                    所在地: {companyAddress}
                  </div>
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 12, fontSize: 13 }}>
                    名称: {companyName}
                  </div>
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 12, fontSize: 13 }}>
                    代表者: {companyRep}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 20 }}>
                    <span style={{ fontSize: 12, color: "#777" }}>印</span>
                    <div style={{
                      width: 48, height: 48, border: "1px dashed #bbb", borderRadius: "50%",
                    }} />
                  </div>
                </div>
                {/* 乙 */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>乙（労働者）</div>
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 12, fontSize: 13 }}>
                    住所:
                  </div>
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 12, fontSize: 13 }}>
                    氏名: {employee.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 20 }}>
                    <span style={{ fontSize: 12, color: "#777" }}>印</span>
                    <div style={{
                      width: 48, height: 48, border: "1px dashed #bbb", borderRadius: "50%",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 通知書フッター */}
          {!isKoyou && (
            <div style={{ marginTop: 48, fontSize: 12, color: "#777", textAlign: "center" }}>
              本通知書は、労働基準法第15条に基づき労働条件を明示するものです。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{
        width: 180, padding: "12px 16px", fontSize: 13, fontWeight: 600,
        background: "#f8f6f3", borderBottom: "1px solid #999",
        borderRight: "1px solid #999", verticalAlign: "top",
        color: "#333",
      }}>
        {title}
      </td>
      <td style={{
        padding: "12px 16px", borderBottom: "1px solid #999",
        verticalAlign: "top", fontSize: 14,
      }}>
        {children}
      </td>
    </tr>
  );
}
