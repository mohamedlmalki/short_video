import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Sparkles, ChevronDown, ChevronUp, Loader2, Trash2, Terminal, Video } from "lucide-react";

interface SavedJob {
  id: number;
  title: string;
  date: string;
  status: string;
}

const JobQueue = () => {
  const [isActive, setIsActive] = useState(false);
  const [liveMessage, setLiveMessage] = useState("Initializing AI Engine...");
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Persistent Database State
  const [pastJobs, setPastJobs] = useState<SavedJob[]>([]);
  
  const activeTitleRef = useRef("New Generated Video");
  const jobAddedRef = useRef(false);

  // 🌟 READ FROM JSON DATABASE ON STARTUP 🌟
  useEffect(() => {
    fetch('http://localhost:3000/api/jobs')
      .then(res => res.json())
      .then(data => setPastJobs(data))
      .catch(err => console.error("Failed to load history:", err));
  }, []);

  // 🌟 DELETE FROM JSON DATABASE 🌟
  const deleteJob = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/api/jobs/${id}`, { method: 'DELETE' });
      setPastJobs(prev => prev.filter(job => job.id !== id));
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  useEffect(() => {
    const handleJobUpdate = (e: any) => {
      const msg = e.detail.message;
      
      if (msg.includes("NEW JOB")) {
        setIsActive(true);
        setProgress(0);
        setLogs([]);
        setIsExpanded(true); 
        activeTitleRef.current = "Processing Video...";
        jobAddedRef.current = false;
      }

      if (msg.includes("Original Title: ")) {
        const extractedTitle = msg.split('"')[1];
        if (extractedTitle) activeTitleRef.current = extractedTitle;
      }

      setLiveMessage(msg);
      
      if (msg.trim() !== "" && !msg.includes("=======")) {
        setLogs((prev) => [...prev, msg]);
      }

      if (msg.includes("[1/7]")) setProgress(14);
      if (msg.includes("[2/7]")) setProgress(28);
      if (msg.includes("[3/7]")) setProgress(42);
      if (msg.includes("[4/7]")) setProgress(57);
      if (msg.includes("[5/7]")) setProgress(71);
      if (msg.includes("[6/7]")) setProgress(85);
      if (msg.includes("[7/7]")) setProgress(95);
      
      // 🌟 SAVE TO JSON DATABASE ON COMPLETION 🌟
      if ((msg.includes("DONE!") || msg.includes("saved!")) && !jobAddedRef.current) {
        setProgress(100);
        jobAddedRef.current = true;
        
        const newJob = {
          id: Date.now(),
          title: activeTitleRef.current,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: "Complete"
        };

        // Send to backend
        fetch('http://localhost:3000/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newJob)
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) setPastJobs(data.jobs); // Update state from server
        })
        .catch(console.error);
        
        setTimeout(() => {
          setIsActive(false);
          setIsExpanded(false);
        }, 4000); 
      }
    };

    window.addEventListener("live-job-update", handleJobUpdate);
    return () => window.removeEventListener("live-job-update", handleJobUpdate);
  }, []);

  return (
    <section className="max-w-4xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Job Queue & History
        </h2>
        {pastJobs.length > 0 && (
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md font-medium">
            {pastJobs.length} {pastJobs.length === 1 ? 'Video' : 'Videos'} Saved
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        
        {isActive && (
          <div className="relative overflow-hidden glass-card p-5 border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.15)] transition-all">
            
            <div 
              className="absolute top-0 left-0 h-1.5 bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.8)]"
              style={{ width: `${progress}%` }}
            />
            
            <div 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between gap-4 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse border border-primary/20">
                  {progress === 100 ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  )}
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">
                    {progress === 100 ? "Generation Complete!" : activeTitleRef.current}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 font-medium truncate max-w-[250px] md:max-w-md">
                    {progress === 100 ? "Saved to your database!" : liveMessage}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-lg font-black text-primary">{progress}%</span>
                <div className="text-foreground bg-secondary hover:bg-secondary/80 p-2 rounded-full transition-colors">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-6 pt-5 border-t border-border/50 animate-in slide-in-from-top-2 fade-in">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Live AI Engine Logs
                </h4>
                
                <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4 max-h-72 overflow-y-auto custom-scrollbar shadow-inner">
                  <div className="space-y-2.5">
                    {logs.map((log, idx) => {
                      const isStep = log.includes("[");
                      const isSuccess = log.includes("✅") || log.includes("🔥");
                      const isWarning = log.includes("⚠️") || log.includes("❌");
                      
                      let textStyle = "text-gray-400"; 
                      if (isStep) textStyle = "text-blue-400 font-semibold";
                      if (isSuccess) textStyle = "text-green-400 font-medium";
                      if (isWarning) textStyle = "text-red-400 font-medium";

                      return (
                        <div key={idx} className="flex items-start gap-3 text-sm font-mono tracking-tight leading-relaxed">
                          <span className="mt-0.5 opacity-50 text-gray-500 text-xs">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className={textStyle}>{log}</span>
                        </div>
                      );
                    })}
                    <div className="h-2 animate-pulse flex items-center gap-2 text-gray-500 font-mono text-xs mt-2">
                      <span className="w-2 h-4 bg-primary/70 block animate-ping"></span> Processing...
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isActive && pastJobs.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-xl bg-secondary/20">
            <Video className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium text-foreground">No videos generated yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Paste a link above to start your first job.</p>
          </div>
        )}

        {pastJobs.map((job) => (
          <div key={job.id} className="glass-card-hover p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{job.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">{job.date}</p>
                  <span className="w-1 h-1 rounded-full bg-border"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded">
                    Completed
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => deleteJob(job.id)}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors group"
              title="Delete from history"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ))}

      </div>
    </section>
  );
};

export default JobQueue;