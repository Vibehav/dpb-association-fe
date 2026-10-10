/**
 * Spending (v2 Phase 2) — admin only.
 *
 * The rules the form must respect: an own-fund event's bill says which fund pays, a
 * general-funded event's and a running cost's never do; a bill too big for an event's fund is
 * split only after the admin agrees to the server's offer; and a mistake is voided, with a
 * reason, never edited.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ApiError, eventsApi, spendingsApi, type EventDetail, type Spending } from "../../../api";
import type { CaptureState, ImageCapture } from "../../../media/useImageCapture";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { todayIso } from "../../../utils/format";
import { SpendingFormScreen } from "../SpendingFormScreen";
import { SpendingScreen } from "../SpendingScreen";
import { SpendingVoidScreen } from "../SpendingVoidScreen";

jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));

let mockBill: ImageCapture;
jest.mock("../../../media", () => ({ useImageCapture: () => mockBill }));

function slot(state: CaptureState): ImageCapture {
  return {
    state,
    key: state.status === "ready" ? state.key : null,
    previewUri: "previewUri" in state ? state.previewUri : null,
    busy: state.status === "choosing" || state.status === "uploading",
    captureFromCamera: jest.fn(),
    pickFromLibrary: jest.fn(),
    retry: jest.fn(),
    clear: jest.fn()
  };
}

const navratri: EventDetail = {
  id: 3,
  name: "Navratri 2026",
  startsOn: "2026-10-01",
  endsOn: "2026-10-12",
  ownFund: true,
  status: "ACTIVE",
  closedAt: null,
  closedByName: null,
  balanceMovedAt: null,
  showOutgoing: true,
  collected: 10000,
  spentFromEventFund: 0,
  spentFromGeneral: 0,
  totalSpent: 0,
  movedOut: 0,
  balance: 10000,
  hasEntries: true,
  transfers: []
};

const saved: Spending = {
  id: 7,
  title: "Pandal & lights",
  vendor: "Om Electricals",
  amount: 15000,
  paymentMode: "UPI",
  spentOn: "2026-10-09",
  paidFrom: "EVENT",
  event: { id: 3, name: "Navratri 2026" },
  hasBill: false,
  notes: null,
  recordedByName: "Rajendra Kadam",
  recordedAt: "2026-10-09T08:00:00Z",
  lastChangedByName: "Rajendra Kadam",
  lastChangedAt: "2026-10-09T08:00:00Z",
  voided: false,
  voidReason: null,
  voidNote: null,
  voidedAt: null,
  voidedByName: null
};

let client: QueryClient;
const nav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };

beforeEach(() => {
  client = testQueryClient();
  mockBill = slot({ status: "empty" });
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  Object.values(nav).forEach((fn) => fn.mockReset());
});

async function renderForm(eventId?: number) {
  const view = await render(
    <SpendingFormScreen
      navigation={nav as never}
      route={{ key: "k", name: "SpendingForm", params: eventId === undefined ? undefined : { eventId } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("Save spending")).toBeTruthy());
  return view;
}

async function fill(view: Awaited<ReturnType<typeof renderForm>>, title: string, amount: string) {
  await fireEvent.changeText(view.getByPlaceholderText("Mandap & stage decoration"), title);
  await fireEvent.changeText(view.getByPlaceholderText("0"), amount);
}

describe("recording a spending", () => {
  it("asks an own-fund event which fund pays, and sends it with today's date", async () => {
    jest.spyOn(eventsApi, "detail").mockResolvedValue(navratri);
    const record = jest.spyOn(spendingsApi, "record").mockResolvedValue({ entries: [saved] });
    const view = await renderForm(3);

    expect(view.getByText("Event fund")).toBeTruthy();
    expect(view.getByText(/Deducted from this event's own collection \(₹10,000 left\)/)).toBeTruthy();
    await fill(view, "Pandal & lights", "8000");
    await fireEvent.press(view.getByText("Save spending"));

    await waitFor(() =>
      expect(record).toHaveBeenCalledWith({
        title: "Pandal & lights", amount: 8000, paymentMode: "CASH", spentOn: todayIso(), eventId: 3, paidFrom: "EVENT"
      })
    );
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("offers the server's split when the event's fund falls short, and resends only on yes", async () => {
    jest.spyOn(eventsApi, "detail").mockResolvedValue(navratri);
    const offer = "Only ₹10,000 is left in the Navratri 2026 fund — confirm to pay ₹10,000 from it and the remaining ₹5,000 from the general fund";
    const record = jest
      .spyOn(spendingsApi, "record")
      .mockRejectedValueOnce(new ApiError(409, "event_fund_short", offer))
      .mockResolvedValueOnce({ entries: [saved, { ...saved, id: 8, amount: 5000, paidFrom: "GENERAL" }] });
    const view = await renderForm(3);

    await fill(view, "Pandal & lights", "15000");
    await fireEvent.press(view.getByText("Save spending"));
    await waitFor(() => expect(view.getByText(offer)).toBeTruthy());
    expect(nav.goBack).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText("Split it"));
    await waitFor(() => expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ splitToGeneral: true })));
    expect(record).toHaveBeenCalledTimes(2);
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("shows the refusal as it is when nothing is left to split", async () => {
    jest.spyOn(eventsApi, "detail").mockResolvedValue({ ...navratri, balance: 0 });
    const message = "Nothing is left in the Navratri 2026 fund — record this as paid from the general fund";
    jest.spyOn(spendingsApi, "record").mockRejectedValue(new ApiError(409, "event_fund_short", message));
    const view = await renderForm(3);

    await fill(view, "Pandal", "100");
    await fireEvent.press(view.getByText("Save spending"));
    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    expect(view.queryByText("Split it")).toBeNull();
  });

  it("never asks a general-funded event's bill which fund pays", async () => {
    jest.spyOn(eventsApi, "detail").mockResolvedValue({ ...navratri, id: 2, name: "Diwali lighting", ownFund: false });
    const record = jest.spyOn(spendingsApi, "record").mockResolvedValue({ entries: [saved] });
    const view = await renderForm(2);

    expect(view.queryByText("Event fund")).toBeNull();
    expect(view.getByText(/has no fund of its own/)).toBeTruthy();
    await fill(view, "Diya & lights", "12000");
    await fireEvent.press(view.getByText("Save spending"));

    await waitFor(() => expect(record).toHaveBeenCalled());
    expect(record.mock.calls[0][0]).toEqual(expect.objectContaining({ eventId: 2 }));
    expect(record.mock.calls[0][0]).not.toHaveProperty("paidFrom");
  });

  it("records a running cost against the general fund with no event at all", async () => {
    const record = jest.spyOn(spendingsApi, "record").mockResolvedValue({ entries: [saved] });
    const view = await renderForm();

    expect(view.getByText("A running cost, paid from the general fund.")).toBeTruthy();
    await fill(view, "Market cleaning", "96000");
    await fireEvent.press(view.getByText("Save spending"));

    await waitFor(() => expect(record).toHaveBeenCalled());
    expect(record.mock.calls[0][0]).not.toHaveProperty("eventId");
    expect(record.mock.calls[0][0]).not.toHaveProperty("paidFrom");
  });

  it("won't save while the bill is still uploading", async () => {
    mockBill = slot({ status: "uploading", previewUri: "file://bill.jpg" });
    const record = jest.spyOn(spendingsApi, "record");
    const view = await renderForm();

    await fill(view, "Office rent", "5000");
    await fireEvent.press(view.getByText("Save spending"));
    expect(view.getByText("Wait for the bill photo to finish uploading.")).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
  });

  it("sends the uploaded bill's key", async () => {
    mockBill = slot({ status: "ready", key: "bills/abc", previewUri: "file://bill.jpg" });
    const record = jest.spyOn(spendingsApi, "record").mockResolvedValue({ entries: [saved] });
    const view = await renderForm();

    await fill(view, "Office rent", "5000");
    await fireEvent.press(view.getByText("Save spending"));
    await waitFor(() => expect(record).toHaveBeenCalledWith(expect.objectContaining({ billKey: "bills/abc" })));
  });

  it("refuses paise and a missing description on the phone", async () => {
    const record = jest.spyOn(spendingsApi, "record");
    const view = await renderForm();

    await fireEvent.press(view.getByText("Save spending"));
    expect(view.getByText("Say what it was for.")).toBeTruthy();
    await fill(view, "Tea", "");
    await fireEvent.press(view.getByText("Save spending"));
    expect(view.getByText("Enter the amount in whole rupees.")).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
  });

  it("won't add to a closed event", async () => {
    jest.spyOn(eventsApi, "detail").mockResolvedValue({ ...navratri, status: "CLOSED" });
    const record = jest.spyOn(spendingsApi, "record");
    const view = await renderForm(3);

    expect(view.getByText("Navratri 2026 is closed · nothing further can be added.")).toBeTruthy();
    await fill(view, "Late bill", "100");
    await fireEvent.press(view.getByText("Save spending"));
    expect(record).not.toHaveBeenCalled();
  });
});

describe("a recorded spending", () => {
  function renderSpending() {
    return render(
      <SpendingScreen navigation={nav as never} route={{ key: "k", name: "Spending", params: { spendingId: 7 } } as never} />,
      { wrapper: withQueryClient(client) }
    );
  }

  it("shows which fund paid, and offers edit and void — not a money edit", async () => {
    jest.spyOn(spendingsApi, "get").mockResolvedValue({ ...saved, paidFrom: "GENERAL" });
    const view = await renderSpending();

    await waitFor(() => expect(view.getByText("Pandal & lights")).toBeTruthy());
    expect(view.getByText("Paid from the general fund · event support for Navratri 2026")).toBeTruthy();
    expect(view.getByText("Bill missing")).toBeTruthy();
    expect(view.getByText("Edit wording")).toBeTruthy();
    expect(view.getByText(/The amount, date and fund can't be edited/)).toBeTruthy();
    await fireEvent.press(view.getByText("Void this spending"));
    expect(nav.navigate).toHaveBeenCalledWith("SpendingVoid", { spendingId: 7 });
  });

  it("keeps a voided entry on screen, struck, with who voided it and why", async () => {
    jest.spyOn(spendingsApi, "get").mockResolvedValue({
      ...saved, voided: true, voidReason: "DUPLICATE_ENTRY", voidNote: "entered twice",
      voidedAt: "2026-10-10T08:00:00Z", voidedByName: "Rajendra Kadam"
    });
    const view = await renderSpending();

    await waitFor(() => expect(view.getByText("VOIDED")).toBeTruthy());
    expect(view.getByText(/Voided by Rajendra Kadam.*Duplicate entry · entered twice/)).toBeTruthy();
    expect(view.queryByText("Void this spending")).toBeNull();
    expect(view.queryByText("Edit wording")).toBeNull();
  });

  it("attaches a bill once it has uploaded", async () => {
    jest.spyOn(spendingsApi, "get").mockResolvedValue(saved);
    const attach = jest.spyOn(spendingsApi, "attachBill").mockResolvedValue({ ...saved, hasBill: true });
    mockBill = slot({ status: "ready", key: "bills/xyz", previewUri: "file://bill.jpg" });
    const view = await renderSpending();

    await waitFor(() => expect(view.getByText("Save this bill")).toBeTruthy());
    await fireEvent.press(view.getByText("Save this bill"));
    await waitFor(() => expect(attach).toHaveBeenCalledWith(7, "bills/xyz"));
  });
});

describe("voiding", () => {
  it("needs a reason, then voids with it", async () => {
    jest.spyOn(spendingsApi, "get").mockResolvedValue(saved);
    const voidIt = jest.spyOn(spendingsApi, "void").mockResolvedValue(undefined);
    const view = await render(
      <SpendingVoidScreen navigation={nav as never} route={{ key: "k", name: "SpendingVoid", params: { spendingId: 7 } } as never} />,
      { wrapper: withQueryClient(client) }
    );

    await waitFor(() => expect(view.getAllByText("Void this spending").length).toBeGreaterThan(0));
    await fireEvent.press(view.getByText("Void this spending"));
    expect(view.getByText("Pick a reason — it goes on the record.")).toBeTruthy();

    await fireEvent.press(view.getByText("Wrong amount"));
    await fireEvent.press(view.getByText("Void this spending"));
    await waitFor(() => expect(voidIt).toHaveBeenCalledWith(7, { reason: "WRONG_AMOUNT" }));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
