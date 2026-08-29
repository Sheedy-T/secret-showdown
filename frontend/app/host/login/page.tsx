"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function HostLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // LOGIN
  // =====================================================

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      // -------------------------------------------------
      // SUPABASE LOGIN
      // -------------------------------------------------

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error(
          loginError.message
        );
      }

      if (!data.session) {
        throw new Error(
          "Login was successful, but no session was created."
        );
      }

      // -------------------------------------------------
      // GET ACCESS TOKEN
      // -------------------------------------------------

      const accessToken =
        data.session.access_token;

      // -------------------------------------------------
      // ASK OUR BACKEND WHO THIS USER IS
      // -------------------------------------------------
      //
      // The backend will check:
      //
      // role   = HOST
      // status = APPROVED
      //
      // -------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/host/me`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

      const result =
        await response.json();

      // -------------------------------------------------
      // BACKEND DENIED ACCESS
      // -------------------------------------------------

      if (!response.ok) {
        throw new Error(
          result.detail ||
          "You are not authorized to access the Host Dashboard."
        );
      }

      // -------------------------------------------------
      // HOST IS APPROVED
      // -------------------------------------------------

      router.replace("/host");

    } catch (error) {
      console.error(
        "Host login error:",
        error
      );

      // If backend denied the account, sign
      // the user back out so a rejected/pending
      // host does not remain logged in.

      await supabase.auth.signOut();

      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "32px",
          borderRadius: "16px",
          background: "white",
          boxShadow:
            "0 10px 40px rgba(0,0,0,0.10)",
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "42px",
              marginBottom: "10px",
            }}
          >
            🎮
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            Host Login
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#666",
            }}
          >
            Sign in to manage your Secret
            Showdown game.
          </p>
        </div>

        {/* =================================================
            LOGIN FORM
        ================================================= */}

        <form
          onSubmit={handleLogin}
        >

          {/* EMAIL */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="host@example.com"
              autoComplete="email"
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          {/* PASSWORD */}

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          {/* ERROR */}

          {error && (
            <div
              style={{
                marginBottom: "18px",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#fff1f1",
                border:
                  "1px solid #ffcccc",
                color: "#b00020",
                fontSize: "14px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              border: "none",
              borderRadius: "8px",
              background: loading
                ? "#999"
                : "#111",
              color: "white",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Checking account..."
              : "Sign In as Host"}
          </button>

        </form>

        {/* =================================================
            SECURITY NOTICE
        ================================================= */}

        <div
          style={{
            marginTop: "24px",
            padding: "14px",
            borderRadius: "8px",
            background: "#f7f7f7",
            fontSize: "13px",
            lineHeight: 1.5,
            color: "#555",
          }}
        >
          🔒 Host access is restricted.

          <br />

          Your account must be approved by
          the Secret Showdown Founder before
          you can conduct a game session.
        </div>

      </section>
    </main>
  );
}