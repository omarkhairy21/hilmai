export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          telegram_chat_id: number;
          amount: number;
          currency: string;
          merchant: string;
          category: string;
          description: string | null;
          transaction_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          telegram_chat_id: number;
          amount: number;
          currency?: string;
          merchant: string;
          category: string;
          description?: string | null;
          transaction_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          telegram_chat_id?: number;
          amount?: number;
          currency?: string;
          merchant?: string;
          category?: string;
          description?: string | null;
          transaction_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          telegram_chat_id: number;
          telegram_username: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          telegram_chat_id: number;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          telegram_chat_id?: number;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
