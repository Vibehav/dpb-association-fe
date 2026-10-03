/**
 * The lists' filters live behind one button now. What has to hold: nothing reaches the list
 * until Apply, only filters actually in force show under the search box (each removable),
 * and a half-made choice survives the list re-rendering behind the open sheet.
 */

import { fireEvent, render } from "@testing-library/react-native";
import { SearchWithFilters, type FilterSection, type FilterValues } from "../SearchWithFilters";

const sections: FilterSection[] = [
  {
    key: "fee",
    title: "Fee this year",
    anyLabel: "Any",
    options: [
      { value: "PENDING", label: "Due" },
      { value: "PAID", label: "Fee paid" }
    ]
  },
  { key: "lane", title: "Lane", anyLabel: "All lanes", options: [{ value: "LANE 2", label: "LANE 2" }] }
];

async function renderFilters(values: FilterValues, onChangeValues = jest.fn()) {
  const view = await render(
    <SearchWithFilters
      term=""
      onChangeTerm={jest.fn()}
      placeholder="Search"
      sections={sections}
      values={values}
      onChangeValues={onChangeValues}
    />
  );
  return { view, onChangeValues };
}

describe("SearchWithFilters", () => {
  it("shows nothing under the search box while no filter is set", async () => {
    const { view } = await renderFilters({ fee: null, lane: null });
    expect(view.getByLabelText("Filter")).toBeTruthy();
    expect(view.queryByText(/✕/)).toBeNull();
  });

  it("shows each filter in force, removable with one tap", async () => {
    const { view, onChangeValues } = await renderFilters({ fee: "PENDING", lane: "LANE 2" });
    expect(view.getByLabelText("Filter, 2 active")).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Remove filter Due"));
    expect(onChangeValues).toHaveBeenCalledWith({ fee: null, lane: "LANE 2" });
  });

  it("changes nothing until Apply — then sends every choice at once", async () => {
    const { view, onChangeValues } = await renderFilters({ fee: null, lane: null });

    await fireEvent.press(view.getByLabelText("Filter"));
    await fireEvent.press(view.getByText("Due"));
    await fireEvent.press(view.getByText("LANE 2"));
    expect(onChangeValues).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText("Apply"));
    expect(onChangeValues).toHaveBeenCalledWith({ fee: "PENDING", lane: "LANE 2" });
  });

  it("clears every section with Clear all", async () => {
    const { view, onChangeValues } = await renderFilters({ fee: "PAID", lane: "LANE 2" });

    await fireEvent.press(view.getByLabelText("Filter, 2 active"));
    await fireEvent.press(view.getByLabelText("Clear all"));
    await fireEvent.press(view.getByLabelText("Apply"));
    expect(onChangeValues).toHaveBeenCalledWith({ fee: null, lane: null });
  });

  it("keeps a half-made choice when the list re-renders behind the open sheet", async () => {
    const onChangeValues = jest.fn();
    const props = { term: "", onChangeTerm: jest.fn(), placeholder: "Search", sections, onChangeValues };
    const view = await render(<SearchWithFilters {...props} values={{ fee: null, lane: null }} />);

    await fireEvent.press(view.getByLabelText("Filter"));
    await fireEvent.press(view.getByText("Due"));
    // The screens build `values` afresh every render — e.g. when a list refetch lands.
    await view.rerender(<SearchWithFilters {...props} values={{ fee: null, lane: null }} />);

    await fireEvent.press(view.getByLabelText("Apply"));
    expect(onChangeValues).toHaveBeenCalledWith({ fee: "PENDING", lane: null });
  });
});
