# Google Sign-In Authentication Setup

ShopLedger SaaS uses **Firebase Authentication** with **Google Sign-In** as the primary authentication method. Phone number authentication is neither required nor enforced for login.

---

## 1. Enable Google Sign-In in Firebase Console

1. Open your project in the [Firebase Console](https://console.firebase.google.com/).
2. In the left navigation, select **Build > Authentication**.
3. If this is your first time, click **Get Started**.
4. Go to the **Sign-in method** tab.
5. Under **Additional providers**, click on **Google**.
6. Toggle the **Enable** switch.
7. Select a **Project support email** from the dropdown (your administrator email).
8. Click **Save**.

---

## 2. Configure Authorized Domains

Google Sign-In requires your app's host domain to be whitelisted:

1. In the **Authentication > Settings** tab, select **Authorized domains**.
2. Verify that `localhost` is listed (enabled by default for local development).
3. If you deploy to a custom domain (e.g., `app.shopledger.com`) or Vercel / Firebase Hosting URL (`your-app.web.app`), click **Add domain** and enter your production hostname.

---

## 3. OAuth Consent Screen (Google Cloud Console)

If you plan to use a custom brand name on the Google login popup:

1. Visit [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Select your Firebase project from the project dropdown.
3. Open the **OAuth consent screen** tab.
4. Set **Application name** to `ShopLedger SaaS`.
5. Upload your logo and set the support and privacy policy links.
6. Save and publish.

---

## 4. User UID Stability Guarantee

- All internal relations in ShopLedger link to `request.auth.uid`.
- Email addresses are stored for notifications and receipt communications, but the user's immutable reference across workspace memberships is always the stable Firebase UID.
