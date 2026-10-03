/**
 * The fee on the shop screen, and the two admin actions it guards.
 *
 * Collect follows the server's `collectable` and nothing else. Deleting a shop that owes asks
 * first, naming the amount, and the confirmation travels with the request — the server holds
 * the same line (409 `fee_outstanding`). Transferring a licence that owes is refused outright,
 * part-paid years included, so the button is disabled with the reason rather than left to fail.
 */

import type { QueryClient } from "@tanstack/react-query";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { shopsApi, type ShopDetail } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { ShopDetailScreen } from "../ShopDetailScreen";
import { ShopCard } from "../components/ShopCard";

jest.mock("../../../auth/usePermissions");
jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));

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

const owner = { linkId: 11, personId: 1, name: "Ramesh Kadam", phone: "9820020001", role: "OWNER" as const };

const partPaid: ShopDetail = {
  id: 101,
  shopNumber: "A-12",
  businessName: "Kadam Phool Bhandar",
  lane: "Lane 2",
  tenancy: "OWNER_RUN",
  formerHolderName: null,
  formerHolderTill: null,
  people: [owner],
  fee: {
    feeCycleId: 7, yearLabel: "2026-27", status: "PARTIAL", amount: 5000, paid: 2000, due: 3000,
    meetingNote: "Set at the GBM", collectable: true,
    receipts: [
      { id: 501, receiptNo: "DPB/2026-27/0004", amount: 2000, paymentMode: "CASH", collectedAt: "2026-10-03T10:00:00Z", payerName: "Ramesh Kadam" }
    ]
  },
  earlierYears: [
    { feeCycleId: 6, yearLabel: "2025-26", status: "PENDING", amount: 5000, paid: 0, due: 5000, collectable: true, receipts: [] }
  ],
  feeOutstanding: {
    total: 8000,
    byYear: [
      { feeCycleId: 6, yearLabel: "2025-26", due: 5000 },
      { feeCycleId: 7, yearLabel: "2026-27", due: 3000 }
    ]
  }
};

const paidUp: ShopDetail = {
  ...partPaid,
  fee: { ...partPaid.fee, status: "PAID", paid: 5000, due: 0, collectable: false },
  earlierYears: [],
  feeOutstanding: { total: 0, byYear: [] }
};

let client: QueryClient;
const navigate = jest.fn();
const goBack = jest.fn();
const nav = { navigate, goBack, setOptions: jest.fn() } as never;

beforeEach(() => {
  client = testQueryClient();
  asRole("ADMIN");
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  navigate.mockReset();
  goBack.mockReset();
});

async function renderShop(shop: ShopDetail) {
  jest.spyOn(shopsApi, "detail").mockResolvedValue(shop);
  const view = await render(
    <ShopDetailScreen navigation={nav} route={{ key: "k", name: "ShopDetail", params: { shopId: 101 } } as never} />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("Kadam Phool Bhandar")).toBeTruthy());
  return view;
}

describe("the fee card", () => {
  it("shows what was paid, what is due, and the instalments", async () => {
    const view = await renderShop(partPaid);
    expect(view.getByText("Part paid")).toBeTruthy();
    expect(view.getByText("Paid ₹2,000 · ₹3,000 still due")).toBeTruthy();
    expect(view.getByText(/DPB\/2026-27\/0004/)).toBeTruthy();
  });

  it("collects what is due this year, and an arrear by naming its year", async () => {
    const view = await renderShop(partPaid);

    await fireEvent.press(view.getByLabelText("Collect ₹3,000 due"));
    expect(navigate).toHaveBeenCalledWith("Collect", { shopId: 101, purpose: "ANNUAL_FEE" });

    await fireEvent.press(view.getByLabelText("Collect 2025-26 arrears"));
    expect(navigate).toHaveBeenCalledWith("Collect", { shopId: 101, purpose: "ANNUAL_FEE", feeCycleId: 6 });
  });

  it("offers a viewer nothing to collect", async () => {
    asRole("VIEWER");
    const view = await renderShop(partPaid);
    expect(view.queryByLabelText("Collect ₹3,000 due")).toBeNull();
    expect(view.queryByLabelText("Collect 2025-26 arrears")).toBeNull();
  });

  it("shows no fee at all before the demand is raised", async () => {
    const view = await renderShop({
      ...paidUp,
      fee: { ...paidUp.fee, status: "NO_DEMAND", amount: null, paid: null, due: null, receipts: [] }
    });
    expect(view.getByText(/No demand raised for 2026-27 yet/)).toBeTruthy();
    expect(view.queryByLabelText("Collect fee")).toBeNull();
  });
});

