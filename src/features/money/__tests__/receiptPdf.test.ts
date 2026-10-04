/**
 * The receipt PDF, made on the phone and handed to WhatsApp.
 *
 * Two things matter. The document prints the server's words — and never lets a typed name
 * become markup. And the hand-off gives WhatsApp the PDF's content link and the member's number
 * (country code, no plus) together, leaving at most one receipt file behind on the phone.
 */

import * as Print from "expo-print";
import { sharePdfToWhatsApp } from "../../../../modules/whatsapp-share";
import type { Receipt } from "../../../api";
import { receiptBalanceLine, receiptFileName, receiptHtml, sendReceiptPdf } from "../receiptPdf";

jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("../../../../modules/whatsapp-share", () => ({ sharePdfToWhatsApp: jest.fn() }));

/** An in-memory stand-in for the cache folder — enough to see what is created and removed. */
const mockFiles = new Set<string>();
jest.mock("expo-file-system", () => {
  const join = (...parts: unknown[]) =>
    parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/").replace(/([^:/])\/+/g, "$1/");
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(...parts);
    }
    /** What expo-file-system's FileProvider would hand out for a cache file. */
    get contentUri() {
      return this.uri.replace("file:///cache/", "content://app.FileSystemFileProvider/cached_expo_files/");
    }
    move(dest: File) {
      mockFiles.delete(this.uri);
      mockFiles.add(dest.uri);
      this.uri = dest.uri;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return [...mockFiles].some((f) => f.startsWith(`${this.uri}/`));
    }
    create() {}
    list() {
      return [...mockFiles].filter((f) => f.startsWith(`${this.uri}/`)).map((f) => new File(f));
    }
  }
  return { File, Directory, Paths: { cache: { uri: "file:///cache" } } };
});

const receipt: Receipt = {
  id: 55,
  receiptNo: "DPB/2026-27/0004",
  financialYear: "2026-27",
  collectedAt: "2026-10-03T16:35:41Z",
  payer: { type: "MEMBER", id: 1, name: "RAMESH <b>KADAM</b>", subtitle: "A-12 · KADAM PHOOL BHANDAR · Owner" },
  whatsappPhone: "9820020001",
  purpose: "ANNUAL_FEE",
  purposeLabel: "Association fee 2026-27 · part payment",
  fund: "GENERAL",
  amount: 2000,
  amountInWords: "Rupees Two Thousand only",
  feeBalanceAfter: 3000,
  paymentMode: "CASH",
  notes: null,
  collectedByName: "Nitin More",
  cancelled: false,
  cancelReason: null,
  cancelNote: null,
  cancelledAt: null,
  cancelledByName: null,
  replacesReceiptNo: null,
  replacedByReceiptNo: null,
  association: {
    name: "Dadar Phool Bazaar Vyapari Navnirman Mandal",
    address: "Dadar Phool Bazaar, Mumbai 400028",
    registrationNo: "MH/1102/2008",
    treasurerName: "R. Kadam",
    treasurerTitle: "Hon. Treasurer"
  },
  whatsappMessage: "text"
};

const printToFile = Print.printToFileAsync as jest.Mock;
const share = sharePdfToWhatsApp as jest.Mock;

beforeEach(() => {
  mockFiles.clear();
  printToFile.mockImplementation(async () => {
    mockFiles.add("file:///cache/Print/abc123.pdf");
    return { uri: "file:///cache/Print/abc123.pdf", numberOfPages: 1 };
  });
  share.mockResolvedValue(undefined);
});

afterEach(() => jest.clearAllMocks());

describe("receiptHtml", () => {
  it("prints the server's words", () => {
    const html = receiptHtml(receipt);
    for (const text of [
      "Dadar Phool Bazaar Vyapari Navnirman Mandal",
      "Reg. no. MH/1102/2008",
      "DPB/2026-27/0004",
      "Association fee 2026-27 · part payment",
      "₹2,000",
      "Rupees Two Thousand only",
      "Balance due ₹3,000",
      "Nitin More",
      "R. Kadam",
      "Hon. Treasurer"
    ]) {
      expect(html).toContain(text);
    }
  });

  it("never lets a typed name become markup", () => {
    const html = receiptHtml(receipt);
    expect(html).toContain("RAMESH &lt;b&gt;KADAM&lt;/b&gt;");
    expect(html).not.toContain("<b>KADAM</b>");
  });

  it("marks a cancelled receipt, and leaves out what isn't there", () => {
    const html = receiptHtml({ ...receipt, cancelled: true, feeBalanceAfter: null, payer: { ...receipt.payer, subtitle: null } });
    expect(html).toContain("CANCELLED");
    expect(html).not.toContain("Balance due");
  });
});

describe("receiptBalanceLine", () => {
  it("reads the balance as at issue", () => {
    expect(receiptBalanceLine(receipt)).toBe("Balance due ₹3,000");
    expect(receiptBalanceLine({ ...receipt, feeBalanceAfter: 0 })).toBe("Fee fully paid");
    expect(receiptBalanceLine({ ...receipt, feeBalanceAfter: 0, purposeLabel: "Association fee 2026-27" })).toBeNull();
    expect(receiptBalanceLine({ ...receipt, feeBalanceAfter: null })).toBeNull();
  });
});

describe("sendReceiptPdf", () => {
  it("hands WhatsApp the PDF and the member's number together, in one call", async () => {
    await sendReceiptPdf(receipt);

    expect(printToFile).toHaveBeenCalledWith(expect.objectContaining({ html: receiptHtml(receipt) }));
    expect(receiptFileName(receipt)).toBe("DPB-2026-27-0004.pdf");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(
      "content://app.FileSystemFileProvider/cached_expo_files/receipts/DPB-2026-27-0004.pdf",
      "919820020001"
    );
  });

  it("leaves at most one receipt PDF on the phone", async () => {
    mockFiles.add("file:///cache/receipts/DPB-2026-27-0001.pdf");
    await sendReceiptPdf(receipt);
    expect([...mockFiles]).toEqual(["file:///cache/receipts/DPB-2026-27-0004.pdf"]);
  });

  it("refuses a payer with no number, before making anything", async () => {
    await expect(sendReceiptPdf({ ...receipt, whatsappPhone: null })).rejects.toThrow("no WhatsApp number");
    expect(printToFile).not.toHaveBeenCalled();
  });
});
