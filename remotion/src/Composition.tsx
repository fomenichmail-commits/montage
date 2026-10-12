import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
};

export const TitleCard: React.FC<Props> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const scale = width / 1080;

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const lineWidth = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const subtitleIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e1014",
        justifyContent: "center",
        alignItems: "center",
        padding: 80 * scale,
        opacity: fadeOut,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 110 * scale,
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.05,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [60 * scale, 0])}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: 240 * scale * lineWidth,
          height: 10 * scale,
          borderRadius: 5 * scale,
          backgroundColor: accent,
          margin: `${40 * scale}px 0`,
        }}
      />
      <div
        style={{
          color: "#b9c0cf",
          fontSize: 48 * scale,
          textAlign: "center",
          opacity: subtitleIn,
          transform: `translateY(${interpolate(subtitleIn, [0, 1], [30 * scale, 0])}px)`,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <>
      <Composition
        id="Title"
        component={TitleCard}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Montage",
          subtitle: "Видео из кода на Remotion",
          accent: "#4f8cff",
        }}
      />
      <Composition
        id="TitleVertical"
        component={TitleCard}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "Montage",
          subtitle: "Reels и Shorts",
          accent: "#4f8cff",
        }}
      />
    </>
  );
};
