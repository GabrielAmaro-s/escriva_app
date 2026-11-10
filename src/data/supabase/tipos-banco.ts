// Gerado por npm run db:tipos. Não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "board_columns": {
                  Row: {
                    "id": string,"kind": Database["public"]['Enums']["column_kind"],"position": number,"project_id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind": Database["public"]['Enums']["column_kind"],"position"?: number,"project_id": string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "id"?: string,"kind"?: Database["public"]['Enums']["column_kind"],"position"?: number,"project_id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_columns_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_details": {
                  Row: {
                    "channels": (string)[],"deliverables": NonNullable<Json>,"ends_on": string | null,"objective": string | null,"project_id": string,"starts_on": string | null,"tipo_servico": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channels"?: (string)[],"deliverables"?: NonNullable<Json>,"ends_on"?: string | null,"objective"?: string | null,"project_id": string,"starts_on"?: string | null,"tipo_servico"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "channels"?: (string)[],"deliverables"?: NonNullable<Json>,"ends_on"?: string | null,"objective"?: string | null,"project_id"?: string,"starts_on"?: string | null,"tipo_servico"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_details_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"documento": string | null,"email": string | null,"id": string,"nome": string,"observacoes": string | null,"telefone": string | null,"tipo": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"documento"?: string | null,"email"?: string | null,"id"?: string,"nome": string,"observacoes"?: string | null,"telefone"?: string | null,"tipo"?: string,"user_id"?: string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"documento"?: string | null,"email"?: string | null,"id"?: string,"nome"?: string,"observacoes"?: string | null,"telefone"?: string | null,"tipo"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feriados": {
                  Row: {
                    "ate": string | null,"criado_em": string,"data": string,"descricao": string,"fonte": string | null,"id": string,"tipo": string,"tribunal": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ate"?: string | null,"criado_em"?: string,"data": string,"descricao": string,"fonte"?: string | null,"id"?: string,"tipo"?: string,"tribunal"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "ate"?: string | null,"criado_em"?: string,"data"?: string,"descricao"?: string,"fonte"?: string | null,"id"?: string,"tipo"?: string,"tribunal"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"heartbeats_agente": {
                  Row: {
                    "ultimo_em": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ultimo_em"?: string,"user_id"?: string
                  }
                  Update: {
                    "ultimo_em"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"labels": {
                  Row: {
                    "color": string,"id": string,"name": string,"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"id"?: string,"name": string,"project_id": string,"user_id"?: string
                  }
                  Update: {
                    "color"?: string,"id"?: string,"name"?: string,"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labels_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"lembretes": {
                  Row: {
                    "agendado_em": string | null,"automatico": string | null,"criado_em": string,"enviado_em": string | null,"id": string,"origem": string,"projeto_id": string | null,"quando": string,"status": string,"tarefa_id": string | null,"texto": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agendado_em"?: string | null,"automatico"?: string | null,"criado_em"?: string,"enviado_em"?: string | null,"id"?: string,"origem"?: string,"projeto_id"?: string | null,"quando": string,"status"?: string,"tarefa_id"?: string | null,"texto": string,"user_id"?: string
                  }
                  Update: {
                    "agendado_em"?: string | null,"automatico"?: string | null,"criado_em"?: string,"enviado_em"?: string | null,"id"?: string,"origem"?: string,"projeto_id"?: string | null,"quando"?: string,"status"?: string,"tarefa_id"?: string | null,"texto"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lembretes_projeto_id_fkey"
      columns: ["projeto_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lembretes_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"preferencias": {
                  Row: {
                    "atualizado_em": string,"margem_prazo_interno": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"margem_prazo_interno"?: number,"user_id"?: string
                  }
                  Update: {
                    "atualizado_em"?: string,"margem_prazo_interno"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"processo_detalhes": {
                  Row: {
                    "area": string | null,"fase": string | null,"link_autos": string | null,"numero_cnj": string | null,"orgao": string | null,"parte_contraria": string | null,"polo": string | null,"project_id": string,"segredo_justica": boolean,"tribunal": string | null,"user_id": string,"valor_causa": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"fase"?: string | null,"link_autos"?: string | null,"numero_cnj"?: string | null,"orgao"?: string | null,"parte_contraria"?: string | null,"polo"?: string | null,"project_id": string,"segredo_justica"?: boolean,"tribunal"?: string | null,"user_id"?: string,"valor_causa"?: number | null
                  }
                  Update: {
                    "area"?: string | null,"fase"?: string | null,"link_autos"?: string | null,"numero_cnj"?: string | null,"orgao"?: string | null,"parte_contraria"?: string | null,"polo"?: string | null,"project_id"?: string,"segredo_justica"?: boolean,"tribunal"?: string | null,"user_id"?: string,"valor_causa"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "processo_detalhes_projeto_fk"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "archived_at": string | null,"cliente_id": string | null,"color": string,"created_at": string,"description": string | null,"due_on": string | null,"icon": string,"id": string,"kind": Database["public"]['Enums']["project_kind"],"name": string,"position": number,"status": Database["public"]['Enums']["project_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"cliente_id"?: string | null,"color"?: string,"created_at"?: string,"description"?: string | null,"due_on"?: string | null,"icon"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["project_kind"],"name": string,"position"?: number,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"cliente_id"?: string | null,"color"?: string,"created_at"?: string,"description"?: string | null,"due_on"?: string | null,"icon"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["project_kind"],"name"?: string,"position"?: number,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_cliente_fk"
      columns: ["cliente_id","user_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"registro_agente": {
                  Row: {
                    "criado_em": string,"desfazer": Json | null,"desfeito_em": string | null,"entrada": NonNullable<Json>,"ferramenta": string,"id": string,"resultado": Json | null,"sucesso": boolean,"token_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"desfazer"?: Json | null,"desfeito_em"?: string | null,"entrada"?: NonNullable<Json>,"ferramenta": string,"id"?: string,"resultado"?: Json | null,"sucesso"?: boolean,"token_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "criado_em"?: string,"desfazer"?: Json | null,"desfeito_em"?: string | null,"entrada"?: NonNullable<Json>,"ferramenta"?: string,"id"?: string,"resultado"?: Json | null,"sucesso"?: boolean,"token_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registro_agente_token_id_fkey"
      columns: ["token_id"]
isOneToOne: false
      referencedRelation: "tokens_agente"
      referencedColumns: ["id"]
    }
                  ]
                },"registro_alteracoes": {
                  Row: {
                    "antes": string | null,"campo": string,"criado_em": string,"depois": string | null,"entidade": string,"entidade_id": string,"id": string,"origem": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "antes"?: string | null,"campo": string,"criado_em"?: string,"depois"?: string | null,"entidade": string,"entidade_id": string,"id"?: string,"origem"?: string,"user_id"?: string
                  }
                  Update: {
                    "antes"?: string | null,"campo"?: string,"criado_em"?: string,"depois"?: string | null,"entidade"?: string,"entidade_id"?: string,"id"?: string,"origem"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "checklist": NonNullable<Json>,"column_id": string,"completed": boolean,"completed_at": string | null,"contagem": Json | null,"created_at": string,"description": string | null,"due_on": string | null,"horario_audiencia": string | null,"id": string,"label_ids": (string)[],"links": NonNullable<Json>,"local_audiencia": string | null,"position": number,"prazo_fatal": string | null,"priority": Database["public"]['Enums']["task_priority"],"project_id": string,"tipo": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checklist"?: NonNullable<Json>,"column_id": string,"completed"?: boolean,"completed_at"?: string | null,"contagem"?: Json | null,"created_at"?: string,"description"?: string | null,"due_on"?: string | null,"horario_audiencia"?: string | null,"id"?: string,"label_ids"?: (string)[],"links"?: NonNullable<Json>,"local_audiencia"?: string | null,"position"?: number,"prazo_fatal"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id": string,"tipo"?: string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "checklist"?: NonNullable<Json>,"column_id"?: string,"completed"?: boolean,"completed_at"?: string | null,"contagem"?: Json | null,"created_at"?: string,"description"?: string | null,"due_on"?: string | null,"horario_audiencia"?: string | null,"id"?: string,"label_ids"?: (string)[],"links"?: NonNullable<Json>,"local_audiencia"?: string | null,"position"?: number,"prazo_fatal"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id"?: string,"tipo"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_column_id_fkey"
      columns: ["column_id"]
isOneToOne: false
      referencedRelation: "board_columns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"tokens_agente": {
                  Row: {
                    "criado_em": string,"escopo": string,"expira_em": string,"hash": string,"id": string,"nome": string,"revogado_em": string | null,"ultimo_uso_em": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"escopo"?: string,"expira_em": string,"hash": string,"id"?: string,"nome": string,"revogado_em"?: string | null,"ultimo_uso_em"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "criado_em"?: string,"escopo"?: string,"expira_em"?: string,"hash"?: string,"id"?: string,"nome"?: string,"revogado_em"?: string | null,"ultimo_uso_em"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "project_task_counts": {
                  Row: {
                    "done_count": number | null,"project_id": string,"task_count": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "column_kind": "todo"|"doing"|"waiting"|"done","project_kind": "project"|"campaign","project_status": "active"|"paused"|"done","task_priority": "low"|"medium"|"high"|"urgent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "column_kind": ["todo", "doing", "waiting", "done"],"project_kind": ["project", "campaign"],"project_status": ["active", "paused", "done"],"task_priority": ["low", "medium", "high", "urgent"]
          }
        }
} as const
