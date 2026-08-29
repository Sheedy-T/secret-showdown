"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function FounderLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // LOGIN
  // =========================================================

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

      // -----------------------------------------------------
      // SUPABASE LOGIN
      // -----------------------------------------------------

      const {
        data,
        error: loginError,
      } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (!data.session) {
        throw new Error(
          "Login was successful, but no session was created."
        );
      }

      // -----------------------------------------------------
      // GET ACCESS TOKEN
      // -----------------------------------------------------

      const accessToken =
        data.session.access_token;

      // -----------------------------------------------------
      // VERIFY FOUNDER WITH BACKEND
      // -----------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/founder/me`,
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

      // -----------------------------------------------------
      // BACKEND DENIED ACCESS
      // -----------------------------------------------------

      if (!response.ok) {
        throw new Error(
          result.detail ||
          "You are not authorized to access the Founder Dashboard."
        );
      }

      // -----------------------------------------------------
      // FOUNDER VERIFIED
      // -----------------------------------------------------

      router.replace("/founder");

    } catch (error) {
      console.error(
        "Founder login error:",
        error
      );

      // -----------------------------------------------------
      // IMPORTANT
      // -----------------------------------------------------
      //
      // If the Supabase login succeeded but the account
      // is not an approved Founder, sign the user back out.
      //
      // -----------------------------------------------------

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

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <main
      style={{
        minHeight: "100vh",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        padding: "24px",

        background:
          "linear-gradient(135deg, #09090b 0%, #17111f 45%, #2e1065 100%)",

        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      {/* ===================================================
          LOGIN CARD
      =================================================== */}

      <section
        style={{
          width: "100%",
          maxWidth: "460px",

          padding: "40px",

          borderRadius: "24px",

          background:
            "rgba(255,255,255,0.97)",

          boxShadow:
            "0 30px 80px rgba(0,0,0,0.35)",

          border:
            "1px solid rgba(255,255,255,0.2)",
        }}
      >

        {/* =================================================
            LOGO / BRAND
        ================================================= */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          {/* Logo */}

          <div
            style={{
              width: "76px",
              height: "76px",

              margin:
                "0 auto 18px",

              borderRadius: "22px",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              background:
                "linear-gradient(135deg, #7c3aed, #ec4899)",

              boxShadow:
                "0 12px 30px rgba(124,58,237,0.35)",

              fontSize: "38px",
            }}
          >
            ♛
          </div>

          <h1
            style={{
              margin: 0,

              fontSize: "32px",
              fontWeight: 900,

              letterSpacing: "-1px",

              color: "#111827",
            }}
          >
            Secret Showdown
          </h1>

          <div
            style={{
              marginTop: "6px",

              fontSize: "14px",
              fontWeight: 700,

              letterSpacing: "2px",

              color: "#7c3aed",

              textTransform:
                "uppercase",
            }}
          >
            Founder Portal
          </div>

          <p
            style={{
              marginTop: "14px",
              marginBottom: 0,

              color: "#6b7280",

              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            Manage hosts, approve applications,
            and oversee the Secret Showdown platform.
          </p>
        </div>

        {/* =================================================
            FOUNDER NOTICE
        ================================================= */}

        <div
          style={{
            marginBottom: "24px",

            padding: "14px 16px",

            borderRadius: "14px",

            background:
              "linear-gradient(135deg, #f5f3ff, #faf5ff)",

            border:
              "1px solid #ddd6fe",

            color: "#5b21b6",

            fontSize: "13px",

            lineHeight: 1.6,
          }}
        >
          <strong>
            🔐 Founder access
          </strong>

          <br />

          This area is restricted to approved
          Secret Showdown founders.
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
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="email"
              style={{
                display: "block",

                marginBottom: "8px",

                fontSize: "14px",
                fontWeight: 700,

                color: "#374151",
              }}
            >
              Founder Email
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

              placeholder="founder@example.com"

              autoComplete="email"

              disabled={loading}

              style={{
                width: "100%",

                boxSizing: "border-box",

                padding:
                  "14px 15px",

                borderRadius: "12px",

                border:
                  "1px solid #d1d5db",

                background: "#ffffff",

                color: "#111827",

                fontSize: "15px",

                outline: "none",
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

                marginBottom: "8px",

                fontSize: "14px",
                fontWeight: 700,

                color: "#374151",
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

                padding:
                  "14px 15px",

                borderRadius: "12px",

                border:
                  "1px solid #d1d5db",

                background: "#ffffff",

                color: "#111827",

                fontSize: "15px",

                outline: "none",
              }}
            />
          </div>

          {/* ERROR */}

          {error && (
            <div
              style={{
                marginBottom: "20px",

                padding:
                  "13px 15px",

                borderRadius: "12px",

                background:
                  "#fef2f2",

                border:
                  "1px solid #fecaca",

                color: "#b91c1c",

                fontSize: "14px",

                lineHeight: 1.5,
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

              padding:
                "15px 18px",

              border: "none",

              borderRadius: "12px",

              background: loading
                ? "#9ca3af"
                : "linear-gradient(135deg, #7c3aed, #db2777)",

              color: "#ffffff",

              fontSize: "16px",

              fontWeight: 800,

              cursor: loading
                ? "not-allowed"
                : "pointer",

              boxShadow: loading
                ? "none"
                : "0 10px 25px rgba(124,58,237,0.30)",

              transition:
                "all 0.2s ease",
            }}
          >
            {loading
              ? "Verifying Founder..."
              : "Enter Founder Portal"}
          </button>
        </form>

        {/* =================================================
            SECURITY FOOTER
        ================================================= */}

        <div
          style={{
            marginTop: "26px",

            paddingTop: "20px",

            borderTop:
              "1px solid #e5e7eb",

            textAlign: "center",

            fontSize: "12px",

            color: "#6b7280",

            lineHeight: 1.6,
          }}
        >
          🔒 Protected by Supabase
          authentication and Secret Showdown
          founder authorization.
        </div>

      </section>
    </main>
  );
}