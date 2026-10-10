/**
 * The general fund (v2 Phase 2): its Spendings tab, the opening balance, and the lines that
 * explain why the balance is more than collected − spent.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { fundApi, type FundSummary, type Paged, type Spending } from "../../../api";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { todayIso } from "../../../utils/format";
import { FundScreen } from "../FundScreen";
import { OpeningBalanceScreen } from "../OpeningBalanceScreen";

jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate })
}));

function page<T>(content: T[]): Paged<T> {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
}

const empty: FundSummary = {
  fund: "GENERAL",
  openingBalance: null,
  collected: 5000,
  movedIn: 0,
  movedInLines: [],
  spent: 0,
  eventSupport: 0,
  balance: 5000,
  receiptCount: 1
};

const support: Spending = {
  id: 4,
  title: "Police & BMC permissions",
  vendor: null,
  amount: 3000,
  paymentMode: "BANK",
  spentOn: "2026-10-09",
  paidFrom: "GENERAL",
  event: { id: 1, name: "Ganeshotsav 2026" },
  hasBill: true,
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
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  mockNavigate.mockReset();
  Object.values(nav).forEach((fn) => fn.mockReset());
});

describe("the Fund tab", () => {
  it("asks for the opening balance until one is entered", async () => {
    jest.spyOn(fundApi, "summary").mockResolvedValue(empty);
    jest.spyOn(fundApi, "spendings").mockResolvedValue(page([]));
    jest.spyOn(fundApi, "income").mockResolvedValue(page([]));
    const view = await render(<FundScreen />, { wrapper: withQueryClient(client) });

    await waitFor(() => expect(view.getByText("Enter the opening balance")).toBeTruthy());
    await fireEvent.press(view.getByText("Enter the opening balance"));
    expect(mockNavigate).toHaveBeenCalledWith("OpeningBalance");
  });

  it("explains the balance and tags event support with its event", async () => {
    jest.spyOn(fundApi, "summary").mockResolvedValue({
      ...empty,
      openingBalance: { id: 1, amount: 300000, asOn: "2026-04-01", note: null, enteredByName: "Rajendra Kadam", enteredAt: "2026-10-01T05:00:00Z" },
      movedIn: 27000,
      movedInLines: [{ eventId: 1, eventName: "Ganeshotsav 2026", amount: 27000 }],
      spent: 3000,
      eventSupport: 3000,
      balance: 329000
    });
    jest.spyOn(fundApi, "spendings").mockResolvedValue(page([support]));
    jest.spyOn(fundApi, "income").mockResolvedValue(page([]));
    const view = await render(<FundScreen />, { wrapper: withQueryClient(client) });

    await waitFor(() => expect(view.getByText("₹3,29,000")).toBeTruthy());
    expect(view.getByText(/Includes opening balance ₹3,00,000 .* and ₹27,000 moved in from events\./)).toBeTruthy();
    expect(view.getByText("₹3,000 of general fund spending went to support events.")).toBeTruthy();
    expect(view.getByText("From Ganeshotsav 2026")).toBeTruthy();
    expect(view.queryByText("Enter the opening balance")).toBeNull();

    await waitFor(() => expect(view.getByText("Police & BMC permissions")).toBeTruthy());
    expect(view.getByText("For Ganeshotsav 2026")).toBeTruthy();
    expect(view.getByText("Bill attached")).toBeTruthy();

    await fireEvent.press(view.getByText("Add spending"));
    expect(mockNavigate).toHaveBeenCalledWith("SpendingForm");
  });
});

describe("the opening balance", () => {
  function renderOpening() {
    return render(
      <OpeningBalanceScreen navigation={nav as never} route={{ key: "k", name: "OpeningBalance" } as never} />,
      { wrapper: withQueryClient(client) }
    );
  }

  it("is entered once, as on a date — today unless changed", async () => {
    jest.spyOn(fundApi, "summary").mockResolvedValue(empty);
    const set = jest.spyOn(fundApi, "setOpeningBalance").mockResolvedValue({
      id: 1, amount: 300000, asOn: todayIso(), note: null, enteredByName: null, enteredAt: "2026-10-10T05:00:00Z"
    });
    const view = await renderOpening();

    await waitFor(() => expect(view.getByText("Save opening balance")).toBeTruthy());
    await fireEvent.changeText(view.getByPlaceholderText("0"), "300000");
    await fireEvent.press(view.getByText("Save opening balance"));

    await waitFor(() => expect(set).toHaveBeenCalledWith({ amount: 300000, asOn: todayIso() }));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("is fixed by voiding with a reason, never edited", async () => {
    jest.spyOn(fundApi, "summary").mockResolvedValue({
      ...empty,
      openingBalance: { id: 1, amount: 300000, asOn: "2026-04-01", note: "Bank balance", enteredByName: "Rajendra Kadam", enteredAt: "2026-10-01T05:00:00Z" }
    });
    const voidIt = jest.spyOn(fundApi, "voidOpeningBalance").mockResolvedValue(undefined);
    const view = await renderOpening();

    await waitFor(() => expect(view.getByText("₹3,00,000")).toBeTruthy());
    expect(view.queryByText("Save opening balance")).toBeNull();
    await fireEvent.press(view.getByText("Void opening balance"));
    expect(view.getByText("Say why it is being voided — it goes on the record.")).toBeTruthy();
    expect(voidIt).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText("Used the wrong statement"), "Typed one zero too many");
    await fireEvent.press(view.getByText("Void opening balance"));
    await waitFor(() => expect(voidIt).toHaveBeenCalledWith("Typed one zero too many"));
  });
});
