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
          transaction_date_normalized: string;
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
          transaction_date_normalized?: string;
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
          transaction_date_normalized?: string;
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
      aggregate_transactions: {
        Args: {
          p_user_id: string;
          p_start?: string | null;
          p_end?: string | null;
          p_category?: string | null;
          p_merchant?: string | null;
        };
        Returns: {
          total_amount: number;
          average_amount: number | null;
          tx_count: number;
        }[];
      };
      aggregate_transactions_trend: {
        Args: {
          p_user_id: string;
          p_bucket: string;
          p_start?: string | null;
          p_end?: string | null;
          p_category?: string | null;
          p_merchant?: string | null;
        };
        Returns: {
          bucket_start: string;
          bucket_end: string;
          total_amount: number;
          tx_count: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
