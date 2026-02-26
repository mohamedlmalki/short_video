// File: src/remotion/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="CapCutStyleVideo"
      component={MyVideo}
      durationInFrames={1800} // Default fallback length
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
        durationInSeconds: 15
      }}
    />
  );
};