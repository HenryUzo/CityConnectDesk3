import { Button } from "@/components/ui/button";

interface RequestSummaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function RequestSummaryButton({ onClick, disabled }: RequestSummaryButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-8 rounded-full bg-[#027A48] px-3 text-xs shadow-sm hover:bg-[#039855]"
    >
      Review job summary
    </Button>
  );
}
