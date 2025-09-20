import React, { useEffect } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Notes from "./pages/Notes.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import useAppStore from "./store/useAppStore.js";

export default function App() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⚡</span>
          <strong>Tiny+ </strong>
          <span className="muted">React Starter</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/notes">Notes</NavLink>
        </nav>
        <div className="spacer" />
        <button className="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "🌙" : "☀️"} Theme
        </button>
        <span className="hint">⌘/Ctrl + K</span>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notes" element={<Notes />} />
        </Routes>
      </main>

      <footer className="footer">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">Vite</a>
        <span>•</span>
        <a href="https://react.dev" target="_blank" rel="noreferrer">React</a>
        <span>•</span>
        <a href="https://github.com/pmndrs/zustand" target="_blank" rel="noreferrer">Zustand</a>
      </footer>

      <CommandPalette />
    </div>
  );
}
