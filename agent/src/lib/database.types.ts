export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: number;
          user_id: number;
          amount: number;
          currency: string;
          merchant: string;
          category: string;
          description: string | null;
          transaction_date: string;
          original_amount: number | null;
          original_currency: string | null;
          converted_amount: number | null;
          conversion_rate: number | null;
          converted_at: string | null;
          merchant_embedding: number[] | null;
          description_embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          amount: number;
          currency?: string;
          merchant: string;
          category: string;
          description?: string | null;
          transaction_date: string;
          original_amount?: number | null;
          original_currency?: string | null;
          converted_amount?: number | null;
          conversion_rate?: number | null;
          converted_at?: string | null;
          merchant_embedding?: number[] | null;
          description_embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          amount?: number;
          currency?: string;
          merchant?: string;
          category?: string;
          description?: string | null;
          transaction_date?: string;
          original_amount?: number | null;
          original_currency?: string | null;
          converted_amount?: number | null;
          conversion_rate?: number | null;
          converted_at?: string | null;
          merchant_embedding?: number[] | null;
          description_embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      merchant_embeddings_cache: {
        Row: {
          id: number;
          merchant_name: string;
          embedding: number[];
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          merchant_name: string;
          embedding: number[];
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          merchant_name?: string;
          embedding?: number[];
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: number;
          telegram_chat_id: number | null;
          telegram_username: string | null;
          first_name: string | null;
          last_name: string | null;
          default_currency: string;
          current_mode: 'logger' | 'chat' | 'query';
          timezone: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          telegram_chat_id?: number | null;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          default_currency?: string;
          current_mode?: 'logger' | 'chat' | 'query';
          timezone?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          telegram_chat_id?: number | null;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          default_currency?: string;
          current_mode?: 'logger' | 'chat' | 'query';
          timezone?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_merchant_cache_usage: {
        Args: {
          p_merchant_name: string;
        };
        Returns: undefined;
      };
      search_transactions_hybrid: {
        Args: {
          p_query_embedding: number[];
          p_user_id: number;
          p_similarity_threshold?: number;
          p_category?: string | null;
          p_date_from?: string | null;
          p_date_to?: string | null;
          p_min_amount?: number | null;
          p_max_amount?: number | null;
          p_limit?: number;
        };
        Returns: {
          id: number;
          amount: number;
          currency: string;
          merchant: string;
          category: string;
          description: string | null;
          transaction_date: string;
          original_amount: number | null;
          original_currency: string | null;
          converted_amount: number | null;
          conversion_rate: number | null;
          converted_at: string | null;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
