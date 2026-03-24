import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Home, 
  ShoppingBag, 
  ClipboardList, 
  Settings,
  Search,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  ListChecks,
} from "lucide-react";
import { useState } from "react";

interface ResidentLayoutProps {
  title: React.ReactNode;
  children: React.ReactNode;
}

export function ResidentLayout({ title, children }: ResidentLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/");
  };

  const isActive = (path: string) => location === path;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar - Green */}
      <aside className="w-72 bg-emerald-900 text-white flex flex-col fixed h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-emerald-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-700 rounded-md flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">CityConnect</h1>
              <p className="text-xs text-emerald-300">VGC</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-200" />
            <Input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-3 bg-emerald-800/60 border-0 text-white placeholder:text-emerald-300 rounded-full h-10"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-2">
          {/** Dashboard */}
          <Link href="/resident">
            <a
              className={`group flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive("/resident")
                  ? "bg-emerald-700 shadow-md"
                  : "hover:bg-emerald-800/50"
              }`}
            >
              <span
                className={`inline-block w-1 h-8 rounded-r-md mr-3 ${
                  isActive("/resident") ? "bg-emerald-500" : "bg-transparent"
                }`}
              />
              <LayoutGrid className="w-5 h-5 text-white" />
              <span className="font-medium">Dashboard</span>
            </a>
          </Link>

          <Link href="/book-market-run">
            <a
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive("/book-market-run") ? "bg-emerald-700/80" : "hover:bg-emerald-800/50"
              }`}
            >
              <ShoppingBag className="w-5 h-5 text-white" />
              <span className="font-medium">Marketplace</span>
            </a>
          </Link>

          <Link href="/track-orders">
            <a
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive("/track-orders") ? "bg-emerald-700/80" : "hover:bg-emerald-800/50"
              }`}
            >
              <ClipboardList className="w-5 h-5 text-white" />
              <span className="font-medium">Orders</span>
            </a>
          </Link>

          <div className="mt-6 pt-6 border-t border-emerald-800">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-emerald-800/50 transition-colors">
              <LifeBuoy className="w-5 h-5 text-white" />
              <span className="font-medium">Support</span>
            </button>
            <Link href="/settings">
              <a className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-emerald-800/50 transition-colors">
                <Settings className="w-5 h-5 text-white" />
                <span className="font-medium">Settings</span>
              </a>
            </Link>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-emerald-800 mt-auto">
          <div className="flex items-center space-x-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src="" alt={user?.name} />
              <AvatarFallback className="bg-emerald-600 text-white">{user?.name?.charAt(0) || "O"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "Olivia Rhye"}</p>
              <p className="text-xs text-emerald-300 truncate">{user?.email || "olivia@untitledui.com"}</p>
            </div>
            <button onClick={handleLogout} className="text-emerald-300 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72">
        {/* Header with Action Buttons */}
        <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
        </header>

        <div className="p-12 space-y-6 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  )
}
