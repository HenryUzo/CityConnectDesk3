import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const EMOJI_OPTIONS = [
  { value: "🛒", label: "Shopping" },
  { value: "🍎", label: "Groceries" },
  { value: "🍽️", label: "Food" },
  { value: "👔", label: "Men’s Clothing (Corporate)" },
  { value: "👕", label: "Men’s Clothing (Casual)" },
  { value: "👖", label: "Men’s Jeans / Trousers" },
  { value: "👗", label: "Women’s Clothing (Casual)" },
  { value: "👚", label: "Women’s Clothing (Traditional)" },
  { value: "🧒", label: "Kids Clothing" },
  { value: "👟", label: "Sneakers" },
  { value: "👞", label: "Formal Shoes" },
  { value: "🩴", label: "Sandals / Flip-flops" },
  { value: "🥿", label: "Ladies Flats" },
  { value: "👜", label: "Handbags" },
  { value: "🎒", label: "Backpacks" },
  { value: "🧳", label: "Travel Bags" },
  { value: "⌚", label: "Watches" },
  { value: "🧣", label: "Belts & Scarves" },
  { value: "🕶️", label: "Sunglasses" },
  { value: "🎩", label: "Hats" },
  { value: "💎", label: "Fine Jewelry" },
  { value: "📿", label: "Fashion Jewelry" },
  { value: "🧵", label: "Tailoring / Alterations" },
  { value: "🌸", label: "Perfumes / Fragrances" },
  { value: "💄", label: "Makeup" },
  { value: "🧴", label: "Skincare" },
  { value: "💇", label: "Hair Salon / Barbers" },
  { value: "💅", label: "Nails / Spa" },
  { value: "🧼", label: "Personal Care (Soaps/Deodorants)" },
  { value: "🩺", label: "Pharmacy / Chemist" },
  { value: "💊", label: "Vitamins & Supplements" },
  { value: "🩹", label: "Basic Medical Devices" },
  { value: "👓", label: "Opticals / Glasses" },
  { value: "📱", label: "Phones" },
  { value: "📱", label: "Tablets" },
  { value: "💻", label: "Laptops" },
  { value: "🎧", label: "Earbuds / Headsets" },
  { value: "🔊", label: "Speakers" },
  { value: "⌚", label: "Smartwatches" },
  { value: "🔋", label: "Power Banks / Chargers" },
  { value: "🔌", label: "Cables & Chargers" },
  { value: "📺", label: "TVs" },
  { value: "🎮", label: "Game Consoles" },
  { value: "📷", label: "Cameras" },
  { value: "🔧", label: "Repair / Accessory Kiosks" },
  { value: "🍿", label: "Snacks & Drinks" },
  { value: "🥐", label: "Bakery / Fresh Food" },
  { value: "🍎", label: "Fresh Fruits" },
  { value: "🥩", label: "Fresh Meat / Butchery" },
  { value: "🧻", label: "Household Basics" },
  { value: "🧽", label: "Cleaning Supplies" },
  { value: "🛋️", label: "Furniture Showroom" },
  { value: "🛏️", label: "Bedding & Linen" },
  { value: "🍳", label: "Kitchenware" },
  { value: "🖼️", label: "Home Décor" },
  { value: "📦", label: "Storage / Organizers" },
  { value: "👶", label: "Baby & Kids" },
  { value: "🧸", label: "Toys & Games" },
  { value: "🍼", label: "Baby Food / Diapers" },
  { value: "🚼", label: "Strollers / Baby Gear" },
  { value: "⚽", label: "Sportswear" },
  { value: "🏀", label: "Sports Equipment" },
  { value: "🧢", label: "Outdoor / Fitness Accessories" },
  { value: "📚", label: "Books & Stationery" },
  { value: "🖨️", label: "Printing / Photocopying" },
  { value: "🔖", label: "Labels / Tags / Sales" },
  { value: "🧾", label: "Receipts / Customer Service" },
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
      (o) => o.label.toLowerCase().includes(q) || o.value.includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (open && options.length > 0) {
      if (highlighted < 0) setHighlighted(0);
      else if (highlighted >= options.length) setHighlighted(options.length - 1);
    } else {
      setHighlighted(-1);
    }
  }, [open, options.length]);

  // Ensure highlighted item is visible
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
                  "flex items-center gap-2 cursor-pointer rounded px-2 py-1",
                  highlighted === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/30"
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
