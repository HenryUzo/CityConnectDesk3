import { useLocation } from "wouter";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useProfile } from "@/contexts/ProfileContext";
import { useResidentDashboard } from "@/hooks/useResidentDashboard";
import { getQueryFn } from "@/lib/queryClient";
import cityConnectLogo from "@/assets/cityconnect-logo.svg";
import serviceCardImage from "@/assets/resident-service-card.jpg";
import promoArtisanCutout from "@/assets/resident/promo-artisan-cutout.png";
import promoLeafCluster from "@/assets/resident/promo-leaf-cluster.png";
import {
  ShoppingCart,
  Wrench,
  MoreVertical as MoreVerticalIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  Zap as ZapIcon,
  CheckCircle as CheckCircleIcon,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Leaf,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from "recharts";

// Header Section Components
function TextAndSupportingText() {
  const { firstName } = useProfile();
  
  return (
    <div
      className="content-stretch flex w-full min-w-0 flex-col gap-[4px] items-start not-italic relative shrink-0 lg:basis-0 lg:grow"
      data-name="Text and supporting text"
    >
      <p className="font-['General_Sans:Medium',sans-serif] leading-[34px] sm:leading-[38px] relative shrink-0 text-[#054f31] text-[28px] sm:text-[30px] w-full">
        Welcome back, {firstName}
      </p>
      <p className="font-['General_Sans:Regular',sans-serif] leading-[22px] sm:leading-[24px] relative shrink-0 text-[#667085] text-[15px] sm:text-[16px] w-full max-w-[320px] sm:max-w-none">
        Track, manage and forecast your activities
      </p>
    </div>
  );
}

function Basket() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Basket">
      <ShoppingCart size={20} className="text-[#039855]" />
    </div>
  );
}

function ButtonBase() {
  return (
    <div
      className="bg-white relative rounded-[8px] shrink-0 w-full sm:w-auto"
      data-name="_Button base"
    >
      <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip px-[14px] sm:px-[16px] py-[10px] relative rounded-[inherit]">
        <Basket />
        <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#027a48] text-[14px] text-nowrap">
          Buy something
        </p>
      </div>
      <div
        aria-hidden="true"
        className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
      />
    </div>
  );
}

function Button1() {
  return (
    <div
      className="content-stretch flex items-start relative rounded-[4px] shrink-0 w-full sm:w-auto"
      data-name="Button"
    >
      <ButtonBase />
    </div>
  );
}

function Tool() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="tool">
      <Wrench size={20} className="text-white" />
    </div>
  );
}

function ButtonBase2() {
  return (
    <div
      className="bg-[#039855] relative rounded-[8px] shrink-0 w-full sm:w-auto"
      data-name="_Button base"
    >
      <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip px-[14px] sm:px-[16px] py-[10px] relative rounded-[inherit]">
        <Tool />
        <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap text-white">
          Book Repairs
        </p>
      </div>
      <div
        aria-hidden="true"
        className="absolute border border-[#039855] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
      />
    </div>
  );
}

function Button2() {
  return (
    <div
      className="content-stretch flex items-start relative rounded-[4px] shrink-0 w-full sm:w-auto"
      data-name="Button"
    >
      <ButtonBase2 />
    </div>
  );
}

function Actions() {
  return (
    <div
      className="grid grid-cols-2 gap-[12px] items-center relative shrink-0 w-full sm:flex sm:w-auto"
      data-name="Actions"
    >
      <Button1 />
      <Button2 />
    </div>
  );
}

function Content() {
  return (
    <div
      className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0 w-full sm:flex-row sm:gap-[16px]"
      data-name="Content"
    >
      <TextAndSupportingText />
      <Actions />
    </div>
  );
}

function PageHeader() {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Page header"
    >
      <Content />
    </div>
  );
}

function Container() {
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Container"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col items-start px-4 sm:px-6 lg:px-[32px] py-0 relative w-full">
          <PageHeader />
        </div>
      </div>
    </div>
  );
}

function HeaderSection() {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Header section"
    >
      <Container />
    </div>
  );
}

// Metric Cards Components
function MoreVertical() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="more-vertical">
      <MoreVerticalIcon size={20} className="text-[#98A2B3]" />
    </div>
  );
}

function Dropdown() {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0"
      data-name="Dropdown"
    >
      <MoreVertical />
    </div>
  );
}

function HeadingAndDropdown({ title }: { title: string }) {
  return (
    <div
      className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full"
      data-name="Heading and dropdown"
    >
      <p className="basis-0 font-['Inter:Medium',sans-serif] font-medium grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#101828] text-[16px]">
        {title}
      </p>
      <Dropdown />
    </div>
  );
}

function ArrowUp() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="arrow-up">
      <ArrowUpIcon size={20} className="text-[#12B76A]" />
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="arrow-down">
      <ArrowDownIcon size={20} className="text-[#F04438]" />
    </div>
  );
}

