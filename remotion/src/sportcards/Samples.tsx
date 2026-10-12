import { Audio } from "@remotion/media";
import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
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
import { Intro } from "./Intro";
import { CardInfo, EndScreen, Hit, Stinger } from "./Overlays";
import { LightBackground, useShake } from "./parts";

type Word = { readonly t: number; readonly text: string };
type Segment = {
  readonly file: string;
  readonly dur: number;
  readonly words: Word[];
};
type Style = "broadcast" | "light" | "energy";

type Props = {
  readonly style: Style;
  readonly segments: Segment[];
  readonly player: string;
  readonly details: string;
  readonly rarity: string;
  readonly cardSeg: number;
  readonly hitSeg: number;
  readonly hitAt: number;
  readonly hookSeg: number;
};

const FPS = 30;
const INTRO = 180;
const STING = 60;
const OUTRO = 90;
const XFADE = 8;
const f = (s: number) => Math.round(s * FPS);

/** Order of segments on the timeline for a style. */
const orderFor = (p: Props) =>
  p.style === "energy"
    ? [p.hookSeg, ...p.segments.map((_, i) => i).filter((i) => i !== p.hookSeg)]
    : p.segments.map((_, i) => i);

const layout = (p: Props) => {
  const order = orderFor(p);
  const head =
    p.style === "energy" ? f(p.segments[p.hookSeg].dur) + STING : INTRO;
  const body = p.style === "energy" ? order.slice(1) : order;
  const starts: number[] = [];
  let at = head;
  body.forEach((idx, k) => {
    starts.push(at);
    at +=
      f(p.segments[idx].dur) -
      (p.style === "light" && k < body.length - 1 ? XFADE : 0);
  });
  return { order, head, body, starts, end: at, total: at + OUTRO };
};

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: layout(props).total,
});

// ---------- footage ----------

const Footage: React.FC<{
  readonly seg: Segment;
  readonly zoom: [number, number];
  readonly shakeAt?: number;
}> = ({ seg, zoom, shakeAt }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, f(seg.dur)], zoom);
  const shake = useShake(shakeAt ?? -100, 34);
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(seg.file)}
        style={{
          width: "100%",
          height: "100%",
          transform: `${shake} scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- captions ----------

/** Split words into short caption groups, breaking after punctuation. */
const groupWords = (words: Word[], max: number) => {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= max || /[.,!?]$/.test(w.text)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
};

const Captions: React.FC<{
  readonly seg: Segment;
  readonly variant: "light" | "energy";
}> = ({ seg, variant }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = groupWords(seg.words, variant === "energy" ? 3 : 6);
  const idx = groups.findIndex(
    (g, i) =>
      t >= g[0].t - 0.05 &&
      (i === groups.length - 1 || t < groups[i + 1][0].t - 0.05),
  );
  if (idx < 0) return null;
  const group = groups[idx];
  const clean = (s: string) => s.replace(/[.,]$/, "");

  if (variant === "light") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 70,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            color: colors.navy,
            fontFamily: textFont,
            fontWeight: 600,
            fontSize: 44,
            padding: "12px 30px",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(11,29,69,0.18)",
            maxWidth: 1400,
            textAlign: "center",
          }}
        >
          {group.map((w) => w.text).join(" ")}
        </div>
      </AbsoluteFill>
    );
  }

  const groupStart = f(group[0].t);
  const pop = spring({
    frame: frame - groupStart,
    fps: FPS,
    config: { damping: 12, mass: 0.5 },
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 110,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 34,
          transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`,
        }}
      >
        {group.map((w, i) => {
          const active =
            t >= w.t && (i === group.length - 1 || t < group[i + 1].t);
          return (
            <span
              key={i}
              style={{
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 86,
                textTransform: "uppercase",
                color: active ? colors.gold : colors.white,
                WebkitTextStroke: `4px ${colors.night}`,
                paintOrder: "stroke",
                textShadow: "0 8px 24px rgba(0,0,0,0.55)",
                display: "inline-block",
                transform: `scale(${active ? 1.1 : 1})`,
              }}
            >
              {clean(w.text)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- light-style graphics ----------

const Stars: React.FC<{ readonly n: number; readonly size: number }> = ({
  n,
  size,
}) => (
  <div style={{ display: "flex", gap: size * 0.15 }}>
    {Array.from({ length: n }, (_, i) => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24">
        <path
          d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"
          fill={colors.navy}
        />
      </svg>
    ))}
  </div>
);

const LightCardInfo: React.FC<{
  readonly player: string;
  readonly details: string;
}> = ({ player, details }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps: FPS, config: { damping: 20 } });
  const exit = spring({
    frame: frame - (durationInFrames - 15),
    fps: FPS,
    config: { damping: 20 },
  });
  const o = enter - exit;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 80,
          background: "rgba(255,255,255,0.94)",
          borderLeft: `8px solid ${colors.gold}`,
          borderRadius: 10,
          padding: "18px 34px",
          boxShadow: "0 14px 40px rgba(11,29,69,0.2)",
          opacity: o,
          transform: `translateX(${(1 - o) * -60}px)`,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 56,
            color: colors.navy,
            textTransform: "uppercase",
          }}
        >
          {player}
        </div>
        <div
          style={{
            fontFamily: textFont,
            fontWeight: 500,
            fontSize: 28,
            color: "#4a5a7a",
            marginTop: 2,
          }}
        >
          {details}
        </div>
      </div>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />
    </AbsoluteFill>
  );
};

