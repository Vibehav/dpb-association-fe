/**
 * Cash handover (v2 Phase 3): the collector's card, the treasurer's count, and settling. Every
 * figure is the server's; what matters here is that each action sends what the treasurer or
 * collector actually chose — the counted amount, a note when it differs, the right direction.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { cashApi, type CollectorCashDetail, type Handover, type MyCash } from "../../../api";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { CollectorCashScreen } from "../CollectorCashScreen";
import { MyCashCard } from "../components/MyCashCard";
import { ReceiveSheet } from "../components/ReceiveSheet";

jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));

const handover: Handover = {
  id: 4, collectorId: 3, collectorName: "Nitin More", status: "PENDING",
  filedAmount: 3500, receiptCount: 2, filedAt: "2026-10-15T12:45:00Z",
  expected: 3500, liveReceiptCount: 2, countedAmount: null, difference: null,
  receivedByName: null, receivedAt: null, note: null, withdrawnAt: null
};

let client: QueryClient;
const nav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };

beforeEach(() => {
  client = testQueryClient();
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

function renderCard(cash: MyCash) {
  jest.spyOn(cashApi, "me").mockResolvedValue(cash);
  return render(<MyCashCard />, { wrapper: withQueryClient(client) });
}

describe("the collector's card", () => {
  it("shows nothing when nothing is held, waiting or open", async () => {
    const view = await renderCard({ cashWithYou: 0, receiptCount: 0, pending: null, outstanding: 0 });
    await waitFor(() => expect(cashApi.me).toHaveBeenCalled());
    expect(view.toJSON()).toBeNull();
  });

  it("hands over all the cash, after saying how much", async () => {
    const handOver = jest.spyOn(cashApi, "handOver").mockResolvedValue(handover);
    const view = await renderCard({ cashWithYou: 18600, receiptCount: 7, pending: null, outstanding: 0 });

    await waitFor(() => expect(view.getByText("₹18,600")).toBeTruthy());
    expect(view.getByText("7 cash receipts since your last handover")).toBeTruthy();
    await fireEvent.press(view.getByText("Hand over to the treasurer"));
    expect(view.getByText(/all the cash you have collected since your last handover: ₹18,600/)).toBeTruthy();
    await fireEvent.press(view.getByText("Mark as handed over"));
    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(1));
  });

  it("shows a waiting handover with Withdraw, and what is left from an earlier one", async () => {
    const withdraw = jest.spyOn(cashApi, "withdraw").mockResolvedValue(undefined);
    const view = await renderCard({ cashWithYou: 0, receiptCount: 0, pending: handover, outstanding: 200 });

    await waitFor(() => expect(view.getByText(/₹3,500 handed over on .* waiting for the treasurer to confirm/)).toBeTruthy());
    expect(view.getByText(/₹200 short from an earlier handover/)).toBeTruthy();
    expect(view.queryByText("Hand over to the treasurer")).toBeNull();
    await fireEvent.press(view.getByText("Withdraw"));
    await fireEvent.press(view.getByText("Withdraw it"));
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith(4));
  });

  it("says when the treasurer holds more than the receipts", async () => {
    const view = await renderCard({ cashWithYou: 0, receiptCount: 0, pending: null, outstanding: -100 });
    await waitFor(() => expect(view.getByText("The treasurer holds ₹100 more than your receipts.")).toBeTruthy());
  });
});

describe("the treasurer's count", () => {
  function renderSheet(onClose = jest.fn()) {
    return render(<ReceiveSheet handover={handover} onClose={onClose} />, { wrapper: withQueryClient(client) });
  }

  it("receives the expected amount in one tap", async () => {
    const receive = jest.spyOn(cashApi, "receive").mockResolvedValue({ ...handover, status: "RECEIVED" });
    const onClose = jest.fn();
    const view = await renderSheet(onClose);

    await fireEvent.press(view.getByText("Received ₹3,500"));
    await waitFor(() => expect(receive).toHaveBeenCalledWith(4, { countedAmount: 3500 }));
    expect(onClose).toHaveBeenCalled();
  });

  it("needs a note when the count differs, then sends both", async () => {
    const receive = jest.spyOn(cashApi, "receive").mockResolvedValue({ ...handover, status: "RECEIVED" });
    const view = await renderSheet();

    await fireEvent.press(view.getByText("Counted a different amount"));
    await fireEvent.changeText(view.getByDisplayValue("3500"), "3300");
    await fireEvent.press(view.getByText("Save the count"));
    expect(view.getByText("Add a note saying why the count differs.")).toBeTruthy();
    expect(receive).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText("₹200 missing"), "₹200 missing");
    await fireEvent.press(view.getByText("Save the count"));
    await waitFor(() => expect(receive).toHaveBeenCalledWith(4, { countedAmount: 3300, note: "₹200 missing" }));
  });
});

describe("settling", () => {
  function account(outstanding: number): CollectorCashDetail {
    return {
      figures: { id: 3, name: "Nitin More", phone: "9819522087", activeCollector: true, cashWithYou: 0,
        receiptCount: 0, inTransit: 0, outstanding, total: outstanding },
      handovers: [],
      settlements: []
    };
  }

  function renderCollector() {
    return render(
      <CollectorCashScreen navigation={nav as never} route={{ key: "k", name: "CollectorCash", params: { collectorId: 3 } } as never} />,
      { wrapper: withQueryClient(client) }
    );
  }

  it("records cash brought in for a shortfall, defaulting to what is short", async () => {
    jest.spyOn(cashApi, "collector").mockResolvedValue(account(200));
    const settle = jest.spyOn(cashApi, "settle").mockResolvedValue({
      id: 1, direction: "COLLECTOR_PAID", amount: 200, note: "brought it", byName: null, at: "2026-10-16T05:00:00Z"
    });
    const view = await renderCollector();

    await waitFor(() => expect(view.getByText("Record cash brought in")).toBeTruthy());
    await fireEvent.press(view.getByText("Record cash brought in"));
    expect(view.getByDisplayValue("200")).toBeTruthy();
    await fireEvent.press(view.getByText("Save"));
    expect(view.getByText("Add a note — it goes on the record.")).toBeTruthy();

    await fireEvent.changeText(view.getByPlaceholderText("Brought the ₹200"), "brought it");
    await fireEvent.press(view.getByText("Save"));
    await waitFor(() =>
      expect(settle).toHaveBeenCalledWith(3, { direction: "COLLECTOR_PAID", amount: 200, note: "brought it" })
    );
  });

  it("records cash given back when the treasurer holds extra", async () => {
    jest.spyOn(cashApi, "collector").mockResolvedValue(account(-100));
    const settle = jest.spyOn(cashApi, "settle").mockResolvedValue({
      id: 2, direction: "TREASURER_RETURNED", amount: 100, note: "gave it back", byName: null, at: "2026-10-16T05:00:00Z"
    });
    const view = await renderCollector();

    await waitFor(() => expect(view.getByText("Record cash given back")).toBeTruthy());
    await fireEvent.press(view.getByText("Record cash given back"));
    await fireEvent.changeText(view.getByPlaceholderText("Gave back the ₹100"), "gave it back");
    await fireEvent.press(view.getByText("Save"));
    await waitFor(() =>
      expect(settle).toHaveBeenCalledWith(3, { direction: "TREASURER_RETURNED", amount: 100, note: "gave it back" })
    );
  });

  it("offers no settle when nothing is open", async () => {
    jest.spyOn(cashApi, "collector").mockResolvedValue(account(0));
    const view = await renderCollector();
    await waitFor(() => expect(view.getByText("Nitin More")).toBeTruthy());
    expect(view.queryByText(/Record cash/)).toBeNull();
  });
});
