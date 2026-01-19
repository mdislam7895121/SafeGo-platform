import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const QA_ENABLED = import.meta.env.VITE_QA_MODE === "true";

export function QaDebugPanel() {
  const [location] = useLocation();
  const [timestamp, setTimestamp] = useState<string>(new Date().toLocaleTimeString());

  useEffect(() => {
    if (!QA_ENABLED) return;
    const id = window.setInterval(() => setTimestamp(new Date().toLocaleTimeString()), 15000);
    return () => window.clearInterval(id);
  }, []);

  if (!QA_ENABLED) return null;

  const apiBase = import.meta.env.VITE_API_BASE_URL || "not-set";
  const nodeEnv = import.meta.env.MODE || "unknown";

  return (
    <div
      data-qa-panel="true"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        padding: "12px 14px",
        background: "rgba(15, 23, 42, 0.9)",
        color: "#e2e8f0",
        borderRadius: "10px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
        zIndex: 9999,
        maxWidth: "320px",
        fontFamily: "'IBM Plex Sans', 'SF Pro Text', 'Segoe UI', sans-serif",
        fontSize: "12px",
        lineHeight: 1.4,
        border: "1px solid rgba(226, 232, 240, 0.12)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.4px" }}>QA MODE</span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{timestamp}</span>
      </div>
      <div style={{ display: "grid", gap: "4px" }}>
        <Row label="Path" value={location || "/"} />
        <Row label="API" value={apiBase} />
        <Row label="Env" value={nodeEnv} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <span style={{ width: "56px", color: "#cbd5e1" }}>{label}</span>
      <span style={{ color: "#e2e8f0", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export default QaDebugPanel;
