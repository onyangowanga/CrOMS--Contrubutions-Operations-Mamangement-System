# CrOMS VPS Deployment Runbook

This runbook deploys CrOMS on the subdomain `croms.event-oms.online` on the VPS `194.37.81.174` without conflicting with an existing app such as EOMS.

## Recommended approach

Use this layout:

- keep EOMS on its current setup
- run CrOMS in its own Docker Compose project
- do not expose CrOMS directly on public port `80` or `443`
- attach CrOMS to the existing EOMS Docker proxy network so the running `eoms-nginx` container can reach it by service name
- optionally keep a loopback-only host binding such as `127.0.0.1:4100` for server-side diagnostics
- let the existing Nginx container route `croms.event-oms.online` to the CrOMS container on the shared Docker network

This avoids conflicts because:

- only Nginx listens publicly on `80/443`
- each app has its own server block by hostname
- CrOMS uses its own internal Docker network and database volume
- CrOMS does not take over ports already used by EOMS
- the shared proxy path is limited to hostname routing inside Docker, not shared databases or shared app containers

## Files added for deployment

- `deploy/docker-compose.vps.yml`
- `deploy/.env.example`
- `deploy/nginx/croms.event-oms.online.conf`

## Step 1: DNS

Create an `A` record for:

- `croms.event-oms.online` -> `194.37.81.174`

Wait for DNS propagation.

## Step 2: Upload project to VPS

Suggested path on the VPS:

```bash
/opt/croms
```

Example:

```bash
sudo mkdir -p /opt/croms
sudo chown $USER:$USER /opt/croms
cd /opt/croms
git clone <your-repo-url> .
```

## Step 3: Create production env file

Copy the example file:

```bash
cd /opt/croms/deploy
cp .env.example .env
```

Edit `.env` and set strong secrets:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_SEED_PASSWORD`

If port `4100` is already in use on the VPS, change:

- `APP_HOST_PORT=4100`

to another free loopback port such as `4110`.

## Step 4: Start CrOMS with Docker Compose

From the project root on the VPS:

```bash
cd /opt/croms
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env up -d --build
```

Check status:

```bash
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env ps
```

Check logs:

```bash
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env logs -f croms
```

## Step 5: Configure the existing EOMS Nginx container

This VPS uses an Nginx container from the EOMS stack, not host-level `/etc/nginx/sites-enabled`.

Copy the provided server block into the mounted EOMS config directory:

```bash
cp /opt/croms/deploy/nginx/croms.event-oms.online.conf /opt/eoms/nginx/conf.d/croms.event-oms.online.conf
```

Validate the config inside the running Nginx container:

```bash
docker exec eoms-nginx nginx -t
```

Reload the Nginx container:

```bash
docker exec eoms-nginx nginx -s reload
```

The provided Nginx file proxies to `croms:4000` over Docker networking, so you do not need to point it at the optional loopback port.

## Step 6: Add SSL with Certbot

If Certbot is already used on the VPS:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d croms.event-oms.online
```

Then reload the Nginx container again:

```bash
docker exec eoms-nginx nginx -s reload
```

This attaches HTTPS to the CrOMS subdomain without affecting EOMS because the Nginx container already mounts both `/etc/letsencrypt` and `/var/www/certbot` from the host.

## Step 7: Verify deployment

Test locally on the VPS first:

```bash
curl http://127.0.0.1:4100/api/health
```

Expected response:

```json
{"ok":true,"service":"CrOMS API"}
```

Then test externally:

- `http://croms.event-oms.online`
- `https://croms.event-oms.online`

## Step 8: Ongoing operations

Update deployment after code changes:

```bash
cd /opt/croms
git pull
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env up -d --build
```

Or use the repeatable helper script in this repo:

```bash
cd /opt/croms
bash deploy/scripts/redeploy.sh
```

Optional flags:

- `--skip-pull` if you already updated the working tree
- `--skip-nginx` if only app containers changed and proxy config did not
- `--skip-checks` if you want a build-only run

Use these helper commands when needed:

```bash
# reload the shared EOMS Nginx config
bash deploy/scripts/reload-nginx.sh

# temporarily switch back to HTTP-only config if SSL needs re-issuing
bash deploy/scripts/reload-nginx.sh --http-only

# run health and live endpoint checks only
bash deploy/scripts/check-live.sh
```

Stop CrOMS only:

```bash
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env down
```

This will not affect EOMS unless you manually stop its own compose stack or Nginx config.

## EOMS coexistence note

On the current VPS, the EOMS Nginx container is attached to the Docker network `eoms_default`.

CrOMS must join that same network in addition to its own private database network so that the `proxy_pass http://croms:4000;` upstream resolves correctly from inside the Nginx container.

## Conflict-avoidance notes

To avoid conflict with EOMS:

- do not map CrOMS directly to `0.0.0.0:80` or `0.0.0.0:443`
- do not reuse EOMS database credentials or volumes
- do not reuse EOMS Docker Compose project files
- do not hardcode the same loopback host port if EOMS is already using it
- keep Nginx routing separated by `server_name`

## Best-practice recommendations

- use a strong random `JWT_SECRET`
- use a strong admin seed password
- back up the Docker volume used for the PostgreSQL data
- enable UFW and allow only `22`, `80`, and `443`
- keep CrOMS behind Nginx and not directly exposed on the internet by its app port
- test login, payment logging, reports, and group isolation after deployment

## Suggested next live checks

After deployment, test:

1. login on `croms.event-oms.online`
2. campaign creation
3. WhatsApp summary generation
4. report exports
5. group isolation between two different treasurer accounts
6. transaction deletion with password confirmation