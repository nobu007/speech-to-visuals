# Known Issues & Technical Debt

**Last Updated**: 2026-05-02 (Phase 14/15)
**Status**: All Known Issues Resolved

---

## 1. Enhanced Zero Overlap Layout Engine - Property Naming Inconsistency

**Severity**: ~~MEDIUM~~ (resolved)
**Status**: RESOLVED IN PHASE 14
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

**Status**: Standard layout engine provides zero-overlap layouts successfully
**Impact**: LOW - Standard engine meets all quality requirements (100/100 score)

### Phase 14 Resolution (TASK-0094)

TASK-0094 unified all `width`/`height` references to `w`/`h` across the enhanced layout engine. All layout generation methods (flowchart, tree, timeline, comparison, network, concept map) now correctly use `w`/`h` per the `PositionedNode` type definition. The property naming inconsistency is fully resolved.

### Permanent Fix Requirements

1. **Option A**: ~~Update all enhanced layout code to use `w`/`h` (200+ line changes)~~ **IMPLEMENTED IN PHASE 14 (TASK-0094)**
2. **Option B**: Change `PositionedNode` type to use `width`/`height` (breaking change) - Not needed
3. **Option C**: Create adapter layer to convert between property conventions - Not needed

**Implemented**: Option A (aligned all code with type definitions)
**Status**: RESOLVED

### Related Files

- `src/types/diagram.ts` - Type definitions
- `src/visualization/enhanced-zero-overlap-layout.ts` - Implementation
- `src/visualization/layout-utils.ts` - Helper functions (correct)
- `src/pipeline/simple-pipeline.ts` - Usage/configuration

---

## 2. Edge Property Naming Inconsistency

**Severity**: LOW
**Status**: RESOLVED IN PHASE 14

### Issue Description

Similar to the node property issue, edges have inconsistent property naming:
- **Type Definition** (`EdgeDatum`, `LayoutEdge`): Uses `from` and `to`
- **Enhanced Layout Engine (some places)**: Uses `source` and `target`

### Phase 14 Resolution (TASK-0095)

TASK-0095 completed a comprehensive audit and fix of all edge property references across the codebase. `LayoutStrategy.ts` now uses an adapter pattern to correctly map between `from`/`to` and `source`/`target` conventions. All edge property inconsistencies have been resolved.

**Status**: RESOLVED
**Impact**: None - Edge properties are now consistently handled

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

**Current State**: All known issues resolved (Phase 14: property naming unified, Phase 15: quality maintenance)
**Next Steps**: Quality maintenance and coverage improvement (Phase 15+ focus)
**Future Enhancement**: Ongoing quality assurance and test coverage expansion

---

**Ref**: PHASE_29_COMPLETION_REPORT.md - Section "Technical Discoveries"
