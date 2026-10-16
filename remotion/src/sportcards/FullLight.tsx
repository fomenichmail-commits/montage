import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { colors, textFont } from "./brand";
import { Intro } from "./Intro";
import { FadeIn, LightCardInfo, LightOutro, RarityBadge } from "./Samples";

type Word = { readonly t: number; readonly e: number; readonly text: string };
type Plate = {
  readonly t: number;
  readonly player: string;
  readonly details: string;
  readonly dur?: number;
};
type Badge = { readonly t: number; readonly text: string };
/** Avatar talking-head insert (camera A): replaces the picture, keeps the master audio. */
type Avatar = { readonly t: number; readonly dur: number; readonly src: string };

/** Output of tools/build_edit.py: the tightened master and everything timed on it. */
type Props = {
  readonly master: string;
  readonly duration: number;
  readonly cuts: number[];
  readonly words: Word[];
  readonly plates: Plate[];
  readonly badges: Badge[];
  readonly avatars?: Avatar[];
};

const FPS = 30;
const INTRO = 180;
const OUTRO = 90;
const XFADE = 8;
const f = (s: number) => Math.round(s * FPS);

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: INTRO + f(props.duration) + OUTRO,
});

/** Alternate gentle framings on every jump cut so cuts read as intentional. */
const Master: React.FC<{ readonly src: string; readonly cuts: number[] }> = ({
  src,
  cuts,
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let k = 0;
  while (k < cuts.length && cuts[k] <= t) k++;
  const segStart = k === 0 ? 0 : cuts[k - 1];
  const segEnd = k < cuts.length ? cuts[k] : segStart + 20;
  const base = k % 2 === 0 ? 1 : 1.06;
  const drift = interpolate(t, [segStart, segEnd], [0, 0.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${base + drift})`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Sentence-sized caption groups that disappear during long pauses. */
const groupWords = (words: Word[]) => {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    const next = words[i + 1];
    cur.push(w);
    const pause = next ? next.t - w.e > 0.7 : true;
    if (
      cur.length >= 6 ||
      /[.!?…]$/.test(w.text) ||
      (cur.length >= 3 && /,$/.test(w.text)) ||
      pause
    ) {
      groups.push(cur);
      cur = [];
    }
  });
  if (cur.length) groups.push(cur);
  return groups;
};

const Captions: React.FC<{ readonly words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = groupWords(words);
  const group = groups.find((g, i) => {
    const start = g[0].t - 0.05;
    const end = Math.min(
      g[g.length - 1].e + 0.5,
      i < groups.length - 1 ? groups[i + 1][0].t - 0.05 : Infinity,
    );
    return t >= start && t < end;
  });
  if (!group) return null;
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
};

export const FullLight: React.FC<Props> = ({
  master,
  duration,
  cuts,
  words,
  plates,
  badges,
  avatars = [],
}) => {
  const body = f(duration);
  return (
    <AbsoluteFill style={{ backgroundColor: "#f4f7fc" }}>
      <Sequence durationInFrames={INTRO}>
        <Intro
          channel="SportCards"
          city="SPB"
          tagline="Panini • Topps • Футбол"
          theme="light"
        />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={body}>
        <Master src={master} cuts={cuts} />
        {avatars.map((a, i) => (
          <Sequence key={`a${i}`} from={f(a.t)} durationInFrames={f(a.dur)}>
            <AbsoluteFill style={{ backgroundColor: "black" }}>
              <OffthreadVideo
                src={staticFile(a.src)}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </AbsoluteFill>
          </Sequence>
        ))}
        <Captions words={words} />
      </Sequence>
      {plates.map((p, i) => (
        <Sequence key={`p${i}`} from={INTRO + f(p.t)} durationInFrames={p.dur ?? 150}>
          <LightCardInfo player={p.player} details={p.details} />
        </Sequence>
      ))}
      {badges.map((b, i) => (
        <Sequence key={`b${i}`} from={INTRO + f(b.t)} durationInFrames={120}>
          <RarityBadge rarity={b.text} />
        </Sequence>
      ))}
      <Sequence from={INTRO + body - XFADE} durationInFrames={OUTRO + XFADE}>
        <FadeIn frames={XFADE}>
          <LightOutro />
        </FadeIn>
      </Sequence>
    </AbsoluteFill>
  );
};

export const FullLightComposition = () => (
  <Composition
    id="FullLight"
    component={FullLight}
    durationInFrames={300}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{
      master: "master.mp4",
      duration: 10,
      cuts: [],
      words: [],
      plates: [],
      badges: [],
    }}
    calculateMetadata={calculateMetadata}
  />
);
