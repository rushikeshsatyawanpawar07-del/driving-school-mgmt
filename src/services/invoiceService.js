import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const SCHOOL = {
  name: "Safe Wheels Driving School",
  address: "123, Driving Academy Road, Near City Square, Mumbai - 400001",
  phone: "+91 98765 43210",
  email: "info@safewheels.com",
};

const COUNTER_DOC = doc(db, "metadata", "invoiceCounter");

function formatDate() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrency(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN");
}

async function getNextInvoiceNumber() {
  const snap = await getDoc(COUNTER_DOC);
  let next = 1;
  if (snap.exists()) {
    next = (snap.data().last || 0) + 1;
  }
  await setDoc(COUNTER_DOC, { last: next, updatedAt: serverTimestamp() });
  return "INV-" + String(next).padStart(4, "0");
}

function getTeacherName(teachers, teacherUid) {
  if (!teacherUid) return "Not Assigned";
  const t = teachers.find((x) => x.id === teacherUid);
  return t ? t.name : "Not Assigned";
}

export async function generateInvoicePDF(student, teachers) {
  const invoiceNo = await getNextInvoiceNumber();
  const docPdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - 2 * margin;

  // Colors
  const primary = [79, 70, 229]; // #4F46E5
  const gray = [100, 100, 100];
  const dark = [50, 50, 50];

  // --- Header ---
  // Load logo
  try {
    const resp = await fetch("/logo.png");
    const blob = await resp.blob();
    const reader = new FileReader();
    await new Promise((resolve) => {
      reader.onload = () => { docPdf.addImage(reader.result, "PNG", margin, 15, 28, 28); resolve(); };
      reader.onerror = resolve;
      reader.readAsDataURL(blob);
    });
  } catch { /* skip logo */ }

  docPdf.setFontSize(22);
  docPdf.setTextColor(...primary);
  docPdf.text(SCHOOL.name, margin + 34, 28);

  docPdf.setFontSize(9);
  docPdf.setTextColor(...gray);
  docPdf.text(SCHOOL.address, margin + 34, 34);
  docPdf.text("Phone: " + SCHOOL.phone + "  |  Email: " + SCHOOL.email, margin + 34, 39);

  // Divider line
  docPdf.setDrawColor(...primary);
  docPdf.setLineWidth(0.8);
  docPdf.line(margin, 48, pageW - margin, 48);

  // --- Invoice Title ---
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

  // thin line
  docPdf.setDrawColor(200, 200, 200);
  docPdf.setLineWidth(0.3);
  docPdf.line(margin, 91, pageW - margin, 91);

  const teacherName = getTeacherName(teachers, student.assignedTeacherId);

  autoTable(docPdf, {
    startY: 94,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 10, cellPadding: 2.5, textColor: dark },
    headStyles: { fillColor: [245, 247, 250], textColor: primary, fontStyle: "bold", halign: "left" },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: gray } },
    body: [
      [
        { content: "Student ID", styles: { fontStyle: "bold", textColor: gray } },
        student.studentId || "—",
      ],
      [
        { content: "Student Name", styles: { fontStyle: "bold", textColor: gray } },
        student.name || "—",
      ],
      [
        { content: "Phone Number", styles: { fontStyle: "bold", textColor: gray } },
        student.phone || "—",
      ],
      [
        { content: "Email", styles: { fontStyle: "bold", textColor: gray } },
        student.email || "—",
      ],
      [
        { content: "Course", styles: { fontStyle: "bold", textColor: gray } },
        student.course || "—",
      ],
      [
        { content: "Joining Date", styles: { fontStyle: "bold", textColor: gray } },
        student.joiningDate || "—",
      ],
      [
        { content: "Assigned Teacher", styles: { fontStyle: "bold", textColor: gray } },
        teacherName,
      ],
      [
        { content: "Batch", styles: { fontStyle: "bold", textColor: gray } },
        student.batch || "—",
      ],
      [
        { content: "Vehicle Type", styles: { fontStyle: "bold", textColor: gray } },
        student.vehicleType || "—",
      ],
    ],
    theme: "plain",
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });

  const studentTableEnd = docPdf.lastAutoTable.finalY + 6;

  // --- Payment Summary ---
  docPdf.setFontSize(13);
  docPdf.setTextColor(...primary);
  docPdf.text("Payment Summary", margin, studentTableEnd);

  docPdf.setDrawColor(200, 200, 200);
  docPdf.setLineWidth(0.3);
  docPdf.line(margin, studentTableEnd + 3, pageW - margin, studentTableEnd + 3);

  const feesPaid = Number(student.feesPaid || 0);
  const courseFees = Number(student.courseFees || student.totalFees || 0);
  const pendingFees = Number(student.pendingFees || student.remainingFees || 0);
  const isPaid = pendingFees <= 0;

  autoTable(docPdf, {
    startY: studentTableEnd + 6,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 10, cellPadding: 3, textColor: dark },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: gray } },
    body: [
      [
        { content: "Course Fees", styles: { fontStyle: "bold", textColor: gray } },
        formatCurrency(courseFees),
      ],
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
          styles: {
            fontStyle: "bold",
            fontSize: 11,
            textColor: isPaid ? [22, 163, 74] : [220, 38, 38],
          },
        },
      ],
    ],
    theme: "plain",
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });

  const paymentTableEnd = docPdf.lastAutoTable.finalY + 10;

  // --- Footer Section ---
  // Owner signature line
  docPdf.setDrawColor(180, 180, 180);
  docPdf.setLineWidth(0.5);
  docPdf.line(margin, paymentTableEnd + 20, margin + 55, paymentTableEnd + 20);
  docPdf.setFontSize(10);
  docPdf.setTextColor(...gray);
  docPdf.text("Owner Signature", margin, paymentTableEnd + 26);

  // Thank you message
  docPdf.setFontSize(12);
  docPdf.setTextColor(...primary);
  docPdf.text("Thank you for choosing " + SCHOOL.name + "!", margin, paymentTableEnd + 40);

  docPdf.setFontSize(9);
  docPdf.setTextColor(...gray);
  docPdf.text("For any queries, please contact us at " + SCHOOL.phone + " or " + SCHOOL.email, margin, paymentTableEnd + 46);

  // Terms note at bottom
  docPdf.setFontSize(8);
  docPdf.setTextColor(160, 160, 160);
  docPdf.text("This is a computer-generated invoice.", margin, 285);
  docPdf.text("Invoice No: " + invoiceNo + "  |  Date: " + formatDate(), margin, 290);

  // Save PDF
  const filename = "Invoice_" + invoiceNo + "_" + (student.name || "Student").replace(/\s+/g, "_") + ".pdf";
  docPdf.save(filename);
}
