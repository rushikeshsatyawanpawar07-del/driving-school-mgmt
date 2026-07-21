import jsPDF from "jspdf";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SCHOOL } from "../config/schoolConfig";

const COUNTER_REF = doc(db, "counters", "invoiceCounter");

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

function fmtDate(dateStr) {
  if (!dateStr) return "___ / ___ / ______";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return parts[2] + " / " + parts[1] + " / " + parts[0];
  }
  return dateStr;
}

function fmtMoney(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN");
}

export async function generateInvoicePDF(student) {
  await getNextInvoiceNumber();
  const docPdf = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210, ph = 297, m = 15;

  let dev = false;
  try {
    const resp = await fetch("/fonts/NotoSansDevanagari.ttf");
    const blob = await resp.blob();
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
      reader.onload = () => {
        const b64 = reader.result.split(",")[1];
        docPdf.addFileToVFS("NotoSansDevanagari.ttf", b64);
        docPdf.addFont("NotoSansDevanagari.ttf", "NotoSansDevanagari", "normal");
        docPdf.addFont("NotoSansDevanagari.ttf", "NotoSansDevanagari", "bold");
        dev = true;
        resolve();
      };
      reader.onerror = resolve;
      reader.readAsDataURL(blob);
    });
  } catch { /* fallback to helvetica */ }

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(10);
  docPdf.setTextColor(0, 0, 0);

  try {
    const resp = await fetch("/logo.jpeg");
    const blob = await resp.blob();
    const reader = new FileReader();
    await new Promise((resolve) => {
      reader.onload = () => {
        docPdf.addImage(reader.result, "JPEG", m, 10, 28, 28);
        resolve();
      };
      reader.onerror = resolve;
      reader.readAsDataURL(blob);
    });
  } catch { /* skip */ }

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(18);
  docPdf.text("NEW BHARATIS DRIVING SCHOOL", pw / 2, 30, { align: "center" });

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(11);
  docPdf.text(SCHOOL.address, pw / 2, 42, { align: "center" });

  docPdf.setDrawColor(0, 0, 0);
  docPdf.setLineWidth(0.6);
  docPdf.line(m, 50, pw - m, 50);

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(22);
  docPdf.text("FORM 14", pw / 2, 62, { align: "center" });

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);
  docPdf.text("(See Rule 27 a & c)", pw / 2, 70, { align: "center" });
  docPdf.text("Register showing the enrolments of trainee(s) in the Driving School establishment", pw / 2, 78, { align: "center" });

  docPdf.setLineWidth(0.6);
  docPdf.line(m, 82, pw - m, 82);

  const photoX = pw - m - 35;
  const photoY = 86;
  const photoW = 35;
  const photoH = 45;

  docPdf.setLineWidth(0.3);
  docPdf.rect(photoX, photoY, photoW, photoH);
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(9);
  docPdf.text("Paste", photoX + photoW / 2, photoY + photoH / 2 - 6, { align: "center" });
  docPdf.text("Passport", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
  docPdf.text("Size Photo", photoX + photoW / 2, photoY + photoH / 2 + 6, { align: "center" });

  function ul(x, y, w) {
    docPdf.setDrawColor(0, 0, 0);
    docPdf.setLineWidth(0.3);
    docPdf.line(x, y + 1, x + w, y + 1);
  }

  function labelB(x, y, text) {
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(10);
    docPdf.text(text, x, y);
    return docPdf.getTextWidth(text);
  }

  function valueN(x, y, text) {
    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    docPdf.text(text, x, y);
  }

  let y = 92;

  const dayTime = student.batch === "Morning" ? (student.batchTime || "").replace(/\s*AM\s*/g, "").trim() : "";
  const nightTime = student.batch === "Evening" ? (student.batchTime || "").replace(/\s*PM\s*/g, "").trim() : "";

  const vModel = student.vehicleType || (student.selectedVehicles && student.selectedVehicles[0] ? student.selectedVehicles[0].name : "");

  const maxLeft = photoX - 3;

  function drawField(x, y, lbl, val, valW) {
    const lw = labelB(x, y, lbl);
    const sx = x + lw + 2;
    valueN(sx, y, val || "");
    const uw = Math.max(valW || 25, docPdf.getTextWidth(val || "") + 2);
    ul(sx, y, uw);
    return sx + uw;
  }

  function drawDateField(x, y, lbl, val) {
    const lw = labelB(x, y, lbl);
    const sx = x + lw + 2;
    const display = val ? fmtDate(val) : "___ / ___ / ______";
    valueN(sx, y, display);
    const placeholderW = docPdf.getTextWidth("___ / ___ / ______") + 2;
    const actualW = val ? docPdf.getTextWidth(fmtDate(val)) + 2 : 0;
    const uw = Math.max(placeholderW, actualW, 28);
    ul(sx, y, uw);
    return sx + uw;
  }

  let cx = m;
  cx = drawField(cx, y, "Registration No.", student.studentId || "", 30);
  drawField(cx + 5, y, "Vehicle Model", vModel, 28);
  y += 14;
  cx = m;
  drawDateField(cx, y, "Date", student.joiningDate || "");

  y = 124;
  const nameLw = labelB(m, y, "Name");
  const nameSx = m + nameLw + 2;
  valueN(nameSx, y, student.name || "");
  ul(nameSx, y, maxLeft - nameSx);

  y = 144;
  cx = m;
  cx = drawDateField(cx, y, "Date of Birth", student.dob || "");
  cx = drawField(cx + 5, y, "Blood Group", student.bloodGroup || "", 35);

  y = 162;
  const addrLw = labelB(m, y, "Address");
  const addrSx = m + addrLw + 2;
  const addrText = student.permanentAddress || student.address || "";
  const addrW = pw - m - addrSx;
  valueN(addrSx, y, addrText);
  ul(addrSx, y, addrW);

  y = 180;
  labelB(m, y, "Address");
  ul(m + docPdf.getTextWidth("Address") + 2, y, pw - m - (m + docPdf.getTextWidth("Address") + 2));

  y = 198;
  cx = m;
  cx = drawField(cx, y, "Mobile No.", student.phone || "", 35);
  cx = drawField(cx + 5, y, "Advance", fmtMoney(student.feesPaid), 30);
  drawField(cx + 5, y, "Balance", fmtMoney(student.pendingFees), 30);

  y = 216;
  cx = m;
  cx = drawField(cx, y, "Class Of Training", student.course || "", 40);

  const dayLw = labelB(cx + 5, y, "Time (Day)");
  const daySx = cx + 5 + dayLw + 2;
  valueN(daySx, y, dayTime);
  ul(daySx, y, Math.max(20, docPdf.getTextWidth(dayTime) + 2));
  valueN(daySx + Math.max(20, docPdf.getTextWidth(dayTime) + 2) + 2, y, "AM");

  const nightLw = labelB(daySx + 35, y, "Time (Night)");
  const nightSx = daySx + 35 + nightLw + 2;
  valueN(nightSx, y, nightTime);
  ul(nightSx, y, Math.max(20, docPdf.getTextWidth(nightTime) + 2));
  valueN(nightSx + Math.max(20, docPdf.getTextWidth(nightTime) + 2) + 2, y, "PM");

  y = 234;
  cx = m;
  cx = drawField(cx, y, "Driving License No.", student.dlNumber || "", 35);
  drawDateField(cx + 5, y, "Validity Up To", student.dlValidTill || "");

  y = 252;
  cx = m;
  cx = drawField(cx, y, "Learning License No.", student.llNumber || "", 35);
  cx = drawDateField(cx + 5, y, "Issue Date", student.llValidFrom || "");
  drawDateField(cx + 5, y, "Valid Till", student.llValidTo || "");

  y = 270;
  cx = m;
  cx = drawDateField(cx, y, "Completion Of Course", student.courseCompletionDate || "");
  drawDateField(cx + 5, y, "Passing Date (DL Test)", "");

  docPdf.addPage();

  const dFont = dev ? "NotoSansDevanagari" : "helvetica";

  docPdf.setFont(dFont, "bold");
  docPdf.setFontSize(16);
  docPdf.text("नियम व अटी", pw / 2, 25, { align: "center" });

  docPdf.setFont(dFont, "normal");
  docPdf.setFontSize(11);

  const rules = [
    "१. एकदा भरलेली फी कोणत्याही कारणास्तव परत किंवा",
    "    दुसऱ्याच्या नावावर केली जाणार नाही.",
    "२. २५ दिवसांचे ट्रेनिंग ४० दिवसात पूर्ण न झाल्यास ज्यादा फी भरावी लागेल.",
    "३. लर्निंग लायसन्स काढल्यानंतर ट्रेनिंग चालू होईल.",
    "४. फी ची रक्कम भरल्यानंतर ट्रेनिंगसाठी वेळेवर उपस्थित राहण्याची",
    "    जबाबदारी उमेदवारावर राहील.",
    "५. शिकाऊ लायसन्स काढल्यावर ३० दिवसानंतर",
    "    पक्क्या लायसन्स करीता ऑफिसमध्ये येऊन भेटणे.",
    "६. शिकाऊ लायसन्सच्या परीक्षेसाठी वाहतुकीचे नियम व चिन्हांचा",
    "    अभ्यास करणे आवश्यक आहे.",
    "७. पक्क्या लायसन्सकरिता ड्रायव्हिंग परीक्षा पास झाल्यानंतर",
    "    ड्रायव्हिंग लायसन्स एक महिन्याच्या आत पोस्टाने घरपोच येईल.",
    "८. पक्के लायसन्स पोस्टाने घरी येत असल्याने आपण",
    "    दिलेल्या पत्याचे पुरावे योग्य असणे आवश्यक आहे.",
    "९. लायसन्स घरी आले नाही तर त्याची सर्व जबाबदारी",
    "    विद्यार्थ्यांची असेल.",
  ];

  const rtoLines = [
    "-----------------------------------------------------------------",
    "R.T.O. ला येत असताना सर्व ओरिजनल पेपर्स सोबत घेऊन येणे आवश्यक आहे",
    "१. लर्निंग लायसन्स साठी :",
    "    १. संगमब्रीज R.T.O. जुना बाजार जवळ, मंगळवार पेठ, पुणे.",
    "    २. वेळ : दुपारी १ वाजता आल्यानंतर संध्याकाळी ५ वाजेपर्यंतचा",
    "        वेळ काढुन यावे",
    "२. पक्क्या लायसन्स साठी :",
    "    १. फक्त २ व्हिलर : फुले नगर, विश्रांतवाडी, आर.टी.ओ.,",
    "        आळंदी रोड, पुणे.",
    "    २. २ व्हिलर व ४ व्हिलर : नाशिकफाटा, वल्लभनगर एसटी स्टैंड,",
    "        हॉटेल कलासागर समोर, IDTR R.T.O. कासारवाडी पुणे.",
    "        वेळ : सकाळी ७ वा. आल्यानंतर संध्या. ५ वाजेपर्यंतचा",
    "        वेळ काढुन यावे.",
  ];

  let ry = 40;
  docPdf.setFont(dFont, "normal");
  docPdf.setFontSize(11);

  for (const rule of rules) {
    docPdf.text(rule, m, ry);
    ry += 6.5;
  }

  for (const line of rtoLines) {
    docPdf.text(line, m, ry);
    ry += 6.5;
  }

  ry += 12;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(10);

  docPdf.text("Candidate Signature", m, ry);
  docPdf.setDrawColor(0, 0, 0);
  docPdf.setLineWidth(0.3);
  docPdf.line(m, ry + 2, m + 55, ry + 2);

  docPdf.text("Owner Signature", pw - m - 55, ry);
  docPdf.line(pw - m - 55, ry + 2, pw - m, ry + 2);

  const filename = (student.name || "Student").replace(/\s+/g, "_") + "_Form14.pdf";
  docPdf.save(filename);
}
