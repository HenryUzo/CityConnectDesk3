import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type ProfileContextType = {
  profileImage: string | null;
  setProfileImage: (image: string | null) => void;
  firstName: string;
  setFirstName: (name: string) => void;
  lastName: string;
  setLastName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
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
      return saved || 'Olivia';
    } catch {
      return 'Olivia';
    }
  });

  const [lastName, setLastName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('lastName');
      return saved || 'Mills';
    } catch {
      return 'Mills';
    }
  });

  const [email, setEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('email');
      return saved || 'olivia@example.com';
    } catch {
      return 'olivia@example.com';
    }
  });

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
      firstName: 'Olivia',
      setFirstName: () => {},
      lastName: 'Mills',
      setLastName: () => {},
      email: 'olivia@example.com',
      setEmail: () => {},
    } as ProfileContextType;
  }
  return context;
}