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
      checkins: {
        Row: {
          ended_at: string
          friends: string[] | null
          id: number
          started_at: string
          table_number: number | null
          user_id: string
          venue_id: number
        }
        Insert: {
          ended_at?: string
          friends?: string[] | null
          id?: number
          started_at?: string
          table_number?: number | null
          user_id: string
          venue_id: number
        }
        Update: {
          ended_at?: string
          friends?: string[] | null
          id?: number
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
      condition_votes: {
        Row: {
          condition: string
          created_at: string
          id: number
          photo_url: string | null
          user_id: string
          venue_id: number
        }
        Insert: {
          condition: string
          created_at?: string
          id?: number
          photo_url?: string | null
          user_id: string
          venue_id: number
        }
        Update: {
          condition?: string
          created_at?: string
          id?: number
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
      profiles: {
        Row: {
          auth_provider: string
          avatar_url: string | null
          checkin_visibility: string
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          lang: string
          notify_friend_checkins: boolean
          pending_deletion_at: string | null
          username: string
        }
        Insert: {
          auth_provider: string
          avatar_url?: string | null
          checkin_visibility?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_admin?: boolean
          is_moderator?: boolean
          lang?: string
          notify_friend_checkins?: boolean
          pending_deletion_at?: string | null
          username: string
        }
        Update: {
          auth_provider?: string
          avatar_url?: string | null
          checkin_visibility?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_admin?: boolean
          is_moderator?: boolean
          lang?: string
          notify_friend_checkins?: boolean
          pending_deletion_at?: string | null
          username?: string
        }
        Relationships: []
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
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
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
          approved?: boolean | null
          city: string
          city_id: number
          condition?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          duplicate_of_venue_id?: number | null
          free_access?: boolean | null
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
          approved?: boolean | null
          city?: string
          city_id?: number
          condition?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          duplicate_of_venue_id?: number | null
          free_access?: boolean | null
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
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
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
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
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
      can_moderate: { Args: never; Returns: boolean }
      can_read_event: { Args: { p_event_id: number }; Returns: boolean }
      cancel_account_deletion: { Args: never; Returns: undefined }
      challenge_xp_value: { Args: { v_code: string }; Returns: number }
      cleanup_old_notifications: { Args: never; Returns: undefined }
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
      enforce_rate_limit: { Args: { p_action: string }; Returns: undefined }
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
      generate_recurring_events: { Args: never; Returns: undefined }
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
      get_countries_delta: { Args: { p_since?: string }; Returns: Json }
      get_equipment_catalog_delta: {
        Args: { p_category: string; p_since?: string }
        Returns: Json
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
      get_friend_feed: {
        Args: { p_limit?: number }
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
      get_friends_at_venue: {
        Args: { p_venue_id: number }
        Returns: {
          avatar_url: string
          event_title: string
          full_name: string
          source: string
          user_id: string
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
      get_profile_stats: {
        Args: { p_user_id: string }
        Returns: {
          events_joined: number
          total_checkins: number
          total_hours_played: number
          unique_venues: number
        }[]
      }
      get_venue_active_checkin_count: {
        Args: { p_venue_id: number }
        Returns: number
      }
      get_venue_champion: {
        Args: { p_days_back?: number; p_venue_id: number }
        Returns: {
          day_count: number
          full_name: string
          user_id: string
        }[]
      }
      get_venue_detail: {
        Args: { p_review_limit?: number; p_venue_id: number }
        Returns: Json
      }
      get_venues_delta: {
        Args: {
          p_city?: string
          p_city_id?: number
          p_since?: string
          p_type?: string
        }
        Returns: Json
      }
      hard_delete_expired_accounts: { Args: never; Returns: number }
      is_current_user_admin: { Args: never; Returns: boolean }
      recompute_badge_level: {
        Args: { v_completed_count: number }
        Returns: Database["public"]["Enums"]["badge_level"]
      }
      record_image_upload: { Args: never; Returns: undefined }
      refresh_city_venue_count: {
        Args: { p_city_id: number }
        Returns: undefined
      }
      refresh_stats: { Args: never; Returns: undefined }
      report_content: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_notes?: string
          p_reason: string
        }
        Returns: number
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
      search_venues_admin: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          address: string
          admin_review_notes: string | null
          approved: boolean | null
          city: string
          city_id: number
          condition: string | null
          county: string | null
          created_at: string
          description: string | null
          duplicate_of_venue_id: number | null
          free_access: boolean | null
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
      send_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_recipient_id: string
          p_title: string
        }
        Returns: undefined
      }
      submit_venue_change_request: {
        Args: {
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
      sync_badge_progress_from_submission: {
        Args: { v_submission_id: string }
        Returns: undefined
      }
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
      event_visibility: "public" | "friends" | "private"
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
      ],
      event_visibility: ["public", "friends", "private"],
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

