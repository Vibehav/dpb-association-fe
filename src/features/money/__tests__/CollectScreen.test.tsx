/**
 * The collection form — the app's job number one.
 *
 * What matters most here is the money rules the server enforces, so the screen asks before it
 * is told: a short fee amount is confirmed as a part payment before it is sent, an amount
 * above what is due is caught on the phone, and if the server still answers
 * `part_payment_unconfirmed` (someone else took a part meanwhile) the same question is asked
 * in the server's words. A donor can never be charged the annual fee.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  ApiError,
  contributionsApi,
  donorsApi,
  shopsApi,
  type DonorProfile,
  type Receipt,
  type ShopDetail
} from "../../../api";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { CollectScreen } from "../CollectScreen";

jest.mock("../../../auth/useMe", () => ({ useMe: () => ({ data: { id: 9, name: "Nitin More", role: "COLLECTOR" } }) }));

const owner = { linkId: 11, personId: 1, name: "Ramesh Kadam", phone: "9820020001", role: "OWNER" as const };

const shop: ShopDetail = {
  id: 101,
  shopNumber: "A-12",
  businessName: "Kadam Phool Bhandar",
  lane: "Lane 2",
  tenancy: "OWNER_RUN",
  formerHolderName: null,
  formerHolderTill: null,
  people: [owner],
  fee: {
    feeCycleId: 7, yearLabel: "2026-27", status: "PENDING", amount: 5000, paid: 0, due: 5000,
    meetingNote: null, collectable: true, receipts: []
  },
  earlierYears: [],
  feeOutstanding: { total: 5000, byYear: [{ feeCycleId: 7, yearLabel: "2026-27", due: 5000 }] }
};

const receipt = { id: 55 } as Receipt;

let client: QueryClient;
const replace = jest.fn();
const nav = { navigate: jest.fn(), replace, goBack: jest.fn(), setOptions: jest.fn() } as never;

beforeEach(() => {
  client = testQueryClient();
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  replace.mockReset();
});

async function renderFromShop() {
  jest.spyOn(shopsApi, "detail").mockResolvedValue(shop);
  const view = await render(
    <CollectScreen
      navigation={nav}
      route={{ key: "k", name: "Collect", params: { shopId: 101, purpose: "ANNUAL_FEE" } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  // The payer resolves to the shop's licence holder and the amount to what is due.
  await waitFor(() => expect(view.getByText("Ramesh Kadam")).toBeTruthy());
  await waitFor(() => expect(view.getByDisplayValue("5000")).toBeTruthy());
  return view;
}

describe("collecting the fee from a shop", () => {
  it("charges the licence holder, defaults to what is due, and sends it in full without asking", async () => {
    const create = jest.spyOn(contributionsApi, "create").mockResolvedValue(receipt);
    const view = await renderFromShop();

    expect(view.getByText("₹5,000 due for 2026-27")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Save & generate receipt"));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toEqual({
      purpose: "ANNUAL_FEE",
      amount: 5000,
      paymentMode: "CASH",
      personId: 1,
      shopId: 101
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("Receipt", { contributionId: 55 }));
  });

  it("asks before recording a part payment, then sends it confirmed", async () => {
    const create = jest.spyOn(contributionsApi, "create").mockResolvedValue(receipt);
    const view = await renderFromShop();

    await fireEvent.changeText(view.getByDisplayValue("5000"), "2000");
    await fireEvent.press(view.getByLabelText("Save & generate receipt"));

    await waitFor(() =>
      expect(view.getByText("₹3,000 will remain due for 2026-27. Record this as a part payment?")).toBeTruthy()
    );
    expect(create).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText("Record part payment"));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ amount: 2000, shopId: 101, confirmPartPayment: true });
  });

  it("catches an amount above what is due on the phone, and sends nothing", async () => {
    const create = jest.spyOn(contributionsApi, "create");
    const view = await renderFromShop();

    await fireEvent.changeText(view.getByDisplayValue("5000"), "6000");
    await fireEvent.press(view.getByLabelText("Save & generate receipt"));

    await waitFor(() => expect(view.getByText("Only ₹5,000 is due for 2026-27.")).toBeTruthy());
    expect(create).not.toHaveBeenCalled();
  });

  it("asks in the server's words when the server says the amount is now short", async () => {
    const create = jest
      .spyOn(contributionsApi, "create")
      .mockRejectedValueOnce(
        new ApiError(409, "part_payment_unconfirmed", "₹2,000 will remain due for 2026-27 — confirm to record this as a part payment")
      )
      .mockResolvedValueOnce(receipt);
    const view = await renderFromShop();

    await fireEvent.press(view.getByLabelText("Save & generate receipt"));
    await waitFor(() =>
      expect(view.getByText("₹2,000 will remain due for 2026-27 — confirm to record this as a part payment")).toBeTruthy()
    );

    await fireEvent.press(view.getByLabelText("Record part payment"));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][0]).toMatchObject({ confirmPartPayment: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("Receipt", { contributionId: 55 }));
  });
});

describe("collecting from an outside donor", () => {
  const donor: DonorProfile = {
    id: 3, name: "RATNADEEP TRADERS", phone: null, whatsappPhone: null, organisation: "Sponsor",
    address: null, addedByName: null, addedOn: "2026-10-03T10:00:00Z", lifetimeTotal: 0,
    hasCancelled: false, contributionHistory: []
  };

  it("offers no annual fee, and sends a one-off against the donor", async () => {
    jest.spyOn(donorsApi, "detail").mockResolvedValue(donor);
    const create = jest.spyOn(contributionsApi, "create").mockResolvedValue(receipt);
    const view = await render(
      <CollectScreen navigation={nav} route={{ key: "k", name: "Collect", params: { donorId: 3 } } as never} />,
      { wrapper: withQueryClient(client) }
    );
    await waitFor(() => expect(view.getByText("RATNADEEP TRADERS")).toBeTruthy());

    expect(view.getByText(/A donor can give a one-off/)).toBeTruthy();

    await fireEvent.press(view.getByText("₹2,100"));
    await fireEvent.press(view.getByLabelText("Save & generate receipt"));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toEqual({ purpose: "ONE_OFF", amount: 2100, paymentMode: "CASH", donorId: 3 });
  });
});
