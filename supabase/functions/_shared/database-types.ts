
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
          id: string
          created_at: string
          updated_at: string
          title: string
          content: string
          featured_image: string | null
          slug: string | null
          meta_description: string | null
          status: string
          scheduled_post_id: string | null
          fact_checked: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          content: string
          featured_image?: string | null
          slug?: string | null
          meta_description?: string | null
          status?: string
          scheduled_post_id?: string | null
          fact_checked?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          content?: string
          featured_image?: string | null
          slug?: string | null
          meta_description?: string | null
          status?: string
          scheduled_post_id?: string | null
          fact_checked?: boolean
        }
      }
      fact_check_results: {
        Row: {
          id: string
          created_at: string
          post_id: string
          issues: Json[] | null
          status: string
          reviewed: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          post_id: string
          issues?: Json[] | null
          status?: string
          reviewed?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          post_id?: string
          issues?: Json[] | null
          status?: string
          reviewed?: boolean
        }
      }
      scheduled_posts: {
        Row: {
          id: string
          created_at: string
          scheduled_for: string
          num_posts: number
          topics: string[] | null
          auto_generate_topics: boolean
          auto_fact_check: boolean
          status: string
          completed_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          scheduled_for: string
          num_posts: number
          topics?: string[] | null
          auto_generate_topics?: boolean
          auto_fact_check?: boolean
          status?: string
          completed_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          scheduled_for?: string
          num_posts?: number
          topics?: string[] | null
          auto_generate_topics?: boolean
          auto_fact_check?: boolean
          status?: string
          completed_at?: string | null
          error_message?: string | null
        }
      }
    }
  }
}
