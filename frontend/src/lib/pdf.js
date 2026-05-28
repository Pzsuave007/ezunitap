import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLOR_PRIMARY = [30, 58, 138]; // #1E3A8A
const COLOR_SECONDARY = [16, 185, 129]; // #10B981
const COLOR_TEXT = [15, 23, 42];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadImageAsDataURL(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function header(doc, business, title, numberLabel, number, dateStr) {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, 210, 38, "F");

  // Logo on the left (if available)
  let textX = 14;
  if (business?.logo_photo_id) {
    const dataUrl = await loadImageAsDataURL(`${API}/public/card/photo/${business.logo_photo_id}`);
    if (dataUrl) {
      try {
        const fmt = dataUrl.startsWith("data:image/png") ? "PNG"
          : dataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
        // 18x18 mm rounded white background card for the logo
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 9, 20, 20, 3, 3, "F");
        doc.addImage(dataUrl, fmt, 15, 10, 18, 18);
        textX = 38;
      } catch (e) {
        // ignore unsupported image formats
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(business?.logo_photo_id ? 18 : 22);
  doc.text(business?.business_name || "Your Business", textX, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let infoY = 23;
  if (business?.business_email) { doc.text(business.business_email, textX, infoY); infoY += 4.5; }
  if (business?.phone) { doc.text(business.phone, textX, infoY); infoY += 4.5; }
  if (business?.business_address) { doc.text(business.business_address, textX, infoY); }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title.toUpperCase(), 196, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${numberLabel}: ${number || ""}`, 196, 24, { align: "right" });
  doc.text(`Date: ${dateStr}`, 196, 29, { align: "right" });
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

export async function generateQuotePDF(quote, business, client) {
  const doc = new jsPDF();
  const dateStr = new Date(quote.created_at || Date.now()).toLocaleDateString("en-US");
  await header(doc, business, "Quote", "Quote #", quote.number, dateStr);
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
  const labelX = 130;
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
  const qDeposit = Number(quote.deposit_amount) || 0;
  if (qDeposit > 0) {
    doc.setTextColor(...COLOR_SECONDARY);
    addRow("Deposit upfront", fmtMoney(qDeposit), true);
    doc.setTextColor(...COLOR_TEXT);
    addRow("Balance after dep.", fmtMoney(Math.max(0, (quote.total || 0) - qDeposit)));
  }

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

export async function generateInvoicePDF(invoice, business, client) {
  const doc = new jsPDF();
  const dateStr = new Date(invoice.created_at || Date.now()).toLocaleDateString("en-US");
  await header(doc, business, "Invoice", "Invoice #", invoice.number, dateStr);
  let y = clientBlock(doc, client, 52);
  if (invoice.due_date) {
    doc.setFont("helvetica", "bold");
    doc.text("Due Date:", 140, 52);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(invoice.due_date).toLocaleDateString("en-US"), 196, 52, { align: "right" });
  }
  y += 4;

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

  const labelX = 130, valueX = 196;
  const addRow = (label, val, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y);
    doc.text(val, valueX, y, { align: "right" });
    y += 6;
  };
  addRow("Subtotal", fmtMoney(invoice.subtotal));
  if (invoice.tax_amount) addRow(`Tax (${invoice.tax_rate || 0}%)`, fmtMoney(invoice.tax_amount));
  addRow("TOTAL", fmtMoney(invoice.total), true);

  // Deposit + remaining balance — must match the public invoice page.
  const deposit = Number(invoice.deposit_amount) || 0;
  if (deposit > 0) {
    doc.setTextColor(...COLOR_SECONDARY);
    addRow("Deposit upfront", fmtMoney(deposit), true);
    doc.setTextColor(...COLOR_TEXT);
    addRow("Balance after dep.", fmtMoney(Math.max(0, (invoice.total || 0) - deposit)));
  }

  if (invoice.amount_paid) addRow("Paid", fmtMoney(invoice.amount_paid));
  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
  if (balance > 0 && !deposit) {
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
    y += n.length * 5 + 4;
  }

  // Reference to the signed agreement — short summary only. The client
  // already has the full signed agreement (separate PDF), so duplicating
  // every clause here would clutter the invoice.
  const terms = invoice.agreement_terms;
  if (terms) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(14, y, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("PER SIGNED SERVICE AGREEMENT", 18, y + 5.5);
    doc.setTextColor(...COLOR_TEXT);
    y += 13;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (terms.signer_name) {
      const line = `Signed by ${terms.signer_name}${terms.signed_at ? ` on ${new Date(terms.signed_at).toLocaleDateString("en-US")}` : ""}.`;
      doc.text(line, 14, y);
      y += 6;
    }
    if (deposit > 0) {
      doc.text(`Deposit required: ${fmtMoney(deposit)} due before work begins.`, 14, y);
      y += 6;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Full terms are in the Service Agreement signed by the client.",
      14, y
    );
    doc.setTextColor(...COLOR_TEXT);
    y += 6;
  }

  doc.save(`Invoice-${invoice.number || "draft"}.pdf`);
}

// --- Agreement section helpers (shared by Agreement PDF + Invoice's snapshot)

/**
 * Returns an ordered array of {kind, label, value} describing every
 * non-empty clause in an `agreement.sections` object.
 *
 * Supports BOTH the full AI-generated agreement schema (services_included,
 * schedule, pricing, cancellation_policy, etc.) AND the simpler scope-style
 * schema (what_is_included, materials, timeline, warranty_notes,
 * change_order_note) that older agreements used.
 */
export function listAgreementClauses(sections) {
  const s = sections || {};
  const out = [];
  const push = (kind, label, value) => {
    if (kind === "list" ? value?.length : value) out.push({ kind, label, value });
  };
  // Preamble first if present
  push("text", "Preamble", s.preamble);
  // Lists
  push("list", "Services Included", s.services_included || s.what_is_included);
  push("list", "Services Excluded", s.services_excluded || s.what_is_not_included);
  push("list", "Materials", s.materials);
  // Texts
  push("text", "Schedule", s.schedule || s.timeline);
  push("text", "Pricing", s.pricing);
  push("text", "Payment Terms", s.payment_terms);
  push("text", "Cancellation Policy", s.cancellation_policy);
  push("list", "Client Responsibilities", s.client_responsibilities);
  push("text", "Warranty", s.warranty || s.warranty_notes);
  push("text", "Liability & Indemnity", s.liability_and_indemnity);
  push("text", "Insurance", s.insurance_statement);
  push("text", "Change Orders", s.change_orders || s.change_order_note);
  push("text", "Dispute Resolution", s.dispute_resolution);
  push("list", "Industry-Specific Clauses", s.industry_specific_clauses);
  return out;
}

export async function generateAgreementPDF(agreement, business, client) {
  const doc = new jsPDF();
  const dateStr = new Date(agreement.created_at || Date.now()).toLocaleDateString("en-US");
  await header(doc, business, "Service Agreement", "Agreement #", agreement.id?.slice(0, 8) || "—", dateStr);
  let y = clientBlock(doc, client, 52);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(agreement.title || "Service Agreement", 14, y);
  y += 7;

  // Totals + deposit summary
  const total = Number(agreement.total) || 0;
  const deposit = Number(agreement.deposit) || 0;
  if (total > 0 || deposit > 0) {
    const labelX = 130, valueX = 196;
    const addRow = (label, val, bold = false, color = null) => {
      if (color) doc.setTextColor(...color);
      else doc.setTextColor(...COLOR_TEXT);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.text(label, labelX, y);
      doc.text(val, valueX, y, { align: "right" });
      doc.setTextColor(...COLOR_TEXT);
      y += 6;
    };
    if (total > 0) addRow("TOTAL", fmtMoney(total), true);
    if (deposit > 0) {
      addRow("Deposit upfront", fmtMoney(deposit), true, COLOR_SECONDARY);
      addRow("Balance after dep.", fmtMoney(Math.max(0, total - deposit)));
    }
    y += 2;
  }

  // Render all clauses dynamically (supports both schemas)
  const clauses = listAgreementClauses(agreement.sections);
  doc.setFontSize(10);
  for (const c of clauses) {
    if (y > 268) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(c.label.toUpperCase(), 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (c.kind === "list") {
      for (const it of c.value) {
        if (y > 280) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`• ${it}`, 178);
        doc.text(lines, 16, y);
        y += lines.length * 4.5;
      }
    } else {
      const lines = doc.splitTextToSize(c.value, 180);
      // Wrap-aware page break
      for (const line of lines) {
        if (y > 285) { doc.addPage(); y = 20; }
        doc.text(line, 14, y);
        y += 4.5;
      }
    }
    y += 3;
  }

  // Signature block
  if (y > 250) { doc.addPage(); y = 20; }
  y += 6;
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.line(14, y, 90, y);
  doc.line(110, y, 196, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Client Signature", 14, y + 5);
  doc.text("Date", 110, y + 5);
  if (agreement.status === "signed") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text(agreement.signer_name || "—", 14, y - 2);
    if (agreement.signed_at) {
      doc.text(new Date(agreement.signed_at).toLocaleDateString("en-US"), 110, y - 2);
    }
    doc.setTextColor(...COLOR_TEXT);
  }

  doc.save(`Agreement-${(agreement.id || "draft").slice(0, 8)}.pdf`);
}
