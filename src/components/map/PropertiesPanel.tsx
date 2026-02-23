'use client';

import { useState, useEffect } from 'react';
import type { MapNode, MapSection, NodeType } from './MapBuilder';

interface PropertiesPanelProps {
  selectedNode: MapNode | null;
  selectedSection: MapSection | null;
  onUpdateType: (nodeId: string, type: NodeType) => void;
  onUpdateLabel: (nodeId: string, label: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onPrintQr?: (nodeId: string) => void;
}

export default function PropertiesPanel({
  selectedNode,
  selectedSection,
  onUpdateType,
  onUpdateLabel,
  onDeleteNode,
  onPrintQr,
}: PropertiesPanelProps) {
  const [label, setLabel] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionCategory, setSectionCategory] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');

  // Sync label with selected node
  useEffect(() => {
    setLabel(selectedNode?.label || '');
  }, [selectedNode?.id, selectedNode?.label]);

  // Sync section properties
  useEffect(() => {
    setSectionName(selectedSection?.name || '');
    setSectionCategory(selectedSection?.category || '');
    setSectionDescription(selectedSection?.description || '');
  }, [selectedSection, selectedNode?.id]);

  if (!selectedNode) {
    return (
      <aside className="w-[260px] bg-[#0d0d18] border-l border-white/10 flex flex-col items-center justify-center shrink-0">
        <p className="text-xs text-white/20">Select a node to edit</p>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] bg-[#0d0d18] border-l border-white/10 flex flex-col shrink-0 overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div>
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Node Properties
          </h3>
          <p className="text-[10px] text-white/25 mt-1 font-mono truncate">
            {selectedNode.id}
          </p>
        </div>

        {/* Position */}
        <div>
          <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-2">
            Position (meters)
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-[9px] text-white/30">X</span>
              <div className="mt-0.5 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white/70 font-mono">
                {selectedNode.x.toFixed(2)}
              </div>
            </div>
            <div className="flex-1">
              <span className="text-[9px] text-white/30">Z</span>
              <div className="mt-0.5 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white/70 font-mono">
                {selectedNode.z.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-2">
            Type
          </label>
          <select
            value={selectedNode.type}
            onChange={(e) =>
              onUpdateType(selectedNode.id, e.target.value as NodeType)
            }
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 outline-none focus:border-accent/40 transition-colors appearance-none cursor-pointer"
          >
            <option value="normal">Normal</option>
            <option value="entrance">Entrance</option>
            <option value="section">Section</option>
            <option value="qr_anchor">QR Anchor</option>
          </select>
        </div>

        {/* Label */}
        <div>
          <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-2">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => onUpdateLabel(selectedNode.id, label)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onUpdateLabel(selectedNode.id, label);
            }}
            placeholder="Optional label"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder-white/20 outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {/* Section (visible for section-type nodes) */}
        {selectedNode.type === 'section' && (
          <div className="pt-3 border-t border-white/10">
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-2">
              Destination Link
            </label>
            <p className="text-[10px] text-white/60 mb-3 leading-snug">
              This node is designated as a destination anchor. Head over to the <a href="/admin/destinations" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 font-medium">Destinations Dashboard</a> to link it to a specific section name, category, and icon.
            </p>
            {selectedSection ? (
              <div className="bg-white/5 border border-white/10 px-3 py-2 rounded text-xs text-white/80">
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-1">Linked Destination</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{selectedSection.icon || '📍'}</span>
                  <span className="font-semibold">{selectedSection.name}</span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded text-[10px] text-amber-500">
                This node is currently unlinked.
              </div>
            )}
          </div>
        )}

        {/* QR Anchor */}
        {selectedNode.type === 'qr_anchor' && (
          <div className="pt-3 border-t border-white/10">
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-2">
              QR Configuration
            </label>
            <button
              onClick={() => onPrintQr?.(selectedNode.id)}
              className="w-full py-2 flex items-center justify-center gap-2 rounded-lg bg-white text-[#0d0d18] text-xs font-bold hover:bg-gray-200 transition-colors"
            >
              <span>Generate & Print QR</span>
              <span className="text-sm">🖨️</span>
            </button>
            <p className="mt-2 text-[9px] text-white/30 leading-snug">
              Scanner payloads include store, version, floor, and this node ID to recalibrate AR engine.
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Delete node */}
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="w-full py-2 rounded-lg text-xs font-medium text-red-400/70 border border-red-400/20 hover:bg-red-400/10 hover:text-red-400 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </aside>
  );
}
