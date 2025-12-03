import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Wrench,
  MoreVertical,
  ArrowUp,
  CheckCircle2,
  CalendarDays,
  Zap,
  EllipsisVertical,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ResidentLayout } from "@/components/resident/ResidentLayout";

export default function ResidentDashboard() {
  const { user } = useAuth();

  const { data: serviceRequests = [] } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  // Type the service requests properly
  const typedServiceRequests = (serviceRequests as any[]) || [];

  const stats = {
    maintenanceSchedule: 0,
    activeContracts:
      typedServiceRequests.filter((r) =>
        ["pending", "assigned", "in_progress"].includes(r.status)
      ).length || 0,
    completedRequests:
      typedServiceRequests.filter((r) => r.status === "completed").length || 0,
  };

  const statCards = [
    {
      key: "maintenance",
      title: "Maintenance Schedule",
      value: stats.maintenanceSchedule,
      icon: CalendarDays,
      iconBg: "bg-emerald-50 text-emerald-600",
      metaLabel: " Fridge Maintenance",
      metaValue: "₦20,000",
      button: {
        label: "Manage Subscriptions",
        href: "/book-artisan",
        variant: "solid",
      },
    },
    {
      key: "contracts",
      title: "Active Contracts",
      value: stats.activeContracts,
      icon: Zap,
      iconBg: "bg-blue-50 text-blue-600",
      trend: "20% vs last month",
      button: {
        label: "Go to Orders",
        href: "/track-orders",
        variant: "outline",
      },
    },
    {
      key: "completed",
      title: "Completed Request",
      value: stats.completedRequests,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600",
      trend: "20% vs last month",
      button: {
        label: "View Contracts",
        href: "/track-orders",
        variant: "outline",
      },
    },
  ];

  // Mock market trends data
  const marketTrendsData = [
    { month: "Jan", tuber: 600, eggs: 400, rice: 300 },
    { month: "Feb", tuber: 620, eggs: 410, rice: 310 },
    { month: "Mar", tuber: 650, eggs: 420, rice: 320 },
    { month: "Apr", tuber: 680, eggs: 430, rice: 330 },
    { month: "May", tuber: 700, eggs: 440, rice: 350 },
    { month: "Jun", tuber: 720, eggs: 450, rice: 370 },
    { month: "Jul", tuber: 750, eggs: 460, rice: 390 },
    { month: "Aug", tuber: 780, eggs: 470, rice: 410 },
    { month: "Sep", tuber: 800, eggs: 480, rice: 430 },
    { month: "Oct", tuber: 820, eggs: 490, rice: 450 },
    { month: "Nov", tuber: 850, eggs: 500, rice: 470 },
    { month: "Dec", tuber: 880, eggs: 510, rice: 490 },
  ];

  const pageTitle = (
    <div className="flex items-center justify-between  w-full">
      <div>
        <h1 className="text-3xl font-medium text-[#054F31]">
          Welcome back, {user?.name || "Olivia"}!
        </h1>
        <p className="text-base font-normal text-[#667085] mt-1">
          Track, manage and forecast your activities
        </p>
      </div>
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <Link href="/book-market-run">
            <Button
              variant="outline"
              className="border-[#027A48] text-[#027A48] bg-white font-semibold"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Buy something
            </Button>
          </Link>
          <Link href="/book-artisan">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <Wrench className="w-4 h-4 mr-2" />
              Book Repairs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <ResidentLayout title={pageTitle}>
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="rounded-3xl border border-gray-100 shadow-sm"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-medium text-[#101828]">
                      {card.title}
                    </p>
                  </div>
                  <EllipsisVertical
                    className="w-6 h-6 text-[#98A2B3]"
                    color="#98A2B3"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-semibold text-gray-900 mt-2">
                      {card.value}
                    </p>
                  </div>
                  {card.metaLabel ? (
                    <div className="flex items-center justify-between gap-4 text-sm text-gray-600">
                      <span className="text-sm text-[#667085]"> <span className="text-[#027A48] text-sm font-medium">Next:</span> {card.metaLabel}</span>
                      {card.metaValue && (
                        <span className="text-[#027A48] text-sm font-medium">
                          {card.metaValue}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${card.iconBg}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {card.button && (
                  <div className="flex items-center  justify-between my-2"  >
                    {card.trend ?
                      <div className="flex items-center text-sm text-emerald-600">
                        <ArrowUp className="w-4 h-4 mr-1" />
                        <span>{card.trend}</span>
                      </div>:<div></div>
                    }
                    <Link href={card.button.href}>
                      <Button
                        className={`w-full rounded-full ${
                          card.button.variant === "outline"
                            ? "bg-transparent border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                        variant={
                          card.button.variant === "outline"
                            ? "outline"
                            : "default"
                        }
                      >
                        {card.button.label}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service Banner and Market Trends Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Service Banner - 2 columns */}
        <Card className=" text-white overflow-hidden relative h-[301px] bg-red-200">
          <CardContent className="p-8 relative z-10 h-full">
            <div className="flex items-start justify-between">
              <div className="space-y-4 max-w-sm z-50">
                <div>
                  <p className="text-sm  mb-2">Book a service</p>
                  <h2 className="text-3xl font-bold leading-tight">
                    You don't have to break your back
                  </h2>
                </div>
                <p className="text-emerald-50 text-base">We got it covered</p>
                <Link href="/book-market-run">
                  <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Buy something
                  </Button>
                </Link>
                <div className="flex space-x-2 mt-4">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                  <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                </div>
              </div>
              <div className="absolute right-0 top-0 h-full w-full">
                <img
                  src="/dist/assets/serivice.svg"
                  alt="Service professional"
                  className="h-full w-full object-cover "
                />
              </div>
            </div>
          </CardContent>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white z-20">
            <MoreVertical className="w-5 h-5" />
          </button>
        </Card>

        {/* Market Trends - 1 column */}
        <Card className="h-[301px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Market Trends
            </CardTitle>
            <Link href="/book-market-run">
              <Button
                variant="link"
                className="text-emerald-600 hover:text-emerald-700 p-0 h-auto"
              >
                <ShoppingBag className="w-4 h-4 mr-1" />
                Go to Marketplace
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-52 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={marketTrendsData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `₦${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.5rem",
                      borderColor: "#e5e7eb",
                      fontSize: "0.875rem",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "14px", paddingTop: "10px" }}
                    iconType="circle"
                    align="right"
                    verticalAlign="top"
                  />
                  <defs>
                    <linearGradient id="colorTuber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEggs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="tuber"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTuber)"
                    name="Tuber of Yam"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="eggs"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorEggs)"
                    name="Crate of Eggs"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="rice"
                    stroke="#34d399"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRice)"
                    name="Bag of Rice"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResidentLayout>
  );
}
