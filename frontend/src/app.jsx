/**
 * WA Sender — Professional Frontend
 * Fixed: Real QR from backend + Timer + Refresh button
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BACKEND_URL = "https://whatsapp-message-production-ad5d.up.railway.app";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseNumbers(raw) {
  return [...new Set(
    raw.split(/[\n,;]+/)
       .map(n => n.trim().replace(/\D/g, ""))
       .filter(n => n.length >= 10)
       .map(n => n.startsWith("91") ? n : `91${n}`)
  )];
}

// CSV parse — returns [{number, ...otherCols}]
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const numIdx = headers.findIndex(h => h.includes("number") || h.includes("phone") || h.includes("mobile") || h === "no");
  if (numIdx === -1) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const rawNum = cols[numIdx]?.replace(/\D/g, "") || "";
    if (rawNum.length < 10) return null;
    const number = rawNum.startsWith("91") ? rawNum : `91${rawNum}`;
    const extra = {};
    headers.forEach((h, i) => { if (i !== numIdx) extra[h] = cols[i] || ""; });
    return { number, ...extra };
  }).filter(Boolean);
}

// Replace {name}, {city} etc in message
function applyVars(msg, row) {
  return msg.replace(/\{(\w+)\}/g, (_, key) => row[key.toLowerCase()] ?? `{${key}}`);
}

function fmt(n) { return `+${n.slice(0,2)} ${n.slice(2,7)} ${n.slice(7)}`; }

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = {
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.79a19.79 19.79 0 01-3.07-8.67A2 2 0 012.41 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --bg:       #0e1117;
    --surface:  #161b22;
    --border:   #21262d;
    --border2:  #30363d;
    --text:     #e6edf3;
    --muted:    #7d8590;
    --green:    #3fb950;
    --green-dim:#1a4a2a;
    --green-bg: #0d2116;
    --red:      #f85149;
    --amber:    #d29922;
    --blue:     #388bfd;
    --radius:   10px;
    --font:     'DM Sans', sans-serif;
    --mono:     'DM Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
  textarea, input, button { font-family: var(--font); outline: none; }

  @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:translateY(0); } }
  @keyframes spin    { to   { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }

  .fade-in  { animation: fadeIn .35s ease forwards; }
  .slide-up { animation: slideUp .25s ease forwards; }
  .spin     { animation: spin .8s linear infinite; display:inline-flex; }
  .pulse    { animation: pulse 1.4s ease infinite; }

  .field {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: var(--radius);
    padding: 11px 14px;
    color: var(--text);
    font-size: 14px;
    transition: border-color .15s;
  }
  .field:focus { border-color: var(--green); }
  .field::placeholder { color: var(--muted); }

  .btn-primary {
    display: flex; align-items:center; justify-content:center; gap: 8px;
    width: 100%; padding: 12px 20px;
    background: var(--green);
    border: none; border-radius: var(--radius);
    color: #000; font-weight: 600; font-size: 14px;
    cursor: pointer; transition: all .15s;
  }
  .btn-primary:hover:not(:disabled) { background: #4ac162; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: .45; cursor: not-allowed; }

  .btn-ghost {
    display: flex; align-items:center; gap: 6px;
    padding: 7px 12px;
    background: none; border: 1px solid var(--border2);
    border-radius: 8px; color: var(--muted);
    font-size: 12px; cursor: pointer; transition: all .15s;
  }
  .btn-ghost:hover { color: var(--text); background: var(--surface); }

  .btn-danger {
    display: flex; align-items:center; gap: 8px;
    padding: 9px 18px;
    background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.3);
    border-radius: 8px; color: var(--red);
    font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s;
  }
  .btn-danger:hover { background: rgba(248,81,73,.18); }

  .tag {
    display:inline-flex; align-items:center;
    padding: 2px 8px; border-radius: 5px;
    font-size: 11px; font-family: var(--mono);
  }

  .log-row { animation: slideUp .2s ease forwards; }
  .log-row:hover { background: rgba(255,255,255,.02); }

  .upload-zone {
    width:100%; padding:20px;
    border: 1.5px dashed var(--border2);
    border-radius: var(--radius);
    background: var(--bg);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
    cursor:pointer; transition: border-color .15s, background .15s;
    color: var(--muted); font-size:13px; text-align:center;
  }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--green); background: var(--green-bg); color:var(--green); }
  .upload-zone input[type=file] { display:none; }

  .mode-toggle {
    display:flex; background:var(--bg); border:1px solid var(--border2);
    border-radius:8px; overflow:hidden; width:100%;
  }
  .mode-toggle button {
    flex:1; padding:8px 12px; border:none;
    font-size:12px; font-weight:500; cursor:pointer;
    transition: all .15s; font-family:var(--font);
    display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .mode-toggle button.active { background:var(--green); color:#000; }
  .mode-toggle button:not(.active) { background:none; color:var(--muted); }
  .mode-toggle button:not(.active):hover { color:var(--text); }
`;

// QR_EXPIRE seconds mein QR expire hota hai
const QR_EXPIRE = 60;

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  // QR state only
  const [qrImage, setQrImage]           = useState(null);
  const [qrLoading, setQrLoading]       = useState(false);
  const [qrError, setQrError]           = useState("");
  const [qrTimer, setQrTimer]           = useState(QR_EXPIRE);
  const [qrExpired, setQrExpired]       = useState(false);
  const [backendStatus, setBackendStatus] = useState(""); // live status from backend

  const pollRef        = useRef(null);
  const timerRef       = useRef(null);
  const qrPollRef      = useRef(null);
  const qrInitialized  = useRef(false);

  // Auth status poll
  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/status`);
        const data = await res.json();
        if (data.connected) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          clearInterval(qrPollRef.current);
          qrInitialized.current = false;
          onLogin(data.phone || "");
        }
      } catch {}
    }, 2000);
  }, [onLogin]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    clearInterval(qrPollRef.current);
  }, []);

  // ── QR FETCH ──
  const fetchQR = useCallback(async () => {
    // Agar already loading hai toh skip karo (double-call guard)
    if (qrInitialized.current && !qrExpired && !qrError) return;
    qrInitialized.current = true;

    setQrLoading(true);
    setQrError("");
    setQrExpired(false);
    setQrTimer(QR_EXPIRE);
    setQrImage(null);

    // ❌ reinit NAHI karenge — Chromium restart hoga toh aur time lagega
    // Pehle check karo — already connected toh seedha login
    try {
      const chk = await fetch(`${BACKEND_URL}/api/status`);
      const d = await chk.json();
      if (d.connected) { onLogin(d.phone || ""); return; }
    } catch {}

    // QR ready hone ka wait karo (max 60s) — status bhi dikhate raho
    const statusLabels = {
      initializing: "WhatsApp browser start ho raha hai...",
      qr_ready:     "QR ready hai, load ho raha hai...",
      disconnected: "Connecting...",
      "":           "Backend se connect ho raha hai...",
    };

    let got = false;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        // Status update karo (isse loading message meaningful hoga)
        const stRes = await fetch(`${BACKEND_URL}/api/status`);
        const stData = await stRes.json();
        setBackendStatus(statusLabels[stData.status] || stData.status);

        if (stData.connected) { onLogin(stData.phone || ""); return; }

        // QR try karo
        if (stData.hasQR) {
          const res = await fetch(`${BACKEND_URL}/api/qr`);
          if (res.ok) {
            const data = await res.json();
            if (data.qr) {
              setQrImage(data.qr);
              setQrLoading(false);
              setBackendStatus("");
              got = true;

              // Timer start karo
              clearInterval(timerRef.current);
              let t = QR_EXPIRE;
              timerRef.current = setInterval(() => {
                t--;
                setQrTimer(t);
                if (t <= 0) {
                  clearInterval(timerRef.current);
                  setQrExpired(true);
                  setQrImage(null);
                }
              }, 1000);

              // Auth poll start karo
              startPolling();
              break;
            }
          }
        }
      } catch {}
    }

    if (!got) {
      setQrLoading(false);
      setBackendStatus("");
      setQrError("QR generate nahi hua — Railway server slow hai, dobara try karo");
    }
  }, [startPolling, qrExpired, qrError, onLogin]);

  // Component mount pe auto fetch
  useEffect(() => {
    qrInitialized.current = false;
    fetchQR();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
      qrInitialized.current = false;
    };
  }, []);

  // Timer color
  const timerColor = qrTimer > 30 ? "var(--green)" : qrTimer > 10 ? "var(--amber)" : "var(--red)";

  return (
    <div style={{
      minHeight:"100vh", background:"var(--bg)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px", fontFamily:"var(--font)",
    }}>
      <style>{CSS}</style>

      <div className="fade-in" style={{ width:"100%", maxWidth:"380px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{
            width:52, height:52, background:"var(--green)", borderRadius:"14px",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 14px", color:"#000",
            boxShadow:"0 0 0 8px rgba(63,185,80,.08), 0 0 0 16px rgba(63,185,80,.04)",
          }}>{Icon.whatsapp}</div>
          <h1 style={{ fontSize:"22px", fontWeight:600, color:"var(--text)", letterSpacing:"-0.5px" }}>WhatsApp Sender</h1>
          <p style={{ color:"var(--muted)", fontSize:"13px", marginTop:"4px" }}>QR scan karke login karo</p>
        </div>

        {/* Card */}
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"14px", padding:"28px 24px",
          textAlign:"center",
        }}>
          <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"20px", lineHeight:1.7 }}>
            WhatsApp → <strong style={{color:"var(--text)"}}>Settings → Linked Devices → Link a Device</strong> → Camera se scan karo
          </p>

          {/* QR Box */}
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            padding:"12px", background:"#fff", borderRadius:"12px",
            border:"1px solid var(--border)",
            width:210, height:210,
          }}>
            {qrLoading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"0 8px" }}>
                <span className="spin" style={{ color:"#25d366", fontSize:28 }}>{Icon.refresh}</span>
                <span style={{ fontSize:11, color:"#888", fontFamily:"var(--mono)", textAlign:"center", lineHeight:1.5 }}>
                  {backendStatus || "Connect ho raha hai..."}
                </span>
              </div>
            )}

            {qrImage && !qrExpired && (
              <img src={qrImage} alt="QR Code"
                style={{ width:186, height:186, display:"block", imageRendering:"pixelated" }}
              />
            )}

            {qrExpired && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:36 }}>⏰</span>
                <span style={{ fontSize:12, color:"#555", fontWeight:600 }}>QR Expire Ho Gaya</span>
              </div>
            )}

            {qrError && !qrLoading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:10 }}>
                <span style={{ fontSize:28 }}>❌</span>
                <span style={{ fontSize:11, color:"#f85149", textAlign:"center" }}>{qrError}</span>
              </div>
            )}
          </div>

          {/* Timer */}
          {qrImage && !qrExpired && (
            <div style={{ marginTop:14, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span style={{ fontSize:12, color:"var(--muted)" }}>Expire hoga:</span>
              <span style={{ fontSize:14, fontWeight:700, fontFamily:"var(--mono)", color: timerColor }}>{qrTimer}s</span>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border2)" strokeWidth="2"/>
                <circle cx="8" cy="8" r="6" fill="none" stroke={timerColor} strokeWidth="2"
                  strokeDasharray={`${(qrTimer/QR_EXPIRE)*37.7} 37.7`}
                  strokeLinecap="round"
                  style={{ transform:"rotate(-90deg)", transformOrigin:"8px 8px", transition:"stroke-dasharray 1s linear" }}
                />
              </svg>
            </div>
          )}

          {/* Waiting indicator */}
          {qrImage && !qrExpired && (
            <div className="pulse" style={{ marginTop:12, fontSize:"12px", color:"var(--amber)", display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
              <span style={{ width:6, height:6, background:"var(--amber)", borderRadius:"50%", display:"inline-block" }}/>
              Scan ka intezaar hai...
            </div>
          )}

          {/* Refresh / Retry buttons */}
          {(qrExpired || qrError) && (
            <button className="btn-primary" onClick={()=>{ qrInitialized.current=false; fetchQR(); }} style={{ marginTop:18 }}>
              <span>{Icon.refresh}</span> Naya QR Generate Karo
            </button>
          )}

          {qrImage && !qrExpired && (
            <button className="btn-ghost" onClick={()=>{ qrInitialized.current=false; fetchQR(); }} style={{ margin:"14px auto 0", width:"auto" }}>
              {Icon.refresh} Refresh QR
            </button>
          )}
        </div>

        <p style={{ textAlign:"center", marginTop:"16px", fontSize:"11px", color:"var(--border2)" }}>
          Backend: {BACKEND_URL}
        </p>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn]             = useState(false);
  const [connectedPhone, setConnectedPhone] = useState("");
  const [activeTab, setActiveTab]           = useState("compose");
  const [inputMode, setInputMode]           = useState("custom"); // "custom" | "csv"
  const [numbersRaw, setNumbersRaw]         = useState("");
  const [csvRows, setCsvRows]               = useState([]);   // [{number, name, ...}]
  const [csvFileName, setCsvFileName]       = useState("");
  const [csvHeaders, setCsvHeaders]         = useState([]);
  const [message, setMessage]               = useState("");
  const [delay, setDelay]                   = useState(5);
  const [sending, setSending]               = useState(false);
  const [logs, setLogs]                     = useState([]);
  const [sessions, setSessions]             = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [drag, setDrag]                     = useState(false);
  const cancelRef = useRef(false);
  const logsRef   = useRef([]);
  const endRef    = useRef(null);
  const fileRef   = useRef(null);

  const parsedNums  = inputMode==="csv"
    ? csvRows.map(r=>r.number)
    : (numbersRaw ? parseNumbers(numbersRaw) : []);
  const sentCount   = logs.filter(l=>l.status==="sent").length;
  const failedCount = logs.filter(l=>l.status==="failed").length;
  const doneCount   = logs.filter(l=>l.status!=="sending").length;
  const progress    = parsedNums.length>0 ? Math.round((doneCount/parsedNums.length)*100) : 0;

  useEffect(()=>{ logsRef.current = logs; },[logs]);
  useEffect(()=>{ if(sending) endRef.current?.scrollIntoView({behavior:"smooth"}); },[logs,sending]);

  const addLog = (num,idx,status) => {
    setLogs(prev=>{
      const i = prev.findIndex(l=>l.num===num);
      const e = { num, idx, status, time: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) };
      if(i!==-1){ const u=[...prev]; u[i]=e; return u; }
      return [...prev,e];
    });
  };

  const finalize = (msg, nums, cancelled=false) => {
    const results = logsRef.current.map(l=>({
      ...l, status: l.status==="sending" ? "failed" : l.status
    }));
    setSessions(prev=>[{ id:Date.now(), date:new Date().toLocaleString("en-IN"), message:msg, numbers:nums, results, cancelled }, ...prev]);
    setSelectedSession(null);
  };

  const handleCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      if (rows.length === 0) { alert("CSV mein 'number'/'phone' column nahi mila ya data nahi hai"); return; }
      setCsvRows(rows);
      setCsvFileName(file.name);
      const hdrs = Object.keys(rows[0]).filter(k => k !== "number");
      setCsvHeaders(hdrs);
    };
    reader.readAsText(file);
  };

  const handleSend = async () => {
    if(!parsedNums.length||!message.trim()) return;
    setSending(true); cancelRef.current=false;
    setLogs([]); logsRef.current=[];
    const nums=[...parsedNums]; const msg=message;
    const rows = inputMode==="csv" ? [...csvRows] : null;

    for(let i=0;i<nums.length;i++){
      if(cancelRef.current) break;
      addLog(nums[i],i+1,"sending");
      // Random delay: delay ± 30%
      const jitter = delay * 0.3;
      const actualDelay = delay + (Math.random()*jitter*2 - jitter);
      await new Promise(r=>setTimeout(r, actualDelay*1000));
      try {
        const finalMsg = rows ? applyVars(msg, rows[i]) : msg;
        const res = await fetch(`${BACKEND_URL}/api/send`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({to:nums[i],message:finalMsg})
        });
        const data = await res.json();
        addLog(nums[i],i+1, data.success ? "sent" : "failed");
      } catch { addLog(nums[i],i+1,"failed"); }
    }

    setSending(false);
    finalize(msg,nums,cancelRef.current);
  };

  const handleCancel = () => { cancelRef.current=true; setSending(false); finalize(message,parsedNums,true); };
  const handleLogout = async () => {
    try { await fetch(`${BACKEND_URL}/api/logout`,{method:"POST"}); } catch {}
    setLoggedIn(false); setSending(false); cancelRef.current=true;
  };

  if(!loggedIn) return <LoginScreen onLogin={(ph)=>{ setConnectedPhone(ph); setLoggedIn(true); }}/>;

  const currentLog = logs.length>0 ? logs[logs.length-1] : null;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"var(--font)", color:"var(--text)" }}>
      <style>{CSS}</style>

      {/* TOPBAR */}
      <div style={{
        position:"sticky",top:0,zIndex:100,
        background:"rgba(14,17,23,.92)", backdropFilter:"blur(12px)",
        borderBottom:"1px solid var(--border)",
        padding:"0 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:54,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ color:"var(--green)", display:"flex" }}>{Icon.whatsapp}</div>
          <span style={{ fontWeight:600, fontSize:"15px" }}>WA Sender</span>
          <div style={{ display:"flex", alignItems:"center", gap:"5px",
            background:"var(--green-bg)", border:"1px solid rgba(63,185,80,.2)",
            padding:"2px 8px", borderRadius:"20px",
          }}>
            <span style={{ width:5,height:5,background:"var(--green)",borderRadius:"50%",display:"inline-block" }}/>
            <span style={{ fontSize:"10px", color:"var(--green)", fontFamily:"var(--mono)" }}>
              {connectedPhone ? `+91 ${connectedPhone.slice(-10)}` : "Connected"}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          {[["Numbers",parsedNums.length,"var(--text)"],["Sent",sentCount,"var(--green)"],["Failed",failedCount,"var(--red)"]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:"right" }}>
              <div style={{ fontSize:"14px", fontWeight:600, color:c, fontFamily:"var(--mono)", lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:"9px", color:"var(--muted)", marginTop:"1px" }}>{l}</div>
            </div>
          ))}
          <button className="btn-ghost" onClick={handleLogout} style={{ marginLeft:4 }}>
            {Icon.logout} Logout
          </button>
        </div>
      </div>

      {/* PROGRESS BAR */}
      {sending && (
        <div style={{ position:"sticky", top:54, zIndex:99, background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span className="spin" style={{ color:"var(--green)", fontSize:"13px" }}>{Icon.refresh}</span>
              <span style={{ fontSize:"12px", color:"var(--text)", fontWeight:500 }}>
                {currentLog?.status==="sending" ? `Sending to ${fmt(currentLog.num)}...` : "Starting..."}
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <span style={{ fontSize:"12px", color:"var(--muted)", fontFamily:"var(--mono)" }}>
                {doneCount}/{parsedNums.length} · {progress}%
              </span>
              <button className="btn-danger" onClick={handleCancel} style={{ padding:"5px 12px", fontSize:"12px" }}>
                {Icon.x} Cancel
              </button>
            </div>
          </div>
          <div style={{ background:"var(--border)", borderRadius:"4px", height:"3px", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:"4px", width:`${progress}%`, background:"linear-gradient(90deg, var(--green), #4ac162)", transition:"width .4s ease" }}/>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", background:"var(--surface)", padding:"0 20px" }}>
        {[["compose","Compose"],["history",`History${sessions.length>0?` (${sessions.length})`:""}`]].map(([t,label])=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{
            padding:"12px 4px", marginRight:"20px",
            background:"none", border:"none",
            borderBottom: activeTab===t ? "2px solid var(--green)" : "2px solid transparent",
            color: activeTab===t ? "var(--text)" : "var(--muted)",
            fontSize:"13px", fontWeight: activeTab===t ? 600 : 400,
            cursor:"pointer", transition:"color .15s", fontFamily:"var(--font)",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px" }}>

        {activeTab==="compose" && (
          <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>

            {/* ── INPUT MODE TOGGLE ── */}
            <div>
              <label style={{ display:"block", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>NUMBER INPUT MODE</label>
              <div className="mode-toggle">
                <button className={inputMode==="custom"?"active":""} onClick={()=>setInputMode("custom")}>
                  {Icon.edit} Manual / Custom
                </button>
                <button className={inputMode==="csv"?"active":""} onClick={()=>setInputMode("csv")}>
                  {Icon.upload} CSV Upload
                </button>
              </div>
            </div>

            {/* ── CUSTOM MODE ── */}
            {inputMode==="custom" && (
              <div className="slide-up">
                <label style={{ display:"block", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>PHONE NUMBERS</label>
                <textarea className="field" value={numbersRaw} onChange={e=>setNumbersRaw(e.target.value)}
                  placeholder={"9876543210\n9123456789, 8001234567"} rows={4}
                  style={{ resize:"vertical", lineHeight:1.7, fontFamily:"var(--mono)", fontSize:"13px" }}
                />
                {parsedNums.length>0 && (
                  <div style={{ marginTop:"10px" }}>
                    <span style={{ fontSize:"11px", color:"var(--green)" }}>✓ {parsedNums.length} number{parsedNums.length>1?"s":""} detected</span>
                    <div style={{ marginTop:"8px", display:"flex", flexWrap:"wrap", gap:"5px" }}>
                      {parsedNums.slice(0,20).map((n,i)=>(
                        <span key={i} className="tag" style={{ background:"var(--green-bg)", border:"1px solid rgba(63,185,80,.25)", color:"var(--green)" }}>+{n}</span>
                      ))}
                      {parsedNums.length>20 && <span className="tag" style={{ background:"var(--surface)", border:"1px solid var(--border2)", color:"var(--muted)" }}>+{parsedNums.length-20} more</span>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CSV MODE ── */}
            {inputMode==="csv" && (
              <div className="slide-up">
                <label style={{ display:"block", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>CSV FILE</label>

                {!csvRows.length ? (
                  <label
                    className={`upload-zone${drag?" drag":""}`}
                    onDragOver={e=>{e.preventDefault();setDrag(true);}}
                    onDragLeave={()=>setDrag(false)}
                    onDrop={e=>{e.preventDefault();setDrag(false);handleCSV(e.dataTransfer.files[0]);}}
                  >
                    <input type="file" accept=".csv" ref={fileRef} onChange={e=>handleCSV(e.target.files[0])}/>
                    <span style={{fontSize:24}}>{Icon.upload}</span>
                    <span style={{fontWeight:500}}>CSV file drag karo ya click karo</span>
                    <span style={{fontSize:"11px", color:"var(--muted)"}}>Column chahiye: <code style={{background:"var(--surface)",padding:"1px 5px",borderRadius:4,fontSize:11}}>number</code> (baaki optional: name, city, etc.)</span>
                  </label>
                ) : (
                  <div style={{ background:"var(--bg)", border:"1px solid var(--border2)", borderRadius:10, padding:"12px 14px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{fontSize:18}}>📄</span>
                        <div>
                          <div style={{fontSize:13, color:"var(--text)", fontWeight:500}}>{csvFileName}</div>
                          <div style={{fontSize:11, color:"var(--green)"}}>✓ {csvRows.length} contacts loaded</div>
                        </div>
                      </div>
                      <button className="btn-ghost" style={{color:"var(--red)", borderColor:"rgba(248,81,73,.3)"}}
                        onClick={()=>{setCsvRows([]);setCsvFileName("");setCsvHeaders([]);if(fileRef.current)fileRef.current.value="";}}>
                        {Icon.trash} Clear
                      </button>
                    </div>
                    {csvHeaders.length>0 && (
                      <div style={{marginTop:10, display:"flex", flexWrap:"wrap", gap:5}}>
                        <span style={{fontSize:11, color:"var(--muted)", marginRight:4}}>Columns:</span>
                        {["number",...csvHeaders].map(h=>(
                          <span key={h} className="tag" style={{background:"var(--surface)", border:"1px solid var(--border2)", color:"var(--muted)"}}>
                            {"{"+h+"}"}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Preview first 3 rows */}
                    <div style={{marginTop:10, borderTop:"1px solid var(--border)", paddingTop:8}}>
                      <div style={{fontSize:11, color:"var(--muted)", marginBottom:5}}>Preview:</div>
                      {csvRows.slice(0,3).map((r,i)=>(
                        <div key={i} style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--text)", padding:"3px 0"}}>
                          {fmt(r.number)}{csvHeaders.length>0 ? " · "+csvHeaders.map(h=>`${h}: ${r[h]}`).join(", ") : ""}
                        </div>
                      ))}
                      {csvRows.length>3 && <div style={{fontSize:11,color:"var(--muted)"}}>...aur {csvRows.length-3} contacts</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MESSAGE ── */}
            <div>
              <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>
                <span>MESSAGE</span>
                <span style={{ fontFamily:"var(--mono)" }}>{message.length} chars</span>
              </label>
              <textarea className="field" value={message} onChange={e=>setMessage(e.target.value)}
                placeholder={inputMode==="csv" && csvHeaders.length>0
                  ? `Namsate {name}, aapka order {city} se dispatch ho gaya!`
                  : "Apna message yahan likho..."}
                rows={6}
                style={{ resize:"vertical", lineHeight:1.75, fontSize:"14px" }}
              />
              {inputMode==="csv" && csvHeaders.length>0 && (
                <div style={{marginTop:6, display:"flex", flexWrap:"wrap", gap:5, alignItems:"center"}}>
                  <span style={{fontSize:11, color:"var(--muted)"}}>Variables use karo:</span>
                  {csvHeaders.map(h=>(
                    <button key={h} onClick={()=>setMessage(m=>m+`{${h}}`)}
                      className="tag" style={{
                        background:"var(--surface)", border:"1px solid var(--border2)",
                        color:"var(--blue)", cursor:"pointer", fontSize:11,
                        transition:"border-color .15s",
                      }}>
                      +{"{"+h+"}"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── DELAY SLIDER ── */}
            <div>
              <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>
                <span>DELAY BETWEEN MESSAGES</span>
                <span style={{ fontFamily:"var(--mono)", color:"var(--text)", background:"var(--surface)", border:"1px solid var(--border2)", padding:"2px 8px", borderRadius:6, fontSize:12 }}>
                  ~{delay}s <span style={{color:"var(--muted)", fontWeight:400}}>(±30% random)</span>
                </span>
              </label>
              <input type="range" min={1} max={30} value={delay} onChange={e=>setDelay(Number(e.target.value))}
                style={{ width:"100%", accentColor:"var(--green)", cursor:"pointer", height:"4px" }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"var(--muted)", marginTop:"6px" }}>
                <span style={{color: delay<=3 ? "var(--red)" : "var(--muted)"}}>1s · ban risk ⚠️</span>
                <span style={{color: delay>=8 && delay<=15 ? "var(--green)" : "var(--muted)"}}>8–15s · safe ✓</span>
                <span>30s · safest</span>
              </div>
              {delay <= 3 && (
                <div style={{marginTop:8, fontSize:12, color:"var(--red)", background:"rgba(248,81,73,.08)", border:"1px solid rgba(248,81,73,.2)", borderRadius:7, padding:"7px 12px"}}>
                  ⚠️ Bahut kam delay hai — WhatsApp ban kar sakta hai
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={handleSend} disabled={!parsedNums.length||!message.trim()||sending}>
              {Icon.send} Send to {parsedNums.length} Contact{parsedNums.length!==1?"s":""}
            </button>

            {logs.length>0 && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", overflow:"hidden" }}>
                <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"12px", fontWeight:500 }}>Live Log</span>
                  <span style={{ fontSize:"11px", color:"var(--muted)", fontFamily:"var(--mono)" }}>{sentCount}✅ {failedCount}❌</span>
                </div>
                <div style={{ maxHeight:240, overflowY:"auto", padding:"8px" }}>
                  {logs.map((log,i)=>(
                    <div key={i} className="log-row" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:"7px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"10px", color:"var(--muted)", fontFamily:"var(--mono)", minWidth:"22px" }}>#{log.idx}</span>
                        <span style={{ fontSize:"13px", fontFamily:"var(--mono)", color:"var(--text)" }}>{fmt(log.num)}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        {log.status==="sending" && <span className="spin" style={{color:"var(--amber)"}}>{Icon.refresh}</span>}
                        <span style={{ fontSize:"11px", fontFamily:"var(--mono)", color: log.status==="sent"?"var(--green)":log.status==="failed"?"var(--red)":"var(--amber)" }}>
                          {log.status==="sent"?"Sent":log.status==="failed"?"Failed":"Sending..."}
                        </span>
                        <span style={{ fontSize:"10px", color:"var(--muted)" }}>{log.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef}/>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab==="history" && (
          <div className="fade-in">
            {sessions.length===0 ? (
              <div style={{ textAlign:"center", padding:"80px 20px", color:"var(--muted)" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>📭</div>
                <div style={{ fontSize:"15px", fontWeight:500, color:"var(--text)", marginBottom:"6px" }}>Koi history nahi</div>
                <div style={{ fontSize:"13px" }}>Pehle kuch messages bhejo</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {sessions.map(s=>{
                  const sent = s.results.filter(r=>r.status==="sent").length;
                  const failed = s.results.filter(r=>r.status==="failed").length;
                  return (
                    <div key={s.id} onClick={()=>setSelectedSession(s)} style={{
                      background:"var(--surface)", border:"1px solid var(--border)",
                      borderRadius:"10px", padding:"14px 16px", cursor:"pointer", transition:"border-color .15s",
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                        <span style={{ fontSize:"11px", color:"var(--muted)", fontFamily:"var(--mono)" }}>{s.date}</span>
                        <div style={{ display:"flex", gap:"8px", fontSize:"11px", fontFamily:"var(--mono)" }}>
                          <span style={{color:"var(--green)"}}>✓{sent}</span>
                          {failed>0 && <span style={{color:"var(--red)"}}>✕{failed}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:"13px", color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.message}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
