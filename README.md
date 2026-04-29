# Daymark

Medcomms project management app — Vite + React + Supabase build.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build for production

```bash
npm run build
```

Outputs to `dist/`. Deploy that folder to Netlify.

## Project structure

```
src/
  main.jsx              Entry point
  App.jsx               Root component (auth + workspace switcher)
  lib/
    supabase.js         Supabase client (anon key)
    storage.js          Data layer (loadTasks, saveTask, etc)
    constants.js        Shared constants (colours, default categories)
    utils.js            Date helpers, uid, etc
  components/
    Auth.jsx            Login/signup screen
    TopBar.jsx          Header with workspace switcher
    (more added in future sessions)
  styles/
    global.css          CSS variables and base styles
```

## Migration status

This is the early-stage Vite migration. Login and workspace switching work.
Tasks/Projects/Notes will be ported one tab at a time from the legacy
single-file HTML version (`daymark.html`).
