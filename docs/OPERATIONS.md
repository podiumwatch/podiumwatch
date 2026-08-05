# Podium Watch operating guide

## 1. Local development

```powershell
cd C:\Users\12zac\Downloads\Podium_Watch_Website\podium_watch_site
npx.cmd vercel dev
```

## 2. Build

```powershell
npm.cmd run build
```

## 3. Quality check

```powershell
npm.cmd run check
```

## 4. Refresh project knowledge

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-project-context.ps1
```

## 5. Full local project review

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\project-health.ps1
```

## 6. Create a package for a new ChatGPT session

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-project-context.ps1
```

The export is placed in the Windows Downloads folder.

## 7. Recommended routine

Before work:

1. Pull or confirm the current Git branch.
2. Run the context update.
3. Run `git status --short`.
4. Start the local site.
5. Test the current feature.

After work:

1. Run the build.
2. Run the quality checker.
3. Review changed pages on desktop and mobile widths.
4. Update session notes.
5. Refresh the context index.
6. Create a new context export.
7. Review the Git diff.
8. Commit and deploy only when ready.