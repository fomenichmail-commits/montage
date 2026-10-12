import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, displayFont, holoGradient } from "./brand";

/** Dark arena backdrop with drifting stadium light beams. */
export const ArenaBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const beams = [0, 1, 2, 3, 4];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${colors.navy} 0%, ${colors.night} 70%)`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 46px)",
          transform: `translateX(${(frame * 1.2) % 46}px)`,
        }}
      />
      {beams.map((i) => {
        const x = interpolate(
          (frame * (0.6 + i * 0.15) + i * 400) % 2600,
          [0, 2600],
          [-700, 1900],
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: -300,
              left: x,
              width: 160 + i * 40,
              height: 1700,
              transform: "rotate(25deg)",
              background: `linear-gradient(90deg, transparent, ${i % 2 ? "rgba(31,111,255,0.16)" : "rgba(255,255,255,0.07)"}, transparent)`,
              filter: "blur(18px)",
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** A stylised trading card with animated holo foil and a shine sweep. */
export const HoloCard: React.FC<{
  readonly width: number;
  readonly shineAt: number[];
  readonly label: string;
  readonly light?: boolean;
}> = ({ width, shineAt, label, light = false }) => {
  const frame = useCurrentFrame();
  const height = width * 1.4;
  const shine = Math.max(
    ...shineAt.map((s) =>
      interpolate(frame, [s, s + 20], [-1, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const sweepX = interpolate(shine, [-1, 1], [-width * 1.2, width * 1.2]);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.05,
        padding: width * 0.035,
        background: `linear-gradient(135deg, ${colors.gold}, #fff2b8 30%, #b8860b 60%, ${colors.gold})`,
        boxShadow:
          "0 40px 90px rgba(0,0,0,0.6), 0 0 60px rgba(31,111,255,0.35)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.03,
          background: holoGradient(frame * 2),
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 3px, transparent 3px 14px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "8% 8% 22% 8%",
            background: light
              ? "linear-gradient(160deg, #ffffff, #e6eefb)"
              : `linear-gradient(160deg, ${colors.navy}, ${colors.night})`,
            borderRadius: width * 0.02,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ball size={width * 0.42} spin={frame * 1.5} />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "6%",
            left: "8%",
            right: "8%",
            height: "12%",
            background: colors.red,
            color: colors.white,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: width * 0.085,
            letterSpacing: width * 0.004,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "skewX(-10deg)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: width * 0.45,
            left: width / 2 - width * 0.225 + sweepX,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            transform: "skewX(-20deg)",
          }}
        />
      </div>
    </div>
  );
};

/** Minimal football icon drawn in SVG (no emoji fonts needed). */
export const Ball: React.FC<{
  readonly size: number;
  readonly spin: number;
}> = ({ size, spin }) => {
  const patches = [0, 72, 144, 216, 288];
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{ transform: `rotate(${spin}deg)` }}
    >
      <circle r="46" fill="#ffffff" stroke="#0b1d45" strokeWidth="3" />
      <polygon
        points="0,-14 13.3,-4.3 8.2,11.3 -8.2,11.3 -13.3,-4.3"
        fill="#0b1d45"
      />
      {patches.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <line
            x1="0"
            y1="-14"
            x2="0"
            y2="-30"
            stroke="#0b1d45"
            strokeWidth="2.5"
          />
          <polygon points="0,-30 9,-37 6,-45 -6,-45 -9,-37" fill="#0b1d45" />
        </g>
      ))}
    </svg>
  );
};

