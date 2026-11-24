// Applies the theme before the first paint, from the choice remembered by app.js.
// Kept in its own file: extension pages do not allow inline scripts.
(() => {
  let choice = "auto";
  try { choice = localStorage.getItem("restart-theme") || "auto"; } catch { /* storage unavailable */ }
  const dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
