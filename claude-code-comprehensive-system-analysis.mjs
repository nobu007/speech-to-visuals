#!/usr/bin/env node
/**
 * 🎯 Claude Code Comprehensive System Analysis
 *
 * This script performs a deep analysis of the speech-to-visuals system to identify:
 * - Performance bottlenecks
 * - Code quality issues
 * - Architecture improvements
 * - Resource optimization opportunities
 * - User experience enhancements
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SystemAnalyzer {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      analysis: {
        codebase: {},
        performance: {},
        architecture: {},
        dependencies: {},
        optimization: {}
      },
      recommendations: [],
      metrics: {}
    };
  }

  async analyzeCodebase() {
    console.log('🔍 Analyzing codebase structure...');

    try {
      // Analyze src directory structure
      const srcStats = await this.analyzeDirectory('./src');
      this.results.analysis.codebase = {
        totalFiles: srcStats.totalFiles,
        totalLines: srcStats.totalLines,
        modules: srcStats.modules,
        complexity: this.calculateComplexity(srcStats),
        coverage: await this.estimateTestCoverage()
      };

      // Check for code quality patterns
      await this.analyzeCodeQuality();

    } catch (error) {
      console.error('Error analyzing codebase:', error);
      this.results.analysis.codebase.error = error.message;
    }
  }

  async analyzeDirectory(dirPath) {
    const stats = {
      totalFiles: 0,
      totalLines: 0,
      modules: {},
      fileTypes: {}
    };

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory() && !item.name.startsWith('.')) {
          const subStats = await this.analyzeDirectory(fullPath);
          stats.totalFiles += subStats.totalFiles;
          stats.totalLines += subStats.totalLines;
          stats.modules[item.name] = subStats;
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n').length;
            stats.totalFiles++;
            stats.totalLines += lines;

            const ext = path.extname(item.name);
            stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          } catch (err) {
            console.warn(`Could not read file ${fullPath}:`, err.message);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error.message);
    }

    return stats;
  }

  calculateComplexity(stats) {
    // Simple complexity calculation based on files and lines
    const avgLinesPerFile = stats.totalFiles > 0 ? stats.totalLines / stats.totalFiles : 0;
    const moduleCount = Object.keys(stats.modules).length;

    return {
      avgLinesPerFile,
      moduleCount,
      complexityScore: moduleCount * Math.log(avgLinesPerFile + 1)
    };
  }

  async estimateTestCoverage() {
    try {
      // Check for test files
      const testFiles = await this.findTestFiles('./src');
      const srcFiles = await this.countSourceFiles('./src');

      return {
        testFiles: testFiles.length,
        sourceFiles: srcFiles,
        estimatedCoverage: srcFiles > 0 ? (testFiles.length / srcFiles) * 100 : 0
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async findTestFiles(dirPath) {
    const testFiles = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory() && !item.name.startsWith('.')) {
          const subTests = await this.findTestFiles(fullPath);
          testFiles.push(...subTests);
        } else if (item.isFile() && (
          item.name.includes('.test.') ||
          item.name.includes('.spec.') ||
          item.name.includes('-test.')
        )) {
          testFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error.message);
    }

    return testFiles;
  }

  async countSourceFiles(dirPath) {
    let count = 0;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory() && !item.name.startsWith('.')) {
          count += await this.countSourceFiles(fullPath);
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          count++;
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error.message);
    }

    return count;
  }

  async analyzeCodeQuality() {
    console.log('📊 Analyzing code quality...');

    const qualityMetrics = {
      duplicateCode: await this.checkForDuplicates(),
      largeFiles: await this.findLargeFiles(),
      complexFunctions: await this.findComplexFunctions(),
      unusedImports: await this.checkUnusedImports()
    };

    this.results.analysis.codebase.quality = qualityMetrics;
  }

  async checkForDuplicates() {
    // Simplified duplicate detection - would use AST in real implementation
    const fileHashes = new Map();
    const duplicates = [];

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const normalizedContent = content.replace(/\s+/g, ' ').trim();
          const hash = this.simpleHash(normalizedContent);

          if (fileHashes.has(hash)) {
            duplicates.push({ file, duplicate: fileHashes.get(hash) });
          } else {
            fileHashes.set(hash, file);
          }
        } catch (err) {
          console.warn(`Could not read file ${file}:`, err.message);
        }
      }
    } catch (error) {
      console.warn('Error checking duplicates:', error.message);
    }

    return { count: duplicates.length, files: duplicates };
  }

  async getAllSourceFiles(dirPath) {
    const files = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory() && !item.name.startsWith('.')) {
          const subFiles = await this.getAllSourceFiles(fullPath);
          files.push(...subFiles);
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error.message);
    }

    return files;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  async findLargeFiles() {
    const largeFiles = [];
    const threshold = 500; // lines

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n').length;

          if (lines > threshold) {
            largeFiles.push({ file, lines });
          }
        } catch (err) {
          console.warn(`Could not read file ${file}:`, err.message);
        }
      }
    } catch (error) {
      console.warn('Error finding large files:', error.message);
    }

    return largeFiles.sort((a, b) => b.lines - a.lines);
  }

  async findComplexFunctions() {
    // Simplified complexity analysis
    const complexFunctions = [];

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const functions = this.extractFunctions(content);

          for (const func of functions) {
            if (func.complexity > 10) {
              complexFunctions.push({ file, ...func });
            }
          }
        } catch (err) {
          console.warn(`Could not analyze file ${file}:`, err.message);
        }
      }
    } catch (error) {
      console.warn('Error finding complex functions:', error.message);
    }

    return complexFunctions;
  }

  extractFunctions(content) {
    const functions = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Simple function detection
      const funcMatch = line.match(/(function\s+\w+|const\s+\w+\s*=.*=>|\w+\s*\(.*\)\s*=>)/);
      if (funcMatch) {
        let braceCount = 0;
        let complexity = 1; // Base complexity
        let funcLines = 0;

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          funcLines++;

          // Count control structures for complexity
          if (currentLine.match(/(if|for|while|switch|catch)/)) {
            complexity++;
          }

          // Track braces to find function end
          braceCount += (currentLine.match(/\{/g) || []).length;
          braceCount -= (currentLine.match(/\}/g) || []).length;

          if (braceCount === 0 && j > i) {
            functions.push({
              name: funcMatch[0],
              line: i + 1,
              lines: funcLines,
              complexity
            });
            break;
          }
        }
      }
    }

    return functions;
  }

  async checkUnusedImports() {
    // Simplified unused import detection
    const unusedImports = [];

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const imports = this.extractImports(content);
          const used = this.findUsedIdentifiers(content);

          const unused = imports.filter(imp => !used.includes(imp));
          if (unused.length > 0) {
            unusedImports.push({ file, unused });
          }
        } catch (err) {
          console.warn(`Could not analyze imports in ${file}:`, err.message);
        }
      }
    } catch (error) {
      console.warn('Error checking unused imports:', error.message);
    }

    return unusedImports;
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import\s*\{([^}]+)\}/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importedItems = match[1].split(',').map(item => item.trim());
      imports.push(...importedItems);
    }

    return imports;
  }

  findUsedIdentifiers(content) {
    // Simple identifier usage detection
    const identifiers = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    return [...new Set(identifiers)];
  }

  async analyzeDependencies() {
    console.log('📦 Analyzing dependencies...');

    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf-8'));

      const deps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};

      this.results.analysis.dependencies = {
        production: Object.keys(deps).length,
        development: Object.keys(devDeps).length,
        total: Object.keys(deps).length + Object.keys(devDeps).length,
        heavyDependencies: this.identifyHeavyDependencies(deps),
        outdated: await this.checkOutdatedDependencies(deps, devDeps)
      };
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
      this.results.analysis.dependencies.error = error.message;
    }
  }

  identifyHeavyDependencies(deps) {
    // Known heavy dependencies that could impact performance
    const heavyDeps = [
      '@remotion/bundler', '@remotion/cli', 'remotion',
      '@dagrejs/dagre', 'kuromoji', 'whisper-node'
    ];

    return Object.keys(deps).filter(dep =>
      heavyDeps.some(heavy => dep.includes(heavy))
    );
  }

  async checkOutdatedDependencies(deps, devDeps) {
    // In a real implementation, this would check npm registry
    // For now, just identify potential candidates for updates
    const allDeps = { ...deps, ...devDeps };
    const potentialUpdates = [];

    for (const [name, version] of Object.entries(allDeps)) {
      // Simple heuristic: if version doesn't start with ^, might be outdated
      if (!version.startsWith('^') && !version.startsWith('~')) {
        potentialUpdates.push({ name, version });
      }
    }

    return potentialUpdates;
  }

  async analyzePerformance() {
    console.log('⚡ Analyzing performance patterns...');

    this.results.analysis.performance = {
      bundleSize: await this.estimateBundleSize(),
      renderingOptimization: await this.analyzeRenderingPatterns(),
      memorylUsage: await this.analyzeMemoryPatterns(),
      asyncPatterns: await this.analyzeAsyncPatterns()
    };
  }

  async estimateBundleSize() {
    try {
      // Check if dist directory exists
      const distStats = await fs.stat('./dist').catch(() => null);

      if (distStats) {
        const distSize = await this.calculateDirectorySize('./dist');
        return { estimated: distSize, hasBuiltVersion: true };
      } else {
        // Estimate based on dependencies
        const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
        const depCount = Object.keys(packageJson.dependencies || {}).length;
        const estimatedSize = depCount * 100; // Rough estimate: 100KB per dependency

        return { estimated: estimatedSize, hasBuiltVersion: false };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  async calculateDirectorySize(dirPath) {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error.message);
    }

    return totalSize;
  }

  async analyzeRenderingPatterns() {
    const patterns = {
      unnecessaryRerenders: 0,
      missingMemoization: 0,
      heavyComponents: 0
    };

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        if (file.endsWith('.tsx')) {
          const content = await fs.readFile(file, 'utf-8');

          // Check for potential performance issues
          if (content.includes('useState') && !content.includes('useMemo')) {
            patterns.missingMemoization++;
          }

          if (content.includes('useEffect') && content.includes('[]') === false) {
            patterns.unnecessaryRerenders++;
          }

          if (content.split('\n').length > 200) {
            patterns.heavyComponents++;
          }
        }
      }
    } catch (error) {
      console.warn('Error analyzing rendering patterns:', error.message);
    }

    return patterns;
  }

  async analyzeMemoryPatterns() {
    const memoryIssues = [];

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Look for potential memory leaks
        if (content.includes('setInterval') && !content.includes('clearInterval')) {
          memoryIssues.push({ file, issue: 'Potential interval leak' });
        }

        if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
          memoryIssues.push({ file, issue: 'Potential event listener leak' });
        }

        if (content.includes('new ') && content.includes('Array') && content.includes('(')) {
          memoryIssues.push({ file, issue: 'Large array allocation' });
        }
      }
    } catch (error) {
      console.warn('Error analyzing memory patterns:', error.message);
    }

    return memoryIssues;
  }

  async analyzeAsyncPatterns() {
    const asyncIssues = [];

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Look for async/await patterns
        const asyncFunctions = (content.match(/async\s+\w+/g) || []).length;
        const awaitCalls = (content.match(/await\s+/g) || []).length;
        const promiseCalls = (content.match(/\.then\(/g) || []).length;

        if (promiseCalls > 3 && asyncFunctions === 0) {
          asyncIssues.push({ file, issue: 'Consider using async/await instead of Promises' });
        }

        if (asyncFunctions > 5) {
          asyncIssues.push({ file, issue: 'High number of async functions - consider batching' });
        }
      }
    } catch (error) {
      console.warn('Error analyzing async patterns:', error.message);
    }

    return asyncIssues;
  }

  async analyzeArchitecture() {
    console.log('🏗️ Analyzing architecture...');

    this.results.analysis.architecture = {
      modularity: await this.analyzeModularity(),
      coupling: await this.analyzeCoupling(),
      cohesion: await this.analyzeCohesion(),
      patterns: await this.identifyDesignPatterns()
    };
  }

  async analyzeModularity() {
    try {
      const srcStats = await this.analyzeDirectory('./src');
      const moduleCount = Object.keys(srcStats.modules).length;
      const avgFilesPerModule = moduleCount > 0 ? srcStats.totalFiles / moduleCount : 0;

      return {
        moduleCount,
        avgFilesPerModule,
        modularityScore: moduleCount > 0 ? Math.min(10, moduleCount / avgFilesPerModule) : 0
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeCoupling() {
    const imports = new Map();

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const fileImports = this.extractAllImports(content);
        imports.set(file, fileImports);
      }

      // Calculate coupling metrics
      const totalImports = Array.from(imports.values()).reduce((sum, imp) => sum + imp.length, 0);
      const avgImportsPerFile = totalImports / files.length;

      return {
        totalImports,
        avgImportsPerFile,
        couplingScore: avgImportsPerFile
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  extractAllImports(content) {
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    return importLines;
  }

  async analyzeCohesion() {
    // Simple cohesion analysis based on file organization
    const modules = new Map();

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        const module = path.dirname(file).split(path.sep).pop();
        if (!modules.has(module)) {
          modules.set(module, []);
        }
        modules.get(module).push(file);
      }

      const cohesionScores = [];
      for (const [module, files] of modules) {
        const score = files.length; // Simple metric: more files in module = higher cohesion
        cohesionScores.push({ module, files: files.length, score });
      }

      return {
        modules: cohesionScores,
        avgCohesion: cohesionScores.reduce((sum, m) => sum + m.score, 0) / cohesionScores.length
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async identifyDesignPatterns() {
    const patterns = {
      singleton: 0,
      factory: 0,
      observer: 0,
      strategy: 0,
      facade: 0
    };

    try {
      const files = await this.getAllSourceFiles('./src');

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Simple pattern detection
        if (content.includes('getInstance') || content.includes('static instance')) {
          patterns.singleton++;
        }

        if (content.includes('createFactory') || content.includes('Factory')) {
          patterns.factory++;
        }

        if (content.includes('subscribe') || content.includes('Observer')) {
          patterns.observer++;
        }

        if (content.includes('Strategy') || content.includes('execute')) {
          patterns.strategy++;
        }

        if (content.includes('Facade') || content.includes('interface')) {
          patterns.facade++;
        }
      }
    } catch (error) {
      console.warn('Error identifying design patterns:', error.message);
    }

    return patterns;
  }

  generateRecommendations() {
    console.log('💡 Generating optimization recommendations...');

    const recommendations = [];

    // Code quality recommendations
    if (this.results.analysis.codebase.quality?.largeFiles?.length > 0) {
      recommendations.push({
        category: 'Code Quality',
        priority: 'Medium',
        issue: `Found ${this.results.analysis.codebase.quality.largeFiles.length} large files`,
        solution: 'Break down large files into smaller, focused modules',
        impact: 'Improved maintainability and readability'
      });
    }

    if (this.results.analysis.codebase.quality?.complexFunctions?.length > 0) {
      recommendations.push({
        category: 'Code Quality',
        priority: 'High',
        issue: `Found ${this.results.analysis.codebase.quality.complexFunctions.length} complex functions`,
        solution: 'Refactor complex functions into smaller, single-responsibility functions',
        impact: 'Reduced cognitive load and improved testability'
      });
    }

    // Performance recommendations
    if (this.results.analysis.performance?.renderingOptimization?.missingMemoization > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        issue: `${this.results.analysis.performance.renderingOptimization.missingMemoization} components missing memoization`,
        solution: 'Add React.memo, useMemo, and useCallback for expensive operations',
        impact: 'Reduced unnecessary re-renders and improved UI responsiveness'
      });
    }

    if (this.results.analysis.performance?.memorylUsage?.length > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        issue: `Found ${this.results.analysis.performance.memorylUsage.length} potential memory leaks`,
        solution: 'Add proper cleanup for intervals, event listeners, and subscriptions',
        impact: 'Improved memory usage and application stability'
      });
    }

    // Architecture recommendations
    if (this.results.analysis.architecture?.coupling?.avgImportsPerFile > 5) {
      recommendations.push({
        category: 'Architecture',
        priority: 'Medium',
        issue: 'High coupling detected between modules',
        solution: 'Implement dependency injection and reduce direct imports',
        impact: 'Improved modularity and easier testing'
      });
    }

    // Dependency recommendations
    if (this.results.analysis.dependencies?.total > 50) {
      recommendations.push({
        category: 'Dependencies',
        priority: 'Low',
        issue: 'Large number of dependencies',
        solution: 'Audit and remove unused dependencies, consider tree-shaking',
        impact: 'Reduced bundle size and faster build times'
      });
    }

    this.results.recommendations = recommendations;
  }

  generateMetrics() {
    console.log('📈 Calculating overall metrics...');

    const codebase = this.results.analysis.codebase;
    const performance = this.results.analysis.performance;
    const architecture = this.results.analysis.architecture;

    this.results.metrics = {
      overall: {
        healthScore: this.calculateHealthScore(),
        maintainabilityIndex: this.calculateMaintainabilityIndex(codebase),
        performanceScore: this.calculatePerformanceScore(performance),
        architectureScore: this.calculateArchitectureScore(architecture)
      },
      detailed: {
        codeComplexity: codebase.complexity?.complexityScore || 0,
        testCoverage: codebase.coverage?.estimatedCoverage || 0,
        bundleEfficiency: this.calculateBundleEfficiency(performance),
        modularity: architecture.modularity?.modularityScore || 0
      }
    };
  }

  calculateHealthScore() {
    const factors = [];

    // Code quality factor
    const largeFiles = this.results.analysis.codebase.quality?.largeFiles?.length || 0;
    const complexFunctions = this.results.analysis.codebase.quality?.complexFunctions?.length || 0;
    factors.push(Math.max(0, 100 - (largeFiles * 5) - (complexFunctions * 10)));

    // Performance factor
    const memoryIssues = this.results.analysis.performance?.memorylUsage?.length || 0;
    const missingMemo = this.results.analysis.performance?.renderingOptimization?.missingMemoization || 0;
    factors.push(Math.max(0, 100 - (memoryIssues * 10) - (missingMemo * 5)));

    // Architecture factor
    const coupling = this.results.analysis.architecture?.coupling?.avgImportsPerFile || 0;
    factors.push(Math.max(0, 100 - (coupling * 3)));

    return factors.reduce((sum, score) => sum + score, 0) / factors.length;
  }

  calculateMaintainabilityIndex(codebase) {
    const complexity = codebase.complexity?.complexityScore || 0;
    const coverage = codebase.coverage?.estimatedCoverage || 0;
    const totalFiles = codebase.totalFiles || 1;

    // Simplified maintainability index
    return Math.max(0, 100 - (complexity / 10) + (coverage / 5) - (totalFiles / 20));
  }

  calculatePerformanceScore(performance) {
    let score = 100;

    if (performance.memorylUsage?.length > 0) {
      score -= performance.memorylUsage.length * 10;
    }

    if (performance.renderingOptimization?.missingMemoization > 0) {
      score -= performance.renderingOptimization.missingMemoization * 5;
    }

    if (performance.renderingOptimization?.heavyComponents > 0) {
      score -= performance.renderingOptimization.heavyComponents * 3;
    }

    return Math.max(0, score);
  }

  calculateArchitectureScore(architecture) {
    let score = 100;

    const coupling = architecture.coupling?.avgImportsPerFile || 0;
    if (coupling > 5) {
      score -= (coupling - 5) * 5;
    }

    const modularity = architecture.modularity?.modularityScore || 0;
    score += Math.min(20, modularity * 2);

    return Math.max(0, Math.min(100, score));
  }

  calculateBundleEfficiency(performance) {
    const bundleSize = performance.bundleSize?.estimated || 0;

    if (bundleSize < 500000) return 100; // < 500KB excellent
    if (bundleSize < 1000000) return 80; // < 1MB good
    if (bundleSize < 2000000) return 60; // < 2MB okay
    if (bundleSize < 5000000) return 40; // < 5MB poor
    return 20; // > 5MB very poor
  }

  async generateReport() {
    const reportPath = `./claude-code-system-analysis-${Date.now()}.json`;

    try {
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📋 Analysis report saved to: ${reportPath}`);

      // Generate summary
      this.printSummary();

      return reportPath;
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  printSummary() {
    console.log('\n🎯 === CLAUDE CODE SYSTEM ANALYSIS SUMMARY ===\n');

    const metrics = this.results.metrics.overall;
    console.log(`📊 Overall Health Score: ${metrics.healthScore.toFixed(1)}/100`);
    console.log(`🔧 Maintainability Index: ${metrics.maintainabilityIndex.toFixed(1)}/100`);
    console.log(`⚡ Performance Score: ${metrics.performanceScore.toFixed(1)}/100`);
    console.log(`🏗️  Architecture Score: ${metrics.architectureScore.toFixed(1)}/100`);

    console.log('\n📋 Top Recommendations:');
    this.results.recommendations
      .filter(rec => rec.priority === 'High')
      .slice(0, 3)
      .forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.category}] ${rec.issue}`);
        console.log(`   💡 ${rec.solution}`);
      });

    console.log('\n🎯 === Analysis Complete ===\n');
  }

  async run() {
    try {
      console.log('🚀 Starting comprehensive system analysis...\n');

      await this.analyzeCodebase();
      await this.analyzeDependencies();
      await this.analyzePerformance();
      await this.analyzeArchitecture();

      this.generateRecommendations();
      this.generateMetrics();

      return await this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }
}

// Run the analysis
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const analyzer = new SystemAnalyzer();
  analyzer.run()
    .then(reportPath => {
      console.log(`✅ Analysis completed successfully. Report: ${reportPath}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { SystemAnalyzer };