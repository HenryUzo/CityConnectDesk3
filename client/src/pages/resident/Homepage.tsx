import { useLocation } from "wouter";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useProfile } from "@/contexts/ProfileContext";
import { useResidentDashboard } from "@/hooks/useResidentDashboard";
import { ShoppingCart, Wrench, MoreVertical as MoreVerticalIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Zap as ZapIcon, CheckCircle as CheckCircleIcon } from "lucide-react";
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
      className="basis-0 content-stretch flex flex-col gap-[4px] grow items-start min-h-px min-w-px not-italic relative shrink-0"
      data-name="Text and supporting text"
    >
      <p className="font-['General_Sans:Medium',sans-serif] leading-[38px] relative shrink-0 text-[#054f31] text-[30px] w-full">
        Welcome back, {firstName}
      </p>
      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] relative shrink-0 text-[#667085] text-[16px] w-full">
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
      className="bg-white relative rounded-[8px] shrink-0"
      data-name="_Button base"
    >
      <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip px-[16px] py-[10px] relative rounded-[inherit]">
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
      className="content-stretch flex items-start relative rounded-[4px] shrink-0"
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
      className="bg-[#039855] relative rounded-[8px] shrink-0"
      data-name="_Button base"
    >
      <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip px-[16px] py-[10px] relative rounded-[inherit]">
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
      className="content-stretch flex items-start relative rounded-[4px] shrink-0"
      data-name="Button"
    >
      <ButtonBase2 />
    </div>
  );
}

