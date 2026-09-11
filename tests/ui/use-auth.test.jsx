import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const useResponseInterceptor = vi.fn();

vi.mock("axios", () => ({
  default: {
    get,
    post,
    put,
    interceptors: { response: { use: useResponseInterceptor } },
  },
}));

const { canonicalUserId, useAuth } = await import("@/hooks/useAuth");

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe("canonical authenticated user identity", () => {
  it("uses id first and falls back to _id", () => {
    expect(canonicalUserId({ id: "canonical", _id: "mongo" })).toBe(
      "canonical",
    );
    expect(canonicalUserId({ _id: "mongo" })).toBe("mongo");
  });

  it("does not upload an avatar when the cached user has no canonical ID", async () => {
    const readAsDataURL = vi.spyOn(FileReader.prototype, "readAsDataURL");
    localStorage.setItem("token", "valid-looking-token");
    localStorage.setItem("user", JSON.stringify({ name: "Missing ID" }));
    const { result } = renderHook(() => useAuth());
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await act(async () => {
      await expect(result.current.uploadAvatar(file)).rejects.toThrow(
        "Authenticated user identity is missing",
      );
    });

    expect(readAsDataURL).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
