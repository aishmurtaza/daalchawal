"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Store, 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  ShoppingBag, 
  RefreshCw, 
  Phone, 
  MapPin, 
  CheckCircle, 
  Copy, 
  ExternalLink, 
  Send, 
  ChefHat, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  UtensilsCrossed,
  Volume2,
  BellRing,
  Navigation
} from "lucide-react";

type OrderStatus = "NEW" | "PREPARING" | "DELIVERING" | "COMPLETED" | "CANCELLED";

interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  items: string[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  lat?: number | null;
  lng?: number | null;
  riderLat?: number | null;
  riderLng?: number | null;
  riderLastUpdated?: string | null;
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  customer?: {
    name: string | null;
    phone: string;
  } | null;
}

interface Tenant {
  id: string;
  businessName: string;
  slug: string;
  currency: string;
  primaryColor: string;
}

export default function AutomationDashboard() {
  const [activeTab, setActiveTab] = useState<"onboarding" | "dashboard" | "customers" | "chats">("dashboard");

  // Fixed to match your database tenant ID seed
  const tenantId = "daal-chaawal-tenant-id";
  const [origin, setOrigin] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Sound alert state
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [prevNewCount, setPrevNewCount] = useState(0);

  const [customerSearch, setCustomerSearch] = useState("");

  const [simPhone, setSimPhone] = useState("03001234567");
  const [simName, setSimName] = useState("Hamza");
  const [simMessage, setSimMessage] = useState("Salam! Kya special daal chawal aur biryani mil jaye gi?");
  const [simLoading, setSimLoading] = useState(false);
  const [simReply, setSimReply] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const playKitchenChime = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 1.0;
      audio.play().catch((err) => {
        console.log("Audio play blocked by browser:", err);
      });
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  const enableSoundAlerts = () => {
    setSoundEnabled(true);
    playKitchenChime();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/webhook/${tenantId}`);
      const data = await res.json();
      if (data.success) {
        if (data.tenant) setTenant(data.tenant);
        if (data.orders) {
          const incomingOrders: Order[] = data.orders;
          const currentNewCount = incomingOrders.filter(o => o.status === "NEW").length;
          
          if (currentNewCount > prevNewCount && prevNewCount !== 0 && soundEnabled) {
            playKitchenChime();
          }
          setPrevNewCount(currentNewCount);
          setOrders(incomingOrders);
        }
        if (data.customers) setCustomers(data.customers);
        if (data.chats) setChats(data.chats);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, prevNewCount, soundEnabled]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch(`/api/webhook/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
        );
      }
    } catch (err) {
      console.error("Failed to update order status:", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSimulateWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim() || !simPhone.trim()) return;

    try {
      setSimLoading(true);
      setSimReply(null);
      const res = await fetch(`/api/webhook/whatsapp/${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: simPhone.trim(),
          customerName: simName.trim(),
          message: simMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimReply(data.reply);
        setSimMessage("");
        fetchData();
      } else {
        alert(data.error || "Simulation failed");
      }
    } catch (err) {
      console.error("Simulator error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const newOrdersCount = orders.filter((o) => o.status === "NEW").length;
  const preparingOrdersCount = orders.filter((o) => o.status === "PREPARING").length;
  const deliveringOrdersCount = orders.filter((o) => o.status === "DELIVERING").length;
  const completedOrdersCount = orders.filter((o) => o.status === "COMPLETED").length;

  const whatsappWebhookUrl = `${origin}/api/webhook/whatsapp/${tenantId}`;
  const storefrontUrl = `${origin}/order/daal-chaawal`;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#4A3B32] flex flex-col font-sans selection:bg-[#C86D51] selection:text-white">
      
      {/* Top Navigation Bar */}
      <header className="border-b border-[#EFECE6] bg-[#FDFBF7]/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-[#5C3A21] text-[#FDFBF7] p-2.5 rounded-2xl font-black flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-5 h-5 text-[#E6A15C]" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#3A2A1D] flex items-center gap-2">
              Daal Chaawal <span className="text-[10px] uppercase bg-[#E6A15C]/15 text-[#8C4A28] border border-[#E6A15C]/30 px-2 py-0.5 rounded-full font-bold">Kitchen Gadget</span>
            </h1>
            <p className="text-xs text-[#7A6B5D]">
              {tenant?.businessName || "Daal Chaawal Express"} | Live Audio Chime Active
            </p>
          </div>
        </div>

        {!soundEnabled ? (
          <button
            onClick={enableSoundAlerts}
            className="bg-[#D9534F] hover:bg-[#C9302C] text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg animate-pulse flex items-center gap-2 transition-all"
          >
            <BellRing className="w-4 h-4" /> Click to Enable Kitchen Sound Alerts 🔊
          </button>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-emerald-600" /> Kitchen Chime Active ✓
          </div>
        )}

        <nav className="flex items-center space-x-1.5 bg-[#F4EFE6] p-1.5 rounded-2xl border border-[#E5DFD3]">
          <button
            onClick={() => setActiveTab("onboarding")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "onboarding" ? "bg-[#5C3A21] text-white shadow-md" : "text-[#7A6B5D] hover:text-[#3A2A1D] hover:bg-[#EFECE6]"
            }`}
          >
            <Store className="w-4 h-4" /> Setup
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "dashboard" ? "bg-[#5C3A21] text-white shadow-md" : "text-[#7A6B5D] hover:text-[#3A2A1D] hover:bg-[#EFECE6]"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Kitchen Orders
            {newOrdersCount > 0 && (
              <span className="bg-[#D9534F] text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-bounce">
                {newOrdersCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "customers" ? "bg-[#5C3A21] text-white shadow-md" : "text-[#7A6B5D] hover:text-[#3A2A1D] hover:bg-[#EFECE6]"
            }`}
          >
            <Users className="w-4 h-4" /> CRM Customers
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "chats" ? "bg-[#5C3A21] text-white shadow-md" : "text-[#7A6B5D] hover:text-[#3A2A1D] hover:bg-[#EFECE6]"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> AI Chat Logs
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">

        {/* 1. SETUP TAB */}
        {activeTab === "onboarding" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-[#F4EFE6] via-[#FAF6ED] to-[#FDFBF7] border border-[#E5DFD3] rounded-3xl p-6 sm:p-8 shadow-xl">
              <span className="text-[#8C4A28] font-bold text-xs tracking-wider uppercase bg-[#E6A15C]/15 px-3 py-1 rounded-full border border-[#E6A15C]/30">
                Kitchen Gadget Audio System
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-3 text-[#3A2A1D] tracking-tight">
                WhatsApp & Storefront Integration Hub
              </h2>
              <p className="text-[#7A6B5D] mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed">
                Whenever a customer places an order on your storefront or via WhatsApp, this kitchen screen chimes instantly and puts the order into Column 1.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E5DFD3] rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-[#25D366]">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#3A2A1D]">Meta WhatsApp Cloud API Webhook</h3>
                      <p className="text-[11px] text-[#7A6B5D]">Handles incoming customer chats & AI bot replies</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-[#25D366]/15 text-[#128C7E] border border-[#25D366]/30">
                    Active
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-[#7A6B5D] font-semibold block">Webhook Callback URL</label>
                  <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl p-2.5 text-xs font-mono text-[#8C4A28]">
                    <span className="truncate flex-1">{whatsappWebhookUrl}</span>
                    <button onClick={() => copyToClipboard(whatsappWebhookUrl, "wa-url")} className="p-1 hover:text-[#3A2A1D] text-[#7A6B5D]">
                      {copiedKey === "wa-url" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-[#7A6B5D] font-semibold block">Verification Token</label>
                  <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl p-2.5 text-xs font-mono text-[#3A2A1D]">
                    <span className="truncate flex-1">daalchaawal_secret</span>
                    <button onClick={() => copyToClipboard("daalchaawal_secret", "wa-token")} className="p-1 hover:text-[#3A2A1D] text-[#7A6B5D]">
                      {copiedKey === "wa-token" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E5DFD3] rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#E6A15C]/15 border border-[#E6A15C]/30 rounded-xl text-[#8C4A28]">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#3A2A1D]">Online Storefront & Webhook</h3>
                      <p className="text-[11px] text-[#7A6B5D]">Hosted dynamic menu & checkout portal</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-[#E6A15C]/15 text-[#8C4A28] border border-[#E6A15C]/30">
                    Live
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-[#7A6B5D] font-semibold block">Customer Direct Ordering URL</label>
                  <div className="flex items-center gap-2 bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl p-2.5 text-xs font-mono text-[#3A2A1D]">
                    <span className="truncate flex-1">{storefrontUrl}</span>
                    <a href="/order/daal-chaawal" target="_blank" rel="noopener noreferrer" className="p-1 hover:text-[#8C4A28] text-[#7A6B5D]">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <a
                    href="/order/daal-chaawal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#5C3A21] hover:bg-[#3A2A1D] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                  >
                    Open Live Storefront <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. KITCHEN ORDERS KANBAN BOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#3A2A1D]">Live Kitchen Kanban Board</h2>
                <p className="text-xs text-[#7A6B5D]">Real-time status transitions across the kitchen & delivery lifecycle</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={playKitchenChime}
                  className="bg-[#E6A15C]/20 border border-[#E6A15C]/40 text-[#8C4A28] hover:bg-[#E6A15C]/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Test Chime
                </button>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="bg-white border border-[#E5DFD3] text-[#4A3B32] hover:text-[#3A2A1D] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-[#F4EFE6] transition-all shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Orders
                </button>
              </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              
              {/* Column 1: NEW */}
              <div className="bg-white/80 border border-[#E5DFD3] rounded-2xl p-4 flex flex-col min-h-[500px] shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D9534F] animate-ping" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#D9534F]">1. New Orders</h3>
                  </div>
                  <span className="bg-[#D9534F]/10 text-[#D9534F] border border-[#D9534F]/20 text-xs px-2 py-0.5 rounded-full font-bold">
                    {newOrdersCount}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {orders.filter((o) => o.status === "NEW").map((order) => (
                    <div key={order.id} className="bg-[#FDFBF7] border border-[#E5DFD3] hover:border-[#D9534F]/50 rounded-xl p-4 space-y-3 shadow-sm transition-all animate-pulse">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#3A2A1D] text-sm">{order.customerName}</p>
                          <p className="text-xs text-[#7A6B5D] font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#A89F91]" /> {order.phone}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#8C4A28] bg-white px-2 py-1 rounded-md border border-[#E5DFD3]">
                          PKR {order.total}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-[#EFECE6] space-y-1">
                        <p className="text-xs font-semibold text-[#4A3B32]">
                          {order.items.join(" • ")}
                        </p>
                      </div>

                      {order.lat && order.lng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1.5 font-medium bg-blue-50/50 border border-blue-100 p-2 rounded-lg transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">📍 {order.address} (Open Map)</span>
                          <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                        </a>
                      ) : (
                        <p className="text-[11px] text-[#7A6B5D] flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-[#A89F91] shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </p>
                      )}

                      <div className="pt-2 flex items-center gap-2 border-t border-[#EFECE6]">
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, "PREPARING")}
                          className="flex-1 bg-[#E6A15C] hover:bg-[#D48F45] text-[#3A2A1D] py-2 rounded-lg text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1"
                        >
                          <ChefHat className="w-3.5 h-3.5" /> Send to Kitchen ➔
                        </button>
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, "CANCELLED")}
                          className="p-2 hover:bg-[#D9534F]/15 text-[#7A6B5D] hover:text-[#D9534F] rounded-lg transition-colors"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {newOrdersCount === 0 && (
                    <div className="h-40 flex items-center justify-center text-xs text-[#A89F91] italic">
                      No new orders pending
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: PREPARING */}
              <div className="bg-white/80 border border-[#E5DFD3] rounded-2xl p-4 flex flex-col min-h-[500px] shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E6A15C]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#8C4A28]">2. Kitchen Cooking</h3>
                  </div>
                  <span className="bg-[#E6A15C]/15 text-[#8C4A28] border border-[#E6A15C]/30 text-xs px-2 py-0.5 rounded-full font-bold">
                    {preparingOrdersCount}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {orders.filter((o) => o.status === "PREPARING").map((order) => (
                    <div key={order.id} className="bg-[#FDFBF7] border border-[#E5DFD3] hover:border-[#E6A15C]/50 rounded-xl p-4 space-y-3 shadow-sm transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#3A2A1D] text-sm">{order.customerName}</p>
                          <p className="text-xs text-[#7A6B5D] font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#A89F91]" /> {order.phone}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#8C4A28] bg-white px-2 py-1 rounded-md border border-[#E5DFD3]">
                          PKR {order.total}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-[#EFECE6] space-y-1">
                        <p className="text-xs font-semibold text-[#4A3B32]">
                          {order.items.join(" • ")}
                        </p>
                      </div>

                      {order.lat && order.lng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1.5 font-medium bg-blue-50/50 border border-blue-100 p-2 rounded-lg transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">📍 {order.address} (Open Map)</span>
                          <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                        </a>
                      ) : (
                        <p className="text-[11px] text-[#7A6B5D] flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-[#A89F91] shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </p>
                      )}

                      <div className="pt-2 border-t border-[#EFECE6]">
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, "DELIVERING")}
                          className="w-full bg-[#3B7A9E] hover:bg-[#2F627F] text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" /> Out for Delivery ➔
                        </button>
                      </div>
                    </div>
                  ))}

                  {preparingOrdersCount === 0 && (
                    <div className="h-40 flex items-center justify-center text-xs text-[#A89F91] italic">
                      Kitchen is all caught up
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: OUT FOR DELIVERY */}
              <div className="bg-white/80 border border-[#E5DFD3] rounded-2xl p-4 flex flex-col min-h-[500px] shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3B7A9E]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#3B7A9E]">3. Rider Delivering</h3>
                  </div>
                  <span className="bg-[#3B7A9E]/10 text-[#3B7A9E] border border-[#3B7A9E]/20 text-xs px-2 py-0.5 rounded-full font-bold">
                    {deliveringOrdersCount}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {orders.filter((o) => o.status === "DELIVERING").map((order) => (
                    <div key={order.id} className="bg-[#FDFBF7] border border-[#E5DFD3] hover:border-[#3B7A9E]/50 rounded-xl p-4 space-y-3 shadow-sm transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#3A2A1D] text-sm">{order.customerName}</p>
                          <p className="text-xs text-[#7A6B5D] font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#A89F91]" /> {order.phone}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#8C4A28] bg-white px-2 py-1 rounded-md border border-[#E5DFD3]">
                          PKR {order.total}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-[#EFECE6] space-y-1">
                        <p className="text-xs font-semibold text-[#4A3B32]">
                          {order.items.join(" • ")}
                        </p>
                      </div>

                      {order.lat && order.lng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1.5 font-medium bg-blue-50/50 border border-blue-100 p-2 rounded-lg transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">📍 {order.address} (Open Map)</span>
                          <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                        </a>
                      ) : (
                        <p className="text-[11px] text-[#7A6B5D] flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-[#A89F91] shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </p>
                      )}

                      {order.riderLat && order.riderLng ? (
                        <a
                          href={`https://maps.google.com/?q=${order.riderLat},${order.riderLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between bg-sky-50 border border-sky-200 text-sky-800 p-2 rounded-lg text-[11px] font-bold hover:bg-sky-100 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Navigation className="w-3.5 h-3.5 text-sky-600 animate-pulse" /> Live Rider GPS Active
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-[10px] flex items-center gap-1.5 font-medium">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" /> Waiting for rider GPS broadcast...
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#EFECE6]">
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                          className="w-full bg-[#388E3C] hover:bg-[#2E7D32] text-white py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed ✓
                        </button>
                      </div>
                    </div>
                  ))}

                  {deliveringOrdersCount === 0 && (
                    <div className="h-40 flex items-center justify-center text-xs text-[#A89F91] italic">
                      No active riders on the road
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: COMPLETED */}
              <div className="bg-white/80 border border-[#E5DFD3] rounded-2xl p-4 flex flex-col min-h-[500px] shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#388E3C]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#388E3C]">4. Completed</h3>
                  </div>
                  <span className="bg-[#388E3C]/10 text-[#388E3C] border border-[#388E3C]/20 text-xs px-2 py-0.5 rounded-full font-bold">
                    {completedOrdersCount}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {orders.filter((o) => o.status === "COMPLETED").map((order) => (
                    <div key={order.id} className="bg-[#FDFBF7] border border-[#E5DFD3] rounded-xl p-4 space-y-2 opacity-90 hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#3A2A1D] text-sm">{order.customerName}</p>
                          <p className="text-xs text-[#7A6B5D] font-mono">{order.phone}</p>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#388E3C]">
                          PKR {order.total}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A6B5D]">{order.items.join(", ")}</p>
                      
                      {order.lat && order.lng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-medium mt-1"
                        >
                          <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </a>
                      ) : (
                        <p className="text-[10px] text-[#7A6B5D] flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-[#A89F91] shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </p>
                      )}

                      <span className="inline-flex items-center gap-1 text-[10px] text-[#388E3C] font-bold bg-[#388E3C]/10 px-2 py-0.5 rounded-full border border-[#388E3C]/20 mt-1">
                        <CheckCircle className="w-3 h-3" /> Delivered
                      </span>
                    </div>
                  ))}

                  {completedOrdersCount === 0 && (
                    <div className="h-40 flex items-center justify-center text-xs text-[#A89F91] italic">
                      Completed orders will show here
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 3. CRM CUSTOMERS TAB */}
        {activeTab === "customers" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#3A2A1D]">Customer Database (CRM)</h2>
                <p className="text-xs text-[#7A6B5D]">Automatic guest profiles created from WhatsApp interactions & storefront checkouts</p>
              </div>
              <input
                type="text"
                placeholder="Search by name, phone, or address..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="bg-white border border-[#E5DFD3] rounded-xl px-4 py-2 text-xs text-[#3A2A1D] placeholder-[#A89F91] w-full sm:w-72 focus:outline-none focus:border-[#8C4A28] shadow-sm"
              />
            </div>

            <div className="bg-white border border-[#E5DFD3] rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#EFECE6] text-[#7A6B5D] bg-[#F9F7F2] uppercase text-[11px] tracking-wider">
                      <th className="p-4 font-semibold">Customer</th>
                      <th className="p-4 font-semibold">WhatsApp Phone</th>
                      <th className="p-4 font-semibold">Delivery Address</th>
                      <th className="p-4 font-semibold">Orders Count</th>
                      <th className="p-4 font-semibold">Total Revenue</th>
                      <th className="p-4 font-semibold">First Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="p-4 font-bold text-[#3A2A1D] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#E6A15C]/20 border border-[#E6A15C]/40 text-[#8C4A28] flex items-center justify-center font-bold text-xs">
                            {c.name ? c.name.charAt(0).toUpperCase() : "G"}
                          </div>
                          <span>{c.name || "Guest Customer"}</span>
                        </td>
                        <td className="p-4 font-mono text-[#8C4A28]">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#A89F91]" />
                            {c.phone}
                          </div>
                        </td>
                        <td className="p-4 text-[#4A3B32] max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#A89F91] shrink-0" />
                            <span className="truncate">{c.address || "Counter / Not provided"}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#3A2A1D]">
                          <span className="bg-[#F9F7F2] px-2 py-1 rounded-md border border-[#E5DFD3]">
                            {c.totalOrders}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#8C4A28]">
                          PKR {c.totalSpent}
                        </td>
                        <td className="p-4 text-[#7A6B5D] text-xs">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-[#A89F91] italic">
                          No customer records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. AI CHAT LOGS TAB */}
        {activeTab === "chats" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#3A2A1D]">WhatsApp Conversational History</h2>
                  <p className="text-xs text-[#7A6B5D]">Full logs of customer chats processed by Gemini Flash</p>
                </div>
                <button
                  onClick={fetchData}
                  className="bg-white border border-[#E5DFD3] text-[#4A3B32] hover:text-[#3A2A1D] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#F4EFE6] transition-all shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>

              <div className="bg-white/80 border border-[#E5DFD3] rounded-2xl p-4 sm:p-6 space-y-4 max-h-[650px] overflow-y-auto shadow-sm">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`p-4 rounded-2xl border text-xs sm:text-sm max-w-xl transition-all ${
                      chat.role === "user" ? "bg-[#F9F7F2] border-[#E5DFD3] ml-auto shadow-sm" : "bg-[#E6A15C]/15 border-[#E6A15C]/30 mr-auto shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[11px] text-[#7A6B5D] mb-1.5">
                      <span className="font-bold flex items-center gap-1 text-[#3A2A1D]">
                        {chat.role === "user" ? (
                          <>
                            <Phone className="w-3 h-3 text-[#A89F91]" />
                            {chat.customer?.name || chat.customer?.phone || "Customer"}
                          </>
                        ) : (
                          <span className="text-[#8C4A28] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI WhatsApp Agent
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px]">
                        {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#4A3B32] whitespace-pre-wrap leading-relaxed">
                      {chat.content}
                    </p>
                  </div>
                ))}

                {chats.length === 0 && (
                  <div className="py-20 text-center space-y-3">
                    <MessageSquare className="w-10 h-10 text-[#A89F91] mx-auto" />
                    <p className="text-xs text-[#7A6B5D] italic">No WhatsApp conversations recorded yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Simulator Col */}
            <div className="space-y-4">
              <div className="bg-white border border-[#E5DFD3] rounded-2xl p-5 shadow-md space-y-4 sticky top-24">
                <div className="flex items-center space-x-2 pb-3 border-b border-[#EFECE6]">
                  <div className="p-1.5 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-[#128C7E]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#3A2A1D]">AI Agent Live Simulator</h3>
                    <p className="text-[11px] text-[#7A6B5D]">Test Roman Urdu & English food ordering</p>
                  </div>
                </div>

                <form onSubmit={handleSimulateWhatsApp} className="space-y-3">
                  <div>
                    <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl px-3 py-2 text-xs text-[#3A2A1D] focus:outline-none focus:border-[#8C4A28]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">WhatsApp Phone Number</label>
                    <input
                      type="text"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl px-3 py-2 text-xs text-[#3A2A1D] font-mono focus:outline-none focus:border-[#8C4A28]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">Incoming Message (Roman Urdu / English)</label>
                    <textarea
                      rows={3}
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      placeholder="e.g. Salam, 2 plate chicken daal chawal pack kar dein gulshan bhejna hai"
                      className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl px-3 py-2 text-xs text-[#3A2A1D] placeholder-[#A89F91] focus:outline-none focus:border-[#8C4A28] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={simLoading}
                    className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-60"
                  >
                    {simLoading ? "Thinking with Gemini..." : <><Send className="w-3.5 h-3.5" /> Simulate Incoming WhatsApp</>}
                  </button>
                </form>

                {simReply && (
                  <div className="pt-3 border-t border-[#EFECE6] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#8C4A28] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Generated Reply:
                    </span>
                    <div className="bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl p-3 text-xs text-[#3A2A1D] whitespace-pre-wrap leading-relaxed">
                      {simReply}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}