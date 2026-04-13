"use client";

import { useState, useRef } from "react";
import { C, Employee, Contract, Company } from "@/lib/types";
import { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calcDocumentType } from "@/lib/insurance";

type Props = {
  user: User;
  company: Company | null;
  allEmployees: Employee[];
  allContracts: Contract[];
  onClose: () => void;
  onDone: () => void;
};

type ParsedRow = {
  name: string;
  email: string;
  employmentType: string;
  isYuki: boolean;
  contractStartDate: string;
  contractEndDate: string;
  renewalType: string;
  renewalJudgmentItems: string[];
  workplace: string;
  jobContent: string;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  weeklyHours: number;
  salaryType: string;
  basicSalary: number;
  hourlyWage: number;
  commuteAllowance: number;
  commuteAllowanceType: string;
  payClosingDay: string;
  paymentDay: string;
  increment: boolean;
  bonus: boolean;
  retirementAllowance: boolean;
  retirementAllowanceDetail: string;
  socialInsurance: boolean;
  employmentInsurance: boolean;
  remarks: string;
  raw: Record<string, string>;
};

function decodeShiftJIS(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("shift_jis");
  return decoder.decode(buffer);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] || "").trim(); });
    rows.push(row);
  }
  return rows;
}

function parseTime(timeStr: string): { hour: string; minute: string } {
  if (!timeStr) return { hour: "", minute: "00" };
  const parts = timeStr.split(":");
  return { hour: parts[0] || "", minute: parts[1] || "00" };
}

function parseDate(dateStr: string): { year: string; month: string; day: string; reiwaYear: string } {
  if (!dateStr) return { year: "", month: "", day: "", reiwaYear: "" };
  const parts = dateStr.split("/");
  const y = parseInt(parts[0] || "0");
  const m = parts[1] || "";
  const d = parts[2] || "";
  return { year: String(y), month: String(parseInt(m)), day: String(parseInt(d)), reiwaYear: String(y - 2018) };
}

