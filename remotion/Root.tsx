import React from "react";
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="CapCutStyleVideo"
      component={MyVideo}
      durationInFrames={1800} 
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: Math.max(30, Math.floor((props.durationInSeconds || 60) * 30)),
        };
      }}
      defaultProps={{
        topTitle: "Test Title",
        partNumber: "Part 1",
        videoUrl: "",
        durationInSeconds: 15,
        titleFontSize: 90,
        titleYPos: 200,
        partFontSize: 130,
        partYPos: 150,
        subtitleFontSize: 70,
        subtitleYPos: 380,
        subtitleFont: "Impact",
        subtitleColor: "Yellow",
        textBgStyle: "outline",
        forceUppercase: true,
        wordsPerScreen: "1",
        animationStyle: "pop",
        transcription: [
            { word: "THIS", start: 0, end: 0.5 },
            { word: "IS", start: 0.5, end: 1.0 },
            { word: "VIRAL", start: 1.0, end: 1.5 },
        ]
      }}
    />
  );
};