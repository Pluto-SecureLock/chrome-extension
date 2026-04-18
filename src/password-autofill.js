// Password suggestion popup and signup form handling.
// This file is loaded after content.js and reuses openSerial/commandSerial/openedPort.

let currentPasswordField = null;
const processedForms = new WeakSet(); // Track forms we've already processed
const processedButtons = new WeakSet(); // Track buttons we've already processed

function setupSignupObserver() {
  // Handle password fields that already exist on the page
  document
    .querySelectorAll('input[type="password"]')
    .forEach(handlePasswordField);

  // Also look for forms with password fields and attach submit handlers
  document
    .querySelectorAll("form")
    .forEach(attachFormSubmitHandler);

  // Handle any submit buttons
  handleAllSubmitButtons();

  // Set up the observer for when the DOM changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        // if the node itself is a password field
        if (node.matches && node.matches('input[type="password"]')) {
          handlePasswordField(node);
        }

        // Check for forms within the node
        if (node.querySelectorAll) {
          // Check if the node itself is a form
          if (node.matches && node.matches("form")) {
            attachFormSubmitHandler(node);
          }

          // Check for forms inside the node
          node.querySelectorAll("form").forEach(attachFormSubmitHandler);

          // Check for password fields within node
          node
            .querySelectorAll('input[type="password"]')
            .forEach(handlePasswordField);

          // Check for all submit buttons and attach handlers
          const allButtons = node.querySelectorAll("button");
          allButtons.forEach((btn) => {
            if (!processedButtons.has(btn)) {
              attachButtonSubmitHandler(btn);
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("Password field observer started");
}

function attachFormSubmitHandler(form) {
  if (processedForms.has(form)) return;

  const passwordFields = form.querySelectorAll('input[type="password"]');

  // Only attach to likely signup forms with password fields.
  if (passwordFields.length > 0 && isLikelySignupForm(form)) {
    processedForms.add(form);
    form.addEventListener("submit", handleFormSubmit, true);
    console.log("Form submit handler attached. Password fields found:", passwordFields.length);
  }
}

function attachButtonSubmitHandler(button) {
  if (processedButtons.has(button)) return;
  processedButtons.add(button);

  // Check if button is likely a submit button
  const isLikelySubmit =
    button.type === "submit" ||
    button.textContent
      .toLowerCase()
      .match(/(submit|sign up|create|register|join|send|continue|start|next|confirm)/i) ||
    button
      .getAttribute("aria-label")
      ?.toLowerCase()
      .match(/(submit|sign up|create|register|join)/i);

  if (isLikelySubmit) {
    button.addEventListener("click", handleButtonClick, true);
    console.log("Button submit handler attached:", button.textContent.trim());
  }
}

function handleAllSubmitButtons() {
  const allButtons = document.querySelectorAll("button");
  allButtons.forEach(attachButtonSubmitHandler);
}

function handlePasswordField(input) {
  // prevent duplicate handlers
  if (input.dataset.passwordHandlerAttached) return;
  input.dataset.passwordHandlerAttached = "true";

  console.log("Detected password field:", input);

  // Check if this is a confirm/repeat password field
  const isConfirmField = isLikelyConfirmPasswordField(input);

  input.dataset.isConfirmPassword = isConfirmField ? "true" : "false";

  input.addEventListener("focus", () => {
    console.log("Password field focused. Is confirm field:", isConfirmField);
    currentPasswordField = input;

    if (!isLikelySignupPasswordField(input)) {
      return;
    }

    const rect = input.getBoundingClientRect();

    const position = {
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    };

    console.log("Password field position:", position);
    // Only show suggestion for non-confirm password fields
    if (!isConfirmField) {
      showPasswordSuggestionBox(input, position);
    }
  });

  input.addEventListener("blur", () => {
    hidePasswordSuggestionBox();
  });
}

function getFieldHintText(field) {
  const labelText = field.labels
    ? Array.from(field.labels)
        .map((label) => label.textContent || "")
        .join(" ")
    : "";

  return [
    field.name || "",
    field.id || "",
    field.placeholder || "",
    field.getAttribute("aria-label") || "",
    field.getAttribute("autocomplete") || "",
    labelText,
  ]
    .join(" ")
    .toLowerCase();
}

function isLikelyConfirmPasswordField(field) {
  const hint = getFieldHintText(field);
  const hasConfirmWords = /(confirm|repeat|again|reenter|re-enter|verify|verification)/i.test(hint);
  const hasSecondaryPasswordName = /(password[_-]?2|pass[_-]?2|pwd[_-]?2|passwordconfirm|confirm[_-]?password)/i.test(
    hint
  );
  return hasConfirmWords || hasSecondaryPasswordName;
}

function hasNonEmptyResponse(response) {
  return typeof response === "string" && response.trim().length > 0;
}

function findConfirmPasswordField(primaryField) {
  const scope = primaryField.closest("form") || document;
  const passwordFields = Array.from(
    scope.querySelectorAll('input[type="password"]')
  ).filter((field) => field !== primaryField);

  if (passwordFields.length === 0) {
    return null;
  }

  const explicitConfirm = passwordFields.find(
    (field) => field.dataset.isConfirmPassword === "true"
  );
  if (explicitConfirm) {
    return explicitConfirm;
  }

  const heuristicConfirm = passwordFields.find((field) =>
    isLikelyConfirmPasswordField(field)
  );
  if (heuristicConfirm) {
    return heuristicConfirm;
  }

  // Fallback for sites with generic field names: use the next password field in DOM order.
  return passwordFields[0];
}

function getFormContextForPasswordField(passwordField) {
  const form = passwordField.closest("form");
  const scope = form || document;

  const passwordFields = Array.from(scope.querySelectorAll('input[type="password"]'));
  const hasConfirmField = passwordFields.some((field) =>
    isLikelyConfirmPasswordField(field)
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

  if (passwordFields.length <= 1) {
    return "login";
  }

  return "signup";
}

function isLikelySignupPasswordField(passwordField) {
  return getFormContextForPasswordField(passwordField) === "signup";
}

function isLikelySignupForm(form) {
  const firstPasswordField = form.querySelector('input[type="password"]');
  if (!firstPasswordField) {
    return false;
  }
  return isLikelySignupPasswordField(firstPasswordField);
}

async function waitForFieldValue(field, timeoutMs = 3000, intervalMs = 75) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (field.value && field.value.length > 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function waitForAnyFilledPasswordField(seedField, timeoutMs = 4500, intervalMs = 75) {
  const scope = seedField.closest("form") || document;

  // Track initial values so we can detect which field received new input.
  const getCandidates = () => {
    const fields = Array.from(scope.querySelectorAll('input[type="password"]'));
    if (!fields.includes(seedField)) {
      fields.unshift(seedField);
    }
    return fields;
  };

  const initialValues = new Map();
  getCandidates().forEach((field) => {
    initialValues.set(field, field.value || "");
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLInputElement &&
      activeEl.type === "password" &&
      activeEl.value &&
      activeEl.value.length > 0
    ) {
      return activeEl;
    }

    const candidates = getCandidates();
    for (const field of candidates) {
      const currentValue = field.value || "";
      const previousValue = initialValues.get(field) || "";
      if (currentValue.length > 0 && currentValue !== previousValue) {
        return field;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

// init when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSignupObserver);
} else {
  setupSignupObserver();
}

function showPasswordSuggestionBox(input, position) {
  // Remove any existing suggestion box
  hidePasswordSuggestionBox();

  // Create the suggestion box
  const suggestionBox = document.createElement("div");
  suggestionBox.id = "password-suggestion-box";

  // Always use viewport coordinates to avoid parent-offset/layout shifts.
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

  suggestionBox.style.zIndex = "2147483647"; // Maximum z-index value

  document.body.appendChild(suggestionBox);
  //shadow needed to have styles applied correctly or else the website's styles may override ours
  const shadow = suggestionBox.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `
  <style>
    /* Basic Reset and Global Styles */
    :host {
      display: block; /* Ensure the shadow host behaves correctly */
    }
    /* --- Container Style --- */
    .pluto-suggestion-box {
      /* Use the bright primary color for the base gradient */
      background: linear-gradient(135deg, #054FF0 0%, #DCFC73 100%);

      /* Overall Box Styling */
      padding: 1px; /* Creates the visible gradient border */
      border-radius: 8px; /* Slightly more modern curve */
      font-family: 'Inter', 'Segoe UI', sans-serif; /* Use a modern, clean font */
      box-shadow: 0 4px 12px rgba(5, 79, 240, 0.4); /* Blue glow/shadow */
      max-width: 250px;
      transition: transform 0.1s ease;
    }
    /* --- Inner Content Style --- */
    .inner-content {
      background: white; /* Inner white background for contrast */
      padding: 8px 12px;
      border-radius: 7px; /* Matches outer radius minus the 1px border */
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
    }
    .label-container {
    display: flex;
    align-items: center; /* Vertically align icon and text */
    gap: 6px; /* Space between icon and text */
    }
    /* --- Text Styles --- */
    .label {
      font-size: 11px;
      color: #054FF0; /* Use the primary blue for the label */
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .password {
      font-family: 'Raleway'; /* Monospace for passwords */
      font-size: 14px;
      font-weight: 600;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* --- Key Icon Styling --- */
    .key-icon {
      width: 14px; /* Adjust size as needed */
      height: 14px;
      fill: #f0bd05ff; /* Match the label text color */
      flex-shrink: 0; /* Prevent icon from shrinking */
    }
    /* --- Hover Effect --- */
    .pluto-suggestion-box:hover {
      transform: translateY(-1px); /* Subtle lift on hover */
      box-shadow: 0 6px 16px rgba(5, 79, 240, 0.6); /* Enhanced shadow on hover */
    }
  </style>

  <div class="pluto-suggestion-box" title="Click to use this password">
    <div class="inner-content">
      <div class="label-container">
        <svg class="key-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z"/>
          </svg>
          <div class="label">Pluto Suggested Password</div>
      </div>
    </div>
  </div>`;

  const suggestionDiv = shadow.querySelector(".pluto-suggestion-box");

  suggestionDiv.addEventListener("mousedown", async (e) => {
    e.preventDefault(); // Prevent blur on input field
    console.log("Pluto Suggestion Box clicked. Requesting Pluto to generate password...");
    hidePasswordSuggestionBox();
    input.focus(); // Set focus back to the input field before typing

    try {
      if (!openedPort) {
        openedPort = await openSerial();
      }
      if (!openedPort) {
        console.error("Could not open serial port for password generation");
        return;
      }

      // Non-empty response indicates the device typed successfully.
      const generateResponse = await commandSerial(openedPort, "generatePasswordPluto");
      const generateSucceeded = hasNonEmptyResponse(generateResponse);
      console.log(generateResponse);
      // Wait for whichever password field the site/device actually typed into.
      const filledPrimaryField = await waitForAnyFilledPasswordField(input, 4500);

      // Verify that password field is filled
      if (generateSucceeded || filledPrimaryField) {
        const primaryField = filledPrimaryField || input;
        console.log("Password field filled by Pluto");
        primaryField.dispatchEvent(new Event("input", { bubbles: true }));
        primaryField.dispatchEvent(new Event("change", { bubbles: true }));

        const confirmField = findConfirmPasswordField(primaryField);
        if (confirmField) {
          console.log("Found confirm password field, requesting Pluto to type same password");
          confirmField.focus();

          // Let focus settle before hardware typing.
          await new Promise((resolve) => setTimeout(resolve, 250));

          // Non-empty response indicates the device typed the same password successfully.
          const sameResponse = await commandSerial(openedPort, "samePasswordPluto", "", "");
          const sameSucceeded = hasNonEmptyResponse(sameResponse);

          const confirmFilled = await waitForFieldValue(confirmField, 3000);
          if (sameSucceeded || confirmFilled) {
            confirmField.dispatchEvent(new Event("input", { bubbles: true }));
            confirmField.dispatchEvent(new Event("change", { bubbles: true }));
            console.log("Confirm password field filled by Pluto");
          } else {
            console.warn(
              "Confirm password field was not populated after samePasswordPluto command",
              sameResponse
            );
          }
        }
      } else {
        console.log("Password field remains empty, Pluto may not have typed the password", generateResponse);
      }
    } catch (error) {
      console.error("Error during password generation:", error);
    }
  });
}

function hidePasswordSuggestionBox() {
  const existingBox = document.getElementById("password-suggestion-box");
  if (existingBox) {
    existingBox.remove();
  }
}

async function handleFormSubmit(event) {
  console.log("Form submit event triggered");
  await submitRegistrationForm(event.target);
}

async function handleButtonClick(event) {
  console.log("Submit button clicked");
  const form = event.target.closest("form");
  if (form && isLikelySignupForm(form)) {
    // Check if form has password fields
    const passwordFields = form.querySelectorAll('input[type="password"]');
    if (passwordFields.length > 0) {
      await submitRegistrationForm(form);
    }
  }
}

async function submitRegistrationForm(formElement) {
  // 1. Setup and Validation
  if (formElement.tagName !== "FORM") {
    formElement = formElement.closest("form") || formElement;
  }

  let domain = window.location.hostname;
  const passwordFields = formElement.querySelectorAll('input[type="password"]');

  if (passwordFields.length === 0 || !passwordFields[0].value) {
    console.log("No valid password fields, submitting immediately.");
    if (formElement.tagName === "FORM") formElement.submit();
    return;
  }

  const usernameField =
    formElement.querySelector('input[type="email"]') ||
    formElement.querySelector('input[type="text"]'); // Simplified for brevity
  const username = usernameField ? usernameField.value : `user_${Date.now()}`;
  const secretsToSend = `${domain}:${domain},${username},,"Signup generated by Pluto"`;

  // 2. The Critical Async Logic
  try {
    if (!openedPort) {
      openedPort = await openSerial();
    }

    if (openedPort) {
      console.log("Sending credential to Pluto device...");
      // This line now strictly waits for the response before moving to the next line
      const result = await commandSerial(openedPort, "singleAddPluto", "", secretsToSend);
      console.log("Credential saved to Pluto. Result:", result);
    } else {
      console.warn("Could not open serial port.");
    }
  } catch (error) {
    console.error("Error during Pluto communication:", error);
  } finally {
    // 3. Final Submission
    // This block runs whether the try succeeded or the catch caught an error
    if (formElement.tagName === "FORM") {
      console.log("Submitting form now.");
      await delay(1000);
      formElement.submit();
    }
  }
}
