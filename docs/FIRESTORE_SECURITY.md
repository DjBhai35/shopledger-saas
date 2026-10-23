# Firestore Security Rules & Access Control

ShopLedger SaaS enforces strict, non-permissive security rules stored in `firestore.rules`.

---

## 1. Core Principles

1. **Deny All by Default**:
   ```javascript
   match /{document=**} {
     allow read, write: if false;
   }
   ```
2. **Deterministic Document IDs for Fast Membership Checking**:
   Membership documents use the deterministic key pattern:
   `mem_{workspaceId}_{userId}`.
   This enables rules to look up memberships in $O(1)$ time without collection scans:
   ```javascript
   function isWorkspaceMember(workspaceId) {
     return isAuthenticated() && 
       exists(/databases/$(database)/documents/memberships/$(membershipDocId(workspaceId, request.auth.uid)));
   }
   ```
3. **No Frontend Filtering Assumption**:
   Frontend filters only organize data for display. Security rules strictly verify that `resource.data.workspaceId` matches the caller's authorized workspace memberships.
4. **Subscription Tampering Protection**:
   Users can only initialize the `free` plan ($0) during workspace onboarding. Updating subscriptions from the client SDK is completely forbidden (`allow update, delete: if false;`). Upgrades must come from trusted Cloud Functions using the Firebase Admin SDK.
5. **No Self-Role Elevation**:
   Only workspace owners can alter membership roles.

---

## 2. Deploying Rules to Production

```bash
firebase deploy --only firestore:rules
```

---

## 3. Testing Rules Locally with Firebase Emulator Suite

```bash
firebase emulators:start --only firestore,auth
```
