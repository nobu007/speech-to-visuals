#!/usr/bin/env node

/**
 * Test current system using one of the existing comprehensive demos
 */

import fs from 'fs';
import { execSync } from 'child_process';

async function testCurrentSystem() {
  console.log('🔍 Testing Current Audio-to-Diagram System');

  try {
    // Look for existing comprehensive demo scripts
    const demoFiles = [
      'comprehensive-audio-diagram-demo.mjs',
      'demo-audio-to-visual-complete-system.mjs',
      'real-audio-demo-complete.mjs'
    ];

    let selectedDemo = null;
    for (const file of demoFiles) {
      if (fs.existsSync(file)) {
        selectedDemo = file;
        break;
      }
    }

    if (!selectedDemo) {
      console.log('❌ No demo scripts found');
      return false;
    }

    console.log(`📁 Running: ${selectedDemo}`);

    // Execute the demo script
    const output = execSync(`node ${selectedDemo}`, {
      encoding: 'utf8',
      timeout: 60000 // 60 second timeout
    });

    console.log('✅ Demo completed successfully!');
    console.log('📊 Output preview:');
    console.log(output.split('\n').slice(-10).join('\n')); // Show last 10 lines

    return true;

  } catch (error) {
    console.error('❌ Demo failed:', error.message);

    // Try to extract useful info from stderr
    if (error.stderr) {
      console.log('📋 Error details:');
      console.log(error.stderr.slice(-500)); // Last 500 chars of error
    }

    return false;
  }
}

// Execute test
testCurrentSystem()
  .then(success => {
    if (success) {
      console.log('\n🎉 Current system is functional!');
      process.exit(0);
    } else {
      console.log('\n⚠️  System needs attention.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });