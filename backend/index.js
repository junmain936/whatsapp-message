/**
 * WA Sender — Backend
 * Stack: Node.js + Express + whatsapp-web.js + Supabase Session
 * Deploy: Render.com (Free tier, no disk needed!)
 *
 * Environment Variables (Render pe set karo):
 *   SUPABASE_URL   = https://xxxx.supabase.co
 *   SUPABASE_KEY   = your-service-role-key
 *   SUPABASE_BUCKET= wa-session  (Storage bucket naam)
 *   PORT           = 3001 (optional, Render auto set karta hai)
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

// ─── SUPABASE STORE (RemoteAuth ke liye) ─────────────────────────────────────
// whatsapp-web.js RemoteAuth ek custom store accept karta hai
// Hum Supabase Storage ko store ki tarah use karenge
class SupabaseStore {
  async sessionExists({ session }) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list("", { search: `${session}.zip` });
    return !!(data && data.length > 0);
  }

  async save({ session }) {
    // whatsapp-web.js RemoteAuth session zip banata hai .wwebjs_auth/<session>.zip
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

    // Zip ko local mein extract karo
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

// ─── WA CLIENT INIT ───────────────────────────────────────────────────────────
function initClient() {
  if (waClient) {
    waClient.destroy().catch(() => {});
  }

  clientStatus = "initializing";
  currentQR    = null;

  waClient = new Client({
    authStrategy: new RemoteAuth({
      store:        new SupabaseStore(),
      backupSyncIntervalMs: 60000, // Har 1 min mein Supabase sync
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
  });

  // QR event
  waClient.on("qr", async (qr) => {
    clientStatus = "qr_ready";
    try { currentQR = await qrcode.toDataURL(qr); } catch {}
    console.log("[WA] QR ready");
  });

  // Ready
  waClient.on("ready", () => {
    clientStatus   = "connected";
    currentQR      = null;
    connectedPhone = waClient.info?.wid?.user || "";
    console.log("[WA] Connected:", connectedPhone);
  });

  // Remote session saved to Supabase
  waClient.on("remote_session_saved", () => {
    console.log("[WA] Session synced to Supabase ✓");
  });

  // Auth failure
  waClient.on("auth_failure", (msg) => {
    clientStatus = "disconnected";
    console.error("[WA] Auth failed:", msg);
  });

  // Disconnected
  waClient.on("disconnected", (reason) => {
    clientStatus   = "disconnected";
    connectedPhone = "";
    console.log("[WA] Disconnected:", reason);
  });

  waClient.initialize().catch((err) => {
    clientStatus = "disconnected";
    console.error("[WA] Init error:", err.message);
  });
}

// Server start pe auto-init (session Supabase se load hogi)
initClient();

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health / ping
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "WA Sender Backend" });
});

// Status
app.get("/api/status", (req, res) => {
  res.json({
    connected: clientStatus === "connected",
    status:    clientStatus,
    phone:     connectedPhone,
    hasQR:     !!currentQR,
  });
});

// QR image
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

  // Client ready hone ka wait karo
  let waited = 0;
  while (clientStatus === "initializing" && waited < 15000) {
    await new Promise((r) => setTimeout(r, 500));
    waited += 500;
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

// Logout + Supabase session delete
app.post("/api/logout", async (req, res) => {
  try {
    if (waClient) {
      await waClient.logout();
      await waClient.destroy();
    }
    // Supabase se bhi session hatao
    await supabase.storage.from(BUCKET).remove(["RemoteAuth.zip"]);

    clientStatus   = "disconnected";
    connectedPhone = "";
    currentQR      = null;
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
});
