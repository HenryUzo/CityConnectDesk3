interface SystemMessageProps {
  text: string;
}

export function SystemMessage({ text }: SystemMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <p className="rounded-full border border-[#E4E7EC] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#667085]">
        {text}
      </p>
    </div>
  );
}
