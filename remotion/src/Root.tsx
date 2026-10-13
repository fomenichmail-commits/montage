import { MyComposition } from "./Composition";
import { IntroComposition } from "./sportcards/Intro";
import { OverlayCompositions } from "./sportcards/Overlays";
import { SampleCompositions } from "./sportcards/Samples";
import { FullLightComposition } from "./sportcards/FullLight";
import { ShortComposition } from "./sportcards/Short";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <IntroComposition />
      <OverlayCompositions />
      <SampleCompositions />
      <FullLightComposition />
      <ShortComposition />
    </>
  );
};
