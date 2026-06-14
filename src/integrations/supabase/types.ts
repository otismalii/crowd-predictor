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
      app_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
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
      event_log: {
        Row: {
          actor_id: string | null
          aggregate_id: string | null
          aggregate_type: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
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
          bucket: string
          created_at: string
          description: string | null
          entry_type: string
          event_id: string | null
          guest_id: string | null
          id: string
          idempotency_key: string | null
          reference_id: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          bucket?: string
          created_at?: string
          description?: string | null
          entry_type: string
          event_id?: string | null
          guest_id?: string | null
          id?: string
          idempotency_key?: string | null
          reference_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          bucket?: string
          created_at?: string
          description?: string | null
          entry_type?: string
          event_id?: string | null
          guest_id?: string | null
          id?: string
          idempotency_key?: string | null
          reference_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_log"
            referencedColumns: ["id"]
          },
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
      market_trends: {
        Row: {
          computed_at: string
          details: Json | null
          id: string
          market_id: string
          price_delta: number
          trade_count: number
          unique_traders: number
          volume_delta: number
          window: string
        }
        Insert: {
          computed_at?: string
          details?: Json | null
          id?: string
          market_id: string
          price_delta?: number
          trade_count?: number
          unique_traders?: number
          volume_delta?: number
          window: string
        }
        Update: {
          computed_at?: string
          details?: Json | null
          id?: string
          market_id?: string
          price_delta?: number
          trade_count?: number
          unique_traders?: number
          volume_delta?: number
          window?: string
        }
        Relationships: []
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
          treasury_subsidy: number
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
          treasury_subsidy?: number
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
          treasury_subsidy?: number
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
      payment_failures: {
        Row: {
          amount: number | null
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          next_retry_at: string
          operation: string
          payload: Json | null
          provider: string
          reference: string | null
          resolved_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          next_retry_at?: string
          operation: string
          payload?: Json | null
          provider: string
          reference?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          next_retry_at?: string
          operation?: string
          payload?: Json | null
          provider?: string
          reference?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
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
          risk_score: number
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
          risk_score?: number
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
          risk_score?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          username?: string | null
        }
        Relationships: []
      }
      reconciliation_runs: {
        Row: {
          created_at: string
          details: Json | null
          drift: number
          id: string
          ledger_balance: number
          run_at: string
          status: string
          user_id: string | null
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          drift?: number
          id?: string
          ledger_balance?: number
          run_at?: string
          status?: string
          user_id?: string | null
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          drift?: number
          id?: string
          ledger_balance?: number
          run_at?: string
          status?: string
          user_id?: string | null
          wallet_balance?: number
        }
        Relationships: []
      }
      risk_signals: {
        Row: {
          action_taken: string | null
          created_at: string
          details: Json | null
          id: string
          metric_value: number | null
          severity: string
          signal_type: string
          threshold: number | null
          user_id: string
          window_end: string | null
          window_start: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          metric_value?: number | null
          severity?: string
          signal_type: string
          threshold?: number | null
          user_id: string
          window_end?: string | null
          window_start?: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          metric_value?: number | null
          severity?: string
          signal_type?: string
          threshold?: number | null
          user_id?: string
          window_end?: string | null
          window_start?: string
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
      support_tickets: {
        Row: {
          admin_response: string | null
          closed_at: string | null
          created_at: string
          id: string
          message: string
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          message: string
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          message?: string
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_until: string | null
          payload: Json
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_until?: string | null
          payload?: Json
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_until?: string | null
          payload?: Json
          run_after?: string
          status?: string
          updated_at?: string
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
          pesapal_tracking_id: string | null
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
          pesapal_tracking_id?: string | null
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
          pesapal_tracking_id?: string | null
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
      wallets: {
        Row: {
          balance: number
          bonus_balance: number
          casino_credit_balance: number
          created_at: string
          currency: string
          daily_withdrawal_total: number
          escrow_balance: number
          fantasy_entry_balance: number
          id: string
          last_deposit_at: string | null
          last_withdrawal_at: string | null
          locked_balance: number
          locked_reason: string | null
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_balance?: number
          casino_credit_balance?: number
          created_at?: string
          currency?: string
          daily_withdrawal_total?: number
          escrow_balance?: number
          fantasy_entry_balance?: number
          id?: string
          last_deposit_at?: string | null
          last_withdrawal_at?: string | null
          locked_balance?: number
          locked_reason?: string | null
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_balance?: number
          casino_credit_balance?: number
          created_at?: string
          currency?: string
          daily_withdrawal_total?: number
          escrow_balance?: number
          fantasy_entry_balance?: number
          id?: string
          last_deposit_at?: string | null
          last_withdrawal_at?: string | null
          locked_balance?: number
          locked_reason?: string | null
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          alert_price: number | null
          created_at: string
          id: string
          market_id: string
          user_id: string
        }
        Insert: {
          alert_price?: number | null
          created_at?: string
          id?: string
          market_id: string
          user_id: string
        }
        Update: {
          alert_price?: number | null
          created_at?: string
          id?: string
          market_id?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string
          payout_reference: string | null
          phone_number: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payout_reference?: string | null
          phone_number?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payout_reference?: string | null
          phone_number?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          accuracy_rate: number | null
          avatar_url: string | null
          best_streak: number | null
          bio: string | null
          created_at: string | null
          current_streak: number | null
          followers_count: number | null
          id: string | null
          reputation_score: number | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          username: string | null
        }
        Insert: {
          accuracy_rate?: number | null
          avatar_url?: string | null
          best_streak?: number | null
          bio?: string | null
          created_at?: string | null
          current_streak?: number | null
          followers_count?: number | null
          id?: string | null
          reputation_score?: number | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          username?: string | null
        }
        Update: {
          accuracy_rate?: number | null
          avatar_url?: string | null
          best_streak?: number | null
          bio?: string | null
          created_at?: string | null
          current_streak?: number | null
          followers_count?: number | null
          id?: string | null
          reputation_score?: number | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          username?: string | null
        }
        Relationships: []
      }
      v_wallet_balance: {
        Row: {
          balance: number | null
          bucket: string | null
          last_movement_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_profiles: {
        Args: never
        Returns: {
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
          risk_score: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      credit_balance: {
        Args: { p_amount: number; p_balance_type?: string; p_user_id: string }
        Returns: boolean
      }
      deduct_balance: {
        Args: { p_amount: number; p_balance_type?: string; p_user_id: string }
        Returns: boolean
      }
      deduct_balance_idempotent: {
        Args: {
          p_amount: number
          p_balance_type?: string
          p_idempotency_key?: string
          p_user_id: string
        }
        Returns: boolean
      }
      derived_balance: { Args: { p_user_id: string }; Returns: number }
      fn_settle_trade: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_market_id: string
          p_outcome_id: string
          p_price: number
          p_shares: number
          p_user_id: string
        }
        Returns: Json
      }
      get_guest_session: {
        Args: { p_guest_id: string }
        Returns: {
          converted_user_id: string | null
          created_at: string
          credits: number
          device_fingerprint: string | null
          expired: boolean
          guest_id: string
          id: string
          last_active_at: string
        }
        SetofOptions: {
          from: "*"
          to: "guest_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_market_recent_trades: {
        Args: { p_limit?: number; p_market_id: string }
        Returns: {
          created_at: string
          id: string
          market_id: string
          outcome_id: string
          price_per_share: number
          shares: number
          side: string
          total_cost: number
          username: string
        }[]
      }
      get_own_profile: {
        Args: never
        Returns: {
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
          risk_score: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lock_for_withdrawal: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      release_withdrawal_lock: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "verified_user"
        | "risk_flagged"
        | "market_operator"
        | "super_admin"
        | "trusted_predictor"
        | "analyst"
        | "market_creator"
        | "verified_creator"
        | "market_manager"
      bet_status: "pending" | "accepted" | "declined" | "resolved" | "cancelled"
      market_status:
        | "open"
        | "closed"
        | "resolved"
        | "cancelled"
        | "draft"
        | "review"
        | "published"
        | "active"
        | "frozen"
        | "settled"
        | "archived"
      match_status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
      p2p_status:
        | "draft"
        | "open"
        | "matched"
        | "active"
        | "resolved"
        | "disputed"
        | "cancelled"
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
      withdrawal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "processing"
        | "paid"
        | "failed"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "verified_user",
        "risk_flagged",
        "market_operator",
        "super_admin",
        "trusted_predictor",
        "analyst",
        "market_creator",
        "verified_creator",
        "market_manager",
      ],
      bet_status: ["pending", "accepted", "declined", "resolved", "cancelled"],
      market_status: [
        "open",
        "closed",
        "resolved",
        "cancelled",
        "draft",
        "review",
        "published",
        "active",
        "frozen",
        "settled",
        "archived",
      ],
      match_status: ["upcoming", "live", "finished", "postponed", "cancelled"],
      p2p_status: [
        "draft",
        "open",
        "matched",
        "active",
        "resolved",
        "disputed",
        "cancelled",
      ],
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
      withdrawal_status: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "paid",
        "failed",
      ],
    },
  },
} as const
