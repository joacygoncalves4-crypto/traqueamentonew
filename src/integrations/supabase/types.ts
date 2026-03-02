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
      campanhas: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          grupo_id: string
          id: string
          instancia_id: string | null
          link_grupo: string
          nome: string
          pixel_id: string | null
          telegram_bot_id: string | null
          telegram_chat_id: string | null
          updated_at: string | null
          whatsapp_group_jid: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          grupo_id: string
          id?: string
          instancia_id?: string | null
          link_grupo: string
          nome: string
          pixel_id?: string | null
          telegram_bot_id?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          whatsapp_group_jid?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          grupo_id?: string
          id?: string
          instancia_id?: string | null
          link_grupo?: string
          nome?: string
          pixel_id?: string | null
          telegram_bot_id?: string | null
          telegram_chat_id?: string | null
          updated_at?: string | null
          whatsapp_group_jid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "evolution_instancias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_telegram_bot_id_fkey"
            columns: ["telegram_bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          pixel_id: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          pixel_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          pixel_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          campanha_id: string | null
          created_at: string | null
          evento_enviado: boolean | null
          fonte: string | null
          gatilho_id: string | null
          id: string
          pixel_id: string | null
          pixel_response: string | null
          telefone_hash: string
          telefone_masked: string
        }
        Insert: {
          campanha_id?: string | null
          created_at?: string | null
          evento_enviado?: boolean | null
          fonte?: string | null
          gatilho_id?: string | null
          id?: string
          pixel_id?: string | null
          pixel_response?: string | null
          telefone_hash: string
          telefone_masked: string
        }
        Update: {
          campanha_id?: string | null
          created_at?: string | null
          evento_enviado?: boolean | null
          fonte?: string | null
          gatilho_id?: string | null
          id?: string
          pixel_id?: string | null
          pixel_response?: string | null
          telefone_hash?: string
          telefone_masked?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_gatilho_id_fkey"
            columns: ["gatilho_id"]
            isOneToOne: false
            referencedRelation: "mensagem_gatilhos"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_grupos: {
        Row: {
          created_at: string | null
          group_jid: string
          group_name: string
          group_size: number | null
          id: string
          instancia_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_jid: string
          group_name: string
          group_size?: number | null
          id?: string
          instancia_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_jid?: string
          group_name?: string
          group_size?: number | null
          id?: string
          instancia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_grupos_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "evolution_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_instancias: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          nome: string
          numero_whatsapp: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          nome: string
          numero_whatsapp?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          nome?: string
          numero_whatsapp?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mensagem_gatilhos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          instance_name: string
          keyword: string
          nome: string
          pixel_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          instance_name: string
          keyword: string
          nome: string
          pixel_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          instance_name?: string
          keyword?: string
          nome?: string
          pixel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_gatilhos_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      pixels: {
        Row: {
          access_token: string
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          pixel_id: string
          test_event_code: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          pixel_id: string
          test_event_code?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          pixel_id?: string
          test_event_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_bots: {
        Row: {
          bot_token: string
          bot_username: string | null
          created_at: string | null
          id: string
          nome: string
          status: string | null
        }
        Insert: {
          bot_token: string
          bot_username?: string | null
          created_at?: string | null
          id?: string
          nome: string
          status?: string | null
        }
        Update: {
          bot_token?: string
          bot_username?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          status?: string | null
        }
        Relationships: []
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
    Enums: {},
  },
} as const
