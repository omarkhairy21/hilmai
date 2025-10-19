import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Get the transactions index
export const getTransactionsIndex = () => {
  const indexName = process.env.PINECONE_INDEX || 'hilm-transactions';
  return pinecone.index(indexName);
};

export default pinecone;
