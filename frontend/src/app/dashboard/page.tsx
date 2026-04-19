"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { roomsApi, usersApi, type Room, type UserProfile } from "@/lib/api";

export default function DashboardOverview() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [p, r] = await Promise.all([usersApi.getMe(), roomsApi.list()]);
      setProfile(p);
      setRooms(r);
    } catch (err) {
      console.error("Overview load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
     return <div className="animate-pulse space-y-4">
       <div className="h-8 bg-sf-surface rounded w-1/4"></div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[1,2,3].map(i => <div key={i} className="h-32 bg-sf-surface rounded-xl"></div>)}
       </div>
     </div>
  }

  const stats = [
    { label: "Active Rooms", value: rooms.length, limit: profile?.roomLimit, icon: "🏢", color: "text-sf-primary" },
    { label: "Jobs This Month", value: profile?.jobsUsedThisMonth || 0, limit: profile?.jobLimit, icon: "⚡", color: "text-sf-accent" },
    { label: "Pages Scraped", value: profile?.pagesScrapedThisMonth || 0, limit: profile?.pageLimit, icon: "📄", color: "text-sf-success" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Good morning, Agent</h1>
          <p className="text-sf-text-muted mt-1">Here is what is happening across your scraping infrastructure.</p>
        </div>
        <Link href="/dashboard/rooms/new" className="btn-primary flex items-center gap-2">
          <span>+</span> Create New Room
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-panel p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-sf-text-muted uppercase tracking-wider">{stat.label}</p>
                <p className="text-4xl font-bold mt-2">{stat.value.toLocaleString()}</p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
            
            <div className="mt-6">
               <div className="flex justify-between text-[10px] font-bold mb-1 uppercase tracking-widest text-sf-text-muted">
                 <span>Usage</span>
                 <span>{stat.limit === Infinity ? 'Unlimited' : `${Math.round((stat.value / (stat.limit || 1)) * 100)}%`}</span>
               </div>
               <div className="h-1.5 bg-sf-bg rounded-full overflow-hidden">
                 <div 
                   className={`h-full ${stat.color} bg-current rounded-full transition-all duration-1000`} 
                   style={{ width: `${Math.min(100, (stat.value / (stat.limit || 1)) * 100)}%` }}
                 />
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Rooms */}
      <div>
        <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-bold">My Rooms</h3>
           <Link href="/dashboard/rooms" className="text-sm font-semibold text-sf-primary hover:underline">View All</Link>
        </div>
        
        {rooms.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <div className="w-16 h-16 bg-sf-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🕸️
            </div>
            <h4 className="font-bold">No rooms detected</h4>
            <p className="text-sf-text-muted text-sm mt-1 mb-6">Create a room to start scraping data from target websites.</p>
            <Link href="/dashboard/rooms/new" className="btn-secondary">Setup First Room</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.slice(0, 4).map((room) => (
              <Link 
                key={room.roomId} 
                href={`/dashboard/rooms/${room.roomId}`}
                className="glass-panel p-4 hover:border-sf-primary transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`status-dot ${room.status === 'active' ? 'bg-sf-success' : 'bg-sf-text-muted'}`} />
                  <span className="text-[10px] font-bold text-sf-text-muted uppercase">{room.scrapingMethod}</span>
                </div>
                <h4 className="font-bold truncate group-hover:text-sf-primary transition-colors">{room.name}</h4>
                <p className="text-[10px] text-sf-text-muted mt-1 truncate">{room.targetUrl || "No target URL"}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Plan Summary Section */}
      <div className="glass-panel p-8 bg-gradient-to-br from-sf-surface to-sf-bg">
         <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
               <h3 className="text-xl font-bold flex items-center gap-2">
                 Plan: <span className={`badge badge-${profile?.plan}`}>{profile?.planName}</span>
               </h3>
               <p className="text-sf-text-muted mt-2 text-sm max-w-xl">
                 Your subscription level determines your scraping capacity and access to advanced features like custom Python/JS code and external scraping APIs.
               </p>
               <div className="mt-6 flex gap-4">
                  <Link href="/dashboard/billing" className="btn-primary text-sm">Review Billing</Link>
                  <button className="btn-secondary text-sm">Download Invoices</button>
               </div>
            </div>
            <div className="w-full md:w-64 space-y-4">
               <div className="p-4 bg-sf-bg/50 rounded-xl border border-sf-border">
                  <p className="text-[10px] font-bold text-sf-text-muted uppercase">Trial Clock</p>
                  <p className="text-2xl font-bold mt-1 text-sf-warning">
                    {profile?.trialDaysRemaining || 0} <span className="text-xs">Days Left</span>
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
