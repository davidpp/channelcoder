#!/usr/bin/env node

/**
 * Iterative Development with Sessions
 * 
 * This example shows how to use sessions for iterative development tasks
 * where you build something step by step with Claude's help.
 */

import { session } from '../src/index.js';

async function buildFeatureIteratively() {
  console.log('🏗️  Iterative Feature Development Example\n');
  
  // Create a session for our feature development
  const dev = session({ name: 'auth-feature' });
  
  try {
    // Step 1: Design the feature
    console.log('Step 1: Designing the authentication system\n');
    
    const design = await dev.claude(`
I need to build a user authentication system for a Node.js Express app.
Requirements:
- JWT-based authentication
- Email/password login
- Password reset functionality
- Session management

Please outline the components I'll need to build.
    `);
    
    console.log('✅ Design phase complete\n');
    console.log('Session ID:', dev.id());
    console.log('---\n');
    
    // Step 2: Start implementation
    console.log('Step 2: Implementing the User model\n');
    
    const userModel = await dev.claude(`
Based on our authentication design, let's start with the User model.
Show me a TypeScript implementation with proper types and validation.
    `);
    
    console.log('✅ User model designed\n');
    
    // Step 3: Continue with auth middleware
    console.log('Step 3: Building authentication middleware\n');
    
    const middleware = await dev.claude(`
Now let's create the JWT authentication middleware.
It should verify tokens and attach user info to requests.
    `);
    
    console.log('✅ Middleware implemented\n');
    
    // Save our progress
    const savedPath = await dev.save();
    console.log(`\n💾 Development session saved to: ${savedPath}`);
    console.log('   You can continue this later with: session.load("auth-feature")\n');
    
    // Show session summary
    console.log('📊 Session Summary:');
    console.log(`   Total exchanges: ${dev.messages().length / 2}`);
    console.log(`   Current session chain: ${dev.id()}`);
    console.log('   Topics covered: Design → User Model → Auth Middleware');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function continueNextDay() {
  console.log('\n📅 Next Day: Continuing Development\n');
  
  try {
    // Load yesterday's session
    const dev = await session.load('auth-feature');
    console.log('✅ Loaded previous session');
    console.log(`   Messages from yesterday: ${dev.messages().length}`);
    console.log(`   Continuing from session: ${dev.id()}\n`);
    
    // Continue where we left off
    console.log('Step 4: Adding password reset functionality\n');
    
    const passwordReset = await dev.claude(`
Let's add the password reset functionality we discussed.
We need email sending and secure token generation.
    `);
    
    console.log('✅ Password reset feature added\n');
    
    // Review what we've built
    console.log('Step 5: Final review\n');
    
    const review = await dev.claude(`
Can you summarize all the components we've built for the authentication system?
List any remaining tasks or improvements we should consider.
    `);
    
    console.log('✅ Development complete!\n');
    
    // Save final state
    await dev.save();
    
  } catch (error) {
    console.error('Error continuing session:', error);
  }
}

async function main() {
  // Simulate day 1 of development
  await buildFeatureIteratively();
  
  // Simulate continuing next day
  console.log('\n' + '='.repeat(60) + '\n');
  await continueNextDay();
  
  console.log('\n💡 Key Benefits:');
  console.log('   • Claude remembers all previous decisions and context');
  console.log('   • No need to re-explain requirements or past work');
  console.log('   • Perfect for multi-day development tasks');
  console.log('   • Sessions can be shared with team members');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}