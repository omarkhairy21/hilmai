# Security Recommendations for HilmAI Agent

## Executive Summary

**Current Security Status**: ⚠️ **Moderate** - Functional but relies heavily on application-level validation

**Risk Level**: **Medium** - Service role bypasses RLS, so security depends on correct code implementation

**Key Concern**: All database access uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses Row Level Security (RLS) policies. Security relies entirely on application-level `user_id` validation.

---

## Current Security Posture

### ✅ Strengths

1. **RLS Enabled**: All 6 application tables have RLS policies enabled
2. **Application-Level Validation**: Critical paths validate user ownership:
   - `delete-transaction-tool.ts`: Validates ownership before delete
   - `edit-transaction-tool.ts`: Validates ownership before update
   - `embeddings.ts`: Queries filtered by `user_id`
   - Most queries include `.eq('user_id', userId)`
3. **Defense-in-Depth**: RLS policies exist even if service_role bypasses them
4. **Service Role Key Protection**: Server-side only (not exposed to frontend)

### ⚠️ Security Gaps & Concerns

1. **RLS Policies Don't Protect When Using Service Role**
   - Backend uses `SUPABASE_SERVICE_ROLE_KEY` which **bypasses all RLS policies**
   - Security depends entirely on application-level validation
   - If a single bug omits `user_id` validation, data could leak

2. **Missing `user_id` Validation in Some Queries**
   - Need to audit all database queries for consistent `user_id` checks
   - Some user service operations may not validate ownership

3. **RPC Function Security**
   - `search_transactions_hybrid()` takes `p_user_id` as parameter - caller must pass correct `user_id`
   - `activate_subscription_from_code()` needs authorization review

4. **Missing INSERT Policy Validation**
   - `transactions` INSERT policy checks `user_id = get_current_user_id()`, but with service_role this doesn't apply
   - Application must ensure `user_id` is set correctly on insert

5. **Merchant Cache Publicly Readable**
   - Policy allows `USING (true)` - intentional but worth noting

---

## Recommendations

### 🔴 High Priority

#### 1. Audit All Database Queries

**Action**: Review every database query to ensure `user_id` validation

**Files to Review**:
- `agent/src/services/subscription.service.ts` - All user lookups
- `agent/src/services/user.service.ts` - All user operations
- `agent/src/lib/embeddings.ts` - Transaction queries
- `agent/src/mastra/tools/*.ts` - All tool database operations
- `agent/src/handlers/**/*.ts` - All handler database operations

**Checklist**:
- [ ] Every `transactions` query includes `.eq('user_id', userId)`
- [ ] Every `users` query includes `.eq('id', userId)` (unless admin operation)
- [ ] Every `subscription_usage` query includes `.eq('user_id', userId)`
- [ ] All UPDATE operations validate ownership before executing
- [ ] All DELETE operations validate ownership before executing

**Example Pattern**:
```typescript
// ✅ GOOD: Validates ownership first
const { data: existing } = await supabaseService
  .from('transactions')
  .select('user_id')
  .eq('id', transactionId)
  .single();

if (existing?.user_id !== userId) {
  throw new Error('Unauthorized');
}

// Then proceed with operation
await supabaseService
  .from('transactions')
  .update({ ... })
  .eq('id', transactionId)
  .eq('user_id', userId); // Extra safety check
```

#### 2. Add Database-Level Security Constraints

**Action**: Create database functions with `SECURITY DEFINER` that enforce `user_id` validation

**Benefits**:
- Reduces risk of missing validation in application code
- Provides defense even with service_role
- Centralizes security logic

