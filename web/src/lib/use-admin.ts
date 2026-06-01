"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin ?? false);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isAdmin, loading };
}
