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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          ai_summary: string
          community_prediction: string | null
          created_at: string
          id: string
          match_id: string
        }
        Insert: {
          ai_summary: string
          community_prediction?: string | null
          created_at?: string
          id?: string
          match_id: string
        }
        Update: {
          ai_summary?: string
          community_prediction?: string | null
          created_at?: string
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          slug: string
          threshold: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          slug: string
          threshold?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          threshold?: number
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      guest_sessions: {
        Row: {
          converted_user_id: string | null
          created_at: string
          credits: number
          device_fingerprint: string | null
          expired: boolean
          guest_id: string
          id: string
          last_active_at: string
        }
        Insert: {
          converted_user_id?: string | null
          created_at?: string
          credits?: number
          device_fingerprint?: string | null
          expired?: boolean
          guest_id: string
          id?: string
          last_active_at?: string
        }
        Update: {
          converted_user_id?: string | null
          created_at?: string
          credits?: number
          device_fingerprint?: string | null
          expired?: boolean
          guest_id?: string
          id?: string
          last_active_at?: string
        }
        Relationships: []
      }
      ingestion_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          raw_data: Json | null
          records_fetched: number | null
          records_processed: number | null
          source_id: string | null
          source_name: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          raw_data?: Json | null
          records_fetched?: number | null
          records_processed?: number | null
          source_id?: string | null
          source_name: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          raw_data?: Json | null
          records_fetched?: number | null
          records_processed?: number | null
          source_id?: string | null
          source_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          entry_type: string
          guest_id: string | null
          id: string
          reference_id: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          entry_type: string
          guest_id?: string | null
          id?: string
          reference_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          entry_type?: string
          guest_id?: string | null
          id?: string
          reference_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          market_id: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          market_id?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          market_id?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_audit_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          market_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          market_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          market_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comments_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "market_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      market_disputes: {
        Row: {
          admin_response: string | null
          created_at: string
          evidence: string | null
          id: string
          market_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          market_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          market_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_disputes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_outcomes: {
        Row: {
          created_at: string
          id: string
          is_winner: boolean | null
          label: string
          market_id: string
          pool_shares: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          label: string
          market_id: string
          pool_shares?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          label?: string
          market_id?: string
          pool_shares?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_outcomes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_sources: {
        Row: {
          confidence: number | null
          created_at: string
          fetched_at: string | null
          id: string
          market_id: string
          snapshot_data: Json | null
          source_name: string
          source_type: string
          source_url: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          fetched_at?: string | null
          id?: string
          market_id: string
          snapshot_data?: Json | null
          source_name: string
          source_type?: string
          source_url?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          fetched_at?: string | null
          id?: string
          market_id?: string
          snapshot_data?: Json | null
          source_name?: string
          source_type?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_sources_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_suggestions: {
        Row: {
          category: string | null
          confidence_score: number | null
          created_at: string
          created_market_id: string | null
          description: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_data: Json | null
          source_id: string | null
          status: string
          subcategory: string | null
          suggested_outcomes: Json | null
          title: string
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string
          created_market_id?: string | null
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_data?: Json | null
          source_id?: string | null
          status?: string
          subcategory?: string | null
          suggested_outcomes?: Json | null
          title: string
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string
          created_market_id?: string | null
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_data?: Json | null
          source_id?: string | null
          status?: string
          subcategory?: string | null
          suggested_outcomes?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_suggestions_created_market_id_fkey"
            columns: ["created_market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_suggestions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          alt_text: string | null
          category: string
          closes_at: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_source_type: string | null
          image_url: string | null
          liquidity_param: number
          match_id: string | null
          resolution_rule: string | null
          resolution_source: string | null
          resolved_at: string | null
          risk_level: string | null
          slug: string | null
          status: Database["public"]["Enums"]["market_status"]
          subcategory: string | null
          tags: string[] | null
          title: string
          total_volume: number
        }
        Insert: {
          alt_text?: string | null
          category?: string
          closes_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_source_type?: string | null
          image_url?: string | null
          liquidity_param?: number
          match_id?: string | null
          resolution_rule?: string | null
          resolution_source?: string | null
          resolved_at?: string | null
          risk_level?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          subcategory?: string | null
          tags?: string[] | null
          title: string
          total_volume?: number
        }
        Update: {
          alt_text?: string | null
          category?: string
          closes_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_source_type?: string | null
          image_url?: string | null
          liquidity_param?: number
          match_id?: string | null
          resolution_rule?: string | null
          resolution_source?: string | null
          resolved_at?: string | null
          risk_level?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          subcategory?: string | null
          tags?: string[] | null
          title?: string
          total_volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "markets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team: string
          created_at: string
          external_match_id: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff: string
          league: string
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          away_score?: number | null
          away_team: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          kickoff: string
          league: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          away_score?: number | null
          away_team?: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff?: string
          league?: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_bets: {
        Row: {
          challenger_id: string
          challenger_prediction_away: number
          challenger_prediction_home: number
          created_at: string
          house_cut_percent: number
          id: string
          match_id: string
          opponent_id: string
          opponent_prediction_away: number | null
          opponent_prediction_home: number | null
          resolved_at: string | null
          stake_amount: number
          status: Database["public"]["Enums"]["bet_status"]
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_prediction_away: number
          challenger_prediction_home: number
          created_at?: string
          house_cut_percent?: number
          id?: string
          match_id: string
          opponent_id: string
          opponent_prediction_away?: number | null
          opponent_prediction_home?: number | null
          resolved_at?: string | null
          stake_amount?: number
          status?: Database["public"]["Enums"]["bet_status"]
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_prediction_away?: number
          challenger_prediction_home?: number
          created_at?: string
          house_cut_percent?: number
          id?: string
          match_id?: string
          opponent_id?: string
          opponent_prediction_away?: number | null
          opponent_prediction_home?: number | null
          resolved_at?: string | null
          stake_amount?: number
          status?: Database["public"]["Enums"]["bet_status"]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          avg_price: number
          created_at: string
          id: string
          market_id: string
          outcome_id: string
          shares: number
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_price?: number
          created_at?: string
          id?: string
          market_id: string
          outcome_id: string
          shares?: number
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          created_at?: string
          id?: string
          market_id?: string
          outcome_id?: string
          shares?: number
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "market_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          analysis: string | null
          confidence: number
          created_at: string
          id: string
          match_id: string
          predicted_away_score: number
          predicted_home_score: number
          status: Database["public"]["Enums"]["prediction_status"]
          user_id: string
        }
        Insert: {
          analysis?: string | null
          confidence?: number
          created_at?: string
          id?: string
          match_id: string
          predicted_away_score: number
          predicted_home_score: number
          status?: Database["public"]["Enums"]["prediction_status"]
          user_id: string
        }
        Update: {
          analysis?: string | null
          confidence?: number
          created_at?: string
          id?: string
          match_id?: string
          predicted_away_score?: number
          predicted_home_score?: number
          status?: Database["public"]["Enums"]["prediction_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accuracy_rate: number
          avatar_url: string | null
          best_streak: number
          bio: string | null
          created_at: string
          current_streak: number
          email: string | null
          email_verified: boolean
          followers_count: number
          id: string
          phone_number: string | null
          phone_verified: boolean
          reputation_score: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          username: string | null
        }
        Insert: {
          accuracy_rate?: number
          avatar_url?: string | null
          best_streak?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          email?: string | null
          email_verified?: boolean
          followers_count?: number
          id: string
          phone_number?: string | null
          phone_verified?: boolean
          reputation_score?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          username?: string | null
        }
        Update: {
          accuracy_rate?: number
          avatar_url?: string | null
          best_streak?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          email?: string | null
          email_verified?: boolean
          followers_count?: number
          id?: string
          phone_number?: string | null
          phone_verified?: boolean
          reputation_score?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          username?: string | null
        }
        Relationships: []
      }
      source_registry: {
        Row: {
          base_url: string | null
          config: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          last_error: string | null
          last_fetched_at: string | null
          name: string
          priority: number | null
          source_type: string
        }
        Insert: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_fetched_at?: string | null
          name: string
          priority?: number | null
          source_type?: string
        }
        Update: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_fetched_at?: string | null
          name?: string
          priority?: number | null
          source_type?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          created_at: string
          id: string
          market_id: string
          outcome_id: string
          price_per_share: number
          shares: number
          side: string
          total_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          outcome_id: string
          price_per_share: number
          shares: number
          side: string
          total_cost: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          outcome_id?: string
          price_per_share?: number
          shares?: number
          side?: string
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "market_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          mpesa_receipt: string | null
          phone_number: string | null
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          mpesa_receipt?: string | null
          phone_number?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          mpesa_receipt?: string | null
          phone_number?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
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
      votes: {
        Row: {
          created_at: string
          id: string
          prediction_id: string
          user_id: string
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          prediction_id: string
          user_id: string
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Update: {
          created_at?: string
          id?: string
          prediction_id?: string
          user_id?: string
          vote_type?: Database["public"]["Enums"]["vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "votes_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      bet_status: "pending" | "accepted" | "declined" | "resolved" | "cancelled"
      market_status: "open" | "closed" | "resolved" | "cancelled"
      match_status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
      prediction_status: "pending" | "correct" | "incorrect"
      subscription_plan: "free" | "weekly" | "monthly" | "quarterly"
      transaction_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "bet_stake"
        | "bet_win"
        | "bet_refund"
        | "house_fee"
      vote_type: "up" | "down"
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
      bet_status: ["pending", "accepted", "declined", "resolved", "cancelled"],
      market_status: ["open", "closed", "resolved", "cancelled"],
      match_status: ["upcoming", "live", "finished", "postponed", "cancelled"],
      prediction_status: ["pending", "correct", "incorrect"],
      subscription_plan: ["free", "weekly", "monthly", "quarterly"],
      transaction_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "bet_stake",
        "bet_win",
        "bet_refund",
        "house_fee",
      ],
      vote_type: ["up", "down"],
    },
  },
} as const
