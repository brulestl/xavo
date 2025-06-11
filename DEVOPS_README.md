# DevOps Infrastructure

This document outlines the complete CI/CD pipeline and DevOps infrastructure for the Corporate Influence Coach project.

## 🚀 Overview

The DevOps setup provides:
- ✅ Automated testing and linting on every PR
- ✅ Visual regression testing with Percy/Chromatic
- ✅ One-click QR code previews for mobile testing
- ✅ Automatic deployment to production on main branch
- ✅ Nightly changelog generation
- ✅ Commit message linting (Conventional Commits)

## 📋 Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

### Core Secrets
```
EXPO_TOKEN                    # Expo authentication token
EXPO_PUBLIC_SUPABASE_URL     # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous key
OPENAI_KEY                   # OpenAI API key for backend
STRIPE_KEY                   # Stripe API key for payments
```

### Deployment Secrets
```
RAILWAY_TOKEN                # Railway deployment token
```

### Visual Testing (Optional)
```
PERCY_TOKEN                  # Percy visual testing token
CHROMATIC_PROJECT_TOKEN      # Chromatic visual testing token
CODECOV_TOKEN               # Code coverage reporting
```

### Notifications (Optional)
```
SLACK_WEBHOOK_URL           # Slack webhook for daily digest notifications
```

## 🔄 Workflows

### 1. Main CI/CD Pipeline (`.github/workflows/ci.yaml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**
1. **Lint & Test** - ESLint, TypeScript checking, Jest tests
2. **Build Frontend** - Expo web build validation
3. **Build Backend** - NestJS TypeScript compilation
4. **Visual Testing** - Percy/Chromatic snapshot testing (PR only)
5. **Expo Preview** - EAS Update to `ui-preview` channel (PR only)
6. **Deploy Production** - Railway + EAS production deployment (main only)
7. **Commit Lint** - Conventional Commits validation (PR only)

### 2. Nightly Summarizer (`.github/workflows/nightly-summarizer.yaml`)

**Triggers:**
- Daily at 2 AM UTC
- Manual workflow dispatch

**Actions:**
- Analyzes previous day's commits, PRs, and issues
- Updates `CHANGELOG_AUTO.md` with daily digest
- Sends summary to Slack (if configured)

## 📱 Mobile Preview System

### EAS Update Channels

| Channel | Purpose | Trigger |
|---------|---------|---------|
| `ui-preview` | PR previews | Every PR to main/develop |
| `production` | Live app | Merge to main |
| `development` | Dev builds | Manual |

### QR Code Generation

Every PR automatically generates:
- EAS Update to `ui-preview` channel
- QR code for mobile testing
- Comment on PR with preview instructions

## 🛡️ Quality Gates

### Build Requirements
- ✅ All tests must pass
- ✅ ESLint checks must pass
- ✅ TypeScript compilation must succeed
- ✅ Visual diff threshold ≤ 0.2 (80% pixel match)

### Commit Requirements
- ✅ Conventional Commits format required
- ✅ Commit messages must be under 100 characters
- ✅ Valid commit types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

### Deployment Guards
- ✅ Only main branch can deploy to production
- ✅ All CI checks must pass before deployment
- ✅ Automatic rollback on health check failure

## 🔧 Local Development

### Setup ESLint
```bash
# Frontend
npm run lint
npm run lint:fix

# Backend
cd api
npm run lint
```

### Setup Commitlint
```bash
# Install commitlint globally (optional)
npm install -g @commitlint/cli @commitlint/config-conventional

# Test commit message
echo "feat: add new feature" | npx commitlint
```

### Test EAS Updates Locally
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create update
eas update --channel ui-preview --message "Local test"
```

## 📊 Monitoring & Observability

### Build Status
- GitHub Actions dashboard shows all workflow runs
- Failed builds block PR merging
- Deployment status visible in GitHub

### Visual Testing
- Percy/Chromatic provide visual diff reports
- Automatic failure on significant visual changes
- Historical visual regression tracking

### Daily Digest
- `CHANGELOG_AUTO.md` updated nightly
- Slack notifications for team awareness
- Git activity tracking and reporting

## 🚨 Troubleshooting

### Common Issues

**1. EAS Update Fails**
```bash
# Check Expo token
eas whoami

# Verify project configuration
eas project:info
```

**2. Railway Deployment Fails**
```bash
# Check Railway token
railway whoami

# Verify service configuration
railway status
```

**3. Visual Tests Fail**
- Check Percy/Chromatic project tokens
- Verify visual diff threshold settings
- Review snapshot changes in dashboard

**4. Commit Lint Fails**
```bash
# Check commit message format
git log --oneline -1

# Fix commit message
git commit --amend -m "feat: proper commit message"
```

### Emergency Procedures

**Rollback Production Deployment:**
```bash
# Revert to previous EAS update
eas update --channel production --message "Rollback" --republish

# Rollback Railway deployment
railway rollback
```

**Disable CI Temporarily:**
```yaml
# Add to workflow file
if: false  # Disables the job
```

## 📈 Metrics & KPIs

### CI/CD Performance
- Build time: Target < 10 minutes
- Test coverage: Target > 80%
- Deployment frequency: Multiple per day
- Lead time: < 1 hour from commit to production

### Quality Metrics
- Failed build rate: Target < 5%
- Visual regression rate: Target < 1%
- Rollback rate: Target < 2%
- Mean time to recovery: Target < 30 minutes

## 🔄 Maintenance

### Weekly Tasks
- Review failed builds and fix root causes
- Update dependency versions
- Check visual test coverage
- Review deployment metrics

### Monthly Tasks
- Audit GitHub secrets and rotate if needed
- Review and optimize build performance
- Update CI/CD pipeline dependencies
- Analyze deployment patterns and optimize

### Quarterly Tasks
- Review and update DevOps strategy
- Evaluate new tools and integrations
- Conduct disaster recovery testing
- Update documentation and runbooks

## 📚 Additional Resources

- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [Railway Deployment Guide](https://docs.railway.app/)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Percy Visual Testing](https://percy.io/docs)
- [Chromatic Visual Testing](https://www.chromatic.com/docs/)

---

*This infrastructure ensures the main branch is always deployable with comprehensive testing, automated previews, and reliable deployment pipelines.*