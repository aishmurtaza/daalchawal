"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useParams } from "next/navigation";
import dynamicLoader from "next/dynamic";
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle2, 
  UtensilsCrossed, 
  Plus, 
  Minus, 
  ArrowRight
} from "lucide-react";

// Dynamically import Leaflet MapPicker to prevent SSR window reference crashes
const MapPicker = dynamicLoader(() => import("@/components/MapPicker"), { ssr: false });

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface Tenant {
  id: string;
  businessName: string;
  slug: string;
  currency: string;
  primaryColor: string;
}

function StorefrontContent() {
  const params = useParams();
  const slug = (params?.slug as string) || "daal-chaawal";

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state: itemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  // Customer form state
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState<number>(33.6844);
  const [lng, setLng] = useState<number>(73.0479);

  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Fetch tenant and menu info on load
  useEffect(() => {
    async function fetchTenantMenu() {
      try {
        setLoading(true);
        const res = await fetch(`/api/webhook/${slug}`);
        const data = await res.json();
        if (data.success) {
          if (data.tenant) setTenant(data.tenant);
          if (data.menu) {
            setMenu(data.menu);
          } else {
            setMenu([
              { id: "1", name: "Special Chicken Daal Chawal", description: "Slow-cooked lentils with tender chicken chunks, served over aromatic basmati rice.", price: 350, category: "Mains" },
              { id: "2", name: "Desi Ghee Daal Chawal", description: "Traditional yellow daal tempered with garlic, cumin, and pure desi ghee.", price: 250, category: "Mains" },
              { id: "3", name: "Chicken Biryani Platter", description: "Spicy layered basmati rice with succulent chicken pieces and raita.", price: 450, category: "Specialty" },
              { id: "4", name: "Shami Kabab (2 Pcs)", description: "Crispy fried minced beef and lentil patties.", price: 120, category: "Add-ons" },
              { id: "5", name: "Kachumber Salad & Raita", description: "Freshly chopped crisp salad with mint yogurt chutney.", price: 80, category: "Sides" },
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load storefront menu:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTenantMenu();
  }, [slug]);

  const updateCart = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const updated = current + delta;
      if (updated <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: updated };
    });
  };

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menu.find((m) => m.id === itemId);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [cart, menu]);

  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }, [cart]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalItemsCount === 0) {
      alert("Please add items to your cart before checking out!");
      return;
    }
    if (!customerName || !phone) {
      alert("Please provide your name and phone number.");
      return;
    }

    try {
      setSubmitting(true);
      const itemsList = Object.entries(cart).map(([itemId, qty]) => {
        const item = menu.find((m) => m.id === itemId);
        return `${qty}x ${item ? item.name : itemId}`;
      });

      const res = await fetch(`/api/webhook/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          address: `${addressText}${lat && lng ? ` (Pin: ${lat.toFixed(4)},${lng.toFixed(4)})` : ""}`,
          items: itemsList,
          total: cartTotal,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrderPlaced(true);
        setPlacedOrderId(data.order?.id || "ORD-SUCCESS");
      } else {
        alert(data.error || "Failed to place order.");
      }
    } catch (err) {
      console.error("Checkout submission error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#5C3A21] font-bold">
        <UtensilsCrossed className="w-8 h-8 animate-bounce mr-2 text-[#E6A15C]" /> Loading Storefront Menu...
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-[#4A3B32] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E5DFD3] rounded-3xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-[#3A2A1D]">Order Placed Successfully!</h1>
          <p className="text-xs text-[#7A6B5D] leading-relaxed">
            Your order has been sent straight to the kitchen. You can track your rider once it's out for delivery!
          </p>
          <div className="bg-[#F9F7F2] p-3 rounded-xl border border-[#E5DFD3] text-xs font-mono text-[#8C4A28]">
            Order ID: {placedOrderId}
          </div>
          <button
            onClick={() => { setOrderPlaced(false); setCart({}); }}
            className="w-full bg-[#5C3A21] hover:bg-[#3A2A1D] text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md"
          >
            Place Another Order ➔
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#4A3B32] flex flex-col font-sans selection:bg-[#C86D51] selection:text-white">
      
      {/* Header */}
      <header className="border-b border-[#EFECE6] bg-[#FDFBF7]/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-[#5C3A21] text-[#FDFBF7] p-2.5 rounded-2xl font-black flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-5 h-5 text-[#E6A15C]" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#3A2A1D]">
              {tenant?.businessName || "Daal Chaawal Express"}
            </h1>
            <p className="text-xs text-[#7A6B5D]">Authentic Home-Style Food & Fast Delivery</p>
          </div>
        </div>

        <div className="bg-[#E6A15C]/15 border border-[#E6A15C]/30 text-[#8C4A28] px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm">
          <ShoppingBag className="w-4 h-4" />
          <span>{totalItemsCount} items</span>
          <span className="font-mono">| PKR {cartTotal}</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Menu Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="text-[#8C4A28] font-bold text-xs tracking-wider uppercase bg-[#E6A15C]/15 px-3 py-1 rounded-full border border-[#E6A15C]/30">
              Fresh Daily Menu
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-3 text-[#3A2A1D] tracking-tight">
              Choose Your Favorites
            </h2>
            <p className="text-xs sm:text-sm text-[#7A6B5D] mt-1">
              Select your dishes below to add them to your order.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {menu.map((dish) => {
              const qty = cart[dish.id] || 0;
              return (
                <div key={dish.id} className="bg-white border border-[#E5DFD3] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#E6A15C]/50 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-sm text-[#3A2A1D]">{dish.name}</h3>
                      <span className="font-mono font-bold text-xs text-[#8C4A28] bg-[#F9F7F2] px-2 py-1 rounded-lg border border-[#E5DFD3]">
                        PKR {dish.price}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A6B5D] leading-relaxed">{dish.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#EFECE6]">
                    <span className="text-[10px] uppercase font-bold text-[#A89F91]">{dish.category}</span>
                    {qty === 0 ? (
                      <button
                        onClick={() => updateCart(dish.id, 1)}
                        className="bg-[#5C3A21] hover:bg-[#3A2A1D] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to Order
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-[#F4EFE6] border border-[#E5DFD3] p-1 rounded-xl">
                        <button
                          onClick={() => updateCart(dish.id, -1)}
                          className="p-1 hover:bg-white rounded-lg text-[#7A6B5D] transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2 text-[#3A2A1D]">{qty}</span>
                        <button
                          onClick={() => updateCart(dish.id, 1)}
                          className="p-1 hover:bg-white rounded-lg text-[#7A6B5D] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Checkout & Map Pin Form */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DFD3] rounded-3xl p-6 shadow-md space-y-6 sticky top-24">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-[#EFECE6]">
              <div className="p-2 bg-[#E6A15C]/15 border border-[#E6A15C]/30 rounded-xl text-[#8C4A28]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#3A2A1D]">Complete Checkout</h3>
                <p className="text-[11px] text-[#7A6B5D]">Pin your location for exact rider delivery</p>
              </div>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">Your Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A89F91] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ali Ahmed"
                    className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl pl-9 pr-3 py-2 text-xs text-[#3A2A1D] placeholder-[#A89F91] focus:outline-none focus:border-[#8C4A28]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">Phone Number (WhatsApp)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#A89F91] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 03001234567"
                    className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl pl-9 pr-3 py-2 text-xs text-[#3A2A1D] font-mono placeholder-[#A89F91] focus:outline-none focus:border-[#8C4A28]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#7A6B5D] font-semibold block mb-1">Street Address / Landmark</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#A89F91] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={addressText}
                    onChange={(e) => setAddressText(e.target.value)}
                    placeholder="e.g. House 42, Street 3, Gulshan"
                    className="w-full bg-[#F9F7F2] border border-[#E5DFD3] rounded-xl pl-9 pr-3 py-2 text-xs text-[#3A2A1D] placeholder-[#A89F91] focus:outline-none focus:border-[#8C4A28]"
                  />
                </div>
              </div>

              {/* Exact Map Pin Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#7A6B5D] font-semibold block flex items-center justify-between">
                  <span>Pin Exact Location on Map</span>
                  {lat && lng && <span className="text-[10px] text-emerald-600 font-bold">Pin Set ✓</span>}
                </label>
                <MapPicker onSelectLocation={(latitude, longitude) => { setLat(latitude); setLng(longitude); }} />
                <p className="text-[10px] text-[#A89F91]">Click anywhere on the map to drop your exact delivery pin.</p>
              </div>

              {/* Order Summary Breakdown */}
              <div className="pt-3 border-t border-[#EFECE6] space-y-2">
                <div className="flex justify-between text-xs text-[#7A6B5D]">
                  <span>Items Count:</span>
                  <span className="font-mono font-bold text-[#3A2A1D]">{totalItemsCount}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#3A2A1D]">
                  <span>Total Amount:</span>
                  <span className="font-mono text-[#8C4A28]">PKR {cartTotal}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || totalItemsCount === 0}
                className="w-full bg-[#5C3A21] hover:bg-[#3A2A1D] text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? "Submitting Order..." : <>Place Order Now <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center font-bold text-[#5C3A21]">Loading Storefront...</div>}>
      <StorefrontContent />
    </Suspense>
  );
}