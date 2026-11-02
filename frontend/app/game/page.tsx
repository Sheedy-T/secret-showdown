"use client";

import { useEffect, useMemo, useState,useRef } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

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
  winner?: { id: string; name: string };
  guesser_name?: string;
  target_player_name?: string;
  guessed_shape?: Shape;
  guessed_color?: Color;
};

type GameStatus = {
  registration_open: boolean;
  game_started: boolean;
  players_count: number;
  max_players: number;
  active_players: number;
  current_player: {
    id: string;
    name: string;
  } | null;
  winner: {
    id: string;
    name: string;
  } | null;
  available_combinations: number;
  spin_number: number;
  guess_number: number;
  last_guess_result: PublicGuessResult | null;
};

type MeResponse = {
  id: string;
  name: string;
  active: boolean;
  attempts_remaining: number;
  is_my_turn: boolean;
};

type GuessResult = {
  result: string;
  message: string;
  shape_correct: boolean;
  color_correct: boolean;
  attempts_remaining?: number;
  guesser_eliminated?: boolean;
  eliminated_player?: string;
  target_information?: {
    shape?: string | null;
    color?: string | null;
  };
  winner?: {
    id: string;
    name: string;
  };
};

type Shape = "triangle" | "circle" | "square";
type Color = "red" | "blue" | "green";

export default function GamePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<GameStatus | null>(null);

  // =====================================================
  // CURRENT CONTESTANT
  // =====================================================

  const [me, setMe] = useState<MeResponse | null>(null);

  // =====================================================
  // WHEEL
  // =====================================================

  const [spinning, setSpinning] = useState(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<string | null>(null);

  const [rotation, setRotation] = useState(0);

  // =====================================================
  // GUESS FORM
  // =====================================================

  const [targetPlayerId, setTargetPlayerId] =
    useState("");

  const [guessedShape, setGuessedShape] =
    useState<Shape | "">("");

  const [guessedColor, setGuessedColor] =
    useState<Color | "">("");

  const [submittingGuess, setSubmittingGuess] =
    useState(false);


  const [message, setMessage] = useState("");
  
  // WHEEL STATE
  // Prevent the polling function from starting the same
// wheel animation multiple times.
const spinningRef = useRef(false);

// Track spin events observed after this page mounted. A spin already in
// the game state on first load is historical and must not replay after a guess.
const lastObservedSpinNumberRef = useRef<number | null>(null);
const pendingSpinNumberRef = useRef<number | null>(null);

// Keep track of the latest wheel rotation without
// depending on React state inside asynchronous callbacks.
const rotationRef = useRef(0);

// Store the timeout so it can be cancelled if necessary.
const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
  null
);

  // =====================================================
  // WHEEL COLORS
  // =====================================================

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

  // =====================================================
// LOAD GAME
// =====================================================

