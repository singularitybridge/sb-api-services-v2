# Deployment Guide

Complete guide for deploying Nylas microservices to production.

## 📋 Prerequisites

- Access to Hetzner server (135.181.95.194)
- SSH key configured for server access
- Coolify installed and configured
- Docker and Docker Compose installed
- GitHub repository access

## 🚀 Initial Setup (One-time)

### 1. Server Preparation

SSH to Hetzner server:
```bash
ssh root@135.181.95.194
```

Create deployment directory:
```bash
mkdir -p /var/lib/coolify/applications/nylas-service
cd /var/lib/coolify/applications/nylas-service
```

Clone repository:
```bash
git clone https://github.com/singularitybridge/nylas-service.git .
```

### 2. Environment Configuration

Create production `.env` file:
```bash
cp .env.example .env
nano .env
```

Add production values:
```bash
# Nylas API Service
NYLAS_CLIENT_ID=your_real_client_id
NYLAS_CLIENT_SECRET=nyk_v0_xKAe4ni3q1f2Smax75Qol3eeIOpj3hlUaXzlgnnUjFBTlprdTpaE76gv4NXnOQMw
NYLAS_API_URL=https://api.us.nylas.com
NYLAS_REDIRECT_URI=https://api.singularitybridge.net/nylas/oauth/callback
NYLAS_SUCCESS_REDIRECT=https://app.singularitybridge.net/settings/integrations?connected=true
NYLAS_ERROR_REDIRECT=https://app.singularitybridge.net/settings/integrations?error=auth_failed

# Nylas Webhooks Service
NYLAS_WEBHOOK_SECRET=your_webhook_secret
MONGODB_URI=mongodb://localhost:27017/singularitybridge

# Service Configuration
NODE_ENV=production
```

### 3. Docker Network Setup

Create shared Docker network:
```bash
docker network create singularitybridge-network || echo "Network already exists"
```

Connect main app to network (if not already connected):
```bash
# Find main app container ID
docker ps | grep "sb-api-services"

# Connect it to the network
docker network connect singularitybridge-network <container-id>
```

### 4. Initial Deployment

Build and start services:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Verify services are running:
```bash
docker-compose -f docker-compose.prod.yml ps
```

Check health:
```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health
```

View logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔄 Automatic Deployment (GitHub Actions)

### 1. Configure GitHub Secrets

In the repository settings, add these secrets:
- `HETZNER_HOST`: 135.181.95.194
- `HETZNER_USER`: root
- `SSH_PRIVATE_KEY`: SSH private key for server access

### 2. Trigger Deployment

Push to main branch:
```bash
git push origin main
```

Or manually trigger from GitHub Actions tab:
1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Select branch: main
4. Click "Run workflow"

### 3. Monitor Deployment

Watch GitHub Actions logs:
- Go to repository → Actions tab
- Click on the running workflow
- Monitor each step

SSH to server to check:
```bash
ssh root@135.181.95.194
cd /var/lib/coolify/applications/nylas-service
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔧 Manual Deployment

If automatic deployment fails, deploy manually:

```bash
# SSH to server
ssh root@135.181.95.194

# Navigate to deployment directory
cd /var/lib/coolify/applications/nylas-service

# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to start
sleep 15

# Health checks
curl -f http://127.0.0.1:3001/health || echo "Nylas API failed"
curl -f http://127.0.0.1:3002/health || echo "Nylas Webhooks failed"

# View status
docker-compose -f docker-compose.prod.yml ps
```

## 🔙 Rollback Procedure

If deployment breaks something:

### Option 1: Rollback to Previous Commit

```bash
# SSH to server
ssh root@135.181.95.194
cd /var/lib/coolify/applications/nylas-service

# Find previous working commit
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Rebuild with old code
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Verify
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health
```

### Option 2: Rollback via Git

```bash
# Revert the problematic commit locally
git revert <bad-commit-hash>

# Push to main (triggers automatic deployment)
git push origin main
```

## 📊 Post-Deployment Verification

### 1. Health Checks

```bash
# Check both services
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health

# Expected response:
# {"status":"ok","service":"nylas-service","timestamp":"...","uptime":123.45}
```

### 2. Service Info

```bash
# Get service information
curl http://127.0.0.1:3001/info
curl http://127.0.0.1:3002/info
```

### 3. Test Integration with Main App

From main app server:
```bash
# Test connection to microservices
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health
```

### 4. Monitor Logs

```bash
# Live logs
docker-compose -f docker-compose.prod.yml logs -f

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100

# Specific service
docker-compose -f docker-compose.prod.yml logs -f nylas-api
```

## 🐛 Troubleshooting

### Services Won't Start

Check logs:
```bash
docker-compose -f docker-compose.prod.yml logs
```

Check environment variables:
```bash
docker-compose -f docker-compose.prod.yml config
```

Rebuild from scratch:
```bash
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Health Checks Fail

Check if services are listening:
```bash
docker-compose -f docker-compose.prod.yml ps
netstat -tlnp | grep -E "3001|3002"
```

Check container logs:
```bash
docker-compose -f docker-compose.prod.yml logs nylas-api
docker-compose -f docker-compose.prod.yml logs nylas-webhooks
```

Exec into container:
```bash
docker exec -it nylas-api sh
curl http://localhost:3001/health
```

### Main App Can't Connect

Check Docker network:
```bash
docker network inspect singularitybridge-network
```

Ensure main app is connected:
```bash
docker network connect singularitybridge-network <main-app-container>
```

Test connectivity from main app:
```bash
docker exec -it <main-app-container> sh
curl http://nylas-api:3001/health
curl http://nylas-webhooks:3002/health
```

### Port Already in Use

Find what's using the port:
```bash
lsof -i :3001
lsof -i :3002
```

Stop conflicting service:
```bash
# If old version is running
docker stop nylas-api nylas-webhooks
# Or kill process
kill <PID>
```

## 🔒 Security Checklist

- [ ] `.env` file has production credentials
- [ ] Services bind to 127.0.0.1 only
- [ ] Docker network properly configured
- [ ] Webhook secret is set and secure
- [ ] SSH keys are properly secured
- [ ] GitHub secrets are configured
- [ ] Logs don't expose sensitive data

## 📝 Deployment Checklist

Before deploying:
- [ ] Code reviewed and approved
- [ ] Tests passing in CI
- [ ] Docker build succeeds
- [ ] Environment variables updated (if needed)
- [ ] Database migrations run (if needed)
- [ ] Main app compatible with changes

After deploying:
- [ ] Health checks pass
- [ ] Services responding correctly
- [ ] Main app can connect to microservices
- [ ] No errors in logs
- [ ] Monitor for 15 minutes

## 📞 Escalation

If deployment issues persist:
1. Check #devops Slack channel
2. Review recent commits for breaking changes
3. Contact DevOps team
4. Consider rollback if critical

---

**Last Updated:** December 2025  
**Maintained by:** DevOps Team
