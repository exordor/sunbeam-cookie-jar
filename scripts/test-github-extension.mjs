import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distExtensionPath = path.join(rootDir, "dist");
const outputDir = path.join(rootDir, "test-results");
const extensionId = "fddfnafaafnlopplcjppfianbojldbbc";
const useActionPopup = process.env.USE_EXTENSION_ACTION_POPUP === "1";
const pregrantGithubHost = process.env.PREGRANT_GITHUB_HOST !== "0";

const hardTimeout = setTimeout(() => {
  console.error("GitHub extension E2E timed out.");
  process.exit(124);
}, Number(process.env.E2E_TIMEOUT_MS ?? 180_000));
hardTimeout.unref?.();

fs.mkdirSync(outputDir, { recursive: true });

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sunbeam-cookie-jar-"));
const extensionPath = pregrantGithubHost ? createPregrantedGithubFixture(distExtensionPath) : distExtensionPath;
log(`Launching Chromium with extension from ${extensionPath}`);
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || "chromium",
  headless: false,
  timeout: 30_000,
  ignoreDefaultArgs: ["--disable-extensions"],
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check"
  ]
});

try {
  log("Opening GitHub");
  const github = await context.newPage();
  await github.goto("https://github.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await context.addCookies([
    {
      name: "lcm_playwright_test",
      value: "github-cookie-value",
      url: "https://github.com/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 3600
    }
  ]);
  await github.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });

  const controller = await context.newPage();
  await controller.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });

  if (pregrantGithubHost) {
    log("Using test-only pregranted GitHub host permission");
  } else {
    log("Granting optional GitHub host permission through the extension UI");
    await controller.evaluate(() => {
      window.__grantGithubPermission = new Promise((resolve) => {
        const button = document.createElement("button");
        button.id = "grant-github-permission-test";
        button.textContent = "Grant GitHub test permission";
        button.addEventListener("click", () => {
          chrome.permissions.request({ origins: ["https://github.com/*"] }, (granted) => {
            resolve({ granted, lastError: chrome.runtime.lastError?.message ?? null });
          });
        });
        document.body.appendChild(button);
      });
    });

    await controller.locator("#grant-github-permission-test").click();
    const grantResult = await controller.evaluate(() => window.__grantGithubPermission);
    await controller.evaluate(() => document.querySelector("#grant-github-permission-test")?.remove());
    if (!grantResult.granted || grantResult.lastError) {
      throw new Error(`GitHub permission request failed: ${JSON.stringify(grantResult)}`);
    }
  }

  log("Checking chrome.cookies access for GitHub");
  const apiResult = await controller.evaluate(async () => {
    const hasPermission = await chrome.permissions.contains({ origins: ["https://github.com/*"] });
    const cookies = await chrome.cookies.getAll({ url: "https://github.com/" });
    return {
      hasPermission,
      cookieNames: cookies.map((cookie) => cookie.name)
    };
  });

  if (!apiResult.hasPermission || !apiResult.cookieNames.includes("lcm_playwright_test")) {
    throw new Error(`Chrome API cookie check failed: ${JSON.stringify(apiResult)}`);
  }

  if (useActionPopup) {
    log("Opening Chrome action popup");
    const cdp = await context.newCDPSession(controller);
    await controller.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const githubTab = tabs.find((tab) => tab.url?.startsWith("https://github.com/"));
      if (!githubTab?.id || !githubTab.windowId) {
        throw new Error("No GitHub tab found");
      }
      await chrome.windows.update(githubTab.windowId, { focused: true });
      await chrome.tabs.update(githubTab.id, { active: true });
      await Promise.race([
        chrome.action.openPopup(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("chrome.action.openPopup timed out")), 10_000))
      ]);
    });

    const { sessionId } = await attachToActionPopup(cdp);
    await waitForPopupText(cdp, sessionId, ["Sunbeam Cookie Jar", "https://github.com", "Site access granted", "lcm_playwright_test"]);
    await captureTargetScreenshot(cdp, sessionId, path.join(outputDir, "github-popup.png"));

    await cdp.send(
      "Runtime.evaluate",
      {
        expression: `Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Export current origin")?.click()`,
        returnByValue: true
      },
      sessionId
    );

    await waitForPopupText(cdp, sessionId, ["Export real cookie values?", "Lossless JSON"]);
    await captureTargetScreenshot(cdp, sessionId, path.join(outputDir, "github-export-warning.png"));
  } else {
    log("Using extension popup page for CI screenshots");
    await controller.setViewportSize({ width: 820, height: 720 });
    await controller.reload({ waitUntil: "domcontentloaded" });
    await waitForPageText(controller, ["Sunbeam Cookie Jar", "https://github.com", "Site access granted", "lcm_playwright_test"]);
    await controller.screenshot({ path: path.join(outputDir, "github-popup.png"), fullPage: true });

    await clickButtonByText(controller, "Export current origin");
    await waitForPageText(controller, ["Export real cookie values?", "Lossless JSON"]);
    await controller.screenshot({ path: path.join(outputDir, "github-export-warning.png"), fullPage: true });
  }

  const summary = {
    passed: true,
    testedAt: new Date().toISOString(),
    target: "https://github.com/",
    extensionId,
    popupMode: useActionPopup ? "chrome-action-popup" : "extension-page",
    hostPermissionMode: pregrantGithubHost ? "test-only-manifest-host-permission" : "optional-permission-request",
    cookieNames: apiResult.cookieNames,
    screenshots: ["test-results/github-popup.png", "test-results/github-export-warning.png"]
  };
  fs.writeFileSync(path.join(outputDir, "github-extension-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  clearTimeout(hardTimeout);
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  if (pregrantGithubHost) {
    fs.rmSync(extensionPath, { recursive: true, force: true });
  }
}

async function attachToActionPopup(cdp) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const targets = await cdp.send("Target.getTargets");
    const target = targets.targetInfos.find(
      (candidate) => candidate.url === `chrome-extension://${extensionId}/popup.html` && !candidate.attached
    );
    if (target) {
      return cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    }
    await wait(250);
  }
  throw new Error("Could not find the action popup target");
}

