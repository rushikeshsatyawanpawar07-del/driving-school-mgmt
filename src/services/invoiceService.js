import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SCHOOL } from "../config/schoolConfig";

const COUNTER_REF = doc(db, "counters", "invoiceCounter");

function formatDate() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrency(n) {
  return SCHOOL.currency + Number(n || 0).toLocaleString(SCHOOL.locale);
}

async function getNextInvoiceNumber() {
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(COUNTER_REF);
    let next = 1;
    if (snap.exists()) {
      next = (snap.data().last || 0) + 1;
    }
    transaction.set(COUNTER_REF, { last: next, updatedAt: serverTimestamp() });
    return next;
  });
  return "INV-" + String(result).padStart(4, "0");
}

function getTeacherName(teachers, teacherUid) {
  if (!teacherUid) return "Not Assigned";
  const t = teachers.find((x) => x.id === teacherUid);
  return t ? t.name : "Not Assigned";
}

export async function generateInvoicePDF(student, teachers, branchName) {
  const invoiceNo = await getNextInvoiceNumber();
  const docPdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - 2 * margin;

  const primary = [79, 70, 229];
  const gray = [100, 100, 100];
  const dark = [50, 50, 50];

  const branchAddress = branchName ? (SCHOOL.branchAddresses[branchName] || SCHOOL.address) : SCHOOL.address;

  try {
    const resp = await fetch("/logo.jpeg");
    const blob = await resp.blob();
    const reader = new FileReader();
    await new Promise((resolve) => {
      reader.onload = () => { docPdf.addImage(reader.result, "PNG", margin, 15, 28, 28); resolve(); };
      reader.onerror = resolve;
      reader.readAsDataURL(blob);
    });
  } catch { /* skip logo */ }

  const schoolNameMaxW = pageW - margin - (margin + 34);
  let schoolNameSize = 22;
  const nameLen = (SCHOOL.name || "").length;
  if (nameLen > 25) schoolNameSize = 16;
  else if (nameLen > 18) schoolNameSize = 18;

  docPdf.setFontSize(schoolNameSize);
  docPdf.setTextColor(...primary);
  docPdf.text(SCHOOL.name, margin + 34, 28, { maxWidth: schoolNameMaxW });

  docPdf.setFontSize(8);
  docPdf.setTextColor(...gray);
  docPdf.text(branchAddress, margin + 34, 34, { maxWidth: schoolNameMaxW });
  docPdf.text("Contact Number: " + SCHOOL.ownerPhone, margin + 34, 42, { maxWidth: schoolNameMaxW });

  docPdf.setDrawColor(...primary);
  docPdf.setLineWidth(0.8);
  docPdf.line(margin, 52, pageW - margin, 52);

  docPdf.setFontSize(18);
  docPdf.setTextColor(...primary);
  docPdf.text("INVOICE", margin, 62);

  docPdf.setFontSize(10);
  docPdf.setTextColor(...dark);
  docPdf.text("Invoice No: " + invoiceNo, margin, 69);
  docPdf.text("Date: " + formatDate(), margin, 75);

  // --- Student Info Section ---
  docPdf.setFontSize(13);
  docPdf.setTextColor(...primary);
  docPdf.text("Student Information", margin, 88);

  docPdf.setDrawColor(200, 200, 200);
  docPdf.setLineWidth(0.3);
  docPdf.line(margin, 91, pageW - margin, 91);

  const teacherName = getTeacherName(teachers, student.assignedTeacherId);
  const vehicleLabel = student.selectedVehicles?.length
    ? student.selectedVehicles.map((v) => v.name).join(", ")
    : student.twoWheelerName || student.vehicleType || "—";

  autoTable(docPdf, {
    startY: 94,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 10, cellPadding: 2.5, textColor: dark },
    headStyles: { fillColor: [245, 247, 250], textColor: primary, fontStyle: "bold", halign: "left" },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: gray } },
    body: [
      [{ content: "Student ID", styles: { fontStyle: "bold", textColor: gray } }, student.studentId || "—"],
      [{ content: "Student Name", styles: { fontStyle: "bold", textColor: gray } }, student.name || "—"],
      [{ content: "Phone Number", styles: { fontStyle: "bold", textColor: gray } }, student.phone || "—"],
      [{ content: "Email", styles: { fontStyle: "bold", textColor: gray } }, student.email || "—"],
      [{ content: "Address", styles: { fontStyle: "bold", textColor: gray } }, student.permanentAddress || student.address || "—"],
      [{ content: "Course", styles: { fontStyle: "bold", textColor: gray } }, student.course || "—"],
      [{ content: "Joining Date", styles: { fontStyle: "bold", textColor: gray } }, student.joiningDate || "—"],
      [{ content: "Assigned Teacher", styles: { fontStyle: "bold", textColor: gray } }, teacherName],
      [{ content: "Batch", styles: { fontStyle: "bold", textColor: gray } }, student.batch + (student.batchTime ? " (" + student.batchTime + ")" : "") || "—"],
      [{ content: "Vehicle(s)", styles: { fontStyle: "bold", textColor: gray } }, vehicleLabel],
    ],
    theme: "plain",
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });

  let nextY = docPdf.lastAutoTable.finalY + 6;

  // --- Vehicles Section (if selectedVehicles exist) ---
  const vehicles = student.selectedVehicles;
  if (vehicles?.length > 0) {
    docPdf.setFontSize(13);
    docPdf.setTextColor(...primary);
    docPdf.text("Vehicle Details", margin, nextY);

    docPdf.setDrawColor(200, 200, 200);
    docPdf.setLineWidth(0.3);
    docPdf.line(margin, nextY + 3, pageW - margin, nextY + 3);

    autoTable(docPdf, {
      startY: nextY + 6,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      styles: { fontSize: 10, cellPadding: 3, textColor: dark },
      headStyles: { fillColor: [245, 247, 250], textColor: primary, fontStyle: "bold" },
      columns: [
        { header: "#", dataKey: "idx" },
        { header: "Vehicle Name", dataKey: "name" },
        { header: "Price", dataKey: "price" },
      ],
      body: vehicles.map((v, i) => ({
        idx: String(i + 1),
        name: v.name || "—",
        price: formatCurrency(v.price || 0),
      })),
      theme: "plain",
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      columnStyles: {
        0: { cellWidth: 15, halign: "center", textColor: gray },
        1: { fontStyle: "bold" },
        2: { halign: "right" },
      },
    });

    nextY = docPdf.lastAutoTable.finalY + 6;
  }

  // --- Two Wheeler Details (if not in selectedVehicles) ---
  if (!vehicles?.length && student.twoWheelerName) {
    docPdf.setFontSize(13);
    docPdf.setTextColor(...primary);
    docPdf.text("Vehicle Details", margin, nextY);

    docPdf.setDrawColor(200, 200, 200);
    docPdf.setLineWidth(0.3);
    docPdf.line(margin, nextY + 3, pageW - margin, nextY + 3);

    autoTable(docPdf, {
      startY: nextY + 6,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      styles: { fontSize: 10, cellPadding: 2.5, textColor: dark },
      headStyles: { fillColor: [245, 247, 250], textColor: primary, fontStyle: "bold", halign: "left" },
      columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: gray } },
      body: [
        [{ content: "Vehicle Type", styles: { fontStyle: "bold", textColor: gray } }, student.twoWheelerType || "—"],
        [{ content: "Vehicle Name", styles: { fontStyle: "bold", textColor: gray } }, student.twoWheelerName],
        [{ content: "Price", styles: { fontStyle: "bold", textColor: gray } }, formatCurrency(student.twoWheelerPrice || 0)],
      ],
      theme: "plain",
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
    });

    nextY = docPdf.lastAutoTable.finalY + 6;
  }

  // --- Payment Summary ---
  docPdf.setFontSize(13);
  docPdf.setTextColor(...primary);
  docPdf.text("Payment Summary", margin, nextY);

  docPdf.setDrawColor(200, 200, 200);
  docPdf.setLineWidth(0.3);
  docPdf.line(margin, nextY + 3, pageW - margin, nextY + 3);

  const feesPaid = Number(student.feesPaid || 0);
  const courseFees = Number(student.courseFees || student.totalFees || 0);
  const pendingFees = Number(student.pendingFees || student.remainingFees || 0);
  const isPaid = pendingFees <= 0;

  const paymentRows = [
    [
      { content: "Course Fees", styles: { fontStyle: "bold", textColor: gray } },
      formatCurrency(courseFees),
    ],
  ];

  if (student.discountType && student.discountType !== "" && Number(student.discountValue) > 0) {
    const discountLabel = student.discountType === "percentage"
      ? "Discount (" + student.discountValue + "%)"
      : "Discount (" + formatCurrency(student.discountValue) + ")";
    const discountAmount = student.discountType === "percentage"
      ? Math.round(courseFees * student.discountValue / 100)
      : Number(student.discountValue);
    paymentRows.push([
      { content: discountLabel, styles: { fontStyle: "bold", textColor: gray } },
      { content: "-" + formatCurrency(discountAmount), styles: { textColor: [22, 163, 74] } },
    ]);
  }

  paymentRows.push(
    [
      { content: "Fees Paid", styles: { fontStyle: "bold", textColor: gray } },
      formatCurrency(feesPaid),
    ],
    [
      { content: "Pending Fees", styles: { fontStyle: "bold", textColor: gray } },
      { content: formatCurrency(pendingFees), styles: { textColor: isPaid ? [22, 163, 74] : [220, 38, 38] } },
    ],
    [
      { content: "Payment Status", styles: { fontStyle: "bold", textColor: gray } },
      {
        content: isPaid ? "PAID" : "PARTIALLY PAID",
        styles: { fontStyle: "bold", fontSize: 11, textColor: isPaid ? [22, 163, 74] : [220, 38, 38] },
      },
    ],
  );

  if (student.feeNote) {
    paymentRows.push([
      { content: "Fee Note", styles: { fontStyle: "bold", textColor: gray } },
      { content: student.feeNote, styles: { textColor: dark, fontSize: 9 } },
    ]);
  }

  autoTable(docPdf, {
    startY: nextY + 6,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 10, cellPadding: 3, textColor: dark },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: gray } },
    body: paymentRows,
    theme: "plain",
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });

  const paymentTableEnd = docPdf.lastAutoTable.finalY + 10;

  // --- Footer Section ---
  docPdf.setDrawColor(180, 180, 180);
  docPdf.setLineWidth(0.5);
  docPdf.line(margin, paymentTableEnd + 20, margin + 55, paymentTableEnd + 20);
  docPdf.setFontSize(10);
  docPdf.setTextColor(...gray);
  docPdf.text("Owner Signature", margin, paymentTableEnd + 26);

  docPdf.setFontSize(12);
  docPdf.setTextColor(...primary);
  docPdf.text("Thank you for choosing " + SCHOOL.name + "!", margin, paymentTableEnd + 40);

  docPdf.setFontSize(9);
  docPdf.setTextColor(...gray);
  docPdf.text("For any queries, please contact us at " + SCHOOL.phone + " or " + SCHOOL.email, margin, paymentTableEnd + 46);

  docPdf.setFontSize(8);
  docPdf.setTextColor(160, 160, 160);
  docPdf.text("This is a computer-generated invoice.", margin, 285);
  docPdf.text("Invoice No: " + invoiceNo + "  |  Date: " + formatDate(), margin, 290);

  const filename = "Invoice_" + invoiceNo + "_" + (student.name || "Student").replace(/\s+/g, "_") + ".pdf";
  docPdf.save(filename);
}
