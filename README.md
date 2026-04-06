# Util Bot

Cloudflare Worker Discord bot with a single slash command:

- `/totp service:cloudflare`
- `/totp service:gmail`

The bot always replies ephemerally (only visible to the invoker), verifies guild and role access, and includes a **Regenerate** button to produce a fresh code.

## Access Rules

- Allowed guild ID: `1098115673454039121`
- Required role ID: `1490840570569163025`

Users outside the guild or without the role get an ephemeral denial message.

## Required Environment Variables

- `DISCORD_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_APPLICATION_ID`
- `CFKEY` (base32 TOTP secret for cloudflare)
- `GMKEY` (base32 TOTP secret for gmail)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `example.dev.vars` to `.dev.vars` and fill values.

3. Register slash commands:

```bash
npm run register
```

4. Run worker locally:

```bash
npm start
```

## Deploy

```bash
npm run publish
```

Add runtime secrets in Cloudflare:

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APPLICATION_ID
wrangler secret put CFKEY
wrangler secret put GMKEY
```
