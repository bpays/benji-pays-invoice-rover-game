export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_invites: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          label: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          label: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          label?: string
          tag?: string
        }
        Relationships: []
      }
      game_runs: {
        Row: {
          email: string | null
          ended_at: string | null
          event_tag: string | null
          id: string
          player_name: string | null
          started_at: string
        }
        Insert: {
          email?: string | null
          ended_at?: string | null
          event_tag?: string | null
          id?: string
          player_name?: string | null
          started_at?: string
        }
        Update: {
          email?: string | null
          ended_at?: string | null
          event_tag?: string | null
          id?: string
          player_name?: string | null
          started_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          best_combo: number | null
          city_flag: string | null
          city_reached: string | null
          created_at: string | null
          duration_s: number | null
          email: string | null
          event_tag: string | null
          flagged: boolean | null
          id: string
          player_name: string
          run_id: string | null
          score: number
        }
        Insert: {
          best_combo?: number | null
          city_flag?: string | null
          city_reached?: string | null
          created_at?: string | null
          duration_s?: number | null
          email?: string | null
          event_tag?: string | null
          flagged?: boolean | null
          id?: string
          player_name: string
          run_id?: string | null
          score?: number
        }
        Update: {
          best_combo?: number | null
          city_flag?: string | null
          city_reached?: string | null
          created_at?: string | null
          duration_s?: number | null
          email?: string | null
          event_tag?: string | null
          flagged?: boolean | null
          id?: string
          player_name?: string
          run_id?: string | null
          score?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      submit_rate_buckets: {
        Row: {
          bucket_key: string
          hit_count: number
          window_id: number
        }
        Insert: {
          bucket_key: string
          hit_count?: number
          window_id: number
        }
        Update: {
          bucket_key?: string
          hit_count?: number
          window_id?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_scores: {
        Row: {
          best_combo: number | null
          city_flag: string | null
          city_reached: string | null
          created_at: string | null
          event_tag: string | null
          flagged: boolean | null
          id: string | null
          player_name: string | null
          score: number | null
        }
        Insert: {
          best_combo?: number | null
          city_flag?: string | null
          city_reached?: string | null
          created_at?: string | null
          event_tag?: string | null
          flagged?: boolean | null
          id?: string | null
          player_name?: string | null
          score?: number | null
        }
        Update: {
          best_combo?: number | null
          city_flag?: string | null
          city_reached?: string | null
          created_at?: string | null
          event_tag?: string | null
          flagged?: boolean | null
          id?: string | null
          player_name?: string | null
          score?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_submit_score_rate_limit: {
        Args: {
          p_email_key: string
          p_ip_key: string
          p_max_email?: number
          p_max_ip?: number
          p_window_secs?: number
        }
        Returns: boolean
      }
      get_admin_stats: { Args: { p_event_tag?: string }; Returns: Json }
      get_daily_board_clock: {
        Args: never
        Returns: {
          seconds_until_reset: number
          timezone: string
        }[]
      }
      get_daily_dashboard: {
        Args: { p_event_tag?: string; p_limit?: number }
        Returns: Json
      }
      get_daily_leaderboard: {
        Args: { p_event_tag?: string; p_limit?: number }
        Returns: {
          best_combo: number
          city_flag: string
          city_reached: string
          created_at: string
          event_tag: string
          id: string
          player_name: string
          score: number
        }[]
      }
      get_event_dashboard: {
        Args: { p_event_tag?: string; p_limit?: number }
        Returns: Json
      }
      get_event_submission_count: {
        Args: { p_event_tag?: string }
        Returns: number
      }
      get_leaderboard: {
        Args: { p_event_tag?: string; p_limit?: number }
        Returns: {
          best_combo: number
          city_flag: string
          city_reached: string
          created_at: string
          event_tag: string
          id: string
          player_name: string
          score: number
        }[]
      }
      get_today_run_count: { Args: { p_event_tag?: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
