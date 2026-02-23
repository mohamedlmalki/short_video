import { Film, Type, Globe } from "lucide-react";
import { useState } from "react";

const templates = ["Podcast", "Tutorial", "Talking Head"];
const captionStyles = ["Bold Yellow", "Clean White", "Gradient Pop", "Minimal"];
const languages = ["English", "Spanish", "French", "German", "Portuguese", "Japanese"];

const ConfigPanel = () => {
  const [activeTemplate, setActiveTemplate] = useState("Podcast");

  return (
    <section className="glass-card p-6 max-w-4xl mx-auto">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template Selector */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <Film className="w-4 h-4 text-primary" /> Template
          </label>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTemplate(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTemplate === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Caption Style */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <Type className="w-4 h-4 text-primary" /> Caption Style
          </label>
          <select className="w-full bg-secondary text-foreground rounded-lg px-3.5 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50">
            {captionStyles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <Globe className="w-4 h-4 text-primary" /> Language
          </label>
          <select className="w-full bg-secondary text-foreground rounded-lg px-3.5 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50">
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};

export default ConfigPanel;
