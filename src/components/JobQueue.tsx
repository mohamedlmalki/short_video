import { Clock, CheckCircle2, Loader2, Download as DownloadIcon } from "lucide-react";

type JobStatus = "Queued" | "Downloading..." | "Extracting Audio..." | "Rendering Video..." | "Complete";

interface Job {
  id: number;
  title: string;
  date: string;
  status: JobStatus;
}

const jobs: Job[] = [
  { id: 1, title: "How I Built a $1M SaaS in 6 Months", date: "Feb 22, 2026", status: "Complete" },
  { id: 2, title: "The Future of AI Video Editing — Full Breakdown", date: "Feb 22, 2026", status: "Rendering Video..." },
  { id: 3, title: "10 Tips for Viral TikTok Content", date: "Feb 21, 2026", status: "Extracting Audio..." },
  { id: 4, title: "Deep Dive: React Server Components", date: "Feb 21, 2026", status: "Queued" },
];

const statusConfig: Record<JobStatus, { color: string; icon: React.ReactNode }> = {
  "Queued": {
    color: "bg-muted text-muted-foreground",
    icon: <Clock className="w-3 h-3" />,
  },
  "Downloading...": {
    color: "bg-warning/15 text-warning",
    icon: <DownloadIcon className="w-3 h-3" />,
  },
  "Extracting Audio...": {
    color: "bg-warning/15 text-warning",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  "Rendering Video...": {
    color: "bg-primary/15 text-primary",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  "Complete": {
    color: "bg-success/15 text-success",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const JobQueue = () => (
  <section className="max-w-4xl mx-auto">
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Job Queue</h2>
    <div className="space-y-2">
      {jobs.map((job) => {
        const cfg = statusConfig[job.status];
        return (
          <div key={job.id} className="glass-card-hover p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{job.date}</p>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cfg.color}`}>
              {cfg.icon}
              {job.status}
            </span>
          </div>
        );
      })}
    </div>
  </section>
);

export default JobQueue;
