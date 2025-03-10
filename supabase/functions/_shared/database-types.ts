
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      blog_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          meta_description: string | null
          scheduled_post_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta_description?: string | null
          scheduled_post_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          scheduled_post_id?: string | null
          title?: string
          updated_at?: string
        }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
