import { describe, expect, it } from "bun:test";
import { remapProductionStage } from "./portal";

describe("remapProductionStage", () => {
  const stages = ["Order masuk", "Diproses", "Produksi", "Selesai"];

  it("keeps the active named stage when stages are reordered", () => {
    expect(remapProductionStage(2, stages, ["Order masuk", "Produksi", "Diproses", "Selesai"])).toBe(1);
  });

  it("moves an active stage to the previous stage when it is deleted", () => {
    expect(remapProductionStage(2, stages, ["Order masuk", "Diproses", "Selesai"])).toBe(1);
  });

  it("preserves completed invoices when the workflow changes", () => {
    expect(remapProductionStage(4, stages, ["Order masuk", "Produksi", "Selesai"])).toBe(3);
  });

  it("keeps the index when a stage is renamed in place", () => {
    expect(remapProductionStage(1, stages, ["Order masuk", "Pengerjaan", "Produksi", "Selesai"])).toBe(1);
  });
});
