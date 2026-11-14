import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core } from 'cytoscape';
import type { GraphData } from '../types';

interface CaseGraphProps {
  graph: GraphData;
  highlightedEdgeIds: string[];
  caseId: string;
}

export const CaseGraph: React.FC<CaseGraphProps> = ({
  graph,
  highlightedEdgeIds,
  caseId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Convert graph nodes & edges to Cytoscape elements
    const elements = [
      ...graph.nodes.map((n) => {
        const labelStr = n.label || n.id;
        return {
          data: {
            id: n.id,
            label: labelStr.length > 14 ? labelStr.slice(0, 12) + '…' : labelStr,
            fullLabel: labelStr,
            inDegree: n.in_degree,
            outDegree: n.out_degree,
          },
        };
      }),
      ...graph.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          amount: e.amount,
          currency: e.currency,
          ts: e.ts,
        },
      })),
    ];

    // Destroy prior instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#2b2b29',
            'label': 'data(label)',
            'color': '#2b2b29',
            'font-size': '10px',
            'font-weight': 600,
            'font-family': 'Inter, monospace, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-color': '#fcfbf7',
            'text-background-opacity': 0.95,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': 'rgba(43, 43, 41, 0.15)',
            'width': 'mapData(inDegree + outDegree, 1, 10, 24, 48)',
            'height': 'mapData(inDegree + outDegree, 1, 10, 24, 48)',
            'border-width': 2,
            'border-color': '#c8bcae',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#296a6c',
            'border-color': '#387478',
            'border-width': 3,
            'color': '#296a6c',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': 'rgba(43, 43, 41, 0.35)',
            'target-arrow-color': 'rgba(43, 43, 41, 0.45)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
          },
        },
        {
          selector: '.highlighted-edge',
          style: {
            'width': 4.5,
            'line-color': '#296a6c',
            'target-arrow-color': '#296a6c',
            'arrow-scale': 1.2,
            'z-index': 999,
          },
        },
        {
          selector: '.highlighted-node',
          style: {
            'border-color': '#296a6c',
            'border-width': 3,
            'background-color': '#387478',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        padding: 50,
        nodeOverlap: 30,
        idealEdgeLength: 120,
        edgeElasticity: 100,
        nodeRepulsion: 800000,
        componentSpacing: 140,
        gravity: 80,
        numIter: 1000,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.data('fullLabel'));
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, caseId]);

  // Handle edge hover highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.edges().removeClass('highlighted-edge');
      cy.nodes().removeClass('highlighted-node');

      if (highlightedEdgeIds && highlightedEdgeIds.length > 0) {
        highlightedEdgeIds.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge && edge.length > 0) {
            edge.addClass('highlighted-edge');
            edge.source().addClass('highlighted-node');
            edge.target().addClass('highlighted-node');
          }
        });
      }
    });
  }, [highlightedEdgeIds]);

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 30);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: 'var(--color-bg-cream)' }}>
      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
        }}
      >
        <button
          onClick={handleFit}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--border-btn-light)',
            backgroundColor: 'var(--color-bg-nav-blur)',
            backdropFilter: 'blur(4px)',
            color: 'var(--color-ink)',
            cursor: 'pointer',
          }}
        >
          Reset View
        </button>
      </div>

      {/* Selected node info banner */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 10,
            padding: '6px 12px',
            backgroundColor: 'var(--color-bg-nav-blur)',
            backdropFilter: 'blur(6px)',
            border: 'var(--border-card)',
            borderRadius: 'var(--radius-card)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Node: {selectedNode}
        </div>
      )}

      {/* Graph container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
