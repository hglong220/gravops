# ZCY Desktop Prototype

This prototype verifies product-page reading through the user's local
Edge/Chrome browser. It is not the final desktop app.

Goals:
- Use the system browser instead of embedding a full Chromium runtime.
- Keep login state in a local browser profile.
- Read JD / Taobao / Tmall product data for later ZCY form filling.
- Validate product title, brand, model, main images, detail images,
  product attributes, sale specification groups, and selected sale options.

## Setup

```powershell
pnpm install
```

The first run opens a controlled browser window. Log in to JD, Taobao, and
Tmall in that same window once. The login state is stored under local profile
directories ignored by git.

## Single Product

JD:

```powershell
pnpm collect:jd:cdp -- --url https://item.jd.com/100010050091.html
```

Taobao / Tmall:

```powershell
pnpm collect:taobao:cdp -- --url "https://item.taobao.com/item.htm?id=921393353319"
```

Output files are written under `output/`.

## Fixed Sample Test

Run the full fixed sample suite:

```powershell
npm run test:collect
```

Run only Taobao / Tmall samples:

```powershell
npm run test:collect -- --platform=taobao
```

Run the first N samples:

```powershell
npm run test:collect -- --limit=5
```

If the summary says `login required`, open the controlled browser window,
log in to that platform, then rerun the command.
