import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const iconDir = path.join(rootDir, "public", "icons");
const promoDir = path.join(rootDir, "store-assets", "promotional");
const screenshotDir = path.join(rootDir, "store-assets", "screenshots");
const sourcePopup = path.join(rootDir, "test-results", "github-popup.png");
const sourceWarning = path.join(rootDir, "test-results", "github-export-warning.png");

fs.mkdirSync(iconDir, { recursive: true });
fs.mkdirSync(promoDir, { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });

try {
  for (const size of [16, 32, 48, 128]) {
    await writeCanvasPng(page, size, size, "icon", {}, path.join(iconDir, `icon${size}.png`));
  }

  await writeCanvasPng(page, 440, 280, "promo", { variant: "small" }, path.join(promoDir, "small-promo-440x280.png"));
  await writeCanvasPng(page, 1400, 560, "promo", { variant: "marquee" }, path.join(promoDir, "marquee-1400x560.png"));

  await writeCanvasPng(
    page,
    1280,
    800,
    "screenshot",
    {
      title: "Manage current-site cookies",
      subtitle: "View, filter, edit, delete, import, and export cookies after explicit site access.",
      source: readImage(sourcePopup),
      accent: "table"
    },
    path.join(screenshotDir, "01-current-site-cookie-table-1280x800.png")
  );

  await writeCanvasPng(
    page,
    1280,
    800,
    "screenshot",
    {
      title: "Export only when you choose",
      subtitle: "Real cookie values are masked by default and require a warning before export.",
      source: readImage(sourceWarning),
      accent: "warning"
    },
    path.join(screenshotDir, "02-export-warning-1280x800.png")
  );

  await writeCanvasPng(
    page,
    1280,
    800,
    "formats",
    {},
    path.join(screenshotDir, "03-export-formats-1280x800.png")
  );

  await writeCanvasPng(
    page,
    1280,
    800,
    "import",
    {},
    path.join(screenshotDir, "04-import-preview-1280x800.png")
  );

  await writeCanvasPng(
    page,
    1280,
    800,
    "privacy",
    {},
    path.join(screenshotDir, "05-local-only-privacy-1280x800.png")
  );
} finally {
  await browser.close();
}