async function loadGame() {
  try {
    const response = await fetch(
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

    const data: GameStatus =
      await response.json();

    setGame(data);

    // Wheel animation is triggered by the effect below once
    // both game state and player list are available.

  } catch (error) {
    console.error(error);
  }
}

  // =====================================================
  // LOAD PLAYERS
  // =====================================================

  async function loadPlayers() {
    try {
      const response = await fetch(
        `${API_URL}/api/players`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load players."
        );
      }

      const data: Player[] =
        await response.json();

      setPlayers(data);
    } catch (error) {
      console.error(error);
    }
  }

  // =====================================================
  // LOAD CURRENT CONTESTANT
  // =====================================================

  async function loadMe() {
    const token =
      localStorage.getItem(
        "secret_showdown_token"
      );

    if (!token) {
      setMe(null);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/me`,
        {
          cache: "no-store",
          headers: {
            "x-player-token": token,
          },
        }
      );

      if (!response.ok) {
        console.warn(
          "Could not identify contestant."
        );

        return;
      }

      const data: MeResponse =
        await response.json();

      setMe(data);
    } catch (error) {
      console.error(error);
    }
  }

  // =====================================================
  // REFRESH
  // =====================================================

  async function refresh() {
    await Promise.all([
      loadGame(),
      loadPlayers(),
      loadMe(),
    ]);
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================
   
    useEffect(() => {
  refresh();

  const interval = setInterval(() => {
    refresh();
  }, 2000);

  return () => {
    clearInterval(interval);

    if (wheelTimerRef.current) {
      clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = null;
    }
  };
}, []);

  // =====================================================
  // ACTIVE PLAYERS
  // =====================================================

  const activePlayers = useMemo(() => {
    return players
      .filter((player) => player.active)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [players]);

  // =====================================================
  // POSSIBLE TARGETS
  // =====================================================

  const targetPlayers = useMemo(() => {
    return activePlayers.filter(
      (player) => player.id !== me?.id
    );
  }, [activePlayers, me]);

  // Animate only a NEW spin event observed while this page is open.
// A guess changes player/result state, but does not create a spin event.
  // If the game is already running when the page opens, baseline the current
  // spin number instead of replaying that old spin on a later contestant update.
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
    if (spinningRef.current || activePlayers.length < 2) return;

    const selected = activePlayers.find(
      (player) => player.id === game.current_player?.id
    );

    if (!selected) return;

    // Consume the event before starting the animation so a re-render cannot
    // replay it. Only a later backend spin_number increment can spin again.
    pendingSpinNumberRef.current = null;
    startWheelAnimation(selected.id, selected.name);
  }, [
    game?.spin_number,
    game?.current_player?.id,
    game?.game_started,
    activePlayers,
  ]);

  // =====================================================
  // WHEEL ANIMATION
  // =====================================================

function startWheelAnimation(
  winnerId: string,
  winnerName: string
) {
  // ---------------------------------------------------
  // Prevent duplicate animations
  // ---------------------------------------------------

  if (spinningRef.current) {
    return;
  }

  // We need at least two active contestants for the wheel.
  if (activePlayers.length < 2) {
    return;
  }

  // ---------------------------------------------------
  // Find the selected player on the wheel
  // ---------------------------------------------------

  const winnerIndex = activePlayers.findIndex(
    (player) => player.id === winnerId
  );

  if (winnerIndex === -1) {
    console.warn(
      "Selected player was not found among active players:",
      winnerId
    );

    return;
  }

  // ---------------------------------------------------
  // Mark wheel as spinning BEFORE changing anything
  // ---------------------------------------------------

  spinningRef.current = true;

  setSpinning(true);

  // VERY IMPORTANT:
  // Do not display the winner yet.
  //
  // The backend has selected the player, but the user
  // should only see the winner after the wheel finishes.
  setSelectedPlayer(null);

  // ---------------------------------------------------
  // Calculate wheel position
  // ---------------------------------------------------

  const segmentAngle =
    360 / activePlayers.length;

  const targetAngle =
    360 -
    (
      winnerIndex * segmentAngle +
      segmentAngle / 2
    );

  // ---------------------------------------------------
  // Add multiple full rotations for suspense
  // ---------------------------------------------------

  const extraSpins = 8;

  const currentRotation =
    rotationRef.current;

  const finalRotation =
    currentRotation +
    extraSpins * 360 +
    targetAngle;

  // Save the rotation in the ref immediately.
  rotationRef.current = finalRotation;

  // Update React state so the wheel visually rotates.
  setRotation(finalRotation);

  // ---------------------------------------------------
  // Clear any previous timer
  // ---------------------------------------------------

  if (wheelTimerRef.current) {
    clearTimeout(wheelTimerRef.current);
  }

  // ---------------------------------------------------
  // Wait for the FULL 10-second animation
  // ---------------------------------------------------

  wheelTimerRef.current = setTimeout(() => {
    // The wheel animation is now complete.

    spinningRef.current = false;

    setSpinning(false);

    // NOW reveal the selected player.
    setSelectedPlayer(winnerName);

    wheelTimerRef.current = null;
  }, 10000);
}

  // =====================================================
  // SUBMIT GUESS
  // =====================================================

  async function submitGuess() {
    if (!me) {
      setMessage(
        "Your contestant session could not be found."
      );
      return;
    }

    if (!me.is_my_turn) {
      setMessage(
        "It is not your turn."
      );
      return;
    }

    if (!targetPlayerId) {
      setMessage(
        "Please choose a contestant."
      );
      return;
    }

    if (!guessedShape) {
      setMessage(
        "Please choose a shape."
      );
      return;
    }

    if (!guessedColor) {
      setMessage(
        "Please choose a color."
      );
      return;
    }

    setSubmittingGuess(true);
    setMessage("");

    try {
      const token =
        localStorage.getItem(
          "secret_showdown_token"
        );

      if (!token) {
        throw new Error(
          "Your contestant token was not found."
        );
      }

      const response = await fetch(
        `${API_URL}/api/guess`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-player-token":
              token,
          },

          body: JSON.stringify({
            target_player_id:
              targetPlayerId,

            shape: guessedShape,

            color: guessedColor,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to submit guess."
        );
      }

      /*
       * Clear the form after submission.
       */

      setTargetPlayerId("");
      setGuessedShape("");
      setGuessedColor("");

      /*
       * Immediately refresh public state.
       */

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSubmittingGuess(false);
    }
  }

  // =====================================================
  // RESULT MESSAGE
  // =====================================================

  function renderGuessResult() {
    const result = game?.last_guess_result;

    if (!result) {
      return (
        <section className="bg-gray-950 border border-gray-800 rounded-3xl p-6">
          <h3 className="text-xl font-black tracking-wide">GUESS RESULTS</h3>
          <p className="text-gray-500 mt-3">Waiting for the first guess...</p>
        </section>
      );
    }

    const shapeEmoji: Record<string, string> = {
      triangle: "🔺",
      circle: "⭕",
      square: "⬛",
    };

    const colorEmoji: Record<string, string> = {
      red: "🔴",
      blue: "🔵",
      green: "🟢",
    };

    const shapeHint = result.shape_correct && result.guessed_shape
      ? shapeEmoji[result.guessed_shape]
      : "";
    const colorHint = result.color_correct && result.guessed_color
      ? colorEmoji[result.guessed_color]
      : "";

    return (
      <section className="bg-gray-950 border border-purple-800/70 rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-black tracking-wide">GUESS RESULTS</h3>
          <span className="text-xs text-gray-500 font-bold">
            GUESS #{game?.guess_number ?? 0}
          </span>
        </div>

        <p className="text-gray-300 mt-3 font-semibold">
          {result.guesser_name || "Contestant"}
          {" → "}
          {result.target_player_name || result.eliminated_player || "Contestant"}
        </p>

        <div className="mt-5 space-y-3">
          <div className={`rounded-xl p-4 border ${result.shape_correct ? "border-green-500/40 bg-green-950/30" : "border-red-500/30 bg-red-950/20"}`}>
            <p className="font-black">
              {result.shape_correct
                ? <>Shape: <span className="text-green-400">✓ Correct {shapeHint}</span></>
                : <>Shape: <span className="text-red-400">✕ Wrong shape</span></>}
            </p>
          </div>

          <div className={`rounded-xl p-4 border ${result.color_correct ? "border-green-500/40 bg-green-950/30" : "border-red-500/30 bg-red-950/20"}`}>
            <p className="font-black">
              {result.color_correct
                ? <>Color: <span className="text-green-400">✓ Correct {colorHint}</span></>
                : <>Color: <span className="text-red-400">✕ Wrong color</span></>}
            </p>
          </div>
        </div>

        {result.guesser_eliminated ? (
          <p className="text-red-400 font-black mt-4">❌ {result.guesser_name} has been eliminated.</p>
        ) : result.shape_correct && result.color_correct ? (
          <p className="text-green-400 font-black mt-4">🎯 Perfect guess — {result.eliminated_player || result.target_player_name} has been eliminated.</p>
        ) : (
          <p className="text-yellow-300 font-bold mt-4">❤️ One chance has been lost.</p>
        )}
      </section>
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (!game) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">
            🔐
          </div>

          <h1 className="text-3xl font-bold">
            SECRET SHOWDOWN
          </h1>

          <p className="text-gray-400 mt-3">
            Connecting to the live game...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">

      {/* ================================================= */}
      {/* TOP BRANDING */}
      {/* ================================================= */}

      <header className="border-b border-gray-800 bg-black/90">
        <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">

          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              🔐 SECRET SHOWDOWN
            </h1>

            <p className="text-xs md:text-sm text-gray-500 mt-1 tracking-widest">
              SHAPE • COLOR • GUESS • SURVIVE
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />

            <span className="text-xs md:text-sm font-bold text-red-400">
              LIVE
            </span>
          </div>

        </div>
      </header>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="grid lg:grid-cols-[1fr_350px] gap-8">

          {/* ================================================= */}
          {/* WHEEL AREA */}
          {/* ================================================= */}

          <section className="bg-gray-950 border border-gray-800 rounded-3xl p-6 md:p-10">

            <div className="text-center mb-8">

              <p className="text-purple-400 uppercase tracking-[0.3em] text-sm font-bold">
                {spinning
                  ? "THE MOMENT OF TRUTH"
                  : selectedPlayer
                  ? "PLAYER SELECTED"
                  : "WHO'S NEXT?"}
              </p>

              <h2 className="text-3xl md:text-5xl font-black mt-3">

                {selectedPlayer
                  ? selectedPlayer
                  : spinning
                  ? "SPINNING..."
                  : game.current_player
                  ? game.current_player.name
                  : "Waiting..."}

              </h2>

            </div>


            {/* ================================================= */}
            {/* WHEEL */}
            {/* ================================================= */}

            <div className="relative mx-auto w-[min(75vw,520px)] aspect-square">

              {/* POINTER */}

              <div className="absolute z-30 left-1/2 -translate-x-1/2 -top-5">

                <div
                  className="
                    w-0
                    h-0
                    border-l-[18px]
                    border-r-[18px]
                    border-t-[35px]
                    border-l-transparent
                    border-r-transparent
                    border-t-white
                    drop-shadow-lg
                  "
                />

              </div>


              {/* OUTER GLOW */}

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
                      ? `conic-gradient(
                          ${activePlayers
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

                                const color =
                                  wheelColors[
                                    index %
                                      wheelColors.length
                                  ];

                                return `${color} ${start}% ${end}%`;
                              }
                            )
                            .join(", ")}
                        )`
                      : "#222",
                }}
              >

                {/* PLAYER LABELS */}

                {activePlayers.map(
                  (player, index) => {

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
                            className="
                              text-white
                              font-black
                              text-xs
                              md:text-sm
                              max-w-[100px]
                              truncate
                              drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]
                            "
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

                <div
                  className="
                    absolute
                    left-1/2
                    top-1/2
                    -translate-x-1/2
                    -translate-y-1/2
                    w-24
                    h-24
                    rounded-full
                    bg-black
                    border-4
                    border-white
                    flex
                    items-center
                    justify-center
                    text-3xl
                    shadow-2xl
                  "
                >
                  🎯
                </div>

              </div>

            </div>


            {/* ================================================= */}
            {/* SPIN STATUS */}
            {/* ================================================= */}

            <div className="text-center mt-10">

              {spinning && (
                <p className="text-purple-400 font-bold animate-pulse">
                  🎡 The wheel is slowing down...
                </p>
              )}

              {!spinning &&
                selectedPlayer && (
                  <p className="text-green-400 font-black text-xl">
                    🎯 {selectedPlayer}'s turn!
                  </p>
                )}

              {!game.game_started && (
                <p className="text-gray-500">
                  Waiting for the host to start
                  the game...
                </p>
              )}

            </div>

          </section>

          {/* ================================================= */}
          {/* PUBLIC GUESS RESULTS */}
          {/* ================================================= */}

          <div className="mt-6">
            {renderGuessResult()}
          </div>


          {/* ================================================= */}
          {/* SIDE PANEL */}
          {/* ================================================= */}

          <aside className="space-y-6">

            {/* ================================================= */}
            {/* MY STATUS */}
            {/* ================================================= */}

            {me && (
              <section className="bg-gray-950 border border-purple-800 rounded-3xl p-6">

                <p className="text-purple-400 uppercase tracking-widest text-xs font-black">
                  YOUR CONTESTANT
                </p>

                <h3 className="text-2xl font-black mt-2">
                  {me.name}
                </h3>

                <div className="mt-4 flex items-center justify-between">

                  <span
                    className={
                      me.active
                        ? "text-green-400 font-bold"
                        : "text-red-400 font-bold"
                    }
                  >
                    {me.active
                      ? "🟢 ACTIVE"
                      : "🔴 ELIMINATED"}
                  </span>

                  <span className="text-xl">
                    {me.active
                      ? "❤️".repeat(
                          me.attempts_remaining
                        )
                      : "❌"}
                  </span>

                </div>

                {me.is_my_turn && me.active && (
                  <div className="mt-5 rounded-xl bg-purple-600/20 border border-purple-500/30 p-4 text-center">
                    <p className="text-purple-300 font-black">
                      🔥 IT'S YOUR TURN!
                    </p>

                    <p className="text-gray-400 text-sm mt-1">
                      Make your guess below.
                    </p>
                  </div>
                )}

              </section>
            )}


            {/* ================================================= */}
            {/* GUESS PANEL */}
            {/* ================================================= */}

            {me &&
              me.active &&
              me.is_my_turn &&
              !spinning && (
                <section className="bg-gray-950 border border-purple-600 rounded-3xl p-6">

                  <div className="text-center mb-6">

                    <div className="text-4xl">
                      🎯
                    </div>

                    <h3 className="text-2xl font-black mt-2">
                      MAKE YOUR GUESS
                    </h3>

                    <p className="text-gray-500 text-sm mt-2">
                      Choose who you want to
                      eliminate.
                    </p>

                  </div>


                  {/* TARGET */}

                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Target contestant
                  </label>

                  <select
                    value={targetPlayerId}
                    onChange={(event) =>
                      setTargetPlayerId(
                        event.target.value
                      )
                    }
                    className="
                      w-full
                      bg-gray-900
                      border
                      border-gray-700
                      rounded-xl
                      px-4
                      py-3
                      text-white
                      focus:outline-none
                      focus:border-purple-500
                    "
                  >

                    <option value="">
                      Choose contestant...
                    </option>

                    {targetPlayers.map(
                      (player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}
                        </option>
                      )
                    )}

                  </select>


                  {/* SHAPE */}

                  <label className="block text-sm font-bold text-gray-300 mt-5 mb-2">
                    Guess their shape
                  </label>

                  <div className="grid grid-cols-3 gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setGuessedShape(
                          "triangle"
                        )
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedShape ===
                          "triangle"
                            ? "border-purple-500 bg-purple-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        🔺
                      </div>

                      <div className="text-xs mt-1">
                        Triangle
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setGuessedShape(
                          "circle"
                        )
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedShape ===
                          "circle"
                            ? "border-purple-500 bg-purple-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        ⭕
                      </div>

                      <div className="text-xs mt-1">
                        Circle
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setGuessedShape(
                          "square"
                        )
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedShape ===
                          "square"
                            ? "border-purple-500 bg-purple-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        ⬛
                      </div>

                      <div className="text-xs mt-1">
                        Square
                      </div>
                    </button>

                  </div>


                  {/* COLOR */}

                  <label className="block text-sm font-bold text-gray-300 mt-5 mb-2">
                    Guess their color
                  </label>

                  <div className="grid grid-cols-3 gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setGuessedColor("red")
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedColor ===
                          "red"
                            ? "border-red-400 bg-red-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        🔴
                      </div>

                      <div className="text-xs mt-1">
                        Red
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setGuessedColor(
                          "blue"
                        )
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedColor ===
                          "blue"
                            ? "border-blue-400 bg-blue-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        🔵
                      </div>

                      <div className="text-xs mt-1">
                        Blue
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setGuessedColor(
                          "green"
                        )
                      }
                      className={`
                        rounded-xl
                        border
                        p-3
                        text-center
                        transition
                        ${
                          guessedColor ===
                          "green"
                            ? "border-green-400 bg-green-600/30"
                            : "border-gray-700 bg-gray-900"
                        }
                      `}
                    >
                      <div className="text-2xl">
                        🟢
                      </div>

                      <div className="text-xs mt-1">
                        Green
                      </div>
                    </button>

                  </div>


                  {/* SUBMIT */}

                  <button
                    onClick={submitGuess}
                    disabled={
                      submittingGuess ||
                      !targetPlayerId ||
                      !guessedShape ||
                      !guessedColor
                    }
                    className="
                      w-full
                      mt-6
                      py-4
                      rounded-xl
                      bg-purple-600
                      hover:bg-purple-700
                      disabled:bg-gray-700
                      disabled:cursor-not-allowed
                      font-black
                      text-lg
                      transition
                    "
                  >
                    {submittingGuess
                      ? "CHECKING..."
                      : "🎯 SUBMIT GUESS"}
                  </button>


                  {/* ERROR */}

                  {message && (
                    <p className="text-red-400 text-sm font-bold mt-4 text-center">
                      {message}
                    </p>
                  )}

                </section>
              )}


            {/* ================================================= */}
            {/* HOW TO PLAY */}
            {/* ================================================= */}

            <section className="bg-gray-950 border border-gray-800 rounded-3xl p-6">

              <h3 className="text-xl font-black mb-5">
                🔥 HOW TO PLAY
              </h3>

              <div className="space-y-4 text-sm">

                <div className="flex gap-3">
                  <span className="text-xl">
                    🔐
                  </span>

                  <p className="text-gray-300">
                    Every contestant secretly
                    chooses one shape and one
                    color.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="text-xl">
                    🎯
                  </span>

                  <p className="text-gray-300">
                    Guess another player's
                    secret.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="text-xl">
                    ❤️
                  </span>

                  <p className="text-gray-300">
                    You have two chances to
                    survive.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="text-xl">
                    🏆
                  </span>

                  <p className="text-gray-300">
                    Last player standing wins
                    the prize.
                  </p>
                </div>

              </div>

            </section>


            {/* ================================================= */}
            {/* PRIZE */}
            {/* ================================================= */}

            <section className="bg-gradient-to-br from-yellow-500 to-orange-600 text-black rounded-3xl p-6">

              <p className="uppercase tracking-widest text-xs font-black">
                FINAL PRIZE
              </p>

              <h2 className="text-4xl font-black mt-2">
                💰 CASH PRIZE
              </h2>

              <p className="mt-3 font-semibold">
                Last player standing goes
                home with the final contribution.
              </p>

            </section>


            {/* ================================================= */}
            {/* CONTESTANT COUNT */}
            {/* ================================================= */}

            <section className="bg-gray-950 border border-gray-800 rounded-3xl p-6">

              <div className="flex justify-between items-center">

                <div>

                  <p className="text-gray-500 text-sm">
                    CONTESTANTS
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {game.players_count}

                    <span className="text-gray-600">
                      /{game.max_players}
                    </span>
                  </p>

                </div>

                <div className="text-4xl">
                  👥
                </div>

              </div>

            </section>

          </aside>

        </div>


        {/* ================================================= */}
        {/* CONTESTANTS */}
        {/* ================================================= */}

        <section className="mt-8 bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden">

          <div className="p-6 border-b border-gray-800">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-2xl font-black">
                  CONTESTANTS
                </h2>

                <p className="text-gray-500 text-sm mt-1">
                  Watch the battle unfold.
                </p>

              </div>

              <div className="text-purple-400 font-bold">
                {game.active_players} ACTIVE
              </div>

            </div>

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

            {players.map((player) => (

              <div
                key={player.id}
                className={`
                  p-5
                  border-b
                  border-r
                  border-gray-800
                  ${
                    player.active
                      ? ""
                      : "opacity-40"
                  }
                `}
              >

                <div className="flex items-center justify-between">

                  <div>

                    <p className="font-black">
                      {player.name}
                    </p>

                    <p className="text-xs mt-1">

                      {player.active ? (
                        <span className="text-green-400">
                          🟢 ACTIVE
                        </span>
                      ) : (
                        <span className="text-red-400">
                          🔴 ELIMINATED
                        </span>
                      )}

                    </p>

                  </div>

                  <div className="text-lg">

                    {player.active
                      ? "❤️".repeat(
                          player.attempts_remaining
                        )
                      : "❌"}

                  </div>

                </div>

              </div>

            ))}

          </div>

        </section>


        {/* ================================================= */}
        {/* PROMOTIONAL AREA */}
        {/* ================================================= */}

        <section className="mt-8 grid md:grid-cols-3 gap-5">

          <div className="bg-purple-950 border border-purple-800 rounded-3xl p-6">

            <div className="text-3xl mb-3">
              🎮
            </div>

            <h3 className="font-black text-xl">
              BECOME A CONTESTANT
            </h3>

            <p className="text-gray-400 text-sm mt-2">
              Want to test your instincts?
              Join the next Secret Showdown.
            </p>

          </div>


          <div className="bg-green-950 border border-green-800 rounded-3xl p-6">

            <div className="text-3xl mb-3">
              💰
            </div>

            <h3 className="font-black text-xl">
              CONTRIBUTE TO THE PRIZE
            </h3>

            <p className="text-gray-400 text-sm mt-2">
              Support the game and help make
              the prize bigger.
            </p>

          </div>


          <div className="bg-blue-950 border border-blue-800 rounded-3xl p-6">

            <div className="text-3xl mb-3">
              🤝
            </div>

            <h3 className="font-black text-xl">
              BECOME A SPONSOR
            </h3>

            <p className="text-gray-400 text-sm mt-2">
              Put your brand in front of a
              live audience.
            </p>

          </div>

        </section>


        {/* ================================================= */}
        {/* FOOTER */}
        {/* ================================================= */}

        <footer className="text-center py-10 text-gray-600 text-sm">

          <p>
            🔐 SECRET SHOWDOWN
          </p>

          <p className="mt-2">
            Shape • Color • Guess • Survive
          </p>

        </footer>

      </div>

    </main>
  );
}