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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          order_email: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          id?: boolean
          order_email?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          id?: boolean
          order_email?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          created_at: string
          id: string
          model_id: string
          name: string
          selection: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          name?: string
          selection?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          name?: string
          selection?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_zones: {
        Row: {
          default_finish: Database["public"]["Enums"]["finish"] | null
          default_swatch_id: string | null
          id: string
          layer_height: number | null
          layer_path: string | null
          layer_width: number | null
          material: Database["public"]["Enums"]["material"]
          model_id: string
          name: string
          pattern_height: number | null
          pattern_hex: string | null
          pattern_own: boolean
          pattern_path: string | null
          pattern_width: number | null
          role: Database["public"]["Enums"]["zone_role"] | null
          sort_order: number
        }
        Insert: {
          default_finish?: Database["public"]["Enums"]["finish"] | null
          default_swatch_id?: string | null
          id?: string
          layer_height?: number | null
          layer_path?: string | null
          layer_width?: number | null
          material: Database["public"]["Enums"]["material"]
          model_id: string
          name: string
          pattern_height?: number | null
          pattern_hex?: string | null
          pattern_own?: boolean
          pattern_path?: string | null
          pattern_width?: number | null
          role?: Database["public"]["Enums"]["zone_role"] | null
          sort_order?: number
        }
        Update: {
          default_finish?: Database["public"]["Enums"]["finish"] | null
          default_swatch_id?: string | null
          id?: string
          layer_height?: number | null
          layer_path?: string | null
          layer_width?: number | null
          material?: Database["public"]["Enums"]["material"]
          model_id?: string
          name?: string
          pattern_height?: number | null
          pattern_hex?: string | null
          pattern_own?: boolean
          pattern_path?: string | null
          pattern_width?: number | null
          role?: Database["public"]["Enums"]["zone_role"] | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "model_zones_default_swatch_id_fkey"
            columns: ["default_swatch_id"]
            isOneToOne: false
            referencedRelation: "swatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_zones_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          base_height: number | null
          base_path: string | null
          base_width: number | null
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          published: boolean
          size_ref: string | null
          sort_order: number
          thumb_key: string | null
          thumb_path: string | null
          updated_at: string
        }
        Insert: {
          base_height?: number | null
          base_path?: string | null
          base_width?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          published?: boolean
          size_ref?: string | null
          sort_order?: number
          thumb_key?: string | null
          thumb_path?: string | null
          updated_at?: string
        }
        Update: {
          base_height?: number | null
          base_path?: string | null
          base_width?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          published?: boolean
          size_ref?: string | null
          sort_order?: number
          thumb_key?: string | null
          thumb_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          alpha: number | null
          finish: Database["public"]["Enums"]["finish"] | null
          hex: string
          id: string
          kind: Database["public"]["Enums"]["swatch_kind"]
          line_id: string
          material: Database["public"]["Enums"]["material"]
          order_id: string
          ref: string
          sort_order: number
          swatch_name: string
          texture_path: string | null
          zone_name: string
          zone_role: Database["public"]["Enums"]["zone_role"] | null
        }
        Insert: {
          alpha?: number | null
          finish?: Database["public"]["Enums"]["finish"] | null
          hex: string
          id?: string
          kind: Database["public"]["Enums"]["swatch_kind"]
          line_id: string
          material: Database["public"]["Enums"]["material"]
          order_id: string
          ref: string
          sort_order?: number
          swatch_name: string
          texture_path?: string | null
          zone_name: string
          zone_role?: Database["public"]["Enums"]["zone_role"] | null
        }
        Update: {
          alpha?: number | null
          finish?: Database["public"]["Enums"]["finish"] | null
          hex?: string
          id?: string
          kind?: Database["public"]["Enums"]["swatch_kind"]
          line_id?: string
          material?: Database["public"]["Enums"]["material"]
          order_id?: string
          ref?: string
          sort_order?: number
          swatch_name?: string
          texture_path?: string | null
          zone_name?: string
          zone_role?: Database["public"]["Enums"]["zone_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          id: string
          image_path: string | null
          line_no: number
          model_id: string | null
          model_name: string
          order_id: string
          quantity: number
        }
        Insert: {
          id?: string
          image_path?: string | null
          line_no: number
          model_id?: string | null
          model_name: string
          order_id: string
          quantity: number
        }
        Update: {
          id?: string
          image_path?: string | null
          line_no?: number
          model_id?: string | null
          model_name?: string
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          bank_account: string | null
          business_name: string | null
          city: string | null
          commercial_address: string | null
          commercial_city: string | null
          commercial_postal_code: string | null
          commercial_province: string | null
          contact_email: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_postal_code: string | null
          delivery_province: string | null
          id: string
          idempotency_key: string
          image_path: string | null
          labeling: string | null
          legal_name: string | null
          model_id: string | null
          model_name: string
          notes: string | null
          number: number
          phone: string | null
          postal_code: string | null
          province: string | null
          quantity: number
          shop_ref: string | null
          tax_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          business_name?: string | null
          city?: string | null
          commercial_address?: string | null
          commercial_city?: string | null
          commercial_postal_code?: string | null
          commercial_province?: string | null
          contact_email?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          id?: string
          idempotency_key: string
          image_path?: string | null
          labeling?: string | null
          legal_name?: string | null
          model_id?: string | null
          model_name: string
          notes?: string | null
          number?: number
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          quantity?: number
          shop_ref?: string | null
          tax_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          business_name?: string | null
          city?: string | null
          commercial_address?: string | null
          commercial_city?: string | null
          commercial_postal_code?: string | null
          commercial_province?: string | null
          contact_email?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          id?: string
          idempotency_key?: string
          image_path?: string | null
          labeling?: string | null
          legal_name?: string | null
          model_id?: string | null
          model_name?: string
          notes?: string | null
          number?: number
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          quantity?: number
          shop_ref?: string | null
          tax_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          bank_account: string | null
          business_name: string | null
          city: string | null
          commercial_address: string | null
          commercial_city: string | null
          commercial_postal_code: string | null
          commercial_province: string | null
          contact_email: string | null
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_postal_code: string | null
          delivery_province: string | null
          email: string | null
          full_name: string | null
          id: string
          labeling: string | null
          legal_name: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          push_token: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          business_name?: string | null
          city?: string | null
          commercial_address?: string | null
          commercial_city?: string | null
          commercial_postal_code?: string | null
          commercial_province?: string | null
          contact_email?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          labeling?: string | null
          legal_name?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          push_token?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          business_name?: string | null
          city?: string | null
          commercial_address?: string | null
          commercial_city?: string | null
          commercial_postal_code?: string | null
          commercial_province?: string | null
          contact_email?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          labeling?: string | null
          legal_name?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          push_token?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      swatches: {
        Row: {
          active: boolean
          alpha: number | null
          created_at: string
          finishes: Database["public"]["Enums"]["finish"][]
          hex: string
          id: string
          kind: Database["public"]["Enums"]["swatch_kind"]
          material: Database["public"]["Enums"]["material"]
          name: string
          ref: string
          sort_order: number
          texture_path: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alpha?: number | null
          created_at?: string
          finishes?: Database["public"]["Enums"]["finish"][]
          hex: string
          id?: string
          kind: Database["public"]["Enums"]["swatch_kind"]
          material: Database["public"]["Enums"]["material"]
          name: string
          ref: string
          sort_order?: number
          texture_path?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alpha?: number | null
          created_at?: string
          finishes?: Database["public"]["Enums"]["finish"][]
          hex?: string
          id?: string
          kind?: Database["public"]["Enums"]["swatch_kind"]
          material?: Database["public"]["Enums"]["material"]
          name?: string
          ref?: string
          sort_order?: number
          texture_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_whatsapp_number: { Args: never; Returns: string }
      create_order: {
        Args: {
          p_key: string
          p_model_id: string
          p_notes?: string
          p_quantity?: number
          p_selection: Json
          p_shop_ref?: string
        }
        Returns: Json
      }
      create_order_lines: {
        Args: {
          p_key: string
          p_lines: Json
          p_notes?: string
          p_shop_ref?: string
        }
        Returns: Json
      }
      delete_customer_account: { Args: { p_user: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      model_publish_problems: {
        Args: { p_model_id: string }
        Returns: string[]
      }
      set_account_status: {
        Args: {
          p_status: Database["public"]["Enums"]["account_status"]
          p_user: string
        }
        Returns: Database["public"]["Enums"]["account_status"]
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected"
      finish: "gloss" | "matte"
      material: "metal" | "acetate"
      swatch_kind: "metal" | "solid" | "translucent" | "havana"
      user_role: "customer" | "admin"
      zone_role: "main" | "secondary" | "tips"
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
  public: {
    Enums: {
      account_status: ["pending", "approved", "rejected"],
      finish: ["gloss", "matte"],
      material: ["metal", "acetate"],
      swatch_kind: ["metal", "solid", "translucent", "havana"],
      user_role: ["customer", "admin"],
      zone_role: ["main", "secondary", "tips"],
    },
  },
} as const
