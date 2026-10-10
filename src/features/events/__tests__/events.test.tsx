/**
 * Events (v2 Phase 2): the tab, an event's page and the create/edit form.
 *
 * What matters is that the screens show what the server sends for the role — an admin's
 * In / Out / Balance, anyone else's collected figure, never a withheld null as ₹0 — and that
 * closing an event asks the one question the server needs answered: move what is left to the
 * general fund, or keep it.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { eventsApi, type EventDetail, type EventListItem, type FundIncomeRow, type Paged } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { todayIso } from "../../../utils/format";
import { EventFormScreen } from "../EventFormScreen";
import { EventScreen } from "../EventScreen";
import { EventsListScreen } from "../EventsListScreen";

jest.mock("../../../auth/usePermissions");
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

function page<T>(content: T[]): Paged<T> {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
}

const ganesh: EventDetail = {
  id: 1,
  name: "Ganeshotsav 2026",
  startsOn: "2026-10-08",
  endsOn: "2026-10-18",
  ownFund: true,
  status: "ACTIVE",
  closedAt: null,
  closedByName: null,
  balanceMovedAt: null,
  showOutgoing: true,
  collected: 55000,
  spentFromEventFund: 8300,
  spentFromGeneral: 3000,
  totalSpent: 11300,
  movedOut: 0,
  balance: 46700,
  hasEntries: true,
  transfers: []
};

const donation: FundIncomeRow = {
  id: 9,
  receiptNo: "DPB/2026-27/0001",
  payerType: "DONOR",
  payerId: 3,
  payerName: "RATNADEEP TRADERS",
  payerSubtitle: null,
  purposeLabel: "Ganeshotsav 2026 donation",
  amount: 30000,
  paymentMode: "CHEQUE",
  collectedAt: "2026-10-10T07:21:00Z",
  collectedByName: "Nitin More",
  cancelled: false
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
  Object.values(nav).forEach((fn) => fn.mockReset());
  mockNavigate.mockReset();
});

function renderEvent(eventId = 1) {
  return render(
    <EventScreen navigation={nav as never} route={{ key: "k", name: "Event", params: { eventId } } as never} />,
    { wrapper: withQueryClient(client) }
  );
}

// ---- the Events tab ------------------------------------------------------------

describe("the Events tab", () => {
  const listed: EventListItem = {
    id: 1, name: "Ganeshotsav 2026", startsOn: "2026-10-08", endsOn: "2026-10-18", ownFund: true,
    status: "CLOSED", balanceMoved: true, collected: 55000, totalSpent: 11300, spentFromGeneral: 3000,
    balance: 0, movedOut: 46700
  };

  it("shows an admin In / Out / Balance, and what was carried to the general fund", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "list").mockResolvedValue(page([listed]));
    const view = await render(<EventsListScreen />, { wrapper: withQueryClient(client) });

    await waitFor(() => expect(view.getByText("Ganeshotsav 2026")).toBeTruthy());
    expect(view.getByText("In")).toBeTruthy();
    expect(view.getByText("₹55,000")).toBeTruthy();
    expect(view.getByText("₹11,300")).toBeTruthy();
    expect(view.getByText(/₹46,700 carried to general fund/)).toBeTruthy();
    expect(view.getByText("Closed")).toBeTruthy();
    expect(view.getByText("Create event")).toBeTruthy();
  });

  it("shows anyone else what was collected only — never a withheld figure as ₹0", async () => {
    asRole("COLLECTOR");
    jest.spyOn(eventsApi, "list").mockResolvedValue(
      page([{ ...listed, status: "ACTIVE", balanceMoved: false, totalSpent: null, spentFromGeneral: null, balance: null, movedOut: null }])
    );
    const view = await render(<EventsListScreen />, { wrapper: withQueryClient(client) });

    await waitFor(() => expect(view.getByText("Collected")).toBeTruthy());
    expect(view.getByText("₹55,000")).toBeTruthy();
    expect(view.queryByText("Balance")).toBeNull();
    expect(view.queryByText("₹0")).toBeNull();
    expect(view.queryByText("Create event")).toBeNull();
  });

  it("shows a general-funded event as what the general fund spent on it", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "list").mockResolvedValue(
      page([{ ...listed, id: 2, name: "Diwali lighting", ownFund: false, status: "OPEN", balanceMoved: false,
        collected: null, totalSpent: 12000, spentFromGeneral: 12000, balance: null, movedOut: null }])
    );
    const view = await render(<EventsListScreen />, { wrapper: withQueryClient(client) });

    await waitFor(() => expect(view.getByText("Spent from general fund")).toBeTruthy());
    expect(view.getByText("₹12,000")).toBeTruthy();
    expect(view.queryByText("Balance")).toBeNull();
  });
});

// ---- an event's page -------------------------------------------------------------

describe("an event's page", () => {
  it("gives an admin the figures, the support note and both tabs", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue(ganesh);
    const spendings = jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("Remaining")).toBeTruthy());
    expect(view.getByText("₹46,700")).toBeTruthy();
    expect(view.getByText(/₹3,000 of this was paid directly from the general fund/)).toBeTruthy();
    expect(view.getByText("Spendings")).toBeTruthy();
    expect(view.getByText("Income")).toBeTruthy();
    expect(view.getByText("Add spending")).toBeTruthy();
    expect(spendings).toHaveBeenCalled();
  });

  it("gives a collector the collected figure and the income list — and never asks for spending", async () => {
    asRole("COLLECTOR");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({
      ...ganesh, showOutgoing: false, spentFromEventFund: null, spentFromGeneral: null, totalSpent: null,
      movedOut: null, balance: null, hasEntries: null
    });
    const spendings = jest.spyOn(eventsApi, "spendings");
    jest.spyOn(eventsApi, "income").mockResolvedValue(page([donation]));
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("RATNADEEP TRADERS")).toBeTruthy());
    expect(view.getByText("Collected for this event")).toBeTruthy();
    expect(view.getByText("Spendings are visible to the treasurer only.")).toBeTruthy();
    expect(view.queryByText("Remaining")).toBeNull();
    expect(view.queryByText("Close this event")).toBeNull();
    expect(spendings).not.toHaveBeenCalled();
  });

  it("asks whether to move or keep what is left, and sends that choice", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue(ganesh);
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const close = jest.spyOn(eventsApi, "close").mockResolvedValue({ ...ganesh, status: "CLOSED" });
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("Close this event")).toBeTruthy());
    await fireEvent.press(view.getByText("Close this event"));
    expect(view.getByText(/₹46,700 is left in the Ganeshotsav 2026 fund/)).toBeTruthy();
    await fireEvent.press(view.getByText("Keep in event fund"));
    await fireEvent.press(view.getByText("Close event"));

    await waitFor(() => expect(close).toHaveBeenCalledWith(1, false));
  });

  it("closes a general-funded event with nothing to choose", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({
      ...ganesh, id: 2, name: "Diwali lighting", ownFund: false, collected: null, spentFromEventFund: null,
      spentFromGeneral: 12000, totalSpent: 12000, movedOut: null, balance: null
    });
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const close = jest.spyOn(eventsApi, "close").mockResolvedValue({ ...ganesh, status: "CLOSED" });
    const view = await renderEvent(2);

    await waitFor(() => expect(view.getByText("Close this event")).toBeTruthy());
    expect(view.queryByText("Income")).toBeNull();
    await fireEvent.press(view.getByText("Close this event"));
    await fireEvent.press(view.getByText("Close event"));

    await waitFor(() => expect(close).toHaveBeenCalledWith(2, undefined));
  });

  it("shows the server's refusal when the event is short", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({ ...ganesh, balance: 0 });
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const { ApiError } = jest.requireActual("../../../api");
    jest.spyOn(eventsApi, "close").mockRejectedValue(
      new ApiError(409, "event_balance_negative", "Ganeshotsav 2026 is short by ₹10,000 — record that much of its spending as paid from the general fund before closing")
    );
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("Close this event")).toBeTruthy());
    await fireEvent.press(view.getByText("Close this event"));
    await fireEvent.press(view.getByText("Close event"));

    await waitFor(() => expect(view.getByText(/is short by ₹10,000/)).toBeTruthy());
  });

  it("lists what was moved to the general fund, adjustments included, with their signs", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({
      ...ganesh, status: "CLOSED", closedAt: "2026-10-19T06:00:00Z", closedByName: "Rajendra Kadam",
      balanceMovedAt: "2026-10-19T06:00:00Z", movedOut: 21700, balance: 0,
      transfers: [
        { id: 1, kind: "MOVE", amount: 46700, description: "Balance moved to the general fund", at: "2026-10-19T06:00:00Z", byName: "Rajendra Kadam" },
        { id: 2, kind: "ADJUSTMENT", amount: -25000, description: "Receipt DPB/2026-27/0002 cancelled after close", at: "2026-10-21T06:00:00Z", byName: "Rajendra Kadam" }
      ]
    });
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText(/Carried to the general fund · ₹21,700/)).toBeTruthy());
    expect(view.getByText("Receipt DPB/2026-27/0002 cancelled after close")).toBeTruthy();
    expect(view.getByText("-₹25,000")).toBeTruthy();
    expect(view.getByText("This event is closed · nothing further can be added.")).toBeTruthy();
    expect(view.queryByText("Add spending")).toBeNull();
    expect(view.queryByText("Close this event")).toBeNull();
  });

  it("offers to move a kept balance later", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({
      ...ganesh, status: "CLOSED", closedAt: "2026-10-19T06:00:00Z", balance: 7000
    });
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const move = jest.spyOn(eventsApi, "moveBalance").mockResolvedValue(ganesh);
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("₹7,000 is kept in the event fund.")).toBeTruthy());
    await fireEvent.press(view.getByText("Move ₹7,000 to the general fund"));
    await fireEvent.press(view.getByText("Move it"));
    await waitFor(() => expect(move).toHaveBeenCalledWith(1));
  });

  it("offers delete only for an event nothing was recorded against", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue({ ...ganesh, collected: 0, totalSpent: 0, balance: 0, hasEntries: false });
    jest.spyOn(eventsApi, "spendings").mockResolvedValue(page([]));
    const remove = jest.spyOn(eventsApi, "remove").mockResolvedValue(undefined);
    const view = await renderEvent();

    await waitFor(() => expect(view.getByText("Delete event")).toBeTruthy());
    await fireEvent.press(view.getByText("Delete event"));
    await fireEvent.press(view.getByText("Delete it"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
    expect(nav.goBack).toHaveBeenCalled();
  });
});

// ---- create / edit --------------------------------------------------------------

describe("the event form", () => {
  it("creates an own-fund event starting today, and opens it", async () => {
    asRole("ADMIN");
    const create = jest.spyOn(eventsApi, "create").mockResolvedValue({ ...ganesh, id: 5 });
    const view = await render(
      <EventFormScreen navigation={nav as never} route={{ key: "k", name: "EventForm", params: undefined } as never} />,
      { wrapper: withQueryClient(client) }
    );

    await fireEvent.press(view.getByText("Create event"));
    expect(view.getByText("Enter the event name.")).toBeTruthy();
    expect(create).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText("Ganeshotsav 2026"), "Navratri 2026");
    await fireEvent.press(view.getByText("Create event"));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ name: "Navratri 2026", startsOn: todayIso(), ownFund: true })
    );
    expect(nav.replace).toHaveBeenCalledWith("Event", { eventId: 5 });
  });

  it("creates a general-funded event when asked", async () => {
    asRole("ADMIN");
    const create = jest.spyOn(eventsApi, "create").mockResolvedValue({ ...ganesh, id: 6 });
    const view = await render(
      <EventFormScreen navigation={nav as never} route={{ key: "k", name: "EventForm", params: undefined } as never} />,
      { wrapper: withQueryClient(client) }
    );

    await fireEvent.changeText(view.getByPlaceholderText("Ganeshotsav 2026"), "Diwali lighting");
    await fireEvent.press(view.getByText("Spend from general fund"));
    expect(view.getByText(/every spending for this event is paid out of the general fund/)).toBeTruthy();
    await fireEvent.press(view.getByText("Create event"));

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ ownFund: false })));
  });

  it("locks the type of an event that already has entries", async () => {
    asRole("ADMIN");
    jest.spyOn(eventsApi, "detail").mockResolvedValue(ganesh);
    const update = jest.spyOn(eventsApi, "update").mockResolvedValue(ganesh);
    const view = await render(
      <EventFormScreen navigation={nav as never} route={{ key: "k", name: "EventForm", params: { eventId: 1 } } as never} />,
      { wrapper: withQueryClient(client) }
    );

    await waitFor(() => expect(view.getByDisplayValue("Ganeshotsav 2026")).toBeTruthy());
    expect(view.getByText(/its type can't change/)).toBeTruthy();
    await fireEvent.press(view.getByText("Spend from general fund"));
    await fireEvent.press(view.getByText("Save changes"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(1, {
        name: "Ganeshotsav 2026", startsOn: "2026-10-08", endsOn: "2026-10-18", ownFund: true
      })
    );
    expect(nav.goBack).toHaveBeenCalled();
  });
});
