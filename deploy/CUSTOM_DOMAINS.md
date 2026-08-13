# Custom domains that "just work" (only add a DNS record)

Goal: a customer connects their domain by **only adding an A record** pointing to
this server's IP (`132.148.78.187`) — no cPanel step, no manual SSL. HTTPS is
issued automatically on the first visit. This is how Vercel/Netlify/Wix do it.

## How it works
- **Caddy** runs in front on ports 80/443. It serves the React app and proxies
  `/api` to the shared FastAPI backend (`127.0.0.1:8007`).
- **On-Demand TLS**: the first time someone visits a customer domain, Caddy asks
  the app `GET /api/public/domain-allowed?domain=<host>`. If the domain is a
  **verified** custom domain (200), Caddy issues a free Let's Encrypt cert on the
  spot and starts serving. Random domains get 404 and are refused.
- The React app reads `window.location.hostname` and loads that customer's site
  via `/api/public/website-by-domain/<host>` — already implemented.

So the customer flow becomes just:
1. Add an **A record**: `@` (or the subdomain) → `132.148.78.187`.
2. In UniTech, click **Verify** (Step 1 TXT + Step 2 A). Done — HTTPS auto.

## One-time server setup (run ONCE, carefully — it changes a live server)
> ⚠️ This moves Apache off 80/443 so Caddy can own them. Do it during low traffic.

1. **Move Apache ports** in WHM → *Tweak Settings* → *System*:
   - Apache non-SSL port `0.0.0.0:80` → `0.0.0.0:8080`
   - Apache SSL port `0.0.0.0:443` → `0.0.0.0:8443`
   Save & rebuild httpd. Verify 80/443 are free:
   `ss -lnt | egrep ':80|:443|:8080|:8443'`

2. **Point the backend proxy** in `.htaccess` stays the same (Caddy proxies /api
   straight to `127.0.0.1:8007`, bypassing Apache for the app).

3. **Install + start Caddy**:
   `sudo bash /home/ezunitap/repo/deploy/setup-caddy.sh`

4. **Test**:
   - `curl -I https://ezunitap.com` (should still work, served by Caddy)
   - Point a test domain's A record to the IP, Verify it in UniTech, then open it
     → HTTPS should come up automatically within ~30–60s.

## Rollback
Stop Caddy (`systemctl stop caddy`) and move Apache ports back to 80/443 in WHM.
