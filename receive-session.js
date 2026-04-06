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
        secret: null,
      };
    }

    async start(sessionToken) {
      if (!sessionToken || !sessionToken.trim()) {
        throw new Error("Session token is required.");
      }

      if (this.state !== "idle") {
        throw new Error("Receive session is already running.");
      }

      const token = sessionToken.trim();

      try {
        this.#setState("create-session", "Creating receive session...");
        await this.#openWebSocket(token);

        const publicKeyPayload = await this.#getPublicKey(token);
        const publicKeyValue = this.#extractPublicKey(publicKeyPayload);
        this.cache.publicKey = publicKeyValue;

        await this.#postKey(token, publicKeyValue);

        this.#setState("listening", "Listening for key/secret events...");
        const secretPayload = await this.#waitForSecret();
        this.cache.secret = secretPayload;
        this.onSecret(secretPayload);

        this.#setState("acknowledge", "Acknowledging received secret...");
        const ackPayload = await this.#postSecret(token, secretPayload);

        this.#setState("completed", "Secret received and acknowledged.");
        return {
          publicKey: this.cache.publicKey,
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
      this.cache.secret = null;

      if (this.state !== "idle") {
        this.state = "idle";
      }
    }

    #setState(nextState, statusMessage) {
      this.state = nextState;
      this.onStatus(statusMessage);
    }

    async #openWebSocket(token) {
      const wsUrl = this.#buildWsUrl(token);

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
          reject(new Error("Could not open WebSocket session."));
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

          if (this.#isKeyReadyEvent(payload)) {
            this.onStatus("Session key populated. Waiting for secret...");
            return;
          }

          if (this.#isSecretEvent(payload)) {
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

    async #getPublicKey(token) {
      const query = new URLSearchParams({ token });
      return await this.#requestJson(`/publickey?${query.toString()}`, {
        method: "GET",
      });
    }

    async #postKey(token, publicKey) {
      return await this.#requestJson("/key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          publicKey,
        }),
      });
    }

    async #postSecret(token, secretPayload) {
      return await this.#requestJson("/secret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          secret: secretPayload,
          acknowledgedAt: new Date().toISOString(),
        }),
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

    #buildWsUrl(token) {
      const query = new URLSearchParams({ token });
      return `${this.wsBaseUrl}/ws/receive?${query.toString()}`;
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

    #extractPublicKey(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid response from /publickey.");
      }

      const key = payload.publicKey || payload.key || payload.data;
      if (!key) {
        throw new Error("Public key was not found in /publickey response.");
      }

      return key;
    }

    #isKeyReadyEvent(payload) {
      const type = (payload && payload.type) || "";
      const endpoint = (payload && payload.endpoint) || "";
      return type === "key_populated" || type === "key_ready" || endpoint === "/key";
    }

    #isSecretEvent(payload) {
      const type = (payload && payload.type) || "";
      const endpoint = (payload && payload.endpoint) || "";
      return type === "secret" || type === "secret_received" || endpoint === "/secret";
    }

    #extractSecret(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid secret payload received from WebSocket.");
      }

      if (payload.secret != null) {
        return payload.secret;
      }

      if (payload.data != null) {
        return payload.data;
      }

      return payload;
    }
  }

  window.ReceiveSessionManager = ReceiveSessionManager;
})();
