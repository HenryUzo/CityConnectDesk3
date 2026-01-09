import React from "react";
import { SecButton } from "@/components/ui/buttons";
import { formatTicketStatusLabel } from "./CityBuddyMessage";

export type ProviderComparisonItem = {
  id: string;
  name: string;
  rating: number;
  completedJobs: number;
  responseTime: string;
  locationCoverage: string;
  verificationStatus: "Verified" | "Pending";
  yearsExperience?: number;
  badges: string[];
  estimatedStartingPrice?: number;
  availability?: string;
};

export default function ProviderComparison({
  providers,
  selectedProviderId,
  onSelect,
  onClose,
}: {
  providers: ProviderComparisonItem[];
  selectedProviderId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  if (!providers || providers.length === 0) return null;

  return (
    <div className="bg-white rounded-md shadow-md p-4 max-w-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Here’s a side-by-side comparison to help you choose what works best for you.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="text-sm text-slate-600 hover:underline">Close</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-48 text-left pr-4"></th>
              {providers.map((p) => (
                <th key={p.id} className="text-left px-4 align-top">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.locationCoverage || "Not available"}</div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Rating</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{Number.isFinite(p.rating) ? p.rating.toFixed(1) : "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Completed jobs</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{Number.isFinite(p.completedJobs) ? p.completedJobs : "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Response time</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.responseTime || "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Verification</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.verificationStatus || "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Experience</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.yearsExperience ? `${p.yearsExperience} yrs` : "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Badges</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.badges && p.badges.length ? p.badges.join(", ") : "None"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Starting price</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.estimatedStartingPrice ? `₦${p.estimatedStartingPrice.toLocaleString()}` : "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-2 text-sm font-medium">Availability</td>
              {providers.map((p) => (
                <td key={p.id} className="py-2 px-4 text-sm">{p.availability || "Not available"}</td>
              ))}
            </tr>

            <tr className="border-t">
              <td className="py-3" />
              {providers.map((p) => (
                <td key={p.id} className="py-3 px-4">
                  <div className="flex gap-2">
                    <SecButton onClick={() => onSelect(p.id)} disabled={selectedProviderId === p.id}>
                      {selectedProviderId === p.id ? "Selected" : "Select"}
                    </SecButton>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <button onClick={onClose} className="text-sm text-slate-600 hover:underline">Close</button>
      </div>
    </div>
  );
}
