import { useCurrentFrame, interpolate } from 'remotion';
import { SceneGraph, PositionedNode, LayoutEdge } from '@/types/diagram';

interface DiagramRendererProps {
  scene: SceneGraph;
  progress: number;
  color: string;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({ scene, progress, color }) => {
  const frame = useCurrentFrame();

  // Use layout if available, otherwise calculate simple layout
  const nodes = scene.layout?.nodes || scene.nodes.map((node, idx) => ({
    ...node,
    x: 200 + (idx % 3) * 500,
    y: 200 + Math.floor(idx / 3) * 200,
    w: 240,
    h: 80,
  })) as PositionedNode[];

  const edges = scene.layout?.edges || scene.edges.map(edge => ({
    ...edge,
    points: [
      { x: 200, y: 200 },
      { x: 700, y: 200 }
    ]
  })) as LayoutEdge[];

  // Animation timing
  const nodesStartDelay = 0.2;
  const edgesStartDelay = 0.6;
  const nodeStagger = 0.1;
  const edgeStagger = 0.05;

  return (
    <svg
      width="1800"
      height="600"
      viewBox="0 0 1920 800"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Background grid for visual appeal */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        </pattern>

        {/* Arrow marker for edges */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={color}
            opacity="0.8"
          />
        </marker>

        {/* Glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Render edges first (so they appear behind nodes) */}
      {edges.map((edge, edgeIdx) => {
        const edgeProgress = interpolate(
          progress,
          [edgesStartDelay + edgeIdx * edgeStagger, edgesStartDelay + edgeIdx * edgeStagger + 0.3],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        if (edgeProgress <= 0 || edge.points.length < 2) return null;

        const totalLength = edge.points.reduce((acc, point, idx) => {
          if (idx === 0) return 0;
          const prev = edge.points[idx - 1];
          return acc + Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
        }, 0);

        const currentLength = totalLength * edgeProgress;
        let accumulatedLength = 0;
        let currentSegment = 0;

        for (let i = 1; i < edge.points.length; i++) {
          const prev = edge.points[i - 1];
          const curr = edge.points[i];
          const segmentLength = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));

          if (accumulatedLength + segmentLength >= currentLength) {
            currentSegment = i - 1;
            break;
          }
          accumulatedLength += segmentLength;
        }

        const visiblePoints = edge.points.slice(0, currentSegment + 1);
        if (currentSegment < edge.points.length - 1) {
          const prev = edge.points[currentSegment];
          const next = edge.points[currentSegment + 1];
          const segmentProgress = (currentLength - accumulatedLength) /
            Math.sqrt(Math.pow(next.x - prev.x, 2) + Math.pow(next.y - prev.y, 2));

          visiblePoints.push({
            x: prev.x + (next.x - prev.x) * segmentProgress,
            y: prev.y + (next.y - prev.y) * segmentProgress,
          });
        }

        const pathData = visiblePoints.reduce((acc, point, idx) => {
          return acc + (idx === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
        }, '');

        return (
          <g key={`edge-${edgeIdx}`}>
            {/* Edge shadow */}
            <path
              d={pathData}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="6"
              fill="none"
              transform="translate(2, 2)"
            />

            {/* Main edge */}
            <path
              d={pathData}
              stroke={color}
              strokeWidth="4"
              fill="none"
              markerEnd={edgeProgress > 0.9 ? "url(#arrowhead)" : undefined}
              opacity={0.8}
              filter="url(#glow)"
            />

            {/* Edge label */}
            {edge.label && edgeProgress > 0.5 && edge.points.length >= 2 && (
              <text
                x={(edge.points[0].x + edge.points[edge.points.length - 1].x) / 2}
                y={(edge.points[0].y + edge.points[edge.points.length - 1].y) / 2 - 10}
                textAnchor="middle"
                fontSize="16"
                fill="white"
                opacity={interpolate(edgeProgress, [0.5, 1], [0, 0.8])}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Render nodes */}
      {nodes.map((node, nodeIdx) => {
        const nodeProgress = interpolate(
          progress,
          [nodesStartDelay + nodeIdx * nodeStagger, nodesStartDelay + nodeIdx * nodeStagger + 0.4],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        if (nodeProgress <= 0) return null;

        const scale = interpolate(nodeProgress, [0, 1], [0.3, 1]);
        const opacity = interpolate(nodeProgress, [0, 0.5, 1], [0, 0.8, 1]);

        return (
          <g
            key={`node-${nodeIdx}`}
            transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
            opacity={opacity}
          >
            {/* Node shadow */}
            <rect
              x="2"
              y="2"
              width={node.w}
              height={node.h}
              rx="12"
              fill="rgba(0,0,0,0.3)"
            />

            {/* Node background */}
            <rect
              x="0"
              y="0"
              width={node.w}
              height={node.h}
              rx="12"
              fill={`${color}20`}
              stroke={color}
              strokeWidth="2"
              filter="url(#glow)"
            />

            {/* Node text */}
            <foreignObject
              x="16"
              y="16"
              width={node.w - 32}
              height={node.h - 32}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'white',
                  fontSize: Math.min(18, node.w / 10),
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: '1.2',
                  wordBreak: 'break-word',
                  padding: '4px',
                }}
              >
                {node.label}
              </div>
            </foreignObject>

            {/* Node icon/indicator */}
            {node.meta?.importance && (
              <circle
                cx={node.w - 20}
                cy="20"
                r="8"
                fill={color}
                opacity={interpolate(nodeProgress, [0.5, 1], [0, 1])}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};