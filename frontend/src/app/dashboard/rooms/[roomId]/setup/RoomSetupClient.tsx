"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { roomsApi, usersApi, type Room, type UserProfile } from "@/lib/api";

export default function RoomSetupClient() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("target");
  const [room, setRoom] = useState<Room | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Room>>({});
  const [selectors, setSelectors] = useState<{key: string, value: string}[]>([]);

  useEffect(() => {
    loadData();
  }, [roomId]);

  async function loadData() {
    try {
      const [r, p] = await Promise.all([
        roomsApi.get(roomId),
        usersApi.getMe()
      ]);
      setRoom(r);
      setProfile(p);
      setFormData(r);
      
      // Convert selectors object to array for UI
      if (r.selectors) {
        setSelectors(Object.entries(r.selectors).map(([k, v]) => ({ key: k, value: v })));
      } else {
        setSelectors([{ key: "", value: "" }]);
      }
    } catch (err) {
      console.error("Setup load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Convert selectors back to object
      const selObj: Record<string, string> = {};
      selectors.forEach(s => { if (s.key) selObj[s.key] = s.value; });
      
      await roomsApi.update(roomId, { ...formData, selectors: selObj });
      alert("Room configuration saved successfully.");
      router.push(`/dashboard/rooms/${roomId}`);
    } catch (err: any) {
      alert(err.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyMongo() {
    setVerifying(true);
    try {
      await roomsApi.verifyMongo(roomId);
      alert("MongoDB connection verified!");
      loadData();
    } catch (err: any) {
      alert(err.message || "MongoDB verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  const addSelector = () => setSelectors([...selectors, { key: "", value: "" }]);
  const removeSelector = (index: number) => setSelectors(selectors.filter((_, i) => i !== index));
  const updateSelector = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...selectors];
    next[index][field] = val;
    setSelectors(next);
  };

  if (loading) return <div className="animate-pulse h-96 bg-sf-surface rounded-xl"></div>;
  if (!room || !profile) return <div>Data load error.</div>;

  const tabs = [
    { id: "target", label: "Target", icon: "🎯" },
    { id: "provider", label: "Provider", icon: "📦" },
    { id: "schedule", label: "Schedule", icon: "⏰" },
    { id: "mongodb", label: "MongoDB", icon: "🍃" },
  ];

  const canUseCustomCode = profile.plan === 'pro' || profile.plan === 'enterprise';
  const canUseExternalApis = profile.plan !== 'trial';
  const canUseMongo = profile.plan !== 'trial';
  const canUseScheduler = profile.plan !== 'trial';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/rooms/${roomId}`} className="text-xs font-bold text-sf-primary hover:underline mb-2 block">
            ← Back to Room
          </Link>
          <h1 className="text-3xl font-bold">Configure Room</h1>
        </div>
        <button 
           onClick={handleSave} 
           disabled={saving}
           className="btn-primary"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-sf-surface p-1 rounded-xl border border-sf-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === tab.id ? "bg-sf-surface-elevated text-sf-text shadow-sm" : "text-sf-text-muted hover:text-sf-text"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-panel p-8 min-h-[400px]">
        {/* Tab 1: Target */}
        {activeTab === "target" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6">
               <div>
                  <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Target URL / Base domain</label>
                  <input
                    type="url"
                    placeholder="https://example.com/products"
                    className="input-field"
                    value={formData.targetUrl || ""}
                    onChange={e => setFormData({...formData, targetUrl: e.target.value})}
                  />
               </div>

               <div>
                 <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Scraping Method</label>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setFormData({...formData, scrapingMethod: 'selectors'})}
                      className={`flex-1 p-4 border rounded-xl text-left transition-all ${formData.scrapingMethod === 'selectors' ? 'border-sf-primary bg-sf-primary/5' : 'border-sf-border bg-sf-bg'}`}
                    >
                       <p className="font-bold">CSS Selectors</p>
                       <p className="text-[10px] text-sf-text-muted">Extract data using CSS selectors</p>
                    </button>
                    <button 
                      disabled={!canUseCustomCode}
                      onClick={() => setFormData({...formData, scrapingMethod: 'custom_code'})}
                      className={`flex-1 p-4 border rounded-xl text-left transition-all relative ${formData.scrapingMethod === 'custom_code' ? 'border-sf-primary bg-sf-primary/5' : 'border-sf-border bg-sf-bg'} ${!canUseCustomCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                       {!canUseCustomCode && <span className="absolute top-2 right-2">🔒</span>}
                       <p className="font-bold">Custom Code</p>
                       <p className="text-[10px] text-sf-text-muted">Write raw Python or JS script</p>
                    </button>
                 </div>
               </div>
            </div>

            {formData.scrapingMethod === 'selectors' ? (
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Selector Map</label>
                {selectors.map((s, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <input 
                      placeholder="Field Name (e.g. title)" 
                      className="input-field flex-1 text-sm font-mono" 
                      value={s.key} 
                      onChange={e => updateSelector(i, 'key', e.target.value)} 
                    />
                    <input 
                      placeholder="CSS Selector (e.g. h1.title)" 
                      className="input-field flex-1 text-sm font-mono" 
                      value={s.value} 
                      onChange={e => updateSelector(i, 'value', e.target.value)} 
                    />
                    <button onClick={() => removeSelector(i)} className="text-sf-danger hover:opacity-80">🗑️</button>
                  </div>
                ))}
                <button onClick={addSelector} className="btn-secondary text-xs font-bold">+ Add Field</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest">Script Content</label>
                  <select 
                    className="bg-sf-bg border border-sf-border rounded text-[10px] py-1 px-2 uppercase font-bold"
                    value={formData.codeLanguage}
                    onChange={e => setFormData({...formData, codeLanguage: e.target.value as any})}
                  >
                    <option value="python">Python 3.12</option>
                    <option value="javascript">Node.js 20</option>
                  </select>
                </div>
                <textarea
                  className="input-field h-64 font-mono text-sm leading-relaxed"
                  placeholder={formData.codeLanguage === 'python' ? "# Write your python scraper here..." : "// Write your JS scraper here..."}
                  value={formData.customCode || ""}
                  onChange={e => setFormData({...formData, customCode: e.target.value})}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Provider */}
        {activeTab === "provider" && (
          <div className="space-y-8">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 { id: "internal", name: "Internal", desc: "Basic Scrapy/Playwright", locked: false },
                 { id: "scrapingbee", name: "ScrapingBee", desc: "Best for JS/Anti-bot", locked: !canUseExternalApis },
                 { id: "scraperapi", name: "ScraperAPI", desc: "Great for scalability", locked: !canUseExternalApis },
                 { id: "brightdata", name: "BrightData", desc: "Premium residential proxies", locked: !canUseExternalApis },
               ].map(p => (
                 <button
                   key={p.id}
                   disabled={p.locked}
                   onClick={() => setFormData({...formData, provider: p.id as any})}
                   className={`p-6 border rounded-xl text-left flex items-start gap-4 transition-all relative ${formData.provider === p.id ? 'border-sf-primary bg-sf-primary/5' : 'border-sf-border bg-sf-bg'} ${p.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   <div className="text-3xl">📦</div>
                   <div>
                     <p className="font-bold">{p.name}</p>
                     <p className="text-[10px] text-sf-text-muted mt-1">{p.desc}</p>
                   </div>
                   {p.locked && <span className="absolute top-4 right-4">🔒</span>}
                 </button>
               ))}
             </div>

             {formData.provider !== 'internal' && (
               <div className="p-6 bg-sf-bg border border-sf-border rounded-xl">
                 <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">API Key / Credentials</label>
                 <input
                   type="password"
                   placeholder="Enter your provider API key..."
                   className="input-field font-mono"
                   value={formData.providerApiKey || ""}
                   onChange={e => setFormData({...formData, providerApiKey: e.target.value})}
                 />
                 <p className="text-[10px] text-sf-text-muted mt-2 italic">Keys are encrypted using AWS KMS before storage.</p>
               </div>
             )}
          </div>
        )}

        {/* Tab 3: Schedule */}
        {activeTab === "schedule" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-6 bg-sf-bg border border-sf-border rounded-xl">
               <div>
                  <h4 className="font-bold">Recurring Scheduler</h4>
                  <p className="text-xs text-sf-text-muted">Run tasks automatically on a cron schedule.</p>
               </div>
               <div className="relative">
                  {!canUseScheduler && <span className="absolute -top-2 -right-2 z-10">🔒</span>}
                  <button 
                    disabled={!canUseScheduler}
                    onClick={() => setFormData({...formData, scheduleEnabled: !formData.scheduleEnabled})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${formData.scheduleEnabled ? 'bg-sf-success' : 'bg-sf-surface-elevated'} ${!canUseScheduler ? 'opacity-50' : ''}`}
                  >
                     <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.scheduleEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
               </div>
            </div>

            {formData.scheduleEnabled && (
               <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Cron Expression</label>
                  <input
                    placeholder="0 0 * * *"
                    className="input-field font-mono text-xl"
                    value={formData.scheduleCron || ""}
                    onChange={e => setFormData({...formData, scheduleCron: e.target.value})}
                  />
                  <div className="grid grid-cols-3 gap-4">
                     {["Every hour", "Daily at midnight", "Weekly"].map(opt => (
                        <button key={opt} className="btn-secondary text-[10px] uppercase font-bold py-2">{opt}</button>
                     ))}
                  </div>
               </div>
            )}
          </div>
        )}

        {/* Tab 4: MongoDB */}
        {activeTab === "mongodb" && (
          <div className="space-y-8">
             <div className={`space-y-6 ${!canUseMongo ? 'opacity-50 pointer-events-none' : ''}`}>
               <div>
                  <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">MongoDB URI (Connection String)</label>
                  <input
                    type="password"
                    placeholder="mongodb+srv://user:pass@cluster.mongodb.net/..."
                    className="input-field font-mono"
                    value={formData.mongodbUri || ""}
                    onChange={e => setFormData({...formData, mongodbUri: e.target.value})}
                  />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Database Name</label>
                    <input
                      placeholder="spiderflow_db"
                      className="input-field"
                      value={formData.mongodbDatabase || ""}
                      onChange={e => setFormData({...formData, mongodbDatabase: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sf-text-muted uppercase tracking-widest mb-2">Collection Name</label>
                    <input
                      placeholder="scraped_items"
                      className="input-field"
                      value={formData.mongodbCollection || ""}
                      onChange={e => setFormData({...formData, mongodbCollection: e.target.value})}
                    />
                  </div>
               </div>

               <div className="p-6 bg-sf-bg border border-sf-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full ${room.mongodbVerified ? 'bg-sf-success' : 'bg-sf-text-muted animate-pulse'}`} />
                     <p className="text-sm font-bold">{room.mongodbVerified ? "Connection Verified" : "Verification Pending"}</p>
                  </div>
                  <button 
                    onClick={handleVerifyMongo}
                    disabled={verifying}
                    className="btn-secondary text-xs"
                  >
                    {verifying ? "Testing..." : "Test Connection"}
                  </button>
               </div>
             </div>
             
             {!canUseMongo && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-sf-bg/40 backdrop-blur-[2px] rounded-xl">
                   <div className="glass-panel p-6 text-center shadow-2xl">
                      <p className="text-2xl mb-2">🔒</p>
                      <h4 className="font-bold">Enterprise Feature</h4>
                      <p className="text-xs text-sf-text-muted mb-4">Direct MongoDB export is only available on Starter plan and above.</p>
                      <Link href="/dashboard/billing" className="btn-primary text-xs">Upgrade Now</Link>
                   </div>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
