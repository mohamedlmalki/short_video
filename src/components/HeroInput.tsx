import { useState } from "react";
import { Zap, Link, Loader2, ListVideo } from "lucide-react";

// The dictionary of niches and sub-niches
const NICHE_DATA = {
  "Finance & Crypto": ["Crypto Trading", "Personal Finance", "Real Estate", "Other"],
  "Gaming": ["Minecraft", "GTA V", "Roblox", "Valorant", "Other"],
  "Educational / Tech": ["Coding / Web3", "AI & Tech News", "Science Facts", "Other"],
  "Comedy / Memes": ["Reaction Videos", "Storytime", "Pranks", "Other"],
  "Movies & Series": ["Anime", "Sci-Fi / Thriller", "True Crime", "Other"]
};

type NicheKey = keyof typeof NICHE_DATA;

const HeroInput = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState("short"); // "short" or "split"
  const [chunkDuration, setChunkDuration] = useState("60"); 
  
  // New Persona States
  const [niche, setNiche] = useState<NicheKey | "">("");
  const [subNiche, setSubNiche] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          url: url,
          mode: mode,
          chunkDuration: chunkDuration,
          niche: niche,
          subNiche: subNiche,
          customPrompt: customPrompt
        }),
      });

      const data = await response.json();
      alert(data.message);
      
    } catch (error) {
      console.error("Error communicating with backend:", error);
      alert("Failed to connect to the backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          Turn Long Videos into <span className="text-gradient">Viral Series</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Let AI find the best viral hook, OR automatically split a full video into multiple parts.
        </p>
      </div>

      {/* Mode Selection Toggle */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => setMode('short')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-all ${
            mode === 'short' 
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <Zap className="w-4 h-4" />
          Short Video (AI Cut)
        </button>
        <button
          onClick={() => setMode('split')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-all ${
            mode === 'split' 
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <ListVideo className="w-4 h-4" />
          Part Video (Split Full)
        </button>
      </div>

      {/* Main Input Card */}
      <div className="glass-card p-2 max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-2">
        <div className="relative w-full flex-1">
          <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube video URL here..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground pl-10 pr-4 py-3 text-sm focus:outline-none"
          />
        </div>
        
        <button 
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full md:w-auto flex justify-center items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-lg transition-all glow-primary text-sm whitespace-nowrap disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'short' ? <Zap className="w-4 h-4" /> : <ListVideo className="w-4 h-4" />)}
          {isLoading ? "Processing..." : (mode === 'short' ? "Generate AI Short" : "Split Video")}
        </button>
      </div>

      {/* Extra Inputs for Split Mode */}
      {mode === 'split' && (
        <div className="flex gap-4 mt-4 max-w-md mx-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex-1 glass-card p-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground mx-3 whitespace-nowrap">Duration per part (sec):</span>
            <input 
              type="number" 
              value={chunkDuration} 
              onChange={e => setChunkDuration(e.target.value)} 
              className="w-20 bg-secondary rounded text-foreground text-center focus:outline-none py-1" 
              placeholder="60" 
            />
          </div>
        </div>
      )}

      {/* AI Persona Cascading Dropdowns for Short Mode */}
      {mode === 'short' && (
        <div className="flex flex-col md:flex-row gap-4 mt-4 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2">
          
          {/* 1st Dropdown: Main Niche */}
          <div className="flex-1 glass-card p-2">
            <select 
              className="w-full bg-transparent text-foreground text-sm focus:outline-none cursor-pointer px-2"
              value={niche}
              onChange={(e) => {
                setNiche(e.target.value as NicheKey);
                setSubNiche(""); // Reset sub-niche when main niche changes
              }}
            >
              <option value="" disabled>Select Target Niche (Optional)</option>
              {Object.keys(NICHE_DATA).map((n) => (
                <option key={n} value={n} className="bg-background">{n}</option>
              ))}
            </select>
          </div>

          {/* 2nd Dropdown: Sub Niche (Only shows if a main niche is selected) */}
          {niche && (
            <div className="flex-1 glass-card p-2 animate-in fade-in">
              <select 
                className="w-full bg-transparent text-foreground text-sm focus:outline-none cursor-pointer px-2"
                value={subNiche}
                onChange={(e) => setSubNiche(e.target.value)}
              >
                <option value="" disabled>Select Specific Topic</option>
                {NICHE_DATA[niche as NicheKey].map((sub) => (
                  <option key={sub} value={sub} className="bg-background">{sub}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Custom Text Box (Only shows if Sub Niche is "Other") */}
      {mode === 'short' && subNiche === 'Other' && (
        <div className="mt-4 max-w-2xl mx-auto glass-card p-2 animate-in fade-in slide-in-from-top-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe your channel's vibe (e.g. Sarcastic tech reviews for programmers)"
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground px-4 py-2 text-sm focus:outline-none"
          />
        </div>
      )}
    </section>
  );
};

export default HeroInput;