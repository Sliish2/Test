# Tiny React Starter — Plus Edition

Adds a few interesting, reusable pieces on top of the minimal starter:

- **Router** with pages (Home, Notes)
- **Global Command Palette** (⌘/Ctrl+K) with fuzzy search (Fuse.js)
- **Theme toggle** (light/dark) stored persistently
- **Global state** via Zustand (counter, theme, notes)
- **Notes**: local-first CRUD with tags & search

## Quick start

```bash
npm install
npm run dev
```

> If you're upgrading your existing tiny starter, copy the `src` folder over
> and merge `package.json` dependencies, then `npm install`.

## Keyboard shortcuts

- Open Command Palette: **⌘/Ctrl + K**
- Close palette: **Esc**

## Files you might want to read first

- `src/components/CommandPalette.jsx` — core logic for actions + fuzzy search
- `src/store/useAppStore.js` — persisted global store (Zustand)
- `src/pages/Notes.jsx` — simple local-first notes app
