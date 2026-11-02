"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";


// =========================================================
// TYPES
// =========================================================

type Player = {
  id: string;
  name: string;
  active: boolean;
  attempts_remaining: number;
};


type PublicGuessResult = {
  result: string;
  message: string;

  shape_correct: boolean;
  color_correct: boolean;

  attempts_remaining?: number;

  guesser_eliminated?: boolean;

  eliminated_player?: string;

  winner?: {
    id: string;
    name: string;
  };

  guesser_name?: string;

  target_player_name?: string;

  guessed_shape?:
    | "triangle"
    | "circle"
    | "square";

  guessed_color?:
    | "red"
    | "blue"
    | "green";
};


type GameStatus = {
  registration_open: boolean;

  game_started: boolean;

  players_count: number;

  max_players: number;

  active_players: number;

  spin_number: number;

  current_player: {
    id: string;
    name: string;
  } | null;

  winner: {
    id: string;
    name: string;
  } | null;

  available_combinations: number;

  guess_number: number;

  last_guess_result:
    | PublicGuessResult
    | null;
};


type SecretPlayer = Player & {
  secret?: {
    shape: string;
    color: string;
  };
};


type GameSession = {
  id: string;

  host_id: string;

  status:
    | "WAITING"
    | "LIVE"
    | "ENDED"
    | string;

  created_at: string;

  started_at: string | null;

  ended_at: string | null;
};


type JoinKey = {
  id: string;

  key: string;

  used: boolean;

  created_at?: string;

  used_at?: string | null;

  used_by_player_id?: string | null;
};


// =========================================================
// COMPONENT
// =========================================================

