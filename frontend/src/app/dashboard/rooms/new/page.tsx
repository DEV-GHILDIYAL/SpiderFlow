"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { roomsApi } from "@/lib/api";

export default function NewRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    setError("");

    try {
      const room = await roomsApi.create(name);
      router.push(`/dashboard/rooms/${room.roomId}/setup`);
    } catch (err: any) {
      setError(err.message || "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 animate-fadeIn">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-sf-primary/20 text-sf-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
          +
        </div>
        <h1 className="text-3xl font-bold">Initialize Room</h1>
        <p className="text-sf-text-muted mt-2">Pick a name for your workspace. You can configure target URLs and selectors in the next step.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-8 space-y-6">
        {error && (
          <div className="p-3 bg-sf-danger/10 border border-sf-danger/20 text-sf-danger text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Room Name</label>
          <input
            type="text"
            placeholder="e.g. Amazon Electronics Scraper"
            className="input-field py-3 text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button 
           type="submit" 
           disabled={loading || !name} 
           className="btn-primary w-full py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-50"
        >
          {loading ? "Initializing..." : "Create Room"}
        </button>

        <Link href="/dashboard/rooms" className="block text-center text-xs font-semibold text-sf-text-muted hover:text-sf-text">
          Cancel & Go Back
        </Link>
      </form>
    </div>
  );
}
