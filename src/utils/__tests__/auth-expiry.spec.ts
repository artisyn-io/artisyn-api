import { isTokenExpired } from "../src/utils/helpers";

describe("Token expiry checks", () => {
  it("should return true for missing expiry", () => {
    expect(isTokenExpired(undefined)).toBe(true);
    expect(isTokenExpired(null)).toBe(true);
  });

  it("should return true for invalid expiry string", () => {
    expect(isTokenExpired("not-a-date")).toBe(true);
  });

  it("should return true for past expiry date", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTokenExpired(past)).toBe(true);
  });

  it("should return false for future expiry date", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });
});
