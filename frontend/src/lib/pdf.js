import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLOR_PRIMARY = [30, 58, 138]; // #1E3A8A
const COLOR_SECONDARY = [16, 185, 129]; // #10B981
const COLOR_TEXT = [15, 23, 42];

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function header(doc, business, title, numberLabel, number, dateStr) {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(business?.business_name || "Your Business", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (business?.business_email) doc.text(business.business_email, 14, 23);
  if (business?.phone) doc.text(business.phone, 14, 28);
  if (business?.business_address) doc.text(business.business_address, 14, 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title.toUpperCase(), 196, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${numberLabel}: ${number || ""}`, 196, 23, { align: "right" });
  doc.text(`Date: ${dateStr}`, 196, 28, { align: "right" });
}

function clientBlock(doc, client, y) {
  doc.setTextColor(...COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BILL TO", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    client?.name || "—",
    client?.address || "",
    client?.email || "",
    client?.phone || "",
  ].filter(Boolean);
  lines.forEach((l, i) => doc.text(l, 14, y + 6 + i * 5));
  return y + 6 + lines.length * 5;
}

export function generateQuotePDF(quote, business, client) {
  const doc = new jsPDF();
  const dateStr = new Date(quote.created_at || Date.now()).toLocaleDateString("en-US");
  header(doc, business, "Quote", "Quote #", quote.number, dateStr);
  let y = clientBlock(doc, client, 48);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(quote.job_title || "Project Quote", 14, y);
  y += 6;
  if (quote.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const desc = doc.splitTextToSize(quote.description, 180);
    doc.text(desc, 14, y);
    y += desc.length * 5 + 2;
  }

  if (Array.isArray(quote.scope_of_work) && quote.scope_of_work.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Scope of Work", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    quote.scope_of_work.forEach((s) => {
      const lines = doc.splitTextToSize(`• ${s}`, 180);
      doc.text(lines, 16, y);
      y += lines.length * 5;
    });
    y += 2;
  }

  const rows = (quote.line_items || []).map((li) => [
    li.description,
    String(li.quantity ?? 1),
    li.unit || "ea",
    fmtMoney(li.unit_price),
    fmtMoney(li.amount),
  ]);
  if (rows.length) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Qty", "Unit", "Unit Price", "Amount"]],
      body: rows,
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // Totals
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const labelX = 140;
  const valueX = 196;
  const addRow = (label, val, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y);
    doc.text(val, valueX, y, { align: "right" });
    y += 6;
  };
  addRow("Subtotal", fmtMoney(quote.subtotal));
  if (quote.tax_amount) addRow(`Tax (${quote.tax_rate || 0}%)`, fmtMoney(quote.tax_amount));
  addRow("TOTAL", fmtMoney(quote.total), true);
  if (quote.deposit_amount)
    addRow("Deposit Required", fmtMoney(quote.deposit_amount));

  y += 4;
  if (quote.payment_terms) {
    doc.setFont("helvetica", "bold");
    doc.text("Payment Terms:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const t = doc.splitTextToSize(quote.payment_terms, 180);
    doc.text(t, 14, y);
    y += t.length * 5 + 2;
  }
  if (quote.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const n = doc.splitTextToSize(quote.notes, 180);
    doc.text(n, 14, y);
  }

  doc.save(`Quote-${quote.number || "draft"}.pdf`);
}

export function generateInvoicePDF(invoice, business, client) {
  const doc = new jsPDF();
  const dateStr = new Date(invoice.created_at || Date.now()).toLocaleDateString("en-US");
  header(doc, business, "Invoice", "Invoice #", invoice.number, dateStr);
  let y = clientBlock(doc, client, 48);
  if (invoice.due_date) {
    doc.setFont("helvetica", "bold");
    doc.text("Due Date:", 140, 48);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(invoice.due_date).toLocaleDateString("en-US"), 196, 48, { align: "right" });
  }
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(invoice.job_title || "Services", 14, y);
  y += 6;

  const rows = (invoice.line_items || []).map((li) => [
    li.description,
    String(li.quantity ?? 1),
    li.unit || "ea",
    fmtMoney(li.unit_price),
    fmtMoney(li.amount),
  ]);
  if (rows.length) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Qty", "Unit", "Unit Price", "Amount"]],
      body: rows,
      headStyles: { fillColor: COLOR_PRIMARY, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  const labelX = 140, valueX = 196;
  const addRow = (label, val, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y);
    doc.text(val, valueX, y, { align: "right" });
    y += 6;
  };
  addRow("Subtotal", fmtMoney(invoice.subtotal));
  if (invoice.tax_amount) addRow(`Tax (${invoice.tax_rate || 0}%)`, fmtMoney(invoice.tax_amount));
  addRow("TOTAL", fmtMoney(invoice.total), true);
  if (invoice.amount_paid) addRow("Paid", fmtMoney(invoice.amount_paid));
  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
  if (balance > 0) {
    doc.setTextColor(...COLOR_SECONDARY);
    addRow("Balance Due", fmtMoney(balance), true);
    doc.setTextColor(...COLOR_TEXT);
  }

  y += 4;
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const n = doc.splitTextToSize(invoice.notes, 180);
    doc.text(n, 14, y);
  }

  doc.save(`Invoice-${invoice.number || "draft"}.pdf`);
}
