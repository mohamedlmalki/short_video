import { useState } from "react";
import { Settings, Wand2, Type, Scissors, Music, FastForward, ChevronDown, ChevronUp, Loader2, Link as LinkIcon, Sparkles, AlignLeft, X, MonitorPlay, SlidersHorizontal, Palette, BoxSelect, ShieldAlert, CaseUpper, Zap, Baseline, Youtube, Bot } from "lucide-react";

const HeroInput = () => {
  // 🌟 MASTER STUDIO MODE 🌟
  const [studioMode, setStudioMode] = useState<"repurpose" | "ai-original">("repurpose");

  // 🌟 REPURPOSE STATES (Original App) 🌟
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("short");
  const [chunkDuration, setChunkDuration] = useState("60");
  const [partsCount, setPartsCount] = useState("");
  const [customVideoTitle, setCustomVideoTitle] = useState(""); 
  
  // 🌟 AI TREND STUDIO STATES (New App) 🌟
  const [aiTopic, setAiTopic] = useState("");
  const [aiEngine, setAiEngine] = useState("auto"); 
  const [trendSource, setTrendSource] = useState("reddit"); // 🌟 NEW: Data Source State

  // 🌟 GLOBAL STATES 🌟
  const [isLoading, setIsLoading] = useState(false);

  // 🌟 PRO SETTINGS STATES 🌟
  const [showSettings, setShowSettings] = useState(false);
  const [autoPilot, setAutoPilot] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [removeSilence, setRemoveSilence] = useState(true);
  const [bgMusic, setBgMusic] = useState("None");
  const [pacing, setPacing] = useState("Normal");
  
  // 🌟 SPLIT MODE SPECIFIC STATE 🌟
  const [printPartTitle, setPrintPartTitle] = useState(true);

  // 🌟 VISUAL EDITOR STATES 🌟
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [titleFontSize, setTitleFontSize] = useState(90);
  const [titleYPos, setTitleYPos] = useState(200); 
  const [partFontSize, setPartFontSize] = useState(130);
  const [partYPos, setPartYPos] = useState(150); 
  const [subtitleFontSize, setSubtitleFontSize] = useState(70);
  const [subtitleYPos, setSubtitleYPos] = useState(380);
  const [subtitleFont, setSubtitleFont] = useState("Impact");
  const [subtitleColor, setSubtitleColor] = useState("Yellow");
  const [textBgStyle, setTextBgStyle] = useState("outline"); 
  const [showSafeZone, setShowSafeZone] = useState(true); 
  const [forceUppercase, setForceUppercase] = useState(true);
  const [wordsPerScreen, setWordsPerScreen] = useState("1"); 
  const [animationStyle, setAnimationStyle] = useState("pop"); 

  const colorPreviews: Record<string, { text: string; outline: string }> = {
    White:  { text: "#ffffff", outline: "#000000" },
    Yellow: { text: "#ffff00", outline: "#000000" },
    Red:    { text: "#ff0000", outline: "#000000" },
    Cyan:   { text: "#00ffff", outline: "#000000" },
    Green:  { text: "#00ff00", outline: "#000000" },
  };

  const handleGenerate = async () => {
    if (studioMode === "repurpose" && !url) {
      alert("Please enter a YouTube URL first!");
      return;
    }
    if (studioMode === "ai-original" && !aiTopic) {
      alert("Please enter a topic or click 'Load Live Trend'!");
      return;
    }

    setIsLoading(true);

    const endpoint = studioMode === "repurpose" 
        ? "http://localhost:3000/api/generate" 
        : "http://localhost:3000/api/generate-ai-video";

    const payload = studioMode === "repurpose" 
      ? { url, mode, chunkDuration, partsCount: partsCount ? parseInt(partsCount) : 0, customVideoTitle }
      : { topic: aiTopic, engine: aiEngine, trendSource }; // 🌟 Added trendSource to payload

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          proSettings: {
            autoPilot, subtitles, removeSilence, bgMusic, pacing, subtitleFont, subtitleColor, 
            printPartTitle, titleFontSize, titleYPos, partFontSize, partYPos, subtitleFontSize, 
            subtitleYPos, textBgStyle, forceUppercase, wordsPerScreen, animationStyle  
          },
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                window.dispatchEvent(new CustomEvent("live-job-update", { detail: { message: data.message } }));
              } catch (e) { /* ignore */ }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect to the backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  const PREVIEW_SCALE = 0.25; 

  const getTextStyle = (isHighlight: boolean = false) => {
    let base: any = {
      fontFamily: subtitleFont,
      fontWeight: "900",
      textTransform: forceUppercase ? "uppercase" : "none",
      color: isHighlight ? (colorPreviews[subtitleColor]?.text || "#fff") : "white",
      zIndex: 10,
    };

    if (textBgStyle === "outline") {
      base.textShadow = "1.5px 1.5px 0 black, -1px -1px 0 black, 2px 2px 4px rgba(0,0,0,0.6)";
      base.WebkitTextStroke = "1px black";
    }
    if (textBgStyle === "box") {
      base.backgroundColor = "rgba(0, 0, 0, 0.85)";
      base.padding = "2px 6px";
      base.textShadow = "none";
    }
    if (textBgStyle === "shadow") {
      base.textShadow = "0px 0px 8px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,1)";
      base.WebkitTextStroke = "0.5px rgba(0,0,0,0.5)";
    }
    if (textBgStyle === "3d") {
      base.textShadow = "3px 3px 0px #000";
      base.WebkitTextStroke = "1px black";
    }

    return base;
  };

  const renderSubtitlePreview = () => {
    const highlightColor = colorPreviews[subtitleColor]?.text || "#fff";
    if (wordsPerScreen === "1") return <span style={{ color: highlightColor }}>VIRAL</span>;
    if (wordsPerScreen === "3") {
      return (
        <>
          <span style={{ color: "white" }}>SUPER </span>
          <span style={{ color: highlightColor }}>VIRAL </span>
          <span style={{ color: "white" }}>CLIP</span>
        </>
      );
    }
    return (
      <>
        <span style={{ color: "white" }}>THIS IS A </span>
        <span style={{ color: highlightColor }}>VIRAL </span>
        <span style={{ color: "white" }}>VIDEO CLIP</span>
      </>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm relative">

      <div className="flex p-1 mb-8 bg-gray-100 rounded-xl">
        <button 
          onClick={() => setStudioMode("repurpose")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${studioMode === "repurpose" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Youtube className="w-5 h-5" /> Repurpose YouTube
        </button>
        <button 
          onClick={() => setStudioMode("ai-original")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${studioMode === "ai-original" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Bot className="w-5 h-5" /> AI Trend Studio
        </button>
      </div>

      {studioMode === "repurpose" && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <LinkIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube Link Here..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => setMode("short")} className={`py-3 px-4 rounded-xl font-bold transition-all ${mode === "short" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Viral Short (AI Edited)
            </button>
            <button onClick={() => setMode("split")} className={`py-3 px-4 rounded-xl font-bold transition-all ${mode === "split" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Split Mode (Parts)
            </button>
          </div>

          {mode === "split" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
              <div className="md:col-span-2 mb-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Custom Video Title (Optional)</label>
                <input type="text" value={customVideoTitle} onChange={(e) => setCustomVideoTitle(e.target.value)} placeholder="Leave blank to auto-fetch from YouTube..." className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Seconds per Part</label>
                <input type="number" value={chunkDuration} onChange={(e) => setChunkDuration(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Number of Parts (Optional)</label>
                <input type="number" value={partsCount} onChange={(e) => setPartsCount(e.target.value)} placeholder="e.g. 5" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🌟 UPDATED AI TREND STUDIO UI 🌟 */}
      {studioMode === "ai-original" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 mb-6">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 mb-6">
            <h3 className="text-lg font-black text-indigo-900 mb-2">Original AI Video Factory</h3>
            <p className="text-sm text-indigo-700 mb-4">Select a trend source to scrape, or type your own custom topic.</p>
            
            <div className="flex gap-3 mb-3">
              <select 
                value={trendSource} 
                onChange={(e) => setTrendSource(e.target.value)}
                className="px-4 py-3 bg-white border border-indigo-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              >
                <option value="reddit">🔥 Reddit Trends</option>
                <option value="google">📈 Google Trends</option>
              </select>
              <button 
                onClick={() => setAiTopic("Auto-Scrape Viral Trends")}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" /> Load Live Trend
              </button>
            </div>
            
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="...or manually type a custom topic here (e.g. Tech news about AI)..."
              className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-base font-medium"
            />
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Target Video Engine</label>
             <div className="grid grid-cols-3 gap-3">
               <button onClick={() => setAiEngine("auto")} className={`py-3 rounded-lg font-bold border ${aiEngine === "auto" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>🧠 Groq Router</button>
               <button onClick={() => setAiEngine("sora")} className={`py-3 rounded-lg font-bold border ${aiEngine === "sora" ? "bg-black text-white border-black shadow-md" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>OpenAI Sora</button>
               <button onClick={() => setAiEngine("veo")} className={`py-3 rounded-lg font-bold border ${aiEngine === "veo" ? "bg-blue-500 text-white border-blue-500 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>Google Veo</button>
             </div>
          </div>
        </div>
      )}

      {/* PRO SETTINGS & VISUAL EDITOR MODAL CODE REMAINS EXACTLY THE SAME BELOW... */}
      <div className="w-full mt-2 mb-6">
        <button onClick={() => setShowSettings(!showSettings)} className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
          <Settings className="w-4 h-4" />
          {showSettings ? "Hide Advanced Settings" : "Show Advanced Settings"}
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSettings && (
          <div className="mt-4 p-5 bg-gray-50 border border-gray-200 rounded-xl animate-in slide-in-from-top-2 fade-in space-y-5">
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full"><Wand2 className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">AI Auto-Pilot</h4>
                  <p className="text-xs text-gray-600">Let the 70B AI analyze the video and pick the perfect vibe.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoPilot} onChange={() => setAutoPilot(!autoPilot)} />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="w-full h-px bg-gray-200"></div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 ${autoPilot ? "opacity-50 pointer-events-none grayscale" : "opacity-100"}`}>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2"><Type className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Burn-in Subtitles</span></div>
                <input type="checkbox" checked={subtitles} onChange={() => setSubtitles(!subtitles)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2"><Scissors className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Auto-Cut Silences</span></div>
                <input type="checkbox" checked={removeSilence} onChange={() => setRemoveSilence(!removeSilence)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2"><Music className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Music Vibe</span></div>
                <select value={bgMusic} onChange={(e) => setBgMusic(e.target.value)} className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 font-medium outline-none">
                  <option value="None">None</option>
                  <option value="Lo-Fi">Chill Lo-Fi</option>
                  <option value="Phonk">Sigma Phonk</option>
                  <option value="Epic">Epic Cinematic</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2"><FastForward className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Video Pacing</span></div>
                <select value={pacing} onChange={(e) => setPacing(e.target.value)} className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 font-medium outline-none">
                  <option value="Normal">1.0x (Normal)</option>
                  <option value="Fast">1.1x (TikTok Fast)</option>
                  <option value="VeryFast">1.25x (Aggressive)</option>
                </select>
              </div>

              {studioMode === "repurpose" && mode === "split" && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:col-span-2">
                  <div className="flex items-center gap-2"><AlignLeft className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Print Title & Part #</span></div>
                  <input type="checkbox" checked={printPartTitle} onChange={() => setPrintPartTitle(!printPartTitle)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
                </div>
              )}

              {(!autoPilot && (subtitles || (mode === "split" && printPartTitle))) && (
                <div className="md:col-span-2 mt-2">
                  <button onClick={() => setShowVisualEditor(true)} className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                    <Palette className="w-5 h-5" /> Open Visual Style Editor
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={handleGenerate} 
        disabled={isLoading} 
        className={`w-full py-4 text-white font-black text-lg rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${studioMode === 'repurpose' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
      >
        {isLoading ? <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</> : <><Sparkles className="w-6 h-6" /> {studioMode === 'repurpose' ? 'Generate Video' : 'Create AI Trend'}</>}
      </button>

      {showVisualEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          {/* Editor Popup Code Remains the Same */}
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200">
            <div className="bg-gray-900 p-6 flex items-center justify-center relative md:w-5/12 border-r border-gray-800">
              <div className="relative bg-gray-800 border border-gray-700 shadow-2xl overflow-hidden rounded-md" style={{ width: "270px", height: "480px" }}>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                  <MonitorPlay className="w-16 h-16 text-gray-500 mb-2" />
                  <span className="text-gray-500 font-bold text-xs uppercase tracking-widest">Video Background</span>
                </div>

                {showSafeZone && (
                  <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute right-2 bottom-[100px] w-[50px] h-[250px] bg-red-500/20 border border-red-500/40 rounded flex items-center justify-center">
                      <span className="text-[10px] text-red-200 -rotate-90 font-bold tracking-widest">UI BUTTONS</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-red-500/20 border-t border-red-500/40 flex items-center justify-center">
                      <span className="text-[10px] text-red-200 font-bold tracking-widest">DESCRIPTION AREA</span>
                    </div>
                     <div className="absolute top-0 left-0 right-0 h-[60px] bg-red-500/20 border-b border-red-500/40 flex items-center justify-center">
                      <span className="text-[10px] text-red-200 font-bold tracking-widest">TOP UI</span>
                    </div>
                  </div>
                )}

                {mode === "split" && printPartTitle && (
                  <div className="absolute w-full flex justify-center text-center leading-tight transition-all z-10"
                    style={{
                      top: `${titleYPos * PREVIEW_SCALE}px`,
                      fontSize: `${titleFontSize * PREVIEW_SCALE}px`,
                      textAlign: "center", maxWidth: "85%", lineHeight: "1.15", whiteSpace: "pre-wrap",
                      ...getTextStyle(false)
                    }}
                  >
                    <span style={textBgStyle === 'box' ? { backgroundColor: "rgba(0,0,0,0.85)", padding: "15px 30px", borderRadius: "15px", display: "inline-block" } : {}}>
                      {customVideoTitle ? customVideoTitle : "VIDEO TITLE"}
                    </span>
                  </div>
                )}

                {subtitles && (
                  <div className="absolute w-full flex flex-col items-center justify-center text-center leading-tight transition-all z-10"
                    style={{
                      bottom: `${subtitleYPos * PREVIEW_SCALE}px`,
                      fontSize: `${subtitleFontSize * PREVIEW_SCALE}px`,
                      fontFamily: subtitleFont,
                      fontWeight: "900",
                      textTransform: forceUppercase ? "uppercase" : "none",
                    }}
                  >
                    <div style={{
                       backgroundColor: textBgStyle === 'box' ? "rgba(0,0,0,0.85)" : "transparent",
                       padding: textBgStyle === 'box' ? "10px 20px" : "0",
                       borderRadius: textBgStyle === 'box' ? "15px" : "0",
                       textShadow: getTextStyle(false).textShadow,
                       WebkitTextStroke: getTextStyle(false).WebkitTextStroke
                    }}>
                        {renderSubtitlePreview()}
                    </div>
                  </div>
                )}

                {mode === "split" && printPartTitle && (
                  <div className="absolute w-full flex justify-center text-center leading-tight transition-all z-10"
                    style={{
                      bottom: `${partYPos * PREVIEW_SCALE}px`,
                      fontSize: `${partFontSize * PREVIEW_SCALE}px`,
                      ...getTextStyle(true) 
                    }}
                  >
                    <span style={textBgStyle === 'box' ? { backgroundColor: "rgba(0,0,0,0.85)", padding: "10px 30px", borderRadius: "15px", display: "inline-block" } : {}}>
                      PART 1
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 md:w-7/12 flex flex-col bg-gray-50 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-blue-600" /> Unified Visual Editor
                </h3>
                <button onClick={() => setShowVisualEditor(false)} className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-all"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-6 flex-1">
                {(subtitles || printPartTitle) && (
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider flex items-center gap-1.5"><Type className="w-3.5 h-3.5"/> Global Text Style</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setForceUppercase(!forceUppercase)}>
                           <CaseUpper className={`w-4 h-4 ${forceUppercase ? "text-indigo-600" : "text-gray-400"}`} />
                           <span className={`text-[10px] font-bold ${forceUppercase ? "text-indigo-600" : "text-gray-400"}`}>ALL CAPS</span>
                        </div>
                         <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSafeZone(!showSafeZone)}>
                           <ShieldAlert className={`w-4 h-4 ${showSafeZone ? "text-red-500" : "text-gray-400"}`} />
                           <span className={`text-[10px] font-bold ${showSafeZone ? "text-red-500" : "text-gray-400"}`}>SAFE ZONE</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Font Family</label>
                        <select value={subtitleFont} onChange={(e) => setSubtitleFont(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm font-medium">
                          <option value="Impact">Impact (TikTok)</option>
                          <option value="Arial Bold">Arial Bold</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Comic Sans MS">Comic Sans 💀</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Highlight Color</label>
                        <select value={subtitleColor} onChange={(e) => setSubtitleColor(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm font-medium">
                          <option value="White">⬜ White</option>
                          <option value="Yellow">🟡 Yellow</option>
                          <option value="Red">🔴 Red</option>
                          <option value="Cyan">🩵 Cyan</option>
                          <option value="Green">🟢 Green</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Background Style</label>
                        <div className="relative">
                          <BoxSelect className="absolute left-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                          <select value={textBgStyle} onChange={(e) => setTextBgStyle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 pl-8 text-sm font-medium">
                            <option value="outline">Modern Outline</option>
                            <option value="box">Classic Box ⬛</option>
                            <option value="shadow">Soft Shadow ☁️</option>
                            <option value="3d">Retro 3D 📐</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Animation Effect</label>
                        <div className="relative">
                          <Zap className="absolute left-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                          <select value={animationStyle} onChange={(e) => setAnimationStyle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 pl-8 text-sm font-medium">
                            <option value="pop">Pop (Dynamic Pop-in)</option>
                            <option value="bounce">Bounce (Springy)</option>
                            <option value="slide">Slide Up (Smooth)</option>
                            <option value="fade">Fade In (Cinematic)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {subtitles && (
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-green-500">
                    <h4 className="font-bold text-xs text-green-600 uppercase tracking-wider">Subtitle Setup</h4>
                    <div className="mb-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1">
                         <Baseline className="w-3.5 h-3.5" /> Words Per Screen
                      </label>
                      <select value={wordsPerScreen} onChange={(e) => setWordsPerScreen(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm font-medium">
                        <option value="1">1 Word (Hormozi Fast)</option>
                        <option value="3">2-3 Words (Dynamic Focus)</option>
                        <option value="full">Full Sentence (Standard)</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Font Size</span> <span className="text-green-600 font-bold">{subtitleFontSize}</span></label>
                      <input type="range" min="30" max="200" value={subtitleFontSize} onChange={(e) => setSubtitleFontSize(Number(e.target.value))} className="w-full accent-green-600" />
                    </div>
                    <div>
                      <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Position (Y-Axis Up)</span> <span className="text-green-600 font-bold">{subtitleYPos}px</span></label>
                      <input type="range" min="20" max="800" value={subtitleYPos} onChange={(e) => setSubtitleYPos(Number(e.target.value))} className="w-full accent-green-600" />
                    </div>
                  </div>
                )}

                {mode === "split" && printPartTitle && (
                  <>
                    <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                      <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider">Top Title Position</h4>
                      <div>
                        <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Font Size</span> <span className="text-blue-600 font-bold">{titleFontSize}</span></label>
                        <input type="range" min="40" max="200" value={titleFontSize} onChange={(e) => setTitleFontSize(Number(e.target.value))} className="w-full accent-blue-600" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Position (Y-Axis Down)</span> <span className="text-blue-600 font-bold">{titleYPos}px</span></label>
                        <input type="range" min="20" max="800" value={titleYPos} onChange={(e) => setTitleYPos(Number(e.target.value))} className="w-full accent-blue-600" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                      <h4 className="font-bold text-xs text-purple-600 uppercase tracking-wider">Part Number Position</h4>
                      <div>
                        <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Font Size</span> <span className="text-purple-600 font-bold">{partFontSize}</span></label>
                        <input type="range" min="60" max="300" value={partFontSize} onChange={(e) => setPartFontSize(Number(e.target.value))} className="w-full accent-purple-600" />
                      </div>
                      <div>
                        <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Position (Y-Axis Up)</span> <span className="text-purple-600 font-bold">{partYPos}px</span></label>
                        <input type="range" min="20" max="800" value={partYPos} onChange={(e) => setPartYPos(Number(e.target.value))} className="w-full accent-purple-600" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button onClick={() => setShowVisualEditor(false)} className="mt-6 w-full py-4 bg-gray-900 hover:bg-black text-white font-bold text-lg rounded-xl transition-all shadow-md">
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HeroInput;