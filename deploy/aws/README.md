# Recommended AWS Deployment

This repo is a dynamic Next.js full-stack app with API routes, authentication, file uploads, PDF generation, and Prisma. It should run as one server-side app, not as a static S3 frontend.

Recommended production shape:

```text
Users
  -> DNS A record
  -> Lightsail static IP
  -> Caddy HTTPS reverse proxy
  -> Next.js app container
  -> PostgreSQL container
```

There is no `index.html` build artifact. The app runs with `next start`, so it needs a Node server.

## What You Need On AWS

Create only these AWS resources for the recommended low-cost setup:

- One Lightsail Linux instance, Ubuntu LTS
- One Lightsail static IP attached to that instance
- One DNS `A` record pointing your app domain to the Lightsail static IP
- Optional Route 53 hosted zone if you want AWS to manage DNS

The app domain can be one hostname, for example:

```text
requests.yourdomain.org
```

The stack in this folder runs:

- `postgres`
- `app` running Next.js
- `caddy` for automatic HTTPS

Use `us-east-1` unless you have a specific reason to use another region.

## What You Do Not Need

Do not create these for the current app:

- S3 frontend bucket
- S3 static website hosting
- CloudFront distribution with S3 origin
- CloudFront default root object `index.html`
- ACM certificate for CloudFront
- RDS database
- ECS, Fargate, App Runner, or load balancer

S3 and CloudFront static hosting is only correct for apps that build static files such as `index.html`, `assets/*.js`, and `assets/*.css`. This app has server routes and database-backed pages, so S3 cannot run it.

CloudFront is optional only if you configure it as a reverse proxy to Lightsail, not as an S3 static site. For this project, skip CloudFront until the Lightsail deployment is stable.

## Lightsail Firewall

Open these Lightsail firewall ports:

- `22` SSH
- `80` HTTP
- `443` HTTPS

Do not open `5432`. PostgreSQL stays private inside Docker.

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

Do not run `docker compose up -d --build` on the small Lightsail instance as the normal deployment path. Building the image on a 1 GB instance can fail with `exit code 137` during `pnpm install`.

After the server setup and env file are ready, deploy from GitHub Actions. The workflow builds the Docker image on the GitHub runner, transfers it to Lightsail, and starts it with `--no-build`.

If you need an emergency manual deploy on Lightsail, make sure swap is active first, then run:

```bash
docker compose \
  -f deploy/aws/docker-compose.low-cost.yml \
  --env-file deploy/aws/lightsail.env \
  up -d --build
```

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

## Manual Update Flow

The recommended update flow is to push to `main` and let GitHub Actions deploy.

Manual server rebuilds are a fallback only:

```bash
cd ~/sda-service-request
git pull --ff-only
sudo sh deploy/aws/ensure-swap.sh
docker compose \
  -f deploy/aws/docker-compose.low-cost.yml \
  --env-file deploy/aws/lightsail.env \
  up -d --build
```

## Backups

Because this low-cost setup keeps PostgreSQL on the same instance, configure backups. A simple manual backup command is:

```bash
docker compose -f deploy/aws/docker-compose.low-cost.yml --env-file deploy/aws/lightsail.env exec postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > sda-service-request-$(date +%Y%m%d-%H%M).sql
```

For production, automate backups to S3 or another machine.

## Notes

S3 + CloudFront static hosting from the older setup is not used here because this app is not a static frontend. If you later split the UI from the API, you can reintroduce S3 + CloudFront for the frontend.

If you later put CloudFront in front of Lightsail, use a custom HTTP origin that points to the Lightsail/Caddy hostname. Do not use an S3 origin, and do not configure `index.html` as the default root object.
