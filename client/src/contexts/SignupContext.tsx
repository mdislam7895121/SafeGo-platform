import { createContext, useContext, useState, ReactNode } from "react";

interface PendingSignup {
  email: string;
  password: string;
  countryCode: string;
}

interface SignupContextType {
  pendingSignup: PendingSignup | null;
  setPendingSignup: (data: PendingSignup | null) => void;
  clearPendingSignup: () => void;
}

const SignupContext = createContext<SignupContextType | undefined>(undefined);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [pendingSignup, setPendingSignupState] = useState<PendingSignup | null>(null);

  const setPendingSignup = (data: PendingSignup | null) => {
    setPendingSignupState(data);
  };

  const clearPendingSignup = () => {
    setPendingSignupState(null);
  };

  return (
    <SignupContext.Provider value={{ pendingSignup, setPendingSignup, clearPendingSignup }}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (context === undefined) {
    throw new Error("useSignup must be used within a SignupProvider");
  }
  return context;
}
