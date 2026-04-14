"use client";

import { useRef, useState } from "react";
import { C, Company, Contract, Employee } from "@/lib/types";

type Props = {
  contract: Contract;
  employee: Employee;
  company: Company | null;
  onClose: () => void;
};

const isKoyouType = (type: string) => type === "koyou_muki" || type === "koyou_yuki";

export default function ContractPreview({ contract, employee, company, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isKoyou = isKoyouType(contract.documentType);
  const isYuki = contract.isYuki;
  const title = isKoyou ? "雇用契約書" : "労働条件通知書";

  const handlePdf = async () => {
    if (!printRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      // A4に収まるようにスケーリング（幅・高さの小さい方の比率に合わせる）
      const ratioW = pdfW / canvas.width;
      const ratioH = pdfH / canvas.height;
      const ratio = Math.min(ratioW, ratioH);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const xOffset = (pdfW - imgW) / 2;
      const yOffset = (pdfH - imgH) / 2;
      pdf.addImage(imgData, "PNG", xOffset, yOffset, imgW, imgH);
      pdf.save(`${title}_${employee.name}.pdf`);
    } catch (e) {
      console.error("PDF生成エラー:", e);
      alert("PDF生成に失敗しました");
    } finally {
      setPdfLoading(false);
    }
  };

  const companyName = company?.name || "";
  const companyAddress = company?.address || "";
  const companyRep = company?.representative || "";
  const workRulesLocation = company?.workRulesLocation || "";

  // 表セルスタイル
  const thStyle: React.CSSProperties = {
    width: 100, padding: "6px 10px", fontSize: 12, fontWeight: 600,
    background: "#f8f6f3", borderBottom: "1px solid #333",
    borderRight: "1px solid #333", verticalAlign: "top", color: "#333",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "6px 10px", borderBottom: "1px solid #333",
    verticalAlign: "top", fontSize: 12, lineHeight: 1.7,
  };
  const markStyle: React.CSSProperties = {
    fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2,
  };

  // ○ で選択表示
  const sel = (val: string, options: string[]) =>
    options.map((o) => (o === val ? <span key={o} style={markStyle}>〇{o}</span> : <span key={o}>{o}</span>)).reduce<React.ReactNode[]>((a, b, i) => i === 0 ? [b] : [...a, "・", b], []);

  const yesNo = (v: boolean) => v ? <span style={markStyle}>有</span> : <span style={markStyle}>無</span>;

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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            style={{
              padding: "8px 24px", fontSize: 13, fontWeight: 600,
              color: C.white, background: pdfLoading ? C.gray : C.green,
              border: "none", borderRadius: 6, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {pdfLoading ? "PDF生成中..." : "PDF出力"}
          </button>
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
        <div ref={printRef} style={{
          background: "#fff", padding: "48px 56px",
          width: "210mm", minHeight: "297mm", boxSizing: "border-box",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', 'MS PMincho', serif",
          color: "#1a1a1a", lineHeight: 1.6, fontSize: 12,
        }}>

          {/* タイトル */}
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 12, marginBottom: 16 }}>
            {title}
          </h1>

          {/* 日付 右寄せ */}
          <div style={{ textAlign: "right", fontSize: 13, marginBottom: 12 }}>
            令和{contract.issueDateYear}年{contract.issueDateMonth}月{contract.issueDateDay}日
          </div>

          {/* ヘッダー: 氏名殿（左）+ 事業所情報（右）同じ高さ */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2, fontSize: 13 }}>
            <div>氏名　<span style={{ fontWeight: 600 }}>{employee.name}</span>　殿</div>
            <div style={{ textAlign: "right" }}>所在地　{companyAddress}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, marginBottom: 2 }}>
            名　称　{companyName}
          </div>

          {/* 雇用契約書: 代表取締役 + 印 右寄せ / 労働条件通知書: 代表取締役 右寄せ */}
          {isKoyou ? (
            <div style={{ textAlign: "right", fontSize: 13, marginBottom: 12 }}>
              代表取締役　{companyRep}　㊞
            </div>
          ) : (
            <div style={{ textAlign: "right", fontSize: 13, marginBottom: 12 }}>
              代表取締役　{companyRep}
            </div>
          )}

          <div style={{ fontSize: 13, marginBottom: 12 }}>雇用条件は次のとおりとします。</div>

          {/* 本文テーブル */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #333", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col />
            </colgroup>
            <tbody>

              {/* 契約期間 */}
              <tr>
                <td style={thStyle}>契約期間</td>
                <td style={tdStyle}>
                  {isYuki ? (
                    <>
                      <div>期間の定めあり（令和{contract.contractStartYear}年{contract.contractStartMonth}月{contract.contractStartDay}日　～　令和{contract.contractEndYear}年{contract.contractEndMonth}月{contract.contractEndDay}日）</div>
                      <div style={{ marginTop: 4 }}>１　契約の更新の有無</div>
                      <div>［　{(() => { const map: Record<string, string> = { "自動更新": "自動的に更新する", "更新あり": "更新の場合あり", "更新なし": "契約の更新は無", "その他": "その他" }; const labels = ["自動的に更新する", "更新の場合あり", "契約の更新は無", "その他"]; const matched = map[contract.renewalType] || contract.renewalType; return sel(matched, labels); })()}　］</div>
                      <div style={{ marginTop: 4 }}>２　契約の更新は次により判断する</div>
                      <div>・契約期間満了時の業務量　・勤務成績、態度　・能力　・会社の経営状況</div>
                      <div>・従事している業務の進捗状況　・その他（　　　）</div>
                      <div style={{ marginTop: 4 }}>３　更新上限の有無（{contract.renewalLimitType === "無" || !contract.renewalLimitType ? <span style={markStyle}>無</span> : "無"}・{contract.renewalLimitType && contract.renewalLimitType !== "無" ? <span style={markStyle}>有</span> : "有"}（更新　{contract.renewalLimitType === "回数" ? <span style={markStyle}>{contract.renewalLimitCount}</span> : "　"}回まで／通算契約期間　{contract.renewalLimitType === "期間" ? <span style={markStyle}>{contract.renewalLimitYears}</span> : "　"}年まで））</div>
                      <div style={{ marginTop: 4 }}>【労働契約法に定める同一の企業との間での通算契約期間が５年を超える有期労働契約の締結の場合】</div>
                      <div>本契約期間中に会社に対して期間の定めのない労働契約（無期労働契約）の締結の申込みをすることにより、本契約期間の末日の翌日から、無期労働契約での雇用に転換することができる。この場合の本契約からの労働条件の変更の有無（　{contract.conditionChangeType === "無" || !contract.conditionChangeType ? <span style={markStyle}>無</span> : "無"}　・　{contract.conditionChangeType === "有" ? <span style={markStyle}>有（別紙のとおり）</span> : "有（別紙のとおり）"}　）</div>
                    </>
                  ) : (
                    <>
                      <div>期間の定めなし（　令和{contract.contractStartYear}年{contract.contractStartMonth}月{contract.contractStartDay}日～　）</div>
                      {contract.trialPeriodMonths > 0 && (
                        <div>※但し、契約期間開始より{contract.trialPeriodMonths}か月を試用期間とする。</div>
                      )}
                    </>
                  )}
                </td>
              </tr>

              {/* 雇用形態 */}
              <tr>
                <td style={thStyle}>雇用形態</td>
                <td style={tdStyle}>
                  {sel(contract.employmentType, ["正社員", "契約社員", "パートタイマー", "嘱託"])}・その他（{contract.employmentType === "アルバイト" ? <span style={markStyle}>アルバイト</span> : "アルバイト"}）
                </td>
              </tr>

              {/* 就業の場所 */}
              <tr>
                <td style={thStyle}>就業の場所</td>
                <td style={tdStyle}>
                  <div>（雇入れ直後）{contract.workplaceInitial || ""}</div>
                  <div>（変更の範囲）{contract.workplaceRange || ""}</div>
                </td>
              </tr>

              {/* 従事する業務の内容 */}
              <tr>
                <td style={thStyle}>従事する<br />業務の内容</td>
                <td style={tdStyle}>
                  <div>（雇入れ直後）{contract.jobContentInitial || ""}</div>
                  <div>（変更の範囲）{contract.jobContentRange || ""}</div>
                </td>
              </tr>

              {/* 始業・終業の時刻及び休憩時間 */}
              <tr>
                <td style={thStyle}>始業・終業<br />の時刻及び<br />休憩時間</td>
                <td style={tdStyle}>
                  <div>１　始業・終業の時刻：（始業）{contract.startHour}時{contract.startMinute}分～（終業）{contract.endHour}時{contract.endMinute}分</div>
                  {contract.workTimeSystem && contract.workTimeSystem !== "固定" && (() => {
                    const labels: Record<string, string> = {
                      "変形1カ月": "1カ月単位の変形労働時間制",
                      "変形1年": "1年単位の変形労働時間制",
                      "変形1週間": "1週間単位の変形労働時間制",
                      "フレックス": "フレックスタイム制",
                      "みなし事業場外": "事業場外みなし労働時間制",
                      "みなし専門型": "専門業務型裁量労働制",
                      "みなし企画業務型": "企画業務型裁量労働制",
                    };
                    const label = labels[contract.workTimeSystem] || contract.workTimeSystem;
                    return (
                      <div>※{label}をとるため、上記時間内で週平均{contract.weeklyHours || 40}時間にシフト調整を行なう（シフト表を参照）。</div>
                    );
                  })()}
                  {contract.hasFlexibleSchedule && (
                    <div>※業務の繁閑に合わせて始業・終業の時刻を繰り上げ又は繰り下げる場合がある。</div>
                  )}
                  <div style={{ marginTop: 4 }}>２　休憩時間：労働時間6時間以上の場合45分、労働時間8時間以上の場合60分</div>
                </td>
              </tr>

              {/* 所定外労働の有無 */}
              <tr>
                <td style={thStyle}>所定外労働<br />の有無</td>
                <td style={tdStyle}>
                  <div>１　所定時間外労働の有無：　有</div>
                  <div>２　休日労働の有無：　有</div>
                </td>
              </tr>

              {/* 休日 */}
              <tr>
                <td style={thStyle}>休日</td>
                <td style={tdStyle}>
                  定例日：シフトによる休日(週{contract.weeklyDays ? Math.max(7 - contract.weeklyDays, 1) : 1}日以上)
                </td>
              </tr>

              {/* 休暇 */}
              <tr>
                <td style={thStyle}>休暇</td>
                <td style={tdStyle}>
                  <div>１　年次有給休暇　６ヶ月継続勤務した場合：労働基準法に準ずる。</div>
                  <div>２　その他の休暇　①有給の休暇（　無　）、②無給の休暇（　慶弔休暇　）</div>
                </td>
              </tr>

              {/* 賃金 */}
              <tr>
                <td style={thStyle}>賃金</td>
                <td style={tdStyle}>
                  <div>１　基本賃金：</div>
                  <div>
                    {contract.salaryType === "monthly" && <>基本給（<span style={markStyle}>{contract.basicSalary?.toLocaleString()}</span>円）</>}
                    {contract.salaryType === "hourly" && <>時給（<span style={markStyle}>{contract.hourlyWage?.toLocaleString()}</span>円）</>}
                  </div>
                  {(contract.fixedOvertimeAmount || contract.commuteAllowance) && (
                  <div style={{ marginTop: 4 }}>２　諸手当：</div>
                  )}
                  {contract.fixedOvertimeAmount > 0 && (
                  <div>
                    イ　固定残業手当（<span style={markStyle}>{contract.fixedOvertimeAmount.toLocaleString()}</span>円／月：みなし残業代として月{contract.fixedOvertimeHours || "　"}時間分を固定支給する。）
                  </div>
                  )}
                  {contract.commuteAllowance > 0 && (
                  <div>
                    {contract.fixedOvertimeAmount > 0 ? "ロ" : "イ"}　通勤手当（<span style={markStyle}>{contract.commuteAllowance.toLocaleString()}</span>円／{contract.commuteAllowanceType === "daily" ? "日" : "月"}{contract.commuteAllowanceMax ? <>　上限<span style={markStyle}>{contract.commuteAllowanceMax.toLocaleString()}</span>円／月</> : ""}　）
                  </div>
                  )}
                  {contract.salaryType !== "hourly" && (
                  <div style={{ marginTop: 4 }}>
                    総支給額　<span style={markStyle}>{contract.totalSalary?.toLocaleString() || 0}</span>円
                  </div>
                  )}
                  <div style={{ marginTop: 8 }}>３　法定時間外、休日又は深夜労働に対して支払われる割増賃金率</div>
                  <div>時間外　法定超　月60時間以内：　125％　　月60時間超：　150％</div>
                  <div>休日　　法定休日：　135％　　深夜：　25％</div>
                  <div style={{ marginTop: 4 }}>４　賃金締切日：{contract.payClosingDay || "毎月末日"}、賃金支払日：{contract.paymentDay || "翌月25日"}</div>
                  <div>５　支払方法：銀行振込</div>
                  <div>６　賃金支払時の控除：　{contract.hasDeduction === false || contract.hasDeduction === undefined && contract.deductionItems?.length === 0 ? <span style={markStyle}>無</span> : <><span style={markStyle}>有</span>　（{(contract.deductionItems && contract.deductionItems.length > 0 ? contract.deductionItems : ["所得税", "雇用保険", "社会保険"]).join("、")}）</>}</div>
                  <div>７　昇給：　{yesNo(contract.increment)}　〔勤務成績、業績等による〕</div>
                  <div>８　賞与：　{yesNo(contract.bonus)}　〔勤務成績、業績等による〕</div>
                  <div>９　退職金：　{yesNo(contract.retirementAllowance)}　〔{contract.retirementAllowanceDetail || "　　　　　　　　　"}〕</div>
                </td>
              </tr>

              {/* 退職に関する事項 */}
              <tr>
                <td style={thStyle}>退職に関す<br />る事項</td>
                <td style={tdStyle}>
                  <div>１　定年制：　有　（６０歳）（再雇用制度により６５歳まで）</div>
                  <div>２　自己都合退職の手続：退職する３０日以上前に届け出ること</div>
                  <div>３　解雇の事由及び手続：</div>
                </td>
              </tr>

              {/* 社会保険等の加入 */}
              <tr>
                <td style={thStyle}>社会保険等<br />の加入</td>
                <td style={tdStyle}>
                  <div>・社会保険の加入：　{contract.socialInsurance ? (
                    <>
                      <span style={markStyle}>イ　厚生年金</span>、　<span style={markStyle}>ロ　健康保険</span>
                      {contract.pensionFund && <span>、　<span style={markStyle}>ハ　厚生年金基金</span></span>}
                    </>
                  ) : <span style={markStyle}>無</span>}</div>
                  <div>・雇用保険の適用：　{yesNo(contract.employmentInsurance)}</div>
                </td>
              </tr>

              {/* 備考 */}
              {contract.remarks && (
                <tr>
                  <td style={thStyle}>備考</td>
                  <td style={tdStyle}>{contract.remarks}</td>
                </tr>
              )}

              {/* 就業規則 */}
              <tr>
                <td colSpan={2} style={{ ...tdStyle, borderBottom: "2px solid #333", fontSize: 12 }}>
                  以上のほかは、当社就業規則による。就業規則を確認できる場所や方法（{workRulesLocation || "　　　　　　"}）
                </td>
              </tr>
            </tbody>
          </table>

          {/* フッター */}
          {isKoyou ? (
            <>
              <div style={{ marginTop: 32, fontSize: 13, textAlign: "right" }}>
                上記について承諾しました。　令和{contract.issueDateYear}年{contract.issueDateMonth}月{contract.issueDateDay}日
              </div>
              <div style={{ marginTop: 12, fontSize: 13, textAlign: "right" }}>
                <span>従業員　</span>
                <span style={{ borderBottom: "1px solid #333", paddingBottom: 4 }}>氏名　{employee.name}　　㊞</span>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 32, fontSize: 13, textAlign: "right" }}>
              令和{contract.issueDateYear}年{contract.issueDateMonth}月{contract.issueDateDay}日
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
