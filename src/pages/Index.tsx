import Header from "@/components/Header";
import HeroInput from "@/components/HeroInput";
import ConfigPanel from "@/components/ConfigPanel";
import JobQueue from "@/components/JobQueue";
import ResultsPreview from "@/components/ResultsPreview";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container space-y-10 pb-16">
      <HeroInput />
      <ConfigPanel />
      <JobQueue />
      <ResultsPreview />
    </main>
  </div>
);

export default Index;