export default function HostDashboard() {

  const router = useRouter();

  // =======================================================
  // HOST AUTHENTICATION
  // =======================================================

  const [authReady, setAuthReady] = useState(false);
  const [hostAuthenticated, setHostAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  // =======================================================
  // GAME
  // =======================================================

  const [game, setGame] =
    useState<GameStatus | null>(null);

  const [players, setPlayers] =
    useState<SecretPlayer[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [spinLocked, setSpinLocked] =
    useState(false);


  // =======================================================
  // SESSION
  // =======================================================

  const [session, setSession] =
    useState<GameSession | null>(null);

  const [sessionLoading, setSessionLoading] =
    useState(false);

  const [sessionError, setSessionError] =
    useState("");


  // =======================================================
  // JOIN KEYS
  // =======================================================

  const [joinKeys, setJoinKeys] =
    useState<JoinKey[]>([]);

  const [keysLoading, setKeysLoading] =
    useState(false);

  const [keysGenerated, setKeysGenerated] =
    useState(false);

  const [copiedKey, setCopiedKey] =
    useState<string | null>(null);


  // =======================================================
  // HOST WHEEL
  // =======================================================

  const [rotation, setRotation] =
    useState(0);

  const [spinning, setSpinning] =
    useState(false);

  const [selectedPlayer, setSelectedPlayer] =
    useState<string | null>(null);

  // Ignore the spin already present when this page first loads.
  // Only a new backend spin_number increment should animate the wheel.
  const lastObservedSpinNumberRef =
    useRef<number | null>(null);

  const pendingSpinNumberRef =
    useRef<number | null>(null);

  const rotationRef =
    useRef(0);

  const wheelTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );


  const wheelColors = [
    "#7c3aed",
    "#2563eb",
    "#db2777",
    "#059669",
    "#ea580c",
    "#0891b2",
    "#ca8a04",
    "#dc2626",
  ];


  // =======================================================
  // ACTIVE PLAYERS
  // =======================================================

  const activePlayers = useMemo(
    () =>
      players
        .filter(
          (player) => player.active
        )
        .sort(
          (a, b) =>
            a.id.localeCompare(b.id)
        ),
    [players]
  );


  // =======================================================
  // HOST AUTHENTICATION / REQUEST HELPERS
  // =======================================================
  //
  // The host dashboard must NEVER call protected host endpoints
  // before Supabase has restored the browser session.
  //
  // Every protected request goes through hostFetch(). If the
  // access token has expired, hostFetch refreshes the Supabase
  // session once and retries the request.
  //
  // =======================================================

  async function getAccessToken(
    forceRefresh = false
  ): Promise<string | null> {
    if (forceRefresh) {
      const {
        data,
        error,
      } = await supabase.auth.refreshSession();

      if (error) {
        console.error("Supabase session refresh failed:", error);
        return null;
      }

      return data.session?.access_token || null;
    }

    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Could not read Supabase session:", error);
      return null;
    }

    return currentSession?.access_token || null;
  }

  async function hostHeaders(
    forceRefresh = false
  ): Promise<HeadersInit> {
    const accessToken = await getAccessToken(
      forceRefresh
    );

    if (!accessToken) {
      throw new Error(
        "Your host session has expired. Please sign in again."
      );
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  async function hostFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let headers = await hostHeaders(false);

    let response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
        cache: "no-store",
      }
    );

    // If the access token expired between getSession() and the
    // request, refresh it once and retry.
    if (response.status === 401) {
      headers = await hostHeaders(true);

      response = await fetch(
        `${API_URL}${endpoint}`,
        {
          ...options,
          headers: {
            ...headers,
            ...(options.headers || {}),
          },
          cache: "no-store",
        }
      );
    }

    return response;
  }

  async function verifyHostSession(): Promise<boolean> {
    setAuthError("");

    try {
      const response = await hostFetch("/api/host/me");
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          data?.detail ||
          "Could not verify your host account.";

        if (response.status === 401) {
          await supabase.auth.signOut();
          router.replace("/host/login");
          return false;
        }

        throw new Error(detail);
      }

      if (data?.profile?.role !== "HOST") {
        throw new Error("Host access is required.");
      }

      if (data?.profile?.status !== "APPROVED") {
        throw new Error(
          "Your host account is not approved."
        );
      }

      setHostAuthenticated(true);
      return true;
    } catch (error) {
      console.error("Host authentication failed:", error);

      setHostAuthenticated(false);
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not verify your host account."
      );

      return false;
    }
  }

  // =======================================================
  // AUTH INITIALIZATION
  // =======================================================

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!currentSession?.access_token) {
          setAuthError(
            "No active host session. Redirecting to login..."
          );
          setAuthReady(true);
          router.replace("/host/login");
          return;
        }

        const verified = await verifyHostSession();

        if (!mounted) return;

        if (!verified) {
          return;
        }

        setAuthReady(true);
      } catch (error) {
        console.error("Host auth initialization failed:", error);

        if (!mounted) return;

        setAuthError(
          "Could not initialize host authentication."
        );
        setAuthReady(true);
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT" || !session) {
          setHostAuthenticated(false);
          setAuthReady(true);
          router.replace("/host/login");
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setHostAuthenticated(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // =======================================================
  // LOAD GAME STATUS
  // =======================================================

  async function loadGame() {

    try {

      const response =
        await fetch(
          `${API_URL}/api/game`,
          {
            cache: "no-store",
          }
        );


      if (!response.ok) {

        throw new Error(
          "Failed to load game."
        );
      }


      const data =
        await response.json();


      setGame(data);

    } catch (error) {

      console.error(error);


      setMessage(
        "Could not connect to the backend."
      );
    }
  }


  // =======================================================
  // LOAD PRIVATE HOST PLAYERS
  // =======================================================

  async function loadPlayers() {

    try {

      const response =
        await hostFetch("/api/host/players");


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Failed to load contestants."
        );
      }


      setPlayers(data);

    } catch (error) {

      console.error(error);


      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load contestants."
      );
    }
  }


  // =======================================================
  // LOAD CURRENT SESSION
  // =======================================================

  async function loadCurrentSession() {

    try {

      setSessionError("");


      const response =
        await hostFetch("/api/host/sessions/current");


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Could not load current game session."
        );
      }


      setSession(
        data.session || null
      );

    } catch (error) {

      console.error(error);


      setSessionError(
        error instanceof Error
          ? error.message
          : "Could not load current session."
      );
    }
  }


  // =======================================================
  // CREATE SESSION
  // =======================================================

  async function createGameSession() {

    setSessionLoading(true);

    setSessionError("");


    try {

      const response =
        await hostFetch("/api/host/sessions", {
          method: "POST",
        });


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Could not create game session."
        );
      }


      setSession(
        data.session || null
      );


      setMessage(
        data.message ||
          "Game session created successfully."
      );


      await loadJoinKeys();

    } catch (error) {

      console.error(error);


      setSessionError(
        error instanceof Error
          ? error.message
          : "Could not create game session."
      );

    } finally {

      setSessionLoading(false);
    }
  }


  // =======================================================
  // LOAD JOIN KEYS
  // =======================================================

  async function loadJoinKeys() {
  try {
    setKeysLoading(true);

    const response = await hostFetch(
      "/api/host/join-keys"
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail ||
          "Could not load join keys."
      );
    }

    const normalizedKeys = (
      data.keys || []
    ).map((item: any) => ({
      ...item,
      key: item.key ?? item.join_key,
    }));

    setJoinKeys(normalizedKeys);

    if (normalizedKeys.length > 0) {
      setKeysGenerated(true);
    }
  } catch (error) {
    console.error(error);

    setMessage(
      error instanceof Error
        ? error.message
        : "Could not load join keys."
    );
  } finally {
    setKeysLoading(false);
  }
}


  // =======================================================
  // GENERATE JOIN KEYS
  // =======================================================

  async function generateJoinKeys() {

    if (!session) {

      setMessage(
        "Create a game session before generating contestant keys."
      );

      return;
    }


    if (
      session.status !==
      "WAITING"
    ) {

      setMessage(
        "Join keys can only be generated while the session is waiting."
      );

      return;
    }


    setKeysLoading(true);

    setMessage("");


    try {

      const response =
        await hostFetch("/api/host/join-keys/generate", {
          method: "POST",
        });


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Could not generate contestant join keys."
        );
      }


      setJoinKeys(
        data.keys || []
      );

      setKeysGenerated(true);


      setMessage(
        data.message ||
          "8 contestant join keys generated successfully."
      );


      await loadJoinKeys();

    } catch (error) {

      console.error(error);


      setMessage(
        error instanceof Error
          ? error.message
          : "Could not generate join keys."
      );

    } finally {

      setKeysLoading(false);
    }
  }


  // =======================================================
  // COPY JOIN KEY
  // =======================================================

  async function copyJoinKey(
    key: string
  ) {

    try {

      await navigator.clipboard.writeText(
        key
      );


      setCopiedKey(key);


      setTimeout(
        () => {
          setCopiedKey(null);
        },
        2000
      );

    } catch (error) {

      console.error(error);


      setMessage(
        "Could not copy the join key."
      );
    }
  }


  // =======================================================
  // END SESSION
  // =======================================================

  async function endGameSession() {

    const confirmed =
      window.confirm(
        "Are you sure you want to end this game session? All unused contestant keys will become invalid."
      );


    if (!confirmed) {
      return;
    }


    setSessionLoading(true);

    setSessionError("");


    try {

      const response =
        await hostFetch("/api/host/sessions/end", {
          method: "POST",
        });


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Could not end game session."
        );
      }


      setMessage(
        data.message ||
          "Game session ended successfully."
      );


      await loadCurrentSession();

      await loadJoinKeys();

    } catch (error) {

      console.error(error);


      setSessionError(
        error instanceof Error
          ? error.message
          : "Could not end game session."
      );

    } finally {

      setSessionLoading(false);
    }
  }


  // =======================================================
  // REFRESH EVERYTHING
  // =======================================================

    async function refreshDashboard() {
  try {
    await loadGame();
    await loadPlayers();
    await loadCurrentSession();
    await loadJoinKeys();
  } catch (error) {
    console.error(
      "Dashboard refresh failed:",
      error
    );
  }
}


  // =======================================================
  // LOAD DASHBOARD ONLY AFTER HOST AUTHENTICATION
  // =======================================================

  useEffect(() => {

    if (!authReady || !hostAuthenticated) {
      return;
    }

    let active = true;

    async function startDashboard() {
      if (!active) return;

      await refreshDashboard();
    }

    startDashboard();

    const interval = setInterval(() => {
  if (active) {
    refreshDashboard();
  }
}, 5000);

    return () => {
      active = false;
      clearInterval(interval);

      if (wheelTimerRef.current) {
        clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };
  }, [authReady, hostAuthenticated]);

  // Animate only when a NEW spin event is observed. Guess submissions and
  // ordinary dashboard refreshes must not replay an old spin.
  useEffect(() => {
    if (!game) return;

    if (lastObservedSpinNumberRef.current === null) {
      lastObservedSpinNumberRef.current = game.spin_number;
      return;
    }

    if (game.spin_number > lastObservedSpinNumberRef.current) {
      lastObservedSpinNumberRef.current = game.spin_number;
      pendingSpinNumberRef.current = game.spin_number;
    }

    if (pendingSpinNumberRef.current === null) return;
    if (pendingSpinNumberRef.current !== game.spin_number) return;
    if (!game.game_started || !game.current_player) return;
    if (spinning || activePlayers.length < 2) return;

    const winnerIndex = activePlayers.findIndex(
      (player) => player.id === game.current_player?.id
    );

    if (winnerIndex === -1) return;

    pendingSpinNumberRef.current = null;
    setSpinning(true);
    setSelectedPlayer(null);

    const segmentAngle = 360 / activePlayers.length;
    const targetAngle =
      360 - (winnerIndex * segmentAngle + segmentAngle / 2);
    const finalRotation = rotationRef.current + 8 * 360 + targetAngle;

    rotationRef.current = finalRotation;
    setRotation(finalRotation);

    if (wheelTimerRef.current) {
      clearTimeout(wheelTimerRef.current);
    }

    wheelTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setSelectedPlayer(game.current_player?.name || null);
      wheelTimerRef.current = null;
    }, 10000);
  }, [
    game?.spin_number,
    game?.current_player?.id,
    game?.game_started,
    activePlayers,
    spinning,
  ]);

  // =======================================================
  // GENERIC HOST POST REQUEST
  // =======================================================

  async function postAction(
    endpoint: string,
    successMessage: string
  ) {

    setLoading(true);

    setMessage("");


    try {

      const response =
        await hostFetch(endpoint, {
          method: "POST",
        });


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Something went wrong."
        );
      }


      setMessage(
        successMessage
      );


      await refreshDashboard();


      return data;

    } catch (error) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );

    } finally {

      setLoading(false);
    }
  }


  // =======================================================
  // CLOSE REGISTRATION
  // =======================================================

  async function closeRegistration() {

    await postAction(
      "/api/host/registration/close",
      "Registration closed."
    );
  }


  // =======================================================
  // OPEN REGISTRATION
  // =======================================================

  async function openRegistration() {

    await postAction(
      "/api/host/registration/open",
      "Registration opened."
    );
  }


  // =======================================================
  // START GAME
  // =======================================================

  async function startGame() {

    await postAction(
      "/api/host/start",
      "Game started."
    );
  }


  // =======================================================
  // SPIN
  // =======================================================

  async function spinWheel() {

    if (spinLocked) {
      return;
    }


    setSpinLocked(true);


    await postAction(
      "/api/host/spin",
      "Wheel spun."
    );


    setTimeout(
      () => {
        setSpinLocked(false);
      },
      10000
    );
  }


  // =======================================================
  // RESET
  // =======================================================

  async function resetGame() {

    const confirmed =
      window.confirm(
        "Are you sure you want to reset the game? All contestants and secrets will be removed."
      );


    if (!confirmed) {
      return;
    }


    await postAction(
      "/api/host/reset",
      "Game reset. Registration is now open."
    );


    /*
     * The in-memory game has been reset.
     *
     * The persistent session is separate,
     * so reload the current session as well.
     */

    await loadCurrentSession();

    await loadJoinKeys();
  }


  // =======================================================
  // AUTHENTICATION LOADING STATE
  // =======================================================

  if (!authReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-6xl mb-5">🔐</div>
          <p className="text-lg font-semibold">
            Verifying host access...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Restoring your secure session
          </p>
        </div>
      </main>
    );
  }

  if (!hostAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white px-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-5">🔒</div>
          <h1 className="text-2xl font-black">
            Host Authentication Required
          </h1>
          <p className="text-gray-400 text-sm mt-3">
            {authError || "Your host session could not be verified."}
          </p>
          <button
            onClick={() => router.replace("/host/login")}
            className="mt-6 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold transition"
          >
            GO TO HOST LOGIN
          </button>
        </div>
      </main>
    );
  }

  // =======================================================
  // LOADING STATE
  // =======================================================

  if (!game) {

    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">

        <div className="text-center">

          <div className="text-6xl mb-5">
            🎮
          </div>

          <p className="text-lg font-semibold">
            Loading Secret Showdown...
          </p>

          <p className="text-gray-500 text-sm mt-2">
            Preparing your host dashboard
          </p>

        </div>

      </main>
    );
  }


  // =======================================================
  // SESSION COUNTS
  // =======================================================

  const usedKeys =
    joinKeys.filter(
      (key) => key.used
    ).length;


  const availableKeys =
    joinKeys.filter(
      (key) => !key.used
    ).length;


  // =======================================================
  // PAGE
  // =======================================================

  return (

    <main className="min-h-screen bg-black text-white px-4 py-8">

      <div className="max-w-6xl mx-auto">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <div className="flex items-center gap-3">

                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl shadow-lg">
                  🎭
                </div>

                <div>

                  <h1 className="text-4xl font-black tracking-tight">
                    SECRET SHOWDOWN
                  </h1>

                  <p className="text-gray-400 mt-1">
                    Host Dashboard
                  </p>

                </div>

              </div>

            </div>


            <div
              className={`px-5 py-3 rounded-full text-sm font-black tracking-wide w-fit ${
                game.game_started
                  ? "bg-green-600/20 text-green-400 border border-green-500/40"
                  : "bg-yellow-600/20 text-yellow-400 border border-yellow-500/40"
              }`}
            >

              {game.game_started
                ? "● GAME IN PROGRESS"
                : "● WAITING"}

            </div>

          </div>

        </header>


        {/* =================================================
            MESSAGE
        ================================================= */}

        {message && (

          <div className="mb-6 rounded-xl bg-gray-900 border border-gray-700 p-4 flex items-start gap-3">

            <span className="text-xl">
              ℹ️
            </span>

            <p className="text-gray-200">
              {message}
            </p>

          </div>

        )}


        {/* =================================================
            GAME STATS
        ================================================= */}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">

            <p className="text-gray-400 text-sm">
              Players
            </p>

            <p className="text-3xl font-black mt-2">

              {game.players_count}/
              {game.max_players}

            </p>

          </div>


          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">

            <p className="text-gray-400 text-sm">
              Active
            </p>

            <p className="text-3xl font-black mt-2">
              {game.active_players}
            </p>

          </div>


          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">

            <p className="text-gray-400 text-sm">
              Combinations Left
            </p>

            <p className="text-3xl font-black mt-2">
              {game.available_combinations}
            </p>

          </div>


          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">

            <p className="text-gray-400 text-sm">
              Registration
            </p>

            <p className="text-xl font-black mt-3">

              {game.registration_open
                ? "🟢 OPEN"
                : "🔴 CLOSED"}

            </p>

          </div>

        </section>


        {/* =================================================
            CURRENT PLAYER / WHEEL
        ================================================= */}

        <section className="bg-gray-900 rounded-3xl p-8 mb-8 text-center border border-gray-800 shadow-2xl">

          <p className="text-gray-400 uppercase tracking-[0.25em] text-sm font-bold">

            {spinning
              ? "THE MOMENT OF TRUTH"
              : selectedPlayer
              ? "PLAYER SELECTED"
              : "CURRENT PLAYER"}

          </p>


          <h2 className="text-4xl font-black mt-3">

            {selectedPlayer ||
              (spinning
                ? "SPINNING..."
                : game.current_player?.name ||
                  "Waiting...")}

          </h2>


          <div className="relative mx-auto mt-8 w-[min(75vw,520px)] aspect-square">

            {/* POINTER */}

            <div className="absolute z-30 left-1/2 -translate-x-1/2 -top-5">

              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[35px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />

            </div>


            {/* GLOW */}

            <div className="absolute inset-0 rounded-full bg-purple-600/20 blur-2xl" />


            {/* WHEEL */}

            <div
              className="absolute inset-3 rounded-full overflow-hidden border-8 border-white shadow-2xl"
              style={{
                transform:
                  `rotate(${rotation}deg)`,

                transition:
                  spinning
                    ? "transform 10s cubic-bezier(0.12, 0.8, 0.18, 1)"
                    : "none",

                background:
                  activePlayers.length > 0
                    ? `conic-gradient(${activePlayers
                        .map(
                          (_, index) => {

                            const start =
                              (index /
                                activePlayers.length) *
                              100;

                            const end =
                              ((index + 1) /
                                activePlayers.length) *
                              100;

                            return `${wheelColors[index % wheelColors.length]} ${start}% ${end}%`;
                          }
                        )
                        .join(", ")})`
                    : "#222",
              }}
            >

              {activePlayers.map(
                (
                  player,
                  index
                ) => {

                  const angle =
                    (360 /
                      activePlayers.length) *
                      index +
                    360 /
                      activePlayers.length /
                      2;


                  return (

                    <div
                      key={player.id}
                      className="absolute left-1/2 top-1/2 w-1/2 h-1/2 origin-bottom"
                      style={{
                        transform:
                          `translate(-50%, -100%) rotate(${angle}deg)`,
                      }}
                    >

                      <div className="flex justify-center items-start h-full pt-5 px-2">

                        <span
                          className="text-white font-black text-xs md:text-sm max-w-[100px] truncate drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
                          style={{
                            transform:
                              `rotate(${-angle}deg)`,
                          }}
                        >
                          {player.name}
                        </span>

                      </div>

                    </div>

                  );
                }
              )}


              {/* CENTER */}

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-black border-4 border-white flex items-center justify-center text-3xl shadow-2xl">
                🎯
              </div>

            </div>

          </div>


          <div className="mt-8">

            {spinning ? (

              <p className="text-purple-400 font-bold animate-pulse">
                🎡 The wheel is slowing down...
              </p>

            ) : selectedPlayer ? (

              <p className="text-green-400 font-black text-xl">
                🎯 {selectedPlayer}'s turn!
              </p>

            ) : (

              <p className="text-gray-400">

                {game.game_started
                  ? "Ready for the next spin."
                  : "Waiting for the host to start the game..."}

              </p>

            )}

          </div>


          <button
            onClick={spinWheel}
            disabled={
              loading ||
              spinLocked ||
              spinning ||
              !game.game_started ||
              game.active_players <= 1
            }
            className="mt-8 px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-bold text-lg transition shadow-lg"
          >

            {spinning ||
            spinLocked
              ? "🎡 SPINNING..."
              : "🎡 SPIN WHEEL"}

          </button>

        </section>


        {/* =================================================
            GUESS RESULTS
        ================================================= */}

        <section className="bg-gray-900 rounded-2xl p-6 mb-8 border border-purple-800/60">

          <div className="flex items-center justify-between gap-4">

            <h2 className="text-2xl font-black">
              GUESS RESULTS
            </h2>

            <span className="text-xs text-gray-500 font-bold">
              GUESS #{game.guess_number || 0}
            </span>

          </div>


          {!game.last_guess_result ? (

            <p className="text-gray-500 mt-3">
              Waiting for the first guess...
            </p>

          ) : (

            <>

              <p className="text-gray-300 font-semibold mt-3">

                {game.last_guess_result.guesser_name}

                {" → "}

                {game.last_guess_result.target_player_name ||
                  game.last_guess_result.eliminated_player}

              </p>


              <div className="grid md:grid-cols-2 gap-3 mt-5">

                <div className="rounded-xl border border-gray-700 bg-black/20 p-4">

                  <p className="font-black">

                    {game.last_guess_result.shape_correct ? (

                      <>

                        Shape:

                        <span className="text-green-400 ml-1">

                          ✓ Correct{" "}

                          {game.last_guess_result.guessed_shape ===
                          "triangle"
                            ? "🔺"
                            : game.last_guess_result.guessed_shape ===
                              "circle"
                            ? "⭕"
                            : "⬛"}

                        </span>

                      </>

                    ) : (

                      <>

                        Shape:

                        <span className="text-red-400 ml-1">
                          ✕ Wrong shape
                        </span>

                      </>

                    )}

                  </p>

                </div>


                <div className="rounded-xl border border-gray-700 bg-black/20 p-4">

                  <p className="font-black">

                    {game.last_guess_result.color_correct ? (

                      <>

                        Color:

                        <span className="text-green-400 ml-1">

                          ✓ Correct{" "}

                          {game.last_guess_result.guessed_color ===
                          "red"
                            ? "🔴"
                            : game.last_guess_result.guessed_color ===
                              "blue"
                            ? "🔵"
                            : "🟢"}

                        </span>

                      </>

                    ) : (

                      <>

                        Color:

                        <span className="text-red-400 ml-1">
                          ✕ Wrong color
                        </span>

                      </>

                    )}

                  </p>

                </div>

              </div>


              {game.last_guess_result.guesser_eliminated ? (

                <p className="text-red-400 font-black mt-4">

                  ❌{" "}

                  {game.last_guess_result.guesser_name}

                  {" has been eliminated."}

                </p>

              ) : game.last_guess_result.shape_correct &&
                game.last_guess_result.color_correct ? (

                <p className="text-green-400 font-black mt-4">

                  🎯 Perfect guess —{" "}

                  {game.last_guess_result.eliminated_player ||
                    game.last_guess_result.target_player_name}

                  {" has been eliminated."}

                </p>

              ) : (

                <p className="text-yellow-300 font-bold mt-4">
                  ❤️ One chance has been lost.
                </p>

              )}

            </>

          )}

        </section>


        {/* =================================================
            CONTESTANT ACCESS / JOIN KEYS
        ================================================= */}

        <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/40 rounded-3xl p-6 md:p-8 mb-8 border border-purple-800/60 shadow-2xl">

          {/* Decorative glow */}

          <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />


          <div className="relative">

            {/* HEADER */}

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">

              <div>

                <div className="flex items-center gap-3">

                  <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl">
                    🎟️
                  </div>

                  <div>

                    <h2 className="text-2xl md:text-3xl font-black">
                      CONTESTANT ACCESS
                    </h2>

                    <p className="text-gray-400 mt-1">
                      Give each contestant a private key to join this session.
                    </p>

                  </div>

                </div>

              </div>


              {/* SESSION STATUS */}

              {session && (

                <div
                  className={`px-4 py-3 rounded-xl border text-sm font-bold ${
                    session.status ===
                    "WAITING"
                      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                      : session.status ===
                        "LIVE"
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-gray-800 border-gray-700 text-gray-400"
                  }`}
                >

                  {session.status ===
                  "WAITING"
                    ? "🟡 WAITING"
                    : session.status ===
                      "LIVE"
                    ? "🟢 LIVE"
                    : "⚫ ENDED"}

                </div>

              )}

            </div>


            {/* SESSION INFORMATION */}

            <div className="mt-6 grid md:grid-cols-2 gap-4">

              <div className="rounded-2xl bg-black/30 border border-gray-800 p-5">

                <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                  Current Session
                </p>


                {session ? (

                  <>

                    <p className="font-mono text-sm md:text-base text-purple-300 mt-3 break-all">
                      {session.id}
                    </p>

                    <p className="text-gray-500 text-xs mt-2">

                      Created{" "}

                      {new Date(
                        session.created_at
                      ).toLocaleString()}

                    </p>

                  </>

                ) : (

                  <p className="text-gray-500 mt-3">
                    No active session.
                  </p>

                )}

              </div>


              <div className="rounded-2xl bg-black/30 border border-gray-800 p-5">

                <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                  Join Keys
                </p>


                <div className="flex items-end gap-6 mt-3">

                  <div>

                    <p className="text-3xl font-black text-green-400">
                      {availableKeys}
                    </p>

                    <p className="text-xs text-gray-500">
                      Available
                    </p>

                  </div>


                  <div>

                    <p className="text-3xl font-black text-red-400">
                      {usedKeys}
                    </p>

                    <p className="text-xs text-gray-500">
                      Used
                    </p>

                  </div>

                </div>

              </div>

            </div>


            {/* SESSION ERROR */}

            {sessionError && (

              <div className="mt-5 rounded-xl bg-red-950/30 border border-red-900/60 p-4 text-red-300">
                ⚠️ {sessionError}
              </div>

            )}


            {/* SESSION ACTIONS */}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">

              {!session ? (

                <button
                  onClick={createGameSession}
                  disabled={sessionLoading}
                  className="px-6 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-black transition"
                >

                  {sessionLoading
                    ? "CREATING SESSION..."
                    : "🎮 CREATE GAME SESSION"}

                </button>

              ) : (

                <>

                  {session.status ===
                    "WAITING" && (

                    <button
                      onClick={
                        generateJoinKeys
                      }
                      disabled={
                        keysLoading
                      }
                      className="px-6 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-black transition"
                    >

                      {keysLoading
                        ? "GENERATING..."
                        : joinKeys.length >
                          0
                        ? "🎟️ GENERATE / REFRESH KEYS"
                        : "🎟️ GENERATE 8 JOIN KEYS"}

                    </button>

                  )}


                  {session.status !==
                    "ENDED" && (

                    <button
                      onClick={
                        endGameSession
                      }
                      disabled={
                        sessionLoading
                      }
                      className="px-6 py-4 rounded-xl bg-red-600/80 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-bold transition"
                    >

                      {sessionLoading
                        ? "ENDING..."
                        : "⛔ END SESSION"}

                    </button>

                  )}

                </>

              )}

            </div>


            {/* JOIN KEYS */}

            {joinKeys.length > 0 && (

              <div className="mt-8">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">

                  <div>

                    <h3 className="text-xl font-black">
                      Contestant Keys
                    </h3>

                    <p className="text-gray-500 text-sm mt-1">
                      Give one unused key to one contestant.
                      Each key can only be used once.
                    </p>

                  </div>


                  <div className="text-xs font-bold text-gray-500">
                    {usedKeys}/
                    {joinKeys.length} USED
                  </div>

                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                  {joinKeys.map(
                    (
                      joinKey,
                      index
                    ) => (

                      <div
                        key={
                          joinKey.id
                        }
                        className={`rounded-2xl border p-4 transition ${
                          joinKey.used
                            ? "bg-red-950/20 border-red-900/50 opacity-60"
                            : "bg-black/30 border-gray-700 hover:border-purple-500/60"
                        }`}
                      >

                        <div className="flex items-center justify-between mb-3">

                          <span className="text-xs font-bold text-gray-500">
                            CONTESTANT{" "}
                            {index + 1}
                          </span>


                          {joinKey.used ? (

                            <span className="text-xs font-black text-red-400">
                              🔴 USED
                            </span>

                          ) : (

                            <span className="text-xs font-black text-green-400">
                              🟢 AVAILABLE
                            </span>

                          )}

                        </div>


                        <div className="flex items-center gap-2">

                          <div
                            className={`flex-1 rounded-xl px-3 py-3 font-mono font-black tracking-widest text-center ${
                              joinKey.used
                                ? "bg-gray-800 text-gray-500 line-through"
                                : "bg-purple-950/50 text-purple-200"
                            }`}
                          >
                            {joinKey.key}
                          </div>


                          {!joinKey.used && (

                            <button
                              onClick={() =>
                                copyJoinKey(
                                  joinKey.key
                                )
                              }
                              title="Copy join key"
                              className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-purple-700 flex items-center justify-center transition"
                            >

                              {copiedKey ===
                              joinKey.key
                                ? "✓"
                                : "📋"}

                            </button>

                          )}

                        </div>


                        {joinKey.used && (

                          <p className="text-xs text-gray-600 mt-2">
                            This key can no longer be used.
                          </p>

                        )}

                      </div>

                    )
                  )}

                </div>

              </div>

            )}


            {/* EMPTY STATE */}

            {!joinKeys.length &&
              session && (

                <div className="mt-8 rounded-2xl border border-dashed border-gray-700 p-8 text-center">

                  <div className="text-4xl mb-3">
                    🎟️
                  </div>

                  <p className="font-bold">
                    No contestant keys yet
                  </p>

                  <p className="text-gray-500 text-sm mt-2">
                    Generate 8 keys and give one to each contestant.
                  </p>

                </div>

              )}


            {/* SECURITY NOTICE */}

            <div className="mt-6 rounded-xl bg-purple-950/30 border border-purple-900/50 p-4">

              <p className="text-sm text-purple-200">

                🔐{" "}

                <strong>
                  Security:
                </strong>{" "}

                Each join key belongs to this game session
                and can only be used once. When the session
                ends, unused keys become invalid.

              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            WINNER
        ================================================= */}

        {game.winner && (

          <section className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-3xl p-8 mb-8 text-center shadow-xl">

            <div className="text-6xl">
              🏆
            </div>

            <p className="uppercase tracking-[0.3em] text-sm mt-4 font-bold">
              Winner
            </p>

            <h2 className="text-4xl font-black mt-2">
              {game.winner.name}
            </h2>

          </section>

        )}


        {/* =================================================
            CONTESTANTS
        ================================================= */}

        <section className="bg-gray-900 rounded-2xl overflow-hidden mb-8 border border-gray-800">

          <div className="p-6 border-b border-gray-800">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                🔒
              </div>

              <div>

                <h2 className="text-2xl font-bold">
                  Contestants
                </h2>

                <p className="text-gray-400 mt-1">
                  Private host information
                </p>

              </div>

            </div>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-800">

                <tr>

                  <th className="text-left p-4">
                    Player
                  </th>

                  <th className="text-left p-4">
                    Secret
                  </th>

                  <th className="text-left p-4">
                    Status
                  </th>

                  <th className="text-left p-4">
                    Chances
                  </th>

                </tr>

              </thead>


              <tbody>

                {players.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={4}
                      className="p-8 text-center text-gray-500"
                    >
                      No contestants yet.
                    </td>

                  </tr>

                ) : (

                  players.map(
                    (player) => (

                      <tr
                        key={
                          player.id
                        }
                        className="border-t border-gray-800 hover:bg-gray-800/40 transition"
                      >

                        <td className="p-4 font-semibold">
                          {player.name}
                        </td>


                        <td className="p-4">

                          {player.secret ? (

                            <div className="flex items-center gap-2">

                              <span className="font-semibold">
                                {
                                  player
                                    .secret
                                    .shape
                                }
                              </span>

                              <span className="text-gray-500">
                                +
                              </span>

                              <span className="font-semibold">
                                {
                                  player
                                    .secret
                                    .color
                                }
                              </span>

                            </div>

                          ) : (

                            <span className="text-gray-500">
                              Hidden
                            </span>

                          )}

                        </td>


                        <td className="p-4">

                          {player.active ? (

                            <span className="text-green-400 font-semibold">
                              🟢 ACTIVE
                            </span>

                          ) : (

                            <span className="text-red-400 font-semibold">
                              🔴 ELIMINATED
                            </span>

                          )}

                        </td>


                        <td className="p-4">

                          {player.attempts_remaining >
                          0
                            ? "❤️".repeat(
                                player.attempts_remaining
                              )
                            : "❌ OUT"}

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            GAME CONTROLS
        ================================================= */}

        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">

          <h2 className="text-2xl font-bold mb-6">
            Game Controls
          </h2>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* REGISTRATION */}

            {game.registration_open ? (

              <button
                onClick={
                  closeRegistration
                }
                disabled={loading}
                className="px-5 py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold transition"
              >
                🔒 CLOSE REGISTRATION
              </button>

            ) : (

              <button
                onClick={
                  openRegistration
                }
                disabled={
                  loading ||
                  game.game_started
                }
                className="px-5 py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold transition"
              >
                🔓 OPEN REGISTRATION
              </button>

            )}


            {/* START */}

            <button
              onClick={startGame}
              disabled={
                loading ||
                game.game_started ||
                game.registration_open ||
                game.players_count < 2
              }
              className="px-5 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold transition"
            >
              ▶ START GAME
            </button>


            {/* SPIN */}

            <button
              onClick={
                spinWheel
              }
              disabled={
                loading ||
                spinLocked ||
                !game.game_started ||
                game.active_players <= 1
              }
              className="px-5 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold transition"
            >
              🎡 SPIN WHEEL
            </button>


            {/* RESET */}

            <button
              onClick={
                resetGame
              }
              disabled={loading}
              className="px-5 py-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold transition"
            >
              🔄 RESET GAME
            </button>

          </div>

        </section>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="text-center py-8 text-gray-600 text-xs">

          <p className="font-semibold tracking-widest">
            SECRET SHOWDOWN
          </p>

          <p className="mt-1">
            Host Control Center
          </p>

        </footer>

      </div>

    </main>
  );
}