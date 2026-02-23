import { Play, Download, TrendingUp } from "lucide-react";

interface Clip {
  id: number;
  title: string;
  viralScore: number;
  duration: string;
}

const clips: Clip[] = [
  { id: 1, title: '"The secret nobody talks about..."', viralScore: 96, duration: "0:58" },
  { id: 2, title: '"This changed everything for me"', viralScore: 92, duration: "0:44" },
  { id: 3, title: '"You won\'t believe the results"', viralScore: 88, duration: "1:12" },
  { id: 4, title: '"Here\'s what I learned"', viralScore: 84, duration: "0:37" },
];

const scoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 80) return "text-primary";
  return "text-warning";
};

const ResultsPreview = () => (
  <section className="max-w-4xl mx-auto">
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
      Generated Clips — <span className="text-foreground">How I Built a $1M SaaS in 6 Months</span>
    </h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {clips.map((clip) => (
        <div key={clip.id} className="glass-card-hover group overflow-hidden">
          {/* 9:16 Thumbnail */}
          <div className="relative aspect-[9/16] bg-secondary rounded-t-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-primary/30">
                <Play className="w-5 h-5 text-primary fill-primary" />
              </div>
            </div>
            <span className="absolute top-2 right-2 bg-background/70 backdrop-blur-sm text-xs text-foreground px-2 py-0.5 rounded-md font-mono">
              {clip.duration}
            </span>
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{clip.title}</p>
            </div>
          </div>
          {/* Info */}
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className={`w-3.5 h-3.5 ${scoreColor(clip.viralScore)}`} />
              <span className={`text-sm font-semibold ${scoreColor(clip.viralScore)}`}>{clip.viralScore}</span>
              <span className="text-xs text-muted-foreground">/100 Viral Score</span>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium py-2 rounded-lg transition-colors">
                <Play className="w-3 h-3" /> Preview
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium py-2 rounded-lg transition-colors">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default ResultsPreview;
