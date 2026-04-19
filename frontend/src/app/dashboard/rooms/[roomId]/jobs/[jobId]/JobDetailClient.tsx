"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { roomsApi, jobsApi, type Room, type Job } from "@/lib/api";

export default function JobDetailClient() {
  const { roomId, jobId } = useParams() as { roomId: string, jobId: string };
  const [room, setRoom] = useState<Room | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Poll for logs if running
    let interval: any;
    if (job?.status === 'running' || job?.status === 'pending') {
      interval = setInterval(loadData, 3000);
    }
    return () => clearInterval(interval);
  }, [roomId, jobId, job?.status]);

  async function loadData() {
    try {
      const [r, j] = await Promise.all([
        roomsApi.get(roomId),
        jobsApi.get(roomId, jobId)
      ]);
      setRoom(r);
      setJob(j);
    } catch (err) {
      console.error("Job detail load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="animate-pulse h-96 bg-sf-surface rounded-xl"></div>;
  if (!room || !job) return <div>Job not found.</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
           <Link href={`/dashboard/rooms/${roomId}/jobs`} className="text-xs font-bold text-sf-primary hover:underline mb-2 block">
            ← History
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-4">
             Job <span className="text-sf-text-muted font-mono text-xl">#{jobId.slice(0, 8)}</span>
          </h1>
        </div>
        <div className={`badge ${
           job.status === 'completed' ? 'badge-enterprise' : 
           job.status === 'failed' ? 'badge-trial' : 'badge-pro'
        }`}>
           {job.status}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Execution Logs</h3>
               <div className="bg-sf-bg rounded-lg p-4 font-mono text-[11px] h-[500px] overflow-y-auto border border-sf-border space-y-1">
                  {job.logs?.map((log, i) => (
                    <div key={i} className="flex gap-4">
                       <span className="text-sf-text-muted opacity-30 select-none">{i+1}</span>
                       <span className={log.includes("ERROR") || log.includes("FAILED") ? "text-sf-danger" : "text-sf-text"}>
                          {log}
                       </span>
                    </div>
                  ))}
                  {(!job.logs || job.logs.length === 0) && (
                    <div className="text-sf-text-muted italic opacity-50">Waiting for logs...</div>
                  )}
                  {(job.status === 'running' || job.status === 'pending') && (
                    <div className="animate-pulse text-sf-primary font-bold">● Streaming...</div>
                  )}
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="glass-panel p-6">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Job Info</h3>
               <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Metadata</p>
                    <div className="mt-2 space-y-2">
                       <div className="flex justify-between">
                          <span className="text-xs text-sf-text-muted">Pages</span>
                          <span className="text-xs font-bold">{job.pagesScraped || 0}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-xs text-sf-text-muted">Items</span>
                          <span className="text-xs font-bold">{job.itemsFound || 0}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-xs text-sf-text-muted">Provider</span>
                          <span className="text-xs font-bold uppercase">{job.provider || 'internal'}</span>
                       </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-sf-border">
                    <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Timeline</p>
                    <div className="mt-2 space-y-2 text-[10px]">
                       <div className="flex justify-between">
                          <span>Created</span>
                          <span className="text-sf-text-muted font-mono">{new Date(job.createdAt).toLocaleString()}</span>
                       </div>
                       {job.completedAt && (
                         <div className="flex justify-between">
                            <span>Finished</span>
                            <span className="text-sf-text-muted font-mono">{new Date(job.completedAt).toLocaleString()}</span>
                         </div>
                       )}
                    </div>
                  </div>
               </div>
            </div>

            {job.status === 'completed' && (
              <div className="glass-panel p-6 bg-gradient-to-br from-sf-success/10 to-transparent border-sf-success/20">
                 <h4 className="text-sm font-bold uppercase tracking-widest mb-4">Export Result</h4>
                 <button className="btn-primary w-full text-xs py-2 bg-sf-surface-elevated text-sf-text hover:bg-sf-surface">
                    📥 Download JSON
                 </button>
                 <button className="btn-secondary w-full text-xs py-2 mt-2">
                    📄 View Raw Data
                 </button>
              </div>
            )}

            {job.status === 'failed' && (
               <div className="glass-panel p-6 bg-sf-danger/5 border-sf-danger/20">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-sf-danger mb-2">Error Detail</h4>
                  <p className="text-[10px] bg-sf-bg p-2 rounded font-mono break-all border border-sf-danger/10">
                     {job.errorMessage || "Unknown error occurred during execution."}
                  </p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
