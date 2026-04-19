"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { roomsApi, type Room } from "@/lib/api";

export default function RoomsListPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const data = await roomsApi.list();
      setRooms(data);
    } catch (err) {
      console.error("Rooms list load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.targetUrl?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Scraping Rooms</h1>
          <p className="text-sf-text-muted mt-1">One room per target website domain.</p>
        </div>
        <Link href="/dashboard/rooms/new" className="btn-primary">
          Create Room
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
          <input
            type="text"
            placeholder="Search rooms by name or URL..."
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="btn-secondary flex items-center gap-2 cursor-pointer">
           <span>📶</span> Filter
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-sf-surface rounded-xl animate-pulse"></div>)}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="glass-panel p-20 text-center">
            <h4 className="text-xl font-bold">No rooms matched your search</h4>
            <p className="text-sf-text-muted mt-2">Try a different search term or create a new room.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <Link 
              key={room.roomId} 
              href={`/dashboard/rooms/${room.roomId}`}
              className="glass-panel p-6 hover:border-sf-primary transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`status-dot ${room.status === 'active' ? 'bg-sf-success' : 'bg-sf-text-muted'}`} />
                    <span className="text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">{room.status}</span>
                  </div>
                  <span className="text-xs font-mono bg-sf-bg px-2 py-1 rounded border border-sf-border group-hover:border-sf-primary transition-colors">
                    {room.scrapingMethod}
                  </span>
                </div>
                <h3 className="text-lg font-bold truncate group-hover:text-sf-primary transition-colors">{room.name}</h3>
                <p className="text-sm text-sf-text-muted mt-1 truncate">{room.targetUrl || "Target URL not set"}</p>
              </div>

              <div className="mt-8 pt-4 border-t border-sf-border flex items-center justify-between text-[11px] font-bold text-sf-text-muted uppercase tracking-widest">
                <div className="flex items-center gap-1">
                   <span>📦</span> {room.provider}
                </div>
                <div>
                   Created: {new Date(room.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
