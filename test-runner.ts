import { runComprehensiveTests } from './src/test/pipeline-test';

// Run the comprehensive test suite
console.log('🧪 Starting Audio-to-Diagram Pipeline Test Suite');
console.log('================================================\n');

runComprehensiveTests()
  .then(() => {
    console.log('\n✅ All tests passed! Pipeline is ready for use.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  });