"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { C, Department, Contract } from "@/lib/types";
import { documentTypeLabel } from "@/lib/insurance";
import { FormField, SmallInput, CheckField } from "@/components/FormParts";
import ContractForm from "@/components/ContractForm";

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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [deptForm, setDeptForm] = useState({
    name: "",
    address: "",
    representative: "",
    defaultStartHour: "9",
    defaultStartMinute: "00",
    defaultEndHour: "18",
    defaultEndMinute: "00",
    defaultWeeklyHours: 40,
    payClosingDay: "末日",
    paymentDay: "翌月25日",
    incrementDefault: true,
    bonusDefault: true,
    retirementAllowanceDefault: false,
    retirementAllowanceDetail: "",
    workRulesLocation: "事務所内掲示",
  });

  // 退職処理
  const [showRetireModal, setShowRetireModal] = useState<Contract | null>(null);
  const [retireForm, setRetireForm] = useState({
    retirementReason: "自己都合",
    retirementRemarks: "",
    retiredYear: "",
    retiredMonth: "",
    retiredDay: "",
  });

  // Firestoreリアルタイム監視
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(
      onSnapshot(
        query(collection(db, "companies"), where("userId", "==", user.uid)),
        (snap) => setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)))
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "contracts"), where("userId", "==", user.uid)),
        (snap) => setContracts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contract)))
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // サマリー
  const activeContracts = contracts.filter((c) => c.status === "active");
  const socialInsCount = activeContracts.filter((c) => c.socialInsurance).length;
  const empInsCount = activeContracts.filter((c) => c.employmentInsurance).length;

  // 部署フォーム
  const resetDeptForm = () => {
    setDeptForm({
      name: "", address: "", representative: "",
      defaultStartHour: "9", defaultStartMinute: "00",
      defaultEndHour: "18", defaultEndMinute: "00",
      defaultWeeklyHours: 40, payClosingDay: "末日", paymentDay: "翌月25日",
      incrementDefault: true, bonusDefault: true,
      retirementAllowanceDefault: false, retirementAllowanceDetail: "",
      workRulesLocation: "事務所内掲示",
    });
    setEditDept(null);
    setShowDeptForm(false);
  };

  const saveDept = async () => {
    if (!user || !deptForm.name) return;
    const data = { ...deptForm, userId: user.uid, updatedAt: serverTimestamp() };
    if (editDept) {
      await updateDoc(doc(db, "companies", editDept.id), data);
    } else {
      await addDoc(collection(db, "companies"), { ...data, createdAt: serverTimestamp() });
    }
    resetDeptForm();
  };

  const deleteDept = async (id: string) => {
    if (!confirm("この部署を削除しますか？")) return;
    await deleteDoc(doc(db, "companies", id));
  };

  const startEditDept = (dept: Department) => {
    setEditDept(dept);
    setDeptForm({
      name: dept.name || "", address: dept.address || "", representative: dept.representative || "",
      defaultStartHour: dept.defaultStartHour || "9", defaultStartMinute: dept.defaultStartMinute || "00",
      defaultEndHour: dept.defaultEndHour || "18", defaultEndMinute: dept.defaultEndMinute || "00",
      defaultWeeklyHours: dept.defaultWeeklyHours || 40,
      payClosingDay: dept.payClosingDay || "末日", paymentDay: dept.paymentDay || "翌月25日",
      incrementDefault: dept.incrementDefault ?? true, bonusDefault: dept.bonusDefault ?? true,
      retirementAllowanceDefault: dept.retirementAllowanceDefault ?? false,
      retirementAllowanceDetail: dept.retirementAllowanceDetail || "",
      workRulesLocation: dept.workRulesLocation || "事務所内掲示",
    });
    setShowDeptForm(true);
  };

  const getContractCount = (deptId: string) =>
    contracts.filter((c) => c.companyId === deptId && c.status === "active").length;

  const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name || "-";

  // 従業員フィルター
  const filteredContracts = contracts.filter((c) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterDept && c.companyId !== filterDept) return false;
    if (searchText && !c.employeeName?.includes(searchText)) return false;
    return true;
  });

  // 退職処理
  const handleRetire = async () => {
    if (!showRetireModal) return;
    await updateDoc(doc(db, "contracts", showRetireModal.id), {
      status: "retired",
      retirementReason: retireForm.retirementReason,
      retirementRemarks: retireForm.retirementRemarks,
      retiredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setShowRetireModal(null);
  };

  const navItems = [
    { key: "dashboard", label: "ダッシュボード", icon: "📊" },
    { key: "departments", label: "部署管理", icon: "🏢" },
    { key: "employees", label: "従業員一覧", icon: "👥" },
    { key: "contracts", label: "書類作成", icon: "📝" },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      active: { bg: "#e6f4ea", color: C.green, label: "在職" },
      leave: { bg: "#fff8e1", color: "#e6a700", label: "休職" },
      retired: { bg: "#fce4ec", color: C.red, label: "退職" },
    };
    const s = map[status] || map.active;
    return (
      <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

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
              onClick={() => setPage(item.key)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "11px 20px", fontSize: 14,
                color: page === item.key ? C.white : "#ffffffcc",
                background: page === item.key ? C.gold : "transparent",
                border: "none",
                borderLeft: page === item.key ? `3px solid ${C.white}` : "3px solid transparent",
                fontWeight: page === item.key ? 700 : 400, cursor: "pointer",
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px" }}>
          <button onClick={handleLogout} style={{ width: "100%", padding: "8px", fontSize: 13, color: "#ffffff80", background: "transparent", border: "1px solid #ffffff33", borderRadius: 6, cursor: "pointer" }}>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, background: C.cream, padding: "24px 32px" }}>
        {/* ===== ダッシュボード ===== */}
        {page === "dashboard" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>ダッシュボード</h1>
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { label: "管理部署数", value: departments.length, color: C.navy },
                { label: "在職中", value: activeContracts.length, color: C.green },
                { label: "社保加入", value: socialInsCount, color: C.gold },
                { label: "雇用保険", value: empInsCount, color: C.gold },
              ].map((card) => (
                <div key={card.label} style={{ background: C.white, borderRadius: 8, padding: "16px 24px", minWidth: 160, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderTop: `3px solid ${card.color}` }}>
                  <div style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color, marginTop: 4 }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* 最近の従業員 */}
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>最近登録された従業員</h2>
                <button
                  onClick={() => { setPage("contracts"); setShowContractForm(true); }}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  + 書類作成
                </button>
              </div>
              {contracts.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>従業員が登録されていません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["氏名", "部署", "雇用形態", "書類種別", "ステータス"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.slice(0, 8).map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{c.employeeName}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{getDeptName(c.companyId)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{c.employmentType}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{documentTypeLabel(c.documentType)}</td>
                        <td style={{ padding: "10px 12px" }}>{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== 部署管理 ===== */}
        {page === "departments" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>部署管理</h1>
            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>管理部署一覧</h2>
                <button onClick={() => { resetDeptForm(); setShowDeptForm(true); }} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>
                  + 部署を追加
                </button>
              </div>
              {departments.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>部署が登録されていません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["部署名", "所在地", "代表者", "従業員数", "操作"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{dept.name}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{dept.address || "-"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{dept.representative || "-"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          <span style={{ background: C.pale, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: C.navy }}>{getContractCount(dept.id)}人</span>
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
        {page === "employees" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>従業員一覧</h1>
            {/* フィルター */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>検索</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="氏名で検索"
                  style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, width: 180 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>部署</label>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                  <option value="">すべて</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>ステータス</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "7px 12px", border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                  <option value="">すべて</option>
                  <option value="active">在職</option>
                  <option value="leave">休職</option>
                  <option value="retired">退職</option>
                </select>
              </div>
              <button
                onClick={() => setShowContractForm(true)}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                + 書類作成
              </button>
            </div>

            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              {filteredContracts.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>該当する従業員がいません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["氏名", "部署", "雇用形態", "週時間", "社保", "雇保", "ステータス", "操作"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{c.employeeName}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{getDeptName(c.companyId)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{c.employmentType}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>{c.weeklyHours}h</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          <span style={{ color: c.socialInsurance ? C.green : C.red }}>{c.socialInsurance ? "加入" : "-"}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          <span style={{ color: c.employmentInsurance ? C.green : C.red }}>{c.employmentInsurance ? "加入" : "-"}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>{statusBadge(c.status)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {c.status === "active" && (
                            <button
                              onClick={() => {
                                setShowRetireModal(c);
                                setRetireForm({ retirementReason: "自己都合", retirementRemarks: "", retiredYear: "", retiredMonth: "", retiredDay: "" });
                              }}
                              style={{ padding: "4px 10px", fontSize: 11, color: C.red, background: "#fff0f0", border: "none", borderRadius: 4, cursor: "pointer" }}
                            >
                              退職処理
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== 書類作成 ===== */}
        {page === "contracts" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 20 }}>書類作成</h1>
            <button
              onClick={() => setShowContractForm(true)}
              style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer", marginBottom: 20 }}
            >
              + 新規書類作成
            </button>

            <div style={{ background: C.white, borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 16 }}>作成済み書類</h2>
              {contracts.length === 0 ? (
                <p style={{ color: C.gray, fontSize: 14 }}>書類がありません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      {["氏名", "部署", "書類種別", "雇用形態", "ステータス"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.navy }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.light}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>{c.employeeName}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{getDeptName(c.companyId)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: C.navy, fontWeight: 600 }}>{documentTypeLabel(c.documentType)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: C.gray }}>{c.employmentType}</td>
                        <td style={{ padding: "10px 12px" }}>{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>

      {/* 部署モーダル */}
      {showDeptForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) resetDeptForm(); }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 520, maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 20 }}>
              {editDept ? "部署を編集" : "部署を追加"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FormField label="部署名 *" value={deptForm.name} onChange={(v) => setDeptForm({ ...deptForm, name: v })} />
              <FormField label="所在地" value={deptForm.address} onChange={(v) => setDeptForm({ ...deptForm, address: v })} />
              <FormField label="代表取締役名" value={deptForm.representative} onChange={(v) => setDeptForm({ ...deptForm, representative: v })} />
              <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>労働時間デフォルト</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: C.gray }}>始業</span>
                  <SmallInput value={deptForm.defaultStartHour} onChange={(v) => setDeptForm({ ...deptForm, defaultStartHour: v })} width={50} />
                  <span>:</span>
                  <SmallInput value={deptForm.defaultStartMinute} onChange={(v) => setDeptForm({ ...deptForm, defaultStartMinute: v })} width={50} />
                  <span style={{ fontSize: 13, color: C.gray, marginLeft: 12 }}>終業</span>
                  <SmallInput value={deptForm.defaultEndHour} onChange={(v) => setDeptForm({ ...deptForm, defaultEndHour: v })} width={50} />
                  <span>:</span>
                  <SmallInput value={deptForm.defaultEndMinute} onChange={(v) => setDeptForm({ ...deptForm, defaultEndMinute: v })} width={50} />
                </div>
              </div>
              <FormField label="週所定労働時間" value={String(deptForm.defaultWeeklyHours)} onChange={(v) => setDeptForm({ ...deptForm, defaultWeeklyHours: Number(v) || 0 })} type="number" />
              <div style={{ display: "flex", gap: 16 }}>
                <FormField label="賃金締切日" value={deptForm.payClosingDay} onChange={(v) => setDeptForm({ ...deptForm, payClosingDay: v })} />
                <FormField label="支払日" value={deptForm.paymentDay} onChange={(v) => setDeptForm({ ...deptForm, paymentDay: v })} />
              </div>
              <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>処遇デフォルト</div>
                <div style={{ display: "flex", gap: 20 }}>
                  <CheckField label="昇給あり" checked={deptForm.incrementDefault} onChange={(v) => setDeptForm({ ...deptForm, incrementDefault: v })} />
                  <CheckField label="賞与あり" checked={deptForm.bonusDefault} onChange={(v) => setDeptForm({ ...deptForm, bonusDefault: v })} />
                  <CheckField label="退職金あり" checked={deptForm.retirementAllowanceDefault} onChange={(v) => setDeptForm({ ...deptForm, retirementAllowanceDefault: v })} />
                </div>
              </div>
              <FormField label="就業規則確認場所" value={deptForm.workRulesLocation} onChange={(v) => setDeptForm({ ...deptForm, workRulesLocation: v })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={resetDeptForm} style={{ padding: "8px 20px", fontSize: 13, color: C.gray, background: C.cream, border: "none", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveDept} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: "none", borderRadius: 6, cursor: "pointer" }}>{editDept ? "更新" : "追加"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 書類作成フォーム */}
      {showContractForm && user && (
        <ContractForm
          user={user}
          departments={departments}
          allContracts={contracts}
          onClose={() => setShowContractForm(false)}
        />
      )}

      {/* 退職処理モーダル */}
      {showRetireModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowRetireModal(null); }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 32, width: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 20 }}>退職処理</h2>
            <p style={{ fontSize: 14, marginBottom: 16 }}><strong>{showRetireModal.employeeName}</strong> さんの退職処理</p>
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
    </div>
  );
}
