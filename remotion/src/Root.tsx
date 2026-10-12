import { MyComposition } from "./Composition";
import { IntroComposition } from "./sportcards/Intro";
import { OverlayCompositions } from "./sportcards/Overlays";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <IntroComposition />
      <OverlayCompositions />
    </>
  );
};