async function waitForPopupText(cdp, sessionId, expectedParts) {
  let lastText = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: "document.body.innerText",
        returnByValue: true
      },
      sessionId
    );
    lastText = result.result.value ?? "";
    if (expectedParts.every((part) => lastText.includes(part))) {
      return lastText;
    }
    await wait(250);
  }
  throw new Error(`Popup text did not include ${expectedParts.join(", ")}.\nLast text:\n${lastText}`);
}

async function captureTargetScreenshot(cdp, sessionId, outPath) {
  await cdp.send("Page.enable", {}, sessionId);
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, "base64"));
}

async function waitForPageText(page, expectedParts) {
  let lastText = "";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    lastText = await page.locator("body").innerText().catch(() => "");
    if (expectedParts.every((part) => lastText.includes(part))) {
      return lastText;
    }
    await wait(250);
  }
  throw new Error(`Page text did not include ${expectedParts.join(", ")}.\nLast text:\n${lastText}`);
}

async function clickButtonByText(page, text) {
  await page.locator("button", { hasText: text }).click({ timeout: 10_000 });
}

function log(message) {
  console.log(`[github-e2e] ${message}`);
}

function createPregrantedGithubFixture(sourcePath) {
  const fixturePath = fs.mkdtempSync(path.join(os.tmpdir(), "sunbeam-cookie-jar-extension-"));
  fs.cpSync(sourcePath, fixturePath, { recursive: true });
  const manifestPath = path.join(fixturePath, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  // CI cannot click Chrome's native optional-permission prompt, so pregrant only in this copied fixture.
  manifest.host_permissions = ["https://github.com/*"];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return fixturePath;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
