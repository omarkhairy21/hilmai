import { supabase } from './supabase';
import { getTransactionsIndex } from './pinecone';
import {
  generateEmbeddingWithRetry,
  formatTransactionForEmbedding,
} from '../mastra/rag/embeddings';

// Type-safe wrapper for Supabase operations
const db = supabase.schema('public');

export interface SaveTransactionParams {
  amount: number;
  currency?: string;
  merchant?: string;
  category?: string;
  description?: string;
  transactionDate?: string;
  telegramChatId: number;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
}

export interface SaveTransactionResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

/**
 * Save a transaction to the database with default values applied.
 * This is the core business logic extracted from the tool.
 */
export async function saveTransaction(
  params: SaveTransactionParams
): Promise<SaveTransactionResult> {
  // Apply defaults
  const amount = params.amount;
  const currency = params.currency || 'USD';
  const merchant = params.merchant || 'Unknown';
  const category = params.category || 'other';
  const description = params.description || null;
  const telegramChatId = params.telegramChatId;
  const telegramUsername = params.telegramUsername || null;
  const firstName = params.firstName || null;
  const lastName = params.lastName || null;

  try {
    // First, ensure user exists
    const { data: userData, error: userError } = await db
      .from('users')
      .select('id')
      .eq('telegram_chat_id', telegramChatId)
      .single();

    let userId: string;

    if (userError || !userData) {
      // Create user if doesn't exist
      const { data: newUser, error: createUserError } = await db
        .from('users')
        .insert({
          telegram_chat_id: telegramChatId,
          telegram_username: telegramUsername,
          first_name: firstName,
          last_name: lastName,
        })
        .select('id')
        .single();

      if (createUserError || !newUser) {
        throw new Error(`Failed to create user: ${createUserError?.message}`);
      }

      userId = newUser.id;
    } else {
      userId = userData.id;

      // Update user info if provided
      if (telegramUsername || firstName || lastName) {
        const updateData: any = {};
        if (telegramUsername) updateData.telegram_username = telegramUsername;
        if (firstName) updateData.first_name = firstName;
        if (lastName) updateData.last_name = lastName;

        await db.from('users').update(updateData).eq('id', userId);
      }
    }

    // Parse and validate transaction date
    const parsedDate = params.transactionDate ? new Date(params.transactionDate) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      parsedDate.setTime(Date.now());
    }
    const finalTransactionDate = parsedDate.toISOString();
    const normalizedTransactionDate = parsedDate.toISOString().split('T')[0];

    // Generate embedding for the transaction
    const categoryLower = category.toLowerCase();
    const merchantLower = merchant.toLowerCase();
    const embeddingText = formatTransactionForEmbedding({
      amount,
      currency,
      merchant,
      category,
      date: finalTransactionDate,
      description: description || undefined,
    });

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbeddingWithRetry(embeddingText);
    } catch (embeddingError) {
      console.error('Failed to generate embedding:', embeddingError);
      // Continue without embedding - we'll still save the transaction
    }

    // Insert transaction
    const { data, error } = await db
      .from('transactions')
      .insert({
        user_id: userId,
        telegram_chat_id: telegramChatId,
        amount,
        currency,
        merchant,
        category,
        description,
        transaction_date: finalTransactionDate,
        transaction_date_normalized: normalizedTransactionDate,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save transaction: ${error.message}`);
    }

    // Store embedding in Pinecone
    if (embedding && data.id) {
      try {
        const index = getTransactionsIndex();
        await index.upsert([
          {
            id: data.id,
            values: embedding,
            metadata: {
              userId,
              telegram_chat_id: telegramChatId,
              amount,
              currency,
              merchant,
              category,
              date: finalTransactionDate,
              merchantLower,
              categoryLower,
              normalizedDate: normalizedTransactionDate,
              description: description || '',
            },
          },
        ]);
        console.log(`✅ Embedding stored in Pinecone for transaction ${data.id}`);
      } catch (pineconeError) {
        console.error('⚠️ Failed to store in Pinecone:', pineconeError);
        // Transaction still saved in Supabase even if Pinecone fails
      }
    }

    return {
      success: true,
      transactionId: data.id,
      message: `Transaction saved successfully! ID: ${data.id}`,
    };
  } catch (error) {
    console.error('Error saving transaction:', error);
    return {
      success: false,
      message: `Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
