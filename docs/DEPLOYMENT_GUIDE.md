# Deployment and GitHub Repository Guide

This guide describes how to deploy ShopLedger SaaS and maintain the GitHub repository.

---

## 1. GitHub Repository Information

- **Repository**: [https://github.com/DjBhai35/shopledger-saas](https://github.com/DjBhai35/shopledger-saas)
- **Primary Branch**: `main`
- **Owner**: `DjBhai35`

### Git Workflow

```bash
# Check repository status
git status

# Create a feature branch
git checkout -b feature/phase2-pos-billing

# Add changes and commit with descriptive messages
git add .
git commit -m "feat: implement thermal POS receipt printing"

# Push to origin
git push -u origin feature/phase2-pos-billing
```

---

## 2. Deploying to Firebase Hosting

1. Build the production application:
   ```bash
   npm run build
   ```
2. Deploy static output and functions to Firebase:
   ```bash
   firebase deploy --only hosting
   ```

---

## 3. Deploying to Vercel (Alternative Cloud Deployment)

1. Push code to `main` on GitHub.
2. Link repository in [Vercel Dashboard](https://vercel.com/).
3. Add the environment variables from `.env.example` in the Vercel Project Settings.
4. Automatic deployment is triggered on every push to `main`.
