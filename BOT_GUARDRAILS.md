# Discord Bot Engineering Guidelines

> **Guidelines for reliable, maintainable Discord bot code.**
> These patterns ensure security, reliability, and consistency.

---

## 🎯 Core Principles

1. **Fail Safe**: Always handle errors gracefully
2. **Explicit Over Implicit**: Be clear about what code does
3. **Type Safety**: Use TypeScript properly, avoid `any`
4. **Input Validation**: Validate all user input
5. **Error Logging**: Log errors with context
6. **Timeouts**: All external API calls must have timeouts

---

## 🔒 Command Structure Pattern

Every Discord command MUST follow this pattern:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { z } from 'zod';

// 1. Define validation schema (if needed)
const commandSchema = z.object({
  name: z.string().min(1).max(50),
  tag: z.string().min(1).max(10),
});

export const data = new SlashCommandBuilder()
  .setName('command')
  .setDescription('Description');

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: Services
) {
  // 2. Defer reply for long operations
  await interaction.deferReply({ ephemeral: true });

  try {
    // 3. Validate input (if needed)
    const name = interaction.options.getString('name', true);
    const tag = interaction.options.getString('tag', true);
    
    const validation = commandSchema.safeParse({ name, tag });
    if (!validation.success) {
      await interaction.editReply('❌ Invalid input. Please check your values.');
      return;
    }

    // 4. Business logic
    const result = await services.someService.doSomething(validation.data);

    // 5. Success response
    await interaction.editReply(`✅ Success: ${result}`);
  } catch (error) {
    // 6. Error handling (ALWAYS)
    console.error(`Error in ${data.name} command:`, error);
    
    await interaction.editReply({
      content: '❌ An error occurred. Please try again later.',
      ephemeral: true,
    });
  }
}
```

---

## 🛡️ Error Handling Requirements

### Always Use Try-Catch

```typescript
// ✅ CORRECT
export async function execute(interaction, services) {
  await interaction.deferReply();
  
  try {
    // Your code
    const result = await riskyOperation();
    await interaction.editReply(`Success: ${result}`);
  } catch (error) {
    console.error('Command error:', error);
    await interaction.editReply('❌ Operation failed.');
  }
}

// ❌ WRONG - No error handling
export async function execute(interaction, services) {
  const result = await riskyOperation(); // Could throw
  await interaction.reply(`Success: ${result}`);
}
```

### Log Errors with Context

```typescript
// ✅ CORRECT
try {
  await operation();
} catch (error) {
  console.error('Operation failed', {
    userId: interaction.user.id,
    command: interaction.commandName,
    error: error instanceof Error ? error.message : String(error),
  });
  // Handle error
}

// ❌ WRONG - No context
catch (error) {
  console.error(error); // Not enough info
}
```

---

## 🔐 Input Validation

### Validate All User Input

```typescript
import { z } from 'zod';

// ✅ CORRECT - Validate with Zod
const verifySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9]+$/),
  tag: z.string().min(1).max(10).regex(/^[0-9]+$/),
  region: z.enum(['na', 'eu', 'ap', 'kr', 'latam', 'br']),
});

const name = interaction.options.getString('name', true);
const tag = interaction.options.getString('tag', true);
const region = interaction.options.getString('region') || 'na';

const validation = verifySchema.safeParse({ name, tag, region });
if (!validation.success) {
  await interaction.editReply('❌ Invalid input format.');
  return;
}

// ❌ WRONG - No validation
const name = interaction.options.getString('name'); // Could be anything
```

### Common Validation Patterns

```typescript
// Discord User ID
z.string().regex(/^\d{17,19}$/)

// Riot Username
z.string().min(1).max(50).regex(/^[a-zA-Z0-9]+$/)

// Riot Tag
z.string().min(1).max(10).regex(/^[0-9]+$/)

// Region
z.enum(['na', 'eu', 'ap', 'kr', 'latam', 'br'])

// Match Score
z.number().int().min(0).max(26)

// Team (A or B)
z.enum(['A', 'B'])
```

---

## 🔌 External API Calls

### Always Use Timeouts

```typescript
// ✅ CORRECT - With timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

try {
  const response = await fetch(url, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // Process response
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timeout');
  }
  throw error;
}

// ✅ CORRECT - Using axios (already has timeout)
// ValorantAPIService already implements this
const response = await axios.get(url, { timeout: 10000 });
```

### Retry Logic (When Appropriate)

```typescript
// ✅ CORRECT - Retry GET requests (idempotent)
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

// ❌ WRONG - Retry non-idempotent operations
// Never retry POST requests that create resources
// Never retry match reporting
```

---

## 💾 Database Operations

### Always Handle Errors

```typescript
// ✅ CORRECT
const player = await databaseService.getPlayer(userId);
if (!player) {
  await interaction.editReply('❌ Player not found.');
  return;
}

const { data, error } = await supabase
  .from('players')
  .select('id, discord_rank')
  .eq('discord_user_id', userId)
  .single();

if (error) {
  console.error('Database error:', error);
  await interaction.editReply('❌ Database error occurred.');
  return;
}

