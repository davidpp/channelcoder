#!/usr/bin/env node

/**
 * Code Review Session Example
 * 
 * Shows how to use sessions for conducting thorough code reviews
 * with Claude, maintaining context across multiple files and discussions.
 */

import { session } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function createMockFiles() {
  // Create some example files to review
  const testDir = './tmp-review-example';
  await fs.mkdir(testDir, { recursive: true });
  
  // User service file
  await fs.writeFile(join(testDir, 'userService.ts'), `
export class UserService {
  private users = new Map();
  
  async createUser(email: string, password: string) {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }
    
    const user = {
      id: Date.now(),
      email,
      password, // TODO: This should be hashed!
      createdAt: new Date()
    };
    
    this.users.set(email, user);
    return user;
  }
  
  async findByEmail(email: string) {
    return this.users.get(email);
  }
  
  // Problematic: No validation
  async updateUser(email: string, data: any) {
    const user = this.users.get(email);
    if (!user) return null;
    
    Object.assign(user, data);
    return user;
  }
}
`);

  // API controller file
  await fs.writeFile(join(testDir, 'userController.ts'), `
import { UserService } from './userService';

export class UserController {
  constructor(private userService: UserService) {}
  
  async register(req: any, res: any) {
    try {
      const { email, password } = req.body;
      
      // Missing input validation
      const user = await this.userService.createUser(email, password);
      
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async login(req: any, res: any) {
    const { email, password } = req.body;
    const user = await this.userService.findByEmail(email);
    
    if (user && user.password === password) {
      // Security issue: comparing plain passwords
      req.session.userId = user.id;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  }
}
`);

  return testDir;
}

async function conductCodeReview() {
  console.log('👀 Code Review Session Example\n');
  
  const testDir = await createMockFiles();
  console.log(`📁 Created example files in ${testDir}\n`);
  
  // Start a code review session
  const review = session({ name: 'security-review' });
  
  try {
    // First file review
    console.log('1️⃣ Reviewing UserService\n');
    
    const userServiceCode = await fs.readFile(join(testDir, 'userService.ts'), 'utf-8');
    
    const review1 = await review.claude(`
Please review this UserService class for security issues and best practices:

\`\`\`typescript
${userServiceCode}
\`\`\`

Focus on:
- Security vulnerabilities
- Data validation
- Best practices
- Potential bugs
    `);
    
    console.log('✅ UserService review complete\n');
    console.log('Issues found:', review1.data?.match(/\d+\./g)?.length || 'Several');
    console.log('---\n');
    
    // Second file review - Claude remembers context
    console.log('2️⃣ Reviewing UserController\n');
    
    const controllerCode = await fs.readFile(join(testDir, 'userController.ts'), 'utf-8');
    
    const review2 = await review.claude(`
Now review the UserController that uses the UserService we just reviewed:

\`\`\`typescript
${controllerCode}
\`\`\`

Consider how the issues in UserService affect this controller.
    `);
    
    console.log('✅ UserController review complete\n');
    
    // Ask for prioritized fixes
    console.log('3️⃣ Getting prioritized action items\n');
    
    const priorities = await review.claude(`
Based on both files we reviewed, what are the top 5 security issues 
I should fix first? Please order them by severity.
    `);
    
    console.log('✅ Priority list generated\n');
    
    // Get implementation help
    console.log('4️⃣ Getting implementation guidance\n');
    
    const implementation = await review.claude(`
Show me how to fix the password hashing issue with bcrypt.
Include the necessary imports and type definitions.
    `);
    
    console.log('✅ Implementation guidance received\n');
    
    // Save the review session
    const savedPath = await review.save();
    console.log(`\n💾 Review session saved to: ${savedPath}`);
    
    // Summary
    console.log('\n📊 Review Session Summary:');
    console.log(`   Files reviewed: 2`);
    console.log(`   Total interactions: ${review.messages().length / 2}`);
    console.log(`   Session saved for future reference`);
    
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('Review error:', error);
  }
}

async function followUpOnReview() {
  console.log('\n📋 Follow-up: Checking Implementation\n');
  
  try {
    // Load the previous review session
    const review = await session.load('security-review');
    console.log('✅ Loaded previous review session\n');
    
    // Check if fixes were implemented correctly
    const followUp = await review.claude(`
I've implemented the bcrypt password hashing you suggested.
Here's my updated code:

\`\`\`typescript
import bcrypt from 'bcrypt';

async createUser(email: string, password: string) {
  if (this.users.has(email)) {
    throw new Error('User already exists');
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = {
    id: Date.now(),
    email,
    password: hashedPassword,
    createdAt: new Date()
  };
  
  this.users.set(email, user);
  return user;
}
\`\`\`

Is this implementation correct? What about the login method?
    `);
    
    console.log('✅ Follow-up review complete\n');
    console.log('Claude remembers the entire review context!');
    
  } catch (error) {
    console.error('Follow-up error:', error);
  }
}

async function main() {
  // Conduct initial review
  await conductCodeReview();
  
  // Simulate coming back later to follow up
  console.log('\n' + '='.repeat(60) + '\n');
  await followUpOnReview();
  
  console.log('\n💡 Session Benefits for Code Reviews:');
  console.log('   • Maintains context across multiple files');
  console.log('   • Remembers all identified issues');
  console.log('   • Can follow up on implementation later');
  console.log('   • Creates audit trail of review decisions');
  console.log('   • Enables collaborative reviews (share session)');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}