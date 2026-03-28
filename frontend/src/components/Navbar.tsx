"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles, Shield, LogOut, LogIn, Crown, Star, Heart, Menu, X } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useAuthStore } from "@/lib/authStore";
import { getMyComfortCount } from "@/lib/api";

/* Fan tier titles */
function getFanTitle(count: number): { title: string; icon: string; color: string } {
  if (count > 50) return { title: "Top supporter", icon: "✨", color: "text-pink-400" };
  if (count >= 10) return { title: "Dedicated fan", icon: "🛡️", color: "text-purple-400" };
  return { title: "New fan", icon: "🚀", color: "text-blue-400" };
}

/* Nav items */
interface NavItem {
  href: string;
  label: string;
  fanOnly?: boolean;
  idolOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/mint", label: "Mint" },
  { href: "/capsule", label: "Capsule" },
  { href: "/history", label: "Timeline" },
  { href: "/idol", label: "Idol admin", idolOnly: true },
];

export const Navbar: React.FC = () => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, role, address: authAddress, clearAuth, setPendingSwitch } = useAuthStore();
  const [myComfortCount, setMyComfortCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // MetaMask account change → switch dialog
  useEffect(() => {
    if (address && isAuthenticated) {
      setPendingSwitch(address);
    }
  }, [address]);

  // Fan comfort count for badge
  useEffect(() => {
    if (isAuthenticated && role === "fan" && authAddress) {
      getMyComfortCount(authAddress).then((r) => setMyComfortCount(r.count)).catch(() => {});
    }
  }, [isAuthenticated, role, authAddress]);

  const shortAddr = (authAddress || address)
    ? `${(authAddress || address)!.slice(0, 6)}...${(authAddress || address)!.slice(-4)}`
    : "";

  const handleLogout = () => {
    clearAuth();
    disconnect();
    router.push("/login");
  };

  // Filter nav by role
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.idolOnly && role !== "idol") return false;
    if (item.fanOnly && role === "idol") return false;
    return true;
  });

  // Active route
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const fanBadge = role === "fan" ? getFanTitle(myComfortCount) : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-lg">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span>Idol Capsule</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              const isIdol = item.idolOnly;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3.5 py-2 rounded-lg text-sm transition-all ${
                    isIdol
                      ? active
                        ? "text-yellow-300 bg-yellow-500/15 font-bold"
                        : "text-yellow-400/80 hover:text-yellow-300 hover:bg-yellow-500/10"
                      : active
                      ? "text-pink-400 bg-pink-500/10 font-bold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isIdol && <Shield className="w-3 h-3 inline mr-1 -mt-px" />}
                  {item.label}
                  {/* Active underline */}
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-px rounded-full"
                      style={{
                        background: isIdol
                          ? "linear-gradient(to right, transparent, #facc15, transparent)"
                          : "linear-gradient(to right, transparent, #f472b6, transparent)",
                        boxShadow: isIdol ? "0 2px 8px #facc1555" : "0 2px 8px #f472b655",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Role badge */}
                {role === "idol" ? (
                  <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border text-yellow-400 border-yellow-500/40 bg-yellow-500/10">
                    <Crown className="w-3 h-3" />
                    Idol account
                  </span>
                ) : fanBadge ? (
                  <span className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-white/15 bg-white/5 ${fanBadge.color}`}>
                    <span>{fanBadge.icon}</span>
                    {fanBadge.title}
                  </span>
                ) : null}

                {/* Address */}
                <span className="text-white/40 text-xs font-mono hidden lg:block">{shortAddr}</span>

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="p-2 text-white/40 hover:text-white/80 transition rounded-lg hover:bg-white/10"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-full text-sm hover:opacity-90 transition"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-white/60 hover:text-white transition"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm transition ${
                    active
                      ? "text-pink-400 bg-pink-500/10 font-bold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Mobile badge */}
            {isAuthenticated && (
              <div className="pt-2 px-4 flex items-center gap-2">
                {role === "idol" ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border text-yellow-400 border-yellow-500/40 bg-yellow-500/10">
                    <Crown className="w-3 h-3" />
                    Idol | {shortAddr}
                  </span>
                ) : fanBadge ? (
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-white/15 bg-white/5 ${fanBadge.color}`}>
                    {fanBadge.icon} {fanBadge.title} | {shortAddr}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
