# Nylas Microservices

Standalone microservices for Nylas API integration in the SingularityBridge platform.

## 🏗️ Architecture

This repository contains two independent microservices:

1. **nylas-api** (Port 3001) - Main Nylas API operations (emails, calendar, contacts)
2. **nylas-webhooks** (Port 3002) - Webhook handling for real-time Nylas events

## 📦 Services

### Nylas API Service (`services/nylas-api/`)

Handles all Nylas API operations:
- Email management (search, send, retrieve)
- Calendar events (list, create, update, delete)
- Contacts management (CRUD operations)
- Free/busy availability checking
- OAuth authentication flow

**Health Check:** `http://127.0.0.1:3001/health`  
**Info Endpoint:** `http://127.0.0.1:3001/info`

### Nylas Webhooks Service (`services/nylas-webhooks/`)

Handles incoming webhooks from Nylas:
- Email notifications
- Calendar event updates
- Contact changes
- Webhook verification and security

**Health Check:** `http://127.0.0.1:3002/health`  
**Info Endpoint:** `http://127.0.0.1:3002/info`

## 🚀 Quick Start

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/singularitybridge/nylas-service.git
   cd nylas-service
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   nano .env  # Add your Nylas credentials
   ```

3. **Start services with Docker Compose:**
   ```bash
   docker-compose up
   ```

4. **Verify services are running:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3002/health
   ```

### Production Deployment

Deployment is automated via GitHub Actions. Push to `main` branch to trigger deployment:

```bash
git push origin main
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🔧 Configuration

### Environment Variables

**Nylas API Service:**
- `NYLAS_CLIENT_ID` - Nylas application client ID
- `NYLAS_CLIENT_SECRET` - Nylas API key
- `NYLAS_API_URL` - Nylas API base URL (default: https://api.us.nylas.com)
- `NYLAS_REDIRECT_URI` - OAuth callback URL
- `NYLAS_SUCCESS_REDIRECT` - Frontend redirect on OAuth success
- `NYLAS_ERROR_REDIRECT` - Frontend redirect on OAuth error

**Nylas Webhooks Service:**
- `NYLAS_WEBHOOK_SECRET` - Secret for webhook verification
- `NYLAS_API_URL` - Nylas API base URL
- `MONGODB_URI` - MongoDB connection string (for storing webhook data)

## 🧪 Testing

### Run Tests Locally

```bash
# Test Nylas API service
cd services/nylas-api
npm test

# Test Nylas Webhooks service
cd services/nylas-webhooks
npm test
```

### Integration Testing

```bash
# Start all services
docker-compose up -d

# Run integration tests
npm run test:integration
```

## 📊 Monitoring

### Health Checks

Both services expose health check endpoints:

```bash
# Check Nylas API
curl http://127.0.0.1:3001/health

# Check Nylas Webhooks
curl http://127.0.0.1:3002/health
```

### Logs

View logs using Docker Compose:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f nylas-api
docker-compose logs -f nylas-webhooks
```

## 🔐 Security

- Services bind to `127.0.0.1` in production (not exposed publicly)
- Communication with main app via internal Docker network
- Environment variables for sensitive credentials
- Webhook signature verification
- CORS configured for specific origins only

## 📚 API Documentation

### Nylas API Service Endpoints

- `GET /health` - Health check
- `GET /info` - Service information
- `POST /email/send` - Send email
- `GET /email/search` - Search emails
- `GET /calendar/events` - List calendar events
- `GET /contacts/list` - List contacts
- `POST /contacts` - Create contact
- `GET /oauth/authorize` - Start OAuth flow
- `GET /oauth/callback` - OAuth callback handler

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for complete API reference.

## 🤝 Contributing

This repository follows a **fork-based workflow**, similar to `sb-api-services-v2`.

### Quick Start for Contributors

1. **Fork the repository**
   - Go to https://github.com/singularitybridge/nylas-service
   - Click "Fork" button
   - Creates your fork: https://github.com/YOUR_USERNAME/nylas-service

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nylas-service.git
   cd nylas-service
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/singularitybridge/nylas-service.git
   git fetch upstream
   ```

4. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

5. **Make your changes**
   - Edit code
   - Test locally: `docker-compose up -d`
   - Run tests: `npm test` (in service directories)

6. **Commit with conventional commits**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

7. **Push to your fork**
   ```bash
   git push origin feature/my-feature
   ```

8. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Base: `singularitybridge/nylas-service` main
   - Head: `YOUR_USERNAME/feature/my-feature`
   - Add description and create PR

9. **After PR is merged**
   ```bash
   # Sync your fork
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

### Deployment

Deployments are **manual only** and can only be triggered from the **organization repository**:

1. Merge PR to `singularitybridge/nylas-service` main branch
2. Go to organization repo → Actions → Deploy to Production
3. Click "Run workflow"
4. Select branch and environment
5. Monitor deployment logs

**Note:** Forks cannot deploy (no deployment secrets). This prevents accidental production deployments.

### Guidelines

- Follow existing code style
- Write clear commit messages
- Test changes locally before pushing
- Update documentation if needed
- Keep PRs focused and small

## 📝 License

Private - SingularityBridge Internal Use Only

## 🔗 Related Repositories

- **Main App:** [sb-api-services-v2](https://github.com/singularitybridge/sb-api-services-v2)
- **Frontend:** (add link when available)

## 📞 Support

For issues or questions:
- Open an issue in this repository
- Contact the DevOps team
- See internal documentation

---

**Last Updated:** December 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
