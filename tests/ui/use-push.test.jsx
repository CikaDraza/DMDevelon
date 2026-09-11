import { describe, expect, it } from "vitest";

import {
  PUSH_VAPID_KEY_STORAGE,
  pushSubscriptionNeedsRefresh,
} from "@/hooks/usePush";

const publicKey = "BEl6VapidPublicKeyUsedForTheCurrentBuild";

function storageWith(value) {
  return {
    getItem: (key) => (key === PUSH_VAPID_KEY_STORAGE ? value : null),
  };
}

describe("push VAPID subscription recovery", () => {
  it("rebuilds an existing subscription when Firefox exposes no key and no marker exists", () => {
    const firefoxSubscription = { endpoint: "https://push.example/subscription" };

    expect(
      pushSubscriptionNeedsRefresh(firefoxSubscription, {
        publicKey,
        storage: storageWith(null),
      }),
    ).toBe(true);
  });

  it("keeps the subscription after this build saved it with the current key", () => {
    const firefoxSubscription = { endpoint: "https://push.example/subscription" };

    expect(
      pushSubscriptionNeedsRefresh(firefoxSubscription, {
        publicKey,
        storage: storageWith(publicKey),
      }),
    ).toBe(false);
  });

  it("rebuilds the subscription when the remembered public key changed", () => {
    const firefoxSubscription = { endpoint: "https://push.example/subscription" };

    expect(
      pushSubscriptionNeedsRefresh(firefoxSubscription, {
        publicKey,
        storage: storageWith("previous-public-key"),
      }),
    ).toBe(true);
  });
});
