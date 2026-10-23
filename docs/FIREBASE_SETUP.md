# Firebase Setup Guide for ShopLedger SaaS

This document guides project owners through configuring Firebase for the **ShopLedger** multi-tenant SaaS application.

---

## 1. Create a Firebase Project

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Name your project (e.g., `shopledger-saas` or your preferred company name).
4. Google Analytics is optional; you may enable or skip it.
5. Click **Create Project** and wait for provisioning to complete.

---

## 2. Register a Web Application

1. In the Firebase Project Overview screen, click the **Web** icon (`</>`) to add an app.
2. Enter an app nickname: `shopledger-web`.
3. Check **Also set up Firebase Hosting for this app** (optional, recommended).
4. Click **Register app**.
5. Copy the configuration object values (`apiKey`, `authDomain`, `projectId`, etc.).
6. In your local repository root, create a file named `.env.local` based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
7. Paste the copied values into `.env.local`.

---

## 3. Enable Cloud Firestore Database

1. In the left-hand navigation, select **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a Firestore location nearest to your primary customers (e.g., `asia-south1` for South Asia, `us-central` for North America).
4. Choose **Start in production mode** (this enforces restrictive security rules by default).
5. Click **Create**.

---

## 4. Deploying Firestore Security Rules and Indexes

Deploy the restrictive security rules and composite indexes included in this repository using the Firebase CLI:

```bash
# Install Firebase CLI if not already installed globally
npm install -g firebase-tools

# Log in to your Firebase account
firebase login

# Link your local directory to your Firebase project
firebase use --add

# Deploy security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 5. Security & Isolation Verification

- Client applications communicate directly with Firestore using authenticated tokens (`request.auth.uid`).
- Strict tenant checks (`isWorkspaceMember(workspaceId)`) ensure no shop can view another shop's records.
- Privilege elevation (upgrades to paid tiers) is blocked at the rule level.
