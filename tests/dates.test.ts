import assert from "node:assert/strict";
import test from "node:test";
import { dateRange, todayInJakarta } from "../lib/dates";
import { dashboardSchema } from "../lib/dashboard";
import { demoDashboard } from "../lib/demo";

test("Jakarta day changes at 17:00 UTC", () => {
  assert.equal(todayInJakarta(new Date("2026-11-17T16:59:59Z")), "2026-11-17");
  assert.equal(todayInJakarta(new Date("2026-11-17T17:00:00Z")), "2026-11-18");
});

test("date filters handle weeks, leap days and invalid ranges", () => {
  assert.deepEqual(dateRange({ period: "week" }, "2026-11-22"), {
    from: "2026-11-16",
    to: "2026-11-22",
    period: "week",
  });
  assert.equal(
    dateRange({ period: "last-month" }, "2024-03-04").to,
    "2024-02-29",
  );
  assert.equal(dateRange({}, "2024-02-22").to, "2024-02-29");
  assert.equal(
    dateRange(
      { period: "custom", from: "2026-02-31", to: "2026-03-05" },
      "2026-03-04",
    ).period,
    "month",
  );
  assert.equal(
    dateRange(
      { period: "custom", from: "2025-01-01", to: "2026-03-05" },
      "2026-03-04",
    ).period,
    "month",
  );
});

test("demo and database share a validated dashboard contract", () => {
  const today = "2026-11-18";
  const demo = dashboardSchema.parse(
    demoDashboard(dateRange({}, today), today),
  );
  assert.equal(demo.money?.outstanding, 3500000);
  assert.equal(demo.upcoming.length, 5);
  assert.equal(demo.trend[5].month, "2026-11-01");
});
