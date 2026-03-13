export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          billing_status: Database["public"]["Enums"]["billing_status"] | null
          client_name: string
          company_name: string | null
          contract_end_date: string | null
          created_at: string | null
          email: string
          id: string
          monthly_payment: number | null
          phone: string | null
          plan: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"] | null
          updated_at: string | null
        }
        Insert: {
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          client_name: string
          company_name?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          email: string
          id?: string
          monthly_payment?: number | null
          phone?: string | null
          plan?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string | null
        }
        Update: {
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          client_name?: string
          company_name?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          email?: string
          id?: string
          monthly_payment?: number | null
          phone?: string | null
          plan?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          direction: string | null
          entity_id: string
          entity_type: string
          id: string
          subject: string | null
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          entity_id: string
          entity_type: string
          id?: string
          subject?: string | null
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string | null
          due_date: string | null
          id: string
          invoice_number: string
          paid_date: string | null
          status: Database["public"]["Enums"]["billing_status"] | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["billing_status"] | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["billing_status"] | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_items: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          locked_until: string | null
          login_attempts: number | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          locked_until?: string | null
          login_attempts?: number | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          locked_until?: string | null
          login_attempts?: number | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_team_member: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      delete_team_member: {
        Args: {
          p_reassign_to?: string | null
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      billing_status: "due" | "paid" | "overdue"
      client_status: "active" | "paused" | "completed"
      lead_status:
        | "new_lead"
        | "audit_booked"
        | "audit_done"
        | "in_progress"
        | "lead_won"
        | "lead_lost"
      task_priority: "urgent" | "high" | "medium" | "low"
      task_status: "pending" | "in_progress" | "completed" | "overdue"
      user_role: "owner" | "admin" | "team" | "task_manager"
      user_status: "active" | "inactive"
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
      billing_status: ["due", "paid", "overdue"],
      client_status: ["active", "paused", "completed"],
      lead_status: [
        "new_lead",
        "audit_booked",
        "audit_done",
        "in_progress",
        "lead_won",
        "lead_lost",
      ],
      task_priority: ["urgent", "high", "medium", "low"],
      task_status: ["pending", "in_progress", "completed", "overdue"],
      user_role: ["owner", "admin", "team"],
      user_status: ["active", "inactive"],
    },
  },
} as const
