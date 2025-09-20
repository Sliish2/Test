import React, { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";
import useAppStore from "../store/useAppStore.js";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const count = useAppStore(s => s.count);
  const increment = useAppStore(s => s.increment);
  const decrement = useAppStore(s => s.decrement);
  const resetCount = useAppStore(s => s.resetCount);
  const addSampleNote = useAppStore(s => s.addSampleNote);
  const clearNotes = useAppStore(s => s.clearNotes);

  useHotkeys("meta+k,ctrl+k", (e) => {
    e.preventDefault();
    setOpen(o => !o);
  }, { enableOnFormTags: ["INPUT", "TEXTAREA"] });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  const actions = useMemo(() => [
    { id: "go:home", group: "Navigation", name: "Go: Home", perform: () => navigate("/") },
    { id: "go:notes", group: "Navigation", name: "Go: Notes", perform: () => navigate("/notes") },
    { id: "theme:toggle", group: "Appearance", name: `Toggle Theme (current: ${theme})`, perform: () => setTheme(theme === "dark" ? "light" : "dark") },
    { id: "count:inc", group: "Counter", name: `Counter: Increment (now ${count})`, perform: increment },
    { id: "count:dec", group: "Counter", name: `Counter: Decrement (now ${count})`, perform: decrement },
    { id: "count:reset", group: "Counter", name: "Counter: Reset", perform: resetCount },
    { id: "notes:add-sample", group: "Notes", name: "Notes: Add sample note", perform: addSampleNote },
    { id: "notes:clear", group: "Notes", name: "Notes: Clear all", perform: clearNotes },
  ], [navigate, theme, setTheme, count, increment, decrement, resetCount, addSampleNote, clearNotes]);

  const fuse = useMemo(() => new Fuse(actions, {
    keys: ["name", "group", "id"],
    threshold: 0.35,
  }), [actions]);

  const results = query.trim() ? fuse.search(query).map(r => r.item) : actions;

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="cp-backdrop" onClick={() => setOpen(false)} onKeyDown={onKeyDown}>
      <div className="cp-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="cp-input"
        />
        <div className="cp-list">
          {results.length === 0 && <div className="cp-empty">No results</div>}
          {results.map((a) => (
            <button key={a.id} className="cp-item" onClick={() => { a.perform(); setOpen(false); }}>
              <div className="cp-title">{a.name}</div>
              <div className="cp-group">{a.group}</div>
            </button>
          ))}
        </div>
        <div className="cp-hint">Press Esc to close</div>
      </div>
    </div>
  );
}
