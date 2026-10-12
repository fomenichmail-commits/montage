import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, displayFont, textFont } from "./brand";
import {
  ArenaBackground,
  HoloCard,
  LightBackground,
  StripeWipe,
  useShake,
} from "./parts";

type Props = {
  readonly channel: string;
  readonly city: string;
  readonly tagline: string;
  readonly theme: "dark" | "light";
};

const LIGHT_BARS = ["#8ec5ff", colors.gold, colors.red, "#f4f7fc"];

const IMPACT = 42;
const OUTRO = 150;

export const Intro: React.FC<Props> = ({ channel, city, tagline, theme }) => {
  const light = theme === "light";
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const cardIn = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, mass: 0.8 },
  });
  const cardRotate =
    interpolate(cardIn, [0, 1], [-95, -14]) + Math.sin(frame / 20) * 3;
  const cardX = interpolate(cardIn, [0, 1], [-900, -520]);

  const slam = spring({
    frame: frame - IMPACT,
    fps,
    config: { damping: 11, mass: 0.6 },
  });
  const titleScale = interpolate(slam, [0, 1], [2.6, 1]);
  const titleBlur = interpolate(slam, [0, 0.7, 1], [18, 2, 0]);
  const cityIn = spring({
    frame: frame - IMPACT - 10,
    fps,
    config: { damping: 13 },
  });
  const taglineReveal = interpolate(
    frame,
    [IMPACT + 26, IMPACT + 46],
    [100, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const flash =
    frame < IMPACT
      ? 0
      : interpolate(frame, [IMPACT, IMPACT + 7], [0.85, 0], {
          extrapolateRight: "clamp",
        });
  const push = interpolate(frame, [IMPACT, durationInFrames], [1, 1.06]);
  const intro = interpolate(frame, [0, 14], [1, 2], {
    extrapolateRight: "clamp",
  });
  const outro = interpolate(frame, [OUTRO, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
  });
  const shake = useShake(IMPACT, 26);

  return (
    <AbsoluteFill style={{ backgroundColor: light ? "#f4f7fc" : colors.night }}>
      <AbsoluteFill style={{ transform: `${shake} scale(${push})` }}>
        {light ? (
          <LightBackground loop={durationInFrames} />
        ) : (
          <ArenaBackground />
        )}

        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              // 2D stand-in for rotateY: Chromium drops 3D-composited layers on random frames.
              transform: `translateX(${cardX}px) scaleX(${Math.cos((cardRotate * Math.PI) / 180)}) skewY(${Math.sin((cardRotate * Math.PI) / 180) * 8}deg) scale(${interpolate(cardIn, [0, 1], [0.6, 1])})`,
              opacity: interpolate(cardIn, [0, 0.15], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <HoloCard
              width={360}
              shineAt={[34, 112]}
              label="ROOKIE"
              light={light}
            />
          </div>
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: 780,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 168,
              lineHeight: 1,
              color: light ? colors.navy : colors.white,
              letterSpacing: 4,
              textTransform: "uppercase",
              transform: `scale(${titleScale}) skewX(-8deg)`,
              transformOrigin: "left center",
              filter: `blur(${titleBlur}px)`,
              opacity: frame >= IMPACT ? 1 : 0,
              textShadow: light
                ? `6px 6px 0 ${colors.gold}`
                : "0 10px 40px rgba(0,0,0,0.6)",
            }}
          >
            {channel}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              marginTop: 18,
            }}
          >
            <div
              style={{
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 92,
                color: colors.white,
                background: colors.red,
                padding: "0 34px",
                transform: `translateX(${interpolate(cityIn, [0, 1], [900, 0])}px) skewX(-12deg)`,
                boxShadow: `10px 10px 0 ${colors.gold}`,
                opacity: frame >= IMPACT + 10 ? 1 : 0,
              }}
            >
              {city}
            </div>
            <div
              style={{
                fontFamily: textFont,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: 6,
                color: light ? "#4a5a7a" : colors.mist,
                textTransform: "uppercase",
                clipPath: `inset(0 ${taglineReveal}% 0 0)`,
              }}
            >
              {tagline}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          backgroundColor: "white",
          opacity: light ? flash * 0.7 : flash,
        }}
      />
      {frame < 16 ? (
        <StripeWipe progress={intro} bars={light ? LIGHT_BARS : undefined} />
      ) : null}
      {frame >= OUTRO ? (
        <StripeWipe progress={outro} bars={light ? LIGHT_BARS : undefined} />
      ) : null}

      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.8} />
      <Audio src={staticFile("sfx/riser.wav")} volume={0.6} />
      <Sequence from={IMPACT}>
        <Audio src={staticFile("sfx/impact.wav")} />
      </Sequence>
      <Sequence from={34}>
        <Audio src={staticFile("sfx/shimmer.wav")} volume={0.9} />
      </Sequence>
      <Sequence from={112}>
        <Audio src={staticFile("sfx/shimmer.wav")} volume={0.7} />
      </Sequence>
      <Sequence from={OUTRO}>
        <Audio src={staticFile("sfx/whoosh.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const IntroComposition = () => {
  return (
    <>
      <Composition
        id="SportCardsIntro"
        component={Intro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: "SportCards",
          city: "SPB",
          tagline: "Panini • Topps • Футбол",
          theme: "dark",
        }}
      />
      <Composition
        id="SportCardsIntroLight"
        component={Intro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: "SportCards",
          city: "SPB",
          tagline: "Panini • Topps • Футбол",
          theme: "light",
        }}
      />
      <Composition
        id="SportCardsBackdropLight"
        component={LightBackground}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ loop: 300 }}
      />
    </>
  );
};