function mapRow(raw: Record<string, string>): ParsedRow | null {
  const name = raw["氏名"];
  if (!name) return null;

  const isYuki = raw["期間の定め[有]"] === "1";

  // 勤務時間: 固定→変形→フレックスの順で探す
  const isFixed = raw["①固定勤務[適用]"] === "1";
  const isHenkei = raw["②変形労働時間制[適用]"] === "1";
  let startTimeStr = "";
  let endTimeStr = "";
  if (isFixed) {
    startTimeStr = raw["始業時刻"] || "";
    endTimeStr = raw["終業時刻"] || "";
  } else if (isHenkei) {
    startTimeStr = raw["①始業時刻"] || "";
    endTimeStr = raw["①終業時刻"] || "";
  } else {
    // フレックス等: どこかに入っている時刻を探す
    startTimeStr = raw["始業時刻"] || raw["①始業時刻"] || "";
    endTimeStr = raw["終業時刻"] || raw["①終業時刻"] || "";
  }
  const startTime = parseTime(startTimeStr);
  const endTime = parseTime(endTimeStr);

  // 雇用形態マッピング
  const empType = raw["雇用形態"] || "正社員";

  // 更新判断項目
  const renewalItems: string[] = [];
  if (raw["契約の更新の判断[契約期間満了時の業務量]"] === "1") renewalItems.push("業務量");
  if (raw["契約の更新の判断[勤務成績・態度]"] === "1") renewalItems.push("勤務成績・態度");
  if (raw["契約の更新の判断[能力]"] === "1") renewalItems.push("能力");
  if (raw["契約の更新の判断[会社の経営状況]"] === "1") renewalItems.push("会社の経営状況");
  if (raw["契約の更新の判断[従事している業務の進捗状況]"] === "1") renewalItems.push("業務進捗状況");

  // 更新タイプ（ContractFormの選択肢: 自動更新/更新あり/更新なし/その他）
  let renewalType = "自動更新";
  if (raw["契約の更新の有無[自動的に更新する]"] === "1") renewalType = "自動更新";
  else if (raw["契約の更新の有無[更新する場合がある]"] === "1") renewalType = "更新あり";
  else if (raw["契約の更新の有無[契約の更新はしない]"] === "1") renewalType = "更新なし";
  else if (raw["契約の更新の有無[その他]"] === "1") renewalType = "その他";

  // 賃金タイプ判定（金額は「ハ 時間給」「イ 基本給」カラムに入る）
  const hourlyWageVal = Number(raw["ハ 時間給"] || raw["ハ"] || 0);
  const basicSalaryVal = Number(raw["イ 基本給"] || raw["イ"] || 0);
  const salaryType = hourlyWageVal > 0 ? "hourly" : "monthly";

  // 週労働時間
  const weeklyHoursStr = raw["所定週労働時間"] || "";
  let weeklyHours = parseFloat(weeklyHoursStr) || 0;
  // 備考から週時間を抽出（「週 20 時間」パターン）
  const remarksText = raw["備考"] || "";
  if (!weeklyHours) {
    const match = remarksText.match(/週\s*(\d+)\s*時間/);
    if (match) weeklyHours = parseFloat(match[1]);
  }
  if (!weeklyHours) weeklyHours = 40;

  // 通勤手当（「ホ その他」「ホ」「イ」等のカラムから通勤情報を探す）
  let commuteAllowance = 0;
  let commuteAllowanceType = "monthly";
  const commuteSource = [raw["ホ その他"], raw["ホ"], raw["イ"], raw["ロ"]].find((v) => v && /通勤|交通/.test(v)) || "";
  const commuteMatch = commuteSource.match(/(\d+)\s*円/);
  if (commuteMatch) {
    commuteAllowance = parseInt(commuteMatch[1]);
    if (commuteSource.includes("/日") || commuteSource.includes("日額")) {
      commuteAllowanceType = "daily";
    }
  }

  // 賃金締切日・支払日
  const payClosingDay = raw["賃金締切日"] || "末日";
  const paymentDay = raw["賃金支払日"] || "翌月25日";

  // 昇給・賞与・退職金
  const increment = raw["昇給〔勤務成績・業績等による〕[有]"] === "1";
  const bonus = raw["賞与〔勤務成績・業績等による〕[有]"] === "1";
  const retirementAllowance = raw["退職金[有]"] === "1";

  // 退職金詳細（定年の情報を含める）
  let retirementDetail = "";
  if (raw["年齢"]) retirementDetail = `定年${raw["年齢"]}`;

  // 社保・雇保
  const socialInsurance = raw["社会保険の加入[有]"] === "1";
  const employmentInsurance = raw["雇用保険の加入[有]"] === "1";

  return {
    name,
    email: raw["メールアドレス"] || "",
    employmentType: empType,
    isYuki,
    contractStartDate: raw["契約期間開始日"] || "",
    contractEndDate: raw["契約期間満了日"] || "",
    renewalType,
    renewalJudgmentItems: renewalItems,
    workplace: raw["就業の場所"] || "",
    jobContent: raw["従事すべき業務内容"] || "",
    startHour: startTime.hour,
    startMinute: startTime.minute,
    endHour: endTime.hour,
    endMinute: endTime.minute,
    weeklyHours,
    salaryType,
    basicSalary: basicSalaryVal,
    hourlyWage: hourlyWageVal,
    commuteAllowance,
    commuteAllowanceType,
    payClosingDay,
    paymentDay,
    increment,
    bonus,
    retirementAllowance,
    retirementAllowanceDetail: retirementDetail,
    socialInsurance,
    employmentInsurance,
    remarks: remarksText,
    raw,
  };
}

