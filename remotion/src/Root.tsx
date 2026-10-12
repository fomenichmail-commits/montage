import { MyComposition } from "./Composition";
import { IntroComposition } from "./sportcards/Intro";
import { OverlayCompositions } from "./sportcards/Overlays";
import { SampleCompositions } from "./sportcards/Samples";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <IntroComposition />
      <OverlayCompositions />
      <SampleCompositions />
    </>
  );
};
