(function () {
  function textToHex(input) {
    return Array.from(new TextEncoder().encode(input))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function promptForBackupKey() {
    const keyText = window.prompt("Enter your backup key");
    if (keyText === null) {
      return null;
    }

    if (!keyText.trim()) {
      alert("Backup key is required.");
      return null;
    }

    return textToHex(keyText);
  }

  function parseBackupState(response) {
    const normalized = response.trim();
    if (normalized === "backup_key: True") {
      return true;
    }

    if (normalized === "backup_key: False") {
      return false;
    }

    throw new Error(`Unexpected backup state response: ${normalized}`);
  }

  function isBackupError(response) {
    return response.startsWith("❌") || response.startsWith("ERROR:");
  }

  function readBackupFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pluto";

    return new Promise((resolve, reject) => {
      input.addEventListener(
        "change",
        async () => {
          const file = input.files && input.files[0];
          if (!file) {
            resolve(null);
            return;
          }

          try {
            const textContent = (await file.text()).trim();
            if (!textContent) {
              reject(new Error("Selected backup file is empty."));
              return;
            }
            resolve(textContent);
          } catch (error) {
            reject(error);
          }
        },
        { once: true }
      );

      input.addEventListener("cancel", () => resolve(null), { once: true });

      input.click();
    });
  }

  function downloadBackupBlob(backupBlob) {
    const blob = new Blob([backupBlob], {
      type: "application/x-pluto-backup",
    });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const filename = `backup-${yyyy}-${mm}-${dd}.pluto`;

    chrome.downloads.download({ url, filename, saveAs: true }, () => {
      URL.revokeObjectURL(url);

      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError.message);
        alert(`Create backup failed: ${chrome.runtime.lastError.message}`);
      }
    });
  }

  function getActiveTabId() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!tabs[0] || typeof tabs[0].id !== "number") {
          reject(new Error("No active tab found."));
          return;
        }

        resolve(tabs[0].id);
      });
    });
  }

  async function runBackupCommand(command) {
    const tabId = await getActiveTabId();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error("Timed out waiting for backup response."));
      }, 10000);

      function cleanup() {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(listener);
      }

      function listener(message) {
        if (message.action !== "backupResponse") {
          return;
        }

        cleanup();
        resolve((message.data || "").trim());
      }

      chrome.runtime.onMessage.addListener(listener);

      chrome.tabs.sendMessage(
        tabId,
        { action: "backupPluto", backupCommand: command },
        (response) => {
          if (chrome.runtime.lastError) {
            cleanup();
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response && typeof response.data === "string") {
            cleanup();
            resolve(response.data.trim());
          }
        }
      );
    });
  }

  async function getBackupState() {
    const response = await runBackupCommand("backup --state");
    if (isBackupError(response)) {
      throw new Error(response);
    }

    return parseBackupState(response);
  }

  async function createBackup() {
    try {
      const hasStoredKey = await getBackupState();
      let command = "backup";

      if (!hasStoredKey) {
        const hexKey = promptForBackupKey();
        if (!hexKey) {
          return;
        }
        command = `backup ${hexKey}`;
      }

      const response = await runBackupCommand(command);
      if (isBackupError(response)) {
        throw new Error(response);
      }

      downloadBackupBlob(response);
    } catch (error) {
      console.error("Error in createBackup:", error);
      alert(`Create backup failed: ${error.message}`);
    }
  }

  async function loadBackup() {
    try {
      const backupBlob = await readBackupFile();
      if (!backupBlob) {
        return;
      }

      const hasStoredKey = await getBackupState();
      let command = `backup --load ${backupBlob}`;

      if (!hasStoredKey) {
        const hexKey = promptForBackupKey();
        if (!hexKey) {
          return;
        }
        command = `backup --load ${hexKey}:${backupBlob}`;
      }

      const response = await runBackupCommand(command);
      if (isBackupError(response)) {
        throw new Error(response);
      }

      alert(`Backup loaded successfully: ${response}`);
    } catch (error) {
      console.error("Error in loadBackup:", error);
      alert(`Load backup failed: ${error.message}`);
    }
  }

  function initBackupControls() {
    const createBackupBtn = document.getElementById("createBackupBtn");
    if (createBackupBtn) {
      createBackupBtn.addEventListener("click", createBackup);
      console.log("Create backup button event listener attached");
    } else {
      console.warn("createBackupBtn not found in DOM");
    }

    const loadBackupBtn = document.getElementById("loadBackupBtn");
    if (loadBackupBtn) {
      loadBackupBtn.addEventListener("click", loadBackup);
      console.log("Load backup button event listener attached");
    } else {
      console.warn("loadBackupBtn not found in DOM");
    }
  }

  document.addEventListener("DOMContentLoaded", initBackupControls);
})();
