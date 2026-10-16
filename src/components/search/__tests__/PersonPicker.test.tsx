/**
 * Search first (spec §7.3): a person is added only when a search finds nobody — and only where
 * the screen offers it.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { peopleApi } from "../../../api";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { PersonPicker } from "../PersonPicker";

let client: QueryClient;
beforeEach(() => {
  client = testQueryClient();
  jest.spyOn(peopleApi, "list").mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
});
afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

it("offers to add the person when nobody matches", async () => {
  const onNotFound = jest.fn();
  const view = await render(<PersonPicker onPick={jest.fn()} onNotFound={onNotFound} />, { wrapper: withQueryClient(client) });

  await fireEvent.changeText(view.getByPlaceholderText("Search existing members"), "Marshal");
  await waitFor(() => expect(view.getByText("Add “MARSHAL” as a new person")).toBeTruthy());
  await fireEvent.press(view.getByText("Add “MARSHAL” as a new person"));
  expect(onNotFound).toHaveBeenCalledWith("MARSHAL");
});

it("offers nothing to add where the screen doesn't ask for it", async () => {
  const view = await render(<PersonPicker onPick={jest.fn()} />, { wrapper: withQueryClient(client) });

  await fireEvent.changeText(view.getByPlaceholderText("Search existing members"), "Marshal");
  await waitFor(() => expect(view.getByText("No one on record matches “MARSHAL”.")).toBeTruthy());
  expect(view.queryByText(/as a new person/)).toBeNull();
});
