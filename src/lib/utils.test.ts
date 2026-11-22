import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting Tailwind utility classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("keeps conditional class values", () => {
    expect(cn("rounded-md", false && "hidden", "text-sm")).toBe(
      "rounded-md text-sm",
    );
  });
});
