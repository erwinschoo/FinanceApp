import { describe, it, expect } from "vitest";
import { runningTotal } from "./aggregations";

describe("runningTotal", () => {
  it("geeft een lege array terug voor een lege invoer", () => {
    expect(runningTotal([])).toEqual([]);
  });

  it("laat een enkel element ongemoeid", () => {
    expect(runningTotal([42])).toEqual([42]);
  });

  it("telt oplopend op", () => {
    expect(runningTotal([10, 20, 5])).toEqual([10, 30, 35]);
  });

  it("werkt met negatieve waarden", () => {
    expect(runningTotal([100, -30, -20, 10])).toEqual([100, 70, 50, 60]);
  });

  it("muteert de invoer niet", () => {
    const input = [1, 2, 3];
    runningTotal(input);
    expect(input).toEqual([1, 2, 3]);
  });
});