describe("deleting a shop that owes", () => {
  it("names the amount, and the confirmation travels with the request", async () => {
    const remove = jest.spyOn(shopsApi, "remove").mockResolvedValue(undefined);
    const view = await renderShop(partPaid);

    await fireEvent.press(view.getByLabelText("Delete shop"));
    expect(view.getByText(/It still has ₹8,000 due \(2025-26 ₹5,000 · 2026-27 ₹3,000\)/)).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Delete anyway"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(101, true));
  });

  it("deletes a paid-up shop without the confirmation flag", async () => {
    const remove = jest.spyOn(shopsApi, "remove").mockResolvedValue(undefined);
    const view = await renderShop(paidUp);

    await fireEvent.press(view.getByLabelText("Delete shop"));
    // The sheet's confirm button carries the same label as the opener here.
    const buttons = view.getAllByLabelText("Delete shop");
    await fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(remove).toHaveBeenCalledWith(101, false));
  });
});

describe("transferring a licence that owes", () => {
  it("is disabled, saying what to collect first", async () => {
    const view = await renderShop(partPaid);
    expect(view.getByLabelText("Transfer licence")).toBeDisabled();
    expect(view.getByText(/Collect it from the current licence holder before transferring/)).toBeTruthy();
  });

  it("is open once nothing is due", async () => {
    const view = await renderShop(paidUp);
    expect(view.getByLabelText("Transfer licence")).not.toBeDisabled();
  });

  it("is open on a vacant licence even with dues — nobody could pay them", async () => {
    const view = await renderShop({ ...partPaid, people: [] });
    expect(view.getByLabelText("Assign licence holder")).not.toBeDisabled();
  });
});

describe("the fee chip on a shop card", () => {
  const row = {
    id: 101, shopNumber: "A-12", businessName: "Kadam Phool Bhandar", lane: "Lane 2", tenancy: "OWNER_RUN" as const,
    licenceHolderName: "Ramesh Kadam", rentedToName: null, staffCount: 0,
    feeStatus: "PENDING" as const, feeAmount: 5000, feePaid: 0, feeDue: 5000, arrearsAmount: 0
  };

  it("reads Due, Part paid or Fee paid for this year", async () => {
    let view = await render(<ShopCard shop={row} onPress={() => undefined} />);
    expect(view.getByText("Due")).toBeTruthy();
    view = await render(<ShopCard shop={{ ...row, feeStatus: "PARTIAL", feePaid: 2000, feeDue: 3000 }} onPress={() => undefined} />);
    expect(view.getByText("Part paid")).toBeTruthy();
    expect(view.getByText("₹3,000 still due this year")).toBeTruthy();
  });

  it("shows no chip at all before the demand is raised — and arrears on their own line", async () => {
    const view = await render(
      <ShopCard
        shop={{ ...row, feeStatus: "NO_DEMAND", feeAmount: null, feePaid: null, feeDue: null, arrearsAmount: 5000 }}
        onPress={() => undefined}
      />
    );
    expect(view.queryByText("Due")).toBeNull();
    expect(view.queryByText("Fee paid")).toBeNull();
    expect(view.getByText("₹5,000 arrears from earlier years")).toBeTruthy();
  });
});
