// Force HTTPS on WeChat CDN URLs. The data ingest pipeline sometimes
// records http:// URLs from Dajiala — fine in browsers (auto-upgraded
// to https via "upgrade-insecure-requests"), but macOS App Transport
// Security in packaged Tauri builds REJECTS them outright (no auto-
// upgrade), so images fail to load with "the resource could not be
// loaded because the App Transport Security policy requires the use of
// a secure connection".
//
// Both wx.qlogo.cn and mmbiz.qpic.cn serve the same content over HTTPS;
// we just rewrite the scheme. Anything else passes through unchanged.

export function httpsifyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://wx.qlogo.cn") || url.startsWith("http://mmbiz.qpic.cn")) {
    return "https://" + url.slice("http://".length);
  }
  return url;
}
