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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      areas: {
        Row: {
          area_id: number
          area_name: string
          display_order: number
          is_active: boolean
        }
        Insert: {
          area_id?: never
          area_name: string
          display_order: number
          is_active?: boolean
        }
        Update: {
          area_id?: never
          area_name?: string
          display_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      dishes: {
        Row: {
          description: string
          dish_id: number
          dish_name: string
          display_order: number
          is_active: boolean
          search_image_url: string | null
        }
        Insert: {
          description: string
          dish_id?: never
          dish_name: string
          display_order: number
          is_active?: boolean
          search_image_url?: string | null
        }
        Update: {
          description?: string
          dish_id?: never
          dish_name?: string
          display_order?: number
          is_active?: boolean
          search_image_url?: string | null
        }
        Relationships: []
      }
      store_dishes: {
        Row: {
          dish_id: number
          display_order: number
          is_available: boolean
          store_id: number
        }
        Insert: {
          dish_id: number
          display_order: number
          is_available: boolean
          store_id: number
        }
        Update: {
          dish_id?: number
          display_order?: number
          is_available?: boolean
          store_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "store_dishes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      store_photos: {
        Row: {
          alt_text: string
          dish_id: number | null
          display_order: number
          photo_id: number
          photo_type: string
          photo_url: string
          store_id: number
        }
        Insert: {
          alt_text: string
          dish_id?: number | null
          display_order: number
          photo_id?: never
          photo_type: string
          photo_url: string
          store_id: number
        }
        Update: {
          alt_text?: string
          dish_id?: number | null
          display_order?: number
          photo_id?: never
          photo_type?: string
          photo_url?: string
          store_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_photos_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "store_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      store_visit_notes: {
        Row: {
          created_at: string
          note_id: number
          note_text: string
          store_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note_id?: never
          note_text: string
          store_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note_id?: never
          note_text?: string
          store_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_visit_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          area_id: number
          atmosphere_text: string
          catch_copy: string
          created_at: string
          dinner_hours: string | null
          dinner_price_from: number | null
          has_dinner: boolean
          has_lunch: boolean
          information_source_type: string
          information_source_url: string
          is_published: boolean
          last_verified_on: string
          lunch_hours: string | null
          lunch_price_from: number | null
          map_url: string
          nearest_station_name: string
          official_site_url: string | null
          phone_number: string | null
          regular_holiday: string | null
          reservation_text: string | null
          scene_date: boolean
          scene_family: boolean
          scene_friends: boolean
          scene_solo: boolean
          seat_type_text: string | null
          spice_support_text: string | null
          store_id: number
          store_name: string
          updated_at: string
          walk_minutes: number
        }
        Insert: {
          address: string
          area_id: number
          atmosphere_text: string
          catch_copy: string
          created_at?: string
          dinner_hours?: string | null
          dinner_price_from?: number | null
          has_dinner: boolean
          has_lunch: boolean
          information_source_type: string
          information_source_url: string
          is_published?: boolean
          last_verified_on: string
          lunch_hours?: string | null
          lunch_price_from?: number | null
          map_url: string
          nearest_station_name: string
          official_site_url?: string | null
          phone_number?: string | null
          regular_holiday?: string | null
          reservation_text?: string | null
          scene_date?: boolean
          scene_family?: boolean
          scene_friends?: boolean
          scene_solo?: boolean
          seat_type_text?: string | null
          spice_support_text?: string | null
          store_id?: never
          store_name: string
          updated_at?: string
          walk_minutes: number
        }
        Update: {
          address?: string
          area_id?: number
          atmosphere_text?: string
          catch_copy?: string
          created_at?: string
          dinner_hours?: string | null
          dinner_price_from?: number | null
          has_dinner?: boolean
          has_lunch?: boolean
          information_source_type?: string
          information_source_url?: string
          is_published?: boolean
          last_verified_on?: string
          lunch_hours?: string | null
          lunch_price_from?: number | null
          map_url?: string
          nearest_station_name?: string
          official_site_url?: string | null
          phone_number?: string | null
          regular_holiday?: string | null
          reservation_text?: string | null
          scene_date?: boolean
          scene_family?: boolean
          scene_friends?: boolean
          scene_solo?: boolean
          seat_type_text?: string | null
          spice_support_text?: string | null
          store_id?: never
          store_name?: string
          updated_at?: string
          walk_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "stores_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
        ]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
