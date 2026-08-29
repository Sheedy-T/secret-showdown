"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

type Shape = "triangle" | "circle" | "square";
type Color = "red" | "blue" | "green";

type Combination = {
  shape: Shape;
  color: Color;
};

const shapes: {
  value: Shape;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "triangle",
    label: "Triangle",
    icon: "🔺",
    description: "Sharp & unpredictable",
  },
  {
    value: "circle",
    label: "Circle",
    icon: "⭕",
    description: "Smooth & mysterious",
  },
  {
    value: "square",
    label: "Square",
    icon: "⬛",
    description: "Solid & strategic",
  },
];

const colors: {
  value: Color;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "red",
    label: "Red",
    icon: "🔴",
    description: "Bold & dangerous",
  },
  {
    value: "blue",
    label: "Blue",
    icon: "🔵",
    description: "Calm & calculated",
  },
  {
    value: "green",
    label: "Green",
    icon: "🟢",
    description: "Quiet & clever",
  },
];

export default function Home() {
  // =====================================================
  // FORM STATE
  // =====================================================

  const [joinKey, setJoinKey] = useState("");

  const [name, setName] = useState("");

  const [selectedShape, setSelectedShape] =
    useState<Shape | null>(null);

  const [selectedColor, setSelectedColor] =
    useState<Color | null>(null);

  // =====================================================
  // GAME STATE
  // =====================================================

  const [availableCombinations, setAvailableCombinations] =
    useState<Combination[]>([]);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState(false);

  // =====================================================
  // LOAD AVAILABLE COMBINATIONS
  // =====================================================

  const loadCombinations = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/combinations`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Could not load available combinations."
        );
      }

      setAvailableCombinations(
        data.combinations || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the game server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCombinations();
  }, []);

  // =====================================================
  // AVAILABLE COMBINATION COUNT
  // =====================================================

  const combinationsLeft =
    availableCombinations.length;

  // =====================================================
  // CHECK COMBINATION
  // =====================================================

  const isAvailable = (
    shape: Shape,
    color: Color
  ) => {
    return availableCombinations.some(
      (combination) =>
        combination.shape === shape &&
        combination.color === color
    );
  };

  // =====================================================
  // SELECT SHAPE
  // =====================================================

  const handleShapeSelect = (
    shape: Shape
  ) => {
    if (
      selectedColor &&
      !isAvailable(shape, selectedColor)
    ) {
      setSelectedColor(null);
    }

    setSelectedShape(shape);
    setError("");
  };

  // =====================================================
  // SELECT COLOR
  // =====================================================

  const handleColorSelect = (
    color: Color
  ) => {
    if (
      selectedShape &&
      !isAvailable(selectedShape, color)
    ) {
      setSelectedShape(null);
    }

    setSelectedColor(color);
    setError("");
  };

  // =====================================================
  // CURRENT SELECTION
  // =====================================================

  const selectedShapeInfo = useMemo(
    () =>
      shapes.find(
        (shape) =>
          shape.value === selectedShape
      ),
    [selectedShape]
  );

  const selectedColorInfo = useMemo(
    () =>
      colors.find(
        (color) =>
          color.value === selectedColor
      ),
    [selectedColor]
  );

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setSuccess(false);

    // ---------------------------------------------------
    // VALIDATE JOIN KEY
    // ---------------------------------------------------

    const cleanJoinKey =
      joinKey.trim().toUpperCase();

    if (!cleanJoinKey) {
      setError(
        "Enter the private game key given to you by the host."
      );
      return;
    }

    if (!/^[A-Z0-9]{8}$/.test(cleanJoinKey)) {
      setError(
        "Your game key should contain 8 letters or numbers."
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDATE NAME
    // ---------------------------------------------------

    if (!name.trim()) {
      setError(
        "Please enter your contestant name."
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDATE SHAPE
    // ---------------------------------------------------

    if (!selectedShape) {
      setError(
        "Choose your secret shape."
      );
      return;
    }

    // ---------------------------------------------------
    // VALIDATE COLOR
    // ---------------------------------------------------

    if (!selectedColor) {
      setError(
        "Choose your secret color."
      );
      return;
    }

    // ---------------------------------------------------
    // CHECK COMBINATION AGAIN
    // ---------------------------------------------------

    try {
      setSubmitting(true);

      const combinationsResponse =
        await fetch(
          `${API_URL}/api/combinations`,
          {
            cache: "no-store",
          }
        );

      const combinationsData =
        await combinationsResponse.json();

      if (!combinationsResponse.ok) {
        throw new Error(
          combinationsData.detail ||
            "Could not verify your selection."
        );
      }

      const stillAvailable =
        combinationsData.combinations?.some(
          (combination: Combination) =>
            combination.shape === selectedShape &&
            combination.color === selectedColor
        );

      if (!stillAvailable) {
        setError(
          "That secret combination was just taken. Please choose another."
        );

        await loadCombinations();

        setSelectedShape(null);
        setSelectedColor(null);

        return;
      }

      // -------------------------------------------------
      // CREATE PLAYER
      // -------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/players`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name: name.trim(),

            shape: selectedShape,

            color: selectedColor,

            join_key: cleanJoinKey,
          }),
        }
      );

      const data =
        await response.json();

      // -------------------------------------------------
      // HANDLE ERROR
      // -------------------------------------------------

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to join the game."
        );
      }

      // -------------------------------------------------
      // SAVE CONTESTANT TOKEN
      // -------------------------------------------------

      localStorage.setItem(
        "secret_showdown_token",
        data.token
      );

      localStorage.setItem(
        "player_id",
        data.id
      );

      localStorage.setItem(
        "player_name",
        data.name
      );

      // Keep the join key locally as well.
      // It can be useful if the contestant refreshes
      // during the current session.
      localStorage.setItem(
        "secret_showdown_join_key",
        cleanJoinKey
      );

      // -------------------------------------------------
      // SUCCESS
      // -------------------------------------------------

      setSuccess(true);

      // Give the success screen a moment before
      // entering the live game.
      setTimeout(() => {
        window.location.href = "/game";
      }, 1400);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to join the game."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // SUCCESS SCREEN
  // =====================================================

  if (success) {
    return (
      <main className="min-h-screen bg-[#050509] text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">

        {/* BACKGROUND GLOW */}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/20 blur-[130px] rounded-full" />

          <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
        </div>

        <section className="relative w-full max-w-lg">

          <div className="bg-[#0d1020] border border-purple-500/30 rounded-[32px] p-8 md:p-12 text-center shadow-2xl shadow-purple-950/30">

            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-green-500/15 border border-green-400/30 flex items-center justify-center">

              <span className="text-4xl">
                ✓
              </span>

            </div>

            <p className="text-purple-300 text-xs font-black tracking-[0.3em] uppercase mb-3">
              ACCESS GRANTED
            </p>

            <h1 className="text-4xl md:text-5xl font-black mb-4">
              YOU&apos;RE IN!
            </h1>

            <p className="text-gray-400 leading-relaxed">
              Your secret combination has been
              locked in successfully.
            </p>

            <div className="mt-8 rounded-2xl bg-black/30 border border-white/10 p-5">

              <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
                Your secret
              </div>

              <div className="text-5xl mb-3">
                {selectedColorInfo?.icon}
                {selectedShapeInfo?.icon}
              </div>

              <div className="font-bold text-lg">
                {selectedColorInfo?.label}{" "}
                {selectedShapeInfo?.label}
              </div>

            </div>

            <div className="mt-6 text-sm text-gray-500">
              🔒 Only the host can see your
              secret.
            </div>

            <div className="mt-8 text-purple-300 text-sm font-bold animate-pulse">
              Entering the showdown...
            </div>

          </div>
        </section>
      </main>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-[#050509] text-white relative overflow-hidden">

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="fixed inset-0 pointer-events-none">

        <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-700/15 blur-[140px] rounded-full" />

        <div className="absolute top-[35%] left-[-200px] w-[400px] h-[400px] bg-blue-600/10 blur-[130px] rounded-full" />

        <div className="absolute bottom-[-200px] right-[-150px] w-[450px] h-[450px] bg-fuchsia-600/10 blur-[140px] rounded-full" />

      </div>

      {/* =================================================
          PAGE CONTAINER
      ================================================= */}

      <div className="relative max-w-5xl mx-auto px-4 py-8 md:py-12">

        {/* =================================================
            BRAND
        ================================================= */}

        <header className="text-center mb-10">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/15 border border-purple-500/30 mb-5 shadow-lg shadow-purple-900/20">

            <span className="text-3xl">
              🎭
            </span>

          </div>

          <div className="text-xs font-black tracking-[0.35em] text-purple-400 uppercase mb-3">
            TIKTOK LIVE GAME
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            SECRET{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400">
              SHOWDOWN
            </span>
          </h1>

          <p className="max-w-2xl mx-auto mt-5 text-gray-400 text-sm md:text-base leading-relaxed">
            Everyone has a secret. Everyone has a
            target. The question is...
            <span className="text-white font-bold">
              {" "}
              can you survive?
            </span>
          </p>

        </header>

        {/* =================================================
            HOW THE GAME WORKS
        ================================================= */}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">

            <div className="text-2xl mb-3">
              🎟️
            </div>

            <h3 className="font-black mb-1">
              1. Get your key
            </h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              Your host gives you a private
              one-time access key.
            </p>

          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">

            <div className="text-2xl mb-3">
              🔐
            </div>

            <h3 className="font-black mb-1">
              2. Pick your secret
            </h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              Choose one shape and one color.
              Keep your combination secret.
            </p>

          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">

            <div className="text-2xl mb-3">
              ⚔️
            </div>

            <h3 className="font-black mb-1">
              3. Enter the showdown
            </h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              Make guesses, survive attacks and
              become the last player standing.
            </p>

          </div>

        </section>

        {/* =================================================
            MAIN CARD
        ================================================= */}

        <section className="bg-[#0c0f1c] border border-purple-500/20 rounded-[28px] shadow-2xl shadow-purple-950/20 overflow-hidden">

          {/* TOP BAR */}

          <div className="px-6 md:px-8 py-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>

              <div className="flex items-center gap-2">

                <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />

                <span className="text-xs font-black uppercase tracking-widest text-green-400">
                  Registration Open
                </span>

              </div>

              <p className="text-xs text-gray-500 mt-2">
                {loading
                  ? "Checking available secrets..."
                  : `${combinationsLeft} secret combinations remain`}
              </p>

            </div>

            <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300">
              8 PLAYERS MAX
            </div>

          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6 md:p-8"
          >

            {/* =================================================
                JOIN KEY
            ================================================= */}

            <section className="mb-10">

              <div className="flex items-start gap-4 mb-5">

                <div className="w-11 h-11 shrink-0 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                  🎟️
                </div>

                <div>

                  <p className="text-xs font-black tracking-widest text-purple-400 uppercase">
                    Step 01
                  </p>

                  <h2 className="text-xl md:text-2xl font-black mt-1">
                    Enter your access key
                  </h2>

                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Your host should have given you an
                    8-character private key. Each key
                    can only be used once.
                  </p>

                </div>

              </div>

              <div className="relative">

                <input
                  type="text"
                  value={joinKey}
                  onChange={(event) => {
                    const value =
                      event.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                        .slice(0, 8);

                    setJoinKey(value);
                    setError("");
                  }}
                  placeholder="ENTER KEY"
                  maxLength={8}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none px-5 py-5 text-center text-2xl md:text-3xl font-black tracking-[0.35em] text-purple-200 placeholder:text-gray-700 placeholder:tracking-[0.25em] transition"
                />

                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-600">
                  {joinKey.length}/8
                </div>

              </div>

              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600">
                <span>🔒</span>
                <span>
                  Your key is private and cannot be reused.
                </span>
              </div>

            </section>

            {/* =================================================
                NAME
            ================================================= */}

            <section className="mb-10">

              <div className="flex items-start gap-4 mb-5">

                <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  👤
                </div>

                <div>

                  <p className="text-xs font-black tracking-widest text-blue-400 uppercase">
                    Step 02
                  </p>

                  <h2 className="text-xl md:text-2xl font-black mt-1">
                    Choose your player name
                  </h2>

                  <p className="text-sm text-gray-500 mt-2">
                    This is the name other contestants
                    will see during the showdown.
                  </p>

                </div>

              </div>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(
                    event.target.value
                  );
                  setError("");
                }}
                placeholder="Enter your player name"
                maxLength={30}
                autoComplete="name"
                className="w-full rounded-2xl bg-black/40 border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none px-5 py-4 text-white placeholder:text-gray-600 transition"
              />

              <div className="text-right text-xs text-gray-700 mt-2">
                {name.length}/30
              </div>

            </section>

            {/* =================================================
                SHAPE
            ================================================= */}

            <section className="mb-10">

              <div className="flex items-start gap-4 mb-5">

                <div className="w-11 h-11 shrink-0 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center">
                  🔺
                </div>

                <div>

                  <p className="text-xs font-black tracking-widest text-fuchsia-400 uppercase">
                    Step 03
                  </p>

                  <h2 className="text-xl md:text-2xl font-black mt-1">
                    Choose your secret shape
                  </h2>

                  <p className="text-sm text-gray-500 mt-2">
                    Pick carefully. Your opponents will
                    try to discover it.
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {shapes.map((shape) => {

                  const unavailable =
                    selectedColor !== null &&
                    !isAvailable(
                      shape.value,
                      selectedColor
                    );

                  const selected =
                    selectedShape ===
                    shape.value;

                  return (
                    <button
                      key={shape.value}
                      type="button"
                      disabled={
                        loading ||
                        unavailable
                      }
                      onClick={() =>
                        handleShapeSelect(
                          shape.value
                        )
                      }
                      className={`
                        relative rounded-2xl border p-5 text-left transition-all
                        ${
                          selected
                            ? "border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-900/20"
                            : unavailable
                            ? "border-white/5 bg-white/[0.015] opacity-30 cursor-not-allowed"
                            : "border-white/10 bg-black/20 hover:border-purple-500/50 hover:bg-purple-500/5"
                        }
                      `}
                    >

                      {selected && (
                        <span className="absolute top-3 right-3 text-green-400 text-sm">
                          ✓
                        </span>
                      )}

                      <div className="text-4xl mb-4">
                        {shape.icon}
                      </div>

                      <div className="font-black">
                        {shape.label}
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        {shape.description}
                      </div>

                      {unavailable && (
                        <div className="text-[10px] text-red-400 mt-3 font-bold uppercase">
                          Combination unavailable
                        </div>
                      )}

                    </button>
                  );
                })}

              </div>

            </section>

            {/* =================================================
                COLOR
            ================================================= */}

            <section className="mb-10">

              <div className="flex items-start gap-4 mb-5">

                <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  🎨
                </div>

                <div>

                  <p className="text-xs font-black tracking-widest text-blue-400 uppercase">
                    Step 04
                  </p>

                  <h2 className="text-xl md:text-2xl font-black mt-1">
                    Choose your secret color
                  </h2>

                  <p className="text-sm text-gray-500 mt-2">
                    Your color completes your secret
                    combination.
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {colors.map((color) => {

                  const unavailable =
                    selectedShape !== null &&
                    !isAvailable(
                      selectedShape,
                      color.value
                    );

                  const selected =
                    selectedColor ===
                    color.value;

                  return (
                    <button
                      key={color.value}
                      type="button"
                      disabled={
                        loading ||
                        unavailable
                      }
                      onClick={() =>
                        handleColorSelect(
                          color.value
                        )
                      }
                      className={`
                        relative rounded-2xl border p-5 text-left transition-all
                        ${
                          selected
                            ? "border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-900/20"
                            : unavailable
                            ? "border-white/5 bg-white/[0.015] opacity-30 cursor-not-allowed"
                            : "border-white/10 bg-black/20 hover:border-blue-500/50 hover:bg-blue-500/5"
                        }
                      `}
                    >

                      {selected && (
                        <span className="absolute top-3 right-3 text-green-400 text-sm">
                          ✓
                        </span>
                      )}

                      <div className="text-4xl mb-4">
                        {color.icon}
                      </div>

                      <div className="font-black">
                        {color.label}
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        {color.description}
                      </div>

                      {unavailable && (
                        <div className="text-[10px] text-red-400 mt-3 font-bold uppercase">
                          Combination unavailable
                        </div>
                      )}

                    </button>
                  );
                })}

              </div>

            </section>

            {/* =================================================
                SECRET PREVIEW
            ================================================= */}

            {selectedShape &&
              selectedColor && (
                <section className="mb-8 rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-6 text-center">

                  <div className="text-xs uppercase tracking-[0.3em] font-black text-purple-400">
                    Your Secret Combination
                  </div>

                  <div className="flex items-center justify-center gap-4 mt-5">

                    <div className="text-6xl">
                      {selectedColorInfo?.icon}
                    </div>

                    <div className="text-gray-700 text-2xl">
                      +
                    </div>

                    <div className="text-6xl">
                      {selectedShapeInfo?.icon}
                    </div>

                  </div>

                  <div className="mt-4 text-lg font-black">
                    {selectedColorInfo?.label}{" "}
                    {selectedShapeInfo?.label}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Keep this secret. Other players
                    will try to guess it.
                  </p>

                </section>
              )}

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
              <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300 flex items-start gap-3">

                <span className="text-lg">
                  ⚠️
                </span>

                <span className="leading-relaxed">
                  {error}
                </span>

              </div>
            )}

            {/* =================================================
                SUBMIT
            ================================================= */}

            <button
              type="submit"
              disabled={
                submitting ||
                loading ||
                !joinKey ||
                !name.trim() ||
                !selectedShape ||
                !selectedColor
              }
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-blue-500 disabled:from-gray-800 disabled:via-gray-800 disabled:to-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed py-5 font-black text-lg transition-all shadow-xl shadow-purple-950/20"
            >
              {submitting
                ? "⚡ ENTERING SHOWDOWN..."
                : "⚔️ ENTER THE SHOWDOWN"}
            </button>

            {/* =================================================
                PRIVACY
            ================================================= */}

            <div className="mt-6 flex items-center justify-center gap-3 text-center">

              <span className="text-lg">
                🔒
              </span>

              <p className="text-xs text-gray-600 leading-relaxed">
                Your shape and color are private.
                <br />
                Only the host can see your secret.
              </p>

            </div>

          </form>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="text-center mt-8 text-[10px] uppercase tracking-[0.25em] text-gray-700">
          Secret Showdown • Choose wisely • Trust no one
        </footer>

      </div>
    </main>
  );
}