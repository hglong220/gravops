# Gravops Desktop Shell

Windows desktop host for the Gravops web system.

This shell uses Microsoft Edge WebView2, so it reuses the system browser runtime
instead of bundling Chromium. The desktop host keeps the polished Gravops task
workspace on the left and embeds browser workbenches on the right:

- left pane: Gravops task center at `http://localhost:3000/dashboard/tasks`
- right pane: browser workbench for JD and ZCY pages

The workbench toolbar can open JD/ZCY pages inside the desktop window. Clicking
`读取当前商品` reads the current JD workbench page and saves it into the task
center. Publishing a selected draft from the left task center opens ZCY in the
right workbench and starts the existing ZCY automation flow.

## Prerequisites

- Windows 10/11
- Microsoft Edge WebView2 Runtime
- .NET 8 SDK
- Node.js dependencies installed in `zhengcaiyun-backend`

The repository may include a local SDK under `..\.dotnet`; if system `dotnet`
does not include an SDK, run commands from the repo root with `..\.dotnet\dotnet.exe`
or `D:\Gravops\.dotnet\dotnet.exe`.

## Run

```powershell
cd D:\Gravops
.\.dotnet\dotnet.exe run --project gravops-desktop-shell\Gravops.Desktop.csproj
```

The app starts `zhengcaiyun-backend` with `npm run dev`, then opens the task
center plus JD/ZCY workbench tabs.

## Runtime Data

WebView2 user data is stored under:

```text
%LOCALAPPDATA%\Gravops\WebView2
```

The left Gravops pane and the right workbench pane use separate WebView2
profiles for cleaner state management.
