import React from "react";
import { authingClient } from "../lib/authing";
import { resetCallback } from "./AuthCallback";

export function LoginScreen() {
  function handleEnter() {
    resetCallback();
    authingClient.loginWithRedirect();
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0d1117",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 12,
        padding: "40px 48px",
        width: 360,
        color: "#e6edf3",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>Curation</h1>
        <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 32px" }}>你的专属资讯助理</p>
        <button onClick={handleEnter} style={primaryBtn}>
          登录 / 注册
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "10px 0",
  background: "#238636",
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};