function Actions() {
  return (
    <div
      className="content-stretch flex gap-[12px] items-center relative shrink-0"
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
      className="content-stretch flex gap-[16px] items-start relative shrink-0 w-full"
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
        <div className="content-stretch flex flex-col items-start px-[32px] py-0 relative w-full">
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
  nextCost = null 
}: { 
  count?: number; 
  nextItem?: string | null; 
  nextCost?: number | null;
}) {
  return (
    <div
      className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
          <HeadingAndDropdown title="Maintenance Schedule" />
          <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex gap-[16px] items-center relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[44px] not-italic relative shrink-0 text-[#101828] text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <div className="basis-0 content-stretch flex gap-[16px] grow items-center min-h-px min-w-px relative shrink-0">
                <div className="basis-0 content-stretch flex gap-[8px] grow items-center justify-end min-h-px min-w-px relative shrink-0">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#027a48] text-[14px] text-center text-nowrap">
                    Next:
                  </p>
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#667085] text-[14px] text-center text-nowrap">
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
              <div className="bg-[#039855] content-stretch flex items-center justify-center overflow-clip px-[12px] py-[4px] relative rounded-[4px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] shrink-0">
                <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[12px] text-nowrap text-white">
                  Manage Subscriptions
                </p>
              </div>
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
      <ZapIcon size={20} className="text-[#1570EF]" />
    </div>
  );
}

function FeaturedIcon() {
  return (
    <div
      className="bg-[rgba(21,112,239,0.1)] relative rounded-[28px] shrink-0 size-[40px]"
      data-name="Featured icon"
    >
      <div
        aria-hidden="true"
        className="absolute border-[6px] border-[rgba(21,112,239,0.05)] border-solid inset-[-3px] pointer-events-none rounded-[31px]"
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
      className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
          <HeadingAndDropdown title="Active Contracts" />
          <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[44px] not-italic relative shrink-0 text-[#101828] text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <FeaturedIcon />
            </div>
            <div className="content-stretch flex gap-[16px] items-end justify-end relative shrink-0 w-full">
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
      className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0"
      data-name="Metric item"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
          <HeadingAndDropdown title="Completed Requests" />
          <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[44px] not-italic relative shrink-0 text-[#101828] text-[36px] text-nowrap tracking-[-0.72px]">
                {count}
              </p>
              <FeaturedIcon2 />
            </div>
            <div className="content-stretch flex gap-[16px] items-end justify-end relative shrink-0 w-full">
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
  onViewContracts
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
        <div className="content-stretch flex gap-[16px] items-center px-[34px] py-[16px] relative w-full">
          <MetricCard1 
            count={stats.maintenanceScheduleCount} 
            nextItem={stats.nextMaintenance}
            nextCost={stats.nextMaintenanceCost}
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
      className="basis-0 bg-[#039855] grow min-h-px min-w-px relative rounded-[8px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
      data-name="Metric item"
    >
      <div className="min-h-[385px] relative overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full h-full">
          <div
            className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full"
            data-name="Heading and dropdown"
          >
            <p className="basis-0 font-['Inter:Medium',sans-serif] font-medium grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-white">
              Book a service
            </p>
            <Dropdown />
          </div>
          <div className="content-stretch flex flex-col gap-[20px] items-start relative shrink-0 w-full">
            <p className="font-['General_Sans:Semibold',sans-serif] leading-[44px] not-italic relative shrink-0 text-[36px] text-white tracking-[-0.72px] w-[293px]">
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
        <div className="absolute h-full right-0 top-[0%] left-[40%] w-[450px] ">
          {/* <img
            alt=""
            className="absolute inset-0 max-w-none object-cover pointer-events-none size-full scale-x-[-1.0] scale-y-[1.0]"
            src={imgWepikExport}
          /> */}
        </div>
      </div>
    </div>
  );
}

// Chart Components - Simplified
function Legend() {
  return (
    <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
      <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
        <div className="bg-[#05603a] relative rounded-[2px] shrink-0 size-[12px]" />
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#667085] text-[14px] text-nowrap">
          Bag of Rice
        </p>
      </div>
      <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
        <div className="bg-[#32d583] relative rounded-[2px] shrink-0 size-[12px]" />
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#667085] text-[14px] text-nowrap">
          Crate of Eggs
        </p>
      </div>
      <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
        <div className="bg-[#039855] relative rounded-[2px] shrink-0 size-[12px]" />
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#667085] text-[14px] text-nowrap">
          Tuber of Yam
        </p>
      </div>
    </div>
  );
}

// Market trends data
const marketData = [
  { month: "Jan", rice: 50, eggs: 320, yam: 600 },
  { month: "Feb", rice: 80, eggs: 340, yam: 620 },
  { month: "Mar", rice: 120, eggs: 360, yam: 640 },
  { month: "Apr", rice: 150, eggs: 370, yam: 660 },
  { month: "May", rice: 180, eggs: 380, yam: 680 },
  { month: "Jun", rice: 210, eggs: 390, yam: 700 },
  { month: "Jul", rice: 240, eggs: 400, yam: 650 },
  { month: "Aug", rice: 200, eggs: 420, yam: 600 },
  { month: "Sep", rice: 280, eggs: 440, yam: 720 },
  { month: "Oct", rice: 320, eggs: 450, yam: 760 },
  { month: "Nov", rice: 380, eggs: 460, yam: 780 },
  { month: "Dec", rice: 420, eggs: 470, yam: 800 },
];

function ChartSection() {
  return (
    <div className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0">
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
          <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full">
            <p className="basis-0 font-['Inter:Medium',sans-serif] font-medium grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#101828] text-[16px]">
              Market Trends
            </p>
            <div className="content-stretch flex items-start relative shrink-0">
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
          <div className="flex flex-col gap-[20px] w-full">
            <Legend />
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={marketData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 0,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#F2F4F7"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#667085",
                    fontSize: 12,
                    fontFamily: "General_Sans",
                  }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#667085",
                    fontSize: 12,
                    fontFamily: "General_Sans",
                  }}
                  domain={[0, 1000]}
                  ticks={[0, 200, 400, 600, 800, 1000]}
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
                  formatter={(value: number) => `₦${value}`}
                  labelStyle={{
                    color: "#101828",
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="yam"
                  stroke="#039855"
                  strokeWidth={2}
                  dot={false}
                  name="Tuber of Yam"
                />
                <Line
                  type="monotone"
                  dataKey="eggs"
                  stroke="#32D583"
                  strokeWidth={2}
                  dot={false}
                  name="Crate of Eggs"
                />
                <Line
                  type="monotone"
                  dataKey="rice"
                  stroke="#05603A"
                  strokeWidth={2}
                  dot={false}
                  name="Bag of Rice"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomSection({ onNavigateToChat }: { onNavigateToChat?: () => void }) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Section"
    >
      <div className="relative shrink-0 w-full">
        <div className="size-full">
          <div className="content-stretch flex flex-col items-start px-[32px] py-0 relative w-full">
            <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
              <ServiceCard onClick={onNavigateToChat} />
              <ChartSection />
            </div>
          </div>
        </div>
      </div>
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
  stats,
  onGoToOrders,
  onViewContracts
}: { 
  onNavigateToChat?: () => void;
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
}) {
  return (
    <div
      className="bg-white content-stretch flex flex-col gap-[32px] items-start pb-[33px] pt-[32px] px-0 relative rounded-bl-[40px] rounded-tl-[40px] shrink-0 w-full h-full"
      data-name="Main"
    >
      <HeaderSection />
      <MetricCards 
        stats={stats} 
        onGoToOrders={onGoToOrders}
        onViewContracts={onViewContracts}
      />
      <BottomSection onNavigateToChat={onNavigateToChat} />
    </div>
  );
}

function MainWrap({ 
  onNavigateToChat,
  stats,
  onGoToOrders,
  onViewContracts
}: { 
  onNavigateToChat?: () => void;
  stats: DashboardStats;
  onGoToOrders?: () => void;
  onViewContracts?: () => void;
}) {
  return (
    <div
      className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px pb-0 pt-[12px] px-0 relative shrink-0"
      data-name="Main wrap"
    >
      <Main 
        onNavigateToChat={onNavigateToChat}
        stats={stats}
        onGoToOrders={onGoToOrders}
        onViewContracts={onViewContracts}
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

  return (
    <div
      className="bg-[#054f31] content-stretch flex items-start relative size-full min-h-screen"
      data-name="Homepage"
    >
      <MobileNavDrawer
        onBookServiceClick={handleBookServiceClick}
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
        currentPage={currentPage}
      />
      <div className="hidden lg:block">
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
        stats={stats}
        onGoToOrders={handleGoToOrders}
        onViewContracts={handleViewContracts}
      />
    </div>
  );
}
