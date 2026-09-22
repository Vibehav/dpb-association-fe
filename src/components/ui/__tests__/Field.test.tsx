/**
 * The `uppercase` prop must transform, not merely hint.
 *
 * `autoCapitalize="characters"` only asks the keyboard to open in caps — a lowercase
 * keystroke, a paste or an autofill all bypass it, and nothing server-side enforces case.
 * These cover exactly those bypass routes, because they are why the prop exists.
 */

import { fireEvent, render } from "@testing-library/react-native";
import { Field } from "../Field";

describe("Field uppercase", () => {
  it("reports capitals even when the keystroke is lowercase", async () => {
    const seen: string[] = [];
    const { getByPlaceholderText } = await render(
      <Field placeholder="name" value="" onChangeText={(t) => seen.push(t)} uppercase />
    );
    fireEvent.changeText(getByPlaceholderText("name"), "vinod kumar");
    expect(seen).toEqual(["VINOD KUMAR"]);
  });

  it("capitalises a pasted mixed-case value, which autoCapitalize alone would miss", async () => {
    const seen: string[] = [];
    const { getByPlaceholderText } = await render(
      <Field placeholder="shop" value="" onChangeText={(t) => seen.push(t)} uppercase />
    );
    fireEvent.changeText(getByPlaceholderText("shop"), "Shree Ganesh Flowers");
    expect(seen).toEqual(["SHREE GANESH FLOWERS"]);
  });

  it("renders a mixed-case prefilled value as capitals", async () => {
    const { getByPlaceholderText } = await render(
      <Field placeholder="name" value="Vinod Kumar" onChangeText={() => {}} uppercase />
    );
    expect(getByPlaceholderText("name").props.value).toBe("VINOD KUMAR");
  });

  it("still sets the keyboard hint alongside the transform", async () => {
    const { getByPlaceholderText } = await render(
      <Field placeholder="name" value="" onChangeText={() => {}} uppercase />
    );
    expect(getByPlaceholderText("name").props.autoCapitalize).toBe("characters");
  });

  it("leaves a field without the prop — email — completely untouched", async () => {
    const seen: string[] = [];
    const { getByPlaceholderText } = await render(
      <Field placeholder="email" value="" onChangeText={(t) => seen.push(t)} autoCapitalize="none" />
    );
    fireEvent.changeText(getByPlaceholderText("email"), "meera@example.com");
    expect(seen).toEqual(["meera@example.com"]);
    expect(getByPlaceholderText("email").props.autoCapitalize).toBe("none");
  });
});
