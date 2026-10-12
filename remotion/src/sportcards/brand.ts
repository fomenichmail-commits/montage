import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Local variable fonts (OFL) so renders work offline: public/fonts/.
export const displayFont = "Oswald";
export const textFont = "Inter";

loadFont({ family: displayFont, url: staticFile("fonts/Oswald.ttf"), weight: "200 700", format: "truetype" });
loadFont({ family: textFont, url: staticFile("fonts/Inter.ttf"), weight: "100 900", format: "truetype" });

export const colors = {
  night: "#050b1c",
  navy: "#0b1d45",
  blue: "#1f6fff",
  red: "#e3172d",
  gold: "#ffc629",
  white: "#ffffff",
  mist: "#b8c4e0",
};

// Holographic foil like Prizm / Refractor parallels.
export const holoGradient = (angle: number) =>
  `conic-gradient(from ${angle}deg, #7af0ff, #b18cff, #ff8ad8, #ffe17a, #8affb2, #7af0ff)`;
