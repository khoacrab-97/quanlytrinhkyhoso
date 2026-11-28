// Bản in "Phiếu phê duyệt và kiểm tra" - dựng theo mẫu Word "Mẫu trình ký - 12.05.2026.docx"
// (bảng 4 cột 21.3/25.7/24/29%, Times New Roman 10pt, chiều cao hàng theo mẫu).
import type { ReactNode } from "react";

export type SheetContent = {
  docTitle: string;
  projectName: string;
  partnerName: string;
  submitDate: string; // yyyy-mm-dd
  departmentName: string;
  otherContent: string;
  preparerName: string;
  relatedPersonName: string;
  managerName: string;
};

const DOTS = "……………………";
const b = "1px solid #000";

function fmt(d: string) {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ".........../…...../20…......";
}

function Cell({ children, span, h, center, bold, valign = "middle" }: { children?: ReactNode; span?: number; h?: number; center?: boolean; bold?: boolean; valign?: "top" | "middle" | "bottom" }) {
  return (
    <td
      colSpan={span}
      style={{ border: b, padding: "0.8mm 1.6mm", height: h ? `${h}mm` : undefined, textAlign: center ? "center" : "left", fontWeight: bold ? 700 : 400, verticalAlign: valign, lineHeight: 1.25 }}
    >
      {children}
    </td>
  );
}

export function SigningSheet({ c, resubmitNo, reason, code, locked, footer }: { c: SheetContent; resubmitNo: number; reason?: string | null; code?: string; locked?: boolean; footer?: string }) {
  const box = (on: boolean) => <span style={{ fontFamily: "'Segoe UI Symbol', 'Times New Roman', serif" }}>{on ? "☑" : "☐"}</span>;
  return (
    <div className="print-sheet" data-locked={locked ? "true" : "false"} style={{ width: "198mm", fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt", color: "#000", background: "#fff" }}>
      <div className="sheet-body">
        {code && <div style={{ fontSize: "9pt", fontWeight: 700, marginBottom: "1mm" }}>Mã phiếu: {code}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "21.3%" }} />
            <col style={{ width: "25.7%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "29%" }} />
          </colgroup>
          <tbody>
            <tr>
              <Cell h={8.9} bold>Tên hồ sơ/ Loại hồ sơ</Cell>
              <Cell span={3} bold>: {c.docTitle || DOTS}</Cell>
            </tr>
            <tr>
              <Cell h={7.5}>Dự án/ Công trình</Cell>
              <Cell>: {c.projectName || DOTS}</Cell>
              <Cell>Tên Chủ đầu tư/Nhà cung cấp/Thầu phụ…</Cell>
              <Cell>: {c.partnerName || DOTS}</Cell>
            </tr>
            <tr>
              <Cell h={7.1}>Ngày trình ký</Cell>
              <Cell>: {fmt(c.submitDate)}</Cell>
              <Cell>Phòng ban</Cell>
              <Cell>: {c.departmentName || DOTS}</Cell>
            </tr>
            <tr>
              <Cell h={9.7} bold>Trình ký lần</Cell>
              <Cell>
                <div>{box(resubmitNo === 0)} Lần đầu</div>
                <div>{box(resubmitNo > 0)} Trình lại - lần: {resubmitNo > 0 ? <b>{resubmitNo}</b> : ".…."}</div>
              </Cell>
              <Cell>Lý do (nếu trình từ lần 2)</Cell>
              <Cell>: {resubmitNo > 0 ? reason || DOTS : ""}</Cell>
            </tr>
            <tr>
              <Cell span={4} h={8.4}>
                <b>Nội dung khác:</b> <span style={{ whiteSpace: "pre-wrap" }}>{c.otherContent || "………………………………………………………………………………………………"}</span>
              </Cell>
            </tr>
            <tr>
              <Cell span={4} h={6.5} center bold>PHÊ DUYỆT VÀ KIỂM TRA</Cell>
            </tr>
            <tr>
              <Cell h={6.2} center>Người lập</Cell>
              <Cell center>Phụ trách liên quan</Cell>
              <Cell center>Quản lý phòng ban</Cell>
              <Cell center />
            </tr>
            <tr>
              <Cell h={32} center bold valign="bottom">{c.preparerName || DOTS}</Cell>
              <Cell center bold valign="bottom">{c.relatedPersonName || DOTS}</Cell>
              <Cell center bold valign="bottom">{c.managerName || DOTS}</Cell>
              <Cell center />
            </tr>
            <tr>
              <Cell h={4.9} center>Ngày trả hồ sơ</Cell>
              <Cell>:......../....../20…...</Cell>
              <Cell span={2}>Phiếu phê duyệt và kiểm tra lưu B.KSNB</Cell>
            </tr>
          </tbody>
        </table>
        {footer && (
          <div style={{ fontSize: "7pt", color: "#555", textAlign: "right", marginTop: "1mm" }}>
            {footer}
          </div>
        )}
      </div>
      <div className="sheet-locked" style={{ padding: "20mm", textAlign: "center", fontSize: "14pt", border: "2px dashed #000" }}>
        PHIẾU {code} ĐÃ HẾT THỜI HẠN IN LẠI.
        <br />
        Vui lòng chọn &quot;Trình ký lại&quot; trên hệ thống.
      </div>
    </div>
  );
}
