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
  
  // 🌟 THE MILLISECOND TRACKER: We now use exact floating-point time instead of whole frames!
  const currentTime = frame / fps;

  const colors: any = {
    White: "#ffffff",
    Yellow: "#ffff00",
    Red: "#ff0000",
    Cyan: "#00ffff",
    Green: "#00ff00",
  };
  const highlightHex = colors[subtitleColor] || "#ffff00";

  // 🌟 EXACT AI TIME GROUPING (No Frame Rounding) 🌟
  const chunks = useMemo(() => {
    if (!transcription || transcription.length === 0) return [];
    const result = [];
    let currentChunk = [];
    
    for (let i = 0; i < transcription.length; i++) {
      const wordObj = transcription[i];
      
      let wStart = wordObj.start;
      let wEnd = wordObj.end;

      // Force-clamp Whisper's annoying "silence" bug directly in the milliseconds
      if ((wEnd - wStart) > 0.8) {
          wStart = Math.max(0, wEnd - 0.4); 
      }

      currentChunk.push({ 
          text: wordObj.word, 
          start: wStart,  // Raw AI Milliseconds
          end: wEnd,      // Raw AI Milliseconds
      });
      
      let maxWords = 1;
      if (wordsPerScreen === "3") maxWords = 3;
      if (wordsPerScreen === "full") maxWords = 8;

      const nextWordRaw = transcription[i + 1];
      let nextWordStart = nextWordRaw ? nextWordRaw.start : 0;
      
      if (nextWordRaw && (nextWordRaw.end - nextWordRaw.start) > 0.8) {
          nextWordStart = Math.max(0, nextWordRaw.end - 0.4);
      }

      const gapSeconds = nextWordRaw ? nextWordStart - wEnd : 0;

      if (currentChunk.length >= maxWords || gapSeconds > 0.4 || !nextWordRaw) {
        let chunkEndTime = currentChunk[currentChunk.length - 1].end + 0.15; 
        
        if (nextWordRaw && gapSeconds <= 0.4) {
            chunkEndTime = nextWordStart;
        }

        result.push({
          start: currentChunk[0].start, // Absolute AI Start Time
          end: chunkEndTime,            // Absolute AI End Time
          words: currentChunk
        });
        currentChunk = [];
      }
    }
    return result;
  }, [transcription, wordsPerScreen]);

  // Find chunk based on exact Milliseconds, not frames!
  const currentChunk = chunks.find(c => currentTime >= c.start && currentTime < c.end);

  // 🎨 STYLES 🎨
  const getTextStyle = (currentColor: string) => {
    let base: any = {
      fontFamily: subtitleFont,
      fontWeight: 900,
      textTransform: forceUppercase ? "uppercase" : "none",
      color: currentColor,
      display: "inline-block",
      margin: "0 8px", 
      whiteSpace: "pre-wrap", 
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
    const frameRelative = Math.max(0, frame - Math.round(currentChunk.start * fps)); 

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

      {topTitle && (
        <div style={{ position: "absolute", top: titleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{ ...getTextStyle("white"), fontSize: titleFontSize, textAlign: "center", maxWidth: "85%", lineHeight: "1.15", transform: `scale(${entranceScale})`, backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent", padding: textBgStyle === "box" ? "15px 30px" : "0", borderRadius: textBgStyle === "box" ? "15px" : "0" }}>
            {topTitle}
          </div>
        </div>
      )}

      {/* 🔴 SUBTITLES: MILLISECOND-EXACT ENGINE 🔴 */}
      {currentChunk && (
        <div style={{ position: "absolute", bottom: subtitleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", textAlign: "center", maxWidth: "90%", lineHeight: "1.5", 
            transform: `scale(${subScale}) translateY(${subTranslateY}px)`, opacity: subOpacity,
            backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent", padding: textBgStyle === "box" ? "15px 25px" : "0", borderRadius: textBgStyle === "box" ? "15px" : "0",
          }}>
            {currentChunk.words.map((w: any, idx: number) => {
              
              const nextWord = currentChunk.words[idx + 1];
              const highlightEnd = nextWord ? nextWord.start : w.end + 0.15;
              
              // Exactly checking the current floating-point second against the AI's raw millisecond output
              const isFuture = currentTime < w.start;
              const isActive = currentTime >= w.start && currentTime < highlightEnd;
              const isPast = currentTime >= highlightEnd;
              
              let activeWordScale = 1.0;
              let activeWordY = 0; 
              let activeWordOpacity = 1.0;
              let currentColor = "white";

              if (wordsPerScreen === "1") {
                // 1-WORD MODE (Untouched)
                currentColor = isActive ? highlightHex : "white";
                if (isActive) {
                  const activeSpring = spring({ fps, frame: frame - Math.round(w.start * fps), config: { damping: 12, stiffness: 400 } });
                  activeWordScale = interpolate(activeSpring, [0, 1], [0.8, 1.0]); 
                }
              } else {
                // 🌟 MULTI-WORD MODE: Millisecond Precision 🌟
                if (isFuture) {
                  currentColor = "white";
                  activeWordOpacity = 0.5; // Dimmed out waiting for the exact millisecond
                } else if (isActive) {
                  currentColor = highlightHex;
                  activeWordOpacity = 1;
                  
                  // Calculate exact progress through the word based on AI timestamps (0.0 to 1.0)
                  const wordDuration = highlightEnd - w.start;
                  const exactProgress = Math.max(0, Math.min(1, (currentTime - w.start) / wordDuration));
                  
                  // Pop it up exactly as it is spoken
                  activeWordY = interpolate(exactProgress, [0, 0.2], [0, -8], { extrapolateRight: "clamp" });
                  activeWordScale = interpolate(exactProgress, [0, 0.2], [1.0, 1.15], { extrapolateRight: "clamp" });

                } else if (isPast) {
                  currentColor = "white";
                  activeWordOpacity = 1;
                  
                  // Settle it back down exactly when the AI says the word is done
                  const pastDuration = 0.2; // Takes 0.2 seconds to settle back
                  const settleProgress = Math.max(0, Math.min(1, (currentTime - highlightEnd) / pastDuration));
                  
                  activeWordY = interpolate(settleProgress, [0, 1], [-8, 0], { extrapolateRight: "clamp" });
                  activeWordScale = interpolate(settleProgress, [0, 1], [1.15, 1.0], { extrapolateRight: "clamp" });
                }
              }

              return (
                <span key={idx} style={{ 
                  ...getTextStyle(currentColor), 
                  fontSize: subtitleFontSize,
                  opacity: activeWordOpacity,
                  transform: `scale(${activeWordScale}) translateY(${activeWordY}px)`,
                  transformOrigin: "center center", 
                  willChange: "transform, opacity, color" // Forces GPU acceleration for perfectly smooth frames
                }}>
                  {w.text}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {partNumber && (
        <div style={{ position: "absolute", bottom: partYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{ ...getTextStyle("white"), fontSize: partFontSize, transform: `scale(${entranceScale})`, backgroundColor: textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent", padding: textBgStyle === "box" ? "10px 30px" : "0", borderRadius: textBgStyle === "box" ? "15px" : "0" }}>
            {partNumber}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};