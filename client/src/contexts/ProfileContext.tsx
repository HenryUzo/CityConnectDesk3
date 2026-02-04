import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

type ProfileContextType = {
  profileImage: string | null;
  setProfileImage: (image: string | null) => void;
  firstName: string;
  setFirstName: (name: string) => void;
  lastName: string;
  setLastName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  isLoading: boolean;
  saveProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('profileImage');
      return saved || null;
    } catch {
      return null;
    }
  });

  const [firstName, setFirstName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('firstName');
      return saved || 'User';
    } catch {
      return 'User';
    }
  });

  const [lastName, setLastName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('lastName');
      return saved || '';
    } catch {
      return '';
    }
  });

  const [email, setEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('email');
      return saved || '';
    } catch {
      return '';
    }
  });

  const [phone, setPhone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('phone');
      return saved || '';
    } catch {
      return '';
    }
  });

  // Fetch profile from backend on mount
  const refreshProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("GET", "/api/app/profile");
      const data = await res.json();
      
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(data.phone);
      if (data.profileImage) setProfileImage(data.profileImage);
    } catch (error) {
      // Silently fail - user may not be logged in
      console.log("Profile fetch failed, using local data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save profile to backend
  const saveProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiRequest("PATCH", "/api/app/profile", {
        firstName,
        lastName,
        email,
        phone,
        profileImage,
      });
    } catch (error) {
      console.error("Failed to save profile:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [firstName, lastName, email, phone, profileImage]);

  // Load profile on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    try {
      if (profileImage) {
        localStorage.setItem('profileImage', profileImage);
      } else {
        localStorage.removeItem('profileImage');
      }
    } catch {}
  }, [profileImage]);

  useEffect(() => {
    try {
      localStorage.setItem('firstName', firstName);
    } catch {}
  }, [firstName]);

  useEffect(() => {
    try {
      localStorage.setItem('lastName', lastName);
    } catch {}
  }, [lastName]);

  useEffect(() => {
    try {
      localStorage.setItem('email', email);
    } catch {}
  }, [email]);

  useEffect(() => {
    try {
      localStorage.setItem('phone', phone);
    } catch {}
  }, [phone]);

  return (
    <ProfileContext.Provider
      value={{
        profileImage,
        setProfileImage,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        email,
        setEmail,
        phone,
        setPhone,
        isLoading,
        saveProfile,
        refreshProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    // Provide a safe fallback so components can render without a provider.
    return {
      profileImage: null,
      setProfileImage: () => {},
      firstName: 'User',
      setFirstName: () => {},
      lastName: '',
      setLastName: () => {},
      email: '',
      setEmail: () => {},
      phone: '',
      setPhone: () => {},
      isLoading: false,
      saveProfile: async () => {},
      refreshProfile: async () => {},
    } as ProfileContextType;
  }
  return context;
}