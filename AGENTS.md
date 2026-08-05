<!-- PODIUM WATCH PROJECT CONTEXT -->

# Podium Watch project instructions

Before changing code, read these files in order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/AUTO_PROJECT_INDEX.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_SOURCES.md`
5. `docs/DECISIONS.md`
6. `docs/NEXT_SESSION.md`

Use these commands before and after meaningful work:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-project-context.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\project-health.ps1
```

Project rules:

1. Preserve working features.
2. Do not expose secret values.
3. Keep Supabase service role access on the server only.
4. Create safe SQL migration files instead of changing the live database directly.
5. Never invent athlete performances, divisions, regions, results, or statistics.
6. Clearly separate verified facts, projections, and Podium Watch editorial rankings.
7. Use complete replacement files when practical.
8. Use `npm.cmd` and `npx.cmd` on Windows.
9. Do not deploy or push unless the user explicitly requests it.
10. Update `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`, and `docs/SESSION_LOG.md` after major work.

For a new ChatGPT session, generate and upload the latest context package:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-project-context.ps1
```