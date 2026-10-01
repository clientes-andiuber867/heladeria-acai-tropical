import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import { errorMessage } from "../lib/format";
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState(location.pathname === "/password");
  const identity = useRef<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const userId = session.user.id;
    const revision = ++request.current;
    setError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    if (identity.current !== userId || revision !== request.current) return;
    if (error) setError(errorMessage(error));
    setProfile(data);
    setLoading(false);
  }, [session?.user.id]);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (identity.current !== (next?.user.id ?? null)) {
        identity.current = next?.user.id ?? null;
        ++request.current;
        setProfile(null);
        setError("");
        setLoading(!!next);
      }
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRecovery(false);
      }
      if (!next) setLoading(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(errorMessage(error));
        setLoading(false);
      }
      identity.current = data.session?.user.id ?? null;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    void refresh();
    if (!session?.user) return;
    const channel = supabase
      .channel(`profile-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, session?.user.id]);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setSession(null);
  }
  return (
    <Context.Provider
      value={{ session, profile, loading, error, recovery, refresh, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
