"use client";

import { useState, useEffect } from "react";
import { C, Department, Contract, Employee } from "@/lib/types";
import { calcInsurance, calcIsTokutei, calcDocumentType, documentTypeLabel } from "@/lib/insurance";
import { FormField, SmallInput, CheckField, SelectField, RadioGroup } from "./FormParts";
import ContractPreview from "./ContractPreview";
import { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ContractFormData = {
  issueDateYear: string;
  issueDateMonth: string;
  issueDateDay: string;
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
  trialPeriodMonths: number;
  workplaceInitial: string;
  workplaceRange: string;
  jobContentInitial: string;
  jobContentRange: string;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  weeklyHours: number;
  weeklyDays: number;
  sideJobPolicy: string;
  teleworkAllowed: boolean;
  salaryType: string;
  basicSalary: number;
  hourlyWage: number;
  fixedOvertimeAmount: number;
  fixedOvertimeHours: number;
  commuteAllowance: number;
  totalSalary: number;
  payClosingDay: string;
  paymentDay: string;
  increment: boolean;
  bonus: boolean;
  retirementAllowance: boolean;
  retirementAllowanceDetail: string;
  studentType: string;
  recruitmentSource: string;
  remarks: string;
  socialInsuranceOverride: boolean;
  employmentInsuranceOverride: boolean;
  socialInsuranceManual: boolean;
  employmentInsuranceManual: boolean;
};

type Props = {
  user: User;
  employee: Employee;
  department: Department | undefined;
  allEmployees: Employee[];
  allContracts: Contract[];
  previousContract?: Contract;
  onClose: () => void;
  onSaved: (contractId: string) => void;
};

const now = new Date();
const reiwaYear = String(now.getFullYear() - 2018);
const thisMonth = String(now.getMonth() + 1);
const thisDay = String(now.getDate());

export default function ContractForm({ user, employee, department, allEmployees, allContracts, previousContract, onClose, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [savedContract, setSavedContract] = useState<Contract | null>(null);

  // 前回の契約があればそれをベースに、なければデフォルト
  const [form, setForm] = useState<ContractFormData>(() => {
    const prev = previousContract;
    return {
      issueDateYear: reiwaYear,
      issueDateMonth: thisMonth,
      issueDateDay: thisDay,
      employmentType: prev?.employmentType || "正社員",
      isYuki: prev?.isYuki ?? false,
      isKoyou: prev?.isKoyou ?? true,
      contractStartYear: reiwaYear,
      contractStartMonth: thisMonth,
      contractStartDay: "1",
      contractEndYear: "",
      contractEndMonth: "",
      contractEndDay: "",
      renewalType: prev?.renewalType || "自動更新",
      trialPeriodMonths: prev?.trialPeriodMonths ?? 3,
      workplaceInitial: prev?.workplaceInitial || department?.address || "",
      workplaceRange: prev?.workplaceRange || "会社の定める事業所",
      jobContentInitial: prev?.jobContentInitial || "",
      jobContentRange: prev?.jobContentRange || "会社の定める業務",
      startHour: prev?.startHour || department?.defaultStartHour || "9",
      startMinute: prev?.startMinute || department?.defaultStartMinute || "00",
      endHour: prev?.endHour || department?.defaultEndHour || "18",
      endMinute: prev?.endMinute || department?.defaultEndMinute || "00",
      weeklyHours: prev?.weeklyHours || department?.defaultWeeklyHours || 40,
      weeklyDays: prev?.weeklyDays || 5,
      sideJobPolicy: prev?.sideJobPolicy || "届出制",
      teleworkAllowed: prev?.teleworkAllowed ?? false,
      salaryType: prev?.salaryType || "monthly",
      basicSalary: prev?.basicSalary || 0,
      hourlyWage: prev?.hourlyWage || 0,
      fixedOvertimeAmount: prev?.fixedOvertimeAmount || 0,
      fixedOvertimeHours: prev?.fixedOvertimeHours || 0,
      commuteAllowance: prev?.commuteAllowance || 0,
      totalSalary: 0,
      payClosingDay: prev?.payClosingDay || department?.payClosingDay || "末日",
      paymentDay: prev?.paymentDay || department?.paymentDay || "翌月25日",
      increment: prev?.increment ?? department?.incrementDefault ?? true,
      bonus: prev?.bonus ?? department?.bonusDefault ?? true,
      retirementAllowance: prev?.retirementAllowance ?? department?.retirementAllowanceDefault ?? false,
      retirementAllowanceDetail: prev?.retirementAllowanceDetail || "",
      studentType: prev?.studentType || "学生でない",
      recruitmentSource: prev?.recruitmentSource || "直接",
      remarks: "",
      socialInsuranceOverride: false,
      employmentInsuranceOverride: false,
      socialInsuranceManual: false,
      employmentInsuranceManual: false,
    };
  });

  const f = (key: keyof ContractFormData, val: unknown) =>
    setForm((p) => ({ ...p, [key]: val }));

  // 総支給額の自動計算
  useEffect(() => {
    let total = 0;
    if (form.salaryType === "monthly") {
      total = (form.basicSalary || 0) + (form.fixedOvertimeAmount || 0) + (form.commuteAllowance || 0);
    } else {
      total = (form.hourlyWage || 0) * (form.weeklyHours || 0) * 4 + (form.commuteAllowance || 0);
    }
    f("totalSalary", total);
  }, [form.basicSalary, form.hourlyWage, form.fixedOvertimeAmount, form.commuteAllowance, form.salaryType, form.weeklyHours]);

  // 社保・雇用保険の自動判定
  const isTokutei = calcIsTokutei(allEmployees, allContracts);
  const autoInsurance = calcInsurance(
    { weeklyHours: form.weeklyHours, totalSalary: form.totalSalary, studentType: form.studentType },
    isTokutei
  );
  const finalSocial = form.socialInsuranceOverride ? form.socialInsuranceManual : autoInsurance.socialInsurance;
  const finalEmployment = form.employmentInsuranceOverride ? form.employmentInsuranceManual : autoInsurance.employmentInsurance;
  const documentType = calcDocumentType(form.isYuki, form.isKoyou);

  // 保存
  const handleSave = async () => {
    const data = {
      userId: user.uid,
      companyId: employee.companyId,
      employeeId: employee.id,
      documentType,
      issueDateYear: form.issueDateYear,
      issueDateMonth: form.issueDateMonth,
      issueDateDay: form.issueDateDay,
      employmentType: form.employmentType,
      isYuki: form.isYuki,
      isKoyou: form.isKoyou,
      contractStartYear: form.contractStartYear,
      contractStartMonth: form.contractStartMonth,
      contractStartDay: form.contractStartDay,
      contractEndYear: form.contractEndYear,
      contractEndMonth: form.contractEndMonth,
      contractEndDay: form.contractEndDay,
      renewalType: form.renewalType,
      trialPeriodMonths: form.trialPeriodMonths,
      workplaceInitial: form.workplaceInitial,
      workplaceRange: form.workplaceRange,
      jobContentInitial: form.jobContentInitial,
      jobContentRange: form.jobContentRange,
      startHour: form.startHour,
      startMinute: form.startMinute,
      endHour: form.endHour,
      endMinute: form.endMinute,
      weeklyHours: form.weeklyHours,
      weeklyDays: form.weeklyDays,
      sideJobPolicy: form.sideJobPolicy,
      teleworkAllowed: form.teleworkAllowed,
      salaryType: form.salaryType,
      basicSalary: form.basicSalary,
      hourlyWage: form.hourlyWage,
      fixedOvertimeAmount: form.fixedOvertimeAmount,
      fixedOvertimeHours: form.fixedOvertimeHours,
      commuteAllowance: form.commuteAllowance,
      totalSalary: form.totalSalary,
      payClosingDay: form.payClosingDay,
      paymentDay: form.paymentDay,
      increment: form.increment,
      bonus: form.bonus,
      retirementAllowance: form.retirementAllowance,
      retirementAllowanceDetail: form.retirementAllowanceDetail,
      socialInsurance: finalSocial,
      employmentInsurance: finalEmployment,
      socialInsuranceOverride: form.socialInsuranceOverride,
      employmentInsuranceOverride: form.employmentInsuranceOverride,
      studentType: form.studentType,
      recruitmentSource: form.recruitmentSource,
      remarks: form.remarks,
      sentAt: null,
      sentTo: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, "contracts"), data);
    setSavedContract({ ...data, id: docRef.id } as Contract);
  };

  const stepTitles = ["雇用形態", "就業情報", "労働時間", "賃金・保険", "確認"];

  if (savedContract) {
    return (
      <ContractPreview
        contract={savedContract}
        employee={employee}
        department={department}
        onClose={() => onSaved(savedContract.id)}
      />
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 620, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
            {employee.name} さんの契約書作成
          </h2>
          <span style={{ fontSize: 12, color: C.gray }}>
            {previousContract ? "契約更新" : "新規契約"}
          </span>
        </div>

        {/* 発行日 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "8px 12px", background: C.cream, borderRadius: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gray }}>発行日（令和）</span>
          <SmallInput value={form.issueDateYear} onChange={(v) => f("issueDateYear", v)} width={45} />
          <span style={{ fontSize: 12 }}>年</span>
          <SmallInput value={form.issueDateMonth} onChange={(v) => f("issueDateMonth", v)} width={40} />
          <span style={{ fontSize: 12 }}>月</span>
          <SmallInput value={form.issueDateDay} onChange={(v) => f("issueDateDay", v)} width={40} />
          <span style={{ fontSize: 12 }}>日</span>
        </div>

        {/* ステップインジケーター */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {stepTitles.map((t, i) => (
            <div
              key={i}
              style={{
                flex: 1, textAlign: "center", padding: "6px 0", fontSize: 11,
                fontWeight: step === i + 1 ? 700 : 400,
                color: step === i + 1 ? C.white : C.gray,
                background: step === i + 1 ? C.navy : step > i + 1 ? C.gold + "44" : C.cream,
                borderRadius: 4, cursor: "pointer",
              }}
              onClick={() => setStep(i + 1)}
            >
              {i + 1}. {t}
            </div>
          ))}
        </div>

        {/* STEP1: 雇用形態 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SelectField
              label="雇用形態"
              value={form.employmentType}
              onChange={(v) => f("employmentType", v)}
              options={[
                { value: "正社員", label: "正社員" },
                { value: "契約社員", label: "契約社員" },
                { value: "パートタイマー", label: "パートタイマー" },
                { value: "アルバイト", label: "アルバイト" },
                { value: "嘱託", label: "嘱託" },
              ]}
            />
            <RadioGroup
              label="契約期間"
              value={form.isYuki ? "yuki" : "muki"}
              onChange={(v) => f("isYuki", v === "yuki")}
              options={[
                { value: "muki", label: "無期（期間の定めなし）" },
                { value: "yuki", label: "有期（期間の定めあり）" },
              ]}
            />
            {form.isYuki ? (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>契約開始日（令和）</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <SmallInput value={form.contractStartYear} onChange={(v) => f("contractStartYear", v)} width={50} />
                    <span style={{ fontSize: 13 }}>年</span>
                    <SmallInput value={form.contractStartMonth} onChange={(v) => f("contractStartMonth", v)} width={50} />
                    <span style={{ fontSize: 13 }}>月</span>
                    <SmallInput value={form.contractStartDay} onChange={(v) => f("contractStartDay", v)} width={50} />
                    <span style={{ fontSize: 13 }}>日</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>契約終了日（令和）</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <SmallInput value={form.contractEndYear} onChange={(v) => f("contractEndYear", v)} width={50} />
                    <span style={{ fontSize: 13 }}>年</span>
                    <SmallInput value={form.contractEndMonth} onChange={(v) => f("contractEndMonth", v)} width={50} />
                    <span style={{ fontSize: 13 }}>月</span>
                    <SmallInput value={form.contractEndDay} onChange={(v) => f("contractEndDay", v)} width={50} />
                    <span style={{ fontSize: 13 }}>日</span>
                  </div>
                </div>
                <SelectField label="更新" value={form.renewalType} onChange={(v) => f("renewalType", v)} options={[
                  { value: "自動更新", label: "自動更新" }, { value: "更新あり", label: "更新あり" },
                  { value: "更新なし", label: "更新なし" }, { value: "その他", label: "その他" },
                ]} />
              </>
            ) : (
              <FormField label="試用期間（月数）" value={String(form.trialPeriodMonths)} onChange={(v) => f("trialPeriodMonths", Number(v) || 0)} type="number" />
            )}
            <RadioGroup
              label="書類種別"
              value={form.isKoyou ? "koyou" : "roudou"}
              onChange={(v) => f("isKoyou", v === "koyou")}
              options={[
                { value: "koyou", label: "雇用契約書（署名欄あり）" },
                { value: "roudou", label: "労働条件通知書（通知形式）" },
              ]}
            />
            <div style={{ padding: "8px 12px", background: C.pale, borderRadius: 6, fontSize: 13, color: C.navy }}>
              作成書類: <strong>{documentTypeLabel(documentType)}</strong>
            </div>
          </div>
        )}

        {/* STEP2: 就業情報 */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="就業の場所（雇入れ直後）" value={form.workplaceInitial} onChange={(v) => f("workplaceInitial", v)} />
            <FormField label="就業の場所（変更の範囲）" value={form.workplaceRange} onChange={(v) => f("workplaceRange", v)} placeholder="会社の定める事業所" />
            <FormField label="業務内容（雇入れ直後）" value={form.jobContentInitial} onChange={(v) => f("jobContentInitial", v)} />
            <FormField label="業務内容（変更の範囲）" value={form.jobContentRange} onChange={(v) => f("jobContentRange", v)} placeholder="会社の定める業務" />
            <SelectField label="学生区分" value={form.studentType} onChange={(v) => f("studentType", v)} options={[
              { value: "学生でない", label: "学生でない" }, { value: "昼間学生", label: "昼間学生" }, { value: "夜間・通信・定時制", label: "夜間・通信・定時制" },
            ]} />
            <SelectField label="採用経路" value={form.recruitmentSource} onChange={(v) => f("recruitmentSource", v)} options={[
              { value: "直接", label: "直接応募" }, { value: "ハローワーク", label: "ハローワーク" }, { value: "紹介", label: "紹介" }, { value: "その他", label: "その他" },
            ]} />
          </div>
        )}

        {/* STEP3: 労働時間 */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>始業・終業</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <SmallInput value={form.startHour} onChange={(v) => f("startHour", v)} width={50} />
                <span>:</span>
                <SmallInput value={form.startMinute} onChange={(v) => f("startMinute", v)} width={50} />
                <span style={{ fontSize: 13, margin: "0 8px" }}>〜</span>
                <SmallInput value={form.endHour} onChange={(v) => f("endHour", v)} width={50} />
                <span>:</span>
                <SmallInput value={form.endMinute} onChange={(v) => f("endMinute", v)} width={50} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <FormField label="週所定労働時間" value={String(form.weeklyHours)} onChange={(v) => f("weeklyHours", Number(v) || 0)} type="number" />
              <FormField label="週所定労働日数" value={String(form.weeklyDays)} onChange={(v) => f("weeklyDays", Number(v) || 0)} type="number" />
            </div>
            <RadioGroup label="副業" value={form.sideJobPolicy} onChange={(v) => f("sideJobPolicy", v)} options={[
              { value: "禁止", label: "禁止" }, { value: "許可", label: "許可" }, { value: "届出制", label: "届出制" },
            ]} />
            <CheckField label="テレワーク勤務あり" checked={form.teleworkAllowed} onChange={(v) => f("teleworkAllowed", v)} />
          </div>
        )}

        {/* STEP4: 賃金・保険 */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <RadioGroup label="賃金区分" value={form.salaryType} onChange={(v) => f("salaryType", v)} options={[
              { value: "monthly", label: "月給制" }, { value: "hourly", label: "時給制" },
            ]} />
            {form.salaryType === "monthly" ? (
              <FormField label="基本給（円/月）" value={String(form.basicSalary || "")} onChange={(v) => f("basicSalary", Number(v) || 0)} type="number" />
            ) : (
              <FormField label="時給（円）" value={String(form.hourlyWage || "")} onChange={(v) => f("hourlyWage", Number(v) || 0)} type="number" />
            )}
            <div style={{ display: "flex", gap: 16 }}>
              <FormField label="固定残業手当（円/月）" value={String(form.fixedOvertimeAmount || "")} onChange={(v) => f("fixedOvertimeAmount", Number(v) || 0)} type="number" />
              <FormField label="固定残業（時間/月）" value={String(form.fixedOvertimeHours || "")} onChange={(v) => f("fixedOvertimeHours", Number(v) || 0)} type="number" />
            </div>
            <FormField label="通勤手当（円/月）" value={String(form.commuteAllowance || "")} onChange={(v) => f("commuteAllowance", Number(v) || 0)} type="number" />
            <div style={{ padding: "8px 12px", background: C.pale, borderRadius: 6, fontSize: 14, color: C.navy }}>
              総支給額: <strong>{form.totalSalary.toLocaleString()}円</strong>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <FormField label="賃金締切日" value={form.payClosingDay} onChange={(v) => f("payClosingDay", v)} />
              <FormField label="支払日" value={form.paymentDay} onChange={(v) => f("paymentDay", v)} />
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <CheckField label="昇給あり" checked={form.increment} onChange={(v) => f("increment", v)} />
              <CheckField label="賞与あり" checked={form.bonus} onChange={(v) => f("bonus", v)} />
              <CheckField label="退職金あり" checked={form.retirementAllowance} onChange={(v) => f("retirementAllowance", v)} />
            </div>
            <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>社会保険・雇用保険（自動判定）</div>
              <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
                <div style={{ fontSize: 13 }}>社会保険: <strong style={{ color: finalSocial ? C.green : C.red }}>{finalSocial ? "加入" : "非加入"}</strong></div>
                <div style={{ fontSize: 13 }}>雇用保険: <strong style={{ color: finalEmployment ? C.green : C.red }}>{finalEmployment ? "加入" : "非加入"}</strong></div>
                <div style={{ fontSize: 12, color: C.gray }}>特定適用: {isTokutei ? "該当" : "非該当"}</div>
              </div>
              <CheckField label="判定結果を手動で変更する" checked={form.socialInsuranceOverride} onChange={(v) => { f("socialInsuranceOverride", v); f("employmentInsuranceOverride", v); }} />
              {form.socialInsuranceOverride && (
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <CheckField label="社会保険 加入" checked={form.socialInsuranceManual} onChange={(v) => f("socialInsuranceManual", v)} />
                  <CheckField label="雇用保険 加入" checked={form.employmentInsuranceManual} onChange={(v) => f("employmentInsuranceManual", v)} />
                </div>
              )}
            </div>
            <FormField label="備考" value={form.remarks} onChange={(v) => f("remarks", v)} />
          </div>
        )}

        {/* STEP5: 確認 */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 }}>入力内容の確認</div>
            <ConfirmRow label="従業員" value={employee.name} />
            <ConfirmRow label="部署" value={department?.name || "-"} />
            <ConfirmRow label="書類種別" value={documentTypeLabel(documentType)} />
            <ConfirmRow label="雇用形態" value={form.employmentType} />
            <ConfirmRow label="契約期間" value={form.isYuki ? `令和${form.contractStartYear}年${form.contractStartMonth}月${form.contractStartDay}日〜令和${form.contractEndYear}年${form.contractEndMonth}月${form.contractEndDay}日` : "期間の定めなし"} />
            <ConfirmRow label="就業場所" value={form.workplaceInitial} />
            <ConfirmRow label="業務内容" value={form.jobContentInitial} />
            <ConfirmRow label="勤務時間" value={`${form.startHour}:${form.startMinute}〜${form.endHour}:${form.endMinute}`} />
            <ConfirmRow label="週所定労働" value={`${form.weeklyHours}時間 / ${form.weeklyDays}日`} />
            <ConfirmRow label="賃金" value={form.salaryType === "monthly" ? `月給 ${form.basicSalary.toLocaleString()}円` : `時給 ${form.hourlyWage.toLocaleString()}円`} />
            <ConfirmRow label="総支給額" value={`${form.totalSalary.toLocaleString()}円`} />
            <ConfirmRow label="社会保険" value={finalSocial ? "加入" : "非加入"} color={finalSocial ? C.green : C.red} />
            <ConfirmRow label="雇用保険" value={finalEmployment ? "加入" : "非加入"} color={finalEmployment ? C.green : C.red} />
          </div>
        )}

        {/* ナビゲーション */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={() => (step === 1 ? onClose() : setStep(step - 1))} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>
            {step === 1 ? "キャンセル" : "戻る"}
          </button>
          {step < 5 ? (
            <button onClick={() => setStep(step + 1)} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>
              次へ
            </button>
          ) : (
            <button onClick={handleSave} style={{ padding: "8px 24px", fontSize: 13, fontWeight: 600, color: C.white, background: C.green, border: "none", borderRadius: 6, cursor: "pointer" }}>
              保存してPDFプレビュー
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.light}`, padding: "6px 0" }}>
      <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: C.gray }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: color || C.navy }}>{value || "-"}</div>
    </div>
  );
}
