/**
 * WA Sender — Professional Frontend
 * Connect to your backend: set BACKEND_URL below
 * Backend runs on Render/Railway with whatsapp-web.js
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BACKEND_URL = "https://your-backend.onrender.com"; // <-- apna URL yahan

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseNumbers(raw) {
  return [...new Set(
    raw.split(/[\n,;]+/)
       .map(n => n.trim().replace(/\D/g, ""))
       .filter(n => n.length >= 10)
       .map(n => n.startsWith("91") ? n : `91${n}`)
  )];
}

function fmt(n) { return `+${n.slice(0,2)} ${n.slice(2,7)} ${n.slice(7)}`; }

// ─── ICONS (inline SVG) ──────────────────────────────────────────────────────
const Icon = {
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.79a19.79 19.79 0 01-3.07-8.67A2 2 0 012.41 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
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

  /* Animations */
  @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:translateY(0); } }
  @keyframes spin    { to   { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes shimmer { 0%{background-position:-200%} 100%{background-position:200%} }

  .fade-in  { animation: fadeIn .35s ease forwards; }
  .slide-up { animation: slideUp .25s ease forwards; }
  .spin     { animation: spin .8s linear infinite; display:inline-flex; }
  .pulse    { animation: pulse 1.4s ease infinite; }

  /* Inputs */
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

  /* Buttons */
  .btn-primary {
    display: flex; align-items:center; justify-content:center; gap: 8px;
    width: 100%; padding: 12px 20px;
    background: var(--green);
    border: none; border-radius: var(--radius);
    color: #000; font-weight: 600; font-size: 14px;
    cursor: pointer; transition: all .15s;
  }
  .btn-primary:hover:not(:disabled) { background: #4ac162; transform: translateY(-1px); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: .45; cursor: not-allowed; }

  .btn-ghost {
    display: flex; align-items:center; gap: 6px;
    padding: 7px 12px;
    background: none; border: 1px solid var(--border2);
    border-radius: 8px; color: var(--muted);
    font-size: 12px; cursor: pointer; transition: all .15s;
  }
  .btn-ghost:hover { color: var(--text); border-color: var(--border2); background: var(--surface); }

  .btn-danger {
    display: flex; align-items:center; gap: 8px;
    padding: 9px 18px;
    background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.3);
    border-radius: 8px; color: var(--red);
    font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s;
  }
  .btn-danger:hover { background: rgba(248,81,73,.18); }

  /* Tag */
  .tag {
    display:inline-flex; align-items:center;
    padding: 2px 8px; border-radius: 5px;
    font-size: 11px; font-family: var(--mono);
  }

  /* Log row */
  .log-row { animation: slideUp .2s ease forwards; }
  .log-row:hover { background: rgba(255,255,255,.02); }
`;

// ─── QR PLACEHOLDER ──────────────────────────────────────────────────────────
function QRCode({ value }) {
  const p = [[1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,0],[1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,0,1],[1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,1,0],[1,0,1,1,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1,0,1],[1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1,1,0],[1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1,0,0],[1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,1],[1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,0,1,1,0,0],[0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,1,1],[1,1,0,1,0,1,1,1,1,0,1,0,0,1,1,0,1,1,0,0,1],[0,0,1,0,1,0,0,0,0,1,0,1,1,0,0,1,0,0,1,1,0],[1,1,1,0,1,1,1,0,1,1,0,0,1,0,1,1,1,0,0,1,1],[0,0,0,0,0,0,0,0,1,0,1,1,0,1,0,0,1,0,1,0,0],[1,1,1,1,1,1,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0],[1,0,0,0,0,0,1,0,1,0,1,0,0,1,0,1,1,0,1,0,1],[1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,0,0,1,1,1,0],[1,0,1,1,1,0,1,0,1,0,1,1,0,1,0,1,0,0,0,0,1],[1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,1,1,1,0,1,0],[1,0,0,0,0,0,1,0,1,1,0,1,0,0,0,1,0,0,1,0,1],[1,1,1,1,1,1,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0]];
  const cells = [];
  p.forEach((row,r)=>row.forEach((v,c)=>{ if(v) cells.push({r,c}); }));
  return (
    <svg width="180" height="180" viewBox="0 0 23 23" style={{imageRendering:"pixelated",display:"block"}}>
      <rect width="23" height="23" fill="white"/>
      <rect x="1" y="1" width="21" height="21" fill="white"/>
      {cells.map(({r,c},i)=><rect key={i} x={c+1} y={r+1} width="1" height="1" fill="#0d1117"/>)}
    </svg>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode]       = useState("code"); // "qr" | "code"
  const [phone, setPhone]     = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrDone, setQrDone]   = useState(false);
  const pollRef = useRef(null);

  const cleanPhone = phone.replace(/\D/g,"");

  // Poll backend for auth status
  const startPolling = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/status`);
        const data = await res.json();
        if (data.connected) {
          clearInterval(pollRef.current);
          onLogin(data.phone || cleanPhone);
        }
      } catch {}
    }, 2000);
  }, [cleanPhone, onLogin]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // Request pairing code from backend
  const handleRequestCode = async () => {
    if (cleanPhone.length < 10) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}` }),
      });
      const data = await res.json();
      if (data.code) { setPairingCode(data.code); setStep(2); startPolling(); }
      else setError(data.error || "Code nahi mila, retry karo");
    } catch {
      setError("Backend se connect nahi ho paya. Check karo server chal raha hai?");
    }
    setLoading(false);
  };

  // QR flow
  const handleQRReady = () => {
    setQrScanning(true);
    startPolling();
    setTimeout(() => { setQrDone(true); }, 3000); // demo; real: polling will fire
  };

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const formatCode = (c) => c ? `${c.slice(0,4)}-${c.slice(4,8)}` : "";

  return (
    <div style={{
      minHeight:"100vh", background:"var(--bg)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px", fontFamily:"var(--font)",
    }}>
      <style>{CSS}</style>

      <div className="fade-in" style={{ width:"100%", maxWidth:"400px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{
            width:52, height:52, background:"var(--green)", borderRadius:"14px",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 14px", color:"#000",
            boxShadow:"0 0 0 8px rgba(63,185,80,.08), 0 0 0 16px rgba(63,185,80,.04)",
          }}>{Icon.whatsapp}</div>
          <h1 style={{ fontSize:"22px", fontWeight:600, color:"var(--text)", letterSpacing:"-0.5px" }}>WhatsApp Sender</h1>
          <p style={{ color:"var(--muted)", fontSize:"13px", marginTop:"4px" }}>Login karke shuru karo</p>
        </div>

        {/* Card */}
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"14px", overflow:"hidden",
        }}>
          {/* Mode tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
            {[["code","Phone Number"],["qr","QR Code"]].map(([m,label])=>(
              <button key={m} onClick={()=>{setMode(m);setStep(1);setError("");setPairingCode("");clearInterval(pollRef.current);}}
                style={{
                  flex:1, padding:"13px",
                  background: mode===m ? "rgba(63,185,80,.06)" : "none",
                  border:"none",
                  borderBottom: mode===m ? "2px solid var(--green)" : "2px solid transparent",
                  color: mode===m ? "var(--green)" : "var(--muted)",
                  fontSize:"13px", fontWeight: mode===m ? 600 : 400,
                  cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
                }}
              >{label}</button>
            ))}
          </div>

          <div style={{ padding:"24px" }}>

            {/* ── PHONE CODE MODE ── */}
            {mode === "code" && (
              <div>
                {step === 1 && (
                  <div className="slide-up">
                    <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"16px", lineHeight:1.6 }}>
                      Apna WhatsApp number dalo. Ek pairing code milega jo WhatsApp pe enter karna hoga.
                    </p>
                    <div style={{ position:"relative", marginBottom:"12px" }}>
                      <span style={{
                        position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)",
                        color:"var(--muted)", fontSize:"13px", fontFamily:"var(--mono)",
                      }}>+91</span>
                      <input className="field" type="tel" value={phone}
                        onChange={e=>setPhone(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&handleRequestCode()}
                        placeholder="9876543210"
                        style={{ paddingLeft:"44px", fontFamily:"var(--mono)" }}
                      />
                    </div>
                    {error && <p style={{fontSize:"12px",color:"var(--red)",marginBottom:"12px"}}>{error}</p>}
                    <button className="btn-primary" onClick={handleRequestCode}
                      disabled={cleanPhone.length<10||loading}>
                      {loading ? <span className="spin">{Icon.refresh}</span> : Icon.phone}
                      {loading ? "Code Maang Rahe Hain..." : "Code Lo"}
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="slide-up" style={{ textAlign:"center" }}>
                    <div style={{
                      width:40,height:40,background:"var(--green-bg)",borderRadius:"10px",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      margin:"0 auto 12px",fontSize:"20px",
                    }}>🔑</div>
                    <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"16px", lineHeight:1.6 }}>
                      WhatsApp kholо → <strong style={{color:"var(--text)"}}>Settings → Linked Devices → Link a Device → Link with phone number</strong> → yeh code enter karo:
                    </p>

                    {/* Code display */}
                    <div style={{
                      background:"var(--bg)", border:"1px solid var(--border2)",
                      borderRadius:"10px", padding:"18px 20px", marginBottom:"14px",
                      position:"relative",
                    }}>
                      <div style={{
                        fontSize:"28px", fontWeight:500, fontFamily:"var(--mono)",
                        color:"var(--green)", letterSpacing:"6px",
                      }}>
                        {formatCode(pairingCode) || <span className="pulse" style={{color:"var(--muted)"}}>••••-••••</span>}
                      </div>
                      {pairingCode && (
                        <button onClick={copyCode} style={{
                          position:"absolute", top:"10px", right:"10px",
                          background:"none", border:"none",
                          color: copied ? "var(--green)" : "var(--muted)",
                          cursor:"pointer", display:"flex", alignItems:"center", gap:"4px",
                          fontSize:"11px", transition:"color .15s",
                        }}>
                          {copied ? Icon.check : Icon.copy} {copied?"Copied!":"Copy"}
                        </button>
                      )}
                    </div>

                    <div className="pulse" style={{fontSize:"12px",color:"var(--amber)",marginBottom:"16px",display:"flex",alignItems:"center",gap:"6px",justifyContent:"center"}}>
                      <span style={{width:6,height:6,background:"var(--amber)",borderRadius:"50%",display:"inline-block"}}/>
                      WhatsApp confirm hone ka intezaar...
                    </div>

                    <button className="btn-ghost" onClick={()=>{setStep(1);clearInterval(pollRef.current);setPairingCode("");}}>
                      ← Wapas
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── QR MODE ── */}
            {mode === "qr" && (
              <div className="slide-up" style={{ textAlign:"center" }}>
                <p style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"16px", lineHeight:1.6 }}>
                  WhatsApp → Settings → Linked Devices → Link a Device → Camera se scan karo
                </p>
                <div style={{
                  display:"inline-block", padding:"12px",
                  background:"#fff", borderRadius:"12px",
                  position:"relative", overflow:"hidden",
                  border:"1px solid var(--border)",
                }}>
                  <QRCode />
                  {qrScanning && !qrDone && (
                    <div style={{
                      position:"absolute",inset:0,background:"rgba(14,17,23,.8)",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      borderRadius:"10px",
                    }}>
                      <span className="spin" style={{color:"var(--green)",fontSize:"24px",marginBottom:"8px"}}>{Icon.refresh}</span>
                      <span className="pulse" style={{fontSize:"11px",color:"var(--green)",fontFamily:"var(--mono)"}}>Connecting...</span>
                    </div>
                  )}
                  {qrDone && (
                    <div style={{
                      position:"absolute",inset:0,background:"rgba(63,185,80,.15)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      borderRadius:"10px",fontSize:"44px",
                    }}>✅</div>
                  )}
                </div>
                {!qrScanning && (
                  <button className="btn-primary" onClick={handleQRReady} style={{marginTop:"16px"}}>
                    QR Scan Kar Liya ✓
                  </button>
                )}
                {qrScanning && !qrDone && (
                  <p className="pulse" style={{marginTop:"12px",fontSize:"12px",color:"var(--amber)"}}>
                    WhatsApp confirm karne ka intezaar...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <p style={{ textAlign:"center", marginTop:"16px", fontSize:"11px", color:"var(--border2)" }}>
          Backend: {BACKEND_URL}
        </p>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = ["compose","history"];

export default function App() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [connectedPhone, setConnectedPhone] = useState("");
  const [activeTab, setActiveTab]     = useState("compose");
  const [numbersRaw, setNumbersRaw]   = useState("");
  const [message, setMessage]         = useState("");
  const [delay, setDelay]             = useState(5);
  const [sending, setSending]         = useState(false);
  const [logs, setLogs]               = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const cancelRef   = useRef(false);
  const logsRef     = useRef([]);
  const endRef      = useRef(null);

  const parsedNums = numbersRaw ? parseNumbers(numbersRaw) : [];
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
    setSessions(prev=>[{
      id: Date.now(),
      date: new Date().toLocaleString("en-IN"),
      message: msg,
      numbers: nums,
      results,
      cancelled,
    }, ...prev]);
    setSelectedSession(null);
  };

  const handleSend = async () => {
    if(!parsedNums.length||!message.trim()) return;
    setSending(true); cancelRef.current=false;
    setLogs([]); logsRef.current=[];
    const nums=[...parsedNums]; const msg=message;

    for(let i=0;i<nums.length;i++){
      if(cancelRef.current) break;
      addLog(nums[i],i+1,"sending");
      await new Promise(r=>setTimeout(r,delay*1000));

      try {
        // Real call: await fetch(`${BACKEND_URL}/api/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:nums[i],message:msg})})
        const ok = Math.random()>0.08;
        addLog(nums[i],i+1,ok?"sent":"failed");
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

  // Current log for sticky bar
  const currentLog = logs.length>0 ? logs[logs.length-1] : null;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"var(--font)", color:"var(--text)" }}>
      <style>{CSS}</style>

      {/* ── TOPBAR ── */}
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
          {/* Stats */}
          {[["Numbers",parsedNums.length,"var(--text)"],["Sent",sentCount,"var(--green)"],["Failed",failedCount,"var(--red)"]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:"right" }}>
              <div style={{ fontSize:"14px", fontWeight:600, color:c, fontFamily:"var(--mono)", lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:"9px", color:"var(--muted)", marginTop:"1px", letterSpacing:"0.5px" }}>{l}</div>
            </div>
          ))}
          <button className="btn-ghost" onClick={handleLogout} style={{ marginLeft:4 }}>
            {Icon.logout} Logout
          </button>
        </div>
      </div>

      {/* ── LIVE PROGRESS BAR (sticky below topbar while sending) ── */}
      {sending && (
        <div style={{
          position:"sticky", top:54, zIndex:99,
          background:"var(--surface)", borderBottom:"1px solid var(--border)",
          padding:"10px 20px",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span className="spin" style={{ color:"var(--green)", fontSize:"13px" }}>{Icon.refresh}</span>
              <span style={{ fontSize:"12px", color:"var(--text)", fontWeight:500 }}>
                {currentLog?.status==="sending"
                  ? `Sending to ${fmt(currentLog.num)}...`
                  : currentLog ? `${currentLog.status==="sent"?"✅":"❌"} ${fmt(currentLog.num)} — ${currentLog.status}`
                  : "Starting..."}
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
            <div style={{
              height:"100%", borderRadius:"4px",
              width:`${progress}%`,
              background:"linear-gradient(90deg, var(--green), #4ac162)",
              transition:"width .4s ease",
            }}/>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{
        display:"flex", borderBottom:"1px solid var(--border)",
        background:"var(--surface)", padding:"0 20px",
      }}>
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

      {/* ── CONTENT (blur when sending) ── */}
      <div style={{
        position:"relative",
        filter: sending ? "blur(2px)" : "none",
        pointerEvents: sending ? "none" : "auto",
        transition:"filter .25s",
        minHeight:"calc(100vh - 54px)",
      }}>
        <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px" }}>

          {/* ═══ COMPOSE ═══ */}
          {activeTab==="compose" && (
            <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>

              {/* Numbers */}
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px", letterSpacing:".3px" }}>
                  PHONE NUMBERS
                </label>
                <textarea className="field" value={numbersRaw}
                  onChange={e=>setNumbersRaw(e.target.value)}
                  placeholder={"9876543210\n9123456789, 8001234567"}
                  rows={4}
                  style={{ resize:"vertical", lineHeight:1.7, fontFamily:"var(--mono)", fontSize:"13px" }}
                />
                {parsedNums.length>0 && (
                  <div style={{ marginTop:"10px" }}>
                    <span style={{ fontSize:"11px", color:"var(--green)", marginRight:"8px" }}>
                      ✓ {parsedNums.length} number{parsedNums.length>1?"s":""} detected
                    </span>
                    <div style={{ marginTop:"8px", display:"flex", flexWrap:"wrap", gap:"5px" }}>
                      {parsedNums.map((n,i)=>(
                        <span key={i} className="tag" style={{
                          background:"var(--green-bg)", border:"1px solid rgba(63,185,80,.25)",
                          color:"var(--green)", fontFamily:"var(--mono)",
                        }}>+{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <label style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>
                  <span>MESSAGE</span>
                  <span style={{ fontFamily:"var(--mono)" }}>{message.length}</span>
                </label>
                <textarea className="field" value={message}
                  onChange={e=>setMessage(e.target.value)}
                  placeholder="Apna message yahan likho..."
                  rows={6}
                  style={{ resize:"vertical", lineHeight:1.75, fontSize:"14px" }}
                />
              </div>

              {/* Delay */}
              <div>
                <label style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", fontWeight:500, color:"var(--muted)", marginBottom:"8px" }}>
                  <span>DELAY BETWEEN MESSAGES</span>
                  <span style={{ fontFamily:"var(--mono)", color:"var(--text)" }}>{delay}s</span>
                </label>
                <input type="range" min={1} max={30} value={delay}
                  onChange={e=>setDelay(Number(e.target.value))}
                  style={{ width:"100%", accentColor:"var(--green)", cursor:"pointer", height:"4px" }}
                />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"var(--muted)", marginTop:"5px" }}>
                  <span>1s · risky</span><span>10s · safe</span><span>30s · safest</span>
                </div>
              </div>

              {/* Send */}
              <button className="btn-primary" onClick={handleSend}
                disabled={!parsedNums.length||!message.trim()||sending}
                style={{ marginTop:"4px", padding:"13px 20px", fontSize:"14px" }}>
                {Icon.send}
                Send to {parsedNums.length} Number{parsedNums.length!==1?"s":""}
              </button>

              {/* Live logs (while sending, show at bottom of compose too) */}
              {logs.length>0 && (
                <div style={{
                  background:"var(--surface)", border:"1px solid var(--border)",
                  borderRadius:"12px", overflow:"hidden",
                }}>
                  <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"12px", fontWeight:500 }}>Live Log</span>
                    <span style={{ fontSize:"11px", color:"var(--muted)", fontFamily:"var(--mono)" }}>
                      {sentCount}✅ {failedCount}❌
                    </span>
                  </div>
                  <div style={{ maxHeight:240, overflowY:"auto", padding:"8px" }}>
                    {logs.map((log,i)=>(
                      <div key={i} className="log-row" style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"7px 10px", borderRadius:"7px",
                        transition:"background .1s",
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                          <span style={{ fontSize:"10px", color:"var(--muted)", fontFamily:"var(--mono)", minWidth:"22px" }}>#{log.idx}</span>
                          <span style={{ fontSize:"13px", fontFamily:"var(--mono)", color:"var(--text)" }}>{fmt(log.num)}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          {log.status==="sending" && <span className="spin" style={{color:"var(--amber)"}}>{Icon.refresh}</span>}
                          <span style={{
                            fontSize:"11px", fontFamily:"var(--mono)",
                            color: log.status==="sent"?"var(--green)":log.status==="failed"?"var(--red)":"var(--amber)",
                          }}>
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

          {/* ═══ HISTORY ═══ */}
          {activeTab==="history" && (
            <div className="fade-in">
              {sessions.length===0 ? (
                <div style={{ textAlign:"center", padding:"80px 20px", color:"var(--muted)" }}>
                  <div style={{ fontSize:"40px", marginBottom:"12px" }}>📭</div>
                  <div style={{ fontSize:"15px", fontWeight:500, color:"var(--text)", marginBottom:"6px" }}>Koi history nahi</div>
                  <div style={{ fontSize:"13px" }}>Pehle kuch messages bhejo</div>
                </div>
              ) : selectedSession ? (
                // Detail view
                <div>
                  <button className="btn-ghost" onClick={()=>setSelectedSession(null)} style={{ marginBottom:"16px" }}>
                    ← Wapas
                  </button>
                  <div style={{
                    background:"var(--surface)", border:"1px solid var(--border)",
                    borderRadius:"12px", overflow:"hidden", marginBottom:"16px",
                  }}>
                    <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
                      <div style={{ fontSize:"11px", color:"var(--muted)", marginBottom:"4px", fontFamily:"var(--mono)" }}>
                        {selectedSession.date} {selectedSession.cancelled && <span style={{color:"var(--amber)"}}> · Cancelled</span>}
                      </div>
                      <div style={{
                        background:"var(--bg)", borderRadius:"8px", padding:"10px 12px",
                        fontSize:"13px", lineHeight:1.7, color:"var(--text)",
                        borderLeft:"2px solid var(--green)",
                      }}>{selectedSession.message}</div>
                    </div>
                    <div style={{ display:"flex", padding:"14px 16px", gap:"0" }}>
                      {[
                        ["Total", selectedSession.results.length, "var(--text)"],
                        ["Sent", selectedSession.results.filter(r=>r.status==="sent").length, "var(--green)"],
                        ["Failed", selectedSession.results.filter(r=>r.status==="failed").length, "var(--red)"],
                      ].map(([l,v,c],i)=>(
                        <div key={l} style={{ flex:1, textAlign:"center", borderRight:i<2?"1px solid var(--border)":"none", padding:"0 10px" }}>
                          <div style={{ fontSize:"22px", fontWeight:600, color:c, fontFamily:"var(--mono)" }}>{v}</div>
                          <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"2px" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                    {selectedSession.results.map((log,i)=>(
                      <div key={i} style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"9px 14px", borderRadius:"8px",
                        background:"var(--surface)", border:"1px solid var(--border)",
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                          <span style={{ fontSize:"10px", color:"var(--muted)", fontFamily:"var(--mono)", minWidth:"22px" }}>#{log.idx}</span>
                          <span style={{ fontSize:"13px", fontFamily:"var(--mono)" }}>{fmt(log.num)}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <span style={{
                            fontSize:"11px", fontFamily:"var(--mono)",
                            color: log.status==="sent"?"var(--green)":"var(--red)",
                          }}>
                            {log.status==="sent"?"✓ Sent":"✕ Failed"}
                          </span>
                          <span style={{ fontSize:"10px", color:"var(--muted)" }}>{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Session list
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {sessions.map(s=>{
                    const sent = s.results.filter(r=>r.status==="sent").length;
                    const failed = s.results.filter(r=>r.status==="failed").length;
                    return (
                      <div key={s.id} onClick={()=>setSelectedSession(s)} style={{
                        background:"var(--surface)", border:"1px solid var(--border)",
                        borderRadius:"10px", padding:"14px 16px",
                        cursor:"pointer", transition:"border-color .15s",
                      }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border2)"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}
                      >
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                          <div style={{ fontSize:"11px", color:"var(--muted)", fontFamily:"var(--mono)" }}>
                            {s.date} {s.cancelled && <span style={{color:"var(--amber)"}}>· Cancelled</span>}
                          </div>
                          <div style={{ display:"flex", gap:"8px", fontSize:"11px", fontFamily:"var(--mono)" }}>
                            <span style={{color:"var(--green)"}}>✓{sent}</span>
                            {failed>0 && <span style={{color:"var(--red)"}}>✕{failed}</span>}
                          </div>
                        </div>
                        <div style={{
                          fontSize:"13px", color:"var(--text)", lineHeight:1.5,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          maxWidth:"90%",
                        }}>{s.message}</div>
                        <div style={{ marginTop:"8px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
                          {s.numbers.slice(0,4).map((n,i)=>(
                            <span key={i} className="tag" style={{
                              background:"var(--bg)", border:"1px solid var(--border2)",
                              color:"var(--muted)", fontSize:"10px",
                            }}>+{n}</span>
                          ))}
                          {s.numbers.length>4 && (
                            <span className="tag" style={{background:"var(--bg)",border:"1px solid var(--border2)",color:"var(--muted)",fontSize:"10px"}}>
                              +{s.numbers.length-4} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blur overlay while sending */}
      {sending && (
        <div style={{
          position:"fixed", inset:0, zIndex:50,
          display:"flex", alignItems:"center", justifyContent:"center",
          pointerEvents:"none",
        }}>
          <div style={{
            background:"var(--surface)", border:"1px solid var(--border2)",
            borderRadius:"14px", padding:"24px 32px", textAlign:"center",
            boxShadow:"0 24px 60px rgba(0,0,0,.5)",
            pointerEvents:"all",
          }}>
            <span className="spin" style={{ color:"var(--green)", fontSize:"24px", display:"block", marginBottom:"10px" }}>
              {Icon.refresh}
            </span>
            <div style={{ fontWeight:600, marginBottom:"4px" }}>Sending Messages</div>
            <div style={{ fontSize:"13px", color:"var(--muted)", marginBottom:"16px" }}>
              {sentCount} sent · {failedCount} failed · {parsedNums.length-doneCount} remaining
            </div>
            <button className="btn-danger" onClick={handleCancel} style={{ margin:"0 auto" }}>
              {Icon.x} Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
