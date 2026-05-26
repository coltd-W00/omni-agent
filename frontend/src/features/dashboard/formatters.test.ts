import { describe, it, expect } from "vitest";
import {
  formatDashboardGreeting,
  formatDashboardDate,
  agentLabel,
} from "./formatters";

describe("formatters", () => {
  describe("formatDashboardGreeting", () => {
    it("should return Good morning for hours 5 to 11", () => {
      expect(formatDashboardGreeting(new Date("2026-05-26T05:00:00"))).toBe("Good morning");
      expect(formatDashboardGreeting(new Date("2026-05-26T11:59:59"))).toBe("Good morning");
    });

    it("should return Good afternoon for hours 12 to 17", () => {
      expect(formatDashboardGreeting(new Date("2026-05-26T12:00:00"))).toBe("Good afternoon");
      expect(formatDashboardGreeting(new Date("2026-05-26T17:59:59"))).toBe("Good afternoon");
    });

    it("should return Good evening for hours 18 to 4", () => {
      expect(formatDashboardGreeting(new Date("2026-05-26T18:00:00"))).toBe("Good evening");
      expect(formatDashboardGreeting(new Date("2026-05-26T23:59:59"))).toBe("Good evening");
      expect(formatDashboardGreeting(new Date("2026-05-26T00:00:00"))).toBe("Good evening");
      expect(formatDashboardGreeting(new Date("2026-05-26T04:59:59"))).toBe("Good evening");
    });
  });

  describe("formatDashboardDate", () => {
    it("should format date correctly", () => {
      // May 20, 2026 is Wednesday
      const date = new Date("2026-05-20T10:00:00");
      expect(formatDashboardDate(date)).toBe("Wednesday, May 20");
    });
  });

  describe("agentLabel", () => {
    it("should return Claude CLI for claude", () => {
      expect(agentLabel("claude")).toBe("Claude CLI");
    });

    it("should return Codex CLI for codex", () => {
      expect(agentLabel("codex")).toBe("Codex CLI");
    });

    it("should return Unassigned for null or other agent", () => {
      expect(agentLabel(null)).toBe("Unassigned");
    });
  });
});
