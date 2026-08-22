/**
 * Guards bug B7 — the Home screen reloading forever.
 *
 * `useFocusEffect` re-subscribes whenever its callback's identity changes. The first version
 * of this hook listed `refetch` in its `useCallback` deps, so a caller passing an inline
 * arrow (as HomeScreen does, because it refetches two queries) produced:
 *
 *   new function → new effect → refetch → state change → re-render → new function → …
 *
 * The mock below reproduces that re-subscribe-on-identity-change behaviour faithfully, which
 * is what makes these tests meaningful.
 */

import { render } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { useRefreshOnFocus } from "../useRefreshOnFocus";

jest.mock("@react-navigation/native", () => {
  const react = require("react");
  return {
    useFocusEffect: (callback: () => void) => {
      // Expose the latest callback so a test can simulate a *later* focus.
      (global as Record<string, unknown>).__focusCallback = callback;
      react.useEffect(callback, [callback]);
    }
  };
});

const refocus = () => (global as unknown as { __focusCallback: () => void }).__focusCallback();

afterEach(() => {
  delete (global as Record<string, unknown>).__focusCallback;
});

describe("useRefreshOnFocus", () => {
  it("does not refetch on the first focus — mount already fetched", async () => {
    const refetch = jest.fn();
    function Probe() {
      useRefreshOnFocus(refetch);
      return null;
    }
    await render(<Probe />);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches on a later focus", async () => {
    const refetch = jest.fn();
    function Probe() {
      useRefreshOnFocus(refetch);
      return null;
    }
    await render(<Probe />);
    refocus();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the caller passes a new function every render", async () => {
    // Exactly HomeScreen's shape: an inline arrow that triggers a state change.
    let renders = 0;
    function Probe() {
      renders += 1;
      const [, setCount] = useState(0);
      useRefreshOnFocus(() => setCount((n) => n + 1));
      return <Text>{renders}</Text>;
    }

    await render(<Probe />);

    // With the dependency bug this never settles — React aborts with "Too many re-renders",
    // or the suite hangs. A couple of renders is the healthy range.
    expect(renders).toBeLessThan(5);
  });

  it("still uses the newest callback after a re-render", async () => {
    const first = jest.fn();
    const second = jest.fn();

    function Probe({ onFocus }: { onFocus: () => void }) {
      useRefreshOnFocus(onFocus);
      return null;
    }

    const { rerender } = await render(<Probe onFocus={first} />);
    await rerender(<Probe onFocus={second} />);
    refocus();

    // Holding the callback in a ref must not mean holding a *stale* one.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
