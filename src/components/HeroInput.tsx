import { useState } from "react";
import { Settings, Wand2, Type, Scissors, Music, FastForward, ChevronDown, ChevronUp, Loader2, Link as LinkIcon, Sparkles, AlignLeft } from "lucide-react";

const HeroInput = () => {
  // 🌟 MAIN INPUT STATES 🌟
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("short");
  const [chunkDuration, setChunkDuration] = useState("60");
  const [partsCount, setPartsCount] = useState("");
  const [niche, setNiche] = useState("");
  const [subNiche, setSubNiche] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
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

  // 🌟 SUBTITLE STYLE STATES 🌟
  const [subtitleFont, setSubtitleFont] = useState("Impact");
  const [subtitleColor, setSubtitleColor] = useState("White");

  // Preview colors for the dropdown label badges
  const colorPreviews: Record<string, { text: string; outline: string; label: string }> = {
    White:  { text: "#ffffff", outline: "#000000", label: "White + Black outline" },
    Yellow: { text: "#ffff00", outline: "#000000", label: "Yellow + Black outline" },
    Red:    { text: "#ff3b3b", outline: "#000000", label: "Red + Black outline" },
    Cyan:   { text: "#00ffff", outline: "#000000", label: "Cyan + Black outline" },
    Green:  { text: "#00ff88", outline: "#000000", label: "Green + Black outline" },
  };

  const handleGenerate = async () => {
    if (!url) {
      alert("Please enter a YouTube URL first!");
      return;
    }

    if (mode === "short" && niche && subNiche === "Other" && !customPrompt) {
      alert("Please describe your custom niche!");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          mode,
          chunkDuration,
          partsCount: partsCount ? parseInt(partsCount) : 0,
          niche,
          subNiche,
          customPrompt,
          proSettings: {
            autoPilot,
            subtitles,
            removeSilence,
            bgMusic,
            pacing,
            subtitleFont,
            subtitleColor,
            printPartTitle, 
          },
        }),
      });

      // 🌟 LIVE STREAM READER (SSE) 🌟
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

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">

      {/* 🔗 URL INPUT */}
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

      {/* 🎛️ MODE SELECTOR */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setMode("short")}
          className={`py-3 px-4 rounded-xl font-bold transition-all ${
            mode === "short" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
          }`}
        >
          Viral Short (AI Edited)
        </button>
        <button
          onClick={() => setMode("split")}
          className={`py-3 px-4 rounded-xl font-bold transition-all ${
            mode === "split" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
          }`}
        >
          Split Mode (Parts)
        </button>
      </div>

      {/* 🌟 RESTORED: SPLIT MODE INPUTS (ONLY SHOWS IN SPLIT MODE) 🌟 */}
      {mode === "split" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Seconds per Part</label>
            <input
              type="number"
              value={chunkDuration}
              onChange={(e) => setChunkDuration(e.target.value)}
              placeholder="e.g. 60"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Number of Parts (Optional)</label>
            <input
              type="number"
              value={partsCount}
              onChange={(e) => setPartsCount(e.target.value)}
              placeholder="e.g. 5 (Overrides seconds)"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      )}

      {/* ⚙️ PRO SETTINGS TOGGLE */}
      <div className="w-full mt-2 mb-6">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200"
        >
          <Settings className="w-4 h-4" />
          {showSettings ? "Hide Advanced Settings" : "Show Advanced Settings"}
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSettings && (
          <div className="mt-4 p-5 bg-gray-50 border border-gray-200 rounded-xl animate-in slide-in-from-top-2 fade-in space-y-5">

            {/* ✨ AI AUTO-PILOT */}
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Wand2 className="w-5 h-5 text-blue-600" />
                </div>
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

            {/* 🎚️ MANUAL CONTROLS */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 ${autoPilot ? "opacity-50 pointer-events-none grayscale" : "opacity-100"}`}>

              {/* Subtitles toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Burn-in Subtitles</span>
                </div>
                <input type="checkbox" checked={subtitles} onChange={() => setSubtitles(!subtitles)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
              </div>

              {/* Silence Removal */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Auto-Cut Silences</span>
                </div>
                <input type="checkbox" checked={removeSilence} onChange={() => setRemoveSilence(!removeSilence)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
              </div>

              {/* 🎵 RESTORED: Background Music */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Music Vibe</span>
                </div>
                <select value={bgMusic} onChange={(e) => setBgMusic(e.target.value)} className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium">
                  <option value="None">None</option>
                  <option value="Lo-Fi">Chill Lo-Fi</option>
                  <option value="Phonk">Sigma Phonk</option>
                  <option value="Epic">Epic Cinematic</option>
                </select>
              </div>

              {/* Pacing */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <FastForward className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Video Pacing</span>
                </div>
                <select value={pacing} onChange={(e) => setPacing(e.target.value)} className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium">
                  <option value="Normal">1.0x (Normal)</option>
                  <option value="Fast">1.1x (TikTok Fast)</option>
                  <option value="VeryFast">1.25x (Aggressive)</option>
                </select>
              </div>

              {/* 🌟 SPLIT MODE EXCLUSIVE: Print Title & Part # 🌟 */}
              {mode === "split" && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:col-span-2">
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Print Title & Part # (Top Center)</span>
                  </div>
                  <input type="checkbox" checked={printPartTitle} onChange={() => setPrintPartTitle(!printPartTitle)} className="w-4 h-4 text-blue-600 cursor-pointer rounded border-gray-300 focus:ring-blue-500" />
                </div>
              )}

            </div>

            {/* 🌟 SUBTITLE STYLE SECTION 🌟 */}
            {!autoPilot && subtitles && (
              <>
                <div className="w-full h-px bg-gray-200"></div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" />
                    Subtitle Style
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* 🔤 FONT PICKER */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔤</span>
                        <span className="text-sm font-medium text-gray-700">Font Style</span>
                      </div>
                      <select
                        value={subtitleFont}
                        onChange={(e) => setSubtitleFont(e.target.value)}
                        className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
                      >
                        <option value="Impact">Impact (TikTok Classic)</option>
                        <option value="Arial Bold">Arial Bold (Clean)</option>
                        <option value="Montserrat">Montserrat (Modern)</option>
                        <option value="Comic Sans MS">Comic Sans (Meme 💀)</option>
                      </select>
                    </div>

                    {/* 🎨 COLOR PICKER */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎨</span>
                        <span className="text-sm font-medium text-gray-700">Text Color</span>
                      </div>
                      <select
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="bg-gray-50 text-gray-800 border border-gray-200 text-xs rounded-md p-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
                      >
                        <option value="White">⬜ White + Black outline</option>
                        <option value="Yellow">🟡 Yellow + Black outline</option>
                        <option value="Red">🔴 Red + Black outline</option>
                        <option value="Cyan">🩵 Cyan + Black outline</option>
                        <option value="Green">🟢 Green + Black outline</option>
                      </select>
                    </div>

                  </div>

                  {/* 🌟 LIVE PREVIEW BADGE 🌟 */}
                  <div className="mt-3 flex items-center justify-center">
                    <div className="px-4 py-2 bg-black rounded-lg flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-medium">Preview:</span>
                      <span
                        style={{
                          fontFamily: subtitleFont,
                          color: colorPreviews[subtitleColor]?.text || "#fff",
                          textShadow: `1px 1px 3px ${colorPreviews[subtitleColor]?.outline || "#000"}, -1px -1px 3px ${colorPreviews[subtitleColor]?.outline || "#000"}`,
                          fontSize: "15px",
                          fontWeight: "bold",
                          letterSpacing: subtitleFont === "Impact" ? "0.05em" : "normal",
                          textTransform: subtitleFont === "Impact" ? "uppercase" : "none",
                        }}
                      >
                        THIS IS HOW IT LOOKS
                      </span>
                    </div>
                  </div>

                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* 🚀 GENERATE BUTTON */}
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Processing Video...
          </>
        ) : (
          <>
            <Sparkles className="w-6 h-6" />
            Generate Viral {mode === "short" ? "Short" : "Parts"}
          </>
        )}
      </button>

    </div>
  );
};

export default HeroInput;