function MetricCard1({ 
  count = 0, 
  nextItem = "No scheduled maintenance", 
  nextCost = null,
  onManageMaintenance,
}: { 
  count?: number; 
  nextItem?: string | null; 
  nextCost?: number | null;
  onManageMaintenance?: () => void;
}) {
  return (
    <div
      className="bg-white relative rounded-[14px] shrink-0 w-full min-w-0 lg:basis-0 lg:grow lg:rounded-[8px]"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[14px] lg:rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[18px] sm:gap-[24px] items-start p-4 sm:p-[24px] relative w-full">
          <HeadingAndDropdown title="Maintenance Schedule" />
          <div className="content-stretch flex flex-col gap-[14px] sm:gap-[16px] items-start sm:items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex flex-col gap-[10px] sm:flex-row sm:gap-[16px] sm:items-center relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[40px] sm:leading-[44px] not-italic relative shrink-0 text-[#101828] text-[34px] sm:text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <div className="content-stretch flex w-full min-w-0 flex-col gap-[4px] sm:basis-0 sm:flex-row sm:gap-[16px] sm:grow sm:items-center sm:min-h-px sm:min-w-px relative shrink-0">
                <div className="content-stretch flex w-full min-w-0 flex-wrap gap-[6px] sm:basis-0 sm:gap-[8px] sm:grow sm:items-center sm:justify-end relative shrink-0">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#027a48] text-[14px] text-nowrap">
                    Next:
                  </p>
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative min-w-0 text-[#667085] text-[14px]">
                    {nextItem || "No scheduled maintenance"}
                  </p>
                </div>
                {nextCost !== null && (
                  <p className="font-['General_Sans:Medium','Noto_Sans:Medium',sans-serif] leading-[20px] relative shrink-0 text-[#027a48] text-[14px] text-nowrap">
                    ₦{nextCost.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="content-stretch flex items-start overflow-clip relative rounded-[62px] shrink-0">
              <button
                type="button"
                onClick={onManageMaintenance}
                className="bg-[#039855] content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[4px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] shrink-0"
              >
                <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[12px] text-nowrap text-white">
                  Open Maintenance
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Zap() {
  return (
    <div className="absolute left-[10px] size-[20px] top-[10px]" data-name="zap">
      <ZapIcon size={20} className="text-[#039855]" />
    </div>
  );
}

function FeaturedIcon() {
  return (
    <div
      className="bg-[rgba(3,152,85,0.1)] relative rounded-[28px] shrink-0 size-[40px]"
      data-name="Featured icon"
    >
      <div
        aria-hidden="true"
        className="absolute border-[6px] border-[rgba(3,152,85,0.05)] border-solid inset-[-3px] pointer-events-none rounded-[31px]"
      />
      <Zap />
    </div>
  );
}

function MetricCard2({ 
  count = 0, 
  changePercent = 0,
  onGoToOrders
}: { 
  count?: number; 
  changePercent?: number;
  onGoToOrders?: () => void;
}) {
  const isPositive = changePercent >= 0;
  
  return (
    <div
      className="bg-white relative rounded-[14px] shrink-0 w-full min-w-0 lg:basis-0 lg:grow lg:rounded-[8px]"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[14px] lg:rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[18px] sm:gap-[24px] items-start p-4 sm:p-[24px] relative w-full">
          <HeadingAndDropdown title="Active Contracts" />
          <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[40px] sm:leading-[44px] not-italic relative shrink-0 text-[#101828] text-[34px] sm:text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <FeaturedIcon />
            </div>
            <div className="content-stretch flex flex-col gap-[10px] sm:flex-row sm:gap-[16px] sm:items-end sm:justify-end relative shrink-0 w-full">
              <div className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0">
                <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0">
                  {isPositive ? <ArrowUp /> : <ArrowDown />}
                  <p className={`font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-center text-nowrap ${isPositive ? 'text-[#027a48]' : 'text-[#F04438]'}`}>
                    {Math.abs(changePercent)}%
                  </p>
                </div>
                <p className="basis-0 font-['General_Sans:Medium',sans-serif] grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#667085] text-[14px]">
                  vs last month
                </p>
              </div>
              <div className="content-stretch flex items-start relative rounded-[62px] shrink-0">
                <div className="relative rounded-[32px] shrink-0 cursor-pointer" onClick={onGoToOrders}>
                  <div className="content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[inherit]">
                    <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#039855] text-[12px] text-nowrap">
                      Go to Orders
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute border border-[#027a48] border-solid inset-0 pointer-events-none rounded-[32px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircle() {
  return (
    <div
      className="absolute left-[10px] size-[20px] top-[10px]"
      data-name="check-circle"
    >
      <CheckCircleIcon size={20} className="text-[#12B76A]" />
    </div>
  );
}

function FeaturedIcon2() {
  return (
    <div
      className="bg-[rgba(18,183,106,0.1)] relative rounded-[28px] shrink-0 size-[40px]"
      data-name="Featured icon"
    >
      <div
        aria-hidden="true"
        className="absolute border-[6px] border-[rgba(18,183,106,0.05)] border-solid inset-[-3px] pointer-events-none rounded-[31px]"
      />
      <CheckCircle />
    </div>
  );
}

function MetricCard3({ 
  count = 0, 
  changePercent = 0,
  onViewContracts
}: { 
  count?: number; 
  changePercent?: number;
  onViewContracts?: () => void;
}) {
  const isPositive = changePercent >= 0;
  
  return (
    <div
      className="bg-white relative rounded-[14px] shrink-0 w-full min-w-0 lg:basis-0 lg:grow lg:rounded-[8px]"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[14px] lg:rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[18px] sm:gap-[24px] items-start p-4 sm:p-[24px] relative w-full">
          <HeadingAndDropdown title="Completed Requests" />
          <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[40px] sm:leading-[44px] not-italic relative shrink-0 text-[#101828] text-[34px] sm:text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <FeaturedIcon2 />
            </div>
            <div className="content-stretch flex flex-col gap-[10px] sm:flex-row sm:gap-[16px] sm:items-end sm:justify-end relative shrink-0 w-full">
              <div className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0">
                <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0">
                  {isPositive ? <ArrowUp /> : <ArrowDown />}
                  <p className={`font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-center text-nowrap ${isPositive ? 'text-[#027a48]' : 'text-[#F04438]'}`}>
                    {Math.abs(changePercent)}%
                  </p>
                </div>
                <p className="basis-0 font-['General_Sans:Medium',sans-serif] grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#667085] text-[14px]">
                  vs last month
                </p>
              </div>
              <div className="content-stretch flex items-start relative rounded-[62px] shrink-0">
                <div className="relative rounded-[32px] shrink-0 cursor-pointer" onClick={onViewContracts}>
                  <div className="content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[inherit]">
                    <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#039855] text-[12px] text-nowrap">
                      View Requests
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute border border-[#027a48] border-solid inset-0 pointer-events-none rounded-[32px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCards({ 
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: { 
  stats: {
    maintenanceScheduleCount: number;
    nextMaintenance: string | null;
    nextMaintenanceCost: number | null;
    activeContractsCount: number;
    contractsChangePercent: number;
    completedRequestsCount: number;
    completedChangePercent: number;
  };
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Pagination Container"
    >
      <div
        aria-hidden="true"
        className="absolute border-[#e2e8f0] border-[1px_0px_0px] border-solid inset-0 pointer-events-none"
      />
      <div className="flex flex-row items-center size-full">
        <div className="grid grid-cols-1 gap-4 px-4 py-4 relative w-full sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:gap-[16px] lg:px-[34px]">
          <MetricCard1 
            count={stats.maintenanceScheduleCount} 
            nextItem={stats.nextMaintenance}
            nextCost={stats.nextMaintenanceCost}
            onManageMaintenance={onManageMaintenance}
          />
          <MetricCard2 
            count={stats.activeContractsCount}
            changePercent={stats.contractsChangePercent}
            onGoToOrders={onGoToOrders}
          />
          <MetricCard3 
            count={stats.completedRequestsCount}
            changePercent={stats.completedChangePercent}
            onViewContracts={onViewContracts}
          />
        </div>
      </div>
    </div>
  );
}

// Service Card with Image
function ServiceCard({ onClick }: { onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-[#039855] relative rounded-[16px] shrink-0 w-full min-w-0 cursor-pointer hover:opacity-90 transition-opacity lg:basis-0 lg:grow lg:rounded-[8px]"
      data-name="Metric item"
    >
      <div className="min-h-[280px] sm:min-h-[320px] lg:min-h-[339px] relative overflow-clip rounded-[inherit] size-full">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-[44%] bg-[linear-gradient(270deg,rgba(3,152,85,0.08)_0%,rgba(3,152,85,0)_100%)] lg:block"
        />
        <div className="content-stretch flex flex-col gap-[18px] items-start p-5 sm:p-6 lg:p-[20px] relative z-10 w-full h-full">
          <div
            className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full"
            data-name="Heading and dropdown"
          >
            <p className="basis-0 font-['Inter:Medium',sans-serif] font-medium grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-white">
              Book a service
            </p>
            <Dropdown />
          </div>
          <div className="content-stretch flex flex-col gap-[14px] items-start relative shrink-0 w-full">
            <p className="font-['General_Sans:Semibold',sans-serif] leading-[32px] sm:leading-[38px] not-italic relative shrink-0 text-[27px] sm:text-[32px] text-white tracking-[-0.64px] w-full max-w-[260px]">
              You don't have to break your back
            </p>
            <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[16px] text-white">
              We got it covered
            </p>
            <div className="content-stretch flex items-start relative rounded-[62px] shrink-0">
              <div className="bg-[#f6fef9] relative rounded-[32px] shrink-0">
                <div className="content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[inherit]">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#039855] text-[12px] text-nowrap">
                    Let's help out
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="absolute border border-[#d1fadf] border-solid inset-0 pointer-events-none rounded-[32px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                />
              </div>
            </div>
          </div>

          {/* Pagination dots */}
          <div className="mt-auto flex gap-[18px] items-center relative shrink-0">
            <div className="bg-[#ECFDF3] relative rounded-full shrink-0 size-[8px]" />
            <div className="bg-[#32D583] relative rounded-full shrink-0 size-[8px]" />
            <div className="bg-[#32D583] relative rounded-full shrink-0 size-[8px]" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] items-end justify-end overflow-hidden lg:flex">
          <img
            alt=""
            className="h-full w-full object-cover object-center opacity-95"
            src={serviceCardImage}
          />
        </div>
      </div>
    </div>
  );
}
// Chart Components - Simplified
type MarketTrendPoint = {
  monthIndex: number;
  monthLabel: string;
  value: number;
};

type MarketTrendSeries = {
  id: string;
  name: string;
  slug: string;
  color: string;
  unit?: string | null;
  position: number;
  isActive: boolean;
  points: MarketTrendPoint[];
};

type MarketTrendsResponse = {
  series: MarketTrendSeries[];
};

function buildMarketChartData(activeSeries: MarketTrendSeries[]) {
  return activeSeries.length
    ? activeSeries[0].points.map((point) => {
        const row: Record<string, string | number> = { month: point.monthLabel };
        for (const series of activeSeries) {
          const matchingPoint = series.points.find((candidate) => candidate.monthIndex === point.monthIndex);
          row[series.slug] = matchingPoint?.value ?? 0;
        }
        return row;
      })
    : [];
}

function Legend({ series }: { series: MarketTrendSeries[] }) {
  return (
    <div className="content-stretch flex flex-wrap gap-[24px] items-start relative shrink-0 w-full">
      {series.map((item) => (
        <div key={item.id} className="content-stretch flex gap-[8px] items-center relative shrink-0">
          <div
            className="relative rounded-[2px] shrink-0 size-[12px]"
            style={{ backgroundColor: item.color || "#039855" }}
          />
          <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#667085] text-[14px] text-nowrap">
            {item.name}
          </p>
        </div>
      ))}
    </div>
  );
}

function ChartSection({ onGoToMarketplace }: { onGoToMarketplace?: () => void }) {
  const { data } = useQuery<MarketTrendsResponse | null>({
    queryKey: ["/api/app/market-trends"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const activeSeries = (data?.series ?? []).filter((item) => item.isActive !== false);
  const chartData = buildMarketChartData(activeSeries);

  return (
    <div className="bg-white relative rounded-[16px] shrink-0 w-full min-w-0 lg:basis-0 lg:grow lg:rounded-[8px]">
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[16px] lg:rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[18px] items-start p-4 sm:p-5 lg:p-[20px] relative w-full">
          <div className="content-stretch flex flex-col gap-[10px] sm:flex-row sm:gap-[8px] sm:items-start relative shrink-0 w-full">
            <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#101828] text-[16px] sm:basis-0 sm:grow">
              Market Trends
            </p>
            <div className="content-stretch flex items-start relative shrink-0 cursor-pointer" onClick={onGoToMarketplace}>
              <div className="bg-[#f2f4f7] relative rounded-[32px] shrink-0">
                <div className="content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[inherit]">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#039855] text-[12px] text-nowrap">
                    Go to Marketplace
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="absolute border border-[#d1fadf] border-solid inset-0 pointer-events-none rounded-[32px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-[16px] w-full min-w-0">
            {activeSeries.length ? (
              <>
                <Legend series={activeSeries} />
                <ResponsiveContainer width="100%" height={211}>
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="0" stroke="#F2F4F7" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                      domain={[0, "dataMax + 100"]}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #eaecf0",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "General_Sans",
                      }}
                      formatter={(value: number) => `${value}`}
                      labelStyle={{ color: "#101828", fontWeight: 600 }}
                    />
                    {activeSeries.map((series) => (
                      <Line
                        key={series.id}
                        type="monotone"
                        dataKey={series.slug}
                        stroke={series.color || "#039855"}
                        strokeWidth={2}
                        dot={false}
                        name={series.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex h-[211px] w-full items-center justify-center rounded-[12px] border border-dashed border-[#D0D5DD] bg-[#F9FAFB]">
                <p className="px-4 text-center font-['General_Sans:Medium',sans-serif] text-[14px] text-[#667085]">
                  Market trends will appear here once they are configured by admin.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomSection({
  onNavigateToChat,
  onGoToMarketplace,
}: {
  onNavigateToChat?: () => void;
  onGoToMarketplace?: () => void;
}) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Section"
    >
      <div className="relative shrink-0 w-full">
        <div className="size-full">
          <div className="content-stretch flex flex-col items-start px-4 sm:px-6 lg:px-[32px] py-0 relative w-full">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-[24px] items-start relative shrink-0 w-full">
              <ServiceCard onClick={onNavigateToChat} />
              <ChartSection onGoToMarketplace={onGoToMarketplace} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileTopBar() {
  const { firstName } = useProfile();
  const safeName = firstName && firstName !== "User" ? firstName : "";
  const initial = (safeName || "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-3 pl-[66px]">
      <div className="flex min-w-0 flex-1 items-center">
        <img
          src={cityConnectLogo}
          alt="CityConnect"
          className="h-9 w-auto max-w-[172px] object-contain sm:h-10 sm:max-w-[188px]"
        />
      </div>
      <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-white/80 bg-[#F2FAF3] text-[#075332] shadow-[0_10px_22px_rgba(5,79,49,0.12)]">
        <div className="relative flex h-[41px] w-[41px] items-center justify-center rounded-full bg-[#E4F3E7]">
          <Leaf className="absolute right-[6px] top-[6px] text-[#2E9E50]" size={11} />
          <span className="font-['General_Sans:Semibold',sans-serif] text-[16px] leading-none">{initial}</span>
        </div>
      </div>
    </div>
  );
}

function MobileWelcomeBlock() {
  const { firstName } = useProfile();
  const safeFirstName = firstName && firstName !== "User" ? firstName : "Resident";
  const showLeaf = Boolean(firstName && firstName !== "User");

  return (
    <section className="space-y-2.5">
      <p className="font-['General_Sans:Medium',sans-serif] text-[25px] leading-8 tracking-[-0.35px] text-[#162823]">
        Welcome back,
      </p>
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 break-words font-['General_Sans:Semibold',sans-serif] text-[44px] leading-[0.94] tracking-[-1.35px] text-[#075332] sm:text-[48px]">
          {safeFirstName}
        </h1>
        {showLeaf ? <Leaf className="mt-2 shrink-0 text-[#3FAA55]" size={18} /> : null}
      </div>
      <p className="max-w-[314px] font-['General_Sans:Regular',sans-serif] text-[16px] leading-6 text-[#667085]">
        Track, manage and forecast your activities
      </p>
    </section>
  );
}

function MobileActionCard({
  label,
  icon,
  variant,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  variant: "soft" | "solid";
  onClick?: () => void;
}) {
  const isSolid = variant === "solid";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex min-h-[90px] items-center gap-3 rounded-[18px] px-3.5 py-3.5 text-left shadow-[0_10px_22px_rgba(15,40,30,0.1)] transition active:scale-[0.99]",
        isSolid
          ? "bg-[#054F31] text-white"
          : "border border-[#DCE9DF] bg-[#F8FCF7] text-[#075332]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[14px]",
          isSolid ? "bg-white/10 text-white ring-1 ring-white/10" : "bg-[#DFF1E4] text-[#075332]",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 font-['General_Sans:Semibold',sans-serif] text-[16px] leading-5 tracking-[-0.18px]">
        {label}
      </span>
      <ChevronRight
        size={18}
        className={isSolid ? "text-[#DFF1E4]" : "text-[#075332]"}
        strokeWidth={2.4}
      />
    </button>
  );
}

function MobileActionsRow({
  onBuySomething,
  onBookRepairs,
}: {
  onBuySomething?: () => void;
  onBookRepairs?: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <MobileActionCard
        label="Buy something"
        icon={<ShoppingCart size={24} strokeWidth={2.1} />}
        variant="soft"
        onClick={onBuySomething}
      />
      <MobileActionCard
        label="Book Repairs"
        icon={<Wrench size={24} strokeWidth={2.1} />}
        variant="solid"
        onClick={onBookRepairs}
      />
    </section>
  );
}

function MobileChangeStat({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span className="inline-flex items-center gap-1 text-[13px] leading-5">
      {positive ? (
        <ArrowUpIcon size={14} className="text-[#12B76A]" />
      ) : (
        <ArrowDownIcon size={14} className="text-[#F04438]" />
      )}
      <span className={positive ? "text-[#12B76A]" : "text-[#F04438]"}>{Math.abs(value)}%</span>
      <span className="text-[#667085]">vs last month</span>
    </span>
  );
}

function MobileKpiCard({
  title,
  count,
  icon,
  children,
  actionLabel,
  onAction,
  emphasis = "default",
}: {
  title: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
  actionLabel: string;
  onAction?: () => void;
  emphasis?: "default" | "wide";
}) {
  return (
    <article
      className={[
        "flex h-full flex-col rounded-[20px] border border-[#EEF1EC] bg-white shadow-[0_10px_22px_rgba(16,24,40,0.07)]",
        emphasis === "wide" ? "min-h-[178px] p-5" : "min-h-[208px] p-[18px]",
      ].join(" ")}
    >
      <div className="mb-3.5 flex h-[48px] w-[48px] items-center justify-center rounded-[16px] bg-[#EFF9F1] text-[#087443]">
        {icon}
      </div>
      <h2
        className={[
          "font-['General_Sans:Semibold',sans-serif] tracking-[-0.18px] text-[#162823]",
          emphasis === "wide" ? "min-h-[30px] text-[18px] leading-6" : "min-h-[52px] text-[18px] leading-[23px]",
        ].join(" ")}
      >
        {title}
      </h2>
      <p className="mt-3.5 font-['General_Sans:Semibold',sans-serif] text-[38px] leading-none tracking-[-0.9px] text-[#162823]">
        {count}
      </p>
      <div
        className={[
          "mt-3.5 text-[#667085]",
          emphasis === "wide" ? "min-h-[34px] text-[13px] leading-5" : "min-h-[48px] text-[13px] leading-[22px]",
        ].join(" ")}
      >
        {children}
      </div>
      <div className="mt-auto border-t border-[#EEF1EC] pt-3.5">
        <button
          type="button"
          onClick={onAction}
          className="flex w-full items-center justify-between gap-3 font-['General_Sans:Medium',sans-serif] text-[14px] leading-5 text-[#075332]"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </article>
  );
}

function LegacyMobileKpiCards({
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: {
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  const contractPositive = stats.contractsChangePercent >= 0;
  const completedPositive = stats.completedChangePercent >= 0;

  return (
    <section className="grid grid-cols-2 gap-3">
      <div className="col-span-1">
        <MobileKpiCard
          title="Maintenance Schedule"
          count={stats.maintenanceScheduleCount}
          icon={<CalendarDays size={24} strokeWidth={2} />}
          actionLabel="Open Maintenance"
          onAction={onManageMaintenance}
        >
          <span className="font-['General_Sans:Medium',sans-serif] text-[#087443]">Next:</span>{" "}
          <span>{stats.nextMaintenance || "No scheduled maintenance"}</span>
        </MobileKpiCard>
      </div>
      <div className="col-span-1">
        <MobileKpiCard
          title="Active Contracts"
          count={stats.activeContractsCount}
          icon={<FileText size={24} strokeWidth={2} />}
          actionLabel="Go to Orders"
          onAction={onGoToOrders}
        >
          <span className={contractPositive ? "text-[#12B76A]" : "text-[#F04438]"}>
            {contractPositive ? "↑" : "↓"} {Math.abs(stats.contractsChangePercent)}%
          </span>{" "}
          <span>vs last month</span>
        </MobileKpiCard>
        <MobileKpiCard
          title="Completed Requests"
          count={stats.completedRequestsCount}
          icon={<ClipboardCheck size={28} strokeWidth={2} />}
          actionLabel="View Requests"
          onAction={onViewContracts}
        >
          <span className={completedPositive ? "text-[#12B76A]" : "text-[#F04438]"}>
            {completedPositive ? "↑" : "↓"} {Math.abs(stats.completedChangePercent)}%
          </span>{" "}
          <span>vs last month</span>
        </MobileKpiCard>
      </div>
    </section>
  );
}

function LegacyMobilePromoCard({ onClick }: { onClick?: () => void }) {
  return (
    <section
      onClick={onClick}
      className="relative min-h-[282px] cursor-pointer overflow-hidden rounded-[22px] bg-[#075332] shadow-[0_18px_38px_rgba(5,79,49,0.26)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,rgba(60,170,80,0.34),transparent_42%),linear-gradient(90deg,rgba(0,64,36,0.4),transparent_70%)]" />
      <img
        aria-hidden="true"
        alt=""
        src={promoLeafCluster}
        className="absolute bottom-0 right-[-30px] h-[210px] w-[210px] object-contain opacity-70"
      />
      <img
        aria-hidden="true"
        alt=""
        src={promoArtisanCutout}
        className="absolute bottom-[-3px] right-[-24px] h-[215px] w-[180px] object-contain drop-shadow-[0_18px_20px_rgba(0,0,0,0.18)]"
      />
      <div className="relative z-10 flex min-h-[282px] max-w-[68%] flex-col p-6">
        <div className="mb-3 flex items-center gap-4">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/60 bg-[#E9F7EC] text-[#075332] shadow-inner">
            <Leaf size={24} />
          </span>
          <p className="font-['General_Sans:Semibold',sans-serif] text-[19px] leading-6 text-white">
            Book a service
          </p>
        </div>
        <h2 className="font-['General_Sans:Semibold',sans-serif] text-[29px] leading-[34px] tracking-[-0.7px] text-white">
          You don’t have to break your back
        </h2>
        <p className="mt-4 font-['General_Sans:Medium',sans-serif] text-[17px] leading-6 text-white/90">
          We got it covered
        </p>
        <button
          type="button"
          className="mt-5 flex h-12 w-[172px] items-center justify-center gap-3 rounded-full bg-white font-['General_Sans:Semibold',sans-serif] text-[15px] text-[#075332] shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
        >
          Let&apos;s help out
          <ChevronRight size={20} />
        </button>
        <div className="mt-auto flex justify-center gap-4 pr-4">
          <span className="h-3 w-3 rounded-full bg-white" />
          <span className="h-3 w-3 rounded-full bg-[#80B784]" />
          <span className="h-3 w-3 rounded-full bg-[#80B784]" />
        </div>
      </div>
    </section>
  );
}

function LegacyMobileMarketTrends({ onGoToMarketplace }: { onGoToMarketplace?: () => void }) {
  const { data } = useQuery<MarketTrendsResponse | null>({
    queryKey: ["/api/app/market-trends"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const activeSeries = (data?.series ?? []).filter((item) => item.isActive !== false).slice(0, 3);
  const chartData = buildMarketChartData(activeSeries);

  return (
    <section className="rounded-[22px] border border-[#EEF1EC] bg-white p-5 shadow-[0_12px_30px_rgba(16,24,40,0.08)]">
      <div className="flex items-center gap-3">
        <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[16px] bg-[#EFF9F1] text-[#087443]">
          <TrendingUp size={27} strokeWidth={2.1} />
        </div>
        <h2 className="min-w-0 flex-1 font-['General_Sans:Semibold',sans-serif] text-[24px] leading-7 tracking-[-0.3px] text-[#16352A]">
          Market Trends
        </h2>
        <button
          type="button"
          onClick={onGoToMarketplace}
          className="hidden h-11 shrink-0 items-center rounded-full border border-[#DCE9DF] px-5 font-['General_Sans:Medium',sans-serif] text-[15px] text-[#075332] min-[390px]:flex"
        >
          Go to Marketplace
        </button>
      </div>

      {activeSeries.length ? (
        <>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {activeSeries.map((series, index) => (
              <div key={series.id} className="flex items-center gap-3">
                <span
                  className="h-[14px] w-[14px] rounded-full"
                  style={{ backgroundColor: series.color || ["#075332", "#3DCD70", "#0DA34A"][index] }}
                />
                <span className="font-['General_Sans:Medium',sans-serif] text-[15px] text-[#667085]">
                  {series.name}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke="#E9EFEA" strokeDasharray="6 8" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                  interval="preserveStartEnd"
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                  domain={[0, "dataMax + 100"]}
                  dx={-8}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E1E8E2",
                    borderRadius: "12px",
                    boxShadow: "0 12px 28px rgba(16, 24, 40, 0.12)",
                    fontSize: "12px",
                    fontFamily: "General_Sans",
                  }}
                  formatter={(value: number) => `${value}`}
                  labelStyle={{ color: "#101828", fontWeight: 600 }}
                />
                {activeSeries.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.slug}
                    stroke={series.color || ["#075332", "#3DCD70", "#0DA34A"][index]}
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name={series.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-[18px] border border-dashed border-[#DCE9DF] bg-[#F8FCF7] px-6 text-center font-['General_Sans:Medium',sans-serif] text-[15px] leading-6 text-[#667085]">
          Market trends will appear here once they are configured by admin.
        </div>
      )}

      <div className="mt-5 flex items-start gap-4 rounded-[18px] border border-[#E1ECE4] bg-[#F8FCF7] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#E9F7EC] text-[#087443]">
          <Leaf size={22} />
        </span>
        <p className="font-['General_Sans:Regular',sans-serif] text-[15px] leading-6 text-[#667085]">
          <span className="font-['General_Sans:Medium',sans-serif] text-[#263C35]">
            Prices updated weekly from trusted local markets.
          </span>{" "}
          Make smarter choices for your home.
        </p>
      </div>
    </section>
  );
}

function MobileKpiCards({
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: {
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-4">
      <div className="col-span-1">
        <MobileKpiCard
          title="Maintenance Schedule"
          count={stats.maintenanceScheduleCount}
          icon={<CalendarDays size={28} strokeWidth={2} />}
          actionLabel="Open Maintenance"
          onAction={onManageMaintenance}
        >
          <span className="font-['General_Sans:Medium',sans-serif] text-[#087443]">Next:</span>{" "}
          <span>{stats.nextMaintenance || "No scheduled maintenance"}</span>
        </MobileKpiCard>
      </div>
      <div className="col-span-1">
        <MobileKpiCard
          title="Active Contracts"
          count={stats.activeContractsCount}
          icon={<FileText size={28} strokeWidth={2} />}
          actionLabel="Go to Orders"
          onAction={onGoToOrders}
        >
          <MobileChangeStat value={stats.contractsChangePercent} />
        </MobileKpiCard>
      </div>
      <div className="col-span-2">
        <MobileKpiCard
          title="Completed Requests"
          count={stats.completedRequestsCount}
          icon={<ClipboardCheck size={24} strokeWidth={2} />}
          actionLabel="View Requests"
          onAction={onViewContracts}
          emphasis="wide"
        >
          <MobileChangeStat value={stats.completedChangePercent} />
        </MobileKpiCard>
      </div>
    </section>
  );
}

function MobilePromoCard({ onClick }: { onClick?: () => void }) {
  return (
    <section
      onClick={onClick}
      className="relative min-h-[336px] cursor-pointer overflow-hidden rounded-[22px] bg-[#075332] shadow-[0_18px_34px_rgba(5,79,49,0.22)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_34%,rgba(83,187,111,0.18),transparent_30%),linear-gradient(90deg,rgba(6,65,40,0.12),rgba(6,65,40,0.01)_46%,rgba(255,255,255,0)_72%)]" />
      <img
        aria-hidden="true"
        alt=""
        src={promoLeafCluster}
        className="absolute bottom-[34px] right-[38px] h-[138px] w-[138px] object-contain opacity-20"
      />
      <div className="absolute bottom-0 right-0 top-0 flex w-[43%] items-end justify-end pr-3">
        <div className="absolute bottom-8 right-3 top-10 w-[148px] rounded-[28px] bg-[linear-gradient(180deg,rgba(227,244,232,0.24),rgba(227,244,232,0.08))] backdrop-blur-[2px]" />
        <img
          aria-hidden="true"
          alt=""
          src={serviceCardImage}
          className="relative z-10 h-[228px] w-[146px] rounded-[26px] object-cover object-[70%_center] shadow-[0_16px_24px_rgba(0,0,0,0.18)]"
        />
      </div>
      <div className="relative z-10 flex min-h-[336px] max-w-[58%] flex-col p-6">
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E9F7EC] text-[#075332]">
            <Leaf size={15} />
          </span>
          <p className="font-['General_Sans:Semibold',sans-serif] text-[14px] leading-5 text-white">
            Book a service
          </p>
        </div>
        <h2 className="max-w-[190px] font-['General_Sans:Semibold',sans-serif] text-[24px] leading-[30px] tracking-[-0.45px] text-white">
          You don&apos;t have to break your back
        </h2>
        <p className="mt-3 max-w-[176px] font-['General_Sans:Medium',sans-serif] text-[15px] leading-6 text-white/82">
          We got it covered
        </p>
        <button
          type="button"
          className="mt-6 flex h-11 w-[164px] items-center justify-center gap-2.5 rounded-full bg-white font-['General_Sans:Semibold',sans-serif] text-[14px] text-[#075332] shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
        >
          Let&apos;s help out
          <ChevronRight size={18} />
        </button>
        <div className="mt-auto flex items-center gap-2.5 pb-1">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#80B784]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#80B784]" />
        </div>
      </div>
    </section>
  );
}

function MobileMarketTrends({ onGoToMarketplace }: { onGoToMarketplace?: () => void }) {
  const { data } = useQuery<MarketTrendsResponse | null>({
    queryKey: ["/api/app/market-trends"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const activeSeries = (data?.series ?? []).filter((item) => item.isActive !== false).slice(0, 3);
  const chartData = buildMarketChartData(activeSeries);

  return (
    <section className="rounded-[22px] border border-[#EEF1EC] bg-white p-[18px] shadow-[0_10px_24px_rgba(16,24,40,0.07)]">
      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-[#EFF9F1] text-[#087443]">
            <TrendingUp size={22} strokeWidth={2.1} />
          </div>
          <h2 className="min-w-0 flex-1 font-['General_Sans:Semibold',sans-serif] text-[20px] leading-6 tracking-[-0.24px] text-[#16352A]">
            Market Trends
          </h2>
        </div>
        <button
          type="button"
          onClick={onGoToMarketplace}
          className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-full border border-[#DCE9DF] bg-[#F8FCF7] px-4 font-['General_Sans:Medium',sans-serif] text-[13px] text-[#075332] min-[390px]:w-auto"
        >
          Go to Marketplace
        </button>
      </div>

      {activeSeries.length ? (
        <>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2.5">
            {activeSeries.map((series, index) => (
              <div key={series.id} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: series.color || ["#075332", "#44C767", "#12B76A"][index] }}
                />
                <span className="font-['General_Sans:Medium',sans-serif] text-[13px] text-[#667085]">
                  {series.name}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-[206px] w-full overflow-hidden rounded-[18px] bg-[#FCFDFC] px-1 py-2.5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke="#E9EFEA" strokeDasharray="6 8" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                  interval="preserveStartEnd"
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#667085", fontSize: 12, fontFamily: "General_Sans" }}
                  domain={[0, "dataMax + 100"]}
                  dx={-8}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E1E8E2",
                    borderRadius: "12px",
                    boxShadow: "0 12px 28px rgba(16, 24, 40, 0.12)",
                    fontSize: "12px",
                    fontFamily: "General_Sans",
                  }}
                  formatter={(value: number) => `${value}`}
                  labelStyle={{ color: "#101828", fontWeight: 600 }}
                />
                {activeSeries.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.slug}
                    stroke={series.color || ["#075332", "#44C767", "#12B76A"][index]}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                    name={series.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-[18px] border border-dashed border-[#DCE9DF] bg-[#F8FCF7] px-6 text-center font-['General_Sans:Medium',sans-serif] text-[15px] leading-6 text-[#667085]">
          Market trends will appear here once they are configured by admin.
        </div>
      )}

      <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#E1ECE4] bg-[#F8FCF7] p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#E9F7EC] text-[#087443]">
          <Leaf size={18} />
        </span>
        <p className="font-['General_Sans:Regular',sans-serif] text-[13px] leading-[22px] text-[#667085]">
          <span className="font-['General_Sans:Medium',sans-serif] text-[#263C35]">
            Prices updated weekly from trusted local markets.
          </span>{" "}
          Make smarter choices for your home.
        </p>
      </div>
    </section>
  );
}

function MobileDashboard({
  onNavigateToChat,
  onGoToMarketplace,
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: {
  onNavigateToChat?: () => void;
  onGoToMarketplace?: () => void;
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-[18px] px-5 pb-8 pt-5 sm:px-6 lg:hidden">
      <MobileTopBar />
      <MobileWelcomeBlock />
      <MobileActionsRow onBuySomething={onGoToMarketplace} onBookRepairs={onNavigateToChat} />
      <MobileKpiCards
        stats={stats}
        onGoToOrders={onGoToOrders}
        onViewContracts={onViewContracts}
        onManageMaintenance={onManageMaintenance}
      />
      <MobilePromoCard onClick={onNavigateToChat} />
      <MobileMarketTrends onGoToMarketplace={onGoToMarketplace} />
    </div>
  );
}

type DashboardStats = {
  maintenanceScheduleCount: number;
  nextMaintenance: string | null;
  nextMaintenanceCost: number | null;
  activeContractsCount: number;
  contractsChangePercent: number;
  completedRequestsCount: number;
  completedChangePercent: number;
};

function Main({ 
  onNavigateToChat,
  onGoToMarketplace,
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: { 
  onNavigateToChat?: () => void;
  onGoToMarketplace?: () => void;
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  return (
    <div
      className="city-scrollbar bg-[#F7F5EE] content-stretch flex min-h-[100dvh] flex-col items-start overflow-x-hidden px-0 relative shrink-0 w-full lg:h-full lg:min-h-0 lg:gap-[8px] lg:overflow-y-auto lg:rounded-bl-[40px] lg:rounded-tl-[40px] lg:bg-white lg:pb-[8px] lg:pt-[16px]"
      data-name="Main"
    >
      <MobileDashboard
        onNavigateToChat={onNavigateToChat}
        onGoToMarketplace={onGoToMarketplace}
        stats={stats}
        onGoToOrders={onGoToOrders}
        onViewContracts={onViewContracts}
        onManageMaintenance={onManageMaintenance}
      />
      <div className="hidden w-full flex-col gap-[8px] lg:flex">
        <HeaderSection />
        <MetricCards
          stats={stats}
          onGoToOrders={onGoToOrders}
          onViewContracts={onViewContracts}
          onManageMaintenance={onManageMaintenance}
        />
        <BottomSection onNavigateToChat={onNavigateToChat} onGoToMarketplace={onGoToMarketplace} />
      </div>
    </div>
  );
}

function MainWrap({ 
  onNavigateToChat,
  onGoToMarketplace,
  stats,
  onGoToOrders,
  onViewContracts,
  onManageMaintenance,
}: { 
  onNavigateToChat?: () => void;
  onGoToMarketplace?: () => void;
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
  onManageMaintenance?: () => void;
}) {
  return (
    <div
      className="content-stretch flex min-h-[100dvh] w-full min-w-0 flex-col grow items-start bg-white px-0 relative shrink-0 lg:basis-0 lg:min-h-0 lg:min-w-px lg:bg-transparent lg:pb-[8px] lg:pt-[8px] lg:pr-[6px] lg:h-[99vh] lg:max-h-[99vh]"
      data-name="Main wrap"
    >
      <Main 
        onNavigateToChat={onNavigateToChat}
        onGoToMarketplace={onGoToMarketplace}
        stats={stats}
        onGoToOrders={onGoToOrders}
        onViewContracts={onViewContracts}
        onManageMaintenance={onManageMaintenance}
      />
    </div>
  );
}

export type HomepagePage = "homepage" | "chat" | "settings";

export type HomepageNavHandlers = {
  onNavigateToHomepage?: () => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToChat?: () => void;
};

type HomepageProps = HomepageNavHandlers & {
  currentPage?: HomepagePage;
};

export default function Homepage({
  onNavigateToSettings,
  onNavigateToHomepage,
  onNavigateToMarketplace,
  onNavigateToChat,
  currentPage = "homepage",
}: HomepageProps) {
  const [, navigate] = useLocation();
  const { stats } = useResidentDashboard();
  
  const handleBookServiceClick = () => {
    if (onNavigateToChat) {
      onNavigateToChat();
      return;
    }
    navigate("/resident/requests/new");
  };
  const handleNavigateToHomepage = () => {
    if (onNavigateToHomepage) {
      onNavigateToHomepage();
      return;
    }
    navigate("/resident");
  };
  const handleNavigateToMarketplace = () => {
    if (onNavigateToMarketplace) {
      onNavigateToMarketplace();
      return;
    }
    navigate("/resident/citymart");
  };
  const handleNavigateToSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
      return;
    }
    navigate("/resident/settings");
  };

  const handleGoToOrders = () => {
    navigate("/track-orders");
  };

  const handleViewContracts = () => {
    navigate("/service-requests");
  };

  const handleManageMaintenance = () => {
    navigate("/resident/maintenance");
  };

  return (
    <div
      className="bg-white content-stretch flex min-h-[100dvh] items-start relative size-full overflow-x-hidden lg:bg-[#054f31] lg:h-[100dvh] lg:overflow-hidden lg:py-[4px]"
      data-name="Homepage"
    >
      <MobileNavDrawer
        buttonClassName="fixed left-5 top-5 z-50 inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#054f31] text-white shadow-[0_10px_20px_rgba(5,79,49,0.2)] transition active:scale-95 lg:hidden"
        onBookServiceClick={handleBookServiceClick}
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
        currentPage={currentPage}
      />
      <div className="hidden lg:block h-[calc(100dvh-8px)] shrink-0">
        <Nav
          onBookServiceClick={handleBookServiceClick}
          onNavigateToHomepage={handleNavigateToHomepage}
          onNavigateToSettings={handleNavigateToSettings}
          onNavigateToMarketplace={handleNavigateToMarketplace}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
          currentPage={currentPage}
        />
      </div>
      <MainWrap 
        onNavigateToChat={handleBookServiceClick}
        onGoToMarketplace={handleNavigateToMarketplace}
        stats={stats}
        onGoToOrders={handleGoToOrders}
        onViewContracts={handleViewContracts}
        onManageMaintenance={handleManageMaintenance}
      />
    </div>
  );
}
