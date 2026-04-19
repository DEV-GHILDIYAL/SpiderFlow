"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { roomsApi, usersApi, type Room, type UserProfile } from "@/lib/api";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [roomsData, profileData] = await Promise.all([
        roomsApi.list(),
        usersApi.getMe()
      ]);
      setRooms(roomsData);
      setProfile(profileData);
    } catch (err) {
      console.error("Sidebar load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/billing", label: "Billing & Plans", icon: "💎" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 border-r border-sf-border bg-sf-surface h-screen flex flex-col fixed left-0 top-0 overflow-y-auto">
      {/* Brand */}
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-sf-primary to-sf-accent bg-clip-text text-transparent">
          SpiderFlow
        </h1>
        <p className="text-[10px] text-sf-text-muted uppercase tracking-widest mt-1">
          Cloud Scraper SaaS
        </p>
      </div>

      {/* User Info */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 p-3 glass-panel border-none bg-sf-bg">
          <div className="w-10 h-10 rounded-full bg-sf-primary/20 flex items-center justify-center text-sf-primary font-bold">
            {user?.email?.[0].toUpperCase() || "U"}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{user?.email || "User"}</p>
            {profile && (
              <span className={`badge badge-${profile.plan} text-[10px]`}>
                {profile.planName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 px-3 space-y-6">
        {/* Main Nav */}
        <div>
          <p className="px-3 text-[10px] font-bold text-sf-text-muted uppercase mb-2">Main Menu</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${pathname === item.href ? "active" : ""}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* My Rooms */}
        <div>
          <div className="px-3 flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-sf-text-muted uppercase">My Rooms</p>
            <Link
              href="/dashboard/rooms/new"
              className="w-5 h-5 flex items-center justify-center bg-sf-primary text-white rounded text-xs hover:opacity-80 transition-opacity"
            >
              +
            </Link>
          </div>
          <div className="space-y-1">
            {loading ? (
               <div className="px-3 py-2 text-xs text-sf-text-muted animate-pulse">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="px-3 py-2 text-xs text-sf-text-muted italic">No rooms created</div>
            ) : (
              rooms.map((room) => (
                <Link
                  key={room.roomId}
                  href={`/dashboard/rooms/${room.roomId}`}
                  className={`sidebar-item text-xs ${pathname.includes(room.roomId) ? "active" : ""}`}
                >
                  <div className={`status-dot ${room.status === 'active' ? 'bg-sf-success' : 'bg-slate-500'}`} />
                  <span className="truncate">{room.name}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sf-border space-y-3">
        {profile?.plan === 'trial' && (
          <div className="p-3 bg-sf-warning/10 border border-sf-warning/20 rounded-lg">
            <p className="text-[10px] font-bold text-sf-warning uppercase mb-1">Trial Active</p>
            <div className="flex items-center justify-between">
               <span className="text-xs font-semibold">{profile.trialDaysRemaining} days left</span>
               <Link href="/dashboard/billing" className="text-[10px] text-sf-warning underline font-bold">Upgrade</Link>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="sidebar-item w-full text-sf-danger hover:bg-sf-danger/10"
        >
          <span>🚪</span>
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
