// ГЛОБАЛЬНЫЕ НАСТРОЙКИ ФРОНТЕНДА
window.APP_CONFIG = {
  // Внутри Docker фронт ходит на бэк через nginx-прокси /api -> http://<сервис бэка>:8000/
  API_BASE: "/api",

  // Если запускаете фронт БЕЗ Docker (просто открыли index.html),
  // закомментируйте строку выше и раскомментируйте эту (нужен CORS на бэке):
  // API_BASE: "http://localhost:8000",

  DEFAULTS: {
    n: 6,
    topic: "",
    genre: "cyberpunk",
    difficulty: "medium",
    includeTheory: false,
    sound: { buttons: 70, fx: 50, music: 80 },
  },
};