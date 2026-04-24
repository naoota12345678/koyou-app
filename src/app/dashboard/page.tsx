"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { C, Company, Department, Employee, Contract } from "@/lib/types";
import { documentTypeLabel } from "@/lib/insurance";
import { FormField, SmallInput, CheckField, SelectField } from "@/components/FormParts";
import ContractForm from "@/components/ContractForm";
import ContractPreview from "@/components/ContractPreview";
import CsvImport from "@/components/CsvImport";
import { calcAlerts, Alert } from "@/lib/alerts";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState("dashboard");
  const [company, setCompany] = useState<Company | null>(null);
  const [companyDocId, setCompanyDocId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  // UI state
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);
  const [autoPdf, setAutoPdf] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  // 従業員編集
  const [editingEmployee, setEditingEmployee] = useState(false);
  const [editEmpForm, setEditEmpForm] = useState({ name: "", employeeNumber: "", email: "", departmentId: "" });

  // CSVインポート
  const [showCsvImport, setShowCsvImport] = useState(false);

  // 退職モーダル
  const [showRetireModal, setShowRetireModal] = useState<Employee | null>(null);
  const [retireForm, setRetireForm] = useState({ retirementReason: "自己都合", retirementRemarks: "" });

  // 会社情報フォーム
  const [companyForm, setCompanyForm] = useState({
    name: "", address: "", representative: "", representativeTitle: "代表取締役", phone: "",
    defaultStartHour: "9", defaultStartMinute: "00", defaultEndHour: "18", defaultEndMinute: "00",
    defaultWeeklyHours: 40, defaultWeeklyDays: 5, payClosingDay: "末日", paymentDay: "翌月25日",
    incrementDefault: true, bonusDefault: true, retirementAllowanceDefault: false,
    retirementAllowanceDetail: "", workRulesLocation: "事務所内掲示",
  });
  const [editingCompany, setEditingCompany] = useState(false);

  // 新規従業員フォーム
  const [empForm, setEmpForm] = useState({ name: "", employeeNumber: "", email: "", departmentId: "" });

  // 部署フォーム（シンプル）
  const [deptForm, setDeptForm] = useState({
    name: "", address: "", startHour: "", startMinute: "", endHour: "", endMinute: "",
  });

  // Firestoreリアルタイム監視
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, "companyInfo"), where("userId", "==", user.uid)), (snap) => {
      if (snap.docs.length > 0) {
        const d = snap.docs[0];
        setCompany({ id: d.id, ...d.data() } as Company);
        setCompanyDocId(d.id);
      } else {
        setCompany(null);
        setCompanyDocId(null);
      }
    }));
    unsubs.push(onSnapshot(query(collection(db, "departments"), where("userId", "==", user.uid)), (snap) =>
      setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)))
    ));
    unsubs.push(onSnapshot(query(collection(db, "employees"), where("userId", "==", user.uid)), (snap) =>
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)))
    ));
    unsubs.push(onSnapshot(query(collection(db, "contracts"), where("userId", "==", user.uid)), (snap) =>
      setContracts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contract)))
    ));
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const handleLogout = async () => { await logout(); router.push("/login"); };

  // アラート
  const alerts = calcAlerts(employees, contracts);
  const dangerCount = alerts.filter((a) => a.type === "danger").length;

  // サマリー
  const activeEmployees = employees.filter((e) => e.status === "active");
  const getLatestContract = (empId: string) => {
    const empContracts = contracts.filter((c) => c.employeeId === empId);
    if (empContracts.length === 0) return null;
    return empContracts.sort((a, b) => {
      const at = a.createdAt && typeof a.createdAt === "object" && "toMillis" in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
      const bt = b.createdAt && typeof b.createdAt === "object" && "toMillis" in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
      return bt - at;
    })[0];
  };
  const socialInsCount = activeEmployees.filter((e) => getLatestContract(e.id)?.socialInsurance).length;
  const empInsCount = activeEmployees.filter((e) => getLatestContract(e.id)?.employmentInsurance).length;

  // ヘルパー
  const getDeptName = (id: string) => {
    if (!id) return "-";
    return departments.find((d) => d.id === id)?.name || "-";
  };
  const getEmpCount = (deptId: string) => employees.filter((e) => e.departmentId === deptId && e.status === "active").length;

  // 従業員フィルター
  const filteredEmployees = employees.filter((e) => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterDept && e.departmentId !== filterDept) return false;
    if (searchText && !e.name?.includes(searchText) && !e.employeeNumber?.includes(searchText)) return false;
    return true;
  });

  // 選択中の従業員の契約履歴
  const selectedContracts = selectedEmployee
    ? contracts.filter((c) => c.employeeId === selectedEmployee.id).sort((a, b) => {
        const at = a.createdAt && typeof a.createdAt === "object" && "toMillis" in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const bt = b.createdAt && typeof b.createdAt === "object" && "toMillis" in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return bt - at;
      })
    : [];

  // 会社情報保存
  const saveCompany = async () => {
    if (!user || !companyForm.name) { alert("会社名は必須です"); return; }
    const data = { ...companyForm, userId: user.uid, updatedAt: serverTimestamp() };
    if (companyDocId) {
      await updateDoc(doc(db, "companyInfo", companyDocId), data);
    } else {
      await addDoc(collection(db, "companyInfo"), { ...data, createdAt: serverTimestamp() });
    }
    setEditingCompany(false);
  };
  const startEditCompany = () => {
    setCompanyForm({
      name: company?.name || "", address: company?.address || "",
      representative: company?.representative || "", representativeTitle: company?.representativeTitle || "代表取締役", phone: company?.phone || "",
      defaultStartHour: company?.defaultStartHour || "9", defaultStartMinute: company?.defaultStartMinute || "00",
      defaultEndHour: company?.defaultEndHour || "18", defaultEndMinute: company?.defaultEndMinute || "00",
      defaultWeeklyHours: company?.defaultWeeklyHours || 40,
      defaultWeeklyDays: company?.defaultWeeklyDays || 5,
      payClosingDay: company?.payClosingDay || "末日", paymentDay: company?.paymentDay || "翌月25日",
      incrementDefault: company?.incrementDefault ?? true, bonusDefault: company?.bonusDefault ?? true,
      retirementAllowanceDefault: company?.retirementAllowanceDefault ?? false,
      retirementAllowanceDetail: company?.retirementAllowanceDetail || "",
      workRulesLocation: company?.workRulesLocation || "事務所内掲示",
    });
    setEditingCompany(true);
  };

  // 部署CRUD（シンプル）
  const resetDeptForm = () => {
    setDeptForm({ name: "", address: "", startHour: "", startMinute: "", endHour: "", endMinute: "" });
    setEditDept(null); setShowDeptForm(false);
  };
  const saveDept = async () => {
    if (!user || !deptForm.name) return;
    const data = { ...deptForm, userId: user.uid, updatedAt: serverTimestamp() };
    if (editDept) await updateDoc(doc(db, "departments", editDept.id), data);
    else await addDoc(collection(db, "departments"), { ...data, createdAt: serverTimestamp() });
    resetDeptForm();
  };
  const deleteDept = async (id: string) => { if (confirm("この部署を削除しますか？")) await deleteDoc(doc(db, "departments", id)); };
  const startEditDept = (dept: Department) => {
    setEditDept(dept);
    setDeptForm({
      name: dept.name || "", address: dept.address || "",
      startHour: dept.startHour || "", startMinute: dept.startMinute || "",
      endHour: dept.endHour || "", endMinute: dept.endMinute || "",
    });
    setShowDeptForm(true);
  };

  // 従業員追加
  const saveEmployee = async () => {
    if (!user || !empForm.name) { alert("氏名は必須です"); return; }
    const ref = await addDoc(collection(db, "employees"), {
      userId: user.uid, name: empForm.name, employeeNumber: empForm.employeeNumber,
      address: "", email: empForm.email, departmentId: empForm.departmentId, status: "active",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    setShowEmpForm(false);
    const newEmp: Employee = { id: ref.id, userId: user.uid, name: empForm.name, employeeNumber: empForm.employeeNumber, address: "", email: empForm.email, departmentId: empForm.departmentId, status: "active", retiredAt: null, retirementReason: "", retirementRemarks: "", createdAt: null, updatedAt: null };
    setEmpForm({ name: "", employeeNumber: "", email: "", departmentId: "" });
    setSelectedEmployee(newEmp);
    setPage("employees");
    setEditContract(null);
    setShowContractForm(true);
  };

  // 従業員編集
  const startEditEmployee = () => {
    if (!selectedEmployee) return;
    setEditEmpForm({
      name: selectedEmployee.name || "",
      employeeNumber: selectedEmployee.employeeNumber || "",
      email: selectedEmployee.email || "",
      departmentId: selectedEmployee.departmentId || "",
    });
    setEditingEmployee(true);
  };
  const saveEditEmployee = async () => {
    if (!user || !selectedEmployee || !editEmpForm.name) { alert("氏名は必須です"); return; }
    await updateDoc(doc(db, "employees", selectedEmployee.id), {
      name: editEmpForm.name, employeeNumber: editEmpForm.employeeNumber,
      email: editEmpForm.email, departmentId: editEmpForm.departmentId,
      updatedAt: serverTimestamp(),
    });
    setSelectedEmployee({ ...selectedEmployee, ...editEmpForm });
    setEditingEmployee(false);
  };

  // 従業員削除（契約書も一緒に削除）
  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(`「${emp.name}」さんを削除しますか？\n関連する契約書もすべて削除されます。この操作は取り消せません。`)) return;
    const empContracts = contracts.filter((c) => c.employeeId === emp.id);
    for (const c of empContracts) {
      await deleteDoc(doc(db, "contracts", c.id));
    }
    await deleteDoc(doc(db, "employees", emp.id));
    if (selectedEmployee?.id === emp.id) setSelectedEmployee(null);
  };

  // 退職処理
  const handleRetire = async () => {
    if (!showRetireModal) return;
    await updateDoc(doc(db, "employees", showRetireModal.id), {
      status: "retired", retirementReason: retireForm.retirementReason,
      retirementRemarks: retireForm.retirementRemarks, retiredAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    setShowRetireModal(null);
    if (selectedEmployee?.id === showRetireModal.id) setSelectedEmployee(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      active: { bg: "#e6f4ea", color: C.green, label: "在職" },
      leave: { bg: "#fff8e1", color: "#e6a700", label: "休職" },
      retired: { bg: "#fce4ec", color: C.red, label: "退職" },
    };
    const s = map[status] || map.active;
    return <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{s.label}</span>;
  };

  const alertBadge = (type: Alert["type"]) => {
    const map = { danger: { bg: "#fce4ec", color: C.red }, warning: { bg: "#fff8e1", color: "#e6a700" }, info: { bg: "#e3f2fd", color: "#1565c0" } };
    return map[type];
  };

  const navItems = [
    { key: "dashboard", label: "ダッシュボード", icon: "📊" },
    { key: "company", label: "会社情報", icon: "🏛" },
    { key: "departments", label: "部署管理", icon: "🏢" },
    { key: "employees", label: "従業員一覧", icon: "👥" },
  ];

  // 会社未登録時は会社登録を促す
  if (!company && page !== "company") {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 220, background: C.navy, color: C.white, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px", borderBottom: `1px solid ${C.gold}33` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>📋 雇用契約書管理</div>
            <div style={{ fontSize: 11, color: "#ffffff80", marginTop: 4 }}>{user?.email}</div>
          </div>
          <div style={{ padding: "16px" }}>
            <button onClick={handleLogout} style={{ width: "100%", padding: "8px", fontSize: 13, color: "#ffffff80", background: "transparent", border: "1px solid #ffffff33", borderRadius: 6, cursor: "pointer" }}>ログアウト</button>
          </div>
        </aside>
        <main style={{ flex: 1, background: C.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🏛</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 12 }}>会社情報を登録してください</h1>
            <p style={{ fontSize: 14, color: C.gray, marginBottom: 24, lineHeight: 1.8 }}>
              契約書の作成に会社情報が必要です。<br />まずは会社名・所在地・代表者などの基本情報と、<br />労働条件のデフォルト値を設定しましょう。
            </p>
            <button onClick={() => { setPage("company"); startEditCompany(); }} style={{ padding: "12px 32px", fontSize: 15, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 8, cursor: "pointer" }}>
              会社情報を登録する
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* サイドバー */}
      <aside style={{ width: 220, background: C.navy, color: C.white, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px", borderBottom: `1px solid ${C.gold}33` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>📋 雇用契約書管理</div>
          <div style={{ fontSize: 11, color: "#ffffff80", marginTop: 4 }}>{user?.email}</div>
        </div>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setPage(item.key); setSelectedEmployee(null); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "11px 20px", fontSize: 14,
                color: page === item.key ? C.white : "#ffffffcc",
                background: page === item.key ? C.gold : "transparent",
                border: "none", borderLeft: page === item.key ? `3px solid ${C.white}` : "3px solid transparent",
                fontWeight: page === item.key ? 700 : 400, cursor: "pointer", position: "relative",
              }}
            >
              {item.icon} {item.label}
              {item.key === "dashboard" && dangerCount > 0 && (
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: C.red, color: C.white, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                  {dangerCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px" }}>
          <button onClick={handleLogout} style={{ width: "100%", padding: "8px", fontSize: 13, color: "#ffffff80", background: "transparent", border: "1px solid #ffffff33", borderRadius: 6, cursor: "pointer" }}>ログアウト</button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, background: C.cream, padding: "24px 32px", overflow: "auto" }}>

        {/* ===== ダッシュボード ===== */}
        {page === "dashboard" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>ダッシュボード</h1>

            {/* アラートバナー */}
            {alerts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {alerts.slice(0, 5).map((a, i) => {
                  const badge = alertBadge(a.type);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 6, background: badge.bg, borderRadius: 6, borderLeft: `4px solid ${badge.color}` }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: badge.color }}>{a.employeeName}</span>
                      <span style={{ fontSize: 13, color: "#333" }}>{a.message}</span>
                      <button
                        onClick={() => {
                          const emp = employees.find((e) => e.id === a.employeeId);
                          if (emp) { setPage("employees"); setSelectedEmployee(emp); }
                        }}
                        style={{ marginLeft: "auto", fontSize: 11, color: badge.color, background: "transparent", border: `1px solid ${badge.color}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                      >
                        詳細
                      </button>
                    </div>
                  );
                })}
                {alerts.length > 5 && (
                  <div style={{ fontSize: 12, color: C.gray, textAlign: "right" }}>他 {alerts.length - 5} 件のアラート</div>
                )}
              </div>
            )}

            {/* サマリーカード */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { label: "在職中", value: activeEmployees.length, color: C.green },
                { label: "部署数", value: departments.length, color: C.navy },
                { label: "社保加入", value: socialInsCount, color: C.gold },
                { label: "雇用保険", value: empInsCount, color: C.gold },
              ].map((card) => (
                <div key={card.label} style={{ background: C.white, borderRadius: 8, padding: "16px 24px", minWidth: 160, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderTop: `3px solid ${card.color}` }}>
                  <div style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color, marginTop: 4 }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* 従業員テーブル */}
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 16 }}>従業員一覧</h2>
              {activeEmployees.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>従業員が登録されていません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["番号", "氏名", "部署", "雇用形態", "社保", "雇保"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.slice(0, 10).map((e) => {
                      const lc = getLatestContract(e.id);
                      return (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${C.light}`, cursor: "pointer" }} onClick={() => { setPage("employees"); setSelectedEmployee(e); }}>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{e.employeeNumber || "-"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{e.name}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{getDeptName(e.departmentId)}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{lc?.employmentType || "-"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12 }}><span style={{ color: lc?.socialInsurance ? C.green : C.red }}>{lc?.socialInsurance ? "加入" : "-"}</span></td>
                          <td style={{ padding: "10px 12px", fontSize: 12 }}><span style={{ color: lc?.employmentInsurance ? C.green : C.red }}>{lc?.employmentInsurance ? "加入" : "-"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== 会社情報 ===== */}
        {page === "company" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>会社情報</h1>

            {editingCompany ? (
              <div style={{ background: C.white, borderRadius: 8, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 600 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 20 }}>{company ? "会社情報を編集" : "会社情報を登録"}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FormField label="会社名（正式名称） *" value={companyForm.name} onChange={(v) => setCompanyForm({ ...companyForm, name: v })} placeholder="例: 株式会社○○" />
                  <FormField label="所在地" value={companyForm.address} onChange={(v) => setCompanyForm({ ...companyForm, address: v })} placeholder="例: 東京都千代田区..." />
                  <SelectField label="代表格" value={companyForm.representativeTitle} onChange={(v) => setCompanyForm({ ...companyForm, representativeTitle: v })} options={[
                    { value: "代表取締役", label: "代表取締役" },
                    { value: "代表社員", label: "代表社員" },
                    { value: "代表", label: "代表" },
                  ]} />
                  <FormField label="代表者名" value={companyForm.representative} onChange={(v) => setCompanyForm({ ...companyForm, representative: v })} />
                  <FormField label="電話番号" value={companyForm.phone} onChange={(v) => setCompanyForm({ ...companyForm, phone: v })} />

                  <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>労働時間デフォルト</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: C.gray }}>始業</span>
                      <SmallInput value={companyForm.defaultStartHour} onChange={(v) => setCompanyForm({ ...companyForm, defaultStartHour: v })} width={50} />
                      <span>:</span>
                      <SmallInput value={companyForm.defaultStartMinute} onChange={(v) => setCompanyForm({ ...companyForm, defaultStartMinute: v })} width={50} />
                      <span style={{ fontSize: 13, color: C.gray, marginLeft: 12 }}>終業</span>
                      <SmallInput value={companyForm.defaultEndHour} onChange={(v) => setCompanyForm({ ...companyForm, defaultEndHour: v })} width={50} />
                      <span>:</span>
                      <SmallInput value={companyForm.defaultEndMinute} onChange={(v) => setCompanyForm({ ...companyForm, defaultEndMinute: v })} width={50} />
                    </div>
                  </div>
                  <FormField label="週所定労働時間" value={String(companyForm.defaultWeeklyHours)} onChange={(v) => setCompanyForm({ ...companyForm, defaultWeeklyHours: Number(v) || 0 })} type="number" />
                  <FormField label="週所定労働日数" value={String(companyForm.defaultWeeklyDays)} onChange={(v) => setCompanyForm({ ...companyForm, defaultWeeklyDays: Math.min(Math.max(Number(v) || 0, 1), 7) })} type="number" />
                  <div style={{ fontSize: 11, color: C.gray, marginTop: -6 }}>※ 休日数は「7 − 労働日数」で自動計算されます（現在: 週{Math.max(7 - (companyForm.defaultWeeklyDays || 5), 0)}日休み）</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <FormField label="賃金締切日" value={companyForm.payClosingDay} onChange={(v) => setCompanyForm({ ...companyForm, payClosingDay: v })} />
                    <FormField label="支払日" value={companyForm.paymentDay} onChange={(v) => setCompanyForm({ ...companyForm, paymentDay: v })} />
                  </div>
                  <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>処遇デフォルト</div>
                    <div style={{ display: "flex", gap: 20 }}>
                      <CheckField label="昇給あり" checked={companyForm.incrementDefault} onChange={(v) => setCompanyForm({ ...companyForm, incrementDefault: v })} />
                      <CheckField label="賞与あり" checked={companyForm.bonusDefault} onChange={(v) => setCompanyForm({ ...companyForm, bonusDefault: v })} />
                      <CheckField label="退職金あり" checked={companyForm.retirementAllowanceDefault} onChange={(v) => setCompanyForm({ ...companyForm, retirementAllowanceDefault: v })} />
                    </div>
                  </div>
                  <FormField label="就業規則確認場所" value={companyForm.workRulesLocation} onChange={(v) => setCompanyForm({ ...companyForm, workRulesLocation: v })} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                  {company && <button onClick={() => setEditingCompany(false)} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>}
                  <button onClick={saveCompany} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>保存</button>
                </div>
              </div>
            ) : company ? (
              <div style={{ background: C.white, borderRadius: 8, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 600 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>登録済み会社情報</h2>
                  <button onClick={startEditCompany} style={{ padding: "6px 16px", fontSize: 12, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>編集</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "会社名", value: company.name },
                      { label: "所在地", value: company.address },
                      { label: company.representativeTitle || "代表取締役", value: company.representative },
                      { label: "電話番号", value: company.phone },
                      { label: "勤務時間", value: `${company.defaultStartHour || "9"}:${company.defaultStartMinute || "00"} 〜 ${company.defaultEndHour || "18"}:${company.defaultEndMinute || "00"}` },
                      { label: "週所定労働時間", value: `${company.defaultWeeklyHours || 40}時間` },
                      { label: "週所定労働日数", value: `${company.defaultWeeklyDays || 5}日（休日: 週${Math.max(7 - (company.defaultWeeklyDays || 5), 0)}日）` },
                      { label: "賃金締切日", value: company.payClosingDay },
                      { label: "支払日", value: company.paymentDay },
                      { label: "昇給", value: company.incrementDefault ? "あり" : "なし" },
                      { label: "賞与", value: company.bonusDefault ? "あり" : "なし" },
                      { label: "退職金", value: company.retirementAllowanceDefault ? "あり" : "なし" },
                      { label: "就業規則確認場所", value: company.workRulesLocation },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: C.gray, width: 140 }}>{row.label}</td>
                        <td style={{ padding: "10px 16px", fontSize: 14, color: C.navy }}>{row.value || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}

        {/* ===== 部署管理 ===== */}
        {page === "departments" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>部署管理</h1>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>部署ごとに就業場所や勤務時間が異なる場合に登録します。部署なしでも従業員を登録できます。</p>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>部署一覧</h2>
                <button onClick={() => { resetDeptForm(); setShowDeptForm(true); }} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>+ 部署を追加</button>
              </div>
              {departments.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>部署が登録されていません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["部署名", "就業場所", "勤務時間", "人数", "操作"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{dept.name}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{dept.address || "-"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>
                          {dept.startHour && dept.endHour ? `${dept.startHour}:${dept.startMinute || "00"} 〜 ${dept.endHour}:${dept.endMinute || "00"}` : "会社デフォルト"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          <span style={{ background: C.pale, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: C.navy }}>{getEmpCount(dept.id)}人</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => startEditDept(dept)} style={{ padding: "4px 12px", fontSize: 12, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer", marginRight: 6 }}>編集</button>
                          <button onClick={() => deleteDept(dept.id)} style={{ padding: "4px 12px", fontSize: 12, color: C.red, background: "#fff0f0", border: "none", borderRadius: 4, cursor: "pointer" }}>削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== 従業員一覧 ===== */}
        {page === "employees" && !selectedEmployee && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>従業員一覧</h1>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>検索</label>
                <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="氏名・番号で検索" style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, width: 180 }} />
              </div>
              {departments.length > 0 && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>部署</label>
                  <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                    <option value="">すべて</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>ステータス</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                  <option value="">すべて</option>
                  <option value="active">在職</option>
                  <option value="leave">休職</option>
                  <option value="retired">退職</option>
                </select>
              </div>
              <button onClick={() => { setEmpForm({ name: "", employeeNumber: "", email: "", departmentId: "" }); setShowEmpForm(true); }} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>
                + 従業員追加
              </button>
              <button onClick={() => setShowCsvImport(true)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.navy, background: C.pale, border: `1px solid ${C.gold}`, borderRadius: 6, cursor: "pointer" }}>
                CSVインポート
              </button>
            </div>

            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              {filteredEmployees.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>該当する従業員がいません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["番号", "氏名", "メール", departments.length > 0 ? "部署" : null, "雇用形態", "ステータス"].filter(Boolean).map((h) => (
                        <th key={h!} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((e) => {
                      const lc = getLatestContract(e.id);
                      const empAlerts = alerts.filter((a) => a.employeeId === e.id);
                      return (
                        <tr key={e.id} onClick={() => setSelectedEmployee(e)} style={{ borderBottom: `1px solid ${C.light}`, cursor: "pointer", background: empAlerts.some((a) => a.type === "danger") ? "#fce4ec44" : "transparent" }}>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{e.employeeNumber || "-"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>
                            {e.name}
                            {empAlerts.length > 0 && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: empAlerts[0].type === "danger" ? C.red : "#e6a700", marginLeft: 6, verticalAlign: "middle" }} />}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{e.email || "-"}</td>
                          {departments.length > 0 && <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{getDeptName(e.departmentId)}</td>}
                          <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{lc?.employmentType || "-"}</td>
                          <td style={{ padding: "10px 12px" }}>{statusBadge(e.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== 従業員詳細（契約履歴） ===== */}
        {page === "employees" && selectedEmployee && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setSelectedEmployee(null)} style={{ padding: "4px 12px", fontSize: 13, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>← 一覧に戻る</button>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy }}>{selectedEmployee.name}</h1>
              {statusBadge(selectedEmployee.status)}
            </div>

            {/* 従業員情報 */}
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20 }}>
              {editingEmployee ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="氏名 *" value={editEmpForm.name} onChange={(v) => setEditEmpForm({ ...editEmpForm, name: v })} />
                    <FormField label="従業員番号" value={editEmpForm.employeeNumber} onChange={(v) => setEditEmpForm({ ...editEmpForm, employeeNumber: v })} />
                    <FormField label="メールアドレス" value={editEmpForm.email} onChange={(v) => setEditEmpForm({ ...editEmpForm, email: v })} />
                    {departments.length > 0 && (
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>部署</label>
                        <select value={editEmpForm.departmentId} onChange={(e) => setEditEmpForm({ ...editEmpForm, departmentId: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8e2da", borderRadius: 6, fontSize: 14, background: "#fff" }}>
                          <option value="">なし</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => setEditingEmployee(false)} style={{ padding: "8px 16px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
                    <button onClick={saveEditEmployee} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>保存</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                      <div><span style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>従業員番号</span><div style={{ fontSize: 14 }}>{selectedEmployee.employeeNumber || "未設定"}</div></div>
                      <div><span style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>メール</span><div style={{ fontSize: 14 }}>{selectedEmployee.email || "未設定"}</div></div>
                      {departments.length > 0 && <div><span style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>部署</span><div style={{ fontSize: 14 }}>{getDeptName(selectedEmployee.departmentId)}</div></div>}
                    </div>
                    <button onClick={startEditEmployee} style={{ padding: "4px 12px", fontSize: 12, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>編集</button>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    {selectedEmployee.status === "active" && (
                      <>
                        <button onClick={() => { setEditContract(null); setShowContractForm(true); }} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>
                          + 新しい契約書
                        </button>
                        <button onClick={() => { setShowRetireModal(selectedEmployee); setRetireForm({ retirementReason: "自己都合", retirementRemarks: "" }); }} style={{ padding: "8px 16px", fontSize: 13, color: C.red, background: "#fff0f0", border: "none", borderRadius: 6, cursor: "pointer" }}>
                          退職処理
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDeleteEmployee(selectedEmployee)} style={{ padding: "8px 16px", fontSize: 13, color: C.red, background: "transparent", border: `1px solid ${C.red}`, borderRadius: 6, cursor: "pointer", marginLeft: "auto" }}>
                      削除
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* アラート */}
            {alerts.filter((a) => a.employeeId === selectedEmployee.id).map((a, i) => {
              const badge = alertBadge(a.type);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 6, background: badge.bg, borderRadius: 6, borderLeft: `4px solid ${badge.color}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: badge.color }}>{a.message}</span>
                </div>
              );
            })}

            {/* 契約履歴 */}
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginTop: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 16 }}>契約履歴</h2>
              {selectedContracts.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>契約書がありません。「+ 新しい契約書」から作成してください。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {selectedContracts.map((c, i) => (
                    <div key={c.id} style={{ border: `1px solid ${i === 0 ? C.gold : C.light}`, borderRadius: 8, padding: 16, background: i === 0 ? `${C.gold}08` : C.white }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {i === 0 && <span style={{ background: C.gold, color: C.white, padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>最新</span>}
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{documentTypeLabel(c.documentType)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {c.sentAt ? (
                            <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>送信済み</span>
                          ) : (
                            <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>未送信</span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setEditContract(c); setShowContractForm(true); }} style={{ padding: "3px 10px", fontSize: 11, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>編集</button>
                          <button onClick={(e) => { e.stopPropagation(); setPreviewContract(c); }} style={{ padding: "3px 10px", fontSize: 11, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>プレビュー</button>
                          <button onClick={(e) => { e.stopPropagation(); setAutoPdf(true); setPreviewContract(c); }} style={{ padding: "3px 10px", fontSize: 11, color: C.navy, background: C.pale, border: "none", borderRadius: 4, cursor: "pointer" }}>PDF</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: C.gray }}>
                        <span>発行: 令和{c.issueDateYear}年{c.issueDateMonth}月{c.issueDateDay}日</span>
                        <span>{c.employmentType}</span>
                        <span>{c.isYuki ? `有期（〜令和${c.contractEndYear}年${c.contractEndMonth}月${c.contractEndDay}日）` : "無期"}</span>
                        <span>{c.salaryType === "monthly" ? `月給 ${c.basicSalary?.toLocaleString()}円` : `時給 ${c.hourlyWage?.toLocaleString()}円`}</span>
                        <span>週{c.weeklyHours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ===== モーダル群 ===== */}

      {/* 部署モーダル（シンプル） */}
      {showDeptForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) resetDeptForm(); }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 20 }}>{editDept ? "部署を編集" : "部署を追加"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FormField label="部署名 *" value={deptForm.name} onChange={(v) => setDeptForm({ ...deptForm, name: v })} />
              <FormField label="就業場所" value={deptForm.address} onChange={(v) => setDeptForm({ ...deptForm, address: v })} placeholder="会社所在地と異なる場合" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>勤務時間（空欄なら会社デフォルト）</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <SmallInput value={deptForm.startHour} onChange={(v) => setDeptForm({ ...deptForm, startHour: v })} width={50} />
                  <span>:</span>
                  <SmallInput value={deptForm.startMinute} onChange={(v) => setDeptForm({ ...deptForm, startMinute: v })} width={50} />
                  <span style={{ fontSize: 13, margin: "0 8px" }}>〜</span>
                  <SmallInput value={deptForm.endHour} onChange={(v) => setDeptForm({ ...deptForm, endHour: v })} width={50} />
                  <span>:</span>
                  <SmallInput value={deptForm.endMinute} onChange={(v) => setDeptForm({ ...deptForm, endMinute: v })} width={50} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={resetDeptForm} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveDept} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>{editDept ? "更新" : "追加"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 従業員追加モーダル */}
      {showEmpForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowEmpForm(false); }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 20 }}>従業員追加</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FormField label="氏名 *" value={empForm.name} onChange={(v) => setEmpForm({ ...empForm, name: v })} />
              <FormField label="従業員番号" value={empForm.employeeNumber} onChange={(v) => setEmpForm({ ...empForm, employeeNumber: v })} placeholder="任意" />
              <FormField label="メールアドレス" value={empForm.email} onChange={(v) => setEmpForm({ ...empForm, email: v })} placeholder="契約書送信用" />
              {departments.length > 0 && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>部署</label>
                  <select value={empForm.departmentId} onChange={(e) => setEmpForm({ ...empForm, departmentId: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8e2da", borderRadius: 6, fontSize: 14, background: "#fff" }}>
                    <option value="">なし</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowEmpForm(false)} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveEmployee} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>追加して契約書作成へ</button>
            </div>
          </div>
        </div>
      )}

      {/* 書類作成フォーム */}
      {showContractForm && user && selectedEmployee && (
        <ContractForm
          user={user}
          employee={selectedEmployee}
          company={company}
          department={departments.find((d) => d.id === selectedEmployee.departmentId)}
          allEmployees={employees}
          allContracts={contracts}
          editContract={editContract || undefined}
          previousContract={editContract ? undefined : selectedContracts[0]}
          onClose={() => { setShowContractForm(false); setEditContract(null); }}
          onSaved={() => { setShowContractForm(false); setEditContract(null); }}
        />
      )}

      {/* 契約プレビューモーダル */}
      {previewContract && selectedEmployee && (
        <ContractPreview
          contract={previewContract}
          employee={selectedEmployee}
          company={company}
          autoPdf={autoPdf}
          onClose={() => { setPreviewContract(null); setAutoPdf(false); }}
        />
      )}

      {/* 退職処理モーダル */}
      {showRetireModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowRetireModal(null); }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 20 }}>退職処理</h2>
            <p style={{ fontSize: 14, marginBottom: 16 }}><strong>{showRetireModal.name}</strong> さんの退職処理</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>退職理由</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["自己都合", "会社都合", "契約満了", "その他"].map((r) => (
                    <label key={r} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" checked={retireForm.retirementReason === r} onChange={() => setRetireForm({ ...retireForm, retirementReason: r })} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <FormField label="備考" value={retireForm.retirementRemarks} onChange={(v) => setRetireForm({ ...retireForm, retirementRemarks: v })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowRetireModal(null)} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleRetire} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.red, border: "none", borderRadius: 6, cursor: "pointer" }}>退職処理を実行</button>
            </div>
          </div>
        </div>
      )}

      {/* CSVインポートモーダル */}
      {showCsvImport && user && (
        <CsvImport
          user={user}
          company={company}
          allEmployees={employees}
          allContracts={contracts}
          onClose={() => setShowCsvImport(false)}
          onDone={() => { setShowCsvImport(false); setPage("employees"); }}
        />
      )}
    </div>
  );
}
