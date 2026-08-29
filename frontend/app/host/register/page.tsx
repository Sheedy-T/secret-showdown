"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function HostRegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // =====================================================
  // REGISTER
  // =====================================================

  const handleRegister = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess(false);

    // ---------------------------------------------------
    // VALIDATE DISPLAY NAME
    // ---------------------------------------------------

    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }

    // ---------------------------------------------------
    // VALIDATE EMAIL
    // ---------------------------------------------------

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    // ---------------------------------------------------
    // VALIDATE PASSWORD
    // ---------------------------------------------------

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters long."
      );
      return;
    }

    // ---------------------------------------------------
    // CONFIRM PASSWORD
    // ---------------------------------------------------

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      // =================================================
      // SEND REGISTRATION TO BACKEND
      // =================================================

      const response = await fetch(
        `${API_URL}/api/auth/host/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            display_name: displayName.trim(),
            email: email.trim(),
            password,
            confirm_password: confirmPassword,
          }),
        }
      );

      const data = await response.json();

      // =================================================
      // HANDLE BACKEND ERROR
      // =================================================

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to complete host registration."
        );
      }

      // =================================================
      // REGISTRATION SUCCESSFUL
      // =================================================

      console.log(
        "Host registration successful:",
        data
      );

      setSuccess(true);

      // Clear sensitive form fields.
      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      console.error(
        "Host registration error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete registration."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // SUCCESS PAGE
  // =====================================================

  if (success) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f5f5f5",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "500px",
            padding: "36px",
            borderRadius: "16px",
            background: "white",
            boxShadow:
              "0 10px 40px rgba(0,0,0,0.10)",
            textAlign: "center",
          }}
        >
          {/* SUCCESS ICON */}

          <div
            style={{
              width: "72px",
              height: "72px",
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            ✓
          </div>

          {/* TITLE */}

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
              color: "#111",
            }}
          >
            Registration Submitted
          </h1>

          {/* MESSAGE */}

          <p
            style={{
              marginTop: "14px",
              color: "#555",
              lineHeight: 1.6,
            }}
          >
            Your Host registration has been
            submitted successfully.
          </p>

          <p
            style={{
              marginTop: "8px",
              color: "#555",
              lineHeight: 1.6,
            }}
          >
            Your account is currently{" "}
            <strong>pending Founder approval</strong>.
          </p>

          <p
            style={{
              marginTop: "8px",
              color: "#555",
              lineHeight: 1.6,
            }}
          >
            Once your application is reviewed,
            you will be able to sign in if your
            Host access is approved.
          </p>

          {/* EMAIL NOTICE */}

          <div
            style={{
              marginTop: "24px",
              padding: "14px",
              borderRadius: "10px",
              background: "#f7f7f7",
              border: "1px solid #e5e5e5",
              fontSize: "14px",
              color: "#555",
              lineHeight: 1.5,
            }}
          >
            📧 Please keep an eye on your email
            for your Host approval notification.
          </div>

          {/* LOGIN BUTTON */}

          <button
            type="button"
            onClick={() => router.push("/host/login")}
            style={{
              width: "100%",
              marginTop: "24px",
              padding: "13px",
              border: "none",
              borderRadius: "8px",
              background: "#111",
              color: "white",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Go to Host Login
          </button>

          {/* HOME */}

          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "white",
              color: "#333",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to Secret Showdown
          </button>
        </section>
      </main>
    );
  }

  // =====================================================
  // REGISTRATION PAGE
  // =====================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f5f5f5",
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
            Become a Host
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            Register to host your own
            Secret Showdown game.
          </p>
        </div>

        {/* =================================================
            REGISTRATION FORM
        ================================================= */}

        <form onSubmit={handleRegister}>

          {/* DISPLAY NAME */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              htmlFor="displayName"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Display Name
            </label>

            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              placeholder="Enter your name"
              autoComplete="name"
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
                setEmail(event.target.value)
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
              marginBottom: "18px",
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
                setPassword(event.target.value)
              }
              placeholder="Create a password"
              autoComplete="new-password"
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

          {/* CONFIRM PASSWORD */}

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="confirmPassword"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
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
                border: "1px solid #ffcccc",
                color: "#b00020",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* REGISTER BUTTON */}

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
              ? "Submitting Application..."
              : "Apply to Become a Host"}
          </button>
        </form>

        {/* =================================================
            APPROVAL NOTICE
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
          🔒 Host access requires Founder approval.

          <br />
          <br />

          After registration, your application
          will remain pending until the Founder
          reviews it.
        </div>

        {/* =================================================
            LOGIN LINK
        ================================================= */}

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "14px",
            color: "#666",
          }}
        >
          Already have a Host account?
        </div>

        <button
          type="button"
          onClick={() =>
            router.push("/host/login")
          }
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "12px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            background: "white",
            color: "#222",
            fontSize: "15px",
            fontWeight: 600,
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          Sign In as Host
        </button>
      </section>
    </main>
  );
}