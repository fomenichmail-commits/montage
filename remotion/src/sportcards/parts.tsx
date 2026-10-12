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
        const x = interpolate((frame * (0.6 + i * 0.15) + i * 400) % 2600, [0, 2600], [-700, 1900]);
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
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)",
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
}> = ({ width, shineAt, label }) => {
  const frame = useCurrentFrame();
  const height = width * 1.4;
  const shine = Math.max(
    ...shineAt.map((s) => interpolate(frame, [s, s + 20], [-1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
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
        boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 60px rgba(31,111,255,0.35)",
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
            background: `linear-gradient(160deg, ${colors.navy}, ${colors.night})`,
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
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            transform: "skewX(-20deg)",
          }}
        />
      </div>
    </div>
  );
};

/** Minimal football icon drawn in SVG (no emoji fonts needed). */
export const Ball: React.FC<{ readonly size: number; readonly spin: number }> = ({ size, spin }) => {
  const patches = [0, 72, 144, 216, 288];
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ transform: `rotate(${spin}deg)` }}>
      <circle r="46" fill="#ffffff" stroke="#0b1d45" strokeWidth="3" />
      <polygon points="0,-14 13.3,-4.3 8.2,11.3 -8.2,11.3 -13.3,-4.3" fill="#0b1d45" />
      {patches.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <line x1="0" y1="-14" x2="0" y2="-30" stroke="#0b1d45" strokeWidth="2.5" />
          <polygon points="0,-30 9,-37 6,-45 -6,-45 -9,-37" fill="#0b1d45" />
        </g>
      ))}
    </svg>
  );
};

/** Skewed broadcast stripes sweeping across. progress 0..1 = enter, 1..2 = exit. */
export const StripeWipe: React.FC<{ readonly progress: number }> = ({ progress }) => {
  const { width } = useVideoConfig();
  const bars = [colors.blue, colors.red, colors.gold, colors.navy];
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
              boxShadow: "0 0 40px rgba(0,0,0,0.4)",
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
