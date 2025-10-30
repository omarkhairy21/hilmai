export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: number;
          user_id: number;
          telegram_chat_id: number | null;
          telegram_username: string | null;
          first_name: string | null;
          last_name: string | null;
          amount: number;
          currency: string;
          merchant: string;
          category: string;
          description: string | null;
          transaction_date: string;
          merchant_embedding: number[] | null;
          description_embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          telegram_chat_id?: number | null;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          amount: number;
          currency?: string;
          merchant: string;
          category: string;
          description?: string | null;
          transaction_date: string;
          merchant_embedding?: number[] | null;
          description_embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          telegram_chat_id?: number | null;
          telegram_username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          amount?: number;
          currency?: string;
          merchant?: string;
          category?: string;
          description?: string | null;
          transaction_date?: string;
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
        Relationships: [];
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
