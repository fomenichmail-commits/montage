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
import { ArenaBackground, Ball, StripeWipe, usePop } from "./parts";

// ---------- Card info lower third ----------

type CardInfoProps = {
  readonly player: string;
  readonly details: string;
  readonly serial: string;
  readonly tag: string;
};

export const CardInfo: React.FC<CardInfoProps> = ({
  player,
  details,
  serial,
  tag,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const exit = spring({
    frame: frame - (durationInFrames - 18),
    fps,
    config: { damping: 18 },
  });
  const open = enter - exit;
  const textIn =
    spring({ frame: frame - 8, fps, config: { damping: 16 } }) - exit;
  const badge = usePop(16, 9);
  const sweep = interpolate(frame, [26, 50], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 110,
          bottom: 120,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            background: colors.red,
            color: colors.white,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 3,
            padding: "0 22px",
            display: "flex",
            alignItems: "center",
            transform: `skewX(-12deg) scaleY(${open})`,
            transformOrigin: "bottom",
          }}
        >
          {tag}
        </div>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: `linear-gradient(90deg, ${colors.navy}, rgba(11,29,69,0.92))`,
            borderBottom: `6px solid ${colors.gold}`,
            padding: "16px 48px 18px 36px",
            minWidth: 640,
            transform: `skewX(-12deg) scaleX(${open})`,
            transformOrigin: "left",
          }}
        >
          <div
            style={{
              transform: "skewX(12deg)",
              opacity: textIn,
              translate: `0 ${(1 - textIn) * 30}px`,
            }}
          >
            <div
              style={{
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 64,
                lineHeight: 1.05,
                color: colors.white,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {player}
            </div>
            <div
              style={{
                fontFamily: textFont,
                fontWeight: 500,
                fontSize: 30,
                color: colors.mist,
                marginTop: 4,
              }}
            >
              {details}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${sweep}%`,
              width: 140,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            }}
          />
        </div>
        {serial ? (
          <div
            style={{
              alignSelf: "center",
              marginLeft: 22,
              background: `linear-gradient(135deg, ${colors.gold}, #fff0a8 50%, #d9a400)`,
              color: colors.night,
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 54,
              padding: "6px 26px",
              transform: `skewX(-12deg) scale(${Math.max(badge - exit, 0)})`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            }}
          >
            {serial}
          </div>
        ) : null}
      </div>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
      <Sequence from={16}>
        <Audio src={staticFile("sfx/shimmer.wav")} volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- Stinger transition (cut under the frame where the screen is covered) ----------

export const Stinger: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 2]);
  return (
    <AbsoluteFill>
      <StripeWipe progress={progress} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: interpolate(Math.abs(progress - 1), [0, 0.25], [1, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <Ball size={180} spin={frame * 12} />
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("sfx/whoosh.wav")} />
    </AbsoluteFill>
  );
};

// ---------- HIT! burst for the best card of the video ----------

type HitProps = {
  readonly title: string;
  readonly subtitle: string;
};

export const Hit: React.FC<HitProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pop = usePop(0, 7);
  const sub = usePop(10, 12);
  const out = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const rays = Array.from({ length: 16 }, (_, i) => i);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ alignItems: "center", top: 70 }}>
        <div
          style={{
            position: "relative",
            width: 900,
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 900,
              height: 900,
              top: -270,
              transform: `rotate(${frame * 1.5}deg) scale(${pop})`,
              opacity: 0.55,
            }}
          >
            {rays.map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 435,
                  top: 0,
                  width: 30,
                  height: 450,
                  transformOrigin: "50% 100%",
                  transform: `rotate(${i * (360 / rays.length)}deg)`,
                  background: `linear-gradient(0deg, transparent, ${i % 2 ? colors.gold : colors.white})`,
                  clipPath: "polygon(50% 100%, 0 0, 100% 0)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              textAlign: "center",
              transform: `scale(${pop}) rotate(-4deg)`,
            }}
          >
            <div
              style={{
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 190,
                lineHeight: 1,
                color: colors.gold,
                WebkitTextStroke: `6px ${colors.night}`,
                textShadow: `8px 8px 0 ${colors.red}`,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: 10,
                background: colors.red,
                color: colors.white,
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 52,
                padding: "2px 26px",
                transform: `skewX(-12deg) scaleX(${sub})`,
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("sfx/impact.wav")} />
      <Sequence from={6}>
        <Audio src={staticFile("sfx/shimmer.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- End screen (leaves room for YouTube end-screen elements) ----------

type EndProps = {
  readonly channel: string;
  readonly city: string;
  readonly cta: string;
};

export const EndScreen: React.FC<EndProps> = ({ channel, city, cta }) => {
  const frame = useCurrentFrame();
  const title = usePop(4, 14);
  const slots = usePop(14, 16);
  const pulse = 1 + Math.sin(frame / 8) * 0.03;
  const slot = (label: string) => (
    <div
      style={{
        width: 740,
        height: 416,
        border: `4px dashed ${colors.mist}`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: textFont,
        fontWeight: 700,
        fontSize: 30,
        color: colors.mist,
        background: "rgba(5,11,28,0.55)",
        opacity: slots,
        transform: `translateY(${(1 - slots) * 60}px)`,
      }}
    >
      {label}
    </div>
  );
  return (
    <AbsoluteFill>
      <ArenaBackground />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            transform: `scale(${title})`,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 96,
              color: colors.white,
              textTransform: "uppercase",
            }}
          >
            {channel}
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 72,
              color: colors.white,
              background: colors.red,
              padding: "0 22px",
              transform: "skewX(-12deg)",
            }}
          >
            {city}
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: textFont,
            fontWeight: 800,
            fontSize: 38,
            letterSpacing: 4,
            color: colors.gold,
            textTransform: "uppercase",
            transform: `scale(${pulse})`,
            opacity: title,
          }}
        >
          {cta}
        </div>
        <div style={{ display: "flex", gap: 120, marginTop: 70 }}>
          {slot("СЛЕДУЮЩЕЕ ВИДЕО")}
          {slot("ЛУЧШЕЕ НА КАНАЛЕ")}
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.7} />
    </AbsoluteFill>
  );
};

export const OverlayCompositions = () => {
  return (
    <>
      <Composition
        id="CardInfo"
        component={CardInfo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          player: "Lamine Yamal",
          details: "Topps Chrome UCL 2025/26 • Gold Refractor",
          serial: "/50",
          tag: "CARD",
        }}
      />
      <Composition
        id="Stinger"
        component={Stinger}
        durationInFrames={24}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Hit"
        component={Hit}
        durationInFrames={75}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ title: "HIT!", subtitle: "Автограф /25" }}
      />
      <Composition
        id="EndScreen"
        component={EndScreen}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: "SportCards",
          city: "SPB",
          cta: "Подписывайся на канал",
        }}
      />
    </>
  );
};
