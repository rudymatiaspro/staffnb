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
      availability_requests: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_close_states: {
        Row: {
          date: string
          id: string
          report_id: string | null
          report_ready_at: string | null
          triggered: boolean
          triggered_at: string | null
        }
        Insert: {
          date: string
          id?: string
          report_id?: string | null
          report_ready_at?: string | null
          triggered?: boolean
          triggered_at?: string | null
        }
        Update: {
          date?: string
          id?: string
          report_id?: string | null
          report_ready_at?: string | null
          triggered?: boolean
          triggered_at?: string | null
        }
        Relationships: []
      }
      day_reports: {
        Row: {
          completed_tasks: number
          date: string
          generated_at: string
          id: string
          manager_notes: string | null
          staff_performance: Json
          stock_alerts: Json
          team_completion_rates: Json
          total_tasks: number
          triggered_by: Database["public"]["Enums"]["report_trigger"]
          triggered_by_user: string | null
        }
        Insert: {
          completed_tasks?: number
          date: string
          generated_at?: string
          id?: string
          manager_notes?: string | null
          staff_performance?: Json
          stock_alerts?: Json
          team_completion_rates?: Json
          total_tasks?: number
          triggered_by?: Database["public"]["Enums"]["report_trigger"]
          triggered_by_user?: string | null
        }
        Update: {
          completed_tasks?: number
          date?: string
          generated_at?: string
          id?: string
          manager_notes?: string | null
          staff_performance?: Json
          stock_alerts?: Json
          team_completion_rates?: Json
          total_tasks?: number
          triggered_by?: Database["public"]["Enums"]["report_trigger"]
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      gamification_settings: {
        Row: {
          bonus_reset_time: string
          collective_penalty_points: number
          collective_penalty_threshold: number
          daily_bonus_base: number
          id: string
          malus_per_late_task: number
          penalty_late_clock: number
          penalty_no_clock: number
          penalty_overdue: number
          points_clock_in: number
          points_early: number
          points_on_time: number
          points_perfect_day: number
          points_with_photo: number
          updated_at: string
        }
        Insert: {
          bonus_reset_time?: string
          collective_penalty_points?: number
          collective_penalty_threshold?: number
          daily_bonus_base?: number
          id?: string
          malus_per_late_task?: number
          penalty_late_clock?: number
          penalty_no_clock?: number
          penalty_overdue?: number
          points_clock_in?: number
          points_early?: number
          points_on_time?: number
          points_perfect_day?: number
          points_with_photo?: number
          updated_at?: string
        }
        Update: {
          bonus_reset_time?: string
          collective_penalty_points?: number
          collective_penalty_threshold?: number
          daily_bonus_base?: number
          id?: string
          malus_per_late_task?: number
          penalty_late_clock?: number
          penalty_no_clock?: number
          penalty_overdue?: number
          points_clock_in?: number
          points_early?: number
          points_on_time?: number
          points_perfect_day?: number
          points_with_photo?: number
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          anonymous: boolean
          created_at: string
          description: string
          id: string
          location: string
          reporter_name: string | null
          reporter_user_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          team: string
          type: string
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          created_at?: string
          description: string
          id?: string
          location: string
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          team: string
          type: string
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          created_at?: string
          description?: string
          id?: string
          location?: string
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          team?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      malus_contests: {
        Row: {
          arbiter_id: string | null
          arbiter_name: string | null
          arbiter_note: string | null
          contestant_id: string
          contestant_name: string
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          score_event_id: string | null
          status: string
        }
        Insert: {
          arbiter_id?: string | null
          arbiter_name?: string | null
          arbiter_note?: string | null
          contestant_id: string
          contestant_name?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          score_event_id?: string | null
          status?: string
        }
        Update: {
          arbiter_id?: string | null
          arbiter_name?: string | null
          arbiter_note?: string | null
          contestant_id?: string
          contestant_name?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          score_event_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "malus_contests_arbiter_id_fkey"
            columns: ["arbiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "malus_contests_contestant_id_fkey"
            columns: ["contestant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "malus_contests_score_event_id_fkey"
            columns: ["score_event_id"]
            isOneToOne: false
            referencedRelation: "score_events"
            referencedColumns: ["id"]
          },
        ]
      }
      malus_events: {
        Row: {
          id: string
          points: number
          task_id: string | null
          task_name: string
          team: Database["public"]["Enums"]["team_name"]
          timestamp: string
        }
        Insert: {
          id?: string
          points?: number
          task_id?: string | null
          task_name?: string
          team: Database["public"]["Enums"]["team_name"]
          timestamp?: string
        }
        Update: {
          id?: string
          points?: number
          task_id?: string | null
          task_name?: string
          team?: Database["public"]["Enums"]["team_name"]
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "malus_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          sender_id: string
          sender_name: string
          sender_team: string
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          sender_id: string
          sender_name?: string
          sender_team?: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          sender_id?: string
          sender_name?: string
          sender_team?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          ref_id: string | null
          ref_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title?: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit: Database["public"]["Enums"]["order_unit"]
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit?: Database["public"]["Enums"]["order_unit"]
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit?: Database["public"]["Enums"]["order_unit"]
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_receipt_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          ordered_qty: number
          product_id: string | null
          product_name: string
          receipt_id: string
          received_qty: number
          unit: Database["public"]["Enums"]["order_unit"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          ordered_qty?: number
          product_id?: string | null
          product_name?: string
          receipt_id: string
          received_qty?: number
          unit?: Database["public"]["Enums"]["order_unit"]
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          ordered_qty?: number
          product_id?: string | null
          product_name?: string
          receipt_id?: string
          received_qty?: number
          unit?: Database["public"]["Enums"]["order_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "order_receipt_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "order_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_receipts: {
        Row: {
          created_at: string
          gap_note: string | null
          has_gap: boolean
          id: string
          order_id: string
          received_at: string
          received_by: string | null
          received_by_name: string
        }
        Insert: {
          created_at?: string
          gap_note?: string | null
          has_gap?: boolean
          id?: string
          order_id: string
          received_at?: string
          received_by?: string | null
          received_by_name?: string
        }
        Update: {
          created_at?: string
          gap_note?: string | null
          has_gap?: boolean
          id?: string
          order_id?: string
          received_at?: string
          received_by?: string | null
          received_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_recurring: boolean
          next_occurrence: string | null
          notes: string | null
          order_number: string
          recurrence_freq: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"]
          supplier: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          is_recurring?: boolean
          next_occurrence?: string | null
          notes?: string | null
          order_number: string
          recurrence_freq?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          is_recurring?: boolean
          next_occurrence?: string | null
          notes?: string | null
          order_number?: string
          recurrence_freq?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          note: string | null
          shift_end: string
          shift_start: string
          shift_type: string
          team: string
          updated_at: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          note?: string | null
          shift_end?: string
          shift_start?: string
          shift_type: string
          team?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
          shift_end?: string
          shift_start?: string
          shift_type?: string
          team?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          current_stock: number
          id: string
          min_threshold: number
          name: string
          notes: string | null
          supplier: string | null
          supplier_contact: string | null
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          current_stock?: number
          id?: string
          min_threshold?: number
          name: string
          notes?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          current_stock?: number
          id?: string
          min_threshold?: number
          name?: string
          notes?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profile_teams: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          team: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_teams_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          pin_hash: string | null
          pin_set: boolean
          score: number
          station_pin_hash: string | null
          station_pin_set: boolean
          team: Database["public"]["Enums"]["team_name"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          photo_url?: string | null
          pin_hash?: string | null
          pin_set?: boolean
          score?: number
          station_pin_hash?: string | null
          station_pin_set?: boolean
          team?: Database["public"]["Enums"]["team_name"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          pin_hash?: string | null
          pin_set?: boolean
          score?: number
          station_pin_hash?: string | null
          station_pin_set?: boolean
          team?: Database["public"]["Enums"]["team_name"]
          updated_at?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          id: string
          points: number
          reason: string
          team: Database["public"]["Enums"]["team_name"]
          timestamp: string
          type: Database["public"]["Enums"]["score_event_type"]
          user_id: string
          user_name: string
        }
        Insert: {
          id?: string
          points?: number
          reason?: string
          team?: Database["public"]["Enums"]["team_name"]
          timestamp?: string
          type?: Database["public"]["Enums"]["score_event_type"]
          user_id: string
          user_name?: string
        }
        Update: {
          id?: string
          points?: number
          reason?: string
          team?: Database["public"]["Enums"]["team_name"]
          timestamp?: string
          type?: Database["public"]["Enums"]["score_event_type"]
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          rejection_reason: string | null
          requester_id: string
          requester_name: string
          reviewed_by: string | null
          reviewed_by_name: string | null
          shift_id: string | null
          status: string
          target_shift_id: string | null
          target_user_id: string | null
          target_user_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          rejection_reason?: string | null
          requester_id: string
          requester_name?: string
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          shift_id?: string | null
          status?: string
          target_shift_id?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          rejection_reason?: string | null
          requester_id?: string
          requester_name?: string
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          shift_id?: string | null
          status?: string
          target_shift_id?: string | null
          target_user_id?: string | null
          target_user_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_shift_id_fkey"
            columns: ["target_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          date: string
          id: string
          team: Database["public"]["Enums"]["team_name"]
          total_minutes: number | null
          user_id: string
          user_name: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          team?: Database["public"]["Enums"]["team_name"]
          total_minutes?: number | null
          user_id: string
          user_name?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          team?: Database["public"]["Enums"]["team_name"]
          total_minutes?: number | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_logs: {
        Row: {
          delta: number
          id: string
          product_id: string
          reason: Database["public"]["Enums"]["stock_update_reason"]
          timestamp: string
          updated_by: string
        }
        Insert: {
          delta: number
          id?: string
          product_id: string
          reason?: Database["public"]["Enums"]["stock_update_reason"]
          timestamp?: string
          updated_by?: string
        }
        Update: {
          delta?: number
          id?: string
          product_id?: string
          reason?: Database["public"]["Enums"]["stock_update_reason"]
          timestamp?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          created_by: string | null
          days: number[] | null
          description: string | null
          frequency: Database["public"]["Enums"]["task_frequency"]
          id: string
          name: string
          points: number
          team: Database["public"]["Enums"]["team_name"]
          time: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          days?: number[] | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["task_frequency"]
          id?: string
          name: string
          points?: number
          team?: Database["public"]["Enums"]["team_name"]
          time?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          days?: number[] | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["task_frequency"]
          id?: string
          name?: string
          points?: number
          team?: Database["public"]["Enums"]["team_name"]
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          assigned_user_name: string | null
          created_at: string
          created_by: string | null
          deadline: string
          description: string | null
          id: string
          is_punctual: boolean
          is_recurring: boolean
          name: string
          points: number
          status: Database["public"]["Enums"]["task_status"]
          team: Database["public"]["Enums"]["team_name"]
          template_id: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          assigned_user_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline: string
          description?: string | null
          id?: string
          is_punctual?: boolean
          is_recurring?: boolean
          name: string
          points?: number
          status?: Database["public"]["Enums"]["task_status"]
          team?: Database["public"]["Enums"]["team_name"]
          template_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          assigned_user_name?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string | null
          id?: string
          is_punctual?: boolean
          is_recurring?: boolean
          name?: string
          points?: number
          status?: Database["public"]["Enums"]["task_status"]
          team?: Database["public"]["Enums"]["team_name"]
          template_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      team_objectives: {
        Row: {
          auto_track: boolean
          auto_track_metric: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_user_id: string | null
          current_value: number
          deadline: string
          description: string | null
          id: string
          target_value: number
          team: string
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          auto_track?: boolean
          auto_track_metric?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          current_value?: number
          deadline: string
          description?: string | null
          id?: string
          target_value: number
          team?: string
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          auto_track?: boolean
          auto_track_metric?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          current_value?: number
          deadline?: string
          description?: string | null
          id?: string
          target_value?: number
          team?: string
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_objectives_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_scores: {
        Row: {
          base_bonus: number
          completion_rate: number | null
          current_bonus: number
          date: string
          id: string
          team: Database["public"]["Enums"]["team_name"]
          total_malus: number
        }
        Insert: {
          base_bonus?: number
          completion_rate?: number | null
          current_bonus?: number
          date: string
          id?: string
          team: Database["public"]["Enums"]["team_name"]
          total_malus?: number
        }
        Update: {
          base_bonus?: number
          completion_rate?: number | null
          current_bonus?: number
          date?: string
          id?: string
          team?: Database["public"]["Enums"]["team_name"]
          total_malus?: number
        }
        Relationships: []
      }
      temperature_locations: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          max_threshold: number
          min_threshold: number | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          max_threshold: number
          min_threshold?: number | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          max_threshold?: number
          min_threshold?: number | null
          name?: string
        }
        Relationships: []
      }
      temperature_logs: {
        Row: {
          created_at: string
          id: string
          is_alert: boolean
          location_id: string
          location_name: string
          logged_by: string
          logged_by_user_id: string | null
          note: string | null
          temperature: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_alert?: boolean
          location_id: string
          location_name: string
          logged_by: string
          logged_by_user_id?: string | null
          note?: string | null
          temperature: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_alert?: boolean
          location_id?: string
          location_name?: string
          logged_by?: string
          logged_by_user_id?: string | null
          note?: string | null
          temperature?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "temperature_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "temperature_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temperature_logs_logged_by_user_id_fkey"
            columns: ["logged_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_team: {
        Args: { target_team: Database["public"]["Enums"]["team_name"] }
        Returns: boolean
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_my_team: {
        Args: never
        Returns: Database["public"]["Enums"]["team_name"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager_or_owner: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      clock_event_type: "in" | "out"
      order_status: "draft" | "pending" | "validated" | "received" | "rejected"
      order_unit: "kg" | "g" | "L" | "cL" | "pcs" | "carton" | "caisse"
      report_trigger: "manual" | "auto"
      score_event_type: "bonus" | "penalty" | "collective_penalty"
      stock_update_reason:
        | "Delivery received"
        | "Consumed"
        | "Damaged"
        | "Inventory correction"
      task_frequency: "daily" | "weekly" | "custom"
      task_status: "pending" | "in_progress" | "done" | "overdue"
      team_name: "BAR" | "KITCHEN" | "FLOOR" | "ATELIER" | "MANAGEMENT" | "ALL"
      unit_type: "btl" | "pcs"
      user_role: "owner" | "manager" | "staff" | "god" | "admin" | "chef"
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
      clock_event_type: ["in", "out"],
      order_status: ["draft", "pending", "validated", "received", "rejected"],
      order_unit: ["kg", "g", "L", "cL", "pcs", "carton", "caisse"],
      report_trigger: ["manual", "auto"],
      score_event_type: ["bonus", "penalty", "collective_penalty"],
      stock_update_reason: [
        "Delivery received",
        "Consumed",
        "Damaged",
        "Inventory correction",
      ],
      task_frequency: ["daily", "weekly", "custom"],
      task_status: ["pending", "in_progress", "done", "overdue"],
      team_name: ["BAR", "KITCHEN", "FLOOR", "ATELIER", "MANAGEMENT", "ALL"],
      unit_type: ["btl", "pcs"],
      user_role: ["owner", "manager", "staff", "god", "admin", "chef"],
    },
  },
} as const
