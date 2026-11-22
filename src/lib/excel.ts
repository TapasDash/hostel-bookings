import * as XLSX from "xlsx";
import type { Booking } from "@/lib/schema";

export const downloadBookingsExcel = (
  bookings: Booking[],
  lang: "en" | "vi" = "en"
): void => {
  const isVi = lang === "vi";

  const headers = isVi
    ? [
        "Trạng thái",
        "Kênh OTA",
        "Mã đặt phòng",
        "Tên khách hàng",
        "Ngày nhận phòng",
        "Ngày trả phòng",
        "Số lượng khách",
        "Loại phòng",
        "Tổng tiền",
        "Tiền tệ",
        "Ghi chú",
      ]
    : [
        "Status",
        "OTA Source",
        "Booking Ref",
        "Guest Name",
        "Check-in",
        "Check-out",
        "Guests",
        "Room Type",
        "Total Price",
        "Currency",
        "Notes",
      ];

  const formatAction = (action: Booking["action"]): string => {
    if (isVi) {
      if (action === "new") return "Đặt mới";
      if (action === "modified") return "Sửa đổi";
      if (action === "cancelled") return "Đã hủy";
      return action;
    }
    if (action === "new") return "New";
    if (action === "modified") return "Modified";
    if (action === "cancelled") return "Cancelled";
    return action;
  };

  const rows = bookings.map((b) => [
    formatAction(b.action),
    b.otaSource,
    b.bookingRef,
    b.guestName,
    b.checkIn,
    b.checkOut,
    b.guestsCount,
    b.roomType,
    b.totalPrice !== null ? b.totalPrice : "",
    b.currency ?? "",
    b.notes ?? "",
  ]);

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-size column widths based on maximum content length
  const colWidths = headers.map((header, colIdx) => {
    const maxContentLen = Math.max(
      header.length,
      ...rows.map((row) =>
        row[colIdx] !== undefined && row[colIdx] !== null
          ? String(row[colIdx]).length
          : 0
      )
    );
    return { wch: Math.min(Math.max(maxContentLen + 3, 12), 50) };
  });

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = isVi ? "Danh Sách Đặt Phòng" : "Hostel Bookings";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const today = new Date().toISOString().split("T")[0];
  const filename = `hostel-bookings-${today}.xlsx`;

  // Write and trigger download in browser
  XLSX.writeFile(workbook, filename, { bookType: "xlsx", type: "binary" });
};
