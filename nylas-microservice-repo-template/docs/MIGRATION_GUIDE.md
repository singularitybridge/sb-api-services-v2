# Migration Guide: Extracting Nylas Microservices

Step-by-step guide to extract Nylas microservices from the main repository and set up as a standalone repository.

## 📋 Overview

**Goal:** Move `nylas-service` and `nylas-webhooks` from `sb-api-services-v2` to a new standalone repository with fork-based workflow.

**Timeline:** ~2-3 hours

**Risk:** Low (non-breaking change)

**Workflow:** Fork-based development (same as sb-api-services-v2)
- Organization repo: `singularitybridge/nylas-service` (deployment source)
- Your fork: `IgorIgorH/nylas-service` (development source)
- Pull requests: Fork → Organization repo
- Deployment: Manual trigger from organization repo only

## 🚀 Phase 1: Create New Repository

### 1.1 Create GitHub Repository

1. Go to https://github.com/singularitybridge
2. Click "New repository"
3. **Name:** `nylas-service`
4. **Description:** "Nylas API microservices for SingularityBridge platform"
5. **Visibility:** Private
6. **Initialize:** Do NOT add README, .gitignore, or license (we'll add our own)
7. Click "Create repository"

### 1.2 Clone Template to New Repo

On your local machine:

```bash
# Clone the new empty repository
git clone https://github.com/singularitybridge/nylas-service.git
cd nylas-service

# Copy template files from this directory
cp -r /path/to/nylas-microservice-repo-template/* .
cp -r /path/to/nylas-microservice-repo-template/.github .
cp /path/to/nylas-microservice-repo-template/.env.example .

# Verify structure
ls -la
# Should see: .github/, services/, docs/, scripts/, docker-compose.yml, README.md, etc.
```

## 🔧 Phase 2: Copy Service Code

### 2.1 Copy Nylas API Service

```bash
# Navigate to the nylas-service repository
cd /path/to/nylas-service

# Copy code from main repo
cp -r /path/to/sb-api-services-v2/nylas-service/* services/nylas-api/

# Verify
ls services/nylas-api/
# Should see: src/, package.json, tsconfig.json, etc.
```

### 2.2 Copy Nylas Webhooks Service

```bash
# Copy webhooks service
cp -r /path/to/sb-api-services-v2/nylas-webhooks/* services/nylas-webhooks/

# Verify
ls services/nylas-webhooks/
# Should see: src/, package.json, tsconfig.json, etc.
```

### 2.3 Update Package.json (if needed)

Check and update service names:

**services/nylas-api/package.json:**
```json
{
  "name": "@singularitybridge/nylas-api",
  "version": "1.0.0",
  ...
}
```

**services/nylas-webhooks/package.json:**
```json
{
  "name": "@singularitybridge/nylas-webhooks",
  "version": "1.0.0",
  ...
}
```

## 🐳 Phase 3: Test Locally

### 3.1 Install Dependencies

```bash
# Install for nylas-api
cd services/nylas-api
npm install
npm run build
cd ../..

# Install for nylas-webhooks
cd services/nylas-webhooks
npm install
npm run build
cd ../..
```

### 3.2 Configure Environment

```bash
# Create .env file
cp .env.example .env

# Edit with real credentials
nano .env
```

Add your credentials:
```bash
NYLAS_CLIENT_ID=your_client_id
NYLAS_CLIENT_SECRET=nyk_v0_xKAe4ni3q1f2Smax75Qol3eeIOpj3hlUaXzlgnnUjFBTlprdTpaE76gv4NXnOQMw
NYLAS_WEBHOOK_SECRET=your_webhook_secret
```

### 3.3 Test with Docker Compose

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health

# Expected response:
# {"status":"ok","service":"nylas-service","timestamp":"..."}
```

### 3.4 Run Integration Tests

```bash
# Test contacts endpoint
curl "http://localhost:3001/contacts/list?grantId=YOUR_GRANT_ID&limit=3"

# Test email endpoint
curl "http://localhost:3001/email/search?grantId=YOUR_GRANT_ID&limit=3"

# Should return valid responses
```

## 📤 Phase 4: Push to GitHub & Setup Fork

### 4.1 Initial Commit to Organization Repo

```bash
# Add all files
git add .

# Commit
git commit -m "feat: Initial Nylas microservice repository setup

- Add nylas-api service (port 3001)
- Add nylas-webhooks service (port 3002)
- Add Docker configuration
- Add GitHub Actions CI/CD
- Add comprehensive documentation

Extracted from sb-api-services-v2"

# Push to organization repository
git push origin main
```

### 4.2 Create Your Fork

Now that the organization repo has the initial code, create your fork:

1. Go to https://github.com/singularitybridge/nylas-service
2. Click "Fork" button (top right)
3. Select your account (IgorIgorH)
4. Uncheck "Copy the main branch only" (to get all branches if any)
5. Click "Create fork"
6. Result: https://github.com/IgorIgorH/nylas-service

### 4.3 Switch to Fork for Development

```bash
# Go back to parent directory
cd ..

# Remove organization clone
rm -rf nylas-service

# Clone YOUR FORK
git clone https://github.com/IgorIgorH/nylas-service.git
cd nylas-service

# Add organization repo as upstream
git remote add upstream https://github.com/singularitybridge/nylas-service.git

# Verify remotes
git remote -v
# Should show:
#   origin    https://github.com/IgorIgorH/nylas-service.git (fetch)
#   origin    https://github.com/IgorIgorH/nylas-service.git (push)
#   upstream  https://github.com/singularitybridge/nylas-service.git (fetch)
#   upstream  https://github.com/singularitybridge/nylas-service.git (push)
```

### 4.4 Configure GitHub Secrets (Organization Repo Only)

**Important:** Secrets go in **organization repo** (singularitybridge/nylas-service), NOT your fork.

Go to https://github.com/singularitybridge/nylas-service → Settings → Secrets → Actions:

Add these secrets:
- `HETZNER_HOST`: 135.181.95.194
- `HETZNER_USER`: root
- `SSH_PRIVATE_KEY`: (paste your SSH private key)

**Note:** Your fork does NOT need these secrets. This prevents accidental deployments from your fork.

### 4.5 Test GitHub Actions

When you create a PR from your fork, CI will run automatically. For now, verify:
1. Go to https://github.com/singularitybridge/nylas-service → Actions tab
2. Verify initial commit triggered CI workflow
3. All jobs should pass ✅

## 🚀 Phase 5: Deploy to Production

### 5.1 Server Setup

SSH to Hetzner server:
```bash
ssh root@135.181.95.194
```

Create deployment directory:
```bash
mkdir -p /var/lib/coolify/applications/nylas-service
cd /var/lib/coolify/applications/nylas-service

# Clone the new repository
git clone https://github.com/singularitybridge/nylas-service.git .
```

Create production .env:
```bash
cp .env.example .env
nano .env
# Add production credentials
```

Create Docker network:
```bash
docker network create singularitybridge-network || echo "Already exists"
```

### 5.2 Initial Deployment

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for startup
sleep 15

# Health checks
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 5.3 Verify from Main App

From main app server/container:
```bash
# Test connectivity
curl http://127.0.0.1:3001/health
# Or via Docker network
curl http://nylas-api:3001/health
```

## 🔄 Phase 6: Update Main App

### 6.1 Update Environment Variables

In `sb-api-services-v2/.env`:

```bash
# Microservice URLs
NYLAS_SERVICE_URL=http://127.0.0.1:3001
WEBHOOKS_SERVICE_URL=http://127.0.0.1:3002

# Or use Docker network (in production)
NYLAS_SERVICE_URL=http://nylas-api:3001
WEBHOOKS_SERVICE_URL=http://nylas-webhooks:3002
```

### 6.2 Test Integration

Test that main app can communicate with microservices:

```bash
# From main app, test a contact request
# This should go through NylasClient → Microservice
# Check microservice logs to verify:
docker-compose -f /var/lib/coolify/applications/nylas-service/docker-compose.prod.yml logs -f
```

### 6.3 Monitor for Issues

Monitor for 1 hour after deployment:
- Check main app logs
- Check microservice logs
- Test critical operations (contacts, emails, calendar)
- Verify no errors

## 🔄 Phase 6A: Ongoing Development Workflow

After initial setup, use this fork-based workflow for all future changes:

### Making Changes

```bash
# 1. Work from your fork
cd /path/to/nylas-service  # Your fork (IgorIgorH/nylas-service)

# 2. Sync with upstream (organization repo)
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

# 3. Create feature branch
git checkout -b feature/my-feature

# 4. Make your changes
# ... edit code ...

# 5. Test locally
docker-compose up -d
# Test your changes

# 6. Commit and push to YOUR FORK
git add .
git commit -m "feat: description of change"
git push origin feature/my-feature

# 7. Create Pull Request
# Go to https://github.com/IgorIgorH/nylas-service
# GitHub will show "Compare & pull request" button
# Base: singularitybridge:main ← Head: IgorIgorH:feature/my-feature
# Create PR with description
```

### After PR Review & Merge

```bash
# 1. Sync your fork with upstream
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

# 2. Delete feature branch
git branch -d feature/my-feature
git push origin --delete feature/my-feature

# 3. (Optional) Manually deploy if changes require it
# Go to https://github.com/singularitybridge/nylas-service
# Actions → Deploy to Production → Run workflow
# Select branch: main, environment: production
# Click "Run workflow"
```

### Manual Deployment

**Important:** Deployments are manual only and can only be triggered from the organization repository.

**To deploy changes:**

1. Ensure PR is merged to `singularitybridge/nylas-service` main branch
2. Go to https://github.com/singularitybridge/nylas-service (organization repo, not fork)
3. Click "Actions" tab
4. Select "Deploy to Production" workflow
5. Click "Run workflow" button
6. Select:
   - Branch: `main` (or `develop` for staging)
   - Environment: `production` (or `staging`)
7. Click "Run workflow" to start deployment
8. Monitor workflow logs for success/failure
9. Verify health checks pass after deployment

**Why manual deployment?**
- ✅ Prevents accidental production deployments
- ✅ Allows controlled release timing
- ✅ Enables review before deployment
- ✅ Deployment secrets only in organization repo (security)

## 🧹 Phase 7: Cleanup Main Repo (Optional)

Once microservices are stable (after 1 week), remove from main repo:

### 7.1 Create Feature Branch

```bash
cd /path/to/sb-api-services-v2
git checkout -b feature/remove-embedded-microservices
```

### 7.2 Remove Microservice Directories

```bash
# Remove directories
git rm -r nylas-service/
git rm -r nylas-webhooks/

# Update documentation
# Edit README.md, CLAUDE.md, etc. to point to new repository
```

### 7.3 Update Documentation

Add to `INTEGRATION_GUIDE.md`:
```markdown
# Nylas Microservices

The Nylas integration now runs as a separate microservice.

**Repository:** https://github.com/singularitybridge/nylas-service

**Endpoints:**
- Nylas API: http://127.0.0.1:3001
- Webhooks: http://127.0.0.1:3002

See NylasClient (`src/lib/nylas-client.ts`) for integration.
```

### 7.4 Create PR

```bash
git commit -m "refactor: Extract Nylas microservices to standalone repository

Microservices moved to: https://github.com/singularitybridge/nylas-service

- Remove nylas-service/ directory
- Remove nylas-webhooks/ directory
- Update integration documentation
- Main app now uses microservices via NylasClient"

git push origin feature/remove-embedded-microservices
```

Create PR and get approval before merging.

## ✅ Verification Checklist

Before considering migration complete:

- [ ] New repository created and pushed
- [ ] GitHub Actions CI passing
- [ ] Services deployed to production
- [ ] Health checks responding
- [ ] Main app can connect to microservices
- [ ] Contacts operations working
- [ ] Email operations working
- [ ] Calendar operations working
- [ ] Logs show no errors
- [ ] Monitored for 1 hour with no issues
- [ ] Team notified of new repository
- [ ] Documentation updated

## 🚨 Rollback Plan

If something goes wrong:

### Quick Rollback (Main App)

```bash
# If main app breaks, revert environment variables
cd /path/to/sb-api-services-v2
git checkout .env
# Restart main app
```

### Rollback Microservice

```bash
# SSH to server
ssh root@135.181.95.194
cd /var/lib/coolify/applications/nylas-service

# Find last working commit
git log --oneline -10

# Rollback
git checkout <commit-hash>
docker-compose -f docker-compose.prod.yml up -d --build
```

### Emergency: Go Back to Embedded

```bash
# If microservices completely fail
# Main app can fall back to makeNylasRequestLegacy() temporarily
# (Keep this code for 1 month before removing)
```

## 📞 Support

Questions or issues:
- Check #devops Slack
- Review DEPLOYMENT.md
- Contact DevOps team

---

**Estimated Time:** 2 hours  
**Risk Level:** Low  
**Downtime:** None (zero-downtime migration)
