"use client";

import React from "react";

type WheelPlayer = {
  id: string;
  name: string;
};

type SecretShowdownWheelProps = {
  players: WheelPlayer[];
  rotation: number;
  spinning: boolean;
};

const WHEEL_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#db2777",
  "#059669",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
];

/**
 * The single wheel renderer used by BOTH the host and contestant pages.
 *
 * The wheel itself has no knowledge of who is allowed to spin it.
 * The host page controls the rotation state; the contestant page only
 * receives the same server-selected player and mirrors the same rotation.
 */
export default function SecretShowdownWheel({
  players,
  rotation,
  spinning,
}: SecretShowdownWheelProps) {
  const segmentAngle = players.length > 0 ? 360 / players.length : 360;

  return (
    <div className="relative mx-auto w-[min(75vw,520px)] aspect-square">
      {/* POINTER */}
      <div className="absolute z-30 left-1/2 -translate-x-1/2 -top-5">
        <div
          className="
            w-0 h-0
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

      {/* GLOW */}
      <div className="absolute inset-0 rounded-full bg-purple-600/20 blur-2xl" />

      {/* WHEEL */}
      <div
        className="absolute inset-3 rounded-full overflow-hidden border-8 border-white shadow-2xl"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 10s cubic-bezier(0.12, 0.8, 0.18, 1)"
            : "none",
          background:
            players.length > 0
              ? `conic-gradient(${players
                  .map((_, index) => {
                    const start = (index / players.length) * 100;
                    const end = ((index + 1) / players.length) * 100;
                    const color =
                      WHEEL_COLORS[index % WHEEL_COLORS.length];

                    return `${color} ${start}% ${end}%`;
                  })
                  .join(", ")})`
              : "#222",
        }}
      >
        {/* PLAYER LABELS */}
        {players.map((player, index) => {
          const angle =
            index * segmentAngle + segmentAngle / 2;

          return (
            <div
              key={player.id}
              className="absolute inset-0"
              style={{
                transform: `rotate(${angle}deg)`,
              }}
            >
              <div
                className="absolute left-1/2 top-4 -translate-x-1/2 w-[42%] text-center px-1"
                style={{
                  transform: `rotate(${-angle}deg)`,
                }}
              >
                <span
                  className="
                    inline-block
                    max-w-full
                    truncate
                    text-white
                    font-black
                    text-xs
                    md:text-sm
                    drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]
                  "
                  title={player.name}
                >
                  {player.name}
                </span>
              </div>
            </div>
          );
        })}

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
  );
}