/** Skewed broadcast stripes sweeping across. progress 0..1 = enter, 1..2 = exit. */
export const StripeWipe: React.FC<{
  readonly progress: number;
  readonly bars?: string[];
}> = ({
  progress,
  bars = [colors.blue, colors.red, colors.gold, colors.navy],
}) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {bars.map((color, i) => {
        const delay = i * 0.12;
        const p = Math.min(Math.max((progress - delay) / (1 - 0.36), 0), 2);
        const x = interpolate(p, [0, 1, 2], [-1.6, 0, 1.6]) * width;
        return (
          <div
            key={color}
            style={{
              position: "absolute",
              top: -200,
              bottom: -200,
              left: -width * 0.25,
              width: width * 1.5,
              transform: `translateX(${x}px) skewX(-18deg)`,
              background: color,
              boxShadow: "0 0 40px rgba(0,0,0,0.25)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Small deterministic camera shake after an impact frame. */
export const useShake = (impactFrame: number, strength: number) => {
  const frame = useCurrentFrame();
  const t = frame - impactFrame;
  if (t < 0 || t > 10) return "translate(0px, 0px)";
  const k = strength * (1 - t / 10);
  return `translate(${(random(`x${frame}`) - 0.5) * k}px, ${(random(`y${frame}`) - 0.5) * k}px)`;
};

export const usePop = (delay: number, damping = 12) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/**
 * Light backdrop: football pitch markings, floating holo cards and sparkles.
 * All motion repeats every `loop` frames so the backdrop can be looped seamlessly.
 */
export const LightBackground: React.FC<{ readonly loop: number }> = ({
  loop,
}) => {
  const frame = useCurrentFrame();
  const t = (frame / loop) * Math.PI * 2;
  const line = "rgba(31,111,255,0.13)";
  // Hand-placed around the frame edges so they never sit behind the title.
  const cards = [
    [120, 90, 120],
    [420, 40, 95],
    [300, 830, 140],
    [70, 560, 110],
    [1500, 60, 130],
    [1790, 230, 100],
    [1250, 40, 90],
    [1660, 800, 150],
    [1150, 870, 105],
    [760, 890, 95],
  ].map(([x, y, w], i) => ({
    x,
    y,
    w,
    rot: (random(`card-r-${i}`) - 0.5) * 50,
    phase: random(`card-p-${i}`) * Math.PI * 2,
    depth: random(`card-d-${i}`),
  }));
  const sparkles = Array.from({ length: 36 }, (_, i) => ({
    x: random(`s-x-${i}`) * 1920,
    y: random(`s-y-${i}`) * 1080,
    size: 3 + random(`s-s-${i}`) * 6,
    phase: random(`s-p-${i}`) * Math.PI * 2,
    speed: 1 + Math.floor(random(`s-k-${i}`) * 3),
  }));

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(160deg, #fdfeff 0%, #eef4fc 55%, #f8f0e1 100%)",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{ transform: `scale(${1.03 + Math.sin(t) * 0.02})` }}
      >
        <svg
          width="1920"
          height="1080"
          viewBox="0 0 1920 1080"
          fill="none"
          stroke={line}
          strokeWidth="4"
        >
          <rect x="60" y="60" width="1800" height="960" rx="6" />
          <line x1="960" y1="60" x2="960" y2="1020" />
          <circle cx="960" cy="540" r="170" />
          <circle cx="960" cy="540" r="7" fill={line} />
          <rect x="60" y="250" width="270" height="580" />
          <rect x="60" y="400" width="100" height="280" />
          <path d="M330 455 A 120 120 0 0 1 330 625" />
          <rect x="1590" y="250" width="270" height="580" />
          <rect x="1760" y="400" width="100" height="280" />
          <path d="M1590 455 A 120 120 0 0 0 1590 625" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.95), transparent 45%), radial-gradient(circle at 85% 90%, rgba(255,198,41,0.18), transparent 50%)",
        }}
      />
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.x + Math.cos(t + c.phase) * 18,
            top: c.y + Math.sin(t + c.phase) * 26,
            width: c.w,
            height: c.w * 1.4,
            borderRadius: c.w * 0.07,
            padding: c.w * 0.05,
            background: "linear-gradient(135deg, #ffffff, #e9eef8)",
            boxShadow: "0 18px 40px rgba(11,29,69,0.16)",
            transform: `rotate(${c.rot + Math.sin(t + c.phase) * 6}deg)`,
            opacity: 0.45 + c.depth * 0.4,
            filter: `blur(${(1 - c.depth) * 4}px)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: c.w * 0.04,
              background: holoGradient(
                (c.phase * 180) / Math.PI + (frame / loop) * 360,
              ),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "70%",
                height: "62%",
                borderRadius: c.w * 0.03,
                background: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.9,
              }}
            >
              <Ball size={c.w * 0.36} spin={c.rot * 4} />
            </div>
          </div>
        </div>
      ))}
      {sparkles.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: i % 3 ? "#ffffff" : colors.gold,
            boxShadow: `0 0 ${s.size * 3}px ${i % 3 ? "rgba(31,111,255,0.5)" : "rgba(255,198,41,0.8)"}`,
            opacity: (Math.sin(t * s.speed + s.phase) + 1) / 2,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
