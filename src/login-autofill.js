// Login autofill popup handling.
// This file is loaded after content.js and reuses openSerial/commandSerial/openedPort.

function setupLoginAutofillObserver() {
  document
    .querySelectorAll("input")
    .forEach(attachLoginUsernameFieldHandler);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches && node.matches("input")) {
          attachLoginUsernameFieldHandler(node);
        }

        if (node.querySelectorAll) {
          node
            .querySelectorAll("input")
            .forEach(attachLoginUsernameFieldHandler);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function attachLoginUsernameFieldHandler(input) {
  if (input.dataset.loginAutofillHandlerAttached) return;
  if (!isLikelyLoginIdentifierField(input)) return;
  input.dataset.loginAutofillHandlerAttached = "true";

  input.addEventListener("focus", () => {
    const context = getFormContextForLogin(input);
    if (context !== "login") {
      return;
    }

    const rect = input.getBoundingClientRect();
    const position = {
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    };

    showLoginAutofillBox(input, position);
  });

  input.addEventListener("blur", () => {
    hideLoginAutofillBox();
  });
}

function getPasswordFormContext(passwordField) {
  const form = passwordField.closest("form");
  const scope = form || document;

  const passwordFields = Array.from(scope.querySelectorAll('input[type="password"]'));
  const hasConfirmField = passwordFields.some((field) =>
    isLikelyConfirmPasswordFieldForLogin(field)
  );

  const formHints = [
    form?.id || "",
    form?.className || "",
    form?.getAttribute("name") || "",
    form?.getAttribute("action") || "",
  ]
    .join(" ")
    .toLowerCase();

  const buttonHints = Array.from(scope.querySelectorAll('button, input[type="submit"]'))
    .map((el) => {
      if (el instanceof HTMLInputElement) {
        return `${el.value || ""} ${el.getAttribute("aria-label") || ""}`;
      }
      return `${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`;
    })
    .join(" ")
    .toLowerCase();

  const signupKeywords = /(sign\s*up|signup|register|create\s*account|join|new\s*account)/i;
  const loginKeywords = /(log\s*in|login|sign\s*in|signin|forgot\s*password|remember\s*me)/i;

  if (hasConfirmField || signupKeywords.test(formHints) || signupKeywords.test(buttonHints)) {
    return "signup";
  }

  if (loginKeywords.test(formHints) || loginKeywords.test(buttonHints)) {
    return "login";
  }

  // Fallback: one password field usually indicates login.
  if (passwordFields.length <= 1) {
    return "login";
  }

  return "signup";
}

function getFormContextForLogin(field) {
  const form = field.closest("form");
  const scope = form || document;

  const passwordFields = Array.from(scope.querySelectorAll('input[type="password"]'));
  if (passwordFields.length === 0) {
    return "unknown";
  }

  return getPasswordFormContext(passwordFields[0]);
}

function isLikelyLoginIdentifierField(field) {
  if (!(field instanceof HTMLInputElement)) {
    return false;
  }

  const type = (field.type || "text").toLowerCase();
  if (!["text", "email", "username", "tel", ""].includes(type)) {
    return false;
  }

  const form = field.closest("form");
  const scope = form || document;
  const hasPasswordField = scope.querySelector('input[type="password"]');
  if (!hasPasswordField) {
    return false;
  }

  const labelText = field.labels
    ? Array.from(field.labels)
        .map((label) => label.textContent || "")
        .join(" ")
    : "";

  const hint = [
    field.name || "",
    field.id || "",
    field.placeholder || "",
    field.getAttribute("aria-label") || "",
    field.getAttribute("autocomplete") || "",
    labelText,
  ]
    .join(" ")
    .toLowerCase();

  const usernameKeywords = /(user|username|email|e-mail|login|account|identifier)/i;
  const excludedKeywords = /(search|coupon|promo|referral|filter|query|code|otp|token|captcha)/i;

  if (excludedKeywords.test(hint)) {
    return false;
  }

  const autocomplete = (field.getAttribute("autocomplete") || "").toLowerCase();
  if (autocomplete === "username" || autocomplete === "email") {
    return true;
  }

  if (type === "email") {
    return true;
  }

  return usernameKeywords.test(hint);
}

function isLikelyConfirmPasswordFieldForLogin(field) {
  const labelText = field.labels
    ? Array.from(field.labels)
        .map((label) => label.textContent || "")
        .join(" ")
    : "";

  const hint = [
    field.name || "",
    field.id || "",
    field.placeholder || "",
    field.getAttribute("aria-label") || "",
    field.getAttribute("autocomplete") || "",
    labelText,
  ]
    .join(" ")
    .toLowerCase();

  const hasConfirmWords = /(confirm|repeat|again|reenter|re-enter|verify|verification)/i.test(hint);
  const hasSecondaryPasswordName = /(password[_-]?2|pass[_-]?2|pwd[_-]?2|passwordconfirm|confirm[_-]?password)/i.test(
    hint
  );
  return hasConfirmWords || hasSecondaryPasswordName;
}

async function ensureFieldFocusForTyping(field, attempts = 4, delayMs = 60) {
  for (let i = 0; i < attempts; i += 1) {
    field.focus({ preventScroll: true });
    if (typeof field.select === "function") {
      field.select();
    }

    if (document.activeElement === field) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return document.activeElement === field;
}

function showLoginAutofillBox(input, position) {
  hideLoginAutofillBox();

  const suggestionBox = document.createElement("div");
  suggestionBox.id = "pluto-login-autofill-box";

  const boxMaxWidth = 250;
  const horizontalMargin = 8;
  const verticalMargin = 8;
  const clampedLeft = Math.max(
    horizontalMargin,
    Math.min(position.left, window.innerWidth - boxMaxWidth - horizontalMargin)
  );
  const clampedTop = Math.max(
    verticalMargin,
    Math.min(position.top, window.innerHeight - 48 - verticalMargin)
  );

  suggestionBox.style.position = "fixed";
  suggestionBox.style.top = `${clampedTop}px`;
  suggestionBox.style.left = `${clampedLeft}px`;
  suggestionBox.style.zIndex = "2147483647";

  document.body.appendChild(suggestionBox);

  const shadow = suggestionBox.attachShadow({ mode: "open" });
  shadow.innerHTML = `
  <style>
    :host {
      display: block;
    }
    .pluto-login-box {
      background: linear-gradient(135deg, #054FF0 0%, #DCFC73 100%);
      padding: 1px;
      border-radius: 8px;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      box-shadow: 0 4px 12px rgba(5, 79, 240, 0.4);
      max-width: 250px;
      transition: transform 0.1s ease;
    }
    .inner-content {
      background: white;
      padding: 8px 12px;
      border-radius: 7px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
    }
    .label-container {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .label {
      font-size: 11px;
      color: #054FF0;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .key-icon {
      width: 14px;
      height: 14px;
      fill: #f0bd05ff;
      flex-shrink: 0;
    }
    .pluto-login-box:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(5, 79, 240, 0.6);
    }
  </style>

  <div class="pluto-login-box" title="Click to auto-fill login with Pluto">
    <div class="inner-content">
      <div class="label-container">
        <svg class="key-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z"/>
        </svg>
        <div class="label">Auto-fill with Pluto</div>
      </div>
    </div>
  </div>`;

  const box = shadow.querySelector(".pluto-login-box");
  box.addEventListener("mousedown", async (e) => {
    e.preventDefault();
    hideLoginAutofillBox();

    try {
      if (!openedPort) {
        openedPort = await openSerial();
      }
      if (!openedPort) {
        console.error("Could not open serial port for login autofill");
        return;
      }

      const url = new URL(window.location.href);
      let domain = window.location.hostname;

      // Local test page fallback.
      if (url.protocol === "file:" && url.pathname.toLowerCase().includes("/login.html")) {
        domain = "example.com";
      }

      // Pinterest login modal can steal focus to the close button; enforce focus on identifier field.
      const isPinterest = window.location.hostname.includes("pinterest.");
      const focused = await ensureFieldFocusForTyping(
        input,
        isPinterest ? 10 : 4,
        isPinterest ? 80 : 60
      );
      if (!focused) {
        console.warn("Login identifier field did not keep focus before typing command");
      }

      await commandSerial(openedPort, "typeKeyPluto", domain);
    } catch (error) {
      console.error("Error during login autofill:", error);
    }
  });
}

function hideLoginAutofillBox() {
  const existingBox = document.getElementById("pluto-login-autofill-box");
  if (existingBox) {
    existingBox.remove();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupLoginAutofillObserver);
} else {
  setupLoginAutofillObserver();
}
