// Complete Settings Main component matching the Figma design
import { useState, useRef } from "react";
import {
  AlignLeft,
  Bold,
  Clock,
  Flag,
  Italic,
  List,
  Mail,
  Plus,
  Share2,
  Underline,
} from "lucide-react";
// Placeholder header image (asset may be missing in this environment)
const headerImage = "";

import { ProfilePics } from "../../components/ui/ProfilePics";
import { useProfile } from "../../contexts/ProfileContext";
import { svgPaths } from "../../components/ui/icon";

// ============ PAGE HEADER ============
function PageHeader() {
  const { firstName, lastName, email } = useProfile();
  
  return (
    <div className="content-stretch flex flex-col items-center pb-[96px] pt-0 px-0 relative shrink-0 w-full">
      {/* Background Image */}
      <div className="h-[200px] mb-[-96px] relative shrink-0 w-full">
        <div className="absolute h-[240px] left-0 overflow-clip right-0 top-0">
          <div className="absolute h-[150px] left-[-7.79%] right-[-7.79%] top-0">
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
              <img alt="" className="absolute max-w-none object-50%-50% object-cover size-full" src={headerImage} />
              <div className="absolute bg-[rgba(0,142,45,0.17)] inset-0" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Header */}
      <div className="mb-[-96px] relative shrink-0 w-full">
        <div className="size-full">
          <div className="content-stretch flex gap-[24px] items-start px-[32px] py-0 relative w-full">
            {/* Avatar */}
            <ProfilePics size={160} withBorder />
            
            {/* Name and Actions */}
            <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px pb-0 pt-[64px] px-0 relative shrink-0">
              <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-full">
                <div className="basis-0 content-stretch flex flex-col gap-[4px] grow items-start min-h-px min-w-px not-italic relative shrink-0">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[38px] relative shrink-0 text-[#101828] text-[30px] w-full">{firstName} {lastName}</p>
                  <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] relative shrink-0 text-[#667085] text-[16px] w-full">{email}</p>
                </div>
                <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
                  <button className="bg-white hover:shadow-md transition-shadow relative rounded-[8px] shrink-0 cursor-pointer border-none">
                    <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip px-[16px] py-[10px] relative rounded-[inherit]">
                      <Share2 size={20} className="text-[#344054]" />
                      <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#344054] text-[14px] text-nowrap">Share</p>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </button>
                  <button className="bg-[#039855] hover:bg-[#027a48] transition-colors relative rounded-[4px] shrink-0 cursor-pointer border-none">
                    <div className="content-stretch flex items-center justify-center overflow-clip px-[14px] py-[10px] relative rounded-[inherit]">
                      <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap text-white">View profile</p>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[#039855] border-solid inset-0 pointer-events-none rounded-[4px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PERSONAL INFO SECTION ============
function PersonalInfoSection({
  pendingProfileImage,
  onImageSelect,
  onSaveChanges,
  onCancel,
  pendingFirstName,
  setPendingFirstName,
  pendingLastName,
  setPendingLastName,
  pendingEmail,
  setPendingEmail,
  isSaving
}: {
  pendingProfileImage: string | null;
  onImageSelect: (image: string) => void;
  onSaveChanges: () => void;
  onCancel: () => void;
  pendingFirstName: string;
  setPendingFirstName: (name: string) => void;
  pendingLastName: string;
  setPendingLastName: (name: string) => void;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  isSaving?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-full">
      <div className="content-stretch flex flex-col items-start leading-[20px] not-italic relative shrink-0 text-[14px] w-[280px]">
        <p className="font-['General_Sans:Medium',sans-serif] relative shrink-0 text-[#344054] w-full">Personal info</p>
        <p className="font-['General_Sans:Regular',sans-serif] relative shrink-0 text-[#667085] w-full">Update your photo and personal details.</p>
      </div>
      
      <div className="bg-white content-stretch flex flex-col h-[417px] items-start overflow-clip relative rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] shrink-0 w-full">
        <div className="relative shrink-0 w-full">
          <div className="size-full">
            <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
              {/* First name, Last name, and Email */}
              <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
                <div className="basis-0 content-stretch flex flex-col grow items-start max-w-[204px] min-h-px min-w-[200px] relative shrink-0">
                  <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                    <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">First name</p>
                    <div className="bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full">
                      <input type="text" value={pendingFirstName} onChange={(e) => setPendingFirstName(e.target.value)} className="flex flex-row items-center min-w-[inherit] overflow-clip rounded-[inherit] size-full px-[12px] py-[6px] font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none" />
                      <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                    </div>
                  </div>
                </div>
                <div className="content-stretch flex flex-col items-start max-w-[204px] min-w-[200px] relative shrink-0 w-[204px]">
                  <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                    <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Last name</p>
                    <div className="bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full">
                      <input type="text" value={pendingLastName} onChange={(e) => setPendingLastName(e.target.value)} className="flex flex-row items-center min-w-[inherit] overflow-clip rounded-[inherit] size-full px-[12px] py-[6px] font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none" />
                      <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                    </div>
                  </div>
                </div>
                <div className="content-stretch flex flex-col items-start max-w-[204px] min-w-[200px] relative shrink-0 w-full">
                  <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                    <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Email</p>
                    <div className="bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full">
                      <div className="flex flex-row items-center min-w-[inherit] overflow-clip rounded-[inherit] size-full px-[12px] py-[6px]">
                        <Mail size={16} className="mr-2 text-[#667085]" />
                        <input type="email" value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} className="flex-1 font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none bg-transparent" />
                      </div>
                      <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Photo Upload */}
              <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-full">
                <ProfilePics size={64} customImage={pendingProfileImage} />
                <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px relative shrink-0">
                  <div className="bg-white relative rounded-[8px] shrink-0 w-full">
                    <div aria-hidden="true" className="absolute border border-[#eaecf0] border-solid inset-0 pointer-events-none rounded-[8px]" />
                    <div className="flex flex-col items-center size-full px-[24px] py-[16px]">
                      <div className="bg-[#f2f4f7] relative rounded-[28px] shrink-0 size-[40px] mb-3 flex items-center justify-center">
                        <Plus size={20} className="text-[#475467]" />
                      </div>
                      <div className="text-center">
                        <button className="font-['General_Sans:Medium',sans-serif] leading-[20px] text-[#027a48] text-[14px] hover:underline bg-transparent border-none cursor-pointer p-0" onClick={handleUploadClick}>Click to upload</button>
                        <span className="font-['General_Sans:Regular',sans-serif] leading-[20px] text-[#667085] text-[14px]"> or drag and drop</span>
                      </div>
                      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#667085] text-[12px] text-center mt-1">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
          <div className="bg-[#eaecf0] h-px shrink-0 w-full" />
          <div className="flex justify-end px-[24px] py-[16px] w-full">
            <div className="flex gap-[12px]">
              <button className="bg-white hover:shadow-md transition-shadow rounded-[4px] px-[14px] py-[10px] cursor-pointer border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" onClick={onCancel} disabled={isSaving}>
                <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] text-[#344054] text-[14px]">Cancel</p>
              </button>
              <button className="bg-[#039855] hover:bg-[#027a48] transition-colors rounded-[4px] px-[14px] py-[10px] cursor-pointer border border-[#039855] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] disabled:opacity-50" onClick={onSaveChanges} disabled={isSaving}>
                <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] text-white text-[14px]">{isSaving ? 'Saving...' : 'Save changes'}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PROFILE SECTION ============
function ProfileSection() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-full">
      <div className="content-stretch flex flex-col items-start leading-[20px] not-italic relative shrink-0 text-[14px] w-[280px]">
        <p className="font-['General_Sans:Medium',sans-serif] relative shrink-0 text-[#344054] w-full">Profile</p>
        <p className="font-['General_Sans:Regular',sans-serif] relative shrink-0 text-[#667085] w-full">Update your portfolio and bio.</p>
      </div>
      
      <div className="bg-white content-stretch flex flex-col h-[773px] items-start overflow-clip relative rounded-[8px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] shrink-0 w-full">
        <div className="relative shrink-0 w-full">
          <div className="size-full">
            <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
              {/* Available for projects toggle */}
              <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#039855] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
                <div className="basis-0 content-stretch flex flex-col grow items-start leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[14px]">
                  <p className="font-['General_Sans:Medium',sans-serif] relative shrink-0 text-[#344054] w-full">Available for projects</p>
                  <p className="font-['General_Sans:Regular',sans-serif] relative shrink-0 text-[#667085] w-full">I'm open and available for freelance work.</p>
                </div>
              </div>
              
              {/* Username */}
              <div className="content-stretch flex flex-col items-start max-w-[204px] min-w-[200px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Username</p>
                  <div className="bg-white content-stretch flex items-start min-w-[200px] relative rounded-[8px] shrink-0 w-full">
                    <div className="content-stretch flex items-center pl-[12px] pr-[6px] py-[6px] relative rounded-bl-[8px] rounded-tl-[8px] shrink-0">
                      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#667085] text-[12px] text-nowrap">untitledui.com/</p>
                    </div>
                    <input type="text" defaultValue="olivia" className="basis-0 grow min-h-px min-w-px rounded-br-[8px] rounded-tr-[8px] px-[12px] py-[6px] font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none bg-white" />
                    <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </div>
                </div>
              </div>

              {/* Website */}
              <div className="content-stretch flex flex-col items-start max-w-[204px] min-w-[200px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Website</p>
                  <div className="bg-white content-stretch flex items-start min-w-[200px] relative rounded-[8px] shrink-0 w-full">
                    <div className="content-stretch flex items-center pl-[12px] pr-[6px] py-[6px] relative rounded-bl-[8px] rounded-tl-[8px] shrink-0">
                      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#667085] text-[12px] text-nowrap">http://</p>
                    </div>
                    <input type="text" defaultValue="www.untitledui.com" className="basis-0 grow min-h-px min-w-px rounded-br-[8px] rounded-tr-[8px] px-[12px] py-[6px] font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none bg-white" />
                    <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="content-stretch flex flex-col h-[180px] items-start relative shrink-0 w-full">
                <div className="basis-0 content-stretch flex flex-col gap-[6px] grow items-start min-h-px min-w-px relative shrink-0 w-full">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Bio</p>
                  <div className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0 w-full">
                    <textarea defaultValue="I'm a Product Designer based in Melbourne, Australia. I specialise in UX/UI design, brand strategy, and Webflow development." className="flex flex-row items-center overflow-clip rounded-[inherit] size-full px-[14px] py-[10px] font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none resize-none" />
                    <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </div>
                  <p className="font-['General_Sans:Regular',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#667085] text-[10px] w-full">275 characters left</p>
                </div>
              </div>

              {/* Text formatting toolbar */}
              <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-full">
                <div className="h-[44px] relative shrink-0 w-[240px]">
                  <select className="bg-white relative rounded-[8px] w-full h-full px-[12px] py-[6px] font-['General_Sans:Medium',sans-serif] leading-[24px] text-[#101828] text-[12px] border border-[#f2f4f7] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] cursor-pointer">
                    <option>Normal text</option>
                  </select>
                </div>
                <div className="content-stretch flex gap-[4px] items-start relative shrink-0">
                  {[
                    { Icon: Bold, label: "Bold" },
                    { Icon: Italic, label: "Italic" },
                    { Icon: Underline, label: "Underline" },
                    { Icon: AlignLeft, label: "Align left" },
                    { Icon: List, label: "List" },
                  ].map(({ Icon }) => (
                    <button
                      key={Icon.name}
                      className="size-[32px] flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded bg-transparent border-none"
                      type="button"
                      aria-label={Icon.name}
                    >
                      <Icon size={18} className="text-[#98A2B3]" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div className="h-[70px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Country</p>
                  <div className="bg-white relative rounded-[8px] shrink-0 w-full">
                    <div className="flex flex-row items-center size-full px-[12px] py-[6px]">
                      <Flag size={16} className="mr-2 text-[#344054]" />
                      <select className="flex-1 font-['General_Sans:Medium',sans-serif] leading-[24px] text-[#101828] text-[12px] border-none outline-none bg-transparent cursor-pointer">
                        <option>United States</option>
                      </select>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </div>
                </div>
              </div>

              {/* Timezone */}
              <div className="h-[70px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
                  <p className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap">Timezone</p>
                  <div className="bg-white relative rounded-[8px] shrink-0 w-full">
                    <div className="flex flex-row items-center size-full px-[12px] py-[6px]">
                      <Clock size={16} className="relative shrink-0 mr-2 text-[#667085]" />
                      <div className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0">
                        <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#101828] text-[12px] text-nowrap">Pacific Standard Time (PST)</p>
                        <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#667085] text-[12px] text-nowrap">UTC−08:00</p>
                      </div>
                      <svg className="relative shrink-0 size-[16px]" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
                        <path d="M4 6L8 10L12 6" stroke="#667085" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                      </svg>
                    </div>
                    <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
          <div className="bg-[#eaecf0] h-px shrink-0 w-full" />
          <div className="flex justify-end px-[24px] py-[16px] w-full">
            <div className="flex gap-[12px]">
              <button className="bg-white hover:shadow-md transition-shadow rounded-[4px] px-[14px] py-[10px] cursor-pointer border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] text-[#344054] text-[14px]">Cancel</p>
              </button>
              <button className="bg-[#039855] hover:bg-[#027a48] transition-colors rounded-[4px] px-[14px] py-[10px] cursor-pointer border border-[#039855] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] text-white text-[14px]">Save changes</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN EXPORT ============
export default function SettingsMain() {
  const { firstName, lastName, email, phone, setProfileImage, setFirstName, setLastName, setEmail, setPhone, saveProfile, isLoading } = useProfile();
  const [pendingProfileImage, setPendingProfileImage] = useState<string | null>(null);
  const [pendingFirstName, setPendingFirstName] = useState<string>(firstName);
  const [pendingLastName, setPendingLastName] = useState<string>(lastName);
  const [pendingEmail, setPendingEmail] = useState<string>(email);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageSelect = (image: string) => {
    setPendingProfileImage(image);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Commit all pending changes to local state first
      if (pendingProfileImage) {
        setProfileImage(pendingProfileImage);
      }
      setFirstName(pendingFirstName);
      setLastName(pendingLastName);
      setEmail(pendingEmail);
      
      // Then save to backend
      await saveProfile();
      setPendingProfileImage(null);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Discard all pending changes and reset to saved values
    setPendingProfileImage(null);
    setPendingFirstName(firstName);
    setPendingLastName(lastName);
    setPendingEmail(email);
  };

  return (
    <div className="basis-0 bg-white content-stretch flex flex-col gap-[32px] grow items-start min-h-px min-w-px pb-[32px] pt-[32px] px-0 relative rounded-bl-[40px] rounded-tl-[40px] shrink-0 w-full h-full overflow-y-auto">
      <PageHeader />
      <div className="content-stretch flex flex-col gap-[32px] items-center px-[32px] py-0 relative shrink-0 w-full">
        <PersonalInfoSection
          pendingProfileImage={pendingProfileImage}
          onImageSelect={handleImageSelect}
          onSaveChanges={handleSaveChanges}
          onCancel={handleCancel}
          pendingFirstName={pendingFirstName}
          setPendingFirstName={setPendingFirstName}
          pendingLastName={pendingLastName}
          setPendingLastName={setPendingLastName}
          pendingEmail={pendingEmail}
          setPendingEmail={setPendingEmail}
          isSaving={isSaving}
        />
        <ProfileSection />
      </div>
    </div>
  );
}
