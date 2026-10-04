/**
 * The receipt as a PDF, made on the phone and handed straight to WhatsApp (Android).
 *
 * Decided with the client: the PDF is built here rather than on the server — no new load on
 * the API's small instance, no storage — and it is **not kept**. The ledger row is the
 * record; the PDF is a view of it and can be made again from the same receipt at any time.
 *
 * Every word printed comes from the server's receipt response, exactly as the on-screen
 * receipt shows it, so the document cannot drift between phones; only the layout is drawn
 * locally.
 */

import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import { sharePdfToWhatsApp } from "../../../modules/whatsapp-share";
import type { Receipt } from "../../api";
import { formatDateTime, formatMoney, paymentModeLabel } from "../../utils/format";
import { normalisePhone } from "../../utils/phone";

/** A5 portrait in points — a receipt, not a letter. */
const PAGE = { width: 420, height: 595 };

/**
 * The balance line, as at issue: "Balance due ₹X" while something was left, "Fee fully paid"
 * on the part that completed the year, and nothing for a fee paid in one go or a non-fee
 * receipt. Shared with the on-screen receipt so the two can't disagree.
 */
export function receiptBalanceLine(r: Receipt): string | null {
  if (r.feeBalanceAfter === null) return null;
  if (r.feeBalanceAfter > 0) return `Balance due ${formatMoney(r.feeBalanceAfter)}`;
  return r.purposeLabel.includes("part payment") ? "Fee fully paid" : null;
}

/** `DPB/2026-27/0004` → `DPB-2026-27-0004.pdf` — the name the member sees in the chat. */
export function receiptFileName(r: Receipt) {
  return `${r.receiptNo.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}

/** Names, notes and the like are typed by people; never let them become markup. */
function escape(value: string | null | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The receipt card as HTML, laid out like the screen (spec §6.7). */
export function receiptHtml(r: Receipt): string {
  const balance = receiptBalanceLine(r);
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { margin: 0; }
  body { margin: 28px; color: #1A1613; font-family: Georgia, "Times New Roman", serif; }
  .sans { font-family: Helvetica, Arial, sans-serif; }
  .mono { font-family: "Courier New", monospace; }
  .assoc { font-size: 20px; line-height: 1.2; }
  .small { font-size: 10px; color: #8A8177; }
  .rule { border-top: 1px solid #E4DDD2; margin-top: 12px; padding-top: 10px; }
  .row { display: flex; justify-content: space-between; font-size: 11px; }
  .eyebrow { font-family: "Courier New", monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #8A8177; margin-top: 14px; }
  .payer { font-size: 22px; margin-top: 4px; }
  .line { font-size: 12px; color: #5A5148; margin-top: 2px; }
  .box { display: flex; justify-content: space-between; align-items: center; background: #F4EFE7; border-radius: 12px; padding: 14px 16px; margin: 14px 0 8px; }
  .amount { font-size: 28px; }
  .cancelled { color: #B3352F; font-weight: bold; letter-spacing: 1px; margin-top: 8px; }
  .facts { display: flex; margin-top: 10px; }
  .facts div { flex: 1; }
  .sign { text-align: right; }
  .signName { font-style: italic; color: #8E1B22; font-size: 18px; }
</style></head>
<body>
  <div class="assoc">${escape(r.association.name)}</div>
  <div class="small sans">${escape(r.association.address)} · Reg. no. ${escape(r.association.registrationNo)}</div>

  <div class="rule row mono"><span>${escape(r.receiptNo)}</span><span>${escape(formatDateTime(r.collectedAt))}</span></div>
  ${r.cancelled ? `<div class="cancelled sans">CANCELLED</div>` : ""}

  <div class="eyebrow">Received with thanks from</div>
  <div class="payer">${escape(r.payer.name)}</div>
  ${r.payer.subtitle ? `<div class="line sans">${escape(r.payer.subtitle)}</div>` : ""}

  <div class="box"><span class="line sans">${escape(r.purposeLabel)}</span><span class="amount">${escape(formatMoney(r.amount))}</span></div>
  <div class="line sans">${escape(r.amountInWords)}</div>
  ${balance ? `<div class="line sans">${escape(balance)}</div>` : ""}

  <div class="facts sans">
    <div><div class="eyebrow">Mode</div><div class="line">${escape(paymentModeLabel(r.paymentMode))}</div></div>
    <div><div class="eyebrow">Collected by</div><div class="line">${escape(r.collectedByName ?? "—")}</div></div>
  </div>
  ${r.notes ? `<div class="small sans" style="margin-top:8px">Notes: ${escape(r.notes)}</div>` : ""}
  ${r.replacesReceiptNo ? `<div class="small sans" style="margin-top:4px">Replaces ${escape(r.replacesReceiptNo)}</div>` : ""}

  <div class="rule sign">
    <div class="signName">${escape(r.association.treasurerName)}</div>
    <div class="eyebrow" style="margin-top:2px">${escape(r.association.treasurerTitle)}</div>
  </div>
</body></html>`;
}

/**
 * Builds the PDF and opens WhatsApp with it attached, aimed at the member: their chat when the
 * number is in the phone's contacts, WhatsApp's picker otherwise. The collector taps Send.
 * Android only.
 *
 * The file is named after the receipt number and written to its own cache folder, which is
 * emptied first — so at most one receipt PDF is ever left on the phone. It is not removed
 * straight after sharing, because WhatsApp reads it after this call has already returned.
 *
 * The hand-off is our own module (`modules/whatsapp-share`): the file and the number go in
 * **one** launch. `react-native-share` used two, and Android dropped the second — the one with
 * the file — leaving an empty chat.
 */
export async function sendReceiptPdf(r: Receipt): Promise<void> {
  if (!r.whatsappPhone) throw new Error("This payer has no WhatsApp number on record.");

  const { uri } = await Print.printToFileAsync({ html: receiptHtml(r), ...PAGE });

  const folder = new Directory(Paths.cache, "receipts");
  if (folder.exists) {
    for (const entry of folder.list()) entry.delete();
  } else {
    folder.create({ idempotent: true, intermediates: true });
  }
  const pdf = new File(folder, receiptFileName(r));
  new File(uri).move(pdf);

  // `contentUri` comes from expo-file-system's own FileProvider, which covers the cache.
  await sharePdfToWhatsApp(pdf.contentUri, `91${normalisePhone(r.whatsappPhone)}`);
}
