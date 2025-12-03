import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Home, 
  Wrench, 
  ShoppingBag, 
  ClipboardList, 
  Settings,
  Search,
  LayoutGrid,
  LifeBuoy,
  LogOut
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
      <aside className="w-72 bg-emerald-800 text-white flex flex-col fixed h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-emerald-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CityConnect</h1>
              <p className="text-xs text-emerald-200">VGC</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-300" />
            <Input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-emerald-700/50 border-emerald-600 text-white placeholder:text-emerald-300 focus:bg-emerald-700"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <Link href="/resident">
            <button className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/resident') ? 'bg-emerald-700' : 'hover:bg-emerald-700/50'
            }`}>
              <LayoutGrid className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </button>
          </Link>

          <Link href="/book-artisan">
            <button className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/book-artisan') ? 'bg-emerald-600' : 'hover:bg-emerald-700/50'
            }`}>
              <Wrench className="w-5 h-5" />
              <span className="font-medium">Book a Service</span>
            </button>
          </Link>

          <Link href="/book-market-run">
            <button className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/book-market-run') ? 'bg-emerald-600' : 'hover:bg-emerald-700/50'
            }`}>
              <ShoppingBag className="w-5 h-5" />
              <span className="font-medium">Marketplace</span>
            </button>
          </Link>

          <Link href="/track-orders">
            <button className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/track-orders') ? 'bg-emerald-600' : 'hover:bg-emerald-700/50'
            }`}>
              <ClipboardList className="w-5 h-5" />
              <span className="font-medium">Orders</span>
            </button>
          </Link>

          <div className="pt-6">
            <p className="px-4 text-xs text-emerald-300 uppercase tracking-wider mb-2">Account</p>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-emerald-700/50 transition-colors">
              <LifeBuoy className="w-5 h-5" />
              <span className="font-medium">Support</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-emerald-700/50 transition-colors">
              <Settings className="w-5 h-5" />
              <span className="font-medium">Settings</span>
            </button>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-emerald-700">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src="" alt={user?.name} />
              <AvatarFallback className="bg-emerald-600 text-white">
                {user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Olivia Rhye'}</p>
              <p className="text-xs text-emerald-300 truncate">{user?.email || 'olivia@untitledui.com'}</p>
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