const RarityBadge: React.FC<{ readonly rarity: string }> = ({ rarity }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pop = spring({ frame, fps: FPS, config: { damping: 10 } });
  const out = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const sweep = interpolate(frame, [10, 40], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 80,
          overflow: "hidden",
          borderRadius: 999,
          padding: "16px 36px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          background: `linear-gradient(135deg, ${colors.gold}, #fff3c4 50%, #e7b400)`,
          boxShadow: "0 14px 40px rgba(180,130,0,0.35)",
          transform: `scale(${pop})`,
          opacity: out,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 48,
            color: colors.navy,
            textTransform: "uppercase",
          }}
        >
          {rarity}
        </div>
        <Stars n={5} size={36} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep}%`,
            width: 120,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
          }}
        />
      </div>
      <Audio src={staticFile("sfx/shimmer.wav")} />
    </AbsoluteFill>
  );
};

const LightOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = spring({ frame: frame - 4, fps: FPS, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <LightBackground loop={OUTRO} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${pop})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 110,
              color: colors.navy,
              textShadow: `6px 6px 0 ${colors.gold}`,
            }}
          >
            SPORTCARDS
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 80,
              color: colors.white,
              background: colors.red,
              padding: "0 24px",
              transform: "skewX(-12deg)",
            }}
          >
            SPB
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: textFont,
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: 4,
            color: "#4a5a7a",
            textTransform: "uppercase",
          }}
        >
          Подписывайся на канал
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Small channel bug in the corner, broadcast style. */
const CornerBug: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 50,
          display: "flex",
          alignItems: "stretch",
          opacity: o * 0.92,
        }}
      >
        <div
          style={{
            background: colors.navy,
            color: colors.white,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 30,
            padding: "4px 14px",
          }}
        >
          SPORTCARDS
        </div>
        <div
          style={{
            background: colors.red,
            color: colors.white,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 30,
            padding: "4px 12px",
          }}
        >
          SPB
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the sample ----------

export const Sample: React.FC<Props> = (p) => {
  const L = layout(p);
  const segStart = (idx: number) => L.starts[L.body.indexOf(idx)];
  const hitFrame = segStart(p.hitSeg) + f(p.hitAt);
  const cardFrame = segStart(p.cardSeg) + 6;
  const punch = [1, 1.1, 1.04, 1.13];

  const body =
    p.style === "light" ? (
      <TransitionSeries>
        {L.body.map((idx, k) => [
          <TransitionSeries.Sequence
            key={`s${idx}`}
            durationInFrames={f(p.segments[idx].dur)}
          >
            <Footage seg={p.segments[idx]} zoom={[1, 1.05]} />
            <Captions seg={p.segments[idx]} variant="light" />
          </TransitionSeries.Sequence>,
          k < L.body.length - 1 ? (
            <TransitionSeries.Transition
              key={`t${idx}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: XFADE })}
            />
          ) : null,
        ])}
      </TransitionSeries>
    ) : (
      <Series>
        {L.body.map((idx, k) => {
          const z = punch[k % punch.length];
          const shakeAt = idx === p.hitSeg ? f(p.hitAt) : undefined;
          return (
            <Series.Sequence
              key={idx}
              durationInFrames={f(p.segments[idx].dur)}
            >
              <Footage
                seg={p.segments[idx]}
                zoom={[z, z + (p.style === "energy" ? 0.03 : 0.015)]}
                shakeAt={shakeAt}
              />
              {p.style === "energy" ? (
                <Captions seg={p.segments[idx]} variant="energy" />
              ) : null}
            </Series.Sequence>
          );
        })}
      </Series>
    );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: p.style === "light" ? "#f4f7fc" : colors.night,
      }}
    >
      {p.style === "energy" ? (
        <>
          <Sequence durationInFrames={f(p.segments[p.hookSeg].dur)}>
            <Footage seg={p.segments[p.hookSeg]} zoom={[1.12, 1.18]} />
            <Captions seg={p.segments[p.hookSeg]} variant="energy" />
          </Sequence>
          <Sequence
            from={f(p.segments[p.hookSeg].dur)}
            durationInFrames={STING}
          >
            <Sequence from={-36}>
              <Intro
                channel="SportCards"
                city="SPB"
                tagline="Panini • Topps • Футбол"
                theme="dark"
              />
            </Sequence>
          </Sequence>
        </>
      ) : (
        <Sequence durationInFrames={INTRO}>
          <Intro
            channel="SportCards"
            city="SPB"
            tagline="Panini • Topps • Футбол"
            theme={p.style === "light" ? "light" : "dark"}
          />
        </Sequence>
      )}

      <Sequence from={L.head} durationInFrames={L.end - L.head}>
        {body}
      </Sequence>

      {p.style === "broadcast" ? (
        <Sequence from={L.head} durationInFrames={L.end - L.head}>
          <CornerBug />
        </Sequence>
      ) : null}

      {p.style === "light" ? (
        <>
          <Sequence from={cardFrame} durationInFrames={150}>
            <LightCardInfo player={p.player} details={p.details} />
          </Sequence>
          <Sequence from={hitFrame} durationInFrames={120}>
            <RarityBadge rarity={p.rarity} />
          </Sequence>
          <Sequence from={L.end - XFADE} durationInFrames={OUTRO + XFADE}>
            <AbsoluteFill style={{ opacity: 1 }}>
              <FadeIn frames={XFADE}>
                <LightOutro />
              </FadeIn>
            </AbsoluteFill>
          </Sequence>
        </>
      ) : (
        <>
          <Sequence from={cardFrame} durationInFrames={150}>
            <CardInfo
              player={p.player}
              details={p.details}
              serial=""
              tag="HIT"
              placement={p.style === "energy" ? "top" : "bottom"}
            />
          </Sequence>
          <Sequence from={hitFrame - 4} durationInFrames={75}>
            <Hit
              title={p.style === "energy" ? "СУПЕРХИТ!" : "HIT!"}
              subtitle={p.rarity}
            />
          </Sequence>
          {p.style === "broadcast"
            ? L.body.slice(1).map((idx) =>
                idx === p.cardSeg || idx === L.body[L.body.length - 1] ? (
                  <Sequence
                    key={idx}
                    from={segStart(idx) - 12}
                    durationInFrames={24}
                  >
                    <Stinger />
                  </Sequence>
                ) : null,
              )
            : null}
          <Sequence from={L.end - 12} durationInFrames={24}>
            <Stinger />
          </Sequence>
          <Sequence from={L.end} durationInFrames={OUTRO}>
            <EndScreen
              channel="SportCards"
              city="SPB"
              cta="Подписывайся на канал"
            />
          </Sequence>
        </>
      )}
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{
  readonly frames: number;
  readonly children: React.ReactNode;
}> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, frames], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const base: Omit<Props, "style"> = {
  segments: [],
  player: "David Beckham",
  details: "Topps Match Attax 2026/27 • Manchester United",
  rarity: "Hyper Rare",
  cardSeg: 4,
  hitSeg: 0,
  hitAt: 1.85,
  hookSeg: 7,
};

export const SampleCompositions = () => {
  return (
    <>
      <Composition
        id="SampleBroadcast"
        component={Sample}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ ...base, style: "broadcast" as Style }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="SampleLight"
        component={Sample}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ ...base, style: "light" as Style }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="SampleEnergy"
        component={Sample}
        durationInFrames={300}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ ...base, style: "energy" as Style }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