export default function CsvImport({ user, company, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    // Shift-JISで試す、ダメならUTF-8
    let text: string;
    try {
      text = decodeShiftJIS(buffer);
      if (!text.includes("氏名")) {
        text = new TextDecoder("utf-8").decode(buffer);
      }
    } catch {
      text = new TextDecoder("utf-8").decode(buffer);
    }
    const rawRows = parseCSV(text);
    const parsed = rawRows.map(mapRow).filter((r): r is ParsedRow => r !== null);
    setRows(parsed);
    setResult(null);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    const errors: string[] = [];
    let success = 0;

    const now = new Date();
    const reiwaYear = String(now.getFullYear() - 2018);

    for (const row of rows) {
      try {
        // 1. 従業員を登録
        const empRef = await addDoc(collection(db, "employees"), {
          userId: user.uid,
          name: row.name,
          employeeNumber: "",
          address: "",
          email: row.email,
          departmentId: "",
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. 契約情報を構築
        const startDate = parseDate(row.contractStartDate);
        const endDate = parseDate(row.contractEndDate);

        const isKoyou = true; // 雇用契約書として作成
        const documentType = calcDocumentType(row.isYuki, isKoyou);

        // 総支給額計算（時給の人は0）
        let totalSalary = 0;
        if (row.salaryType === "monthly") {
          totalSalary = row.basicSalary + row.commuteAllowance;
        }

        // 社保・雇保（CSVの値をそのまま使用、overrideとして設定）
        const contractData = {
          userId: user.uid,
          departmentId: "",
          employeeId: empRef.id,
          documentType,
          issueDateYear: reiwaYear,
          issueDateMonth: String(now.getMonth() + 1),
          issueDateDay: String(now.getDate()),
          employmentType: row.employmentType,
          isYuki: row.isYuki,
          isKoyou: isKoyou,
          contractStartYear: startDate.reiwaYear,
          contractStartMonth: startDate.month,
          contractStartDay: startDate.day,
          contractEndYear: endDate.reiwaYear || "",
          contractEndMonth: endDate.month,
          contractEndDay: endDate.day,
          renewalType: row.renewalType,
          trialPeriodMonths: 0,
          workplaceInitial: row.workplace || company?.address || "",
          workplaceRange: "会社の定める事業所",
          jobContentInitial: row.jobContent,
          jobContentRange: "会社の定める業務",
          startHour: row.startHour,
          startMinute: row.startMinute,
          endHour: row.endHour,
          endMinute: row.endMinute,
          weeklyHours: row.weeklyHours,
          weeklyDays: 5,
          sideJobPolicy: "届出制",
          teleworkAllowed: false,
          salaryType: row.salaryType === "hourly" ? "hourly" : "monthly",
          basicSalary: row.basicSalary,
          hourlyWage: row.hourlyWage,
          fixedOvertimeAmount: 0,
          fixedOvertimeHours: 0,
          commuteAllowance: row.commuteAllowance,
          commuteAllowanceType: row.commuteAllowanceType,
          commuteAllowanceMax: 0,
          totalSalary,
          payClosingDay: row.payClosingDay,
          paymentDay: row.paymentDay,
          increment: row.increment,
          bonus: row.bonus,
          retirementAllowance: row.retirementAllowance,
          retirementAllowanceDetail: row.retirementAllowanceDetail,
          socialInsurance: row.socialInsurance,
          employmentInsurance: row.employmentInsurance,
          pensionFund: false,
          socialInsuranceOverride: true,
          employmentInsuranceOverride: true,
          studentType: "学生でない",
          recruitmentSource: "直接",
          remarks: row.remarks,
          sentAt: null,
          sentTo: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, "contracts"), contractData);
        success++;
      } catch (e) {
        errors.push(`${row.name}: ${(e as Error).message}`);
      }
    }

    setResult({ success, errors });
    setImporting(false);
    if (errors.length === 0) {
      setTimeout(() => onDone(), 1500);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose(); }}
    >
      <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 720, maxHeight: "80vh", overflow: "auto" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>CSVインポート</h2>
        <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
          雇用契約書CSVファイルを選択して、従業員と契約書を一括登録します。
        </p>

        {/* ファイル選択 */}
        <div style={{ marginBottom: 20 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            CSVファイルを選択
          </button>
          {rows.length > 0 && (
            <span style={{ marginLeft: 12, fontSize: 13, color: C.green, fontWeight: 600 }}>
              {rows.length}件のデータを検出
            </span>
          )}
        </div>

        {/* プレビュー */}
        {rows.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 8 }}>取込プレビュー</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                    {["氏名", "メール", "雇用形態", "期間", "就業場所", "業務内容", "勤務時間", "賃金", "社保", "雇保"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.light}` }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", color: C.gray, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email || "-"}</td>
                      <td style={{ padding: "6px 8px" }}>{r.employmentType}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.isYuki ? "有期" : "無期"}</td>
                      <td style={{ padding: "6px 8px", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.workplace || "-"}</td>
                      <td style={{ padding: "6px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.jobContent || "-"}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.startHour}:{r.startMinute}〜{r.endHour}:{r.endMinute}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {r.salaryType === "hourly" ? `時給${r.hourlyWage}円` : `月給${r.basicSalary.toLocaleString()}円`}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ color: r.socialInsurance ? C.green : C.gray }}>{r.socialInsurance ? "加入" : "-"}</span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ color: r.employmentInsurance ? C.green : C.gray }}>{r.employmentInsurance ? "加入" : "-"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 6, background: result.errors.length === 0 ? "#e6f4ea" : "#fff8e1" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: result.errors.length === 0 ? C.green : "#e6a700" }}>
              {result.success}件のインポートが完了しました
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.red }}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ボタン */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={importing}
            style={{ padding: "8px 16px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            閉じる
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={handleImport}
              disabled={importing}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: importing ? C.gray : C.green, border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              {importing ? "インポート中..." : `${rows.length}件をインポート`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
