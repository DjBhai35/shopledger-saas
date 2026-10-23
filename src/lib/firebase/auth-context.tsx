"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./config";
import {
  UserProfile,
  Workspace,
  WorkspaceSubscription,
  WorkspaceMembership,
} from "@/types";
import {
  syncUserProfile,
  getUserMemberships,
  getWorkspace,
  getWorkspaceSubscription,
} from "./workspace";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  workspace: Workspace | null;
  subscription: WorkspaceSubscription | null;
  memberships: WorkspaceMembership[];
  loading: boolean;
  error: string | null;
  isFirebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemoUser: (email?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Load active workspace details
  const loadWorkspaceData = useCallback(async (uid: string) => {
    try {
      const userMems = await getUserMemberships(uid);
      setMemberships(userMems);

      if (userMems.length > 0) {
        // Load the first workspace or saved active one
        const activeMem = userMems[0];
        const ws = await getWorkspace(activeMem.workspaceId);
        if (ws) {
          setWorkspace(ws);
          const sub = await getWorkspaceSubscription(ws.id);
          setSubscription(sub);
          return ws;
        }
      }
      setWorkspace(null);
      setSubscription(null);
      return null;
    } catch (err: unknown) {
      console.error("Error loading workspace data:", err);
      return null;
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (user?.uid) {
      await loadWorkspaceData(user.uid);
    }
  }, [user, loadWorkspaceData]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const ws = await getWorkspace(workspaceId);
    if (ws) {
      setWorkspace(ws);
      const sub = await getWorkspaceSubscription(ws.id);
      setSubscription(sub);
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Check for local demo session
      const demoUserJson = typeof window !== "undefined" ? localStorage.getItem("demo_user") : null;
      if (demoUserJson) {
        try {
          const demoUser = JSON.parse(demoUserJson);
          setUser(demoUser as unknown as FirebaseUser);
          setUserProfile({
            uid: demoUser.uid,
            email: demoUser.email,
            displayName: demoUser.displayName,
            photoURL: demoUser.photoURL,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          loadWorkspaceData(demoUser.uid).finally(() => setLoading(false));
          return;
        } catch {}
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);

      if (currentUser) {
        setUser(currentUser);
        try {
          const profile = await syncUserProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          });
          setUserProfile(profile);

          const ws = await loadWorkspaceData(currentUser.uid);

          // Route navigation guards
          if (!ws && pathname !== "/onboarding") {
            router.push("/onboarding");
          } else if (ws && (pathname === "/login" || pathname === "/onboarding")) {
            router.push("/dashboard");
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Authentication error");
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setWorkspace(null);
        setSubscription(null);
        setMemberships([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router, loadWorkspaceData]);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);

    if (!isFirebaseConfigured || !auth) {
      // In development/test mode before user configures keys, provide informative message
      setError(
        "Firebase credentials are not configured yet in .env.local. You can test with the Demo Sign-In below or provide your Firebase keys."
      );
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
      setUserProfile(profile);

      const ws = await loadWorkspaceData(result.user.uid);
      if (!ws) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Demo Sign-in for immediate testing when Firebase keys are not yet provided
   */
  const signInWithDemoUser = async (email = "owner@shopledger.app", name = "Shop Owner") => {
    setLoading(true);
    setError(null);
    const demoUid = `demo_user_${btoa(email).replace(/=/g, "").slice(0, 10)}`;

    const demoUser = {
      uid: demoUid,
      email,
      displayName: name,
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(name),
    } as unknown as FirebaseUser;

    if (typeof window !== "undefined") {
      localStorage.setItem("demo_user", JSON.stringify(demoUser));
    }

    setUser(demoUser);
    setUserProfile({
      uid: demoUid,
      email,
      displayName: name,
      photoURL: demoUser.photoURL,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const ws = await loadWorkspaceData(demoUid);
    setLoading(false);

    if (!ws) {
      router.push("/onboarding");
    } else {
      router.push("/dashboard");
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        await firebaseSignOut(auth);
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("demo_user");
      }
      setUser(null);
      setUserProfile(null);
      setWorkspace(null);
      setSubscription(null);
      setMemberships([]);
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        workspace,
        subscription,
        memberships,
        loading,
        error,
        isFirebaseReady: isFirebaseConfigured,
        signInWithGoogle,
        signInWithDemoUser,
        signOut,
        refreshWorkspace,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
