import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d12", borderRadius: 38 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", width: 144, height: 72 }}>
        <div style={{ position: "absolute", left: 10, right: 10, top: 27, height: 24, borderRadius: 12, background: "#5b9cff" }} />
        <div style={{ position: "absolute", left: 19, top: 9, width: 18, height: 60, borderRadius: 8, background: "#f5f7fa" }} />
        <div style={{ position: "absolute", right: 19, top: 9, width: 18, height: 60, borderRadius: 8, background: "#f5f7fa" }} />
        <div style={{ position: "absolute", left: 0, top: 19, width: 15, height: 40, borderRadius: 7, background: "#5b9cff" }} />
        <div style={{ position: "absolute", right: 0, top: 19, width: 15, height: 40, borderRadius: 7, background: "#5b9cff" }} />
      </div>
    </div>,
    size,
  );
}
