/**
 * The receipt and Home — the two places a figure can be shown to the wrong person, or a
 * withheld one shown as zero.
 *
 * Correct and Cancel are an admin's, on the receipt itself. A cancelled receipt's WhatsApp
 * action sends the cancellation notice, not a "received with thanks". And on Home, a
 * collector's dashboard has `spent` and `balance` withheld by the server: the screen must say
 * "collected", never render the missing balance as ₹0.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { contributionsApi, dashboardApi, peopleApi, shopsApi, type Dashboard, type Receipt } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { HomeScreen } from "../../home/HomeScreen";
import { ReceiptScreen } from "../ReceiptScreen";
import { sendReceiptPdf } from "../receiptPdf";

jest.mock("../../../auth/usePermissions");
// The PDF hand-off is covered in receiptPdf.test.ts; here only whether the screen uses it.
jest.mock("../receiptPdf", () => ({
  ...jest.requireActual("../receiptPdf"),
  sendReceiptPdf: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("react-native-share", () => ({ __esModule: true, default: { shareSingle: jest.fn() }, Social: { Whatsapp: "whatsapp" } }));
jest.mock("../../../utils/deviceActions", () => ({ openWhatsApp: jest.fn(), callNumber: jest.fn() }));
jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() })
}));

const mockPermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;

function asRole(role: "ADMIN" | "COLLECTOR" | "VIEWER") {
  const isAdmin = role === "ADMIN";
  const canWrite = role !== "VIEWER";
  mockPermissions.mockReturnValue({
    role,
    loading: false,
    canRead: true,
    canWrite,
    isAdmin,
    canViewIdProof: isAdmin,
    canChangeIdProofType: isAdmin,
    canCaptureIdProof: canWrite,
    canRemoveIdProof: isAdmin,
    canManageCommittee: isAdmin
  });
}

const receipt: Receipt = {
  id: 55,
  receiptNo: "DPB/2026-27/0004",
  financialYear: "2026-27",
  collectedAt: "2026-10-03T16:35:41Z",
  payer: { type: "MEMBER", id: 1, name: "RAMESH KADAM", subtitle: "A-12 · KADAM PHOOL BHANDAR · Owner" },
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
  whatsappMessage: "*Dadar Phool Bazaar Vyapari Navnirman Mandal*\nReceipt DPB/2026-27/0004"
};

let client: QueryClient;
const nav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as never;

beforeEach(() => {
  client = testQueryClient();
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function renderReceipt(overrides: Partial<Receipt> = {}) {
  jest.spyOn(contributionsApi, "receipt").mockResolvedValue({ ...receipt, ...overrides });
  const view = await render(
    <ReceiptScreen navigation={nav} route={{ key: "k", name: "Receipt", params: { contributionId: 55 } } as never} />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("DPB/2026-27/0004")).toBeTruthy());
  return view;
}

describe("the receipt", () => {
  it("prints the server's words, and the balance as at issue", async () => {
    asRole("COLLECTOR");
    const view = await renderReceipt();
    expect(view.getByText("Rupees Two Thousand only")).toBeTruthy();
    expect(view.getByText("Association fee 2026-27 · part payment")).toBeTruthy();
    expect(view.getByText("Balance due ₹3,000")).toBeTruthy();
    expect(view.getByText("R. Kadam")).toBeTruthy();
  });

  it("gives an admin Correct and Cancel", async () => {
    asRole("ADMIN");
    const view = await renderReceipt();
    expect(view.getByLabelText("Correct amount")).toBeTruthy();
    expect(view.getByLabelText("Cancel receipt")).toBeTruthy();
  });

  it("gives a collector neither — they telephone the treasurer", async () => {
    asRole("COLLECTOR");
    const view = await renderReceipt();
    expect(view.queryByLabelText("Correct amount")).toBeNull();
    expect(view.queryByLabelText("Cancel receipt")).toBeNull();
  });

  it("offers a cancelled receipt's notice, not a receipt, and no further cancel", async () => {
    asRole("ADMIN");
    const view = await renderReceipt({
      cancelled: true,
      cancelReason: "WRONG_AMOUNT",
      cancelledByName: "Asha Admin",
      cancelledAt: "2026-10-04T10:00:00Z",
      replacedByReceiptNo: "DPB/2026-27/0008"
    });
    expect(view.getByText("CANCELLED")).toBeTruthy();
    expect(view.getByLabelText("Send cancellation notice on WhatsApp")).toBeTruthy();
    expect(view.getByText(/replaced by DPB\/2026-27\/0008/)).toBeTruthy();
    expect(view.queryByLabelText("Cancel receipt")).toBeNull();
  });

  it("sends a live receipt as a PDF on Android", async () => {
    asRole("COLLECTOR");
    jest.replaceProperty(Platform, "OS", "android");
    const view = await renderReceipt();

    await fireEvent.press(view.getByLabelText("Send receipt on WhatsApp"));
    await waitFor(() => expect(sendReceiptPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 55 })));
  });

  it("keeps a cancelled receipt's notice as text, not a PDF", async () => {
    asRole("ADMIN");
    jest.replaceProperty(Platform, "OS", "android");
    const { openWhatsApp } = jest.requireMock("../../../utils/deviceActions");
    const view = await renderReceipt({ cancelled: true, cancelReason: "WRONG_AMOUNT" });

    await fireEvent.press(view.getByLabelText("Send cancellation notice on WhatsApp"));
    expect(openWhatsApp).toHaveBeenCalledWith("9820020001", receipt.whatsappMessage);
    expect(sendReceiptPdf).not.toHaveBeenCalled();
  });

  it("offers no WhatsApp action to a payer with no number", async () => {
    asRole("COLLECTOR");
    const view = await renderReceipt({ whatsappPhone: null });
    expect(view.queryByLabelText("Send receipt on WhatsApp")).toBeNull();
  });
});

describe("Home", () => {
  const base: Dashboard = {
    showOutgoing: true,
    collected: 42102,
    spent: 0,
    balance: 42102,
    shopsOnRecord: 6,
    peopleLinked: 7,
    fee: {
      yearLabel: "2026-27", demandRaised: true, pendingCount: 0, pendingAmount: 0,
      partialCount: 0, partialDue: 0, arrearsShopCount: 0, arrearsAmount: 0
    },
    topContributors: []
  };

  async function renderHome(dashboard: Dashboard) {
    jest.spyOn(dashboardApi, "get").mockResolvedValue(dashboard);
    const page = { content: [], page: 0, size: 1, totalElements: 6, totalPages: 6 };
    jest.spyOn(shopsApi, "list").mockResolvedValue(page);
    jest.spyOn(peopleApi, "list").mockResolvedValue(page);
    const view = await render(<HomeScreen />, { wrapper: withQueryClient(client) });
    await waitFor(() => expect(view.getByText(/Annual fee/)).toBeTruthy());
    return view;
  }

  it("shows an admin the balance", async () => {
    asRole("ADMIN");
    const view = await renderHome(base);
    expect(view.getByText("General fund balance")).toBeTruthy();
    expect(view.getAllByText("₹42,102").length).toBeGreaterThan(0);
  });

  it("shows a collector what was collected, never a withheld balance as ₹0", async () => {
    asRole("COLLECTOR");
    const view = await renderHome({ ...base, showOutgoing: false, spent: null, balance: null });
    expect(view.getByText("Collected into the general fund")).toBeTruthy();
    expect(view.queryByText("General fund balance")).toBeNull();
    // The withheld figures leave no trace — no "Spent" line, and the big figure is the
    // collected amount rather than a balance rendered from null.
    expect(view.getByText("₹42,102")).toBeTruthy();
    expect(view.queryByText(/^Spent /)).toBeNull();
    expect(view.getByText("Spendings are visible to the treasurer only.")).toBeTruthy();
  });

  it("says when no demand is raised, instead of showing pending figures", async () => {
    asRole("VIEWER");
    const view = await renderHome({ ...base, showOutgoing: false, spent: null, balance: null,
      fee: { ...base.fee, demandRaised: false } });
    expect(view.getByText("No demand raised for 2026-27 yet.")).toBeTruthy();
    expect(view.queryByText("Nothing paid yet")).toBeNull();
  });
});
