"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { roomsApi, jobsApi, type Room, type Job } from "@/lib/api";

export default function RoomJobsClient() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error("Jobs list load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="animate-pulse h-96 bg-sf-surface rounded-xl"></div>;
  if (!room) return <div>Room not found.</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
           <Link href={`/dashboard/rooms/${roomId}`} className="text-xs font-bold text-sf-primary hover:underline mb-2 block">
            ← Back to Room
          </Link>
          <h1 className="text-3xl font-bold">Execution History</h1>
          <p className="text-sf-text-muted mt-1">All scraping jobs for {room.name}</p>
        </div>
        <button 
           onClick={async () => {
             try {
                const j = await jobsApi.trigger(roomId);
                router.push(`/dashboard/rooms/${roomId}/jobs/${j.jobId}`);
             } catch(err: any) { alert(err.message); }
           }}
           className="btn-primary"
        >
          ⚡ Run Job
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm text-left">
           <thead className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest border-b border-sf-border bg-sf-surface-elevated/30">
              <tr>
                <th className="px-6 py-4">Job ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Started</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-sf-border">
              {jobs.map(job => (
                <tr key={job.jobId} className="hover:bg-sf-surface/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[10px]">{job.jobId}</td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                       job.status === 'completed' ? 'bg-sf-success/10 text-sf-success' :
                       job.status === 'failed' ? 'bg-sf-danger/10 text-sf-danger' :
                       'bg-sf-primary/10 text-sf-primary'
                     }`}>
                       {job.status}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-xs uppercase font-semibold text-sf-text-muted">{job.provider || 'internal'}</td>
                  <td className="px-6 py-4 font-bold">{job.itemsFound || 0}</td>
                  <td className="px-6 py-4 text-xs text-sf-text-muted">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/rooms/${roomId}/jobs/${job.jobId}`} className="text-sf-primary hover:underline font-bold">
                       View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-sf-text-muted italic">
                    No jobs found for this room.
                  </td>
                </tr>
              )}
           </tbody>
        </table>
      </div>
    </div>
  );
}
