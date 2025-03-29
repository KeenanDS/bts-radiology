export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      blog_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          meta_description: string | null
          scheduled_post_id: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta_description?: string | null
          scheduled_post_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          scheduled_post_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_scheduled_post"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_check_results: {
        Row: {
          checked_at: string
          created_at: string
          id: string
          issues: Json
          post_id: string | null
          updated_at: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          id?: string
          issues?: Json
          post_id?: string | null
          updated_at?: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          id?: string
          issues?: Json
          post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_check_results_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_processing_error: string | null
          audio_processing_status: string | null
          audio_url: string | null
          background_music_url: string | null
          created_at: string
          custom_title: string | null
          id: string
          is_featured: boolean | null
          news_stories: Json | null
          podcast_script: string | null
          processed_audio_url: string | null
          scheduled_for: string
          status: string
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          audio_processing_error?: string | null
          audio_processing_status?: string | null
          audio_url?: string | null
          background_music_url?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          is_featured?: boolean | null
          news_stories?: Json | null
          podcast_script?: string | null
          processed_audio_url?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          audio_processing_error?: string | null
          audio_processing_status?: string | null
          audio_url?: string | null
          background_music_url?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          is_featured?: boolean | null
          news_stories?: Json | null
          podcast_script?: string | null
          processed_audio_url?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          auto_fact_check: boolean
          auto_generate_topics: boolean
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          num_posts: number
          scheduled_for: string
          status: string
          topics: Json | null
        }
        Insert: {
          auto_fact_check?: boolean
          auto_generate_topics?: boolean
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          num_posts?: number
          scheduled_for: string
          status?: string
          topics?: Json | null
        }
        Update: {
          auto_fact_check?: boolean
          auto_generate_topics?: boolean
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          num_posts?: number
          scheduled_for?: string
          status?: string
          topics?: Json | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_global_administrator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      user_has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "global_administrator" | "owner" | "administrator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
