(function () {
  const DEFAULT_HTTP_BASE_URL = "https://127.0.0.1:8080";
  const DEFAULT_WS_BASE_URL = "wss://127.0.0.1:8080";
  const DEFAULT_TIMEOUT_MS = 45000;

  class ReceiveSessionManager {
    constructor(options) {
      const opts = options || {};

      this.httpBaseUrl = (opts.httpBaseUrl || DEFAULT_HTTP_BASE_URL).replace(/\/$/, "");
      this.wsBaseUrl = (opts.wsBaseUrl || DEFAULT_WS_BASE_URL).replace(/\/$/, "");
      this.timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
      this.fetchImpl = opts.fetchImpl || fetch.bind(window);
      this.WebSocketCtor = opts.WebSocketCtor || WebSocket;
      this.onStatus = typeof opts.onStatus === "function" ? opts.onStatus : function () {};
      this.onSecret = typeof opts.onSecret === "function" ? opts.onSecret : function () {};

      this.state = "idle";
      this.ws = null;
      this.waitTimer = null;
      this.cache = {
        publicKey: null,
        publicKeyEndpoint: null,
        secret: null,
      };
    }

    async start(receiverContext) {
      if (!receiverContext || typeof receiverContext !== "object") {
        throw new Error("Receiver context is required.");
      }

      if (this.state !== "idle") {
        throw new Error("Receive session is already running.");
      }

      const plutoTagId = (receiverContext.plutoTagId || "").trim();
      const receiverUserId = (receiverContext.receiverUserId || "").trim();
      const receiverDeviceId = (receiverContext.receiverDeviceId || "").trim();
      const receiverPublicKey = (receiverContext.receiverPublicKey || "").trim();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = Number(receiverContext.expiresAt) || nowSeconds + 900;

      if (!plutoTagId || !receiverUserId || !receiverDeviceId || !receiverPublicKey) {
        throw new Error("Receiver tag, user, device, and public key are required.");
      }

      try {
        this.#setState("create-session", "Creating receive session...");
        const sessionPayload = await this.#registerWaitingSession({
          plutoTagId,
          receiverUserId,
          receiverDeviceId,
          receiverPublicKey,
          expiresAt,
        });

        this.cache.publicKey = receiverPublicKey;
        this.cache.publicKeyEndpoint = this.#buildPublicKeyEndpoint(plutoTagId);

        await this.#openWebSocket(receiverDeviceId);

        this.#setState("listening", "Listening for key/secret events...");
        const secretPayload = await this.#waitForSecret();
        this.cache.secret = secretPayload;
        this.onSecret(secretPayload);

        this.#setState("acknowledge", "Acknowledging received secret...");
        const ackPayload = await this.#acknowledgeSecret(secretPayload.msgId, receiverDeviceId);

        this.#setState("completed", "Secret received and acknowledged.");
        return {
          session: sessionPayload,
          publicKey: this.cache.publicKey,
          publicKeyEndpoint: this.cache.publicKeyEndpoint,
          secret: this.cache.secret,
          acknowledgement: ackPayload,
        };
      } catch (error) {
        this.#setState("error", "Receive session failed.");
        throw error;
      } finally {
        this.stop("cleanup");
      }
    }

    stop(reason) {
      if (this.waitTimer) {
        clearTimeout(this.waitTimer);
        this.waitTimer = null;
      }

      if (this.ws) {
        try {
          this.ws.close(1000, reason || "cleanup");
        } catch (e) {
          // Ignore close errors during shutdown.
        }
      }

      this.ws = null;
      this.cache.publicKey = null;
      this.cache.publicKeyEndpoint = null;
      this.cache.secret = null;

      if (this.state !== "idle") {
        this.state = "idle";
      }
    }

    #setState(nextState, statusMessage) {
      this.state = nextState;
      this.onStatus(statusMessage);
    }

    async #registerWaitingSession(payload) {
      this.#setState("publishing-public-key", "Registering waiting receiver session...");
      return await this.#requestJson("/v1/kdc/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pluto_tag_id: payload.plutoTagId,
          receiver_user_id: payload.receiverUserId,
          receiver_device_id: payload.receiverDeviceId,
          receiver_public_key: payload.receiverPublicKey,
          expires_at: payload.expiresAt,
        }),
      });
    }

    async #openWebSocket(receiverDeviceId) {
      const wsUrl = this.#buildWsUrl(receiverDeviceId);
      this.onStatus(`Connecting WebSocket: ${wsUrl}`);

      await new Promise((resolve, reject) => {
        let settled = false;
        const ws = new this.WebSocketCtor(wsUrl);

        const cleanup = () => {
          ws.removeEventListener("open", handleOpen);
          ws.removeEventListener("error", handleError);
        };

        const handleOpen = () => {
          if (settled) return;
          settled = true;
          cleanup();
          this.ws = ws;
          resolve();
        };

        const handleError = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(`WebSocket open failed for ${wsUrl}`));
        };

        ws.addEventListener("open", handleOpen);
        ws.addEventListener("error", handleError);
      });
    }

    async #waitForSecret() {
      if (!this.ws) {
        throw new Error("WebSocket is not connected.");
      }

      return await new Promise((resolve, reject) => {
        const ws = this.ws;

        const cleanup = () => {
          if (this.waitTimer) {
            clearTimeout(this.waitTimer);
            this.waitTimer = null;
          }

          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
          ws.removeEventListener("error", onError);
        };

        const onMessage = (event) => {
          const payload = this.#safeParseJson(event.data);

          if (this.#isEnvelopeEvent(payload)) {
            cleanup();
            resolve(this.#extractSecret(payload));
          }
        };

        const onClose = () => {
          cleanup();
          reject(new Error("WebSocket closed before receiving the secret."));
        };

        const onError = () => {
          cleanup();
          reject(new Error("WebSocket error while waiting for the secret."));
        };

        ws.addEventListener("message", onMessage);
        ws.addEventListener("close", onClose);
        ws.addEventListener("error", onError);

        this.waitTimer = setTimeout(() => {
          cleanup();
          reject(new Error("Timed out while waiting for the secret."));
        }, this.timeoutMs);
      });
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

    #buildPublicKeyEndpoint(plutoTagId) {
      return `${this.httpBaseUrl}/v1/kdc/pubkey/${encodeURIComponent(plutoTagId)}`;
    }

    async #acknowledgeSecret(msgId, receiverDeviceId) {
      if (!msgId) {
        return { status: "missing-msg-id" };
      }

      if (this.ws && this.ws.readyState === this.WebSocketCtor.OPEN) {
        this.ws.send(JSON.stringify({ ack: msgId }));
        return { status: "acked-over-ws", msgId };
      }

      return await this.#requestJson(`/v1/messages/${encodeURIComponent(msgId)}/ack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device_id: receiverDeviceId }),
      });
    }

    #buildWsUrl(receiverDeviceId) {
      const encodedReceiverDeviceId = encodeURIComponent(receiverDeviceId);
      return `${this.wsBaseUrl}/v1/ws/${encodedReceiverDeviceId}`;
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

    #isEnvelopeEvent(payload) {
      return !!(payload && payload.type === "Envelope" && payload.data && payload.data.header);
    }

    #extractSecret(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid secret payload received from WebSocket.");
      }

      if (payload.type === "Envelope" && payload.data && payload.data.header) {
        return {
          msgId: payload.data.header.msg_id,
          fromUser: payload.data.header.from_user,
          fromDevice: payload.data.header.from_device,
          toUser: payload.data.header.to_user,
          toDevice: payload.data.header.to_device,
          contentType: payload.data.header.content_type,
          wrappedSymmetricKey: payload.data.eph_pub,
          nonce: payload.data.nonce,
          ciphertext: payload.data.ciphertext,
          sig: payload.data.sig,
          raw: payload,
        };
      }

      throw new Error("Unsupported websocket payload shape.");
    }
  }

  window.ReceiveSessionManager = ReceiveSessionManager;
})();
