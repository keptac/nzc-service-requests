# Low-Cost AWS Lightsail Deployment

This repo is a dynamic Next.js full-stack app with API routes, authentication, file uploads, PDF generation, and Prisma. It should run as one server-side app, not as a static S3 frontend.

The cheapest practical AWS setup is:

- App: one small Lightsail Linux instance
- Database: PostgreSQL on the same Lightsail instance
- HTTPS reverse proxy: Caddy
- Region: `us-east-1`

The stack in this folder runs:

- `postgres`
- `app` running Next.js
- `caddy` for automatic HTTPS

## AWS Resources

Create these in `us-east-1`:

1. One Lightsail Linux instance, Ubuntu LTS
2. One Lightsail static IP attached to the instance
3. DNS `A` record for your app domain pointing to the static IP

Open these Lightsail firewall ports:

- `22` SSH
- `80` HTTP
- `443` HTTPS

Do not open `5432`. PostgreSQL stays private inside Docker.

## Recommended Instance

- Lowest workable: `Linux/Unix $7/month`, 1 GB RAM
- Safer: `Linux/Unix $12/month`, 2 GB RAM

On the `$7/month` instance, add swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
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

Generate secrets with:

```bash
openssl rand -hex 32
```

Start the stack:

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

## GitHub Actions CI/CD

The workflow is:

- `.github/workflows/deploy-aws.yml`

It does:

1. Install dependencies
2. Run typecheck
3. Run tests
4. Build the Next.js app
5. SSH to Lightsail
6. `git pull --ff-only`
7. `docker compose ... up -d --build`

Run the manual server setup at least once before relying on the workflow.

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

```bash
cd ~/sda-service-request
git pull --ff-only
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
