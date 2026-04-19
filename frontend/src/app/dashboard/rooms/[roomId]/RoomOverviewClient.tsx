"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { roomsApi, jobsApi, type Room, type Job } from "@/lib/api";

export default function RoomOverviewClient() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
  }, [roomId]);

  async function loadData() {
    try {
      const [r, j] = await Promise.all([
        roomsApi.get(roomId),
        jobsApi.list(roomId)
      ]);
      setRoom(r);
      setJobs(j);
    } catch (err) {
      console.error("Room load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunJob() {
    setTriggering(true);
    try {
      const newJob = await jobsApi.trigger(roomId);
      router.push(`/dashboard/rooms/${roomId}/jobs/${newJob.jobId}`);
    } catch (err: any) {
      alert(err.message || "Failed to trigger job.");
    } finally {
      setTriggering(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-10 bg-sf-surface rounded w-1/3"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-sf-surface rounded-lg"></div>)}
      </div>
    </div>
  }

  if (!room) return <div>Room not found.</div>

  const lastJob = jobs[0]; // Assuming sorted by date

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{room.name}</h1>
          <span className={`badge ${room.status === 'active' ? 'badge-enterprise' : 'bg-sf-bg border border-sf-border'}`}>
             {room.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/rooms/${roomId}/setup`} className="btn-secondary text-sm">
            ⚙️ Setup
          </Link>
          <button 
             onClick={handleRunJob}
             disabled={triggering}
             className="btn-primary text-sm flex items-center gap-2"
          >
            {triggering ? "⚡ Triggering..." : "▶️ Run Job"}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4">
          <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Total Jobs</p>
          <p className="text-2xl font-bold mt-1">{jobs.length}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Pages Scraped</p>
          <p className="text-2xl font-bold mt-1">
             {jobs.reduce((acc, j) => acc + (j.pagesScraped || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Last Run</p>
          <p className="text-sm font-semibold mt-1">
             {lastJob ? new Date(lastJob.createdAt).toLocaleString() : "Never"}
          </p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">MongoDB Sync</p>
          <div className="flex items-center gap-2 mt-1">
             {room.mongodbVerified ? (
               <><span className="text-sf-success">✅</span> <span className="text-xs font-bold">Verified</span></>
             ) : (
               <><span className="text-sf-text-muted">❌</span> <span className="text-xs font-bold">Not Setup</span></>
             )}
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 space-y-6">
            <div className="glass-panel overflow-hidden">
               <div className="p-4 border-b border-sf-border bg-sf-surface-elevated/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Recent Jobs</h3>
                  <Link href={`/dashboard/rooms/${roomId}/jobs`} className="text-xs text-sf-primary hover:underline">View All</Link>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest border-b border-sf-border">
                        <tr>
                          <th className="px-6 py-3">Job ID</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Pages</th>
                          <th className="px-6 py-3">Items</th>
                          <th className="px-6 py-3">Date</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-sf-border">
                        {jobs.slice(0, 5).map(job => (
                          <tr key={job.jobId} onClick={() => router.push(`/dashboard/rooms/${roomId}/jobs/${job.jobId}`)} className="hover:bg-sf-surface/50 cursor-pointer transition-colors">
                            <td className="px-6 py-4 font-mono text-[10px]">{job.jobId.slice(0,8)}...</td>
                            <td className="px-6 py-4">
                               <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                 job.status === 'completed' ? 'bg-sf-success/10 text-sf-success' :
                                 job.status === 'failed' ? 'bg-sf-danger/10 text-sf-danger' :
                                 'bg-sf-primary/10 text-sf-primary'
                               }`}>
                                 {job.status}
                               </span>
                            </td>
                            <td className="px-6 py-4 font-semibold">{job.pagesScraped || 0}</td>
                            <td className="px-6 py-4 font-semibold">{job.itemsFound || 0}</td>
                            <td className="px-6 py-4 text-xs text-sf-text-muted">{new Date(job.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {jobs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-sf-text-muted italic text-sm">No jobs executed yet.</td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="glass-panel p-6">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Configuration</h3>
               <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-sf-text-muted uppercase">Target URL</p>
                    <p className="text-sm font-medium truncate mt-1">{room.targetUrl || "Not configured"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-sf-text-muted uppercase">Method</p>
                    <p className="text-sm font-medium mt-1 uppercase">{room.scrapingMethod}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-sf-text-muted uppercase">Provider</p>
                    <p className="text-sm font-medium mt-1 uppercase">{room.provider}</p>
                  </div>
                  {room.scheduleEnabled && (
                    <div>
                      <p className="text-[10px] font-bold text-sf-text-muted uppercase">Schedule</p>
                      <p className="text-sm font-medium mt-1">{room.scheduleCron}</p>
                    </div>
                  )}
               </div>
               <Link href={`/dashboard/rooms/${roomId}/setup`} className="btn-secondary w-full text-center text-xs mt-6 block">
                  Modify Setup
               </Link>
            </div>

            <div className="glass-panel p-6 bg-gradient-to-br from-sf-primary/10 to-transparent border-sf-primary/20">
               <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                 <span>📊</span> Quick Insight
               </h3>
               <p className="text-xs text-sf-text-muted leading-relaxed">
                 This room is currently using <strong>{room.provider}</strong>. Switching to an external API (ScrapingBee/BrightData) can help bypass anti-bot protections if you experience fails.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
