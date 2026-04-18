(function () {
  const DEFAULT_HTTP_BASE_URL = "https://127.0.0.1:8080";

  class SendSessionManager {
    constructor(options) {
      const opts = options || {};
      this.httpBaseUrl = (opts.httpBaseUrl || DEFAULT_HTTP_BASE_URL).replace(/\/$/, "");
      this.fetchImpl = opts.fetchImpl || fetch.bind(window);
      this.onStatus = typeof opts.onStatus === "function" ? opts.onStatus : function () {};
    }

    async send(payload) {
      const req = this.#normalizePayload(payload);

      this.onStatus(`Looking up receiver key for ${req.plutoTagId}...`);
      const lookup = await this.#requestJson(`/v1/kdc/pubkey/${encodeURIComponent(req.plutoTagId)}`);

      // MOCK: symmetric key is locally fabricated instead of derived via ECDH/HKDF.
      this.onStatus("Wrapping symmetric key for receiver...");
      const symmetricKey = this.#generateSymmetricKey();
      // MOCK: no real public-key wrapping is performed yet.
      const wrappedSymmetricKey = this.#mockWrapSymmetricKey(symmetricKey, lookup.receiver_public_key);
      // MOCK: no real AEAD encryption is performed yet.
      const ciphertext = this.#mockEncryptPayload(req.secretPayload, symmetricKey);
      const nonce = this.#generateNonce();

      this.onStatus("Sending ciphertext to receiver via KDC...");
      const sendResult = await this.#requestJson("/v1/kdc/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pluto_tag_id: req.plutoTagId,
          from_user: req.fromUser,
          from_device: req.fromDevice,
          wrapped_symmetric_key: wrappedSymmetricKey,
          ciphertext,
          nonce,
          // MOCK: request signature is a fixed placeholder, not cryptographically signed.
          sig: "mock-send-session-signature",
          expires_at: req.expiresAt,
        }),
      });

      return {
        lookup,
        sendResult,
      };
    }

    #normalizePayload(payload) {
      const input = payload || {};
      const plutoTagId = (input.plutoTagId || "").trim();
      const fromUser = (input.fromUser || "").trim();
      const fromDevice = (input.fromDevice || "").trim();
      const secretPayload = input.secretPayload;
      const expiresAt = Number(input.expiresAt) || Math.floor(Date.now() / 1000) + 900;

      if (!plutoTagId || !fromUser || !fromDevice) {
        throw new Error("plutoTagId, fromUser, and fromDevice are required.");
      }

      if (!plutoTagId.startsWith("@")) {
        throw new Error("Recipient Pluto tag must start with @ (example: @userB).");
      }

      if (!secretPayload || typeof secretPayload !== "object") {
        throw new Error("A non-empty secret payload is required.");
      }

      return {
        plutoTagId,
        fromUser,
        fromDevice,
        secretPayload,
        expiresAt,
      };
    }

    async #requestJson(path, options) {
      const response = await this.fetchImpl(`${this.httpBaseUrl}${path}`, options);

      if (!response.ok) {
        throw new Error(`Request failed (${response.status} ${response.statusText}) for ${path}.`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }

      const text = await response.text();
      return text ? this.#safeParseJson(text) : {};
    }

    #safeParseJson(raw) {
      if (raw == null) {
        return {};
      }

      if (typeof raw === "object") {
        return raw;
      }

      if (typeof raw !== "string") {
        return {};
      }

      try {
        return JSON.parse(raw);
      } catch (e) {
        return { raw };
      }
    }

    #generateSymmetricKey() {
      // MOCK: this is not a cryptographically strong key generation path.
      return this.#toBase64(`sym-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
    }

    #generateNonce() {
      // MOCK: this is not a cryptographically strong nonce generation path.
      return this.#toBase64(`nonce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }

    #mockWrapSymmetricKey(symmetricKey, receiverPublicKey) {
      // MOCK: placeholder representation that pretends the key was wrapped.
      return this.#toBase64(`wrap:${receiverPublicKey}:${symmetricKey}`);
    }

    #mockEncryptPayload(secretPayload, symmetricKey) {
      // MOCK: payload is encoded JSON, not encrypted ciphertext from a real cipher.
      return this.#toBase64(JSON.stringify({
        algorithm: "mock-aes-gcm",
        key_ref: symmetricKey,
        payload: secretPayload,
      }));
    }

    #toBase64(value) {
      return btoa(unescape(encodeURIComponent(value)));
    }
  }

  window.SendSessionManager = SendSessionManager;
})();
