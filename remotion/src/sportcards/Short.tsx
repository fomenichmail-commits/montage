import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  interpolate,
  OffthreadVideo,
  Sequence,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, displayFont, textFont } from "./brand";

type Word = { readonly t: number; readonly e: number; readonly text: string };
type Segment = { readonly from: number; readonly to: number };
type Mark = { readonly t: number; readonly text: string; readonly details?: string };

/** Times in props are seconds on the tightened master (master.mp4). */
type Props = {
  readonly master: string;
  readonly title: string;
  readonly segments: Segment[];
  readonly words: Word[];
  readonly plates: Mark[];
  readonly badges: Mark[];
  /** Horizontal crop of the 16:9 source in px (420 = centered). */
  readonly cropX?: number;
};

const FPS = 30;
const VIDEO_TOP = 420;
const f = (s: number) => Math.round(s * FPS);
const segFrames = (s: Segment) => f(s.to) - f(s.from);

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.segments.reduce((a, s) => a + segFrames(s), 0),
});

/** Maps a master time to short time, or null when it falls in a cut. */
const toShort = (segments: Segment[], t: number) => {
  let acc = 0;
  for (const s of segments) {
    if (t >= s.from && t < s.to) return acc + t - s.from;
    acc += s.to - s.from;
  }
  return null;
};

const Header: React.FC<{ readonly title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 130, gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 46,
            color: colors.navy,
            textShadow: `3px 3px 0 ${colors.gold}`,
          }}
        >
          SPORTCARDS
        </span>
        <span
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 34,
            color: colors.white,
            background: colors.red,
            padding: "0 12px",
            transform: "skewX(-12deg)",
          }}
        >
          SPB
        </span>
      </div>
      <div
        style={{
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: 92,
          lineHeight: 1,
          color: colors.navy,
          textTransform: "uppercase",
          textAlign: "center",
          maxWidth: 960,
          transform: `scale(${pop})`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

const Plate: React.FC<{ readonly text: string; readonly details?: string }> = ({
  text,
  details,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o =
    spring({ frame, fps: FPS, config: { damping: 20 } }) -
    spring({ frame: frame - (durationInFrames - 12), fps: FPS, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 40,
          top: VIDEO_TOP + 1080 - 230,
          background: "rgba(255,255,255,0.95)",
          borderLeft: `10px solid ${colors.gold}`,
          borderRadius: 12,
          padding: "16px 30px",
          boxShadow: "0 14px 40px rgba(11,29,69,0.25)",
          opacity: o,
          transform: `translateX(${(1 - o) * -80}px)`,
          maxWidth: 820,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 58,
            lineHeight: 1.1,
            color: colors.navy,
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>
        {details ? (
          <div style={{ fontFamily: textFont, fontWeight: 500, fontSize: 30, color: "#4a5a7a" }}>
            {details}
          </div>
        ) : null}
      </div>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ readonly text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pop = spring({ frame, fps: FPS, config: { damping: 10 } });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const sweep = interpolate(frame, [8, 36], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: VIDEO_TOP + 30,
          overflow: "hidden",
          borderRadius: 999,
          padding: "14px 34px",
          background: `linear-gradient(135deg, ${colors.gold}, #fff3c4 50%, #e7b400)`,
          boxShadow: "0 14px 40px rgba(180,130,0,0.4)",
          transform: `scale(${pop}) rotate(3deg)`,
          opacity: out,
        }}
      >
        <span
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 54,
            color: colors.navy,
            textTransform: "uppercase",
          }}
        >
          {text} ★★★★★
        </span>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep}%`,
            width: 120,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
          }}
        />
      </div>
      <Audio src={staticFile("sfx/shimmer.wav")} />
    </AbsoluteFill>
  );
};

/** Short caption chunks with the spoken word highlighted. */
const Captions: React.FC<{ readonly words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    const next = words[i + 1];
    cur.push(w);
    if (cur.length >= 4 || /[.!?…,]$/.test(w.text) || !next || next.t - w.e > 0.6) {
      groups.push(cur);
      cur = [];
    }
  });
  const group = groups.find((g, i) => {
    const end = Math.min(g[g.length - 1].e + 0.4, groups[i + 1]?.[0].t ?? Infinity);
    return t >= g[0].t - 0.05 && t < end;
  });
  if (!group) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: VIDEO_TOP + 1080 + 40,
          maxWidth: 900,
          background: "rgba(255,255,255,0.96)",
          borderRadius: 18,
          padding: "14px 30px",
          boxShadow: "0 12px 34px rgba(11,29,69,0.18)",
          textAlign: "center",
          fontFamily: textFont,
          fontWeight: 700,
          fontSize: 60,
          lineHeight: 1.2,
          color: colors.navy,
        }}
      >
        {group.map((w, i) => (
          <span
            key={i}
            style={{
              padding: "0 6px",
              borderRadius: 8,
              background: t >= w.t && t < w.e + 0.1 ? colors.gold : "transparent",
            }}
          >
            {w.text}{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Short: React.FC<Props> = ({
  master,
  title,
  segments,
  words,
  plates,
  badges,
  cropX = 420,
}) => {
  const shortWords = words
    .map((w) => {
      const t = toShort(segments, w.t);
      return t === null ? null : { ...w, t, e: t + (w.e - w.t) };
    })
    .filter((w): w is Word => w !== null);
  const place = (m: Mark) => {
    const t = toShort(segments, m.t);
    return t === null ? null : f(t);
  };
  return (
    <AbsoluteFill style={{ backgroundColor: "#f4f7fc" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(#dbe3f1 2px, transparent 2px), linear-gradient(90deg, #dbe3f1 2px, transparent 2px)",
          backgroundSize: "60px 60px",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: VIDEO_TOP,
          width: 1080,
          height: 1080,
          overflow: "hidden",
          borderTop: `8px solid ${colors.gold}`,
          borderBottom: `8px solid ${colors.gold}`,
        }}
      >
        <Series>
          {segments.map((s, i) => (
            <Series.Sequence key={i} durationInFrames={segFrames(s)}>
              <OffthreadVideo
                src={staticFile(master)}
                trimBefore={f(s.from)}
                style={{ position: "absolute", left: -cropX, top: 0, width: 1920, height: 1080 }}
              />
            </Series.Sequence>
          ))}
        </Series>
      </div>
      <Header title={title} />
      {plates.map((p, i) => {
        const at = place(p);
        return at === null ? null : (
          <Sequence key={`p${i}`} from={at} durationInFrames={120}>
            <Plate text={p.text} details={p.details} />
          </Sequence>
        );
      })}
      {badges.map((b, i) => {
        const at = place(b);
        return at === null ? null : (
          <Sequence key={`b${i}`} from={at} durationInFrames={105}>
            <Badge text={b.text} />
          </Sequence>
        );
      })}
      <Captions words={shortWords} />
    </AbsoluteFill>
  );
};

export const ShortComposition = () => (
  <Composition
    id="Short"
    component={Short}
    durationInFrames={300}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{
      master: "master.mp4",
      title: "Hyper Rare в стартере?!",
      segments: [{ from: 0, to: 10 }],
      words: [],
      plates: [],
      badges: [],
    }}
    calculateMetadata={calculateMetadata}
  />
);
