import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const EMOJI_OPTIONS = [
  { value: "\u{1F6D2}", label: "Shopping" },
  { value: "\u{1F34E}", label: "Groceries" },
  { value: "\u{1F37D}", label: "Food" },
  { value: "\u{1F454}", label: "Men's Clothing (Corporate)" },
  { value: "\u{1F455}", label: "Men's Clothing (Casual)" },
  { value: "\u{1F456}", label: "Men's Jeans / Trousers" },
  { value: "\u{1F457}", label: "Women's Clothing (Casual)" },
  { value: "\u{1F45A}", label: "Women's Clothing (Traditional)" },
  { value: "\u{1F9D2}", label: "Kids Clothing" },
  { value: "\u{1F45F}", label: "Sneakers" },
  { value: "\u{1F45E}", label: "Formal Shoes" },
  { value: "\u{1FA74}", label: "Sandals / Flip-flops" },
  { value: "\u{1F97F}", label: "Ladies Flats" },
  { value: "\u{1F45C}", label: "Handbags" },
  { value: "\u{1F392}", label: "Backpacks" },
  { value: "\u{1F9F3}", label: "Travel Bags" },
  { value: "\u{231A}", label: "Watches" },
  { value: "\u{1F576}", label: "Sunglasses" },
  { value: "\u{1F3A9}", label: "Hats" },
  { value: "\u{1F48E}", label: "Fine Jewelry" },
  { value: "\u{1F4FF}", label: "Fashion Jewelry" },
  { value: "\u{1F9F5}", label: "Tailoring / Alterations" },
  { value: "\u{1F338}", label: "Perfumes / Fragrances" },
  { value: "\u{1F484}", label: "Makeup" },
  { value: "\u{1F9F4}", label: "Skincare" },
  { value: "\u{1F487}", label: "Hair Salon / Barbers" },
  { value: "\u{1F485}", label: "Nails / Spa" },
  { value: "\u{1F9FC}", label: "Personal Care (Soaps/Deodorants)" },
  { value: "\u{1F9EA}", label: "Pharmacy / Chemist" },
  { value: "\u{1F48A}", label: "Vitamins & Supplements" },
  { value: "\u{1F4F1}", label: "Phones" },
  { value: "\u{1F4BB}", label: "Laptops" },
  { value: "\u{1F3A7}", label: "Earbuds / Headsets" },
  { value: "\u{1F50A}", label: "Speakers" },
  { value: "\u{1F50B}", label: "Power Banks / Chargers" },
  { value: "\u{1F4FA}", label: "TVs" },
  { value: "\u{1F3AE}", label: "Game Consoles" },
  { value: "\u{1F4F7}", label: "Cameras" },
  { value: "\u{1F697}", label: "Cars" },
  { value: "\u{1F527}", label: "Repair / Accessory Kiosks" },
  { value: "\u{1F37F}", label: "Snacks & Drinks" },
  { value: "\u{1F950}", label: "Bakery / Fresh Food" },
  { value: "\u{1F969}", label: "Fresh Meat / Butchery" },
  { value: "\u{1F9FB}", label: "Household Basics" },
  { value: "\u{1F9FD}", label: "Cleaning Supplies" },
  { value: "\u{1F6CB}", label: "Furniture Showroom" },
  { value: "\u{1F6CF}", label: "Bedding & Linen" },
  { value: "\u{1F373}", label: "Kitchenware" },
  { value: "\u{1F5BC}", label: "Home Decor" },
  { value: "\u{1F4E6}", label: "Storage / Organizers" },
  { value: "\u{1F476}", label: "Baby & Kids" },
  { value: "\u{1F9F8}", label: "Toys & Games" },
  { value: "\u{1F37C}", label: "Baby Food / Diapers" },
  { value: "\u{1F6BC}", label: "Strollers / Baby Gear" },
  { value: "\u{26BD}", label: "Sportswear" },
  { value: "\u{1F3C0}", label: "Sports Equipment" },
  { value: "\u{1F3CB}", label: "Outdoor / Fitness Accessories" },
  { value: "\u{1F4DA}", label: "Books & Stationery" },
  { value: "\u{1F5A8}", label: "Printing / Photocopying" },
  { value: "\u{1F516}", label: "Labels / Tags / Sales" },
  { value: "\u{1F9FE}", label: "Receipts / Customer Service" },
];

export default function EmojiCombobox({
  value,
  onChange,
  placeholder = "Search or pick emoji",
  className,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState<string>(value || "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const ref = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useMemo(() => {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return EMOJI_OPTIONS;
    return EMOJI_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (open && options.length > 0) {
      if (highlighted < 0) setHighlighted(0);
      else if (highlighted >= options.length) setHighlighted(options.length - 1);
    } else {
      setHighlighted(-1);
    }
  }, [open, options.length, highlighted]);

  useEffect(() => {
    if (!listRef.current || highlighted < 0) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function selectIndex(i: number) {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.value);
    setQuery(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(options.length - 1, Math.max(0, h + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && highlighted >= 0 && highlighted < options.length) {
        e.preventDefault();
        selectIndex(highlighted);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-controls="emoji-listbox"
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg">
          <ul id="emoji-listbox" ref={listRef} role="listbox" className="max-h-48 overflow-auto p-1">
            {options.length === 0 && (
              <li className="p-2 text-sm text-muted-foreground">No matches</li>
            )}
            {options.map((opt, idx) => (
              <li
                key={opt.value + idx}
                role="option"
                aria-selected={highlighted === idx}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1",
                  highlighted === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/30",
                )}
                onMouseEnter={() => setHighlighted(idx)}
                onClick={() => selectIndex(idx)}
              >
                <span className="text-lg">{opt.value}</span>
                <span className="text-sm text-muted-foreground">{opt.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
