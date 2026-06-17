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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_log: {
        Row: {
          action: string
          created_at: string
          id: number
          ip_address: unknown
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          ip_address?: unknown
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          ip_address?: unknown
          user_id?: string | null
        }
        Relationships: []
      }
      amatur_cache: {
        Row: {
          fetched_at: string
          html: string
          id: string
        }
        Insert: {
          fetched_at?: string
          html: string
          id: string
        }
        Update: {
          fetched_at?: string
          html?: string
          id?: string
        }
        Relationships: []
      }
      badge_awards: {
        Row: {
          awarded_at: string
          category: Database["public"]["Enums"]["challenge_category"]
          completed_count: number
          created_at: string
          id: string
          source_submission_id: string | null
          tier: Database["public"]["Enums"]["badge_level"]
          user_id: string
        }
        Insert: {
          awarded_at?: string
          category: Database["public"]["Enums"]["challenge_category"]
          completed_count: number
          created_at?: string
          id?: string
          source_submission_id?: string | null
          tier: Database["public"]["Enums"]["badge_level"]
          user_id: string
        }
        Update: {
          awarded_at?: string
          category?: Database["public"]["Enums"]["challenge_category"]
          completed_count?: number
          created_at?: string
          id?: string
          source_submission_id?: string | null
          tier?: Database["public"]["Enums"]["badge_level"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_awards_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "challenge_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_assignments: {
        Row: {
          assigned_at: string
          assigned_for_month: string
          challenge_id: string
          expires_at: string | null
          id: string
          metadata: Json
          source: string
          status: Database["public"]["Enums"]["assignment_status"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_for_month: string
          challenge_id: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_for_month?: string
          challenge_id?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_assignments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_master_history: {
        Row: {
          awarded_at: string
          badge_snapshot: Json
          id: string
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_snapshot?: Json
          id?: string
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_snapshot?: Json
          id?: string
          season_id?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_submissions: {
        Row: {
          assignment_id: string | null
          auto_review_reason: string | null
          challenge_id: string
          event_id: number | null
          id: string
          metadata: Json
          notes: string | null
          occurred_at: string | null
          proof_text: string | null
          proof_urls: Json
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Insert: {
          assignment_id?: string | null
          auto_review_reason?: string | null
          challenge_id: string
          event_id?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string | null
          proof_text?: string | null
          proof_urls?: Json
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Update: {
          assignment_id?: string | null
          auto_review_reason?: string | null
          challenge_id?: string
          event_id?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string | null
          proof_text?: string | null
          proof_urls?: Json
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id?: string
          verification_type?: Database["public"]["Enums"]["verification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "challenge_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "challenge_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_validations: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["validation_status"]
          submission_id: string
          validator_user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          submission_id: string
          validator_user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          submission_id?: string
          validator_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_validations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "challenge_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          category: Database["public"]["Enums"]["challenge_category"]
          code: string
          cooldown_hours: number
          created_at: string
          description: string | null
          difficulty_score: number | null
          id: string
          is_active: boolean
          legacy_code: string | null
          metadata: Json
          monthly_weight: number
          per_day_cap: number
          requires_proof: boolean
          title: string
          title_key: string | null
          updated_at: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Insert: {
          category: Database["public"]["Enums"]["challenge_category"]
          code: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          difficulty_score?: number | null
          id?: string
          is_active?: boolean
          legacy_code?: string | null
          metadata?: Json
          monthly_weight?: number
          per_day_cap?: number
          requires_proof?: boolean
          title: string
          title_key?: string | null
          updated_at?: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Update: {
          category?: Database["public"]["Enums"]["challenge_category"]
          code?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          difficulty_score?: number | null
          id?: string
          is_active?: boolean
          legacy_code?: string | null
          metadata?: Json
          monthly_weight?: number
          per_day_cap?: number
          requires_proof?: boolean
          title?: string
          title_key?: string | null
          updated_at?: string
          verification_type?: Database["public"]["Enums"]["verification_type"]
        }
        Relationships: []
      }
      checkin_moments: {
        Row: {
          caption: string | null
          checkin_id: number
          created_at: string
          deleted_at: string | null
          flagged: boolean
          id: number
          photo_url: string
          user_id: string
          venue_id: number
        }
        Insert: {
          caption?: string | null
          checkin_id: number
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          id?: number
          photo_url: string
          user_id?: string
          venue_id: number
        }
        Update: {
          caption?: string | null
          checkin_id?: number
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          id?: number
          photo_url?: string
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkin_moments_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: true
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_moments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "checkin_moments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          ended_at: string
          friends: string[] | null
          id: number
          open_to_play: boolean
          session_note: string | null
          started_at: string
          table_number: number | null
          user_id: string
          venue_id: number
        }
        Insert: {
          ended_at?: string
          friends?: string[] | null
          id?: number
          open_to_play?: boolean
          session_note?: string | null
          started_at?: string
          table_number?: number | null
          user_id: string
          venue_id: number
        }
        Update: {
          ended_at?: string
          friends?: string[] | null
          id?: number
          open_to_play?: boolean
          session_note?: string | null
          started_at?: string
          table_number?: number | null
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkins_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkins_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkins_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkins_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "checkins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          active: boolean | null
          admin_area: string | null
          country_code: string
          country_name: string
          county: string | null
          created_at: string
          expansion_status: string
          id: number
          lat: number | null
          lng: number | null
          local_area: string | null
          name: string
          updated_at: string
          venue_count: number | null
          zoom: number | null
        }
        Insert: {
          active?: boolean | null
          admin_area?: string | null
          country_code?: string
          country_name?: string
          county?: string | null
          created_at?: string
          expansion_status?: string
          id?: number
          lat?: number | null
          lng?: number | null
          local_area?: string | null
          name: string
          updated_at?: string
          venue_count?: number | null
          zoom?: number | null
        }
        Update: {
          active?: boolean | null
          admin_area?: string | null
          country_code?: string
          country_name?: string
          county?: string | null
          created_at?: string
          expansion_status?: string
          id?: number
          lat?: number | null
          lng?: number | null
          local_area?: string | null
          name?: string
          updated_at?: string
          venue_count?: number | null
          zoom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      city_tombstones: {
        Row: {
          city_id: number
          deleted_at: string
        }
        Insert: {
          city_id: number
          deleted_at?: string
        }
        Update: {
          city_id?: number
          deleted_at?: string
        }
        Relationships: []
      }
      club_members: {
        Row: {
          club_id: number
          id: number
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: number
          id?: number
          joined_at?: string
          role?: string
          user_id?: string
        }
        Update: {
          club_id?: number
          id?: number
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          avatar_url: string | null
          city_id: number | null
          created_at: string
          description: string | null
          home_venue_id: number | null
          id: number
          join_code: string
          name: string
          owner_id: string
        }
        Insert: {
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string
          description?: string | null
          home_venue_id?: number | null
          id?: number
          join_code: string
          name: string
          owner_id?: string
        }
        Update: {
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string
          description?: string | null
          home_venue_id?: number | null
          id?: number
          join_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "clubs_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          bio: string | null
          contact: string | null
          created_at: string
          experience: string | null
          id: number
          languages: string[]
          levels: string[]
          price_range: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          contact?: string | null
          created_at?: string
          experience?: string | null
          id?: number
          languages?: string[]
          levels?: string[]
          price_range?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          bio?: string | null
          contact?: string | null
          created_at?: string
          experience?: string | null
          id?: number
          languages?: string[]
          levels?: string[]
          price_range?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_venues: {
        Row: {
          coach_id: number
          venue_id: number
        }
        Insert: {
          coach_id: number
          venue_id: number
        }
        Update: {
          coach_id?: number
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_venues_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "coach_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_votes: {
        Row: {
          condition: string
          created_at: string
          id: number
          note: string | null
          photo_url: string | null
          user_id: string
          venue_id: number
        }
        Insert: {
          condition: string
          created_at?: string
          id?: number
          note?: string | null
          photo_url?: string | null
          user_id: string
          venue_id: number
        }
        Update: {
          condition?: string
          created_at?: string
          id?: number
          note?: string | null
          photo_url?: string | null
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "condition_votes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "condition_votes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: number
          notes: string | null
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: number
          notes?: string | null
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: number
          notes?: string | null
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          active: boolean
          code: string
          created_at: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          body: string
          created_at: string
          flagged: boolean
          id: number
          sender_id: string
          thread_id: number
        }
        Insert: {
          body: string
          created_at?: string
          flagged?: boolean
          id?: number
          sender_id?: string
          thread_id: number
        }
        Update: {
          body?: string
          created_at?: string
          flagged?: boolean
          id?: number
          sender_id?: string
          thread_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          a_last_read_at: string | null
          b_last_read_at: string | null
          created_at: string
          id: number
          last_message_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          a_last_read_at?: string | null
          b_last_read_at?: string | null
          created_at?: string
          id?: number
          last_message_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          a_last_read_at?: string | null
          b_last_read_at?: string | null
          created_at?: string
          id?: number
          last_message_at?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      ec_manufacturer_tombstones: {
        Row: {
          category: string
          deleted_at: string
          manufacturer_id: string
        }
        Insert: {
          category: string
          deleted_at?: string
          manufacturer_id: string
        }
        Update: {
          category?: string
          deleted_at?: string
          manufacturer_id?: string
        }
        Relationships: []
      }
      ec_model_tombstones: {
        Row: {
          category: string
          deleted_at: string
          manufacturer_id: string
          model: string
        }
        Insert: {
          category: string
          deleted_at?: string
          manufacturer_id: string
          model: string
        }
        Update: {
          category?: string
          deleted_at?: string
          manufacturer_id?: string
          model?: string
        }
        Relationships: []
      }
      equipment_catalog_manufacturers: {
        Row: {
          category: string
          created_at: string
          manufacturer_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          manufacturer_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          manufacturer_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      equipment_catalog_models: {
        Row: {
          category: string
          created_at: string
          manufacturer_id: string
          model: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          manufacturer_id: string
          model: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          manufacturer_id?: string
          model?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_catalog_models_category_manufacturer_id_fkey"
            columns: ["category", "manufacturer_id"]
            isOneToOne: false
            referencedRelation: "equipment_catalog_manufacturers"
            referencedColumns: ["category", "manufacturer_id"]
          },
        ]
      }
      equipment_history: {
        Row: {
          backhand_rubber_color: string
          backhand_rubber_manufacturer: string
          backhand_rubber_manufacturer_id: string
          backhand_rubber_model: string
          blade_manufacturer: string
          blade_manufacturer_id: string
          blade_model: string
          created_at: string
          dominant_hand: string
          forehand_rubber_color: string
          forehand_rubber_manufacturer: string
          forehand_rubber_manufacturer_id: string
          forehand_rubber_model: string
          grip: string
          id: number
          playing_style: string
          user_id: string
        }
        Insert: {
          backhand_rubber_color: string
          backhand_rubber_manufacturer: string
          backhand_rubber_manufacturer_id: string
          backhand_rubber_model: string
          blade_manufacturer: string
          blade_manufacturer_id: string
          blade_model: string
          created_at?: string
          dominant_hand: string
          forehand_rubber_color: string
          forehand_rubber_manufacturer: string
          forehand_rubber_manufacturer_id: string
          forehand_rubber_model: string
          grip: string
          id?: number
          playing_style: string
          user_id: string
        }
        Update: {
          backhand_rubber_color?: string
          backhand_rubber_manufacturer?: string
          backhand_rubber_manufacturer_id?: string
          backhand_rubber_model?: string
          blade_manufacturer?: string
          blade_manufacturer_id?: string
          blade_model?: string
          created_at?: string
          dominant_hand?: string
          forehand_rubber_color?: string
          forehand_rubber_manufacturer?: string
          forehand_rubber_manufacturer_id?: string
          forehand_rubber_model?: string
          grip?: string
          id?: number
          playing_style?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_reviews: {
        Row: {
          author_grip: string | null
          author_hand: string | null
          author_style: string | null
          body: string | null
          category: string
          control: number | null
          created_at: string
          flag_count: number
          flagged: boolean
          id: number
          manufacturer_id: string
          model: string
          rating: number
          speed: number | null
          spin: number | null
          time_used: string | null
          user_id: string
        }
        Insert: {
          author_grip?: string | null
          author_hand?: string | null
          author_style?: string | null
          body?: string | null
          category: string
          control?: number | null
          created_at?: string
          flag_count?: number
          flagged?: boolean
          id?: number
          manufacturer_id: string
          model: string
          rating: number
          speed?: number | null
          spin?: number | null
          time_used?: string | null
          user_id?: string
        }
        Update: {
          author_grip?: string | null
          author_hand?: string | null
          author_style?: string | null
          body?: string | null
          category?: string
          control?: number | null
          created_at?: string
          flag_count?: number
          flagged?: boolean
          id?: number
          manufacturer_id?: string
          model?: string
          rating?: number
          speed?: number | null
          spin?: number | null
          time_used?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_wear_settings: {
        Row: {
          created_at: string
          expected_hours: number
          id: number
          installed_at: string
          notified_pct: number
          side: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_hours?: number
          id?: number
          installed_at?: string
          notified_pct?: number
          side: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          expected_hours?: number
          id?: number
          installed_at?: string
          notified_pct?: number
          side?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_wear_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_wear_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_wear_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_wear_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          body: string | null
          created_at: string
          event_id: number
          id: number
          rating: number
          reviewer_name: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_id: number
          id?: number
          rating: number
          reviewer_name?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_id?: number
          id?: number
          rating?: number
          reviewer_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          event_id: number
          invited_at: string
          invited_by: string
          user_id: string
        }
        Insert: {
          event_id: number
          invited_at?: string
          invited_by: string
          user_id: string
        }
        Update: {
          event_id?: number
          invited_at?: string
          invited_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: number
          hours_played: number
          id: number
          joined_at: string
          user_id: string
        }
        Insert: {
          event_id: number
          hours_played?: number
          id?: number
          joined_at?: string
          user_id: string
        }
        Update: {
          event_id?: number
          hours_played?: number
          id?: number
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_participants_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_participants_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_participants_user_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          club_id: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: string | null
          id: number
          max_participants: number | null
          organizer_id: string
          parent_event_id: number | null
          recurrence_day: number | null
          recurrence_rule: string | null
          starts_at: string
          status: string | null
          table_number: number | null
          title: string
          venue_id: number | null
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          club_id?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: number
          max_participants?: number | null
          organizer_id: string
          parent_event_id?: number | null
          recurrence_day?: number | null
          recurrence_rule?: string | null
          starts_at: string
          status?: string | null
          table_number?: number | null
          title: string
          venue_id?: number | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          club_id?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: number
          max_participants?: number | null
          organizer_id?: string
          parent_event_id?: number | null
          recurrence_day?: number | null
          recurrence_rule?: string | null
          starts_at?: string
          status?: string | null
          table_number?: number | null
          title?: string
          venue_id?: number | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      explorer_quest_awards: {
        Row: {
          awarded_at: string
          id: number
          quest_key: string
          tier: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: number
          quest_key: string
          tier: string
          user_id?: string
        }
        Update: {
          awarded_at?: string
          id?: number
          quest_key?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explorer_quest_awards_quest_key_fkey"
            columns: ["quest_key"]
            isOneToOne: false
            referencedRelation: "explorer_quests"
            referencedColumns: ["key"]
          },
        ]
      }
      explorer_quests: {
        Row: {
          bronze: number
          city_scoped: boolean
          gold: number
          key: string
          predicate: string
          silver: number
          sort: number
        }
        Insert: {
          bronze: number
          city_scoped?: boolean
          gold: number
          key: string
          predicate: string
          silver: number
          sort?: number
        }
        Update: {
          bronze?: number
          city_scoped?: boolean
          gold?: number
          key?: string
          predicate?: string
          silver?: number
          sort?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: number
          user_id: string
          venue_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          user_id: string
          venue_id: number
        }
        Update: {
          created_at?: string
          id?: number
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_request_votes: {
        Row: {
          created_at: string
          feature_request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_request_votes_feature_request_id_fkey"
            columns: ["feature_request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          author_email: string | null
          author_id: string | null
          category: string
          comment_count: number
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          vote_count: number
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          vote_count?: number
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feature_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_replies: {
        Row: {
          admin_id: string
          created_at: string
          feedback_id: string
          id: string
          reply_text: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          feedback_id: string
          id?: string
          reply_text: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          feedback_id?: string
          id?: string
          reply_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_replies_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedback_replies_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedback_replies_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedback_replies_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_replies_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "user_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: number
          requester_id: string
          status: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: number
          requester_id: string
          status?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: number
          requester_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_profiles_fk"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_profiles_fk"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_profiles_fk"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_profiles_fk"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_profiles_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_profiles_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_profiles_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_profiles_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          cities_inserted: number | null
          city_watermark: number | null
          files: string | null
          finished_at: string | null
          id: number
          new_cities_only: boolean | null
          notes: string | null
          radius_m: number | null
          source_label: string
          started_at: string
          venue_watermark: number | null
          venues_inserted: number | null
        }
        Insert: {
          cities_inserted?: number | null
          city_watermark?: number | null
          files?: string | null
          finished_at?: string | null
          id?: number
          new_cities_only?: boolean | null
          notes?: string | null
          radius_m?: number | null
          source_label: string
          started_at?: string
          venue_watermark?: number | null
          venues_inserted?: number | null
        }
        Update: {
          cities_inserted?: number | null
          city_watermark?: number | null
          files?: string | null
          finished_at?: string | null
          id?: number
          new_cities_only?: boolean | null
          notes?: string | null
          radius_m?: number | null
          source_label?: string
          started_at?: string
          venue_watermark?: number | null
          venues_inserted?: number | null
        }
        Relationships: []
      }
      ip_block: {
        Row: {
          blocked_until: string
          created_at: string
          created_by: string | null
          ip_address: unknown
          reason: string | null
        }
        Insert: {
          blocked_until: string
          created_at?: string
          created_by?: string | null
          ip_address: unknown
          reason?: string | null
        }
        Update: {
          blocked_until?: string
          created_at?: string
          created_by?: string | null
          ip_address?: unknown
          reason?: string | null
        }
        Relationships: []
      }
      ladder_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: number
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: number
          name: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: number
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      match_invites: {
        Row: {
          created_at: string
          event_id: number | null
          id: number
          invitee_id: string
          inviter_id: string
          note: string | null
          responded_at: string | null
          status: string
          venue_id: number | null
        }
        Insert: {
          created_at?: string
          event_id?: number | null
          id?: number
          invitee_id: string
          inviter_id?: string
          note?: string | null
          responded_at?: string | null
          status?: string
          venue_id?: number | null
        }
        Update: {
          created_at?: string
          event_id?: number | null
          id?: number
          invitee_id?: string
          inviter_id?: string
          note?: string | null
          responded_at?: string | null
          status?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "match_invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          confirmed_at: string | null
          created_at: string
          dispute_count: number
          event_id: number | null
          id: number
          note: string | null
          opponent_id: string
          reporter_id: string
          sets: Json
          status: string
          venue_id: number | null
          winner_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          dispute_count?: number
          event_id?: number | null
          id?: number
          note?: string | null
          opponent_id: string
          reporter_id: string
          sets?: Json
          status?: string
          venue_id?: number | null
          winner_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          dispute_count?: number
          event_id?: number | null
          id?: number
          note?: string | null
          opponent_id?: string
          reporter_id?: string
          sets?: Json
          status?: string
          venue_id?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      moderation_keywords: {
        Row: {
          id: number
          note: string | null
          pattern: string
        }
        Insert: {
          id?: number
          note?: string | null
          pattern: string
        }
        Update: {
          id?: number
          note?: string | null
          pattern?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: number
          read: boolean | null
          recipient_id: string
          sender_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: number
          read?: boolean | null
          recipient_id: string
          sender_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: number
          read?: boolean | null
          recipient_id?: string
          sender_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sender_profiles_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_sender_profiles_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_sender_profiles_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_sender_profiles_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_preferences: {
        Row: {
          availability: string[]
          note: string | null
          sought_styles: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string[]
          note?: string | null
          sought_styles?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string[]
          note?: string | null
          sought_styles?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      play_intent_joins: {
        Row: {
          created_at: string
          id: number
          intent_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          intent_id: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: number
          intent_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_intent_joins_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "play_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      play_intents: {
        Row: {
          created_at: string
          event_id: number | null
          expires_at: string
          host_id: string
          id: number
          note: string | null
          starts_at: string
          status: string
          venue_id: number
          visibility: string
          when_slot: string
        }
        Insert: {
          created_at?: string
          event_id?: number | null
          expires_at: string
          host_id?: string
          id?: number
          note?: string | null
          starts_at: string
          status?: string
          venue_id: number
          visibility?: string
          when_slot: string
        }
        Update: {
          created_at?: string
          event_id?: number | null
          expires_at?: string
          host_id?: string
          id?: number
          note?: string | null
          starts_at?: string
          status?: string
          venue_id?: number
          visibility?: string
          when_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_intents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_intents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "play_intents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          matches: number
          peak_rating: number
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          matches?: number
          peak_rating?: number
          rating?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          matches?: number
          peak_rating?: number
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_provider: string
          avatar_url: string | null
          checkin_visibility: string
          city: string | null
          created_at: string
          discoverable: boolean
          email: string | null
          equipment: string | null
          full_name: string
          home_venue_id: number | null
          id: string
          is_admin: boolean
          is_moderator: boolean
          lang: string
          notification_prefs: Json
          notify_friend_checkins: boolean
          pending_deletion_at: string | null
          play_goals: string[]
          referral_code: string | null
          show_as_regular: boolean
          skill_level: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          auth_provider?: string
          avatar_url?: string | null
          checkin_visibility?: string
          city?: string | null
          created_at?: string
          discoverable?: boolean
          email?: string | null
          equipment?: string | null
          full_name: string
          home_venue_id?: number | null
          id: string
          is_admin?: boolean
          is_moderator?: boolean
          lang?: string
          notification_prefs?: Json
          notify_friend_checkins?: boolean
          pending_deletion_at?: string | null
          play_goals?: string[]
          referral_code?: string | null
          show_as_regular?: boolean
          skill_level?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          auth_provider?: string
          avatar_url?: string | null
          checkin_visibility?: string
          city?: string | null
          created_at?: string
          discoverable?: boolean
          email?: string | null
          equipment?: string | null
          full_name?: string
          home_venue_id?: number | null
          id?: string
          is_admin?: boolean
          is_moderator?: boolean
          lang?: string
          notification_prefs?: Json
          notify_friend_checkins?: boolean
          pending_deletion_at?: string | null
          play_goals?: string[]
          referral_code?: string | null
          show_as_regular?: boolean
          skill_level?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "profiles_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_type: string
          id: number
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type: string
          id?: number
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: number
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_config: {
        Row: {
          action: string
          description: string | null
          enabled: boolean
          id: number
          max_attempts: number
          scope: string
          window_secs: number
        }
        Insert: {
          action: string
          description?: string | null
          enabled?: boolean
          id?: number
          max_attempts: number
          scope: string
          window_secs: number
        }
        Update: {
          action?: string
          description?: string | null
          enabled?: boolean
          id?: number
          max_attempts?: number
          scope?: string
          window_secs?: number
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          created_at: string
          delta: number
          id: number
          match_id: number
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: number
          match_id: number
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: number
          match_id?: number
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: number
          referee_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          referee_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: number
          referee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          flag_count: number | null
          flagged: boolean | null
          id: number
          rating: number
          reviewer_name: string | null
          user_id: string | null
          venue_id: number
        }
        Insert: {
          body: string
          created_at?: string
          flag_count?: number | null
          flagged?: boolean | null
          id?: number
          rating: number
          reviewer_name?: string | null
          user_id?: string | null
          venue_id: number
        }
        Update: {
          body?: string
          created_at?: string
          flag_count?: number | null
          flagged?: boolean | null
          id?: number
          rating?: number
          reviewer_name?: string | null
          user_id?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey1"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey1"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      season_results: {
        Row: {
          city: string | null
          created_at: string
          id: number
          played: number
          rank: number
          rating: number
          season_id: number
          user_id: string
          wins: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: number
          played: number
          rank: number
          rating: number
          season_id: number
          user_id: string
          wins: number
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: number
          played?: number
          rank?: number
          rating?: number
          season_id?: number
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ladder_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_dismissals: {
        Row: {
          created_at: string
          dismissed_user_id: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_user_id: string
          id?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          dismissed_user_id?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      table_reports: {
        Row: {
          created_at: string
          free_count: number
          group_size: number | null
          id: number
          user_id: string
          venue_id: number
        }
        Insert: {
          created_at?: string
          free_count: number
          group_size?: number | null
          id?: number
          user_id: string
          venue_id: number
        }
        Update: {
          created_at?: string
          free_count?: number
          group_size?: number | null
          id?: number
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_reports_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "table_reports_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_brackets: {
        Row: {
          champion_id: string | null
          created_at: string
          event_id: number
          id: number
          size: number
          status: string
        }
        Insert: {
          champion_id?: string | null
          created_at?: string
          event_id: number
          id?: number
          size: number
          status?: string
        }
        Update: {
          champion_id?: string | null
          created_at?: string
          event_id?: number
          id?: number
          size?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_brackets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_slots: {
        Row: {
          bracket_id: number
          id: number
          match_id: number | null
          player_a: string | null
          player_b: string | null
          round: number
          sets: Json
          slot_pos: number
          winner_id: string | null
        }
        Insert: {
          bracket_id: number
          id?: number
          match_id?: number | null
          player_a?: string | null
          player_b?: string | null
          round: number
          sets?: Json
          slot_pos: number
          winner_id?: string | null
        }
        Update: {
          bracket_id?: number
          id?: number
          match_id?: number | null
          player_a?: string | null
          player_b?: string | null
          round?: number
          sets?: Json
          slot_pos?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_slots_bracket_id_fkey"
            columns: ["bracket_id"]
            isOneToOne: false
            referencedRelation: "tournament_brackets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_slots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          focus: string[]
          hours: number
          id: number
          note: string | null
          partner_id: string | null
          session_type: string
          user_id: string
          venue_id: number | null
        }
        Insert: {
          created_at?: string
          focus?: string[]
          hours: number
          id?: number
          note?: string | null
          partner_id?: string | null
          session_type: string
          user_id?: string
          venue_id?: number | null
        }
        Update: {
          created_at?: string
          focus?: string[]
          hours?: number
          id?: number
          note?: string | null
          partner_id?: string | null
          session_type?: string
          user_id?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "training_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badge_progress: {
        Row: {
          approved_count: number
          badge_level: Database["public"]["Enums"]["badge_level"]
          category: Database["public"]["Enums"]["challenge_category"]
          completed_count: number
          created_at: string
          id: string
          last_completed_at: string | null
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          approved_count?: number
          badge_level?: Database["public"]["Enums"]["badge_level"]
          category: Database["public"]["Enums"]["challenge_category"]
          completed_count?: number
          created_at?: string
          id?: string
          last_completed_at?: string | null
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          approved_count?: number
          badge_level?: Database["public"]["Enums"]["badge_level"]
          category?: Database["public"]["Enums"]["challenge_category"]
          completed_count?: number
          created_at?: string
          id?: string
          last_completed_at?: string | null
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: number
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: number
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          page: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          page: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          page?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          achieved_at: string
          id: number
          milestone_key: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          id?: number
          milestone_key: string
          user_id?: string
        }
        Update: {
          achieved_at?: string
          id?: number
          milestone_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          best_streak: number
          current_streak: number
          freeze_used_month: string | null
          last_played_week: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          freeze_used_month?: string | null
          last_played_week?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          freeze_used_month?: string | null
          last_played_week?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      venue_admin_audit: {
        Row: {
          action: string
          admin_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: number
          note: string | null
          venue_id: number
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: number
          note?: string | null
          venue_id: number
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: number
          note?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_admin_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_admin_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_change_requests: {
        Row: {
          created_at: string
          id: number
          mark_unavailable: boolean
          note: string | null
          photo_url: string | null
          proposed_amenities: Json | null
          proposed_nets: boolean | null
          proposed_night_lighting: boolean | null
          proposed_tables_count: number | null
          resolution: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          updated_at: string
          venue_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          mark_unavailable?: boolean
          note?: string | null
          photo_url?: string | null
          proposed_amenities?: Json | null
          proposed_nets?: boolean | null
          proposed_night_lighting?: boolean | null
          proposed_tables_count?: number | null
          resolution?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
          venue_id: number
        }
        Update: {
          created_at?: string
          id?: number
          mark_unavailable?: boolean
          note?: string | null
          photo_url?: string | null
          proposed_amenities?: Json | null
          proposed_nets?: boolean | null
          proposed_night_lighting?: boolean | null
          proposed_tables_count?: number | null
          resolution?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_change_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_change_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_post_votes: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "venue_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_posts: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          flagged: boolean
          helpful_count: number
          id: number
          parent_id: number | null
          user_id: string
          venue_id: number
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          helpful_count?: number
          id?: number
          parent_id?: number | null
          user_id: string
          venue_id: number
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          helpful_count?: number
          id?: number
          parent_id?: number | null
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "venue_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_posts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_posts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tombstones: {
        Row: {
          deleted_at: string
          venue_id: number
        }
        Insert: {
          deleted_at?: string
          venue_id: number
        }
        Update: {
          deleted_at?: string
          venue_id?: number
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          admin_review_notes: string | null
          amenities: Json
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
          geom: unknown
          hours: string | null
          id: number
          import_run_id: number | null
          lat: number
          lng: number
          name: string
          needs_manual_pin: boolean
          nets: boolean | null
          night_lighting: boolean | null
          photos: string[] | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sector: string | null
          source: string
          submitted_by: string | null
          tables_count: number | null
          tags: string[] | null
          tariff: string | null
          type: string
          updated_at: string
          verified: boolean | null
          website: string | null
        }
        Insert: {
          address: string
          admin_review_notes?: string | null
          amenities?: Json
          approved?: boolean | null
          city: string
          city_id: number
          condition?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          duplicate_of_venue_id?: number | null
          free_access?: boolean | null
          geom?: unknown
          hours?: string | null
          id?: number
          import_run_id?: number | null
          lat: number
          lng: number
          name: string
          needs_manual_pin?: boolean
          nets?: boolean | null
          night_lighting?: boolean | null
          photos?: string[] | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sector?: string | null
          source?: string
          submitted_by?: string | null
          tables_count?: number | null
          tags?: string[] | null
          tariff?: string | null
          type: string
          updated_at?: string
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string
          admin_review_notes?: string | null
          amenities?: Json
          approved?: boolean | null
          city?: string
          city_id?: number
          condition?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          duplicate_of_venue_id?: number | null
          free_access?: boolean | null
          geom?: unknown
          hours?: string | null
          id?: number
          import_run_id?: number | null
          lat?: number
          lng?: number
          name?: string
          needs_manual_pin?: boolean
          nets?: boolean | null
          night_lighting?: boolean | null
          photos?: string[] | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sector?: string | null
          source?: string
          submitted_by?: string | null
          tables_count?: number | null
          tags?: string[] | null
          tariff?: string | null
          type?: string
          updated_at?: string
          verified?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_duplicate_of_venue_id_fkey"
            columns: ["duplicate_of_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venues_duplicate_of_venue_id_fkey"
            columns: ["duplicate_of_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_import_run_fk"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          fetched_at: string
          id: string
          weather_data: Json
        }
        Insert: {
          fetched_at?: string
          id: string
          weather_data: Json
        }
        Update: {
          fetched_at?: string
          id?: string
          weather_data?: Json
        }
        Relationships: []
      }
    }
    Views: {
      challenge_catalog_export_template: {
        Row: {
          category: Database["public"]["Enums"]["challenge_category"] | null
          code: string | null
          cooldown_hours: number | null
          description: string | null
          difficulty_score: number | null
          legacy_code: string | null
          metadata: Json | null
          monthly_weight: number | null
          per_day_cap: number | null
          requires_proof: boolean | null
          title: string | null
          title_key: string | null
          verification_type:
            | Database["public"]["Enums"]["verification_type"]
            | null
        }
        Relationships: []
      }
      current_equipment: {
        Row: {
          backhand_rubber_color: string | null
          backhand_rubber_manufacturer: string | null
          backhand_rubber_manufacturer_id: string | null
          backhand_rubber_model: string | null
          blade_manufacturer: string | null
          blade_manufacturer_id: string | null
          blade_model: string | null
          created_at: string | null
          dominant_hand: string | null
          forehand_rubber_color: string | null
          forehand_rubber_manufacturer: string | null
          forehand_rubber_manufacturer_id: string | null
          forehand_rubber_model: string | null
          grip: string | null
          id: number | null
          playing_style: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_checkins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_reviews"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_venues"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_checkins: {
        Row: {
          avatar_url: string | null
          city: string | null
          full_name: string | null
          rank: number | null
          total_checkins: number | null
          unique_venues: number | null
          user_id: string | null
        }
        Relationships: []
      }
      leaderboard_reviews: {
        Row: {
          avatar_url: string | null
          avg_given_rating: number | null
          city: string | null
          full_name: string | null
          rank: number | null
          total_reviews: number | null
          user_id: string | null
        }
        Relationships: []
      }
      leaderboard_venues: {
        Row: {
          avatar_url: string | null
          city: string | null
          full_name: string | null
          rank: number | null
          unique_venues: number | null
          user_id: string | null
        }
        Relationships: []
      }
      venue_busyness_hourly: {
        Row: {
          avg_per_week: number | null
          checkin_count: number | null
          dow: number | null
          hour: number | null
          venue_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "checkins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_stats: {
        Row: {
          avg_rating: number | null
          checkin_count: number | null
          favorite_count: number | null
          review_count: number | null
          venue_id: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_match_invite: { Args: { p_invite_id: number }; Returns: number }
      add_challenge_to_event: {
        Args: { v_challenge_id: string; v_event_id: number }
        Returns: {
          assignment_id: string | null
          auto_review_reason: string | null
          challenge_id: string
          event_id: number | null
          id: string
          metadata: Json
          notes: string | null
          occurred_at: string | null
          proof_text: string | null
          proof_urls: Json
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "challenge_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_bulk_set_venue_review_state: {
        Args: {
          p_approved?: boolean
          p_notes?: string
          p_review_status: string
          p_venue_ids: number[]
        }
        Returns: {
          approved: boolean
          review_status: string
          venue_id: number
        }[]
      }
      admin_get_city_review_queue: {
        Args: {
          p_country_code?: string
          p_expansion_status?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          active: boolean
          admin_area: string
          approved_count: number
          city_id: number
          city_name: string
          country_code: string
          country_name: string
          duplicate_name_groups: number
          expansion_status: string
          flagged_review_count: number
          hidden_count: number
          lat: number
          lng: number
          local_area: string
          missing_address_count: number
          missing_tables_count: number
          unknown_condition_count: number
          updated_at: string
          venue_count: number
          zoom: number
        }[]
      }
      admin_get_venue_review_context: {
        Args: { p_venue_id: number }
        Returns: Json
      }
      admin_get_venues_in_viewport: {
        Args: {
          p_approved?: boolean
          p_city_id?: number
          p_limit?: number
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
          p_needs_attention?: boolean
          p_query?: string
          p_type?: string
        }
        Returns: {
          address: string
          admin_review_notes: string
          approved: boolean
          avg_rating: number
          checkin_count: number
          city: string
          city_id: number
          condition: string
          country_code: string
          created_at: string
          description: string
          duplicate_of_venue_id: number
          flagged_review_count: number
          id: number
          lat: number
          lng: number
          name: string
          needs_manual_pin: boolean
          review_count: number
          review_status: string
          reviewed_at: string
          reviewed_by: string
          tables_count: number
          type: string
          updated_at: string
          verified: boolean
        }[]
      }
      admin_import_osm_seed_venue: {
        Args: {
          p_city_lat?: number
          p_city_lng?: number
          p_city_name: string
          p_city_zoom?: number
          p_country_code: string
          p_country_name: string
          p_show_in_app?: boolean
          p_venue?: Json
        }
        Returns: {
          address: string
          admin_review_notes: string | null
          amenities: Json
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
          geom: unknown
          hours: string | null
          id: number
          import_run_id: number | null
          lat: number
          lng: number
          name: string
          needs_manual_pin: boolean
          nets: boolean | null
          night_lighting: boolean | null
          photos: string[] | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sector: string | null
          source: string
          submitted_by: string | null
          tables_count: number | null
          tags: string[] | null
          tariff: string | null
          type: string
          updated_at: string
          verified: boolean | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_search_users: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          username: string
        }[]
      }
      admin_set_user_moderator: {
        Args: { p_user_id: string; p_value: boolean }
        Returns: undefined
      }
      admin_set_venue_review_state: {
        Args: {
          p_approved?: boolean
          p_duplicate_of_venue_id?: number
          p_needs_manual_pin?: boolean
          p_notes?: string
          p_review_status?: string
          p_venue_id: number
        }
        Returns: {
          address: string
          admin_review_notes: string | null
          amenities: Json
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
          geom: unknown
          hours: string | null
          id: number
          import_run_id: number | null
          lat: number
          lng: number
          name: string
          needs_manual_pin: boolean
          nets: boolean | null
          night_lighting: boolean | null
          photos: string[] | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sector: string | null
          source: string
          submitted_by: string | null
          tables_count: number | null
          tags: string[] | null
          tariff: string | null
          type: string
          updated_at: string
          verified: boolean | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_city_review_status: {
        Args: {
          p_active: boolean
          p_city_id: number
          p_expansion_status: string
        }
        Returns: {
          active: boolean | null
          admin_area: string | null
          country_code: string
          country_name: string
          county: string | null
          created_at: string
          expansion_status: string
          id: number
          lat: number | null
          lng: number | null
          local_area: string | null
          name: string
          updated_at: string
          venue_count: number | null
          zoom: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_match_rating: { Args: { p_match_id: number }; Returns: undefined }
      apply_to_coach: {
        Args: {
          p_bio: string
          p_contact: string
          p_experience: string
          p_languages: string[]
          p_levels: string[]
          p_price_range: string
          p_venue_ids: number[]
        }
        Returns: number
      }
      approve_self_submission: {
        Args: { v_submission_id: string }
        Returns: {
          assignment_id: string | null
          auto_review_reason: string | null
          challenge_id: string
          event_id: number | null
          id: string
          metadata: Json
          notes: string | null
          occurred_at: string | null
          proof_text: string | null
          proof_urls: Json
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "challenge_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_confirm_stale_matches: { Args: never; Returns: number }
      award_anniversary_milestones: { Args: never; Returns: undefined }
      award_event_challenge_submission: {
        Args: { v_submission_id: string }
        Returns: {
          assignment_id: string | null
          auto_review_reason: string | null
          challenge_id: string
          event_id: number | null
          id: string
          metadata: Json
          notes: string | null
          occurred_at: string | null
          proof_text: string | null
          proof_urls: Json
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "challenge_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      block_user: { Args: { p_target_id: string }; Returns: undefined }
      can_message: { Args: { p_other: string }; Returns: boolean }
      can_moderate: { Args: never; Returns: boolean }
      can_read_event: { Args: { p_event_id: number }; Returns: boolean }
      can_send_in_thread: { Args: { p_thread_id: number }; Returns: boolean }
      cancel_account_deletion: { Args: never; Returns: undefined }
      cancel_play_intent: { Args: { p_intent_id: number }; Returns: undefined }
      challenge_xp_value: { Args: { v_code: string }; Returns: number }
      claim_referral: { Args: { p_code: string }; Returns: string }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      close_event: {
        Args: { p_event_id: number; p_organizer_id?: string }
        Returns: undefined
      }
      complete_self_challenge: {
        Args: { v_challenge_id: string }
        Returns: {
          assignment_id: string | null
          auto_review_reason: string | null
          challenge_id: string
          event_id: number | null
          id: string
          metadata: Json
          notes: string | null
          occurred_at: string | null
          proof_text: string | null
          proof_urls: Json
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "challenge_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_match: {
        Args: { p_match_id: number }
        Returns: {
          confirmed_at: string | null
          created_at: string
          dispute_count: number
          event_id: number | null
          id: number
          note: string | null
          opponent_id: string
          reporter_id: string
          sets: Json
          status: string
          venue_id: number | null
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_play_intent_to_event: {
        Args: { p_intent_id: number; p_title?: string }
        Returns: number
      }
      create_and_send_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_recipient_id: string
          p_sender_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_club: {
        Args: {
          p_avatar_url?: string
          p_city_id?: number
          p_description?: string
          p_home_venue_id?: number
          p_name: string
        }
        Returns: number
      }
      create_play_intent: {
        Args: {
          p_note?: string
          p_public?: boolean
          p_venue_id: number
          p_when_slot: string
        }
        Returns: number
      }
      create_tournament_bracket: {
        Args: { p_event_id: number }
        Returns: number
      }
      current_client_ip: { Args: never; Returns: unknown }
      current_equipment_for_user: {
        Args: { v_user_id: string }
        Returns: {
          backhand_rubber_color: string | null
          backhand_rubber_manufacturer: string | null
          backhand_rubber_manufacturer_id: string | null
          backhand_rubber_model: string | null
          blade_manufacturer: string | null
          blade_manufacturer_id: string | null
          blade_model: string | null
          created_at: string | null
          dominant_hand: string | null
          forehand_rubber_color: string | null
          forehand_rubber_manufacturer: string | null
          forehand_rubber_manufacturer_id: string | null
          forehand_rubber_model: string | null
          grip: string | null
          id: number | null
          playing_style: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "current_equipment"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      current_ladder_season: {
        Args: never
        Returns: {
          created_at: string
          ends_at: string
          id: number
          name: string
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ladder_seasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_match_invite: {
        Args: { p_invite_id: number }
        Returns: undefined
      }
      delete_checkin_moment: { Args: { p_id: number }; Returns: undefined }
      delete_venue_post: { Args: { p_post_id: number }; Returns: undefined }
      dismiss_crossed_path: { Args: { p_user_id: string }; Returns: undefined }
      dispute_match: {
        Args: { p_match_id: number }
        Returns: {
          confirmed_at: string | null
          created_at: string
          dispute_count: number
          event_id: number | null
          id: number
          note: string | null
          opponent_id: string
          reporter_id: string
          sets: Json
          status: string
          venue_id: number | null
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enforce_rate_limit: { Args: { p_action: string }; Returns: undefined }
      expire_match_invites: { Args: never; Returns: number }
      expire_play_intents: { Args: never; Returns: number }
      find_or_create_city: {
        Args: {
          p_country_code: string
          p_country_name?: string
          p_lat?: number
          p_lng?: number
          p_name: string
          p_zoom?: number
        }
        Returns: number
      }
      find_or_create_country: {
        Args: { p_code: string; p_name?: string }
        Returns: string
      }
      find_players: {
        Args: {
          p_city?: string
          p_limit?: number
          p_skill?: string
          p_style?: string
        }
        Returns: {
          availability: string[]
          avatar_url: string
          city: string
          dominant_hand: string
          full_name: string
          grip: string
          play_goals: string[]
          played_this_week: boolean
          playing_style: string
          pref_note: string
          skill_level: string
          user_id: string
          username: string
        }[]
      }
      generate_club_join_code: { Args: never; Returns: string }
      generate_recurring_events: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      generate_username: { Args: { p_full_name: string }; Returns: string }
      get_blocked_users: {
        Args: never
        Returns: {
          avatar_url: string
          blocked_at: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      get_challenge_choices: {
        Args: {
          v_category: Database["public"]["Enums"]["challenge_category"]
          v_limit_count?: number
        }
        Returns: {
          category: Database["public"]["Enums"]["challenge_category"]
          code: string
          description: string
          id: string
          legacy_code: string
          requires_proof: boolean
          title: string
          title_key: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }[]
      }
      get_cities_delta: { Args: { p_since?: string }; Returns: Json }
      get_city_guide: { Args: { p_city_id: number }; Returns: Json }
      get_city_ladder: {
        Args: { p_city?: string; p_limit?: number; p_season_id?: number }
        Returns: {
          avatar_url: string
          city: string
          full_name: string
          played: number
          rank: number
          rating: number
          score: number
          user_id: string
          wins: number
        }[]
      }
      get_city_venue_amenities: {
        Args: { p_city_id: number }
        Returns: {
          amenities: Json
          venue_id: number
        }[]
      }
      get_club_by_code: {
        Args: { p_code: string }
        Returns: {
          already_member: boolean
          avatar_url: string
          id: number
          member_count: number
          name: string
        }[]
      }
      get_club_detail: {
        Args: { p_club_id: number }
        Returns: {
          avatar_url: string
          city_id: number
          description: string
          home_venue_id: number
          home_venue_name: string
          id: number
          join_code: string
          member_count: number
          members: Json
          my_role: string
          name: string
          owner_id: string
          upcoming_events: Json
        }[]
      }
      get_coaching_venue_ids: {
        Args: { p_city: string }
        Returns: {
          venue_id: number
        }[]
      }
      get_countries_delta: { Args: { p_since?: string }; Returns: Json }
      get_crossed_paths: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          avatar_url: string
          city: string
          full_name: string
          last_crossed_at: string
          shared_count: number
          skill_level: string
          user_id: string
          username: string
          venue_id: number
          venue_name: string
        }[]
      }
      get_dm_messages: {
        Args: { p_limit?: number; p_thread_id: number }
        Returns: {
          body: string
          created_at: string
          id: number
          is_mine: boolean
          sender_id: string
        }[]
      }
      get_dm_threads: {
        Args: never
        Returns: {
          last_message: string
          last_message_at: string
          other_avatar: string
          other_id: string
          other_name: string
          thread_id: number
          unread_count: number
        }[]
      }
      get_equipment_catalog_delta: {
        Args: { p_category: string; p_since?: string }
        Returns: Json
      }
      get_equipment_model_summary: {
        Args: { p_category: string; p_manufacturer_id: string; p_model: string }
        Returns: {
          avg_control: number
          avg_rating: number
          avg_speed: number
          avg_spin: number
          review_count: number
          users_count: number
        }[]
      }
      get_event_challenge_submissions: {
        Args: { v_event_id: number }
        Returns: {
          category: Database["public"]["Enums"]["challenge_category"]
          challenge_code: string
          challenge_id: string
          challenge_legacy_code: string
          challenge_title: string
          challenge_title_key: string
          reviewed_at: string
          reviewer_name: string
          reviewer_user_id: string
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
          submitted_at: string
          submitter_name: string
          submitter_user_id: string
        }[]
      }
      get_explorer_progress: {
        Args: { p_city?: string }
        Returns: {
          bronze: number
          city_scoped: boolean
          earned_bronze: boolean
          earned_gold: boolean
          earned_silver: boolean
          gold: number
          key: string
          predicate: string
          progress: number
          silver: number
          sort: number
        }[]
      }
      get_friend_feed:
        | {
            Args: { p_friend_ids: string[]; p_limit?: number }
            Returns: {
              id: number
              kind: string
              rating: number
              ts: string
              user_id: string
              user_name: string
              venue_city: string
              venue_id: number
              venue_name: string
            }[]
          }
        | {
            Args: { p_limit?: number }
            Returns: {
              id: number
              kind: string
              photo_url: string
              rating: number
              ts: string
              user_id: string
              user_name: string
              venue_city: string
              venue_id: number
              venue_name: string
            }[]
          }
      get_friends_at_venue:
        | {
            Args: { p_venue_id: number }
            Returns: {
              avatar_url: string
              event_title: string
              full_name: string
              source: string
              user_id: string
            }[]
          }
        | {
            Args: { p_user_id: string; p_venue_id: number }
            Returns: {
              avatar_url: string
              event_title: string
              full_name: string
              source: string
              user_id: string
            }[]
          }
      get_head_to_head: { Args: { p_opponent_id: string }; Returns: Json }
      get_home_venue: { Args: { p_user_id: string }; Returns: Json }
      get_live_venue_counts: {
        Args: { p_city_id: number }
        Returns: {
          active_count: number
          venue_id: number
        }[]
      }
      get_my_clubs: {
        Args: never
        Returns: {
          avatar_url: string
          city_id: number
          home_venue_id: number
          home_venue_name: string
          id: number
          member_count: number
          name: string
          role: string
        }[]
      }
      get_my_ladder_standing: { Args: { p_city?: string }; Returns: Json }
      get_my_play_intent: {
        Args: never
        Returns: {
          expires_at: string
          id: number
          join_count: number
          note: string
          starts_at: string
          venue_id: number
          venue_name: string
          visibility: string
          when_slot: string
        }[]
      }
      get_open_play: {
        Args: { p_city_id?: number; p_limit?: number }
        Returns: {
          expires_at: string
          host_avatar: string
          host_id: string
          host_name: string
          host_skill: string
          id: number
          is_host: boolean
          join_count: number
          note: string
          starts_at: string
          venue_city: string
          venue_id: number
          venue_name: string
          viewer_joined: boolean
          when_slot: string
        }[]
      }
      get_open_play_counts: {
        Args: { p_city_id?: number }
        Returns: {
          broadcast_count: number
          venue_id: number
        }[]
      }
      get_or_create_dm_thread: { Args: { p_other: string }; Returns: number }
      get_partner_preferences: {
        Args: never
        Returns: {
          availability: string[]
          discoverable: boolean
          note: string
          sought_styles: string[]
        }[]
      }
      get_pending_challenge_validations: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["challenge_category"]
          challenge_code: string
          challenge_id: string
          challenge_legacy_code: string
          challenge_title: string
          challenge_title_key: string
          created_at: string
          event_id: number
          event_title: string
          submission_id: string
          submitter_name: string
          submitter_user_id: string
          validation_id: string
        }[]
      }
      get_pending_match_invites: {
        Args: never
        Returns: {
          created_at: string
          id: number
          inviter_id: string
          inviter_name: string
          note: string
          venue_id: number
          venue_name: string
        }[]
      }
      get_pending_matches: {
        Args: never
        Returns: {
          created_at: string
          id: number
          opponent_id: string
          reporter_id: string
          reporter_name: string
          sets: Json
          winner_id: string
        }[]
      }
      get_player_matches: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          confirmed_at: string
          created_at: string
          event_id: number
          id: number
          opponent_id: string
          opponent_name: string
          reporter_id: string
          reporter_name: string
          sets: Json
          status: string
          venue_id: number
          winner_id: string
        }[]
      }
      get_player_rating: { Args: { p_user_id: string }; Returns: Json }
      get_profile_stats: {
        Args: { p_user_id: string }
        Returns: {
          best_streak: number
          current_streak: number
          events_joined: number
          is_coach: boolean
          member_since: string
          reviews_written: number
          total_checkins: number
          total_hours_played: number
          total_play_hours: number
          unique_venues: number
        }[]
      }
      get_referral_stats: {
        Args: never
        Returns: {
          invited_count: number
          referral_code: string
        }[]
      }
      get_rivals: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
          my_wins: number
          their_wins: number
          total: number
          user_id: string
        }[]
      }
      get_rubber_wear: {
        Args: { p_user_id?: string }
        Returns: {
          estimated_hours: number
          expected_hours: number
          installed_at: string
          pct: number
          side: string
        }[]
      }
      get_tournament_bracket: {
        Args: { p_event_id: number }
        Returns: {
          bracket_id: number
          bracket_status: string
          champion_id: string
          champion_name: string
          player_a: string
          player_a_name: string
          player_b: string
          player_b_name: string
          round: number
          sets: Json
          size: number
          slot_id: number
          slot_pos: number
          winner_id: string
        }[]
      }
      get_unread_dm_count: { Args: never; Returns: number }
      get_unvisited_venue_ids: {
        Args: { p_city: string }
        Returns: {
          venue_id: number
        }[]
      }
      get_venue_active_checkin_count: {
        Args: { p_venue_id: number }
        Returns: number
      }
      get_venue_amenities: { Args: { p_venue_id: number }; Returns: Json }
      get_venue_board: {
        Args: { p_limit?: number; p_venue_id: number }
        Returns: Json
      }
      get_venue_busyness: { Args: { p_venue_id: number }; Returns: Json }
      get_venue_champion: {
        Args: { p_days_back?: number; p_venue_id: number }
        Returns: {
          day_count: number
          full_name: string
          user_id: string
        }[]
      }
      get_venue_coaches: {
        Args: { p_venue_id: number }
        Returns: {
          avatar_url: string
          coach_id: number
          full_name: string
          user_id: string
        }[]
      }
      get_venue_detail:
        | {
            Args: { p_review_limit?: number; p_venue_id: number }
            Returns: Json
          }
        | {
            Args: {
              p_review_limit?: number
              p_user_id: string
              p_venue_id: number
            }
            Returns: Json
          }
      get_venue_free_tables: { Args: { p_venue_id: number }; Returns: Json }
      get_venue_moments: {
        Args: { p_limit?: number; p_venue_id: number }
        Returns: Json
      }
      get_venue_open_play: {
        Args: { p_venue_id: number }
        Returns: {
          host_avatar: string
          host_id: string
          host_name: string
          host_skill: string
          id: number
          is_host: boolean
          join_count: number
          note: string
          starts_at: string
          viewer_joined: boolean
          when_slot: string
        }[]
      }
      get_venue_player_mix: { Args: { p_venue_id: number }; Returns: Json }
      get_venue_regulars: { Args: { p_venue_id: number }; Returns: Json }
      get_venues_delta: {
        Args: {
          p_city?: string
          p_city_id?: number
          p_since?: string
          p_type?: string
        }
        Returns: Json
      }
      get_venues_near: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: {
          city: string
          condition: string
          distance_m: number
          id: number
          lat: number
          lng: number
          name: string
          type: string
        }[]
      }
      get_weekly_recap: {
        Args: { p_user_id: string; p_week_start?: string }
        Returns: {
          current_streak: number
          friends_played_with: number
          hours: number
          new_venues: number
          rank: number
          rank_delta: number
          sessions: number
          venues: number
        }[]
      }
      hard_delete_expired_accounts: { Args: never; Returns: number }
      haversine_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_club_admin: { Args: { p_club_id: number }; Returns: boolean }
      is_club_member: { Args: { p_club_id: number }; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      join_club_by_code: { Args: { p_code: string }; Returns: number }
      join_play_intent: { Args: { p_intent_id: number }; Returns: number }
      leave_club: { Args: { p_club_id: number }; Returns: undefined }
      leave_play_intent: { Args: { p_intent_id: number }; Returns: number }
      log_match: {
        Args: {
          p_event_id?: number
          p_note?: string
          p_opponent_id: string
          p_sets?: Json
          p_venue_id?: number
          p_winner_id?: string
        }
        Returns: {
          confirmed_at: string | null
          created_at: string
          dispute_count: number
          event_id: number | null
          id: number
          note: string | null
          opponent_id: string
          reporter_id: string
          sets: Json
          status: string
          venue_id: number | null
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_moderation_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      mark_dm_thread_read: { Args: { p_thread_id: number }; Returns: undefined }
      notification_category: { Args: { p_type: string }; Returns: string }
      notification_pref_enabled: {
        Args: { p_type: string; p_user: string }
        Returns: boolean
      }
      post_checkin_moment: {
        Args: {
          p_caption?: string
          p_checkin_id: number
          p_photo_url: string
          p_venue_id: number
        }
        Returns: number
      }
      post_equipment_review: {
        Args: {
          p_body?: string
          p_category: string
          p_control?: number
          p_manufacturer_id: string
          p_model: string
          p_rating: number
          p_speed?: number
          p_spin?: number
          p_time_used?: string
        }
        Returns: number
      }
      post_venue_message: {
        Args: { p_body: string; p_parent_id?: number; p_venue_id: number }
        Returns: number
      }
      process_rubber_wear: { Args: never; Returns: undefined }
      process_weekly_streaks: { Args: never; Returns: undefined }
      prune_table_reports: { Args: never; Returns: number }
      recompute_badge_level: {
        Args: { v_completed_count: number }
        Returns: Database["public"]["Enums"]["badge_level"]
      }
      recompute_player_ratings: { Args: never; Returns: undefined }
      record_image_upload: { Args: never; Returns: undefined }
      refresh_city_venue_count: {
        Args: { p_city_id: number }
        Returns: undefined
      }
      refresh_stats: { Args: never; Returns: undefined }
      refresh_venue_busyness: { Args: never; Returns: undefined }
      remove_club_member: {
        Args: { p_club_id: number; p_user_id: string }
        Returns: undefined
      }
      report_content: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_notes?: string
          p_reason: string
        }
        Returns: number
      }
      report_free_tables: {
        Args: {
          p_free_count: number
          p_group_size?: number
          p_venue_id: number
        }
        Returns: number
      }
      report_tournament_slot: {
        Args: { p_sets?: Json; p_slot_id: number; p_winner_id: string }
        Returns: undefined
      }
      request_account_deletion: { Args: never; Returns: string }
      request_other_player_validation: {
        Args: { v_submission_id: string; v_validator_user_id: string }
        Returns: {
          comment: string | null
          created_at: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["validation_status"]
          submission_id: string
          validator_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "challenge_validations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_venue_change_request: {
        Args: {
          p_apply_amenities?: boolean
          p_apply_nets?: boolean
          p_apply_night_lighting?: boolean
          p_apply_tables_count?: boolean
          p_availability?: string
          p_request_id: number
        }
        Returns: string
      }
      respond_to_validation: {
        Args: {
          v_comment?: string
          v_status: Database["public"]["Enums"]["validation_status"]
          v_submission_id: string
        }
        Returns: {
          comment: string | null
          created_at: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["validation_status"]
          submission_id: string
          validator_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "challenge_validations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rollover_ladder_seasons: { Args: never; Returns: number }
      rotate_club_join_code: { Args: { p_club_id: number }; Returns: string }
      search_venues_admin: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          address: string
          admin_review_notes: string | null
          amenities: Json
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
          geom: unknown
          hours: string | null
          id: number
          import_run_id: number | null
          lat: number
          lng: number
          name: string
          needs_manual_pin: boolean
          nets: boolean | null
          night_lighting: boolean | null
          photos: string[] | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sector: string | null
          source: string
          submitted_by: string | null
          tables_count: number | null
          tags: string[] | null
          tariff: string | null
          type: string
          updated_at: string
          verified: boolean | null
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_dm: {
        Args: { p_body: string; p_thread_id: number }
        Returns: number
      }
      send_event_feedback_requests: { Args: never; Returns: undefined }
      send_event_invites: {
        Args: { p_event_id: number; p_friend_ids: string[] }
        Returns: undefined
      }
      send_event_reminders: { Args: never; Returns: undefined }
      send_event_update: {
        Args: { p_event_id: number; p_message: string }
        Returns: undefined
      }
      send_match_invite: {
        Args: { p_invitee_id: string; p_note?: string; p_venue_id?: number }
        Returns: number
      }
      send_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_recipient_id: string
          p_title: string
        }
        Returns: undefined
      }
      send_weekly_recaps: { Args: never; Returns: undefined }
      send_wrapped_teasers: { Args: never; Returns: undefined }
      set_discoverable: { Args: { p_value: boolean }; Returns: undefined }
      set_partner_preferences: {
        Args: {
          p_availability?: string[]
          p_note?: string
          p_sought_styles?: string[]
        }
        Returns: undefined
      }
      set_rubber_install: {
        Args: {
          p_expected_hours?: number
          p_installed_at?: string
          p_side: string
        }
        Returns: undefined
      }
      submit_venue_change_request: {
        Args: {
          p_amenities?: Json
          p_mark_unavailable?: boolean
          p_nets?: boolean
          p_night_lighting?: boolean
          p_note?: string
          p_photo_url?: string
          p_tables_count?: number
          p_venue_id: number
        }
        Returns: number
      }
      suggest_home_venue: { Args: never; Returns: Json }
      sync_badge_progress_from_submission: {
        Args: { v_submission_id: string }
        Returns: undefined
      }
      sync_checkin_milestones: { Args: { p_user: string }; Returns: undefined }
      sync_explorer_quests: { Args: { p_user: string }; Returns: undefined }
      sync_user_streak: {
        Args: { p_played_at: string; p_user: string }
        Returns: undefined
      }
      toggle_post_helpful: { Args: { p_post_id: number }; Returns: number }
      ugc_suspicious: { Args: { p_text: string }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
      unblock_user: { Args: { p_target_id: string }; Returns: undefined }
      username_base_from_name: {
        Args: { p_full_name: string }
        Returns: string
      }
      weekly_leaderboard_checkins: {
        Args: { since: string }
        Returns: {
          full_name: string
          rank: number
          score: number
          total_checkins: number
          user_id: string
        }[]
      }
      weekly_leaderboard_reviews: {
        Args: { since: string }
        Returns: {
          full_name: string
          rank: number
          score: number
          total_reviews: number
          user_id: string
        }[]
      }
      weekly_leaderboard_venues: {
        Args: { since: string }
        Returns: {
          full_name: string
          rank: number
          score: number
          unique_venues: number
          user_id: string
        }[]
      }
      year_in_review: {
        Args: { p_user_id: string; p_year?: number }
        Returns: Json
      }
    }
    Enums: {
      assignment_status: "active" | "completed" | "expired" | "cancelled"
      badge_level: "none" | "bronze" | "silver" | "gold" | "master"
      challenge_category:
        | "craft_player"
        | "spin_artist"
        | "first_attack_burst"
        | "footwork_engine"
        | "table_guardian"
        | "serve_lab"
        | "competitor"
        | "explorer"
        | "recruiter"
      event_visibility: "public" | "friends" | "private" | "club"
      submission_status:
        | "pending"
        | "approved"
        | "rejected"
        | "auto_approved"
        | "expired"
      validation_status: "pending" | "approved" | "rejected"
      verification_type: "self" | "other"
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
      assignment_status: ["active", "completed", "expired", "cancelled"],
      badge_level: ["none", "bronze", "silver", "gold", "master"],
      challenge_category: [
        "craft_player",
        "spin_artist",
        "first_attack_burst",
        "footwork_engine",
        "table_guardian",
        "serve_lab",
        "competitor",
        "explorer",
        "recruiter",
      ],
      event_visibility: ["public", "friends", "private", "club"],
      submission_status: [
        "pending",
        "approved",
        "rejected",
        "auto_approved",
        "expired",
      ],
      validation_status: ["pending", "approved", "rejected"],
      verification_type: ["self", "other"],
    },
  },
} as const
