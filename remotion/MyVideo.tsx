import React, { useMemo } from "react";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

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
  const currentTime = frame / fps;

  const colors: any = {
    White: "#ffffff",
    Yellow: "#ffff00",
    Red: "#ff0000",
    Cyan: "#00ffff",
    Green: "#00ff00",
  };
  const highlightHex = colors[subtitleColor] || "#ffff00";

  // ==========================================
  // 🏆 THE OFFICIAL REMOTION TIKTOK PAGINATION 🏆
  // ==========================================
  const pages = useMemo(() => {
    if (!transcription || transcription.length === 0) return [];
    
    const result = [];
    let currentPage: any[] = [];
    
    let wordsLimit = 1;
    if (wordsPerScreen === "3") wordsLimit = 3;
    if (wordsPerScreen === "full") wordsLimit = 7; // Standard TikTok sentence length

    for (let i = 0; i < transcription.length; i++) {
      const item = transcription[i];
      
      // Clean up Whisper's silence bugs safely
      let safeStart = item.start;
      if (item.end - item.start > 0.8) {
        safeStart = Math.max(0, item.end - 0.4);
      }

      currentPage.push({
        text: item.word || item.text,
        start: safeStart,
        end: item.end,
      });

      const nextItem = transcription[i + 1];
      const gap = nextItem ? nextItem.start - item.end : 0;

      // Create a new "Page" if we hit the word limit OR if there is a silence gap
      if (currentPage.length >= wordsLimit || gap > 0.4 || !nextItem) {
        result.push({
          start: currentPage[0].start,
          end: currentPage[currentPage.length - 1].end + 0.15, // Tiny tail so it doesn't vanish instantly
          words: currentPage,
        });
        currentPage = [];
      }
    }
    return result;
  }, [transcription, wordsPerScreen]);

  // Find the currently active Page
  const activePage = pages.find((p) => currentTime >= p.start && currentTime < p.end);

  // ==========================================
  // 🎨 STYLES
  // ==========================================
  const getStrokeStyle = () => {
    if (textBgStyle === "outline") return { textShadow: "2px 2px 0 black, -1px -1px 0 black, 4px 4px 6px rgba(0,0,0,0.8)", WebkitTextStroke: "2px black" };
    if (textBgStyle === "shadow") return { textShadow: "0px 0px 15px rgba(0,0,0,1), 0px 0px 5px rgba(0,0,0,1)", WebkitTextStroke: "0.5px rgba(0,0,0,0.5)" };
    if (textBgStyle === "3d") return { textShadow: "5px 5px 0px #000", WebkitTextStroke: "2px black" };
    return {};
  };

  const textBackground = textBgStyle === "box" ? "rgba(0,0,0,0.85)" : "transparent";
  const textPadding = textBgStyle === "box" ? "12px 24px" : "0";
  const textRadius = textBgStyle === "box" ? "15px" : "0";

  // Global Page Entrance Animation
  const pageEntranceScale = spring({ frame, fps, config: { damping: 12, stiffness: 300, mass: 0.2 } });

  let pageScale = 1;
  let pageTranslateY = 0;
  let pageOpacity = 1;

  if (activePage) {
    const pageStartFrame = Math.round(activePage.start * fps);
    const frameRelative = Math.max(0, frame - pageStartFrame);

    if (animationStyle === "pop") {
      pageScale = spring({ fps, frame: frameRelative, config: { damping: 12, stiffness: 400, mass: 0.2 } });
    } else if (animationStyle === "bounce") {
      pageScale = spring({ fps, frame: frameRelative, config: { damping: 6, stiffness: 400, mass: 0.3 } });
    } else if (animationStyle === "slide") {
      pageTranslateY = interpolate(spring({ fps, frame: frameRelative, config: { damping: 14, stiffness: 300 } }), [0, 1], [30, 0]);
      pageOpacity = spring({ fps, frame: frameRelative, config: { damping: 14, stiffness: 300 } });
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill>
        {videoUrl ? <Video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </AbsoluteFill>

      {/* 🔴 TOP TITLE 🔴 */}
      {topTitle && (
        <div style={{ position: "absolute", top: titleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            fontFamily: subtitleFont, fontWeight: 900, textTransform: forceUppercase ? "uppercase" : "none", color: "white",
            fontSize: titleFontSize, textAlign: "center", maxWidth: "85%", lineHeight: "1.1", whiteSpace: "pre-wrap",
            transform: `scale(${pageEntranceScale})`, backgroundColor: textBackground, padding: textPadding, borderRadius: textRadius,
            ...getStrokeStyle()
          }}>
            {topTitle}
          </div>
        </div>
      )}

      {/* 🔴 SUBTITLES (OFFICIAL TIKTOK TEMPLATE RENDERER) 🔴 */}
      {activePage && (
        <div style={{ position: "absolute", bottom: subtitleYPos, width: "100%", display: "flex", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", textAlign: "center",
            maxWidth: "90%", lineHeight: "1.2",
            transform: `scale(${pageScale}) translateY(${pageTranslateY}px)`, opacity: pageOpacity,
            backgroundColor: textBackground, padding: textPadding, borderRadius: textRadius,
          }}>
            {activePage.words.map((w: any, idx: number) => {
              
              // Exactly match the time to see if the word is actively being spoken
              const isActive = currentTime >= w.start && currentTime < w.end;
              const isPast = currentTime >= w.end;

              // Base state: White and normal size
              let wordColor = "white";
              let wordScale = 1.0;
              let wordY = 0;
              
              if (wordsPerScreen !== "1") {
                  // The CapCut trick: Dim words that haven't been spoken yet
                  if (!isActive && !isPast) {
                      wordColor = "rgba(255, 255, 255, 0.5)"; 
                  }
                  
                  // Highlight and pop the active word
                  if (isActive) {
                      wordColor = highlightHex;
                      // Instantly pop the active word to 110% size and lift it slightly
                      wordScale = 1.1; 
                      wordY = -5;
                  }
                  
                  // Once spoken, return to bright white and normal size
                  if (isPast) {
                      wordColor = "white";
                  }
              } else {
                  // 1-Word mode stays aggressive
                  wordColor = isActive ? highlightHex : "white";
              }

              return (
                <span key={idx} style={{
                  fontFamily: subtitleFont,
                  fontWeight: 900,
                  textTransform: forceUppercase ? "uppercase" : "none",
                  color: wordColor,
                  fontSize: subtitleFontSize,
                  margin: "0 8px", // Generous margin so words don't crash into each other
                  display: "inline-block",
                  transform: `scale(${wordScale}) translateY(${wordY}px)`,
                  transition: "none", // NO CSS TRANSITIONS (Prevents video rendering lag)
                  ...getStrokeStyle()
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
            fontFamily: subtitleFont, fontWeight: 900, textTransform: forceUppercase ? "uppercase" : "none", color: "white",
            fontSize: partFontSize, transform: `scale(${pageEntranceScale})`, backgroundColor: textBackground, padding: textPadding, borderRadius: textRadius,
            ...getStrokeStyle()
          }}>
            {partNumber}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};