"use client";

import { useEffect, useState } from "react";
import { usersApi, billingApi, type UserProfile } from "@/lib/api";

declare var Razorpay: any;

export default function BillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    // Load Razorpay Script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function loadProfile() {
    try {
      const data = await usersApi.getMe();
      setProfile(data);
    } catch (err) {
      console.error("Billing load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: string) {
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@spiderflow.com?subject=Enterprise Plan Inquiry";
      return;
    }

    setUpgrading(plan);
    try {
      const order = await billingApi.createOrder(plan);
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_5W6xO8fLoD5k7v", // Placeholder
        amount: order.amount,
        currency: order.currency,
        name: "SpiderFlow Cloud",
        description: `Upgrade to ${plan} Plan`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            await billingApi.verifyPayment({
               ...response,
               plan
            });
            alert("Upgrade Successful!");
            loadProfile();
          } catch (err: any) {
            alert(err.message || "Payment verification failed.");
          }
        },
        prefill: {
          email: profile?.email,
        },
        theme: {
          color: "#3b82f6",
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || "Failed to initiate payment.");
    } finally {
      setUpgrading(null);
    }
  }

  if (loading) return <div className="animate-pulse h-96 bg-sf-surface rounded-xl"></div>;

  const plans = [
    {
      id: "trial",
      name: "Free Trial",
      price: "₹0",
      period: "7 days",
      features: ["1 Room", "10 Jobs / mo", "500 Pages / mo", "Internal Provider Only"],
      limits: { rooms: 1, jobs: 10, pages: 500 }
    },
    {
      id: "starter",
      name: "Starter",
      price: "₹999",
      period: "per month",
      features: ["5 Rooms", "100 Jobs / mo", "5,000 Pages / mo", "Scheduler Enabled", "MongoDB Export"],
      limits: { rooms: 5, jobs: 100, pages: 5000 }
    },
    {
      id: "pro",
      name: "Pro",
      price: "₹2,999",
      period: "per month",
      features: ["20 Rooms", "1,000 Jobs / mo", "50,000 Pages / mo", "Custom Code (Py/JS)", "Premium APIs"],
      limits: { rooms: 20, jobs: 1000, pages: 50000 }
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "₹9,999",
      period: "per month",
      features: ["Unlimited Rooms", "Unlimited Jobs", "Dedicated Fargate", "Priority Support", "SLA Guarantee"],
      limits: { rooms: Infinity, jobs: Infinity, pages: Infinity }
    },
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Billing & Subscriptions</h1>
        <p className="text-sf-text-muted mt-2">Scalable plans for developers and businesses of all sizes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrent = profile?.plan === plan.id;
          return (
            <div 
              key={plan.id} 
              className={`glass-panel p-8 flex flex-col justify-between border-2 transition-all ${
                isCurrent ? 'border-sf-primary ring-4 ring-sf-primary/10 bg-sf-primary/5 shadow-2xl' : 'border-sf-border'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {isCurrent && <span className="badge badge-enterprise">Current</span>}
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-xs text-sf-text-muted ml-2">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="text-sm flex items-center gap-2">
                      <span className="text-sf-success">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {isCurrent ? (
                <div className="pt-6 border-t border-sf-border/50">
                  <p className="text-[10px] font-bold text-sf-text-muted uppercase mb-1">Active Usage</p>
                   <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[8px] mb-1">
                          <span>Jobs: {profile.jobsUsedThisMonth} / {plan.limits.jobs}</span>
                        </div>
                        <div className="h-1 bg-sf-bg rounded-full overflow-hidden">
                           <div className="h-full bg-sf-primary" style={{ width: `${(profile.jobsUsedThisMonth / (plan.limits.jobs || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[8px] mb-1">
                          <span>Pages: {profile.pagesScrapedThisMonth} / {plan.limits.pages}</span>
                        </div>
                        <div className="h-1 bg-sf-bg rounded-full overflow-hidden">
                           <div className="h-full bg-sf-accent" style={{ width: `${(profile.pagesScrapedThisMonth / (plan.limits.pages || 1)) * 100}%` }} />
                        </div>
                      </div>
                   </div>
                </div>
              ) : (
                <button 
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading !== null}
                  className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${
                    plan.id === 'enterprise' ? 'btn-secondary' : 'btn-primary'
                  }`}
                >
                  {upgrading === plan.id ? "Processing..." : plan.id === 'enterprise' ? "Contact Sales" : "Upgrade Plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ / Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
         <div className="glass-panel p-6">
            <h4 className="font-bold flex items-center gap-2 mb-2">
              <span>💳</span> Secure Payments
            </h4>
            <p className="text-xs text-sf-text-muted">
              Payments are handled securely via Razorpay. We do not store your credit card information on our servers.
            </p>
         </div>
         <div className="glass-panel p-6">
            <h4 className="font-bold flex items-center gap-2 mb-2">
              <span>🔄</span> Usage Resets
            </h4>
            <p className="text-xs text-sf-text-muted">
              Monthly quotas reset on the 1st of every month at 00:00 UTC. Unused quota does not roll over.
            </p>
         </div>
      </div>
    </div>
  );
}
