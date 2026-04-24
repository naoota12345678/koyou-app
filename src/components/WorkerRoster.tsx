"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { C, Company, Employee } from "@/lib/types";

type Props = {
  employee: Employee;
  company: Company | null;
  onClose: () => void;
  autoPdf?: boolean;
};

export default function WorkerRoster({ employee, company, onClose, autoPdf }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdf = useCallback(async () => {
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
      const ratioW = pdfW / canvas.width;
      const ratioH = pdfH / canvas.height;
      const ratio = Math.min(ratioW, ratioH);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const xOffset = (pdfW - imgW) / 2;
      const yOffset = (pdfH - imgH) / 2;
      pdf.addImage(imgData, "PNG", xOffset, yOffset, imgW, imgH);
      pdf.save(`労働者名簿_${employee.name}.pdf`);
    } catch (e) {
      console.error("PDF生成エラー:", e);
      alert("PDF生成に失敗しました");
    } finally {
      setPdfLoading(false);
    }
  }, [employee.name]);

  useEffect(() => {
    if (autoPdf) {
      const timer = setTimeout(() => handlePdf(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoPdf, handlePdf]);

  const birthDate = employee.birthYear
    ? `${employee.birthYear}年${employee.birthMonth || ""}月${employee.birthDay || ""}日`
    : "";
  const hireDate = employee.hireYear
    ? `${employee.hireYear}年${employee.hireMonth || ""}月${employee.hireDay || ""}日`
    : "";

  // 退職情報
  const retiredDate = (() => {
    if (!employee.retiredAt) return "";
    if (typeof employee.retiredAt === "object" && "toDate" in employee.retiredAt) {
      const d = (employee.retiredAt as { toDate: () => Date }).toDate();
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return "";
  })();

  // 罫線スタイル
  const border = "1px solid #333";
  const thStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, fontWeight: 600,
    borderBottom: border, borderRight: border,
    background: "#fff", verticalAlign: "middle", color: "#333",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, borderBottom: border,
    verticalAlign: "middle", lineHeight: 1.7, minHeight: 32,
  };

  // 履歴行（罫線付き空行を含む）
  const historyLines = (employee.history || "").split("\n").filter(Boolean);
  const minHistoryRows = 12;
  const historyRows = Math.max(minHistoryRows, historyLines.length);

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

        {/* A4 用紙 */}
        <div ref={printRef} style={{
          background: "#fff", padding: "48px 56px",
          width: "210mm", minHeight: "297mm", boxSizing: "border-box",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', 'MS PMincho', serif",
          color: "#1a1a1a", lineHeight: 1.6, fontSize: 13,
        }}>

          {/* タイトル */}
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 12, marginBottom: 24 }}>
            労働者名簿
          </h1>

          {/* 事業所名 */}
          <div style={{ textAlign: "right", fontSize: 14, marginBottom: 12 }}>
            事業所名：{company?.name || ""}
          </div>

          {/* 名簿テーブル */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #333", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 100 }} />
              <col />
            </colgroup>
            <tbody>
              {/* ふりがな + 性別 */}
              <tr>
                <td style={thStyle}>ふりがな</td>
                <td style={tdStyle}>{employee.furigana || ""}</td>
                <td style={thStyle}>性別</td>
                <td style={tdStyle}>{employee.gender || ""}</td>
              </tr>
              {/* 氏名 (左半分) + 従事する業務の内容 (右半分を2行使う) */}
              <tr>
                <td style={thStyle}>氏名</td>
                <td style={{ ...tdStyle, fontSize: 16, fontWeight: 600 }}>{employee.name}</td>
                <td rowSpan={2} style={thStyle}>従事する<br />業務の内容</td>
                <td rowSpan={2} style={tdStyle}>{employee.jobContent || ""}</td>
              </tr>
              {/* 生年月日 */}
              <tr>
                <td style={thStyle}>生年月日</td>
                <td style={tdStyle}>{birthDate}</td>
              </tr>
              {/* 住所 */}
              <tr>
                <td style={thStyle}>住所</td>
                <td colSpan={3} style={tdStyle}>{employee.address || ""}</td>
              </tr>
              {/* 雇入年月日 */}
              <tr>
                <td style={{ ...thStyle, padding: "4px 12px", fontSize: 12 }}>雇入<br />年月日</td>
                <td colSpan={3} style={tdStyle}>{hireDate}</td>
              </tr>
              {/* 解雇・退職・死亡 */}
              <tr>
                <td style={{ ...thStyle, padding: "4px 12px", fontSize: 11, lineHeight: 1.4 }}>
                  解雇<br />退職<br />又は<br />死亡
                </td>
                <td colSpan={3} style={{ ...tdStyle, minHeight: 60 }}>
                  {employee.status === "retired" && retiredDate && (
                    <div>{retiredDate}　{employee.retirementReason || ""}退職{employee.retirementRemarks ? `（${employee.retirementRemarks}）` : ""}</div>
                  )}
                </td>
              </tr>
              {/* 履歴 */}
              <tr>
                <td style={{ ...thStyle, borderBottom: "2px solid #333", verticalAlign: "top" }}>履歴</td>
                <td colSpan={3} style={{ ...tdStyle, borderBottom: "none", padding: 0 }}>
                  {Array.from({ length: historyRows }).map((_, i) => (
                    <div key={i} style={{
                      padding: "4px 12px", minHeight: 24,
                      borderBottom: i < historyRows - 1 ? border : "2px solid #333",
                      fontSize: 13, lineHeight: 1.7,
                    }}>
                      {historyLines[i] || ""}
                    </div>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
