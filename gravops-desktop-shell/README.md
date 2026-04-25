# Gravops Desktop Shell

Windows desktop host for the Gravops web system.

This shell uses Microsoft Edge WebView2, so it reuses the system browser runtime
instead of bundling Chromium. The first version embeds two WebView2 panes:

- left pane: Gravops task center at `http://localhost:3000/dashboard/tasks`
- right pane: browser workbench for JD and ZCY pages

The workbench toolbar can open JD/ZCY pages inside the desktop window. Clicking
`读取当前商品` sends the current workbench URL to the local Gravops backend and
saves the result into the task center.

## Prerequisites

- Windows 10/11
- Microsoft Edge WebView2 Runtime
- .NET 8 SDK
- Node.js dependencies installed in `zhengcaiyun-backend`

This machine currently has Node.js but no .NET SDK, so the project is scaffolded
but cannot be compiled here until .NET 8 SDK is installed.

## Run

```powershell
cd gravops-desktop-shell
dotnet restore
dotnet run
```

The app starts `zhengcaiyun-backend` with `npm run dev`, then loads the Gravops
task center. Log in in the left pane before using `读取当前商品`.

## Runtime Data

WebView2 user data is stored under:

```text
%LOCALAPPDATA%\Gravops\WebView2
```

The left Gravops pane and the right workbench pane use separate WebView2
profiles for cleaner state management.
