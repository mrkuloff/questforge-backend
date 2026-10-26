// Обёртка над ручками бэкенда QuestForge
const Api = {
  base() {
    return (window.APP_CONFIG?.API_BASE ?? "/api").replace(/\/+$/, "");
  },

  async _json(path, opts) {
    const res = await fetch(this.base() + path, opts);
    if (!res.ok) {
      let detail = "";
      try {
        const d = await res.json();
        detail = d.detail ? JSON.stringify(d.detail) : (d.message || "");
      } catch (_) { /* тело не json */ }
      throw new Error(`HTTP ${res.status}${detail ? ": " + detail : ""}`);
    }
    return res.json();
  },

  health()    { return this._json("/health"); },
  getConfig() { return this._json("/config"); },

  putConfig(cfg) {
    return this._json("/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
  },

  postQuest(req) {
    return this._json("/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  },

  // Картинка слайда: шлём промпт, принимаем ЛЮБОЙ разумный формат ответа:
  //  - json с полем image/base64/b64/data/url
  //  - сырой image/* (blob)
  //  - сырая base64-строка
  // Сейчас там заглушка 1x1 PNG — она растянется на весь экран.
  // Когда подключите диффузионку — код менять НЕ придётся.
  async fetchSlideImage(prompt) {
    const res = await fetch(this.base() + "/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, text: prompt }),
    });
    if (!res.ok) throw new Error("image HTTP " + res.status);

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.startsWith("image/")) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
    if (ct.includes("application/json")) {
      const data = await res.json();
      const b64 = data.image ?? data.base64 ?? data.b64 ?? data.data ?? null;
      if (b64) return "data:image/png;base64," + String(b64).trim();
      if (data.url) return data.url;
      return null;
    }
    const text = (await res.text()).trim();
    if (text && !text.startsWith("<")) return "data:image/png;base64," + text;
    return null;
  },
};