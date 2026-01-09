function Time() {
  return (
    <div className="bg-[#f3de6d] content-stretch flex font-['Public_Sans:Regular',sans-serif] font-normal gap-[6px] items-center leading-[24px] px-[12px] py-[6px] relative rounded-[2px] shrink-0 text-[#191c1f] text-[16px] text-nowrap" data-name="Time">
      <p className="relative shrink-0">16d</p>
      <p className="relative shrink-0 text-center">:</p>
      <p className="relative shrink-0">21h</p>
      <p className="relative shrink-0 text-center">:</p>
      <p className="relative shrink-0">57m</p>
      <p className="relative shrink-0 text-center">:</p>
      <p className="relative shrink-0">23s</p>
    </div>
  );
}

export function Countdown({ targetDate, onExpire, label, text }: { targetDate?: Date; onExpire?: () => void; label?: string; text?: string }) {
  // Placeholder implementation: show static timer. Consumers can provide targetDate/onExpire.
  return (
    <div className="bg-white content-stretch flex gap-[12px] items-center relative rounded-[4px] size-full" data-name="Countdown">
      <Time />
      {label && <span className="text-[12px] text-[#475467]">{label}</span>}
      {text && <span className="text-[12px] text-[#475467]">{text}</span>}
    </div>
  );
}

export function CountdownWithText({ targetDate, onExpire, label, text }: { targetDate?: Date; onExpire?: () => void; label?: string; text?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Countdown targetDate={targetDate} onExpire={onExpire} label={label} text={text} />
    </div>
  );
}

export default Countdown;