if (!data) {
  await interaction.editReply('❌ Player not found.');
  return;
}

// ❌ WRONG - No error handling
const { data } = await supabase.from('players').select('*').eq('id', userId).single();
// What if error? What if no data?
```

### Never Use `select("*")` (if exposing to users)

```typescript
// ✅ CORRECT - Explicit columns
const { data } = await supabase
  .from('players')
  .select('id, discord_user_id, discord_rank, current_mmr')
  .eq('discord_user_id', userId);

// ⚠️ OK for internal use, but prefer explicit
// select("*") is fine for internal operations if you control the data flow
```

---

## 🔑 Secrets Management

### Use Environment Variables

```typescript
// ✅ CORRECT
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is required!');
  process.exit(1);
}

// ❌ WRONG
const token = 'your-token-here'; // Hardcoded secret
```

### Never Log Secrets

```typescript
// ✅ CORRECT
console.log('Bot initialized with token:', token ? '***' : 'missing');

// ❌ WRONG
console.log('Bot token:', token); // Exposes secret
```

---

## 📝 Type Safety

### Avoid `any` Type

```typescript
// ✅ CORRECT
interface CommandServices {
  databaseService: DatabaseService;
  playerService: PlayerService;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: CommandServices
) {
  // TypeScript knows services.databaseService exists
}

// ❌ WRONG
export async function execute(interaction: any, services: any) {
  // No type safety
}

// ✅ CORRECT - Use unknown if needed
function processData(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  // Now TypeScript knows data is object
  const obj = data as Record<string, unknown>;
}
```

---

## 📊 Logging Best Practices

### Structured Logging

```typescript
// ✅ CORRECT - Contextual logging
console.log('Player verified', {
  userId: interaction.user.id,
  username: interaction.user.username,
  riotId: `${name}#${tag}`,
  region,
});

console.error('Verification failed', {
  userId: interaction.user.id,
  error: error instanceof Error ? error.message : String(error),
  riotId: `${name}#${tag}`,
});

// ❌ WRONG - Unstructured
console.log('Player verified'); // No context
console.error(error); // No context
```

### Log Levels

- `console.log` - Normal operations (info)
- `console.warn` - Warnings (missing config, fallbacks)
- `console.error` - Errors (exceptions, failures)
- `console.debug` - Debug info (can be removed in production)

---

## 🧪 Code Quality

### Function Responsibilities

```typescript
// ✅ CORRECT - Single responsibility
async function verifyRiotAccount(name: string, tag: string) {
  return await valorantAPI.getAccount(name, tag);
}

async function assignRankRole(member: GuildMember, rank: string) {
  // Role assignment logic
}

// ❌ WRONG - Too many responsibilities
async function verifyAndAssignRank(member, name, tag, region, ...) {
  // Verification, rank fetching, database update, role assignment all in one
}
```

### Error Messages

```typescript
// ✅ CORRECT - User-friendly messages
await interaction.editReply('❌ Could not verify account. Please check your Riot ID and try again.');

// ❌ WRONG - Technical error messages
await interaction.editReply(`Error: ${error.message}`); // Too technical
await interaction.editReply('FAILED'); // Not helpful
```

---

## 🚨 Common Mistakes to Avoid

### 1. Missing Defer Reply

```typescript
// ❌ WRONG - No defer for async operations
export async function execute(interaction) {
  const result = await longOperation(); // Takes > 3 seconds
  await interaction.reply(`Done: ${result}`); // Fails - interaction expired
}

// ✅ CORRECT
export async function execute(interaction) {
  await interaction.deferReply();
  const result = await longOperation();
  await interaction.editReply(`Done: ${result}`);
}
```

### 2. Not Handling Null/Undefined

```typescript
// ❌ WRONG
const player = await databaseService.getPlayer(userId);
await interaction.editReply(`Rank: ${player.discord_rank}`); // player could be null

// ✅ CORRECT
const player = await databaseService.getPlayer(userId);
if (!player) {
  await interaction.editReply('❌ Player not found.');
  return;
}
await interaction.editReply(`Rank: ${player.discord_rank}`);
```

### 3. Forgetting Error Context

```typescript
// ❌ WRONG
catch (error) {
  console.error(error); // Which command? Which user?
}

// ✅ CORRECT
catch (error) {
  console.error('Command failed', {
    command: interaction.commandName,
    userId: interaction.user.id,
    error: error instanceof Error ? error.message : String(error),
  });
}
```

---

## 📋 Command Checklist

Before submitting a command, verify:

- [ ] Defer reply for async operations
- [ ] Input validation (Zod or manual checks)
- [ ] Try-catch error handling
- [ ] Contextual error logging
- [ ] User-friendly error messages
- [ ] Null/undefined checks
- [ ] TypeScript types (no `any`)
- [ ] Timeouts on external API calls
- [ ] Database error handling

---

## 🎓 Quick Reference

**Every command should have:**
```
□ Defer reply
□ Input validation
□ Try-catch
□ Error logging with context
□ User-friendly responses
□ Type safety
```

---

*Adapted from engineering guardrails for Discord bot context*
*Version: 1.0*