**Example Implementation**:
```sql
-- Secure wrapper function for updating transactions
CREATE OR REPLACE FUNCTION update_transaction_secure(
  p_transaction_id UUID,
  p_user_id BIGINT,
  p_updates JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_owner_id BIGINT;
BEGIN
  -- Verify ownership
  SELECT user_id INTO v_owner_id
  FROM transactions
  WHERE id = p_transaction_id;
  
  IF v_owner_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaction not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_owner_id != p_user_id THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Transaction does not belong to user'::TEXT;
    RETURN;
  END IF;
  
  -- Perform update
  UPDATE transactions
  SET 
    amount = COALESCE((p_updates->>'amount')::DECIMAL, amount),
    merchant = COALESCE(p_updates->>'merchant', merchant),
    category = COALESCE(p_updates->>'category', category),
    description = COALESCE(p_updates->>'description', description),
    transaction_date = COALESCE((p_updates->>'transaction_date')::DATE, transaction_date),
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 3. Add Automated Security Tests

**Action**: Create test suite that verifies data isolation

**Test Cases**:
```typescript
describe('Security: Data Isolation', () => {
  it('should prevent User A from accessing User B transactions', async () => {
    // Create transaction for User A
    const transactionA = await createTransaction(userAId, {...});
    
    // Try to access as User B
    const result = await getTransaction(userBId, transactionA.id);
    
    expect(result).toBeNull();
  });
  
  it('should prevent User A from updating User B transactions', async () => {
    const transactionB = await createTransaction(userBId, {...});
    
    const result = await updateTransaction(userAId, transactionB.id, {...});
    
    expect(result.error).toContain('Unauthorized');
  });
  
  it('should prevent User A from deleting User B transactions', async () => {
    const transactionB = await createTransaction(userBId, {...});
    
    const result = await deleteTransaction(userAId, transactionB.id);
    
    expect(result.error).toContain('Unauthorized');
  });
});
```

### 🟡 Medium Priority

#### 4. Add Database Query Logging & Monitoring

**Action**: Log all database operations with `user_id` for audit trail

**Implementation**:
```typescript
// Wrapper function for secure logging
async function secureQuery<T>(
  userId: number,
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    
    // Log successful operation
    logger.info('db_operation', {
      userId,
      operation,
      duration: Date.now() - startTime,
      success: true,
    });
    
    return result;
  } catch (error) {
    // Log failed operation
    logger.error('db_operation', {
      userId,
      operation,
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
    });
    
    throw error;
  }
}
```

**Monitoring Alerts**:
- Alert on queries without `user_id` filter
- Alert on cross-user access attempts
- Alert on suspicious patterns (e.g., many failed authorization checks)

#### 5. Create Security Checklist for Code Reviews

**Action**: Document security requirements for all database operations

**Checklist Template**:
```markdown
## Database Operation Security Checklist

- [ ] Query includes `user_id` filter (`.eq('user_id', userId)`)
- [ ] UPDATE operations validate ownership before executing
- [ ] DELETE operations validate ownership before executing
- [ ] INSERT operations set `user_id` from authenticated context
- [ ] RPC functions validate `user_id` parameter matches authenticated user
- [ ] Error messages don't leak sensitive information
- [ ] Logging includes `user_id` for audit trail
```

#### 6. Review RPC Function Security

**Action**: Audit all RPC functions for proper authorization

**Functions to Review**:
- `search_transactions_hybrid()` - ✅ Already filters by `p_user_id`
- `activate_subscription_from_code()` - ⚠️ Needs review
- `get_transaction_id_by_display_id()` - ✅ Already filters by `p_user_id`
- `increment_usage_tokens()` - ⚠️ Needs review

**Recommendation**: Add authorization checks in RPC functions themselves:
```sql
CREATE OR REPLACE FUNCTION increment_usage_tokens_secure(
  p_user_id BIGINT,
  p_period_start TIMESTAMPTZ,
  p_tokens BIGINT,
  p_authenticated_user_id BIGINT  -- Add this parameter
)
RETURNS void AS $$
BEGIN
  -- Verify authorization
  IF p_user_id != p_authenticated_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update usage for another user';
  END IF;
  
  -- Proceed with update
  UPDATE subscription_usage
  SET total_tokens = total_tokens + p_tokens,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND billing_period_start = p_period_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 🟢 Low Priority

#### 7. Consider Using Anon Key for Client Operations

**Action**: If implementing client-side API, use `SUPABASE_ANON_KEY` with JWT tokens

**Benefits**:
- RLS policies would actually enforce security
- Reduces reliance on application-level validation
- Better security model for future web dashboard

**Note**: Currently not applicable since this is a Telegram bot backend, but consider for future web dashboard implementation.

#### 8. Document Security Architecture

**Action**: Create comprehensive security documentation

**Sections**:
- Authentication flow
- Authorization model
- Data isolation strategy
- Security boundaries
- Threat model
- Incident response plan

---

## Implementation Priority

1. **Week 1**: Audit all database queries (High Priority #1)
2. **Week 2**: Add automated security tests (High Priority #3)
3. **Week 3**: Create secure wrapper functions (High Priority #2)
4. **Week 4**: Add logging & monitoring (Medium Priority #4)
5. **Ongoing**: Code review checklist (Medium Priority #5)

---

## Testing Checklist

Before deploying security improvements:

- [ ] All existing tests pass
- [ ] New security tests pass
- [ ] Manual test: User A cannot access User B's data
- [ ] Manual test: User A cannot modify User B's data
- [ ] Manual test: User A cannot delete User B's data
- [ ] Logging captures all database operations
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## Notes

- **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- **RLS Policies**: Currently don't protect when using service_role, but provide defense-in-depth
- **Future**: Consider implementing JWT-based authentication for web dashboard to leverage RLS policies
- **Mastra Tables**: Intentionally have no RLS (framework system tables)

---

**Last Updated**: 2024-12-19
**Review Frequency**: Quarterly
**Owner**: Development Team

