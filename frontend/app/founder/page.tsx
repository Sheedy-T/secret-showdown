"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";


// =========================================================
// API
// =========================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";


// =========================================================
// TYPES
// =========================================================

type FounderProfile = {
  id: string;
  email: string;
  role: string;
  status: string;
  display_name?: string | null;
};

type Host = {
  id: string;
  email: string;
  role: string;
  status: string;
  display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};


// =========================================================
// STATUS
// =========================================================

type HostStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | string;


// =========================================================
// PAGE
// =========================================================

export default function FounderDashboard() {
  const router = useRouter();

  // -------------------------------------------------------
  // AUTH
  // -------------------------------------------------------

  const [profile, setProfile] =
    useState<FounderProfile | null>(null);

  const [accessToken, setAccessToken] =
    useState<string | null>(null);

  // -------------------------------------------------------
  // DATA
  // -------------------------------------------------------

  const [hosts, setHosts] =
    useState<Host[]>([]);

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<"ALL" | HostStatus>("ALL");


  // =======================================================
  // GET SESSION TOKEN
  // =======================================================

  const getAccessToken =
    useCallback(async () => {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession();

      if (error) {
        throw new Error(
          "Could not retrieve your authentication session."
        );
      }

      if (!data.session) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      return data.session.access_token;
    }, []);


  // =======================================================
  // BACKEND REQUEST
  // =======================================================

  const apiRequest =
    useCallback(
      async (
        endpoint: string,
        options: RequestInit = {},
        token?: string
      ) => {
        const authToken =
          token || accessToken;

        if (!authToken) {
          throw new Error(
            "Authentication token is missing."
          );
        }

        const response =
          await fetch(
            `${API_URL}${endpoint}`,
            {
              ...options,

              headers: {
                ...(options.headers || {}),

                Authorization:
                  `Bearer ${authToken}`,

                "Content-Type":
                  "application/json",
              },

              cache: "no-store",
            }
          );

        let result: any = null;

        try {
          result =
            await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result?.detail ||
            result?.message ||
            `Request failed with status ${response.status}.`
          );
        }

        return result;
      },
      [accessToken]
    );


  // =======================================================
  // LOAD FOUNDER PROFILE
  // =======================================================

  const loadFounder =
    useCallback(async () => {
      const token =
        await getAccessToken();

      setAccessToken(token);

      const result =
        await apiRequest(
          "/api/founder/me",
          {
            method: "GET",
          },
          token
        );

      setProfile(
        result.profile
      );

      return token;
    }, [
      getAccessToken,
      apiRequest,
    ]);


  // =======================================================
  // LOAD HOSTS
  // =======================================================

  const loadHosts =
    useCallback(
      async (token?: string) => {
        const result =
          await apiRequest(
            "/api/founder/hosts",
            {
              method: "GET",
            },
            token
          );

        const hostList =
          Array.isArray(result)
            ? result
            : result?.hosts || [];

        setHosts(hostList);

        return hostList;
      },
      [apiRequest]
    );


  // =======================================================
  // INITIAL LOAD
  // =======================================================

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const token =
            await loadFounder();

          await loadHosts(token);

        } catch (error) {
          console.error(
            "Founder dashboard error:",
            error
          );

          const message =
            error instanceof Error
              ? error.message
              : "Unable to load Founder Dashboard.";

          setError(message);

          // -------------------------------------------------
          // AUTH FAILURE
          // -------------------------------------------------

          if (
            message.toLowerCase().includes(
              "session"
            ) ||
            message.toLowerCase().includes(
              "authentication"
            ) ||
            message.toLowerCase().includes(
              "authorized"
            ) ||
            message.toLowerCase().includes(
              "founder"
            )
          ) {
            await supabase.auth.signOut();

            router.replace(
              "/founder/login"
            );
          }

        } finally {
          setLoading(false);
        }
      },
      [
        loadFounder,
        loadHosts,
        router,
      ]
    );


  // =======================================================
  // LOAD DASHBOARD ON MOUNT
  // =======================================================

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  // =======================================================
  // REFRESH
  // =======================================================

  const refreshDashboard =
    async () => {
      try {
        setRefreshing(true);
        setError("");
        setSuccess("");

        const token =
          await getAccessToken();

        setAccessToken(token);

        await loadHosts(token);

        setSuccess(
          "Founder dashboard refreshed."
        );

        setTimeout(() => {
          setSuccess("");
        }, 3000);

      } catch (error) {
        console.error(
          "Refresh error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Could not refresh dashboard."
        );
      } finally {
        setRefreshing(false);
      }
    };


  // =======================================================
  // HOST ACTION
  // =======================================================

  const updateHostStatus =
    async (
      host: Host,
      action:
        | "approve"
        | "reject"
        | "suspend"
    ) => {
      const actionLabel =
        action === "approve"
          ? "approve"
          : action === "reject"
            ? "reject"
            : "suspend";

      // ---------------------------------------------------
      // CONFIRM
      // ---------------------------------------------------

      if (
        action !== "approve"
      ) {
        const confirmed =
          window.confirm(
            `Are you sure you want to ${actionLabel} ${host.email}?`
          );

        if (!confirmed) {
          return;
        }
      }

      try {
        setActionLoading(
          `${action}:${host.id}`
        );

        setError("");
        setSuccess("");

        const token =
          await getAccessToken();

        setAccessToken(token);

        await apiRequest(
          `/api/founder/hosts/${host.id}/${action}`,
          {
            method: "POST",
          },
          token
        );

        // -------------------------------------------------
        // UPDATE UI IMMEDIATELY
        // -------------------------------------------------

        const newStatus =
          action === "approve"
            ? "APPROVED"
            : action === "reject"
              ? "REJECTED"
              : "SUSPENDED";

        setHosts(
          (currentHosts) =>
            currentHosts.map(
              (currentHost) =>
                currentHost.id === host.id
                  ? {
                      ...currentHost,
                      status:
                        newStatus,
                    }
                  : currentHost
            )
        );

        setSuccess(
          `${host.email} has been ${actionLabel}d successfully.`
        );

        setTimeout(() => {
          setSuccess("");
        }, 3500);

      } catch (error) {
        console.error(
          `Could not ${action} host:`,
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : `Could not ${action} host.`
        );

      } finally {
        setActionLoading(null);
      }
    };


  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout =
    async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        router.replace(
          "/founder/login"
        );
      }
    };


  // =======================================================
  // STATISTICS
  // =======================================================

  const statistics =
    useMemo(() => {
      return {
        total: hosts.length,

        pending:
          hosts.filter(
            (host) =>
              host.status ===
              "PENDING"
          ).length,

        approved:
          hosts.filter(
            (host) =>
              host.status ===
              "APPROVED"
          ).length,

        rejected:
          hosts.filter(
            (host) =>
              host.status ===
              "REJECTED"
          ).length,

        suspended:
          hosts.filter(
            (host) =>
              host.status ===
              "SUSPENDED"
          ).length,
      };
    }, [hosts]);


  // =======================================================
  // FILTER + SEARCH
  // =======================================================

  const filteredHosts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return hosts.filter(
        (host) => {
          // -----------------------------------------------
          // STATUS
          // -----------------------------------------------

          if (
            filter !== "ALL" &&
            host.status !== filter
          ) {
            return false;
          }

          // -----------------------------------------------
          // SEARCH
          // -----------------------------------------------

          if (!normalizedSearch) {
            return true;
          }

          return (
            host.email
              ?.toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            host.display_name
              ?.toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            host.id
              ?.toLowerCase()
              .includes(
                normalizedSearch
              )
          );
        }
      );
    }, [
      hosts,
      filter,
      search,
    ]);


  // =======================================================
  // FORMAT DATE
  // =======================================================

  const formatDate =
    (date?: string | null) => {
      if (!date) {
        return "—";
      }

      try {
        return new Date(
          date
        ).toLocaleString();
      } catch {
        return date;
      }
    };


  // =======================================================
  // STATUS COLOR
  // =======================================================

  const statusStyle =
    (status: HostStatus) => {
      switch (status) {
        case "APPROVED":
          return {
            background: "#dcfce7",
            color: "#166534",
            border: "#bbf7d0",
          };

        case "PENDING":
          return {
            background: "#fef3c7",
            color: "#92400e",
            border: "#fde68a",
          };

        case "REJECTED":
          return {
            background: "#fee2e2",
            color: "#991b1b",
            border: "#fecaca",
          };

        case "SUSPENDED":
          return {
            background: "#f3f4f6",
            color: "#374151",
            border: "#d1d5db",
          };

        default:
          return {
            background: "#e5e7eb",
            color: "#374151",
            border: "#d1d5db",
          };
      }
    };


  // =======================================================
  // LOADING SCREEN
  // =======================================================

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          background:
            "linear-gradient(135deg, #09090b, #1e1b4b)",

          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: "52px",
              marginBottom: "20px",
            }}
          >
            ♛
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "24px",
            }}
          >
            Loading Founder Portal
          </h2>

          <p
            style={{
              marginTop: "10px",
              opacity: 0.7,
            }}
          >
            Verifying your access...
          </p>
        </div>
      </main>
    );
  }


  // =======================================================
  // PAGE
  // =======================================================

  return (
    <main
      style={{
        minHeight: "100vh",

        background:
          "#f5f7fb",

        fontFamily:
          "Arial, Helvetica, sans-serif",

        color: "#111827",
      }}
    >

      {/* ===================================================
          HEADER
      =================================================== */}

      <header
        style={{
          background:
            "linear-gradient(135deg, #09090b, #312e81, #7c3aed)",

          color: "white",

          padding:
            "22px 5%",

          boxShadow:
            "0 8px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",

            margin: "0 auto",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "space-between",

            gap: "20px",

            flexWrap: "wrap",
          }}
        >

          {/* BRAND */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",

                borderRadius: "16px",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                background:
                  "linear-gradient(135deg, #8b5cf6, #ec4899)",

                fontSize: "27px",

                boxShadow:
                  "0 8px 20px rgba(0,0,0,0.25)",
              }}
            >
              ♛
            </div>

            <div>
              <div
                style={{
                  fontSize: "21px",
                  fontWeight: 900,
                }}
              >
                Secret Showdown
              </div>

              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.7,

                  letterSpacing:
                    "2px",

                  textTransform:
                    "uppercase",
                }}
              >
                Founder Control Center
              </div>
            </div>
          </div>


          {/* PROFILE */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {profile?.display_name ||
                  "Founder"}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.7,
                }}
              >
                {profile?.email}
              </div>
            </div>

            <button
              onClick={
                handleLogout
              }
              style={{
                padding:
                  "9px 14px",

                borderRadius:
                  "9px",

                border:
                  "1px solid rgba(255,255,255,0.25)",

                background:
                  "rgba(255,255,255,0.10)",

                color: "white",

                cursor: "pointer",

                fontWeight: 700,
              }}
            >
              Logout
            </button>
          </div>

        </div>
      </header>


      {/* ===================================================
          CONTENT
      =================================================== */}

      <div
        style={{
          maxWidth: "1400px",

          margin: "0 auto",

          padding:
            "35px 5% 60px",
        }}
      >

        {/* PAGE TITLE */}

        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <h1
            style={{
              margin: 0,

              fontSize: "34px",

              fontWeight: 900,

              letterSpacing:
                "-1px",
            }}
          >
            Founder Dashboard
          </h1>

          <p
            style={{
              marginTop: "8px",

              marginBottom: 0,

              color: "#6b7280",

              fontSize: "15px",
            }}
          >
            Manage host access and control who
            can conduct Secret Showdown games.
          </p>
        </div>


        {/* =================================================
            MESSAGES
        ================================================= */}

        {error && (
          <div
            style={{
              marginBottom: "20px",

              padding:
                "14px 17px",

              borderRadius:
                "12px",

              background:
                "#fef2f2",

              border:
                "1px solid #fecaca",

              color:
                "#991b1b",

              fontSize: "14px",
            }}
          >
            ⚠️ {error}
          </div>
        )}


        {success && (
          <div
            style={{
              marginBottom: "20px",

              padding:
                "14px 17px",

              borderRadius:
                "12px",

              background:
                "#f0fdf4",

              border:
                "1px solid #bbf7d0",

              color:
                "#166534",

              fontSize: "14px",
            }}
          >
            ✅ {success}
          </div>
        )}


        {/* =================================================
            STATISTICS
        ================================================= */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",

            gap: "16px",

            marginBottom: "30px",
          }}
        >

          <StatCard
            title="Total Hosts"
            value={statistics.total}
            icon="👥"
          />

          <StatCard
            title="Pending"
            value={statistics.pending}
            icon="🕐"
          />

          <StatCard
            title="Approved"
            value={statistics.approved}
            icon="✅"
          />

          <StatCard
            title="Rejected"
            value={statistics.rejected}
            icon="❌"
          />

          <StatCard
            title="Suspended"
            value={statistics.suspended}
            icon="🚫"
          />

        </div>


        {/* =================================================
            HOST MANAGEMENT
        ================================================= */}

        <section
          style={{
            background: "white",

            borderRadius: "20px",

            border:
              "1px solid #e5e7eb",

            boxShadow:
              "0 8px 30px rgba(0,0,0,0.05)",

            overflow: "hidden",
          }}
        >

          {/* SECTION HEADER */}

          <div
            style={{
              padding:
                "22px 24px",

              borderBottom:
                "1px solid #e5e7eb",

              display: "flex",

              justifyContent:
                "space-between",

              alignItems: "center",

              gap: "15px",

              flexWrap: "wrap",
            }}
          >

            <div>
              <h2
                style={{
                  margin: 0,

                  fontSize: "20px",

                  fontWeight: 800,
                }}
              >
                Host Management
              </h2>

              <p
                style={{
                  margin:
                    "5px 0 0",

                  color: "#6b7280",

                  fontSize: "13px",
                }}
              >
                Review and manage host accounts.
              </p>
            </div>

            <button
              onClick={
                refreshDashboard
              }
              disabled={refreshing}
              style={{
                padding:
                  "10px 16px",

                borderRadius:
                  "10px",

                border:
                  "1px solid #d1d5db",

                background:
                  refreshing
                    ? "#f3f4f6"
                    : "white",

                color:
                  "#374151",

                fontWeight: 700,

                cursor:
                  refreshing
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

          </div>


          {/* =================================================
              SEARCH + FILTER
          ================================================= */}

          <div
            style={{
              padding:
                "18px 24px",

              background:
                "#fafafa",

              borderBottom:
                "1px solid #e5e7eb",

              display: "flex",

              gap: "12px",

              flexWrap: "wrap",
            }}
          >

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search hosts by name or email..."
              style={{
                flex: 1,

                minWidth:
                  "240px",

                padding:
                  "11px 14px",

                borderRadius:
                  "10px",

                border:
                  "1px solid #d1d5db",

                fontSize:
                  "14px",

                outline:
                  "none",
              }}
            />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    | "ALL"
                    | HostStatus
                )
              }
              style={{
                padding:
                  "11px 14px",

                borderRadius:
                  "10px",

                border:
                  "1px solid #d1d5db",

                background:
                  "white",

                fontSize:
                  "14px",

                cursor:
                  "pointer",
              }}
            >
              <option value="ALL">
                All Hosts
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="REJECTED">
                Rejected
              </option>

              <option value="SUSPENDED">
                Suspended
              </option>
            </select>

          </div>


          {/* =================================================
              HOST LIST
          ================================================= */}

          {filteredHosts.length === 0 ? (

            <div
              style={{
                padding:
                  "70px 20px",

                textAlign:
                  "center",

                color:
                  "#6b7280",
              }}
            >

              <div
                style={{
                  fontSize:
                    "45px",

                  marginBottom:
                    "12px",
                }}
              >
                👥
              </div>

              <h3
                style={{
                  margin:
                    "0 0 8px",

                  color:
                    "#374151",
                }}
              >
                No hosts found
              </h3>

              <p
                style={{
                  margin: 0,

                  fontSize:
                    "14px",
                }}
              >
                There are no host accounts
                matching your current filter.
              </p>

            </div>

          ) : (

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  minWidth:
                    "900px",
                }}
              >

                <thead>
                  <tr
                    style={{
                      background:
                        "#f9fafb",

                      textAlign:
                        "left",
                    }}
                  >

                    <th
                      style={tableHeader}
                    >
                      Host
                    </th>

                    <th
                      style={tableHeader}
                    >
                      Email
                    </th>

                    <th
                      style={tableHeader}
                    >
                      Status
                    </th>

                    <th
                      style={tableHeader}
                    >
                      Registered
                    </th>

                    <th
                      style={tableHeader}
                    >
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredHosts.map(
                    (host) => {

                      const status =
                        statusStyle(
                          host.status
                        );

                      const isApproving =
                        actionLoading ===
                        `approve:${host.id}`;

                      const isRejecting =
                        actionLoading ===
                        `reject:${host.id}`;

                      const isSuspending =
                        actionLoading ===
                        `suspend:${host.id}`;

                      return (
                        <tr
                          key={
                            host.id
                          }
                          style={{
                            borderTop:
                              "1px solid #e5e7eb",
                          }}
                        >

                          {/* HOST */}

                          <td
                            style={
                              tableCell
                            }
                          >

                            <div
                              style={{
                                display:
                                  "flex",

                                alignItems:
                                  "center",

                                gap:
                                  "12px",
                              }}
                            >

                              <div
                                style={{
                                  width:
                                    "40px",

                                  height:
                                    "40px",

                                  borderRadius:
                                    "12px",

                                  display:
                                    "flex",

                                  alignItems:
                                    "center",

                                  justifyContent:
                                    "center",

                                  background:
                                    "#ede9fe",

                                  color:
                                    "#6d28d9",

                                  fontWeight:
                                    800,
                                }}
                              >
                                {(host.display_name ||
                                  host.email ||
                                  "H")
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontWeight:
                                      800,
                                  }}
                                >
                                  {host.display_name ||
                                    "Unnamed Host"}
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      "3px",

                                    fontSize:
                                      "11px",

                                    color:
                                      "#9ca3af",
                                  }}
                                >
                                  {host.id}
                                </div>
                              </div>

                            </div>

                          </td>


                          {/* EMAIL */}

                          <td
                            style={
                              tableCell
                            }
                          >
                            {host.email}
                          </td>


                          {/* STATUS */}

                          <td
                            style={
                              tableCell
                            }
                          >

                            <span
                              style={{
                                display:
                                  "inline-flex",

                                alignItems:
                                  "center",

                                padding:
                                  "6px 10px",

                                borderRadius:
                                  "999px",

                                background:
                                  status.background,

                                color:
                                  status.color,

                                border:
                                  `1px solid ${status.border}`,

                                fontSize:
                                  "12px",

                                fontWeight:
                                  800,
                              }}
                            >
                              {host.status}
                            </span>

                          </td>


                          {/* DATE */}

                          <td
                            style={
                              tableCell
                            }
                          >
                            {formatDate(
                              host.created_at
                            )}
                          </td>


                          {/* ACTIONS */}

                          <td
                            style={
                              tableCell
                            }
                          >

                            <div
                              style={{
                                display:
                                  "flex",

                                gap:
                                  "7px",

                                flexWrap:
                                  "wrap",
                              }}
                            >

                              {/* APPROVE */}

                              {host.status !==
                                "APPROVED" && (
                                <button
                                  onClick={() =>
                                    updateHostStatus(
                                      host,
                                      "approve"
                                    )
                                  }
                                  disabled={
                                    !!actionLoading
                                  }
                                  style={{
                                    ...actionButton,
                                    background:
                                      "#16a34a",
                                    color:
                                      "white",
                                  }}
                                >
                                  {isApproving
                                    ? "..."
                                    : "Approve"}
                                </button>
                              )}


                              {/* REJECT */}

                              {host.status !==
                                "REJECTED" && (
                                <button
                                  onClick={() =>
                                    updateHostStatus(
                                      host,
                                      "reject"
                                    )
                                  }
                                  disabled={
                                    !!actionLoading
                                  }
                                  style={{
                                    ...actionButton,
                                    background:
                                      "#dc2626",
                                    color:
                                      "white",
                                  }}
                                >
                                  {isRejecting
                                    ? "..."
                                    : "Reject"}
                                </button>
                              )}


                              {/* SUSPEND */}

                              {host.status !==
                                "SUSPENDED" &&
                                host.status ===
                                  "APPROVED" && (
                                  <button
                                    onClick={() =>
                                      updateHostStatus(
                                        host,
                                        "suspend"
                                      )
                                    }
                                    disabled={
                                      !!actionLoading
                                    }
                                    style={{
                                      ...actionButton,
                                      background:
                                        "#374151",
                                      color:
                                        "white",
                                    }}
                                  >
                                    {isSuspending
                                      ? "..."
                                      : "Suspend"}
                                  </button>
                                )}

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer
          style={{
            marginTop:
              "30px",

            textAlign:
              "center",

            color:
              "#9ca3af",

            fontSize:
              "12px",
          }}
        >
          Secret Showdown Founder Control Center
          <br />
          Authorized founder access only.
        </footer>

      </div>
    </main>
  );
}


// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div
      style={{
        background:
          "white",

        border:
          "1px solid #e5e7eb",

        borderRadius:
          "16px",

        padding:
          "20px",

        boxShadow:
          "0 5px 20px rgba(0,0,0,0.04)",
      }}
    >

      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          marginBottom:
            "14px",
        }}
      >

        <span
          style={{
            fontSize:
              "13px",

            color:
              "#6b7280",

            fontWeight:
              700,
          }}
        >
          {title}
        </span>

        <span
          style={{
            fontSize:
              "22px",
          }}
        >
          {icon}
        </span>

      </div>

      <div
        style={{
          fontSize:
            "30px",

          fontWeight:
            900,
        }}
      >
        {value}
      </div>

    </div>
  );
}


// =========================================================
// TABLE STYLES
// =========================================================

const tableHeader: React.CSSProperties = {
  padding:
    "14px 18px",

  fontSize:
    "12px",

  color:
    "#6b7280",

  fontWeight:
    800,

  textTransform:
    "uppercase",

  letterSpacing:
    "0.5px",
};


const tableCell: React.CSSProperties = {
  padding:
    "16px 18px",

  fontSize:
    "14px",

  verticalAlign:
    "middle",
};


// =========================================================
// ACTION BUTTON
// =========================================================

const actionButton: React.CSSProperties = {
  border:
    "none",

  borderRadius:
    "8px",

  padding:
    "7px 10px",

  fontSize:
    "12px",

  fontWeight:
    800,

  cursor:
    "pointer",
};