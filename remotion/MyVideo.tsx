import React, { useMemo } from "react";
import { AbsoluteFill, Video, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";

export const MyVideo = ({ 
  topTitle, partNumber, videoUrl,
  titleFontSize, titleYPos,
  partFontSize, partYPos,
  subtitleFontSize, subtitleYPos,
  subtitleFont, subtitleColor,
  textBgStyle, forceUppercase,
  wordsPerScreen, animationStyle,
  transcription
}: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const colors: any = {
    White: "#ffffff",
    Yellow: "#ffff00",
    Red: "#ff0000",
    Cyan: "#00ffff",
    Green: "#00ff00",
  };
  const highlightHex = colors[subtitleColor] || "#ffff00";

  // 🌟 FRAME-LOCKED CHUNK GROUPING (ZERO LAG) 🌟
  // This converts messy AI seconds directly into absolute video frames
  const chunks = useMemo(() => {
    if (!transcription || transcription.length === 0) return [];
    const result = [];
    let currentChunk = [];
    
    for (let i = 0; i < transcription.length; i++) {
      const word = transcription[i];
      
      // Convert floating seconds to exact integer frames!
      const startFrame = Math.round(word.start * fps);
      let endFrame = Math.round(word.end * fps);
      
      currentChunk.push({ text: word.word, startFrame, endFrame });
      
      let maxWords = 1;
      if (wordsPerScreen === "3") maxWords = 3;
      if (wordsPerScreen === "full") maxWords = 8;

      const nextWord = transcription[i + 1];
      const gapSeconds = nextWord ? nextWord.start - word.end : 0;

      // Cut chunk if word limit reached, OR if there's a pause in the audio
      if (currentChunk.length >= maxWords || gapSeconds > 0.4 || !nextWord) {
        
        // Exact frame to make the text disappear (adds a tiny 150ms visual tail)
        let chunkEndFrame = currentChunk[currentChunk.length - 1].endFrame + Math.round(fps * 0.15); 
        
        // Connect words perfectly if they are speaking fast
        if (nextWord && gapSeconds <= 0.4) {
            chunkEndFrame = Math.round(nextWord.start * fps);
        }

        result.push({
          startFrame: currentChunk[0].startFrame,
          endFrame: chunkEndFrame, 
          words: currentChunk
        });
        currentChunk = [];
      }
    }
    return result;
  }, [transcription, wordsPerScreen, fps]);

  // We now search for the EXACT frame match, completely removing any lag
  const currentChunk = chunks.find(c => frame >= c.startFrame && frame < c.endFrame);

  // 🎨 STYLES 🎨
  const getTextStyle = (isHighlight = false) => {
    let base: any = {
      fontFamily: subtitleFont,
      fontWeight: 900,
      textTransform: forceUppercase ? "uppercase" : "none",
      color: isHighlight ? highlightHex : "white",
      display: "inline-block",
      margin: "0 6px",
      transition: "color 0.1s ease-out" 
    };

    if (textBgStyle === "outline") {
      base.textShadow = "2px 2px 0 black, -1px -1px 0 black, 4px 4px 6px rgba(0,0,0,0.8)";
      base.WebkitTextStroke = "2px black";
    } else if (textBgStyle === "box") {
      base.textShadow = "none";
      base.WebkitTextStroke = "0px";
    } else if (textBgStyle === "shadow") {
      base.textShadow = "0px 0px 15px rgba(0,0,0,1), 0px 0px 5px rgba(0,0,0,1)";
      base.WebkitTextStroke = "0.5px rgba(0,0,0,0.5)";
    } else if (textBgStyle === "3d") {
      base.textShadow = "5px 5px 0px #000";
      base.WebkitTextStroke = "2px black";
    }

    return base;
  };

  const entranceScale = spring({ frame, fps, config: { damping: 12, stiffness: 300, mass: 0.2 } });

  let subScale = 1;
  let subTranslateY = 0;
  let subOpacity = 1;

  if (currentChunk) {
    const frameRelative = Math.max(0, frame - currentChunk.startFrame); 

    if (animationStyle === "pop") {
      subScale = spring({ fps, frame: frameRelative, config: { damping: 12, stiffness: 400, mass: 0.2 } });
    } else if (animationStyle === "bounce") {
      subScale = spring({ fps, frame: frameRelative, config: { damping: 6, stiffness: 400, mass: 0.3 } });
    } else if (animationStyle === "slide") {
      subTranslateY = interpolate(spring({ fps, frame: frameRelative, config: { damping: 14, stiffness: 300, mass: 0.2 } }), [0, 1], [30, 0]);
      subOpacity = spring({ fps, frame: frameRelative, config: { damping: 14, stiffness: 300 } });
    } else if (animationStyle === "fade") {
      subOpacity = interpolate(frameRelative, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill>
        {videoUrl ? (
          <Video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </AbsoluteFill>

      {/* 🔴 TOP TITLE 🔴 */}
      {topTitle && (
        <div style={{ position: "absolute", top: titleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            ...getTextStyle(false),
            fontSize: titleFontSize,
            textAlign: "center",
            maxWidth: "85%",
            lineHeight: "1.15",
            whiteSpace: "pre-wrap",
            transform: `scale(${entranceScale})`,
            backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent",
            padding: textBgStyle === "box" ? "15px 30px" : "0",
            borderRadius: textBgStyle === "box" ? "15px" : "0",
          }}>
            {topTitle}
          </div>
        </div>
      )}

      {/* 🔴 SUBTITLES WITH HORMOZI ACTIVE-WORD PUMP 🔴 */}
      {currentChunk && (
        <div style={{ position: "absolute", bottom: subtitleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            maxWidth: "90%",
            transform: `scale(${subScale}) translateY(${subTranslateY}px)`,
            opacity: subOpacity,
            backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent",
            padding: textBgStyle === "box" ? "10px 20px" : "0",
            borderRadius: textBgStyle === "box" ? "15px" : "0",
          }}>
            {currentChunk.words.map((w: any, idx: number) => {
              const nextWord = currentChunk.words[idx + 1];
              const highlightEndFrame = nextWord ? nextWord.startFrame : w.endFrame + Math.round(fps * 0.15);
              const isHighlighted = frame >= w.startFrame && frame < highlightEndFrame;
              
              // 🔥 WORD-LEVEL PUMP (Frame Locked) 🔥
              let activeWordScale = 1.0;
              if (wordsPerScreen !== "1" && isHighlighted) {
                const wordRelativeFrame = Math.max(0, frame - w.startFrame);
                activeWordScale = interpolate(
                  spring({ fps, frame: wordRelativeFrame, config: { damping: 12, stiffness: 400, mass: 0.2 } }),
                  [0, 1],
                  [1.0, 1.15] // Pumps from 1.0 to 1.15 scale instantly
                );
              }

              return (
                <span key={idx} style={{ 
                  ...getTextStyle(isHighlighted), 
                  fontSize: subtitleFontSize,
                  transform: `scale(${activeWordScale})`,
                  transformOrigin: "center center",
                }}>
                  {w.text}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 🔴 PART NUMBER 🔴 */}
      {partNumber && (
        <div style={{ position: "absolute", bottom: partYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            ...getTextStyle(true), 
            fontSize: partFontSize,
            transform: `scale(${entranceScale})`,
            backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent",
            padding: textBgStyle === "box" ? "10px 30px" : "0",
            borderRadius: textBgStyle === "box" ? "15px" : "0",
          }}>
            {partNumber}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};