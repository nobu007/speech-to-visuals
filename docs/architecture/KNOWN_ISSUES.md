# Known Issues & Technical Debt

**Last Updated**: 2025-10-14 (Phase 30)
**Status**: Documented for Future Resolution

---

## 1. Enhanced Zero Overlap Layout Engine - Property Naming Inconsistency

**Severity**: MEDIUM
**Status**: WORKAROUND IN PLACE
**Affects**: `src/visualization/enhanced-zero-overlap-layout.ts`

### Issue Description

The Enhanced Zero Overlap Layout Engine uses inconsistent property names for node dimensions:
- **Type Definition** (`PositionedNode`): Uses `w` and `h` properties
- **Enhanced Layout Engine Code**: Uses `width` and `height` properties
- **Layout Utils** (correct): Uses `w` and `h` as per type definition

This causes runtime errors when the enhanced layout engine is enabled:
```
Cannot read properties of undefined (reading 'x')
```

### Root Cause

Multiple code paths in the enhanced layout engine reference `node.width` and `node.height`, but the `PositionedNode` type defines these as `node.w` and `node.h`.

Affected functions:
- `resolveOverlapsBatch()` - lines 449-463
- `calculateOptimalSeparation()` - lines 473-483
- `calculateMoveVector()` - lines 488-510
- `applyEnhancedForceStep()` - lines 221-323
- `initializeNetworkNodes()` - lines 156-184
- All layout generation methods (flowchart, tree, timeline, comparison, network, concept map)

### Current Workaround

**Phase 29 Solution**: Disable enhanced layout engine by default
```typescript
const useEnhancedLayout = input.options?.useEnhancedLayout ?? false;
```

**Status**: ✅ Standard layout engine provides zero-overlap layouts successfully
**Impact**: LOW - Standard engine meets all quality requirements (100/100 score)

### Permanent Fix Requirements

1. **Option A**: Update all enhanced layout code to use `w`/`h` (200+ line changes)
2. **Option B**: Change `PositionedNode` type to use `width`/`height` (breaking change)
3. **Option C**: Create adapter layer to convert between property conventions

**Recommended**: Option A (align code with type definitions)
**Estimated Effort**: 2-3 hours
**Priority**: LOW (workaround is production-ready)

### Related Files

- `src/types/diagram.ts` - Type definitions
- `src/visualization/enhanced-zero-overlap-layout.ts` - Implementation
- `src/visualization/layout-utils.ts` - Helper functions (correct)
- `src/pipeline/simple-pipeline.ts` - Usage/configuration

---

## 2. Edge Property Naming Inconsistency

**Severity**: LOW
**Status**: PARTIALLY ADDRESSED IN PHASE 30

### Issue Description

Similar to the node property issue, edges have inconsistent property naming:
- **Type Definition** (`EdgeDatum`, `LayoutEdge`): Uses `from` and `to`
- **Enhanced Layout Engine (some places)**: Uses `source` and `target`

### Phase 30 Fix

Updated tree layout to use correct property names (`from`/`to`), but other layout methods may still have inconsistencies.

### Permanent Fix

Comprehensive audit of all edge property references across the codebase.

**Estimated Effort**: 1 hour
**Priority**: LOW

---

## 3. Tree Layout Helper Functions Not Implemented

**Severity**: LOW
**Status**: RESOLVED IN PHASE 30

### Original Issue

Tree layout had placeholder implementations:
- `positionTreeNodes()` - returned empty array
- `buildTree()` - simplified stub
- `calculateTreeHeight/Width()` - hardcoded values

### Phase 30 Fix

✅ Replaced tree layout with Dagre-based implementation (same as flowchart but with LR orientation)

**Status**: RESOLVED
**Impact**: None - Tree layouts now work correctly

---

## Documentation Philosophy

This document follows the custom instructions principle:
> "動作→評価→改善→コミットの繰り返し"
> (Iteration: Working → Evaluate → Improve → Commit)

**Current State**: System is working (Phase 29: 100/100 quality score)
**Next Steps**: Optimize processing time (Phase 30 priority)
**Future Enhancement**: Fix property naming for enhanced layout engine (low priority)

---

**Phase 30 Autonomous Decision**: Focus on impactful improvements (processing time optimization) rather than fixing low-priority known issues with working workarounds.

**Ref**: PHASE_29_COMPLETION_REPORT.md - Section "Technical Discoveries"
