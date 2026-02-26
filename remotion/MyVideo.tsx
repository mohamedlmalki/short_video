// File: src/remotion/MyVideo.tsx
import React from "react";
import { AbsoluteFill, Video } from "remotion";

// 1. We tell the component to expect these 3 exact variables
export const MyVideo = ({ topTitle, partNumber, videoUrl }: { topTitle: string, partNumber: string, videoUrl: string }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      
      {/* 2. THE BACKGROUND VIDEO */}
      {/* It will fill the whole screen behind the text */}
      <AbsoluteFill>
        {videoUrl ? (
          <Video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </AbsoluteFill>

      {/* 3. THE TOP TITLE (Dynamic) */}
      <div style={{
        position: "absolute",
        top: 200,
        width: "100%",
        display: "flex",
        justifyContent: "center"
      }}>
        <div style={{
          fontSize: 80,
          fontWeight: "bold",
          fontFamily: "Impact, sans-serif",
          color: "white",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: "20px 40px",
          borderRadius: "20px",
          border: "5px solid black",
          textShadow: "6px 6px 0px rgba(0,0,0,0.8)",
          textAlign: "center",
          maxWidth: "80%"
        }}>
          {topTitle}
        </div>
      </div>

      {/* 4. THE PART NUMBER (Dynamic) */}
      <div style={{
        position: "absolute",
        bottom: 350,
        width: "100%",
        display: "flex",
        justifyContent: "center"
      }}>
        <div style={{
          fontSize: 140,
          fontWeight: "bold",
          fontFamily: "Impact, sans-serif",
          color: "yellow", // Let's make the part number yellow so it pops!
          textShadow: "10px 10px 0px rgba(0,0,0,0.9)",
          WebkitTextStroke: "6px black" // Thick black outline
        }}>
          {partNumber}
        </div>
      </div>

    </AbsoluteFill>
  );
};