# Recommended AWS Deployment

This repo is a dynamic Next.js full-stack app with API routes, authentication, file uploads, PDF generation, and Prisma. It runs as one server-side app on Lightsail.

Recommended production shape:

```text
Users
  -> DNS A record
  -> Lightsail static IP
  -> Caddy HTTPS reverse proxy
  -> Next.js app container
  -> PostgreSQL container
```

## AWS Resources

Create these resources:

- One Lightsail Linux instance, Ubuntu LTS
- One Lightsail static IP attached to that instance
- One DNS `A` record pointing your app domain to the Lightsail static IP

The app domain can be one hostname, for example:

```text
requests.yourdomain.org
```

The stack in this folder runs:

- `postgres`
- `app` running Next.js
- `caddy` for automatic HTTPS

Use `us-east-1` unless you have a specific reason to use another region.

## Lightsail Firewall

Open these Lightsail firewall ports:

- `22` SSH
- `80` HTTP
- `443` HTTPS

Do not open `5432`. PostgreSQL stays private inside Docker.

## Caddy HTTPS Proxy

Caddy is the public web server for the app. It listens on ports `80` and `443`, gets and renews HTTPS certificates automatically, and forwards traffic to the Next.js container on the private Docker network.

The Caddy config is [Caddyfile](./Caddyfile):

```caddyfile
{$APP_DOMAIN} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}

	reverse_proxy app:3000
}
```

Before Caddy can issue the certificate:

- `APP_DOMAIN` in `deploy/aws/lightsail.env` must be the real hostname, without `https://`
- the DNS `A` record for that hostname must point to the Lightsail static IP
- Lightsail ports `80` and `443` must be open
- no other process on the instance should be using ports `80` or `443`

Example:

```env
APP_DOMAIN=requests.yourdomain.org
```

Caddy stores certificate data in the Docker volume `caddy_data`, so certificates survive container restarts.

Useful Caddy commands on the Lightsail instance:

```bash
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env logs -f caddy
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env restart caddy
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env exec caddy caddy validate --config /etc/caddy/Caddyfile
```

If HTTPS does not come up, first check DNS and firewall:

```bash
dig +short YOUR_APP_DOMAIN
curl -I http://YOUR_APP_DOMAIN
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env logs caddy
```

## Recommended Instance

- Lowest workable: `Linux/Unix $7/month`, 1 GB RAM
- Safer: `Linux/Unix $12/month`, 2 GB RAM

On the `$7/month` instance, add swap. The GitHub deploy workflow runs `deploy/aws/ensure-swap.sh` automatically, but you can run it manually too:

```bash
sudo sh deploy/aws/ensure-swap.sh
```

## Server Setup

SSH to the instance:

```bash
ssh ubuntu@YOUR_LIGHTSAIL_STATIC_IP
```

Install Docker, Git, and the Compose plugin:

```bash
sudo apt update
sudo apt install -y docker.io git curl
sudo usermod -aG docker $USER
```

Log out and back in, then install Compose:

```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.39.1/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version
```

Clone the repo:

```bash
git clone YOUR_GITHUB_REPO_URL
cd sda-service-request
```

If the repo is private, configure SSH deploy-key access so `git pull` works without an interactive password prompt.

Add swap:

```bash
sudo sh deploy/aws/ensure-swap.sh
```

Create the production env file:

```bash
cp deploy/aws/lightsail.env.example deploy/aws/lightsail.env
nano deploy/aws/lightsail.env
```

Set at least:

- `APP_DOMAIN`
- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `WHATSAPP_WEBHOOK_TOKEN`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

Generate secrets with:

```bash
openssl rand -hex 32
```

After the server setup and env file are ready, deploy from GitHub Actions. The workflow builds the Docker image on the GitHub runner, transfers it to Lightsail, and starts it with `--no-build`.

Check it:

```bash
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env ps
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env logs -f app
```
Open:

```text
https://YOUR_APP_DOMAIN/api/health
```

The app runs a production bootstrap on startup. It creates roles, default request types, and the Super Admin configured by `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`. On a fresh database with no users, those admin variables are required and startup will fail without them. Placeholder values from `lightsail.env.example` are rejected; set real values before deploying. Change that password after first login.

## GitHub Actions CI/CD

The workflow is:

- `.github/workflows/deploy-aws.yml`

It does:

1. Install dependencies
2. Run typecheck
3. Run tests
4. Build the Next.js app
5. Build the Docker image on the GitHub runner
6. SSH to Lightsail
7. `git pull --ff-only`
8. Ensure swap exists on Lightsail
9. Transfer the prebuilt Docker image to Lightsail
10. `docker compose ... up -d --no-build`

The workflow does not build the app image on Lightsail. That avoids `exit code 137` out-of-memory failures on the 1 GB instance during `pnpm install`.

Run the server setup once before relying on the workflow.

### GitHub Production Variables

Create a GitHub environment named `production`, then add:

- `LIGHTSAIL_HOST=YOUR_LIGHTSAIL_STATIC_IP_OR_DNS`
- `LIGHTSAIL_USER=ubuntu`
- `LIGHTSAIL_APP_DIR=/home/ubuntu/sda-service-request`
- `LIGHTSAIL_SSH_PORT=22`

### GitHub Production Secrets

Add:

- `LIGHTSAIL_SSH_PRIVATE_KEY`

Use a dedicated private key that can log in to the Lightsail instance. Paste the raw private key text, including the `BEGIN` and `END` lines. Use an unencrypted key for this workflow.

Add the public key to the server:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## Backups

Because this low-cost setup keeps PostgreSQL on the same instance, configure backups. A simple manual backup command is:

```bash
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env exec postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > sda-service-request-$(date +%Y%m%d-%H%M).sql
```

For production, automate backups to another machine or a dedicated backup storage location.