function readImage(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing source screenshot: ${filePath}. Run npm run test:e2e:github first.`);
  }
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

async function writeCanvasPng(page, width, height, kind, data, outPath) {
  await page.setViewportSize({ width, height });
  const base64 = await page.evaluate(
    async ({ width, height, kind, data }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      function roundedRect(x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
      }

      function fillRound(x, y, w, h, r, fill) {
        roundedRect(x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();
      }

      function strokeRound(x, y, w, h, r, stroke, lineWidth = 1) {
        roundedRect(x, y, w, h, r);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }

      function text(value, x, y, size, color, weight = 600, maxWidth) {
        ctx.fillStyle = color;
        ctx.font = `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(value, x, y, maxWidth);
      }

      function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#fbfcfd");
        gradient.addColorStop(0.55, "#f6f8fb");
        gradient.addColorStop(1, "#eef4f4");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(15, 23, 42, 0.035)";
        ctx.lineWidth = 1;
        const grid = Math.max(64, Math.round(width / 16));
        for (let x = -grid; x < width + grid; x += grid) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + height * 0.28, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += grid) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        const glow = ctx.createLinearGradient(0, 0, width, height * 0.42);
        glow.addColorStop(0, "rgba(245, 182, 66, 0)");
        glow.addColorStop(0.46, "rgba(245, 182, 66, 0.1)");
        glow.addColorStop(1, "rgba(245, 182, 66, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        const beams = [
          [-0.22, 0.06, 1.18, 0.035, 0.12],
          [-0.16, 0.16, 1.08, 0.025, 0.08],
          [0.08, -0.02, 0.86, 0.018, 0.07]
        ];
        for (const [startX, startY, length, thickness, alpha] of beams) {
          ctx.beginPath();
          ctx.moveTo(width * startX, height * startY);
          ctx.lineTo(width * (startX + length), height * (startY + 0.22));
          ctx.lineTo(width * (startX + length), height * (startY + 0.22 + thickness));
          ctx.lineTo(width * startX, height * (startY + thickness));
          ctx.closePath();
          ctx.fillStyle = `rgba(245, 182, 66, ${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      function drawIcon(cx, cy, size, includePadding = true) {
        const pad = includePadding ? size * 0.125 : 0;
        const box = size - pad * 2;
        const x = cx - box / 2;
        const y = cy - box / 2;

        fillRound(x, y, box, box, box * 0.2, "#111827");

        const beam = ctx.createLinearGradient(x, y, x + box, y + box);
        beam.addColorStop(0, "rgba(245, 182, 66, 0)");
        beam.addColorStop(0.42, "rgba(245, 182, 66, 0.95)");
        beam.addColorStop(0.62, "rgba(245, 182, 66, 0.42)");
        beam.addColorStop(1, "rgba(245, 182, 66, 0)");
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y + box * 0.12);
        ctx.lineTo(x + box, y + box * 0.42);
        ctx.lineTo(x + box, y + box * 0.58);
        ctx.lineTo(x, y + box * 0.28);
        ctx.closePath();
        ctx.fillStyle = beam;
        ctx.fill();
        ctx.restore();

        const panelX = x + box * 0.2;
        const panelY = y + box * 0.24;
        const panelW = box * 0.6;
        const panelH = box * 0.52;
        fillRound(panelX, panelY, panelW, panelH, box * 0.07, "#f8fafc");
        strokeRound(panelX, panelY, panelW, panelH, box * 0.07, "rgba(248,250,252,0.42)", Math.max(1, box * 0.018));

        ctx.fillStyle = "#dbe3ec";
        ctx.fillRect(panelX + box * 0.06, panelY + box * 0.11, panelW - box * 0.12, Math.max(1, box * 0.015));
        ctx.fillRect(panelX + box * 0.06, panelY + box * 0.25, panelW - box * 0.12, Math.max(1, box * 0.015));
        ctx.fillRect(panelX + box * 0.06, panelY + box * 0.39, panelW - box * 0.12, Math.max(1, box * 0.015));

        ctx.fillStyle = "#0f766e";
        fillRound(panelX + box * 0.06, panelY + box * 0.07, box * 0.16, box * 0.035, box * 0.012, "#0f766e");
        fillRound(panelX + box * 0.06, panelY + box * 0.21, box * 0.23, box * 0.035, box * 0.012, "#0f766e");
        fillRound(panelX + box * 0.06, panelY + box * 0.35, box * 0.18, box * 0.035, box * 0.012, "#0f766e");

        ctx.fillStyle = "#111827";
        for (const row of [0.07, 0.21, 0.35]) {
          for (const dot of [0.38, 0.48, 0.58]) {
            ctx.beginPath();
            ctx.arc(panelX + box * dot, panelY + box * row + box * 0.017, Math.max(1, box * 0.015), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      function drawMiniUi(x, y, scale = 1) {
        const w = 610 * scale;
        const h = 440 * scale;
        fillRound(x, y, w, h, 10 * scale, "#f6f8fb");
        strokeRound(x, y, w, h, 10 * scale, "#c9d5df");
        text("Sunbeam Cookie Jar", x + 22 * scale, y + 20 * scale, 18 * scale, "#17202a", 650);
        text("https://github.com", x + 22 * scale, y + 48 * scale, 12 * scale, "#607284", 500);
        fillRound(x + 22 * scale, y + 78 * scale, w - 44 * scale, 48 * scale, 8 * scale, "#ffffff");
        strokeRound(x + 22 * scale, y + 78 * scale, w - 44 * scale, 48 * scale, 8 * scale, "#d6e0e8");
        text("Site access granted", x + 36 * scale, y + 92 * scale, 13 * scale, "#213241", 650);
        fillRound(x + 22 * scale, y + 156 * scale, 360 * scale, 34 * scale, 6 * scale, "#ffffff");
        strokeRound(x + 22 * scale, y + 156 * scale, 360 * scale, 34 * scale, 6 * scale, "#cfd9e3");
        text("Name or domain", x + 38 * scale, y + 165 * scale, 12 * scale, "#7a8795", 500);
        const tableY = y + 214 * scale;
        fillRound(x + 22 * scale, tableY, w - 44 * scale, 184 * scale, 8 * scale, "#ffffff");
        strokeRound(x + 22 * scale, tableY, w - 44 * scale, 184 * scale, 8 * scale, "#d6e0e8");
        ctx.fillStyle = "#eef3f7";
        ctx.fillRect(x + 23 * scale, tableY + 1 * scale, w - 46 * scale, 34 * scale);
        for (let i = 0; i < 5; i += 1) {
          const rowY = tableY + 34 * scale + i * 30 * scale;
          ctx.strokeStyle = "#e3e9ef";
          ctx.beginPath();
          ctx.moveTo(x + 24 * scale, rowY);
          ctx.lineTo(x + w - 24 * scale, rowY);
          ctx.stroke();
          text(["_gh_sess", "_octo", "logged_in", "theme", "lcm_test"][i], x + 58 * scale, rowY + 8 * scale, 12 * scale, "#263645", 600);
          text("••••••••••••••", x + 180 * scale, rowY + 8 * scale, 12 * scale, "#263645", 700);
          text(i % 2 ? ".github.com" : "github.com", x + 320 * scale, rowY + 8 * scale, 12 * scale, "#263645", 500);
        }
      }

      function drawPromo() {
        drawBackground();
        if (width > 800) {
          text("Sunbeam Cookie Jar", 72, 72, 52, "#17202a", 800);
          text("A local-only cookie manager for developers", 76, 142, 24, "#3f566b", 600);
          drawIcon(482, 292, 230, false);
          drawMiniUi(width * 0.55, height * 0.2, 0.78);
        } else {
          text("Sunbeam Cookie Jar", 28, 30, 28, "#17202a", 800);
          text("Local-only cookie manager", 30, 70, 15, "#3f566b", 650);
          drawIcon(346, 76, 74, false);
          drawMiniUi(30, 118, 0.58);
        }
      }

      async function drawScreenshotComposite(title, subtitle, source, accent) {
        drawBackground();
        text(title, 78, 72, 46, "#17202a", 800);
        text(subtitle, 82, 136, 21, "#3f566b", 600, 760);

        const image = new Image();
        image.src = source;
        await image.decode();
        const panelW = 820;
        const panelH = 720;
        const panelX = 76;
        const panelY = 204;
        fillRound(panelX - 12, panelY - 12, panelW + 24, panelH + 24, 18, "rgba(255,255,255,0.7)");
        ctx.save();
        roundedRect(panelX, panelY, panelW, panelH, 8);
        ctx.clip();
        ctx.drawImage(image, panelX, panelY, panelW, panelH);
        ctx.restore();
        strokeRound(panelX, panelY, panelW, panelH, 8, "#c8d4df");

        drawIcon(1060, 220, 128, false);
        const cards = accent === "warning"
          ? [["Clear export warning", "Real values require confirmation"], ["Local Blob download", "No backend and no sync"], ["Redacted JSON", "Metadata without secrets"]]
          : [["Current-site scope", "Default export never means all cookies"], ["Masked values", "Reveal is session-only"], ["Import preview", "Confirm before overwrites"]];
        cards.forEach((card, index) => {
          const y = 370 + index * 104;
          fillRound(956, y, 250, 74, 8, "rgba(255,255,255,0.82)");
          strokeRound(956, y, 250, 74, 8, "#d4dde6");
          text(card[0], 976, y + 16, 17, "#17202a", 800);
          text(card[1], 976, y + 42, 13, "#587085", 600, 210);
        });
      }

      function drawFormats() {
        drawBackground();
        text("Choose the export shape that fits the job", 78, 72, 43, "#17202a", 800);
        text("Lossless JSON, redacted metadata, curl-ready headers, server Set-Cookie lines, Netscape cookies.txt, and CSV.", 82, 136, 20, "#3f566b", 600, 870);
        drawMiniUi(72, 232, 1.06);
        const formats = [
          ["Lossless JSON", "Full-fidelity backup"],
          ["Netscape cookies.txt", "Tool-compatible text"],
          ["Cookie Header", "Selected cookies only"],
          ["Set-Cookie lines", "Server-style output"],
          ["CSV", "Spreadsheet review"],
          ["Redacted JSON", "No secret values"]
        ];
        formats.forEach((format, index) => {
          const x = 760 + (index % 2) * 222;
          const y = 258 + Math.floor(index / 2) * 118;
          fillRound(x, y, 196, 86, 8, "rgba(255,255,255,0.86)");
          strokeRound(x, y, 196, 86, 8, "#d4dde6");
          text(format[0], x + 16, y + 18, 18, "#17202a", 800);
          text(format[1], x + 16, y + 48, 13, "#5b7186", 600);
        });
      }

      function drawImportPreview() {
        drawBackground();
        text("Preview imports before anything changes", 78, 72, 44, "#17202a", 800);
        text("Lossless JSON imports are validated, diffed, and blocked across domains unless you explicitly override.", 82, 136, 20, "#3f566b", 600, 850);
        drawMiniUi(76, 244, 0.9);
        const x = 698;
        const y = 232;
        fillRound(x, y, 470, 368, 10, "rgba(255,255,255,0.92)");
        strokeRound(x, y, 470, 368, 10, "#cdd8e3");
        text("Import preview", x + 28, y + 28, 27, "#17202a", 800);
        const rows = [
          ["CREATE", "theme", "example.test"],
          ["OVERWRITE", "session_id", "example.test"],
          ["PERMISSION NEEDED", "sso_token", ".example.test"],
          ["SKIPPED", "wrong-domain", "other.test"]
        ];
        rows.forEach((row, index) => {
          const rowY = y + 86 + index * 58;
          fillRound(x + 28, rowY, 414, 44, 6, "#f8fafc");
          const color = ["#116a73", "#9a5b00", "#9a5b00", "#991b1b"][index];
          text(row[0], x + 44, rowY + 13, 12, color, 800);
          text(row[1], x + 214, rowY + 12, 14, "#17202a", 700);
          text(row[2], x + 346, rowY + 12, 14, "#5a6f83", 600);
        });
        fillRound(x + 272, y + 310, 78, 34, 6, "#ffffff");
        strokeRound(x + 272, y + 310, 78, 34, 6, "#c9d2dd");
        text("Cancel", x + 291, y + 319, 12, "#17202a", 700);
        fillRound(x + 360, y + 310, 82, 34, 6, "#116a73");
        text("Apply", x + 384, y + 319, 12, "#ffffff", 800);
      }

      function drawPrivacy() {
        drawBackground();
        text("Built for local development work", 78, 72, 46, "#17202a", 800);
        text("No backend. No analytics. No tracking. No cloud sync. No automatic cookie export.", 82, 136, 21, "#3f566b", 600, 820);
        drawMiniUi(76, 244, 0.9);
        const items = [
          "Optional per-site access",
          "Cookie values masked by default",
          "Local settings only in storage",
          "Redacted export for safe sharing",
          "Explicit confirmation before real-value export"
        ];
        items.forEach((item, index) => {
          const x = 716;
          const y = 250 + index * 76;
          fillRound(x, y, 430, 54, 8, "rgba(255,255,255,0.88)");
          strokeRound(x, y, 430, 54, 8, "#d4dde6");
          ctx.fillStyle = "#116a73";
          ctx.beginPath();
          ctx.arc(x + 29, y + 27, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 23, y + 27);
          ctx.lineTo(x + 28, y + 32);
          ctx.lineTo(x + 36, y + 22);
          ctx.stroke();
          text(item, x + 58, y + 17, 17, "#17202a", 800);
        });
      }

      if (kind === "icon") {
        ctx.clearRect(0, 0, width, height);
        drawIcon(width / 2, height / 2, Math.min(width, height), true);
      } else if (kind === "promo") {
        drawPromo();
      } else if (kind === "screenshot") {
        await drawScreenshotComposite(data.title, data.subtitle, data.source, data.accent);
      } else if (kind === "formats") {
        drawFormats();
      } else if (kind === "import") {
        drawImportPreview();
      } else if (kind === "privacy") {
        drawPrivacy();
      }

      return canvas.toDataURL("image/png").split(",")[1];
    },
    { width, height, kind, data }
  );

  fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
  console.log(`Wrote ${path.relative(rootDir, outPath)}`);
}
