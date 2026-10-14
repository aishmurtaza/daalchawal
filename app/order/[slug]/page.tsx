"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useParams } from "next/navigation";
import {
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  Phone,
  MapPin,
  User,
  Clock,
  Sparkles,
  ArrowRight,
  Store,
  ChefHat
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
}

interface Tenant {
  id: string;
  businessName: string;
  slug: string;
  currency: string;
  primaryColor: string;
  logoUrl?: string | null;
}

function StorefrontContent() {
  const params = useParams();
  const slug = (params?.slug as string) || "daal-chaawal";

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<{ [key: string]: { item: MenuItem; qty: number } }>({});
  
  // Checkout form fields
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlacedId, setOrderPlacedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch tenant info and menu
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/store?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTenant(data.tenant);
          setMenu(data.menu || []);
        } else {
          setErrorMsg(data.error || "Failed to load store.");
        }
      })
      .catch((err) => {
        console.error("Storefront fetch error:", err);
        setErrorMsg("Unable to connect to the restaurant store.");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menu.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["All", ...Array.from(set)];
  }, [menu]);

  // Filtered menu items
  const filteredMenu = useMemo(() => {
    if (selectedCategory === "All") return menu;
    return menu.filter((i) => i.category === selectedCategory);
  }, [menu, selectedCategory]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: { item, qty: (prev[item.id]?.qty || 0) + 1 },
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      if (!prev[itemId]) return prev;
      if (prev[itemId].qty <= 1) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], qty: prev[itemId].qty - 1 },
      };
    });
  };

  const deleteItem = (itemId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const cartArray = Object.values(cart);
  const total = cartArray.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
  const totalItemsCount = cartArray.reduce((sum, { qty }) => sum + qty, 0);

  const brandColor = tenant?.primaryColor || "#f59e0b";

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || cartArray.length === 0) return;

    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      alert("Please fill in your name, phone number, and delivery address.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/webhook/${tenant.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          items: cartArray.map((c) => `${c.qty}x ${c.item.name}`),
          total,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrderPlacedId(data.orderId || "CONFIRMED");
        setCart({});
      } else {
        setErrorMsg(data.error || "Failed to process order.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setErrorMsg("Network error occurred while submitting order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center animate-pulse">
          <ChefHat className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-sm font-medium tracking-wide">Connecting to kitchen menu...</p>
      </div>
    );
  }

  if (errorMsg && !tenant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl max-w-md">
          <p className="text-rose-400 font-bold mb-2">Store Unavailable</p>
          <p className="text-xs text-slate-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Branding Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/10 transition-transform hover:scale-105"
              style={{ backgroundColor: brandColor }}
            >
              <Store className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                  {tenant.businessName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Kitchen Open
                </span>
              </div>
              <p className="text-xs text-slate-400">Fresh Desi Meals • Direct Express Delivery</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Est. Delivery: 25-35 mins</span>
            </div>
            <div
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950"
              style={{ backgroundColor: brandColor }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{totalItemsCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* Left Column: Menu Categories & Items */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "text-slate-950 shadow-md"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
                style={
                  selectedCategory === cat
                    ? { backgroundColor: brandColor }
                    : undefined
                }
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMenu.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/5 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                      {item.name}
                    </h3>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {item.description || "Made fresh with authentic spices and ingredients."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Price</span>
                    <span className="font-mono font-bold text-base text-amber-400">
                      {tenant.currency} {item.price}
                    </span>
                  </div>

                  <button
                    onClick={() => addToCart(item)}
                    className="px-3.5 py-2 rounded-xl text-xs font-black text-slate-950 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              No menu items available in this category.
            </div>
          )}
        </div>

        {/* Right Column: Sticky Cart & Checkout */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 sm:p-6 sticky top-24 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-base text-white">Your Food Basket</h3>
              </div>
              <span className="text-xs bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-300 font-semibold">
                {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}
              </span>
            </div>

            {orderPlacedId ? (
              <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-lg text-white">Order Confirmed!</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Your order has been sent straight to the kitchen.
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-amber-400 break-all">
                  Order ID: #{orderPlacedId.slice(0, 8)}
                </div>
                <button
                  onClick={() => {
                    setOrderPlacedId(null);
                    setCustomerName("");
                    setPhone("");
                    setAddress("");
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
                >
                  Place Another Order
                </button>
              </div>
            ) : cartArray.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Your basket is currently empty.</p>
                <p className="text-[11px] text-slate-600">Add mouth-watering dishes from the menu to start checkout.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart items list */}
                <div className="divide-y divide-slate-800/80 max-h-52 overflow-y-auto pr-1 space-y-1">
                  {cartArray.map(({ item, qty }) => (
                    <div key={item.id} className="pt-2 pb-2 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 max-w-[140px] truncate">
                        <span className="font-semibold text-white block truncate">{item.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {tenant.currency} {item.price} each
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 hover:text-amber-400 text-slate-400"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold text-white font-mono">{qty}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="p-1 hover:text-amber-400 text-slate-400"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-mono font-bold text-amber-400 w-14 text-right">
                          {tenant.currency} {item.price * qty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Total */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-white">
                      {tenant.currency} {total}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Delivery</span>
                    <span className="text-emerald-400 font-bold">FREE</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex justify-between font-extrabold text-sm text-white">
                    <span>Total Bill:</span>
                    <span className="font-mono text-amber-400">
                      {tenant.currency} {total}
                    </span>
                  </div>
                </div>

                {/* Checkout Form */}
                <form onSubmit={handleCheckout} className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Your Full Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="WhatsApp Phone (e.g. 03001234567)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <textarea
                        required
                        rows={2}
                        placeholder="Delivery Address (House #, Street, Area)"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl font-black text-xs text-slate-950 shadow-xl transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ backgroundColor: brandColor }}
                  >
                    {submitting ? (
                      "Sending to Kitchen..."
                    ) : (
                      <>
                        Confirm Order ({tenant.currency} {total}) <ArrowRight className="w-4 h-4 stroke-[3]" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
          Loading Storefront...
        </div>
      }
    >
      <StorefrontContent />
    </Suspense>
  );
}