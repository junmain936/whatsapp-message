/**
 * WA Sender — Backend
 * Stack: Node.js + Express + whatsapp-web.js + Supabase Session
 * Deploy: Railway.app
 *
 * Environment Variables:
 *   SUPABASE_URL   = https://xxxx.supabase.co
 *   SUPABASE_KEY   = your-service-role-key
 *   SUPABASE_BUCKET= wa-session
 *   PORT           = (auto set by Railway)
 */

const express = require("express");
const cors    = require("cors");
const qrcode  = require("qrcode");
const fs      = require("fs");
const path    = require("path");
const { createClient }      = require("@supabase/supabase-js");
const { Client, RemoteAuth } = require("whatsapp-web.js");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── SUPABASE SETUP ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const BUCKET = process.env.SUPABASE_BUCKET || "wa-session";

// ─── SUPABASE STORE ───────────────────────────────────────────────────────────
class SupabaseStore {
  async sessionExists({ session }) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list("", { search: `${session}.zip` });
    return !!(data && data.length > 0);
  }

  async save({ session }) {
    const zipPath = path.join(
      process.cwd(),
      `.wwebjs_auth`,
      `${session}.zip`
    );
    if (!fs.existsSync(zipPath)) return;

    const fileBuffer = fs.readFileSync(zipPath);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${session}.zip`, fileBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (error) console.error("[Supabase] Save error:", error.message);
    else console.log("[Supabase] Session saved");
  }

  async extract({ session }) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${session}.zip`);

    if (error || !data) {
      console.log("[Supabase] No session found, fresh login needed");
      return;
    }

    const authDir = path.join(process.cwd(), `.wwebjs_auth`);
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const zipPath = path.join(authDir, `${session}.zip`);
    const arrayBuffer = await data.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));
    console.log("[Supabase] Session downloaded");
  }

  async delete({ session }) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([`${session}.zip`]);
    if (error) console.error("[Supabase] Delete error:", error.message);
    else console.log("[Supabase] Session deleted");
  }
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let waClient       = null;
let clientStatus   = "disconnected";
let currentQR      = null;
let connectedPhone = "";

// ─── CHROME PATH DETECT ───────────────────────────────────────────────────────
function getChromePath() {
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      console.log("[Chrome] Found at:", p);
      return p;
    }
  }
  console.log("[Chrome] Using puppeteer bundled chrome");
  return undefined;
}

// ─── WA CLIENT INIT ───────────────────────────────────────────────────────────
function initClient() {
  if (waClient) {
    waClient.destroy().catch(() => {});
  }

  clientStatus = "initializing";
  currentQR    = null;
  waClient     = null;

  const chromePath = getChromePath();

  const client = new Client({
    authStrategy: new RemoteAuth({
      store: new SupabaseStore(),
      backupSyncIntervalMs: 60000,
    }),
    puppeteer: {
      headless: true,
      executablePath: chromePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
  });

  client.on("qr", async (qr) => {
    clientStatus = "qr_ready";
    try { currentQR = await qrcode.toDataURL(qr); } catch {}
    console.log("[WA] QR ready");
  });

  client.on("ready", () => {
    clientStatus   = "connected";
    currentQR      = null;
    connectedPhone = client.info?.wid?.user || "";
    console.log("[WA] Connected:", connectedPhone);
  });

  client.on("remote_session_saved", () => {
    console.log("[WA] Session synced to Supabase ✓");
  });

  client.on("auth_failure", (msg) => {
    clientStatus = "disconnected";
    console.error("[WA] Auth failed:", msg);
  });

  client.on("disconnected", (reason) => {
    clientStatus   = "disconnected";
    connectedPhone = "";
    console.log("[WA] Disconnected:", reason);
  });

  client.initialize().catch((err) => {
    clientStatus = "disconnected";
    console.error("[WA] Init error:", err.message);
  });

  waClient = client;
}

// Server start pe auto-init
initClient();

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "WA Sender Backend" });
});

app.get("/api/status", (req, res) => {
  res.json({
    connected: clientStatus === "connected",
    status:    clientStatus,
    phone:     connectedPhone,
    hasQR:     !!currentQR,
  });
});

app.get("/api/qr", (req, res) => {
  if (!currentQR) {
    return res.status(404).json({ error: "QR abhi ready nahi, thoda wait karo" });
  }
  res.json({ qr: currentQR });
});

// Pairing code request
app.post("/api/request-code", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number chahiye" });

  const cleanPhone = phone.replace(/\D/g, "");

  if (clientStatus === "connected") {
    return res.status(400).json({ error: "Pehle se connected hai" });
  }

  initClient();

  // pupPage ready hone ka wait karo (max 60 sec)
  let waited = 0;
  while (waited < 60000) {
    await new Promise((r) => setTimeout(r, 1000));
    waited += 1000;

    if (waClient && waClient.pupPage && !waClient.pupPage.isClosed()) {
      console.log("[WA] pupPage ready after", waited, "ms");
      break;
    }
  }

  if (!waClient || !waClient.pupPage || waClient.pupPage.isClosed()) {
    return res.status(500).json({
      error: "Browser ready nahi hua, thoda wait karke dobara try karo",
    });
  }

  try {
    const code = await waClient.requestPairingCode(cleanPhone);
    console.log("[WA] Pairing code generated");
    res.json({ code: code.replace(/-/g, "") });
  } catch (err) {
    console.error("[WA] Pairing error:", err.message);
    res.status(500).json({ error: "Code nahi mila: " + err.message });
  }
});

// Send message
app.post("/api/send", async (req, res) => {
  const { to, message } = req.body;

  if (clientStatus !== "connected") {
    return res.status(401).json({ error: "WhatsApp connected nahi hai" });
  }
  if (!to || !message) {
    return res.status(400).json({ error: "to aur message dono chahiye" });
  }

  const cleanNumber = to.replace(/\D/g, "");
  const chatId      = `${cleanNumber}@c.us`;

  try {
    const isRegistered = await waClient.isRegisteredUser(chatId);
    if (!isRegistered) {
      return res.status(400).json({
        error: "Number WhatsApp pe registered nahi hai",
        to,
      });
    }

    await waClient.sendMessage(chatId, message);
    console.log(`[WA] Sent → ${cleanNumber}`);
    res.json({ success: true, to: cleanNumber });
  } catch (err) {
    console.error(`[WA] Send error → ${cleanNumber}:`, err.message);
    res.status(500).json({ error: err.message, to: cleanNumber });
  }
});

// Logout
app.post("/api/logout", async (req, res) => {
  try {
    if (waClient) {
      await waClient.logout();
      await waClient.destroy();
    }
    await supabase.storage.from(BUCKET).remove(["RemoteAuth.zip"]);

    clientStatus   = "disconnected";
    connectedPhone = "";
    currentQR      = null;
    waClient       = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-init
app.post("/api/reinit", (req, res) => {
  initClient();
  res.json({ success: true, message: "Reinitializing..." });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Port ${PORT} pe chal raha hai`);
  console.log(`[Supabase] Bucket: ${BUCKET}`);
  console.log(`[Chrome] Path: ${getChromePath() || "puppeteer bundled"}`);
});
